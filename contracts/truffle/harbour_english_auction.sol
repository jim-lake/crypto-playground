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

interface IAutoBidder {
  function onAutoBid(
    address token,
    uint256 tokenId,
    uint256 nextBid
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
  struct AutoBidder {
    address bidder;
    address proxy;
  }
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
  mapping(address => mapping(uint256 => AutoBidder[]))
    private _autoBiddersByTokenTokenId;
  mapping(address => mapping(uint256 => uint256))
    private _indexBiddersByTokenTokenId;

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
    require(blocks > minCloseBlocks, 'too_short');
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
    require(newBid % bidQuanta == 0, 'bad_quanta');
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

    AutoBidder[] storage bidders = _autoBiddersByTokenTokenId[token][tokenId];
    require(bidders.length == 0, 'has_auto_bidders');

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
    assembly {
      sstore(bidders.slot, 0)
    }
  }

  function addProxy(
    address token,
    uint256 tokenId,
    address proxy
  ) public nonReentrant {
    _autoBiddersByTokenTokenId[token][tokenId].push(
      AutoBidder(msg.sender, proxy)
    );
  }

  function runProxies(
    address token,
    uint256 tokenId,
    uint256 nextBid
  ) public nonReentrant {
    require(nextBid % bidQuanta == 0, 'bad_quanta');
    Auction storage auction = _auctionByTokenTokenId[token][tokenId];
    require(auction.seller != address(0), 'auction_complete');
    require(nextBid > auction.currentBid, 'bid_too_low');
    require(block.number > auction.closeBlock, 'auction_not_closing');
    AutoBidder[] storage bidders = _autoBiddersByTokenTokenId[token][tokenId];
    uint256 bidder_count = bidders.length;
    require(bidder_count > 0, 'no_autobidders');

    uint256 start_i = _indexBiddersByTokenTokenId[token][tokenId];
    address last_bidder = auction.bidder;
    uint256 winner_i;
    uint256 takers = 0;
    for (uint256 j = 0; j < bidder_count; j++) {
      uint256 i = (start_i + j) % bidder_count;
      address proxy = bidders[i].proxy;
      if (gasleft() < 70000) {
        break;
      } else if (proxy == address(0)) {
        // noop
      } else if (last_bidder == bidders[i].bidder) {
        // noop
      } else {
        try
          IAutoBidder(proxy).onAutoBid{gas: 3000}(token, tokenId, nextBid)
        returns (bool success) {
          if (success) {
            takers = takers + 1;
            winner_i = i;
            nextBid = nextBid + bidQuanta;
          } else {
            bidders[i].proxy = address(0);
          }
        } catch {
          bidders[i].proxy = address(0);
        }
      }
    }
    if (takers == 0) {
      if (nextBid == auction.currentBid + bidQuanta) {
        // no proxy bids and we checked exact quanta
        assembly {
          sstore(bidders.slot, 0)
        }
        auction.closeBlock = uint48(block.number + minCloseBlocks);
      }
    } else if (gasleft() < 70000) {
      // make sure to incrementally make progress
    } else {
      // prevents bid inflation by proxy runner
      uint256 newBid = takers > 1
        ? nextBid - bidQuanta
        : auction.currentBid + bidQuanta;
      address bidder = bidders[winner_i].bidder;
      bool success = false;
      try IERC20(currency).transferFrom(bidder, address(this), newBid) returns (
        bool tx_success
      ) {
        success = tx_success;
      } catch {}
      if (success) {
        if (auction.bidder != address(0)) {
          IERC20(currency).transfer(auction.bidder, auction.currentBid);
        }
        auction.bidder = bidder;
        auction.currentBid = newBid;
        _indexBiddersByTokenTokenId[token][tokenId] =
          (start_i + 1) %
          bidder_count;
        emit Bid(token, tokenId, newBid, bidder);
      } else {
        bidders[winner_i].proxy = address(0);
      }
    }
  }

  function _runAutoBidder(
    address token,
    uint256 tokenId,
    address proxy,
    uint256 nextBid
  ) internal returns (bool) {
    try
      IAutoBidder(proxy).onAutoBid{gas: 3000}(token, tokenId, nextBid)
    returns (bool success) {
      return success;
    } catch {}
    return false;
  }

  function getAuction(address token, uint256 tokenId)
    public
    view
    returns (
      uint256 currentBid,
      address seller,
      address bidder,
      uint48 closeBlock,
      uint256 autoBidderCount
    )
  {
    Auction storage auction = _auctionByTokenTokenId[token][tokenId];
    AutoBidder[] storage bidders = _autoBiddersByTokenTokenId[token][tokenId];
    return (
      auction.currentBid,
      auction.seller,
      auction.bidder,
      auction.closeBlock,
      bidders.length
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
