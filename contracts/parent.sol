pragma solidity ^0.5.0;

contract Child {
  int256 bar;

  constructor(int256 i) public payable {
    bar = i - 1;
  }

  function inc(int256 i) public {
    bar += i * 3;
  }
}

contract OtherChild {
  int256 baz;

  constructor(int256 i) public payable {
    baz = i;
  }

  function inc(int256 i) public {
    baz += i * 2;
  }
}

contract Parent {
  int256 foo;

  constructor(int256 f) public payable {
    foo = f;
    if (f == 88) {
      makeChildren(88, 99);
    }
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

  function makeChildren(int256 child_i, int256 other_child_i)
    public
    returns (address[2] memory)
  {
    address first = address(new Child(child_i));
    address second = address(new OtherChild(other_child_i));
    address[2] memory ret = [first, second];
    return ret;
  }
}
