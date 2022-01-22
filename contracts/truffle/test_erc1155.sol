// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol';
import '@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol';

contract TestERC1155 is ERC1155, ERC1155Burnable, ERC1155Supply {
  constructor() ERC1155("") {}

  mapping(uint256 => string) private _tokenIdToUri;

  function uri(uint256 id)
    public
    view
    virtual
    override
    returns (string memory)
  {
    return _tokenIdToUri[id];
  }

  function mint(
    address to,
    uint256 id,
    uint256 amount,
    string calldata _uri
  ) external {
    _mint(to, id, amount, '');
    _tokenIdToUri[id] = _uri;
  }

  function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
