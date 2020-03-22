pragma solidity ^0.5.0;

contract Simple {
  int foo;
  constructor(int f) public payable
  {
    foo = f;
  }
  function set(int f) public payable {
    foo = f;
  }
}
