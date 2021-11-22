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

const HarbourSwap = contract.fromArtifact('HarbourSwap');
const TestERC20 = contract.fromArtifact('TestERC20');

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

describe('HarbourSwap', function () {
  const [owner, buyer, seller] = accounts;
  const extra_sellers = accounts.slice(10, 20);
  const extra_buyers = accounts.slice(20, 30);
  this.timeout(30 * 1000);

  beforeEach(async () => {
    this.token = await TestERC20.new('Token', 'T', eth(10000), { from: owner });
    this.currency = await TestERC20.new('Currency', 'C', eth(10000), {
      from: owner,
    });
    this.swap = await HarbourSwap.new(10, owner, { from: owner });

    await this.token.transfer(seller, eth(100), { from: owner });
    await this.currency.transfer(buyer, eth(100), { from: owner });
    await this.token.approve(this.swap.address, eth(10000), { from: seller });
    await this.currency.approve(this.swap.address, eth(10000), { from: buyer });
  });

  it('simple exact', async () => {
    const { swap, currency, token } = this;
    await _setupOrders(this, eth(1), eth(1));
    const priceRatio = new BN(RATIO);

    await expect(await token.balanceOf(buyer)).to.be.bignumber.equal('0');
    await expect(await currency.balanceOf(seller)).to.be.bignumber.equal('0');

    await _dumpOrders(this, priceRatio);
    await _dumpBalance(this, swap.address, 'before swap');
    await _dumpBalance(this, buyer, 'before buyer');
    await _dumpBalance(this, seller, 'before seller');

    await _verifyMarket(this, priceRatio, eth(1), eth(1));

    const settle = await swap.settleBucketExact(
      token.address,
      currency.address,
      priceRatio,
      await _getSettleBlock()
    );
    console.log('settle gasUsed:', settle.receipt.gasUsed);

    await _dumpOrders(this, priceRatio);
    await _dumpFeeBalance(this);
    await _dumpBalance(this, swap.address, 'swap');
    await _dumpBalance(this, buyer, 'buyer');
    await _dumpBalance(this, seller, 'seller');
    await _verifyBalance(this, buyer, eth(1), eth(100 - 1 - 0.01));
    await _verifyBalance(this, seller, eth(100 - 1 - 0.01), eth(1));
    await _verifyMarket(this, priceRatio, '0', '0');
    await _verifyBalance(this, swap.address, eth(0.01), eth(0.01));
  });

  it('simple single seller', async () => {
    const { swap, currency, token } = this;
    const priceRatio = new BN(RATIO);

    await _setupOrders(this, eth(1), eth(10));

    await expect(await token.balanceOf(buyer)).to.be.bignumber.equal('0');
    await expect(await currency.balanceOf(seller)).to.be.bignumber.equal('0');

    console.log('block:', String(await time.latestBlock()));
    const settle = await swap.settleBucketFlatSell(
      token.address,
      currency.address,
      priceRatio,
      await _getSettleBlock()
    );
    console.log('settle gasUsed:', settle.receipt.gasUsed);

    await _dumpOrders(this, priceRatio);
    await _verifyBalance(this, buyer, eth(1), eth(100 - 1 - 0.01));
    await _verifyBalance(this, seller, eth(100 - 10 - 0.1), eth(1));
    await _verifyMarket(this, priceRatio, '0', eth(10 - 1));
    await _verifyBalance(this, swap.address, eth(9.1), eth(0.01));
  });

  it('simple single buyer', async () => {
    const { swap, currency, token } = this;
    const priceRatio = new BN(RATIO);
    await _setupOrders(this, eth(9), eth(1));

    await expect(await token.balanceOf(buyer)).to.be.bignumber.equal('0');
    await expect(await currency.balanceOf(seller)).to.be.bignumber.equal('0');

    const settle = await swap.settleBucketFlatBuy(
      token.address,
      currency.address,
      priceRatio,
      await _getSettleBlock()
    );
    console.log('settle gasUsed:', settle.receipt.gasUsed);

    await _dumpOrders(this, priceRatio);
    await _verifyBalance(this, buyer, eth(1), eth(100 - 9 - 0.09));
    await _verifyBalance(this, seller, eth(100 - 1 - 0.01), eth(1));
    await _verifyMarket(this, priceRatio, eth(9 - 1), '0');
    await _verifyBalance(this, swap.address, eth(0.01), eth(8.09));
  });

  it('simple no fee add', async () => {
    const { swap, currency, token } = this;
    const priceRatio = new BN(RATIO);
    await _setupOrders(this, eth(1), eth(1), {
      sell_fee_add: 0,
      buy_fee_add: 0,
    });
    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(1 - 0.01), eth(1 - 0.01));

    await expect(await token.balanceOf(buyer)).to.be.bignumber.equal('0');
    await expect(await currency.balanceOf(seller)).to.be.bignumber.equal('0');

    const settle = await swap.settleBucketExact(
      token.address,
      currency.address,
      priceRatio,
      await _getSettleBlock()
    );
    console.log('settle gasUsed:', settle.receipt.gasUsed);

    await _dumpOrders(this, priceRatio);
    await _verifyBalance(this, buyer, eth(1 - 0.01), eth(100 - 1));
    await _verifyBalance(this, seller, eth(100 - 1), eth(1 - 0.01));
    await _verifyMarket(this, priceRatio, '0', '0');
    await _verifyBalance(this, swap.address, eth(0.01), eth(0.01));
  });

  it('cancel force', async () => {
    const { swap, currency, token } = this;
    const priceRatio = new BN(RATIO);
    await _setupOrders(this, eth(1), eth(1));
    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(1), eth(1));
    await _verifyBalance(this, buyer, eth(0), eth(100 - 1 - 0.01));
    await _verifyBalance(this, seller, eth(100 - 1 - 0.01), eth(0));

    await time.advanceBlockTo((await time.latestBlock()).addn(2));
    await cancelBoth(this, priceRatio, 1);

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, '0', '0');
    await _verifyBalance(this, buyer, '0', eth(100 - 0.01));
    await _verifyBalance(this, seller, eth(100 - 0.01), '0');
    await _verifyBalance(this, swap.address, eth(0.01), eth(0.01));
  });

  it('cancel fail no-force', async () => {
    const { swap, currency, token } = this;
    const priceRatio = new BN(RATIO);
    await _setupOrders(this, eth(1), eth(1));
    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(1), eth(1));
    await _verifyBalance(this, buyer, eth(0), eth(100 - 1 - 0.01));
    await _verifyBalance(this, seller, eth(100 - 1 - 0.01), eth(0));

    await time.advanceBlockTo((await time.latestBlock()).addn(2));
    await expectRevert(
      swap.cancelBuy(token.address, currency.address, priceRatio, 0, 0, {
        from: buyer,
      }),
      'need_force'
    );
    const cancel = swap.cancelSell(
      token.address,
      currency.address,
      priceRatio,
      0,
      0,
      {
        from: seller,
      }
    );
    await expectRevert(cancel, 'need_force');
    await time.advanceBlockTo((await time.latestBlock()).addn(2));
    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(1), eth(1));

    await _verifyBalance(this, buyer, '0', eth(100 - 1 - 0.01));
    await _verifyBalance(this, seller, eth(100 - 1 - 0.01), '0');
    await _verifyBalance(this, swap.address, eth(1 + 0.01), eth(1 + 0.01));
  });

  it('cancel no-force', async () => {
    const { swap, currency, token } = this;
    const priceRatio = new BN(RATIO);
    await _setupOrders(this, eth(1), eth(1));
    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(1), eth(1));
    await _verifyBalance(this, buyer, eth(0), eth(100 - 1 - 0.01));
    await _verifyBalance(this, seller, eth(100 - 1 - 0.01), eth(0));

    await time.advanceBlockTo((await time.latestBlock()).addn(20));
    console.log('after block:', String(await time.latestBlock()));

    await cancelBoth(this, priceRatio, 0);

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, '0', '0');
    await _verifyBalance(this, buyer, '0', eth(100));
    await _verifyBalance(this, seller, eth(100), '0');
    await _verifyBalance(this, swap.address, eth(0), eth(0));
  });

  it('cancel no-force no-add', async () => {
    const { swap, currency, token } = this;
    const priceRatio = new BN(RATIO);
    await _setupOrders(this, eth(1), eth(1), {
      sell_fee_add: 0,
      buy_fee_add: 0,
    });
    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(1 - 0.01), eth(1 - 0.01));
    await _verifyBalance(this, buyer, eth(0), eth(100 - 1));
    await _verifyBalance(this, seller, eth(100 - 1), eth(0));

    await time.advanceBlockTo((await time.latestBlock()).addn(20));
    console.log('after block:', String(await time.latestBlock()));

    await cancelBoth(this, priceRatio, 0);

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, '0', '0');
    await _verifyBalance(this, buyer, '0', eth(100 - 0.01 * 0.01));
    await _verifyBalance(this, seller, eth(100 - 0.01 * 0.01), '0');
    await _verifyBalance(
      this,
      swap.address,
      eth(0.01 * 0.01),
      eth(0.01 * 0.01)
    );
    await _dumpFeeBalance(this);
  });

  it('cancel fail double cancel', async () => {
    const { swap, currency, token } = this;
    const priceRatio = new BN(RATIO);
    await _setupOrders(this, eth(1), eth(1), {
      sell_fee_add: 0,
      buy_fee_add: 0,
    });
    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(1 - 0.01), eth(1 - 0.01));
    await _verifyBalance(this, buyer, eth(0), eth(100 - 1));
    await _verifyBalance(this, seller, eth(100 - 1), eth(0));

    await time.advanceBlockTo((await time.latestBlock()).addn(2));
    await cancelBoth(this, priceRatio, 1);
    await _dumpOrders(this, priceRatio);
    await time.advanceBlock();
    await expectRevert(
      swap.cancelSell(token.address, currency.address, priceRatio, 0, 1, {
        from: seller,
      }),
      'not_found'
    );
    await time.advanceBlock();
    await expectRevert(
      swap.cancelBuy(token.address, currency.address, priceRatio, 0, 1, {
        from: buyer,
      }),
      'not_found'
    );
    await time.advanceBlock();

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, '0', '0');
    await _verifyBalance(this, buyer, '0', eth(100 - 0.01));
    await _verifyBalance(this, seller, eth(100 - 0.01), '0');
    await _verifyBalance(this, swap.address, eth(0.01), eth(0.01));
    await _dumpFeeBalance(this);
  });
  it('multi exact', async () => {
    const { swap, currency, token } = this;
    await _setupMulti(this, 5, eth(2), 10, eth(1));
    const priceRatio = new BN(RATIO);

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(10), eth(10));

    const settle = await swap.settleBucketExact(
      token.address,
      currency.address,
      priceRatio,
      await _getSettleBlock()
    );
    console.log('settle gasUsed:', settle.receipt.gasUsed);

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, '0', '0');
    await _verifyBalance(this, swap.address, eth(0.1), eth(0.1));
  });
  it('multi sell heavy', async () => {
    const { swap, currency, token } = this;
    await _setupMulti(this, 5, eth(2), 10, eth(2));
    const priceRatio = new BN(RATIO);

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(10), eth(20));

    const settle = await swap.settleBucketFlatSell(
      token.address,
      currency.address,
      priceRatio,
      await _getSettleBlock()
    );
    console.log('settle gasUsed:', settle.receipt.gasUsed);

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, '0', eth(10));
    await _verifyBalance(this, swap.address, eth(10.2), eth(0.1));
  });
  it('multi sell heavy wierd', async () => {
    const { swap, currency, token } = this;
    await _setupMulti(this, 5, eth(6), 3, eth(20), {});
    await _setupMulti(this, 0, 0, 7, eth(0.1), {
      start_sell: 4,
    });
    await _setupMulti(this, 0, 0, 10, eth(1), {
      start_sell: 8,
    });
    const priceRatio = new BN(RATIO);

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(30), eth(62.3));

    const settle = await swap.settleBucketFlatSell(
      token.address,
      currency.address,
      priceRatio,
      await _getSettleBlock()
    );
    console.log('settle gasUsed:', settle.receipt.gasUsed);

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, '0', eth(32.3));
  });
  it('multi buy heavy wierd', async () => {
    const { swap, currency, token } = this;
    await _setupMulti(this, 3, eth(20), 5, eth(6));
    await _setupMulti(this, 7, eth(0.1), 0, 0, {
      start_buy: 4,
    });
    await _setupMulti(this, 10, eth(1), 0, 0, {
      start_buy: 8,
    });
    const priceRatio = new BN(RATIO);

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(62.3), eth(30));

    const settle = await swap.settleBucketFlatBuy(
      token.address,
      currency.address,
      priceRatio,
      await _getSettleBlock()
    );
    console.log('settle gasUsed:', settle.receipt.gasUsed);

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(32.3), '0');
  });
  it('multi flat', async () => {
    const { swap, currency, token } = this;
    await _setupMulti(this, 10, eth(1), 10, eth(1));
    const priceRatio = new BN(RATIO);
    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(10), eth(10));

    const settle = await swap.settleBucketFlatSell(
      token.address,
      currency.address,
      priceRatio,
      await _getSettleBlock()
    );
    console.log('settle gasUsed:', settle.receipt.gasUsed);

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, '0', '0');
  });

  it('cross flat', async () => {
    const { swap, currency, token } = this;
    const buyRatio = new BN(2).mul(RATIO);
    const sellRatio = new BN(RATIO);

    await _setupMulti(this, 0, eth(1), 5, eth(1));
    const high_price = _makePrice(buyRatio);
    await _setupMulti(this, 5, eth(1), 0, eth(1), {
      price_bucket: high_price.price_bucket,
      price_exp: high_price.price_exp,
    });

    await _dumpOrders(this, sellRatio);
    await _dumpOrders(this, buyRatio);
    await _verifyMarket(this, sellRatio, '0', eth(5));
    await _verifyMarket(this, buyRatio, eth(5), '0');

    const settle = await swap.settleCrossFlatBuy(
      token.address,
      currency.address,
      buyRatio,
      sellRatio,
      await _getSettleBlock()
    );
    console.log('settle gasUsed:', settle.receipt.gasUsed);

    await _dumpOrders(this, sellRatio);
    await _dumpOrders(this, buyRatio);
    await _verifyMarket(this, sellRatio, '0', '0');
    await _verifyMarket(this, buyRatio, '0', '0');
    await _dumpFeeBalance(this);
    await _dumpBalance(this, swap.address, 'swap');
  });
  it('cross buy heavy', async () => {
    const { swap, currency, token } = this;
    const buyRatio = new BN(2).mul(RATIO);
    const sellRatio = new BN(RATIO);
    await _setupMulti(this, 0, 0, 5, eth(1));

    const high_price = _makePrice(buyRatio);
    await _setupMulti(this, 5, eth(2), 0, 0, {
      price_bucket: high_price.price_bucket,
      price_exp: high_price.price_exp,
    });

    await _dumpOrders(this, sellRatio);
    await _dumpOrders(this, buyRatio);
    await _verifyMarket(this, sellRatio, '0', eth(5));
    await _verifyMarket(this, buyRatio, eth(10), '0');

    const settle = await swap.settleCrossFlatBuy(
      token.address,
      currency.address,
      buyRatio,
      sellRatio,
      await _getSettleBlock()
    );
    console.log('settle gasUsed:', settle.receipt.gasUsed);

    await _dumpOrders(this, sellRatio);
    await _dumpOrders(this, buyRatio);
    await _verifyMarket(this, sellRatio, '0', '0');
    await _verifyMarket(this, buyRatio, eth(5), '0');
    await _dumpFeeBalance(this);
    await _dumpBalance(this, swap.address, 'swap');
  });
  it('cross sell heavy', async () => {
    const { swap, currency, token } = this;
    const buyRatio = new BN(2).mul(RATIO);
    const sellRatio = new BN(RATIO);

    await _setupMulti(this, 0, 0, 5, eth(2));
    const high_price = _makePrice(buyRatio);
    await _setupMulti(this, 5, eth(1), 0, 0, {
      price_bucket: high_price.price_bucket,
      price_exp: high_price.price_exp,
    });

    await _dumpOrders(this, sellRatio);
    await _dumpOrders(this, buyRatio);
    await _verifyMarket(this, sellRatio, '0', eth(10));
    await _verifyMarket(this, buyRatio, eth(5), '0');

    const settle = await swap.settleCrossFlatSell(
      token.address,
      currency.address,
      buyRatio,
      sellRatio,
      await _getSettleBlock()
    );
    console.log('settle gasUsed:', settle.receipt.gasUsed);

    await _dumpOrders(this, sellRatio);
    await _dumpOrders(this, buyRatio);
    await _verifyMarket(this, sellRatio, '0', eth(5));
    await _verifyMarket(this, buyRatio, '0', '0');
    await _dumpFeeBalance(this);
    await _dumpBalance(this, swap.address, 'swap');
  });

  async function _setupMulti(
    contracts,
    buy_count,
    buy_amount,
    sell_count,
    sell_amount,
    extra
  ) {
    const default_ratio = _makePrice(RATIO);
    extra = Object.assign(
      {
        sell_fee_add: 1,
        buy_fee_add: 1,
        start_buy: 0,
        start_sell: 0,
        price_bucket: default_ratio.price_bucket,
        price_exp: default_ratio.price_exp,
      },
      extra || {}
    );
    const { swap, currency, token } = contracts;
    for (let i = extra.start_sell; i < sell_count; i++) {
      await token.transfer(extra_sellers[i], eth(100), { from: owner });
      await token.approve(swap.address, eth(100), { from: extra_sellers[i] });
      const post_sell = await swap.postSell(
        token.address,
        currency.address,
        extra.price_bucket,
        extra.price_exp,
        0,
        1e10,
        sell_amount,
        extra.sell_fee_add,
        { from: extra_sellers[i] }
      );
      console.log('postSell.gas:', post_sell.receipt.gasUsed);
    }
    for (let i = extra.start_buy; i < buy_count; i++) {
      await currency.transfer(extra_buyers[i], eth(100), { from: owner });
      await currency.approve(swap.address, eth(100), { from: extra_buyers[i] });
      const post_buy = await swap.postBuy(
        token.address,
        currency.address,
        extra.price_bucket,
        extra.price_exp,
        0,
        1e10,
        buy_amount,
        extra.buy_fee_add,
        { from: extra_buyers[i] }
      );
      console.log('postBuy.gas:', post_buy.receipt.gasUsed);
    }
  }

  async function _setupOrders(contracts, buy_amount, sell_amount, extra) {
    extra = Object.assign(
      {
        sell_fee_add: 1,
        buy_fee_add: 1,
      },
      extra || {}
    );
    const { swap, currency, token } = contracts;
    const priceRatio = new BN(RATIO);
    const sell_ratio = _makePrice(priceRatio);
    const post_sell = await swap.postSell(
      token.address,
      currency.address,
      sell_ratio.price_bucket,
      sell_ratio.price_exp,
      0,
      1e10,
      sell_amount,
      extra.sell_fee_add,
      { from: seller }
    );
    console.log('postSell.gas:', post_sell.receipt.gasUsed);
    const post_buy = await swap.postBuy(
      token.address,
      currency.address,
      sell_ratio.price_bucket,
      sell_ratio.price_exp,
      0,
      1e10,
      buy_amount,
      extra.buy_fee_add,
      { from: buyer }
    );
    console.log('postBuy.gas:', post_buy.receipt.gasUsed);

    const market_data = await swap.getMarketData(
      token.address,
      currency.address,
      priceRatio
    );
  }
  async function cancelBoth(contracts, priceRatio, force) {
    const { swap, token, currency } = contracts;
    const cancel_buy = await swap.cancelBuy(
      token.address,
      currency.address,
      priceRatio,
      0,
      force || 0,
      { from: buyer }
    );
    console.log('cancel buy gasUsed:', cancel_buy.receipt.gasUsed);
    const cancel_sell = await swap.cancelSell(
      token.address,
      currency.address,
      priceRatio,
      0,
      force || 0,
      { from: seller }
    );
    console.log('cancel sell gasUsed:', cancel_sell.receipt.gasUsed);
  }

  async function _verifyBalance(
    contracts,
    addr,
    token_balance,
    currency_balance
  ) {
    const { swap, currency, token } = contracts;
    await expect(await token.balanceOf(addr)).to.be.bignumber.equal(
      token_balance
    );
    await expect(await currency.balanceOf(addr)).to.be.bignumber.equal(
      currency_balance
    );
  }

  async function _verifyMarket(contracts, priceRatio, buy, sell) {
    const { swap, currency, token } = contracts;
    const market_after = await swap.getMarketData(
      token.address,
      currency.address,
      priceRatio
    );
    let totalBuy = new BN();
    let totalSell = new BN();
    for (let i = 0; i < market_after.buyOrderCount; i++) {
      const order = await swap.getBuyOrder(
        token.address,
        currency.address,
        priceRatio,
        i
      );
      totalBuy.iadd(new BN(order.quantity));
    }
    for (let i = 0; i < market_after.sellOrderCount; i++) {
      const order = await swap.getSellOrder(
        token.address,
        currency.address,
        priceRatio,
        i
      );
      totalSell.iadd(new BN(order.quantity));
    }
    expect(totalBuy).to.be.bignumber.equal(buy);
    expect(totalSell).to.be.bignumber.equal(sell);
  }

  async function _dumpOrders(contracts, priceRatio) {
    const { swap, currency, token } = contracts;
    const market = await swap.getMarketData(
      token.address,
      currency.address,
      priceRatio
    );
    const price = _price(priceRatio);
    for (let i = 0; i < market.buyOrderCount.toNumber(); i++) {
      const buy = await swap.getBuyOrder(
        token.address,
        currency.address,
        priceRatio,
        i
      );
      console.log('buy_order(' + price + '):', i, 'qty:', feth(buy.quantity));
    }
    if (market.buyOrderCount.toNumber() === 0) {
      console.log('buy_order(' + price + '): none!');
    }
    for (let i = 0; i < market.sellOrderCount.toNumber(); i++) {
      const sell = await swap.getSellOrder(
        token.address,
        currency.address,
        priceRatio,
        i
      );
      console.log('sell_order(' + price + '):', i, 'qty:', feth(sell.quantity));
    }
    if (market.sellOrderCount.toNumber() === 0) {
      console.log('sell_order(' + price + '): none!');
    }
  }
  async function _dumpFeeBalance(contracts) {
    const { swap, currency, token } = contracts;
    console.log('fee.currency:', feth(await swap.feeBalance(currency.address)));
    console.log('fee.token:', feth(await swap.feeBalance(token.address)));
  }

  async function _dumpBalance(contracts, address, name) {
    const { currency, token } = contracts;
    console.log(name, 'token balance:', feth(await token.balanceOf(address)));
    console.log(
      name,
      'currency balance:',
      feth(await currency.balanceOf(address))
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

const RATIO_FLOAT = parseFloat(RATIO.toString());
function _price(ratio) {
  const price = parseFloat(ratio.toString()) / RATIO_FLOAT;
  return price;
}

function _makePrice(priceRatio) {
  let price_exp = 0;
  let price_bucket = new BN(priceRatio);
  while (price_bucket.gtn(255)) {
    price_exp++;
    price_bucket = price_bucket.divn(10);
  }
  return {
    price_bucket: price_bucket.toNumber(),
    price_exp,
  };
}
