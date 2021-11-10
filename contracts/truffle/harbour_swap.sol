pragma solidity ^0.8.9;

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
  uint256 constant RATIO = 2**128;
  uint256 constant BPS = 1000;

  // token => currency => priceRatio => Market
  mapping(address => mapping(address => mapping(uint256 => MarketBucket)))
    private _markets;

  uint256 public exchangeFeeBps;
  address payable public exchangeFeeAddress;
  mapping(address => uint256) public feeBalance;

  uint48 public windowBlocks = 5;
  uint48 public minLiveBlocks = 10;
  uint48 public freeCancelBlocks = 15;

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

  event ExchangeBlocksUpdate(
    uint48 windowBlocks,
    uint48 minLiveBlocks,
    uint48 freeCancelBlocks
  );

  function setExchangeBlocks(
    uint48 newWindow,
    uint48 newMinLive,
    uint48 newFreeCancel
  ) public onlyAdmin {
    windowBlocks = newWindow;
    minLiveBlocks = newMinLive;
    freeCancelBlocks = newFreeCancel;
    emit ExchangeBlocksUpdate(newWindow, newMinLive, newFreeCancel);
  }

  event BuyOrderPost(
    address indexed token,
    address indexed currency,
    uint256 indexed priceRatio,
    uint256 buyQuantity
  );
  event BuyOrderCancel(
    address indexed token,
    address indexed currency,
    uint256 indexed priceRatio,
    uint256 buyQuantity
  );
  event SellOrderPost(
    address indexed token,
    address indexed currency,
    uint256 indexed priceRatio,
    uint256 sellQuantity
  );
  event SellOrderCancel(
    address indexed token,
    address indexed currency,
    uint256 indexed priceRatio,
    uint256 sellQuantity
  );
  event Settled(
    address indexed token,
    address indexed currency,
    uint256 indexed priceRatio,
    uint256 quantity
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
    address buyer;
    uint256 quantity;
  }
  struct MarketBucket {
    BuyOrder[] buyOrderList;
    SellOrder[] sellOrderList;
    uint256 totalSell;
    uint256 totalBuy;
    uint48 lastSettledBlock;
  }

  function getMarketData(
    address token,
    address currency,
    uint256 priceRatio
  )
    public
    view
    returns (
      uint256 totalSell,
      uint256 totalBuy,
      uint48 lastSettledBlock
    )
  {
    MarketBucket storage bucket = _markets[token][currency][priceRatio];
    return (bucket.totalSell, bucket.totalBuy, bucket.lastSettledBlock);
  }

  function getBuyOrder(
    address token,
    address currency,
    uint256 priceRatio,
    uint256 index
  ) public view returns (BuyOrder memory) {
    return _markets[token][currency][priceRatio].buyOrderList[index];
  }

  function getSellOrder(
    address token,
    address currency,
    uint256 priceRatio,
    uint256 index
  ) public view returns (SellOrder memory) {
    return _markets[token][currency][priceRatio].sellOrderList[index];
  }

  function _getStartBlock(uint48 startBlock) internal view returns (uint48) {
    uint48 nextBlock = (uint48(block.number) / windowBlocks + 1) * windowBlocks;
    if (startBlock == 0) {
      startBlock = nextBlock;
    } else {
      require(startBlock >= nextBlock, 'invalid_start_block');
    }
    return startBlock;
  }

  function postSell(
    address token,
    address currency,
    uint8 priceBucket,
    uint8 priceShift,
    uint48 startBlock,
    uint48 endBlock,
    uint256 quantity,
    bool feeAdd
  ) public {
    uint256 priceRatio = uint256(priceBucket) << priceShift;
    startBlock = _getStartBlock(startBlock);

    uint256 fee = (quantity * exchangeFeeBps) / BPS;
    feeBalance[token] += fee;
    if (!feeAdd) {
      quantity -= fee;
    }
    IERC20(token).transferFrom(_msgSender(), address(this), quantity + fee);

    MarketBucket storage bucket = _markets[token][currency][priceRatio];
    bucket.sellOrderList.push(
      SellOrder(startBlock, endBlock, _msgSender(), quantity)
    );
    bucket.totalSell += quantity;
    emit SellOrderPost(token, currency, priceRatio, quantity);
  }

  function postBuy(
    address token,
    address currency,
    uint8 priceBucket,
    uint8 priceShift,
    uint48 startBlock,
    uint48 endBlock,
    uint256 quantity,
    bool feeAdd
  ) public {
    uint256 priceRatio = uint256(priceBucket) << priceShift;
    startBlock = _getStartBlock(startBlock);

    uint256 fee_token = (quantity * exchangeFeeBps) / BPS;
    uint256 fee_currency = (fee_token * priceRatio) / RATIO;
    uint256 tx_amount = (quantity * priceRatio) / RATIO;
    if (feeAdd) {
      tx_amount += fee_currency;
    } else {
      quantity -= fee_token;
    }
    feeBalance[currency] += fee_currency;
    IERC20(currency).transferFrom(_msgSender(), address(this), tx_amount);

    MarketBucket storage bucket = _markets[token][currency][priceRatio];
    bucket.buyOrderList.push(
      BuyOrder(startBlock, endBlock, _msgSender(), quantity)
    );
    bucket.totalBuy += quantity;
    emit BuyOrderPost(token, currency, priceRatio, quantity);
  }

  function _checkOrderBlocks(
    uint48 startBlock,
    uint48 endBlock,
    bool forceCancel
  ) internal view returns (bool isRefundable, bool isLive) {
    bool is_refundable = true;
    bool is_live = false;
    uint48 this_block = uint48(block.number);
    uint48 block_count = endBlock - startBlock;
    uint48 live_count = this_block - startBlock;
    if (block_count < minLiveBlocks) {
      is_refundable = false;
    } else if (live_count < freeCancelBlocks) {
      require(forceCancel, 'not_force');
      is_refundable = false;
    }
    if (startBlock <= this_block && this_block <= endBlock) {
      is_live = true;
    }
    return (is_refundable, is_live);
  }

  function cancelBuy(
    address token,
    address currency,
    uint256 priceRatio,
    uint256 index,
    bool forceCancel
  ) public {
    MarketBucket storage bucket = _markets[token][currency][priceRatio];
    BuyOrder storage order = bucket.buyOrderList[index];
    require(order.buyer == _msgSender(), 'not_owned');
    uint256 qty = order.quantity;
    require(qty > 0, 'already_closed');

    (bool refund_fee, bool is_live) = _checkOrderBlocks(
      order.startBlock,
      order.endBlock,
      forceCancel
    );
    uint256 currency_qty = (qty * priceRatio) / RATIO;
    uint256 fee = 0;
    if (refund_fee) {
      fee = (currency_qty * exchangeFeeBps) / BPS;
    }
    order.quantity = 0;
    feeBalance[currency] -= fee;
    if (is_live) {
      bucket.totalBuy -= qty;
    }
    IERC20(currency).transfer(_msgSender(), currency_qty + fee);
    emit BuyOrderCancel(token, currency, priceRatio, qty);
  }

  function cancelSell(
    address token,
    address currency,
    uint256 priceRatio,
    uint256 index,
    bool forceCancel
  ) public {
    MarketBucket storage bucket = _markets[token][currency][priceRatio];
    SellOrder storage order = bucket.sellOrderList[index];
    require(order.seller == _msgSender(), 'not_owned');
    uint256 qty = order.quantity;
    require(qty > 0, 'already_closed');

    (bool refund_fee, bool is_live) = _checkOrderBlocks(
      order.startBlock,
      order.endBlock,
      forceCancel
    );

    uint256 fee = 0;
    if (refund_fee) {
      fee = (qty * exchangeFeeBps) / BPS;
    }
    order.quantity = 0;
    feeBalance[token] -= fee;
    if (is_live) {
      bucket.totalSell -= qty;
    }
    IERC20(token).transfer(_msgSender(), qty + fee);
    emit SellOrderCancel(token, currency, priceRatio, qty);
  }

  function _settleBuyLimit(
    MarketBucket storage bucket,
    address token,
    uint256 settleBlock,
    uint256 limit
  ) internal returns (uint256) {
    uint256 buy_qty;
    address buyer;
    for (uint256 i = 0; i < bucket.buyOrderList.length; i++) {
      BuyOrder storage order = bucket.buyOrderList[i];
      if (order.startBlock <= settleBlock && settleBlock <= order.endBlock) {
        uint256 qty = order.quantity;
        if (qty > 0) {
          uint256 left = qty;
          if (limit > 0) {
            if (buyer == address(0)) {
              buyer = order.buyer;
            } else {
              require(order.buyer == buyer, 'not_single_buyer');
            }
            left = limit - buy_qty;
          }
          if (left > 0) {
            uint256 curr_qty;
            if (left >= qty) {
              curr_qty = qty;
              order.quantity = 0;
            } else {
              curr_qty = left;
              order.quantity -= left;
            }
            buy_qty += curr_qty;
            IERC20(token).transfer(order.buyer, curr_qty);
          }
        }
      }
    }
    return buy_qty;
  }

  function _settleSellLimit(
    MarketBucket storage bucket,
    address currency,
    uint256 priceRatio,
    uint256 settleBlock,
    uint256 limit
  ) internal returns (uint256) {
    uint256 sell_qty;
    address seller;
    for (uint256 i = 0; i < bucket.sellOrderList.length; i++) {
      SellOrder storage order = bucket.sellOrderList[i];
      if (order.startBlock <= settleBlock && settleBlock <= order.endBlock) {
        uint256 qty = order.quantity;
        if (qty > 0) {
          uint256 left = qty;
          if (limit > 0) {
            if (seller == address(0)) {
              seller = order.seller;
            } else {
              require(order.seller == seller, 'not_single_seller');
            }
            left = limit - sell_qty;
          }
          if (left > 0) {
            uint256 curr_qty;
            if (left >= qty) {
              curr_qty = qty;
              order.quantity = 0;
            } else {
              curr_qty = left;
              order.quantity -= left;
            }
            sell_qty += curr_qty;
            uint256 amount = (priceRatio * curr_qty) / RATIO;
            IERC20(currency).transfer(order.seller, amount);
          }
        }
      }
    }
    return sell_qty;
  }

  function settleBucketSingleSeller(
    address token,
    address currency,
    uint256 priceRatio,
    uint48 settleBlock
  ) public {
    MarketBucket storage bucket = _markets[token][currency][priceRatio];
    bucket.lastSettledBlock = settleBlock;

    uint256 buy_qty = _settleBuyLimit(bucket, token, settleBlock, 0);
    uint256 sell_qty = _settleSellLimit(
      bucket,
      currency,
      priceRatio,
      settleBlock,
      buy_qty
    );

    require(buy_qty == sell_qty, 'buy_sell_mismatch');
    bucket.totalBuy -= buy_qty;
    bucket.totalSell -= sell_qty;
    emit Settled(token, currency, priceRatio, buy_qty);
  }

  function settleBucketSingleBuyer(
    address token,
    address currency,
    uint256 priceRatio,
    uint48 settleBlock
  ) public {
    MarketBucket storage bucket = _markets[token][currency][priceRatio];
    bucket.lastSettledBlock = settleBlock;

    uint256 sell_qty = _settleSellLimit(
      bucket,
      currency,
      priceRatio,
      settleBlock,
      0
    );
    uint256 buy_qty = _settleBuyLimit(bucket, token, settleBlock, sell_qty);

    require(buy_qty == sell_qty, 'buy_sell_mismatch');
    bucket.totalBuy -= buy_qty;
    bucket.totalSell -= sell_qty;
    emit Settled(token, currency, priceRatio, buy_qty);
  }

  function settleBucketExact(
    address token,
    address currency,
    uint256 priceRatio,
    uint48 settleBlock
  ) public {
    MarketBucket storage bucket = _markets[token][currency][priceRatio];
    bucket.lastSettledBlock = settleBlock;
    uint256 buy_qty = _settleBuyLimit(bucket, token, settleBlock, 0);
    uint256 sell_qty = _settleSellLimit(
      bucket,
      currency,
      priceRatio,
      settleBlock,
      0
    );

    require(buy_qty == sell_qty, 'buy_sell_mismatch');
    bucket.totalBuy -= buy_qty;
    bucket.totalSell -= sell_qty;
    emit Settled(token, currency, priceRatio, buy_qty);
  }
}
