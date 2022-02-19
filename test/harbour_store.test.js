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

const HarbourStore = contract.fromArtifact('HarbourStore');
const TestERC721 = contract.fromArtifact('TestERC721');
const HarbourNFT = contract.fromArtifact('HarbourNFT');
const TestERC20 = contract.fromArtifact('TestERC20');

const ZERO = '0x0000000000000000000000000000000000000000';
const TOKEN_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const ETH = new BN(10).pow(new BN(18));
const RATIO = new BN(3).mul(new BN(10).pow(new BN(38)));

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

describe('HarbourStore', function () {
  const [owner, seller, buyer, buyer2, proxy, royalty] = accounts;
  this.timeout(30 * 1000);

  beforeEach(async () => {
    //this.token = await TestERC721.new('Token', 'T', { from: owner });
    this.token = await HarbourNFT.new(
      'Token',
      'T',
      '',
      '',
      royalty,
      1000,
      1000,
      1000,
      { from: owner }
    );
    this.currency = await TestERC20.new('Currency', 'C', eth(10000), {
      from: owner,
    });
    this.store = await HarbourStore.new({ from: owner });

    /*
    const tokens = TOKEN_IDS.map((val) =>
      this.token.mint(seller, val, { from: owner })
    );
    await Promise.all(tokens);
    */
    await this.token.mintMultipleWithTokenURI(seller, 1, 10, '', {
      from: owner,
    });
    await this.currency.transfer(royalty, eth(1), { from: owner });
    await this.currency.transfer(seller, eth(1), { from: owner });
    await this.currency.transfer(buyer, eth(100), { from: owner });
    await this.currency.transfer(buyer2, eth(100), { from: owner });
    await this.currency.transfer(this.store.address, eth(1), { from: owner });
    await this.token.setApprovalForAll(this.store.address, 1, { from: seller });
    await this.currency.approve(this.store.address, eth(10000), {
      from: buyer,
    });
    await this.currency.approve(this.store.address, eth(10000), {
      from: buyer2,
    });
    await this.token.setApprovalForAll(proxy, 1, { from: seller });
    await this.currency.approve(proxy, eth(10000), {
      from: buyer,
    });
  });

  it('baseline', async () => {
    const { store, currency, token } = this;

    await _dumpTokens(this);
    await _dumpBalances(this);

    const c_tx = await this.currency.transferFrom(buyer, seller, eth(1), {
      from: proxy,
    });
    console.log('c_tx gasUsed:', c_tx.receipt.gasUsed);
    const t_tx = await this.token.transferFrom(seller, buyer, 1, {
      from: proxy,
    });
    console.log('t_tx gasUsed:', t_tx.receipt.gasUsed);
    await _dumpTokens(this);
    await _dumpBalances(this);
  });

  it('simple', async () => {
    const { store, currency, token } = this;

    await _dumpTokens(this);
    const post = await store.post(
      this.token.address,
      this.currency.address,
      eth(1),
      TOKEN_IDS,
      {
        from: seller,
      }
    );
    const saleIndex = post.receipt.logs[0].args.saleIndex;
    console.log('\n---- after post');
    console.log('post gasUsed:', post.receipt.gasUsed);
    await _dumpStore(this, saleIndex);
    await _dumpBalances(this);
    await _dumpTokens(this);

    const buy1 = await store.buy(saleIndex, {
      from: buyer,
    });
    console.log('\n---- after buy1:');
    console.log('buy1 gasUsed:', buy1.receipt.gasUsed);
    await _dumpStore(this, saleIndex);
    await _dumpBalances(this);
    await _dumpTokens(this);

    const buy2 = await store.buy(saleIndex, {
      from: buyer,
    });
    console.log('\n---- after buy2');
    console.log('buy1 gasUsed:', buy2.receipt.gasUsed);
    await _dumpStore(this, saleIndex);
    await _dumpBalances(this);
    await _dumpTokens(this);

    const buy3 = await store.buy(saleIndex, {
      from: buyer2,
    });
    console.log('\n---- after buy3');
    console.log('buy1 gasUsed:', buy3.receipt.gasUsed);
    await _dumpStore(this, saleIndex);
    await _dumpBalances(this);
    await _dumpTokens(this);
  });

  it('eth', async () => {
    const { store, currency, token } = this;

    await _dumpTokens(this);
    const post = await store.post(this.token.address, ZERO, eth(1), TOKEN_IDS, {
      from: seller,
    });
    const saleIndex = post.receipt.logs[0].args.saleIndex;
    console.log('\n---- after post');
    console.log('post gasUsed:', post.receipt.gasUsed);
    await _dumpStore(this, saleIndex);
    await _dumpEthBalances(this);
    await _dumpTokens(this);

    const buy1 = await store.buy(saleIndex, {
      from: buyer,
      value: eth(1),
    });
    console.log('\n---- after buy1:');
    console.log('buy1 gasUsed:', buy1.receipt.gasUsed);
    await _dumpStore(this, saleIndex);
    await _dumpEthBalances(this);
    await _dumpTokens(this);

    const buy2 = await store.buy(saleIndex, {
      from: buyer2,
      value: eth(1),
    });
    console.log('\n---- after buy2');
    console.log('buy1 gasUsed:', buy2.receipt.gasUsed);
    await _dumpStore(this, saleIndex);
    await _dumpEthBalances(this);
    await _dumpTokens(this);
  });
  it('eth_bad', async () => {
    const { store, currency, token } = this;

    await _dumpTokens(this);
    const post = await store.post(this.token.address, ZERO, eth(1), TOKEN_IDS, {
      from: seller,
    });
    const saleIndex = post.receipt.logs[0].args.saleIndex;
    console.log('\n---- after post');
    console.log('post gasUsed:', post.receipt.gasUsed);
    await _dumpStore(this, saleIndex);
    await _dumpEthBalances(this);
    await _dumpTokens(this);

    await expectRevert(
      store.buy(saleIndex, {
        from: buyer,
        value: eth(0.5),
      }),
      'bad_payment_amount'
    );
    console.log('\n---- after buy fail:');
    await _dumpStore(this, saleIndex);
    await _dumpEthBalances(this);
    await _dumpTokens(this);
  });

  it('cancel', async () => {
    const { store, currency, token } = this;

    await _dumpTokens(this);
    const post = await store.post(
      this.token.address,
      this.currency.address,
      eth(1),
      TOKEN_IDS,
      {
        from: seller,
      }
    );
    const saleIndex = post.receipt.logs[0].args.saleIndex;
    console.log('\n---- after post');
    console.log('post gasUsed:', post.receipt.gasUsed);
    await _dumpStore(this, saleIndex);
    await _dumpBalances(this);
    await _dumpTokens(this);

    const buy1 = await store.buy(saleIndex, {
      from: buyer,
    });
    console.log('\n---- after buy1:');
    console.log('buy1 gasUsed:', buy1.receipt.gasUsed);
    await _dumpStore(this, saleIndex);
    await _dumpBalances(this);
    await _dumpTokens(this);

    const cancel = await store.cancel(saleIndex, {
      from: seller,
    });
    console.log('\n---- after cancel');
    console.log('cancel gasUsed:', cancel.receipt.gasUsed);
    await _dumpStore(this, saleIndex);
    await _dumpBalances(this);
    await _dumpTokens(this);
  });

  async function _dumpStore(that, index) {
    const { store, currency, token } = that;
    const data = await store.getSale(index);
    console.log(
      'sale:',
      index.toNumber(),
      'price:',
      feth(data.price),
      'left:',
      data.quantityLeft.toNumber()
    );
  }
  async function _dumpBalances(that) {
    const { store, currency } = that;
    console.log(
      'store currency balance:',
      feth(await currency.balanceOf(store.address))
    );
    console.log(
      'seller currency balance:',
      feth(await currency.balanceOf(seller))
    );
    console.log(
      'buyer currency balance:',
      feth(await currency.balanceOf(buyer))
    );
    console.log(
      'buyer2 currency balance:',
      feth(await currency.balanceOf(buyer2))
    );
    console.log(
      'royalty currency balance:',
      feth(await currency.balanceOf(royalty))
    );
  }
  async function _dumpEthBalances(that) {
    const { store, currency } = that;
    console.log(
      'store currency balance:',
      feth(await web3.eth.getBalance(store.address))
    );
    console.log(
      'seller currency balance:',
      feth(await web3.eth.getBalance(seller))
    );
    console.log(
      'buyer currency balance:',
      feth(await web3.eth.getBalance(buyer))
    );
    console.log(
      'buyer2 currency balance:',
      feth(await web3.eth.getBalance(buyer2))
    );
    console.log(
      'royalty currency balance:',
      feth(await web3.eth.getBalance(royalty))
    );
  }
  async function _dumpTokens(that) {
    const { auction, token } = that;
    console.log(
      'seller token balance:',
      (await token.balanceOf(seller)).toNumber()
    );
    console.log(
      'buyer token balance:',
      (await token.balanceOf(buyer)).toNumber()
    );
    console.log(
      'buyer2 token balance:',
      (await token.balanceOf(buyer2)).toNumber()
    );
  }
});

async function _getSettleBlock() {
  const block_number = (await time.latestBlock()).toNumber();
  const settle_block = block_number - (block_number % 5) + 5;
  console.log('block_number:', block_number, 'settle_block:', settle_block);
  await time.advanceBlockTo(settle_block);
  return settle_block;
}
