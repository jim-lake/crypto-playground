// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IERC20 {
  function transfer(address recipient, uint256 amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);
}

interface IERC721 {
  function ownerOf(uint256 tokenId) external view returns (address owner);

  function transferFrom(
    address from,
    address to,
    uint256 tokenId
  ) external;
}

interface IERC677Receiver {
  function onTokenTransfer(
    address sender,
    uint256 value,
    bytes memory data
  ) external;
}

interface IERC2981 {
  function royaltyInfo(uint256 _tokenId, uint256 _salePrice)
    external
    view
    returns (address receiver, uint256 royaltyAmount);
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

abstract contract AdminRole {
  using Roles for Roles.Role;

  event AdminAdded(address indexed account);
  event AdminRemoved(address indexed account);

  Roles.Role private _admins;

  constructor() {
    _admins.add(msg.sender);
    emit AdminAdded(msg.sender);
  }

  modifier onlyAdmin() {
    require(
      _admins.has(msg.sender),
      'AdminRole: caller does not have the Admin role'
    );
    _;
  }

  function addAdmin(address account) public onlyAdmin {
    _admins.add(account);
    emit AdminAdded(account);
  }

  function renounceAdmin() public onlyAdmin {
    _admins.remove(msg.sender);
    emit AdminRemoved(msg.sender);
  }
}

abstract contract CreatorWithdraw {
  address payable private _creator;

  constructor() {
    _creator = payable(msg.sender);
  }

  // solhint-disable-next-line no-empty-blocks
  receive() external payable {
    // thank you
  }

  function withdraw(address erc20, uint256 amount) public {
    if (erc20 == address(0)) {
      _creator.transfer(amount);
    } else {
      IERC20(erc20).transfer(_creator, amount);
    }
  }

  function withdrawToken(address erc721, uint256 tokenId) public {
    IERC721(erc721).transferFrom(address(this), _creator, tokenId);
  }
}

contract HarbourStore is CreatorWithdraw, AdminRole {
  struct Sale {
    uint256 price;
    uint256[] tokenIds;
    address token;
    address coin;
  }

  event Created();
  event Post(
    bytes32 indexed sku,
    address indexed token,
    address indexed coin,
    uint256 price,
    uint256 quantity
  );
  event Buy(
    bytes32 indexed sku,
    address indexed token,
    uint256 indexed tokenId,
    uint256 price,
    address buyer
  );
  event Cancel(
    bytes32 indexed sku,
    address indexed token,
    address indexed coin,
    uint256 quantity
  );

  mapping(bytes32 => Sale) private _saleBySku;

  constructor() {
    emit Created();
  }

  function post(
    bytes32 sku,
    address token,
    address coin,
    uint256 price,
    uint256[] memory tokenIds
  ) public onlyAdmin {
    _saleBySku[sku] = Sale(price, tokenIds, token, coin);
    emit Post(sku, token, coin, price, tokenIds.length);
  }

  function cancel(bytes32 sku) public onlyAdmin {
    Sale storage sale = _saleBySku[sku];
    uint256[] storage tokenIds = _saleBySku[sku].tokenIds;
    emit Cancel(sku, sale.token, sale.coin, tokenIds.length);
    // solhint-disable-next-line no-inline-assembly
    assembly {
      sstore(tokenIds.slot, 0)
    }
  }

  function buy(bytes32 sku) public payable returns (uint256 tokenId) {
    uint256 quantityLeft = _saleBySku[sku].tokenIds.length;
    require(quantityLeft > 0, 'sold_out');
    address coin = _saleBySku[sku].coin;
    uint256 price = _saleBySku[sku].price;
    if (coin == address(0)) {
      require(msg.value >= price, 'bad_payment_amount');
    }
    address token = _saleBySku[sku].token;
    tokenId = _saleBySku[sku].tokenIds[quantityLeft - 1];
    _saleBySku[sku].tokenIds.pop();
    (uint256 royaltyFee, address payable royaltyAddress) = _getRoyalty(
      token,
      tokenId,
      price
    );
    uint256 seller_amount = price - royaltyFee;
    _transferCoin(coin, msg.sender, address(this), seller_amount);
    if (royaltyFee > 0) {
      _transferCoin(coin, msg.sender, royaltyAddress, royaltyFee);
    }
    IERC721(token).transferFrom(address(this), msg.sender, tokenId);
    emit Buy(sku, token, tokenId, price, msg.sender);
    return tokenId;
  }

  function getSale(bytes32 sku)
    public
    view
    returns (
      address token,
      address coin,
      uint256 price,
      uint256 quantityLeft
    )
  {
    Sale storage sale = _saleBySku[sku];
    return (sale.token, sale.coin, sale.price, sale.tokenIds.length);
  }

  function _transferCoin(
    address coin,
    address src,
    address dest,
    uint256 value
  ) internal {
    if (coin == address(0)) {
      if (dest != address(this)) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = dest.call{value: value}('');
        require(success, 'tx_failed');
      }
    } else {
      IERC20(coin).transferFrom(src, dest, value);
    }
  }

  function _getRoyalty(
    address token,
    uint256 tokenId,
    uint256 price
  ) internal view returns (uint256 royaltyFee, address payable royaltyAddress) {
    royaltyFee = 0;
    try IERC2981(token).royaltyInfo(tokenId, price) returns (
      address addr,
      uint256 fee
    ) {
      if (royaltyAddress != address(this)) {
        royaltyAddress = payable(addr);
        royaltyFee = fee;
      }
      // solhint-disable-next-line no-empty-blocks
    } catch {}
    require(price > royaltyFee, 'erc2981_invalid_royalty');
    return (royaltyFee, royaltyAddress);
  }
}
