pragma solidity ^0.5.0;

contract Tester {
  int256 foo;

  constructor(int256 f) public payable {
    foo = f;
  }

  function incPayable(int256 i) public payable {
    foo += i;
  }

  function inc(int256 i) public {
    foo += i;
  }

  function() external payable {
    if (msg.value > 0) {
      foo += 1000;
    } else {
      foo += 42;
    }
  }

  function getAndIncFoo() public returns (int256) {
    foo += 1;
    return foo;
  }

  function getFoo() public view returns (int256) {
    return foo;
  }
}
