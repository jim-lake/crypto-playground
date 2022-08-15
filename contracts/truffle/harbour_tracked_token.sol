pragma solidity ^0.8.9;

// SPDX-License-Identifier: MIT

library Roles {
  struct Role {
    mapping(address => bool) bearer;
  }

  function add(Role storage role, address account) internal {
    require(!has(role, account), 'Roles: account already has role');
    role.bearer[account] = true;
  }

  function remove(Role storage role, address account) internal {
    require(has(role, account), 'Roles: account does not have role');
    role.bearer[account] = false;
  }

  function has(Role storage role, address account)
    internal
    view
    returns (bool)
  {
    require(account != address(0), 'Roles: account is the zero address');
    return role.bearer[account];
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

interface IERC677 is IERC20 {
  function transferAndCall(
    address recipient,
    uint256 value,
    bytes memory data
  ) external returns (bool);
}

interface IERC677Receiver {
  function onTokenTransfer(
    address sender,
    uint256 value,
    bytes memory data
  ) external;
}

interface ITrackedToken {
  function lastSendBlockOf(address account) external view returns (uint256);
}

abstract contract AdminRole {
  using Roles for Roles.Role;

  event AdminAdded(address indexed account);
  event AdminRemoved(address indexed account);

  Roles.Role private _admins;

  constructor() {
    _admins.add(msg.sender);
    emit AdminAdded(msg.sender);
  }

  modifier onlyAdmin() {
    require(
      _admins.has(msg.sender),
      'AdminRole: caller does not have the Admin role'
    );
    _;
  }

  function addAdmin(address account) public onlyAdmin {
    _admins.add(account);
    emit AdminAdded(account);
  }

  function renounceAdmin() public onlyAdmin {
    _admins.remove(msg.sender);
    emit AdminRemoved(msg.sender);
  }
}

abstract contract CreatorWithdraw is AdminRole {
  address payable private _creator;

  constructor() {
    _creator = payable(msg.sender);
  }

  // solhint-disable-next-line no-empty-blocks
  receive() external payable {
    // thank you
  }

  function withdraw(address erc20, uint256 amount) public onlyAdmin {
    if (erc20 == address(0)) {
      _creator.transfer(amount);
    } else if (erc20 != address(this)) {
      IERC20(erc20).transfer(_creator, amount);
    }
  }
}

abstract contract Owned is AdminRole {
  address private _owner;

  constructor() {
    _owner = msg.sender;
  }

  function owner() public view returns (address) {
    return _owner;
  }

  function getOwner() public view returns (address) {
    return _owner;
  }

  function setOwner(address newOwner) public onlyAdmin {
    _owner = newOwner;
  }
}

abstract contract MinterRole {
  using Roles for Roles.Role;

  event MinterAdded(address indexed account);
  event MinterRemoved(address indexed account);

  Roles.Role private _minters;

  constructor() {
    _minters.add(msg.sender);
    emit MinterAdded(msg.sender);
  }

  modifier onlyMinter() {
    require(
      _minters.has(msg.sender),
      'MinterRole: caller does not have the Minter role'
    );
    _;
  }

  function addMinter(address account) public onlyMinter {
    _minters.add(account);
    emit MinterAdded(account);
  }

  function renounceMinter() public onlyMinter {
    _minters.remove(msg.sender);
    emit MinterRemoved(msg.sender);
  }
}

abstract contract ERC20Detailed {
  string private _name;
  string private _symbol;
  uint8 private _decimals;

  constructor(
    string memory __name,
    string memory __symbol,
    uint8 __decimals
  ) {
    _name = __name;
    _symbol = __symbol;
    _decimals = __decimals;
  }

  function name() public view returns (string memory) {
    return _name;
  }

  function symbol() public view returns (string memory) {
    return _symbol;
  }

  function decimals() public view returns (uint8) {
    return _decimals;
  }
}

abstract contract ERC20Tracked is ITrackedToken, IERC20 {
  mapping(address => uint256) private _balances;
  mapping(address => uint256) private _lastSendBlock;

  mapping(address => mapping(address => uint256)) private _allowances;

  uint256 private _totalSupply;

  function totalSupply() public view override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) public view override returns (uint256) {
    return _balances[account];
  }

  function lastSendBlockOf(address account)
    public
    view
    override
    returns (uint256)
  {
    return _lastSendBlock[account];
  }

  function transfer(address recipient, uint256 amount)
    public
    override
    returns (bool)
  {
    _transfer(msg.sender, recipient, amount);
    return true;
  }

  function allowance(address owner, address spender)
    public
    view
    override
    returns (uint256)
  {
    return _allowances[owner][spender];
  }

  function approve(address spender, uint256 amount)
    public
    override
    returns (bool)
  {
    _approve(msg.sender, spender, amount);
    return true;
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public override returns (bool) {
    _transfer(sender, recipient, amount);
    _approve(sender, msg.sender, _allowances[sender][msg.sender] - amount);
    return true;
  }

  function increaseAllowance(address spender, uint256 addedValue)
    public
    returns (bool)
  {
    _approve(
      msg.sender,
      spender,
      _allowances[msg.sender][spender] + addedValue
    );
    return true;
  }

  function decreaseAllowance(address spender, uint256 subtractedValue)
    public
    returns (bool)
  {
    _approve(
      msg.sender,
      spender,
      _allowances[msg.sender][spender] - subtractedValue
    );
    return true;
  }

  function burn(uint256 amount) public returns (bool) {
    _burn(msg.sender, amount);
    return true;
  }

  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal {
    require(sender != address(0), 'ERC20: transfer from the zero address');
    require(recipient != address(0), 'ERC20: transfer to the zero address');

    _balances[sender] = _balances[sender] - amount;
    _balances[recipient] = _balances[recipient] + amount;
    _lastSendBlock[sender] = block.number;
    emit Transfer(sender, recipient, amount);
  }

  function _mint(address account, uint256 amount) internal {
    require(account != address(0), 'ERC20: mint to the zero address');

    _totalSupply = _totalSupply + amount;
    _balances[account] = _balances[account] + amount;
    emit Transfer(address(0), account, amount);
  }

  function _burn(address account, uint256 amount) internal {
    require(account != address(0), 'ERC20: burn from the zero address');

    _balances[account] = _balances[account] - amount;
    _lastSendBlock[account] = block.number;
    _totalSupply = _totalSupply - amount;
    emit Transfer(account, address(0), amount);
  }

  function _approve(
    address owner,
    address spender,
    uint256 amount
  ) internal {
    require(owner != address(0), 'ERC20: approve from the zero address');
    require(spender != address(0), 'ERC20: approve to the zero address');

    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }

  function _burnFrom(address account, uint256 amount) internal {
    _burn(account, amount);
    _approve(account, msg.sender, _allowances[account][msg.sender] - amount);
  }
}

abstract contract ERC667Tracked is IERC677, ERC20Tracked {
  function transferAndCall(
    address recipient,
    uint256 value,
    bytes memory data
  ) public returns (bool) {
    transfer(recipient, value);
    IERC677Receiver(recipient).onTokenTransfer(msg.sender, value, data);
    return true;
  }
}

abstract contract ERC20Mintable is ERC20Tracked, MinterRole {
  function mint(address account, uint256 amount)
    public
    onlyMinter
    returns (bool)
  {
    _mint(account, amount);
    return true;
  }
}

contract HarbourTrackedToken is
  ERC667Tracked,
  ERC20Detailed,
  Owned,
  CreatorWithdraw
{
  constructor(
    string memory name,
    string memory symbol,
    uint256 fixedSupply
  ) ERC20Detailed(name, symbol, 18) {
    _mint(msg.sender, fixedSupply);
  }
}

contract HarbourTrackedTokenMintable is
  ERC667Tracked,
  ERC20Detailed,
  ERC20Mintable,
  Owned,
  CreatorWithdraw
{
  constructor(string memory name, string memory symbol)
    ERC20Detailed(name, symbol, 18)
  {}
}
