pragma solidity ^0.8.3;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';

contract Zep721Token is ERC721 {
  constructor() ERC721('Zep721Token', 'Z721') {}
}
