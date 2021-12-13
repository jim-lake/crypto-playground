const { accounts, contract } = require('@openzeppelin/test-environment');
const {
  BN,
  time,
  constants,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');

const { expect } = require('chai');
const ethers = require('ethers');
const { parseUnits, formatEther } = ethers.utils;

const HarbourRedeem = contract.fromArtifact('HarbourRedeem');
const TestERC721 = contract.fromArtifact('TestERC721');

const ZERO = '0x0000000000000000000000000000000000000000';
const BURN = '0x000000000000000000000000000000000000dEaD';

describe('HarbourRedeem', function () {
  const [owner, user, holder] = accounts;
  this.timeout(30 * 1000);

  beforeEach(async () => {
    this.token = await TestERC721.new('Token', 'T', { from: owner });
    this.reward = await TestERC721.new('Reward', 'REW', {
      from: owner,
    });
    this.redeem = await HarbourRedeem.new({ from: owner });

    await this.token.mint(user, 1, { from: owner });
    await this.reward.mint(holder, 1, { from: owner });

    await this.redeem.addAdmin(holder, { from: owner });
    await this.reward.approve(this.redeem.address, 1, { from: holder });
  });

  it('simple', async () => {
    const { token, reward, redeem } = this;

    await _dumpTokenBalances(this);

    const set = await redeem.setRedeem(token.address, 1, reward.address, 1, {
      from: holder,
    });
    console.log('set gasUsed:', set.receipt.gasUsed);

    const approve = await this.token.approve(redeem.address, 1, { from: user });
    console.log('approve gasUsed:', approve.receipt.gasUsed);
    const take = await redeem.redeem(token.address, 1, '0xf00f', {
      from: user,
    });
    console.log('take gasUsed:', take.receipt.gasUsed);

    await _dumpTokenBalances(this);
  });

  it('simple2', async () => {
    const { token, reward, redeem } = this;

    await _dumpTokenBalances(this);

    const set = await redeem.setRedeem(token.address, 1, reward.address, 1, {
      from: holder,
    });
    console.log('set gasUsed:', set.receipt.gasUsed);

    const send_take = await token.methods[
      'safeTransferFrom(address,address,uint256,bytes)'
    ](user, redeem.address, 1, '0xf00f', {
      from: user,
    });
    console.log('send_take gasUsed:', send_take.receipt.gasUsed);

    await _dumpTokenBalances(this);
  });

  it('no swap', async () => {
    const { token, reward, redeem } = this;

    await _dumpTokenBalances(this);

    const set = await redeem.setRedeem(token.address, 1, ZERO, 0, {
      from: holder,
    });
    console.log('set gasUsed:', set.receipt.gasUsed);

    const send_take = await token.methods[
      'safeTransferFrom(address,address,uint256,bytes)'
    ](user, redeem.address, 1, '0xf00f', {
      from: user,
    });
    console.log('send_take gasUsed:', send_take.receipt.gasUsed);

    await _dumpTokenBalances(this);
  });

  async function _dumpTokenBalances(that) {
    const { token, reward, redeem } = that;
    console.log(
      'user token balance:',
      (await token.balanceOf(user)).toNumber()
    );
    console.log(
      'holder token balance:',
      (await token.balanceOf(holder)).toNumber()
    );
    console.log(
      'BURN token balance:',
      (await token.balanceOf(BURN)).toNumber()
    );
    console.log(
      'redeem token balance:',
      (await token.balanceOf(redeem.address)).toNumber()
    );
  }
});
