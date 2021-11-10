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

describe('HarbourSwap', () => {
  const [owner, buyer, seller] = accounts;
  const extra_sellers = accounts.slice(10, 20);
  const extra_buyers = accounts.slice(20, 30);

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

  it('test exact', async () => {
    const { swap, currency, token } = this;
    await _setupOrders(this, eth(1), eth(1));
    const priceRatio = new BN(1).shln(128);
    console.log('token seller:', feth(await token.balanceOf(seller)));
    console.log('currency buyer:', feth(await currency.balanceOf(buyer)));
    console.log('swap token:', feth(await token.balanceOf(swap.address)));
    console.log('swap currency:', feth(await currency.balanceOf(swap.address)));

    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(1), eth(1));
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
    await _verifyBalance(this, buyer, eth(1), eth(100 - 1 - 0.01));
    await _verifyBalance(this, seller, eth(100 - 1 - 0.01), eth(1));
    await _verifyMarket(this, priceRatio, '0', '0');
    await _verifyBalance(this, swap.address, eth(0.01), eth(0.01));
  });

  it('test single seller', async () => {
    const { swap, currency, token } = this;
    const priceRatio = new BN(1).shln(128);

    await _setupOrders(this, eth(1), eth(10));

    await expect(await token.balanceOf(buyer)).to.be.bignumber.equal('0');
    await expect(await currency.balanceOf(seller)).to.be.bignumber.equal('0');

    console.log('block:', String(await time.latestBlock()));
    const settle = await swap.settleBucketSingleSeller(
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

  it('test single buyer', async () => {
    const { swap, currency, token } = this;
    const priceRatio = new BN(1).shln(128);
    await _setupOrders(this, eth(9), eth(1));

    await expect(await token.balanceOf(buyer)).to.be.bignumber.equal('0');
    await expect(await currency.balanceOf(seller)).to.be.bignumber.equal('0');

    const settle = await swap.settleBucketSingleBuyer(
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

  it('test no fee add', async () => {
    const { swap, currency, token } = this;
    const priceRatio = new BN(1).shln(128);
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
    const priceRatio = new BN(1).shln(128);
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
    const priceRatio = new BN(1).shln(128);
    await _setupOrders(this, eth(1), eth(1));
    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(1), eth(1));
    await _verifyBalance(this, buyer, eth(0), eth(100 - 1 - 0.01));
    await _verifyBalance(this, seller, eth(100 - 1 - 0.01), eth(0));

    await time.advanceBlockTo((await time.latestBlock()).addn(2));
    await expectRevert.unspecified(
      swap.cancelBuy(token.address, currency.address, priceRatio, 0, 0, {
        from: buyer,
      })
    );
    await expectRevert.unspecified(
      swap.cancelSell(token.address, currency.address, priceRatio, 0, 0, {
        from: seller,
      })
    );
    await time.advanceBlockTo((await time.latestBlock()).addn(2));
    await _dumpOrders(this, priceRatio);
    await _verifyMarket(this, priceRatio, eth(1), eth(1));

    await _verifyBalance(this, buyer, '0', eth(100 - 1 - 0.01));
    await _verifyBalance(this, seller, eth(100 - 1 - 0.01), '0');
    await _verifyBalance(this, swap.address, eth(1 + 0.01), eth(1 + 0.01));
  });

  it('cancel no-force', async () => {
    const { swap, currency, token } = this;
    const priceRatio = new BN(1).shln(128);
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
    const priceRatio = new BN(1).shln(128);
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
    const priceRatio = new BN(1).shln(128);
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
    await expectRevert.unspecified(swap.cancelSell(
      token.address,
      currency.address,
      priceRatio,
      0,
      1,
      { from: seller }
    ));
    await time.advanceBlock();
    await expectRevert.unspecified(swap.cancelBuy(
      token.address,
      currency.address,
      priceRatio,
      0,
      1,
      { from: buyer }
    ));
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
    const priceRatio = new BN(1).shln(128);

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

  async function _setupMulti(contracts, buy_count, buy_amount, sell_count, sell_amount, extra) {
    extra = Object.assign(
      {
        sell_fee_add: 1,
        buy_fee_add: 1,
      },
      extra || {}
    );
    const { swap, currency, token } = contracts;
    for (let i = 0 ; i < sell_count ; i++) {
      await token.transfer(extra_sellers[i], eth(100), { from: owner });
      await token.approve(swap.address, eth(100), { from: extra_sellers[i] });
      const post_sell = await swap.postSell(
        token.address,
        currency.address,
        1,
        128,
        0,
        1e10,
        sell_amount,
        extra.sell_fee_add,
        { from: extra_sellers[i] }
      );
      console.log('postSell.gas:', post_sell.receipt.gasUsed);
    }
    for (let i = 0 ; i < buy_count ; i++) {
      await currency.transfer(extra_buyers[i], eth(100), { from: owner });
      await currency.approve(swap.address, eth(100), { from: extra_buyers[i] });
      const post_buy = await swap.postBuy(
        token.address,
        currency.address,
        1,
        128,
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
    const priceRatio = new BN(1).shln(128);

    const post_sell = await swap.postSell(
      token.address,
      currency.address,
      1,
      128,
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
      1,
      128,
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
    console.log(
      'currency fee_balance:',
      feth(await swap.feeBalance(currency.address))
    );
    console.log(
      'token fee_balance:',
      feth(await swap.feeBalance(token.address))
    );
    console.log('market_data: totalSell:', feth(market_data.totalSell));
    console.log('market_data: totalBuy:', feth(market_data.totalBuy));
    console.log(
      'swap currency balance:',
      feth(await currency.balanceOf(swap.address))
    );
    console.log(
      'swap token balance:',
      feth(await token.balanceOf(swap.address))
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
    await expect(await token.balanceOf(addr)).to.be.bignumber.equal(token_balance);
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
    expect(market_after.totalBuy).to.be.bignumber.equal(buy);
    expect(market_after.totalSell).to.be.bignumber.equal(sell);
  }

  async function _dumpOrders(contracts, priceRatio) {
    const { swap, currency, token } = contracts;
    const market = await swap.getMarketData(
      token.address,
      currency.address,
      priceRatio
    );
    for (let i = 0 ; i < market.buyOrderCount ; i++) {
      const buy = await swap.getBuyOrder(
        token.address,
        currency.address,
        priceRatio,
        i
      );
      console.log('buy_order:', i, 'qty:', feth(buy.quantity));
    }
    for (let i = 0 ; i < market.sellOrderCount ; i++) {
      const sell = await swap.getSellOrder(
        token.address,
        currency.address,
        priceRatio,
        i
      );
      console.log('sell_order:', i, 'qty:', feth(sell.quantity));
    }
  }
  async function _dumpFeeBalance(contracts) {
    const { swap, currency, token } = contracts;
    console.log('fee.currency:', feth(await swap.feeBalance(currency.address)));
    console.log('fee.token:', feth(await swap.feeBalance(token.address)));
  }
});

async function _getSettleBlock() {
  const block_number = (await time.latestBlock()).toNumber();
  const settle_block = block_number - (block_number % 5) + 5;
  console.log('block_number:', block_number, 'settle_block:', settle_block);
  await time.advanceBlockTo(settle_block);
  return settle_block;
}
