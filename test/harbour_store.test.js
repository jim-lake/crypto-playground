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
const { parseUnits, formatEther, formatBytes32String, parseBytes32String } =
  ethers.utils;

const HarbourStore = contract.fromArtifact('HarbourStore');
const TestERC721 = contract.fromArtifact('TestERC721');
const HarbourNFT = contract.fromArtifact('HarbourNFT');
const TestERC20 = contract.fromArtifact('TestERC20');

const ZERO = '0x0000000000000000000000000000000000000000';
const TOKEN_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SKU0 = formatBytes32String('nft_sku0');

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
  const [owner, seller, buyer, buyer2, proxy, baseline, royalty] = accounts;
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

    await this.token.mintMultipleWithTokenURI(this.store.address, 1, 10, '', {
      from: owner,
    });
    await this.currency.transfer(royalty, eth(1), { from: owner });
    await this.currency.transfer(seller, eth(1), { from: owner });
    await this.currency.transfer(buyer, eth(100), { from: owner });
    await this.currency.transfer(buyer2, eth(100), { from: owner });
    await this.currency.transfer(this.store.address, eth(1), { from: owner });
    await this.currency.approve(this.store.address, eth(10000), {
      from: buyer,
    });
    await this.currency.approve(this.store.address, eth(10000), {
      from: buyer2,
    });

    await this.store.addAdmin(seller, { from: owner });
  });

  it('baseline', async () => {
    const { store, currency, token } = this;

    await this.token.mintMultipleWithTokenURI(baseline, 100, 10, '', {
      from: owner,
    });
    await this.currency.approve(proxy, eth(10000), {
      from: buyer,
    });

    await _dumpTokens(this);
    await _dumpBalances(this);

    const c_tx = await this.currency.transferFrom(buyer, seller, eth(1), {
      from: proxy,
    });
    console.log('c_tx gasUsed:', c_tx.receipt.gasUsed);
    const t_tx = await this.token.transferFrom(baseline, buyer, 100, {
      from: baseline,
    });
    console.log('t_tx gasUsed:', t_tx.receipt.gasUsed);
    await _dumpTokens(this);
    await _dumpBalances(this);
  });

  it('simple', async () => {
    const { store, currency, token } = this;

    await _dumpTokens(this);
    const post = await store.post(
      SKU0,
      this.token.address,
      this.currency.address,
      eth(1),
      TOKEN_IDS,
      {
        from: seller,
      }
    );
    console.log('\n---- after post');
    console.log('post gasUsed:', post.receipt.gasUsed);
    await _dumpStore(this, SKU0);
    await _dumpBalances(this);
    await _dumpTokens(this);

    const buy1 = await store.buy(SKU0, {
      from: buyer,
    });
    console.log('\n---- after buy1:');
    console.log('buy1 gasUsed:', buy1.receipt.gasUsed);
    await _dumpStore(this, SKU0);
    await _dumpBalances(this);
    await _dumpTokens(this);

    const buy2 = await store.buy(SKU0, {
      from: buyer,
    });
    console.log('\n---- after buy2');
    console.log('buy1 gasUsed:', buy2.receipt.gasUsed);
    await _dumpStore(this, SKU0);
    await _dumpBalances(this);
    await _dumpTokens(this);

    const buy3 = await store.buy(SKU0, {
      from: buyer2,
    });
    console.log('\n---- after buy3');
    console.log('buy1 gasUsed:', buy3.receipt.gasUsed);
    await _dumpStore(this, SKU0);
    await _dumpBalances(this);
    await _dumpTokens(this);
  });

  it('eth', async () => {
    const { store, currency, token } = this;

    await _dumpTokens(this);
    const post = await store.post(
      SKU0,
      this.token.address,
      ZERO,
      eth(1),
      TOKEN_IDS,
      {
        from: seller,
      }
    );
    console.log('\n---- after post');
    console.log('post gasUsed:', post.receipt.gasUsed);
    await _dumpStore(this, SKU0);
    await _dumpEthBalances(this);
    await _dumpTokens(this);

    const buy1 = await store.buy(SKU0, {
      from: buyer,
      value: eth(1),
    });
    console.log('\n---- after buy1:');
    console.log('buy1 gasUsed:', buy1.receipt.gasUsed);
    await _dumpStore(this, SKU0);
    await _dumpEthBalances(this);
    await _dumpTokens(this);

    const buy2 = await store.buy(SKU0, {
      from: buyer2,
      value: eth(1),
    });
    console.log('\n---- after buy2');
    console.log('buy1 gasUsed:', buy2.receipt.gasUsed);
    await _dumpStore(this, SKU0);
    await _dumpEthBalances(this);
    await _dumpTokens(this);
  });
  it('eth_bad', async () => {
    const { store, currency, token } = this;

    await _dumpTokens(this);
    const post = await store.post(
      SKU0,
      this.token.address,
      ZERO,
      eth(1),
      TOKEN_IDS,
      {
        from: seller,
      }
    );
    console.log('\n---- after post');
    console.log('post gasUsed:', post.receipt.gasUsed);
    await _dumpStore(this, SKU0);
    await _dumpEthBalances(this);
    await _dumpTokens(this);

    await expectRevert(
      store.buy(SKU0, {
        from: buyer,
        value: eth(0.5),
      }),
      'bad_payment_amount'
    );
    console.log('\n---- after buy fail:');
    await _dumpStore(this, SKU0);
    await _dumpEthBalances(this);
    await _dumpTokens(this);
  });

  it('cancel', async () => {
    const { store, currency, token } = this;

    await _dumpTokens(this);
    const post = await store.post(
      SKU0,
      this.token.address,
      this.currency.address,
      eth(1),
      TOKEN_IDS,
      {
        from: seller,
      }
    );
    console.log('\n---- after post');
    console.log('post gasUsed:', post.receipt.gasUsed);
    await _dumpStore(this, SKU0);
    await _dumpBalances(this);
    await _dumpTokens(this);

    const buy1 = await store.buy(SKU0, {
      from: buyer,
    });
    console.log('\n---- after buy1:');
    console.log('buy1 gasUsed:', buy1.receipt.gasUsed);
    await _dumpStore(this, SKU0);
    await _dumpBalances(this);
    await _dumpTokens(this);

    const cancel = await store.cancel(SKU0, {
      from: seller,
    });
    console.log('\n---- after cancel');
    console.log('cancel gasUsed:', cancel.receipt.gasUsed);
    await _dumpStore(this, SKU0);
    await _dumpBalances(this);
    await _dumpTokens(this);
  });

  async function _dumpStore(that, sku) {
    const { store, currency, token } = that;
    const data = await store.getSale(sku);
    console.log(
      'sale:',
      parseBytes32String(sku),
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
