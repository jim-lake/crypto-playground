// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

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

contract ProxyBidder is AdminRole, IAutoBidder {
  mapping(address => mapping(uint256 => uint256))
    private _maxPriceByTokenTokenId;

  function createBid(
    address token,
    uint256 tokenId,
    uint256 maxBid
  ) public onlyAdmin {
    _maxPriceByTokenTokenId[token][tokenId] = maxBid;
  }

  function onAutoBid(
    address token,
    uint256 tokenId,
    uint256 nextBid
  ) public view returns (bool) {
    return _maxPriceByTokenTokenId[token][tokenId] > nextBid;
  }
}

contract BadProxyBidder is AdminRole, IAutoBidder {
  mapping(address => mapping(uint256 => uint256))
    private _maxPriceByTokenTokenId;

  function createBid(
    address token,
    uint256 tokenId,
    uint256 maxBid
  ) public onlyAdmin {
    _maxPriceByTokenTokenId[token][tokenId] = maxBid;
  }

  function onAutoBid(
    address,
    uint256,
    uint256 nextBid
  ) public pure returns (bool) {
    uint256 i = 0;
    while (i < nextBid) {
      i++;
    }
    return i > nextBid;
  }
}
