//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.3;

contract MapMapTester {
  struct Foo {
    uint48 a;
    uint48 b;
    address c;
    uint256 d;
  }
  struct FooPacked {
    uint256 a_b_c;
    uint256 d;
  }
  struct FooHolder {
    Foo[] fooList;
  }
  struct FooPackedHolder {
    FooPacked[] fooList;
  }
  mapping(address => mapping(address => mapping(uint48 => FooHolder))) myMap;
  mapping(address => mapping(address => mapping(uint48 => FooPackedHolder))) myPackedMap;

  function putNormal(
    address k1,
    address k2,
    uint48 k3,
    uint48 a,
    uint48 b,
    address c,
    uint256 d
  ) public {
    myMap[k1][k2][k3].fooList.push(Foo(a, b, c, d));
  }

  function getNormal(
    address k1,
    address k2,
    uint48 k3,
    uint256 i
  ) public view returns (Foo memory) {
    return myMap[k1][k2][k3].fooList[i];
  }

  function putPacked(
    address k1,
    address k2,
    uint48 k3,
    uint48 a,
    uint48 b,
    address c,
    uint256 d
  ) public {
    uint256 a_b_c = uint256(uint160(c)) | (b << 160) | (a << 208);
    myPackedMap[k1][k2][k3].fooList.push(FooPacked(a_b_c, d));
  }

  function getPacked(
    address k1,
    address k2,
    uint48 k3,
    uint256 i
  ) public view returns (FooPacked memory) {
    return myPackedMap[k1][k2][k3].fooList[i];
  }

  function getUnpacked(
    address k1,
    address k2,
    uint48 k3,
    uint256 i
  ) public view returns (Foo memory) {
    FooPacked storage packed = myPackedMap[k1][k2][k3].fooList[i];
    uint256 a_b_c = packed.a_b_c;
    Foo memory ret = Foo(
      uint48(a_b_c >> 208),
      uint48(a_b_c >> 160),
      address(uint160(a_b_c)),
      packed.d
    );
    return ret;
  }
}

contract MapListTester {
  int256 foo;
  uint256 count;
  mapping(uint256 => uint256) keyMap;
  uint256[] keyList;
  mapping(uint256 => uint256) keyToIndex;

  constructor() payable {}

  function addKey(uint256 key) public {
    require(keyMap[key] == 0, 'key already used');
    keyMap[key] = block.timestamp;
    keyToIndex[key] = keyList.length;
    keyList.push(key);
  }

  function removeKey(uint256 key) public {
    require(keyMap[key] != 0, 'key not found');
    uint256 index = keyToIndex[key];
    if (index < keyList.length - 1) {
      uint256 end_key = keyList[keyList.length - 1];
      keyToIndex[end_key] = index;
      keyList[index] = end_key;
    }
    delete keyToIndex[key];
    delete keyMap[key];
    keyList.pop();
  }

  function getKeyAtIndex(uint256 index) public view returns (uint256) {
    uint256 key = keyList[index];
    require(keyMap[key] != 0, 'key not found');
    return key;
  }

  function getIndexForKey(uint256 key) public view returns (uint256) {
    require(keyMap[key] != 0, 'key not found');
    return keyToIndex[key];
  }
}
