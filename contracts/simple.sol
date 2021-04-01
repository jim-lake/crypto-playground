pragma solidity ^0.5.0;

contract Simple {
  int256 foo;

  constructor(int256 f) public payable {
    foo = f;
  }

  function set(int256 f) public payable {
    foo = f;
  }
}
