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

const HarbourBurnMint = contract.fromArtifact('HarbourBurnMint');
const HarbourNFT = contract.fromArtifact('HarbourNFT');

const ZERO = '0x0000000000000000000000000000000000000000';
const TOKENS = [1, 2, 101, 102];

describe('HarbourBurnMint', function () {
  const [owner, user, redeemAdmin, royalty, user2] = accounts;
  this.timeout(30 * 1000);

  beforeEach(async () => {
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

    this.reward = await HarbourNFT.new(
      'Reward',
      'REW',
      '',
      '',
      royalty,
      1000,
      1000,
      1000,
      { from: owner }
    );
    this.redeem = await HarbourBurnMint.new({ from: owner });

    await this.token.mintWithTokenURI(user, 1, 'ipfs://foobar', {
      from: owner,
    });
    await this.token.mintWithTokenURI(user2, 2, 'ipfs://foobar2', {
      from: owner,
    });

    await this.redeem.addAdmin(redeemAdmin, { from: owner });
    await this.token.addMinter(this.redeem.address, { from: owner });
  });

  it('simple approve', async () => {
    const { token, reward, redeem } = this;

    await _dumpOwnerTokens(this);

    const set = await redeem.setRedeem(
      token.address,
      1,
      token.address,
      101,
      'ipfs://barbar',
      {
        from: redeemAdmin,
      }
    );
    console.log('set gasUsed:', set.receipt.gasUsed);

    const approve = await this.token.approve(redeem.address, 1, { from: user });
    console.log('approve gasUsed:', approve.receipt.gasUsed);
    const take = await redeem.redeem(token.address, 1, '0xf00f', {
      from: user,
    });
    console.log('take gasUsed:', take.receipt.gasUsed);

    await _dumpOwnerTokens(this);
  });

  it('simple transfer', async () => {
    const { token, reward, redeem } = this;

    await _dumpOwnerTokens(this);

    const set = await redeem.setRedeem(
      token.address,
      1,
      token.address,
      101,
      'ipfs://barbar2',
      {
        from: redeemAdmin,
      }
    );
    console.log('set gasUsed:', set.receipt.gasUsed);

    const send_take = await token.methods[
      'safeTransferFrom(address,address,uint256,bytes)'
    ](user, redeem.address, 1, '0xf00f', {
      from: user,
    });
    console.log('send_take gasUsed:', send_take.receipt.gasUsed);

    await _dumpOwnerTokens(this);
  });

  it('double', async () => {
    const { token, reward, redeem } = this;

    await _dumpOwnerTokens(this);

    const set = await redeem.setRedeem(
      token.address,
      1,
      token.address,
      101,
      'ipfs://barbar2',
      {
        from: redeemAdmin,
      }
    );
    console.log('set gasUsed:', set.receipt.gasUsed);
    const set2 = await redeem.setRedeem(
      token.address,
      2,
      token.address,
      102,
      'ipfs://barbar3',
      {
        from: redeemAdmin,
      }
    );
    console.log('set2 gasUsed:', set2.receipt.gasUsed);

    const send_take = await token.methods[
      'safeTransferFrom(address,address,uint256,bytes)'
    ](user, redeem.address, 1, '0xf00f', {
      from: user,
    });
    console.log('send_take gasUsed:', send_take.receipt.gasUsed);

    const send_take2 = await token.methods[
      'safeTransferFrom(address,address,uint256,bytes)'
    ](user2, redeem.address, 2, '0xf00f', {
      from: user2,
    });
    console.log('send_take2 gasUsed:', send_take2.receipt.gasUsed);

    await _dumpOwnerTokens(this);
  });

  it('multi transfer', async () => {
    const { token, reward, redeem } = this;

    await _dumpOwnerTokens(this);

    const set = await redeem.setRedeemMultiple(
      token.address,
      1,
      token.address,
      101,
      'ipfs://barbar3',
      20,
      {
        from: redeemAdmin,
      }
    );
    console.log('set gasUsed:', set.receipt.gasUsed);

    const send_take = await token.methods[
      'safeTransferFrom(address,address,uint256,bytes)'
    ](user, redeem.address, 1, '0xf00f', {
      from: user,
    });
    console.log('send_take gasUsed:', send_take.receipt.gasUsed);

    const send_take2 = await token.methods[
      'safeTransferFrom(address,address,uint256,bytes)'
    ](user2, redeem.address, 2, '0xf00f', {
      from: user2,
    });
    console.log('send_take2 gasUsed:', send_take2.receipt.gasUsed);

    await _dumpOwnerTokens(this);
  });

  it('error not owner', async () => {
    const { token, reward, redeem } = this;

    await _dumpOwnerTokens(this);

    const set = await redeem.setRedeem(
      token.address,
      1,
      token.address,
      101,
      'ipfs://barbar2',
      {
        from: redeemAdmin,
      }
    );
    console.log('set gasUsed:', set.receipt.gasUsed);

    const approve = await this.token.approve(redeem.address, 1, { from: user });
    console.log('approve gasUsed:', approve.receipt.gasUsed);

    const take = redeem.redeem(token.address, 1, '0xf00f', {
      from: user2,
    });
    await expectRevert(take, 'not_owner');
    await _dumpOwnerTokens(this);
  });

  async function _dumpOwnerTokens(that) {
    const user_map = await _getTokenMap(that, user);
    const user2_map = await _getTokenMap(that, user2);
    console.log('user tokens:', user_map);
    console.log('user2 tokens:', user2_map);
  }
  async function _getTokenMap(that, address) {
    const { token, reward, redeem } = that;
    const owners = await Promise.all(
      TOKENS.map((tokenId) => noReject(token.ownerOf(tokenId)))
    );
    const user_tokens = [];
    owners.forEach((owner, i) => {
      if (owner === address) {
        user_tokens.push(TOKENS[i]);
      }
    });
    const uris = await Promise.all(
      user_tokens.map((tokenId) => token.tokenURI(tokenId))
    );
    const token_map = {};
    user_tokens.forEach((tokenId, i) => {
      token_map[tokenId] = uris[i];
    });
    return token_map;
  }
});

function noReject(promise) {
  return new Promise((resolve) => {
    promise.then(
      (result) => resolve(result),
      (err) => resolve()
    );
  });
}
