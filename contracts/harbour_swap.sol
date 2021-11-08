pragma solidity ^0.8.3;

// SPDX-License-Identifier: MIT

interface IERC20 {
  function balanceOf(address account) external view returns (uint256);

  function allowance(address owner, address spender)
    external
    view
    returns (uint256);

  function transfer(address recipient, uint256 amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);
}

library SafeMath {
  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    require(c >= a, 'SafeMath: addition overflow');

    return c;
  }

  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    return sub(a, b, 'SafeMath: subtraction overflow');
  }

  function sub(
    uint256 a,
    uint256 b,
    string memory errorMessage
  ) internal pure returns (uint256) {
    require(b <= a, errorMessage);
    uint256 c = a - b;

    return c;
  }

  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a == 0) {
      return 0;
    }

    uint256 c = a * b;
    require(c / a == b, 'SafeMath: multiplication overflow');

    return c;
  }

  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    return div(a, b, 'SafeMath: division by zero');
  }

  function div(
    uint256 a,
    uint256 b,
    string memory errorMessage
  ) internal pure returns (uint256) {
    require(b > 0, errorMessage);
    uint256 c = a / b;

    return c;
  }

  function mod(uint256 a, uint256 b) internal pure returns (uint256) {
    return mod(a, b, 'SafeMath: modulo by zero');
  }

  function mod(
    uint256 a,
    uint256 b,
    string memory errorMessage
  ) internal pure returns (uint256) {
    require(b != 0, errorMessage);
    return a % b;
  }
}

library Roles {
  struct Role {
    mapping(address => bool) bearer;
  }

  function add(Role storage role, address account) internal {
    require(!has(role, account), 'Roles: account already has role');
    role.bearer[account] = true;
  }

  function remove(Role storage role, address account) internal {
    require(has(role, account), 'Roles: account does not have role');
    role.bearer[account] = false;
  }

  function has(Role storage role, address account)
    internal
    view
    returns (bool)
  {
    require(account != address(0), 'Roles: account is the zero address');
    return role.bearer[account];
  }
}

abstract contract Context {
  function _msgSender() internal view returns (address) {
    return msg.sender;
  }

  function _msgData() internal view returns (bytes memory) {
    this;
    return msg.data;
  }
}

abstract contract AdminRole is Context {
  using Roles for Roles.Role;

  event AdminAdded(address indexed account);
  event AdminRemoved(address indexed account);

  Roles.Role private _admins;

  constructor() {
    _admins.add(_msgSender());
    emit AdminAdded(_msgSender());
  }

  modifier onlyAdmin() {
    require(
      _admins.has(_msgSender()),
      'AdminRole: caller does not have the Admin role'
    );
    _;
  }

  function addAdmin(address account) public onlyAdmin {
    _admins.add(account);
    emit AdminAdded(account);
  }

  function renounceAdmin() public onlyAdmin {
    _admins.remove(_msgSender());
    emit AdminRemoved(_msgSender());
  }
}

contract HarbourSwap is AdminRole {
  using SafeMath for uint256;

  uint48 constant MIN_WINDOW = 2;
  uint48 constant MIN_LIVE_BLOCKS = 10;
  uint48 constant FREE_CANCEL_BLOCKS = 5;
  uint256 constant RATIO = 2**96;
  uint256 constant BPS = 1000;

  // token => currency => priceRatio => Market
  mapping(address => mapping(address => mapping(uint192 => MarketBucket)))
    private _markets;

  uint256 public exchangeFeeBps;
  address payable public exchangeFeeAddress;
  mapping(address => uint256) public feeBalance;

  constructor(uint256 fee, address payable feeAddress) {
    exchangeFeeBps = fee;
    exchangeFeeAddress = feeAddress;
  }

  event FeeUpdate(address payable feeAddress, uint256 fee);

  function setExchangeFee(address payable feeAddress, uint256 fee)
    public
    onlyAdmin
  {
    exchangeFeeAddress = feeAddress;
    exchangeFeeBps = fee;
    emit FeeUpdate(feeAddress, fee);
  }

  event BuyOrderPost(
    address indexed token,
    address indexed currency,
    uint192 priceRatio,
    uint256 buyQuantity
  );
  event BuyOrderCancel(
    address indexed token,
    address indexed currency,
    uint192 priceRatio,
    uint256 buyQuantity
  );
  event SellOrderPost(
    address indexed token,
    address indexed currency,
    uint192 priceRatio,
    uint256 sellQuantity
  );
  event SellOrderCancel(
    address indexed token,
    address indexed currency,
    uint192 priceRatio,
    uint256 sellQuantity
  );

  struct SellOrder {
    uint48 startBlock;
    uint48 endBlock;
    address seller;
    uint256 quantity;
  }
  struct BuyOrder {
    uint48 startBlock;
    uint48 endBlock;
    address seller;
    uint256 quantity;
  }
  struct MarketBucket {
    uint256 totalSell;
    uint256 totalBuy;
    uint48 lastSettledBlock;
    BuyOrder[] buyOrderList;
    SellOrder[] sellOrderList;
  }

  function _sendTokens(
    address erc20,
    address from,
    address to,
    uint256 amount
  ) internal {
    require(
      IERC20(erc20).transferFrom(from, to, amount),
      'erc20_transfer_failed'
    );
  }

  function postSell(
    address token,
    address currency,
    uint192 priceRatio,
    uint48 endBlock,
    uint256 quantity
  ) public {
    uint256 live_blocks = endBlock - block.number + MIN_WINDOW;
    require(live_blocks > MIN_LIVE_BLOCKS, 'not_long_enough_window');

    IERC20(token).transferFrom(_msgSender(), address(this), quantity);
    uint256 fee = quantity * exchangeFeeBps / BPS;
    feeBalance[currency] += fee;
    uint256 sell_qty = quantity - fee;

    MarketBucket storage bucket = _markets[token][currency][priceRatio];
    bucket.sellOrderList.push(
      SellOrder(
        uint48(block.number) + MIN_WINDOW,
        endBlock,
        _msgSender(),
        sell_qty
      )
    );
    bucket.totalSell += sell_qty;
    emit SellOrderPost(token, currency, priceRatio, sell_qty);
  }

  function postBuy(
    address token,
    address currency,
    uint192 priceRatio,
    uint48 endBlock,
    uint256 quantity
  ) public {
    uint256 live_blocks = endBlock - block.number + MIN_WINDOW;
    require(live_blocks > MIN_LIVE_BLOCKS, 'not_long_enough_window');

    uint256 amount = (priceRatio * quantity) / RATIO;
    uint256 fee = amount * exchangeFeeBps / BPS;
    IERC20(currency).transferFrom(
      _msgSender(),
      address(this),
      amount + fee
    );
    feeBalance[currency] += fee;

    MarketBucket storage bucket = _markets[token][currency][priceRatio];
    bucket.buyOrderList.push(
      BuyOrder(
        uint48(block.number) + MIN_WINDOW,
        endBlock,
        _msgSender(),
        quantity
      )
    );
    bucket.totalBuy += quantity;
    emit BuyOrderPost(token, currency, priceRatio, quantity);
  }

  function settleBucketExact(
    address token,
    address currency,
    uint192 priceRatio,
    uint48 block
  ) public {
    MarketBucket storage bucket = _markets[token][currency][priceRatio];
    uint256 buy_qty;
    uint256 sell_qty;
    for (let i = 0 ; i < bucket.buyOrderList.length ; i++ ) {
      BuyOrder storage order = bucket.buyOrderList[i];
      if (order.startBlock <= block && block <= order.endBlock) {
        uint256 qty = order.quantity;
        if (qty > 0) {
          order.quantity = 0;
          buy_qty += qty;
          bucket.buyOrderList[i].quantity = 0;
          IERC20(token).transfer(order.address, qty);
        }
      }
    }
    for (let i = 0 ; i < bucket.sellOrderList.length ; i++ ) {
      SellOrder storage order = bucket.sellOrderList[i];
      if (order.startBlock <= block && block <= order.endBlock) {
        uint256 qty = order.quantity;
        if (qty > 0) {
          order.quantity = 0;
          sell_qty += qty;
          bucket.buyOrderList[i].quantity = 0;
          uint256 amount = (priceRatio * quantity) / RATIO;
          IERC20(currency).transfer(order.address, amount - fee);
        }
      }
    }
    require(buy_qty == sell_qty, 'not_exact_settlable');
    emit Settled(token, currency, priceRatio, buy_qty);
  }
}
