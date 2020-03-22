pragma solidity ^0.5.0;

contract Tester {
  int foo;
  constructor(int f) public payable
  {
    foo = f;
  }
  function incPayable(int i) public payable {
    foo += i;
  }

  function inc(int i) public {
    foo += i;
  }

  function() external payable {
    if (msg.value > 0) {
      foo += 1000;
    } else {
      foo += 42;
    }
  }

  function getAndIncFoo() public returns (int) {
    foo += 1;
    return foo;
  }
  function getFoo() public view returns (int) {
    return foo;
  }
}
