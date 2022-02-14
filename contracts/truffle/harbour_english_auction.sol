// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

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

interface IERC721 {
  function ownerOf(uint256 tokenId) external view returns (address owner);

  function transferFrom(
    address from,
    address to,
    uint256 tokenId
  ) external;

  function royaltyInfo(uint256 _tokenId, uint256 _value)
    external
    view
    returns (address _receiver, uint256 _royaltyAmount);

  function royaltyInfo(
    uint256 _tokenId,
    uint256 _value,
    bytes calldata _data
  )
    external
    view
    returns (
      address _receiver,
      uint256 _royaltyAmount,
      bytes memory _royaltyPaymentData
    );
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

abstract contract ReentrancyGuard {
  uint256 private constant _NOT_ENTERED = 1;
  uint256 private constant _ENTERED = 2;
  uint256 private _status;

  constructor() {
    _status = _NOT_ENTERED;
  }

  modifier nonReentrant() {
    require(_status != _ENTERED, 'reentrant_failed');
    _status = _ENTERED;
    _;
    _status = _NOT_ENTERED;
  }
}

contract HarbourEnglishAuction is ReentrancyGuard, AdminRole {
  struct Auction {
    uint256 currentBid;
    address seller;
    address bidder;
    uint48 closeBlock;
  }
  struct PayoutResult {
    address payable royaltyAddress;
    uint256 royaltyFee;
    uint256 exchangeFee;
    uint256 sellerAmount;
  }

  uint256 constant BPS = 10000;
  address payable private _creator;
  // token address => tokenId => Auction
  mapping(address => mapping(uint256 => Auction))
    private _auctionByTokenTokenId;

  uint256 public bidQuanta;
  uint256 public exchangeFeeBps;
  address payable public exchangeFeeAddress;
  address public currency;
  uint48 public minCloseBlocks;

  event Created();
  event FeeUpdate(address payable feeAddress, uint256 fee);
  event CloseBlocks(uint48 closeBlocks);
  event BidQuanta(uint256 quanta);
  event Post(
    address indexed token,
    uint256 indexed tokenId,
    address seller,
    uint256 minBid
  );
  event Cancel(address indexed token, uint256 indexed tokenId, address seller);
  event Bid(
    address indexed token,
    uint256 indexed tokenId,
    uint256 bidAmount,
    address bidder
  );
  event Close(
    address indexed token,
    uint256 indexed tokenId,
    uint256 winAmount,
    address winner
  );

  constructor(
    uint256 fee,
    address payable feeAddress,
    address bidCurrency,
    uint48 blocks,
    uint256 quanta
  ) {
    _creator = payable(msg.sender);
    exchangeFeeBps = fee;
    exchangeFeeAddress = feeAddress;
    currency = bidCurrency;
    minCloseBlocks = blocks;
    bidQuanta = quanta;
    emit Created();
  }

  function setBidQuanta(uint256 quanta) public onlyAdmin {
    bidQuanta = quanta;
    emit BidQuanta(quanta);
  }

  function setCloseBlocks(uint48 closeBlocks) public onlyAdmin {
    minCloseBlocks = closeBlocks;
    emit CloseBlocks(closeBlocks);
  }

  function setExchangeFee(address payable feeAddress, uint256 fee)
    public
    onlyAdmin
  {
    exchangeFeeAddress = feeAddress;
    exchangeFeeBps = fee;
    emit FeeUpdate(feeAddress, fee);
  }

  // solhint-disable-next-line no-empty-blocks
  receive() external payable {
    // thank you
  }
  function withdraw(address erc20, uint256 amount) public {
    require(erc20 != currency, 'bad_withdraw');
    if (erc20 == address(0)) {
      _creator.transfer(amount);
    } else {
      IERC20(erc20).transfer(_creator, amount);
    }
  }
  function withdrawToken(address erc721, uint256 tokenId) public {
    IERC721(erc721).transferFrom(address(this), _creator, tokenId);
  }

  function post(
    address token,
    uint256 tokenId,
    uint256 minBid,
    uint48 blocks
  ) public nonReentrant {
    require(IERC721(token).ownerOf(tokenId) == msg.sender, 'not_owner');
    Auction storage existing = _auctionByTokenTokenId[token][tokenId];
    if (existing.bidder != address(0)) {
      IERC20(currency).transfer(existing.bidder, existing.currentBid);
    }
    _auctionByTokenTokenId[token][tokenId] = Auction(
      minBid,
      msg.sender,
      address(0),
      uint48(block.number + blocks)
    );
    emit Post(token, tokenId, msg.sender, minBid);
  }

  function cancel(address token, uint256 tokenId) public nonReentrant {
    Auction storage auction = _auctionByTokenTokenId[token][tokenId];
    require(auction.seller != address(0), 'not_found');
    if (auction.seller != msg.sender) {
      require(IERC721(token).ownerOf(tokenId) != auction.seller, 'not_invalid');
    }
    if (auction.bidder != address(0)) {
      IERC20(currency).transfer(auction.bidder, auction.currentBid);
    }
    auction.closeBlock = 0;
    auction.seller = address(0);
    auction.bidder = address(0);
    auction.currentBid = 0;
    emit Cancel(token, tokenId, auction.seller);
  }

  function bid(
    address token,
    uint256 tokenId,
    uint256 newBid
  ) public {
    require(newBid % bidQuanta == 0);
    Auction storage auction = _auctionByTokenTokenId[token][tokenId];
    require(newBid > auction.currentBid, 'bid_too_low');
    require(auction.closeBlock > block.number, 'auction_closed');

    IERC20(currency).transferFrom(msg.sender, address(this), newBid);
    if (auction.bidder != address(0)) {
      IERC20(currency).transfer(auction.bidder, auction.currentBid);
    }
    auction.bidder = msg.sender;
    auction.currentBid = newBid;
    uint256 min_close = block.number + minCloseBlocks;
    if (min_close > auction.closeBlock) {
      auction.closeBlock = uint48(min_close);
    }
    emit Bid(token, tokenId, newBid, msg.sender);
  }

  function close(address token, uint256 tokenId) public nonReentrant {
    Auction storage auction = _auctionByTokenTokenId[token][tokenId];
    require(auction.closeBlock < block.number, 'auction_live');
    auction.closeBlock = 0;
    require(IERC721(token).ownerOf(tokenId) == auction.seller, 'not_owner');
    require(auction.bidder != address(0), 'no_bidder');

    PayoutResult memory payout = _getPayouts(
      token,
      tokenId,
      auction.currentBid
    );
    if (payout.royaltyFee > 0) {
      IERC20(currency).transfer(payout.royaltyAddress, payout.royaltyFee);
    }
    if (payout.exchangeFee > 0) {
      IERC20(currency).transfer(exchangeFeeAddress, payout.exchangeFee);
    }
    IERC20(currency).transfer(auction.seller, payout.sellerAmount);
    IERC721(token).transferFrom(auction.seller, auction.bidder, tokenId);

    emit Close(token, tokenId, auction.currentBid, auction.bidder);
    auction.currentBid = 0;
    auction.seller = address(0);
    auction.bidder = address(0);
  }

  function getAuction(address token, uint256 tokenId)
    public
    view
    returns (
      uint256 currentBid,
      address seller,
      address bidder,
      uint48 closeBlock
    )
  {
    Auction storage auction = _auctionByTokenTokenId[token][tokenId];
    return (
      auction.currentBid,
      auction.seller,
      auction.bidder,
      auction.closeBlock
    );
  }

  function _getPayouts(
    address token,
    uint256 tokenId,
    uint256 bidAmount
  ) internal view returns (PayoutResult memory) {
    PayoutResult memory payouts;
    try IERC721(token).royaltyInfo(tokenId, bidAmount) returns (
      address royaltyAddress,
      uint256 fee
    ) {
      payouts.royaltyAddress = payable(royaltyAddress);
      payouts.royaltyFee = fee;
    } catch {
      try IERC721(token).royaltyInfo(tokenId, bidAmount, '') returns (
        address royaltyAddress2,
        uint256 fee2,
        bytes memory
      ) {
        payouts.royaltyAddress = payable(royaltyAddress2);
        payouts.royaltyFee = fee2;
      } catch {
        payouts.royaltyFee = 0;
      }
    }
    require(bidAmount > payouts.royaltyFee, 'erc2981_invalid_royalty');

    payouts.exchangeFee = (bidAmount * exchangeFeeBps) / BPS;
    payouts.sellerAmount = bidAmount - payouts.exchangeFee - payouts.royaltyFee;
    require(payouts.sellerAmount > 0, 'maker_amount_invalid');
    return payouts;
  }
}
