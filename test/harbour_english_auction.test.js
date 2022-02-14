const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
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

const HarbourEnglishAuction = contract.fromArtifact('HarbourEnglishAuction');
const TestERC721 = contract.fromArtifact('TestERC721');
const TestERC20 = contract.fromArtifact('TestERC20');

const ZERO = '0x0000000000000000000000000000000000000000';

const ETH = new BN(10).pow(new BN(18));
const RATIO = new BN(3).mul(new BN(10).pow(new BN(38)));
const AUCTION_BLOCKS = 100;

function eth(num) {
  return new BN(parseUnits(String(num)).toString());
}
function feth(val) {
  if (BN.isBN(val)) {
    return formatEther(val.toString()) + ' eth';
  } else if (typeof val === 'string') {
    return formatEther(val) + ' eth';
  }
}

describe('HarbourEnglishAuction', function () {
  const [owner, seller, bidder1, bidder2, ignore] = accounts;
  this.timeout(30 * 1000);

  beforeEach(async () => {
    this.token = await TestERC721.new('Token', 'T', { from: owner });
    this.currency = await TestERC20.new('Currency', 'C', eth(10000), {
      from: owner,
    });
    this.auction = await HarbourEnglishAuction.new(
      10,
      owner,
      this.currency.address,
      10,
      eth(0.001),
      { from: owner }
    );

    await this.token.mint(seller, 1, { from: owner });
    await this.currency.transfer(seller, eth(1), { from: owner });
    await this.currency.transfer(bidder1, eth(100), { from: owner });
    await this.currency.transfer(bidder2, eth(100), { from: owner });
    await this.currency.transfer(this.auction.address, eth(1), { from: owner });
    await this.token.approve(this.auction.address, 1, { from: seller });
    await this.currency.approve(this.auction.address, eth(10000), {
      from: bidder1,
    });
    await this.currency.approve(this.auction.address, eth(10000), {
      from: bidder2,
    });
  });

  it('simple', async () => {
    const { auction, currency, token } = this;

    const post = await auction.post(this.token.address, 1, 1, AUCTION_BLOCKS, {
      from: seller,
    });
    console.log('post gasUsed:', post.receipt.gasUsed);

    console.log('\n---- after post');
    await _dumpAuction(this);
    await _dumpBalances(this);
    await _dumpTokens(this);

    const bid1 = await auction.bid(this.token.address, 1, eth(1), {
      from: bidder1,
    });
    console.log('bid1 gasUsed:', bid1.receipt.gasUsed);

    console.log('\n---- after bid1');
    await _dumpAuction(this);
    await _dumpBalances(this);

    const bid2 = await auction.bid(this.token.address, 1, eth(2), {
      from: bidder2,
    });
    console.log('bid2 gasUsed:', bid1.receipt.gasUsed);

    console.log('\n---- after bid2');
    await _dumpAuction(this);
    await _dumpBalances(this);

    await _advanceToClose(this, 5);

    const close = await auction.close(this.token.address, 1);
    console.log('close gasUsed:', close.receipt.gasUsed);
    console.log('\n---- after close');
    await _dumpAuction(this);
    await _dumpBalances(this);
    await _dumpTokens(this);
  });

  it('cancel', async () => {
    const { auction, currency, token } = this;

    const post = await auction.post(this.token.address, 1, 1, AUCTION_BLOCKS, {
      from: seller,
    });
    console.log('post gasUsed:', post.receipt.gasUsed);

    console.log('\n---- after post');
    await _dumpAuction(this);
    await _dumpBalances(this);

    const cancel = await auction.cancel(this.token.address, 1, {
      from: seller,
    });
    console.log('cancel gasUsed:', cancel.receipt.gasUsed);

    console.log('\n---- after cancel');
    await _dumpAuction(this);
    await _dumpBalances(this);
  });
  it('bid advance', async () => {
    const { auction, currency, token } = this;

    const post = await auction.post(this.token.address, 1, 1, AUCTION_BLOCKS, {
      from: seller,
    });
    console.log('post gasUsed:', post.receipt.gasUsed);
    await _dumpAuction(this);
    const bid1 = await auction.bid(this.token.address, 1, eth(1), {
      from: bidder1,
    });
    console.log('bid1 gasUsed:', bid1.receipt.gasUsed);

    console.log('\n---- after bid1');
    await _dumpAuction(this);
    await _dumpBalances(this);

    await _advanceToClose(this, -5);
    const bid2 = await auction.bid(this.token.address, 1, eth(2), {
      from: bidder2,
    });
    console.log('bid2 gasUsed:', bid1.receipt.gasUsed);

    console.log('\n---- after bid2');
    await _dumpAuction(this);
    await _dumpBalances(this);

    await _advanceToClose(this, 5);
    const close = await auction.close(this.token.address, 1);
    console.log('close gasUsed:', close.receipt.gasUsed);
    console.log('\n---- after close');
    await _dumpAuction(this);
    await _dumpBalances(this);
    await _dumpTokens(this);
  });

  async function _dumpAuction(that) {
    const { auction, currency, token } = that;
    const data = await auction.getAuction(token.address, 1);
    console.log(
      'block:',
      (await time.latestBlock()).toNumber(),
      'auction 1: current:',
      feth(data.currentBid),
      'seller:',
      data.seller,
      'bidder:',
      data.bidder,
      'close:',
      data.closeBlock.toNumber()
    );
  }
  async function _dumpBalances(that) {
    const { auction, currency } = that;
    console.log(
      'auction currency balance:',
      feth(await currency.balanceOf(auction.address))
    );
    console.log(
      'seller currency balance:',
      feth(await currency.balanceOf(seller))
    );
    console.log(
      'bidder1 currency balance:',
      feth(await currency.balanceOf(bidder1))
    );
    console.log(
      'bidder2 currency balance:',
      feth(await currency.balanceOf(bidder2))
    );
  }
  async function _dumpTokens(that) {
    const { auction, token } = that;
    console.log(
      'seller token balance:',
      (await token.balanceOf(seller)).toNumber()
    );
    console.log(
      'bidder1 token balance:',
      (await token.balanceOf(bidder1)).toNumber()
    );
    console.log(
      'bidder2 token balance:',
      (await token.balanceOf(bidder2)).toNumber()
    );
  }
  async function _advanceToClose(that, delta) {
    const { auction, token } = that;
    const data = await auction.getAuction(token.address, 1);
    let close_block = data.closeBlock.toNumber();
    if (delta) {
      close_block += delta;
    }

    console.log('advance to close:', data.closeBlock.toNumber(), 'delta:', delta || 0);
    await time.advanceBlockTo(close_block);
    return close_block;
  }
});

async function _getSettleBlock() {
  const block_number = (await time.latestBlock()).toNumber();
  const settle_block = block_number - (block_number % 5) + 5;
  console.log('block_number:', block_number, 'settle_block:', settle_block);
  await time.advanceBlockTo(settle_block);
  return settle_block;
}
