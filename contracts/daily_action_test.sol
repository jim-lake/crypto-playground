pragma solidity ^0.5.13;

library SafeMath {
  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    require(c >= a, 'SafeMath: addition overflow');

    return c;
  }

  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    return sub(a, b, 'SafeMath: subtraction overflow');
  }

  function sub(
    uint256 a,
    uint256 b,
    string memory errorMessage
  ) internal pure returns (uint256) {
    require(b <= a, errorMessage);
    uint256 c = a - b;

    return c;
  }

  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
    // benefit is lost if 'b' is also tested.
    // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
    if (a == 0) {
      return 0;
    }

    uint256 c = a * b;
    require(c / a == b, 'SafeMath: multiplication overflow');

    return c;
  }

  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    return div(a, b, 'SafeMath: division by zero');
  }

  function div(
    uint256 a,
    uint256 b,
    string memory errorMessage
  ) internal pure returns (uint256) {
    // Solidity only automatically asserts when dividing by 0
    require(b > 0, errorMessage);
    uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold

    return c;
  }

  function mod(uint256 a, uint256 b) internal pure returns (uint256) {
    return mod(a, b, 'SafeMath: modulo by zero');
  }

  function mod(
    uint256 a,
    uint256 b,
    string memory errorMessage
  ) internal pure returns (uint256) {
    require(b != 0, errorMessage);
    return a % b;
  }

  function min(uint256 a, uint256 b) internal pure returns (uint256) {
    return a < b ? a : b;
  }
}

interface IERC20 {
  function totalSupply() external view returns (uint256);

  function balanceOf(address account) external view returns (uint256);

  function transfer(address recipient, uint256 amount) external returns (bool);

  function allowance(address owner, address spender)
    external
    view
    returns (uint256);

  function approve(address spender, uint256 amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract DailyTester {
  event Payment(address indexed account, uint256 amount, uint256 timestamp);
  event LastUsed(address indexed account, uint256 timestamp);
  event DailyPickup(address indexed account, uint256 timestamp);

  constructor() public {}

  function() external payable {
    emit Payment(msg.sender, msg.value, block.timestamp);
  }

  mapping(address => uint256) private _lastPickup;
  mapping(address => uint256) private _lastRefund;

  modifier refundGasCost() {
    uint256 remainingGasStart = gasleft();

    _;

    uint256 gasPrice = SafeMath.min(tx.gasprice, 10_000_000_000 wei);

    uint256 remainingGasEnd = gasleft();
    uint256 usedGas = remainingGasStart - remainingGasEnd;
    usedGas += 21000 + 8518;
    uint256 gasCost = usedGas * gasPrice;

    if (address(this).balance > gasCost) {
      tx.origin.transfer(gasCost);
    }
  }

  function saveLastUsed() public {
    emit LastUsed(msg.sender, block.timestamp);
  }

  function refundTester() public refundGasCost {
    uint256 last_time = _lastRefund[msg.sender];
    require(
      block.timestamp - last_time >= 2 minutes,
      'DailyTester.refundTester: once per 2 minutes'
    );
    _lastRefund[msg.sender] = block.timestamp;
    emit LastUsed(msg.sender, block.timestamp);
  }

  function _pickupDailyCoins() private {
    uint256 last_pickup = _lastPickup[msg.sender];
    require(
      block.timestamp - last_pickup >= 2 minutes,
      'DailyTester: once per 2 minutes'
    );
    _lastPickup[msg.sender] = block.timestamp;
    bool ret = IERC20(0xf220aF718A8d13CCE7f5A466722F2b5857cd4215).transfer(
      msg.sender,
      100 ether
    );
    require(ret = true, 'DailyTester: Transfer failed');
    emit DailyPickup(msg.sender, block.timestamp);
  }

  function pickupDailyCoins() public {
    _pickupDailyCoins();
  }

  function pickupDailyCoinsRefund() public refundGasCost {
    _pickupDailyCoins();
  }
}
