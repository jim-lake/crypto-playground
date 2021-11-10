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
    expect(await token.balanceOf(buyer)).to.be.bignumber.equal('0');
    expect(await currency.balanceOf(seller)).to.be.bignumber.equal('0');

    const settle = await swap.settleBucketExact(
      token.address,
      currency.address,
      priceRatio,
      100
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

    expect(await token.balanceOf(buyer)).to.be.bignumber.equal('0');
    expect(await currency.balanceOf(seller)).to.be.bignumber.equal('0');

    const settle = await swap.settleBucketSingleSeller(
      token.address,
      currency.address,
      priceRatio,
      100
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

    expect(await token.balanceOf(buyer)).to.be.bignumber.equal('0');
    expect(await currency.balanceOf(seller)).to.be.bignumber.equal('0');

    const settle = await swap.settleBucketSingleBuyer(
      token.address,
      currency.address,
      priceRatio,
      100
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

    expect(await token.balanceOf(buyer)).to.be.bignumber.equal('0');
    expect(await currency.balanceOf(seller)).to.be.bignumber.equal('0');

    const settle = await swap.settleBucketExact(
      token.address,
      currency.address,
      priceRatio,
      100
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

    expectRevert(
      swap.cancelBuy(token.address, currency.address, priceRatio, 0, 0, {
        from: buyer,
      }),
      'not_force'
    );
    expectRevert(
      swap.cancelSell(token.address, currency.address, priceRatio, 0, 0, {
        from: seller,
      }),
      'not_force'
    );
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
    expect(await token.balanceOf(addr)).to.be.bignumber.equal(token_balance);
    expect(await currency.balanceOf(addr)).to.be.bignumber.equal(
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
    const buy = await swap.getBuyOrder(
      token.address,
      currency.address,
      priceRatio,
      0
    );
    console.log('buy_order: 0: qty:', feth(buy.quantity));
    const sell = await swap.getSellOrder(
      token.address,
      currency.address,
      priceRatio,
      0
    );
    console.log('sell_order: 0: qty:', feth(sell.quantity));
  }
  async function _dumpFeeBalance(contracts) {
    const { swap, currency, token } = contracts;
    console.log('fee.currency:', feth(await swap.feeBalance(currency.address)));
    console.log('fee.token:', feth(await swap.feeBalance(token.address)));
  }
});
