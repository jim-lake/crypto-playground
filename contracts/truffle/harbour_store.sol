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
    uint256 quantityLeft;
    address token;
    address currency;
    address seller;
  }

  event Created();
  event Post(
    uint256 indexed saleIndex,
    address indexed token,
    address indexed currency,
    uint256 price,
    uint256 quantity
  );
  event Buy(
    uint256 indexed saleIndex,
    address indexed token,
    uint256 indexed tokenId,
    uint256 price,
    address buyer
  );
  event Cancel(
    uint256 indexed saleIndex,
    address indexed token,
    address indexed currency,
    uint256 quantity
  );

  uint256 public nextSaleIndex = 1;
  mapping(uint256 => Sale) private _saleByIndex;

  constructor() {
    emit Created();
  }

  function post(
    address token,
    address currency,
    uint256 price,
    uint256[] memory tokenIds
  ) public returns (uint256 saleIndex) {
    for (uint256 i = 0; i < tokenIds.length; i++) {
      require(IERC721(token).ownerOf(tokenIds[i]) == msg.sender, 'not_owner');
    }
    saleIndex = nextSaleIndex;
    nextSaleIndex = saleIndex + 1;
    _saleByIndex[saleIndex] = Sale(
      price,
      tokenIds,
      tokenIds.length,
      token,
      currency,
      msg.sender
    );
    emit Post(saleIndex, token, currency, price, tokenIds.length);
    return saleIndex;
  }

  function cancel(uint256 saleIndex) public {
    Sale storage sale = _saleByIndex[saleIndex];
    require(sale.seller == msg.sender, 'not_seller');
    emit Cancel(saleIndex, sale.token, sale.currency, sale.quantityLeft);
    sale.quantityLeft = 0;
  }

  function buy(uint256 saleIndex) public returns (uint256 tokenId) {
    Sale storage sale = _saleByIndex[saleIndex];
    require(sale.quantityLeft > 0, 'sold_out');
    uint256 purchaseIndex = sale.quantityLeft - 1;
    sale.quantityLeft = purchaseIndex;
    tokenId = sale.tokenIds[purchaseIndex];
    (uint256 royaltyFee, address payable royaltyAddress) = _getRoyalty(
      sale.token,
      tokenId,
      sale.price,
      sale.seller
    );
    uint256 seller_amount = sale.price - royaltyFee;
    IERC20(sale.currency).transferFrom(msg.sender, sale.seller, seller_amount);
    if (royaltyFee > 0) {
      IERC20(sale.currency).transferFrom(
        msg.sender,
        royaltyAddress,
        royaltyFee
      );
    }
    IERC721(sale.token).transferFrom(sale.seller, msg.sender, tokenId);
    emit Buy(saleIndex, sale.token, tokenId, sale.price, msg.sender);
    return tokenId;
  }

  function onTokenTransfer(
    address sender,
    uint256 value,
    bytes memory data
  ) public {
    require(data.length >= 32, 'bad data');
    uint256 saleIndex;
    assembly {
      saleIndex := mload(data)
    }

    Sale storage sale = _saleByIndex[saleIndex];
    require(sale.quantityLeft > 0, 'sold_out');
    require(msg.sender == sale.currency, 'wrong_currency');
    require(value >= sale.price, 'price_mismatch');
    uint256 purchaseIndex = sale.quantityLeft - 1;
    sale.quantityLeft = purchaseIndex;
    uint256 tokenId = sale.tokenIds[purchaseIndex];
    (uint256 royaltyFee, address payable royaltyAddress) = _getRoyalty(
      sale.token,
      tokenId,
      sale.price,
      sale.seller
    );
    uint256 seller_amount = sale.price - royaltyFee;
    IERC20(msg.sender).transfer(sale.seller, seller_amount);
    if (royaltyFee > 0) {
      IERC20(msg.sender).transfer(royaltyAddress, royaltyFee);
    }
    IERC721(sale.token).transferFrom(sale.seller, sender, tokenId);
    emit Buy(saleIndex, sale.token, tokenId, sale.price, sender);
  }

  function getSale(uint256 saleIndex)
    public
    view
    returns (
      address token,
      address currency,
      uint256 price,
      uint256 quantityLeft
    )
  {
    Sale storage sale = _saleByIndex[saleIndex];
    return (sale.token, sale.currency, sale.price, sale.quantityLeft);
  }

  function _getRoyalty(
    address token,
    uint256 tokenId,
    uint256 price,
    address seller
  ) internal view returns (uint256 royaltyFee, address payable royaltyAddress) {
    royaltyFee = 0;
    try IERC2981(token).royaltyInfo(tokenId, price) returns (
      address addr,
      uint256 fee
    ) {
      if (royaltyAddress != seller) {
        royaltyAddress = payable(addr);
        royaltyFee = fee;
      }
    } catch {}
    require(price > royaltyFee, 'erc2981_invalid_royalty');
    return (royaltyFee, royaltyAddress);
  }
}
