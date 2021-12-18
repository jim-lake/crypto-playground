// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';

contract TestERC721 is ERC721 {
  // solhint-disable-next-line no-empty-blocks
  constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

  function mint(address to, uint256 tokenId) external {
    _mint(to, tokenId);
  }

  function burn(uint256 tokenId) external returns (bool) {
    require(
      _isApprovedOrOwner(_msgSender(), tokenId),
      'ERC721: burn caller is not owner nor approved'
    );
    _burn(tokenId);
    return true;
  }
}
