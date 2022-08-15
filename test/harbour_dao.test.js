const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const {
  balance,
  BN,
  ether,
  time,
  constants,
  expectEvent,
  expectRevert: baseExpectRevert,
} = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ZERO_ADDRESS, MAX_UINT256 } = constants;

const VOTE_YES = 1;
const VOTE_NO = 0;
const RESULT_YES = '1';
const RESULT_NO = '2';
const RESULT_MAP = {
  0: 'Null',
  [RESULT_YES]: 'Yes',
  [RESULT_NO]: 'No',
};
const PROPOSAL_VOTE = 1;
const PROPOSAL_MINT = 2;
const PROPOSAL_GRANT = 3;
const PROPOSAL_UPDATE = 4;

const TokenContract = contract.fromArtifact('HarbourTrackedTokenMintable');
const DAO = contract.fromArtifact('HarbourDAO');

function expectRevert(...args) {
  return baseExpectRevert.unspecified(...args);
}

function printGas(prefix, tx) {
  console.log('>', prefix, 'gas:', tx?.receipt?.gasUsed?.toLocaleString());
}

const QUORUM_BPS = 10;

describe('HarbourDAO', function () {
  const [voter1, voter2, voter3, voter4, voter5, recipient, anotherAccount] =
    accounts;

  beforeEach(async function () {
    this.token = await TokenContract.new('My Token', 'MTKN');
    await Promise.all([
      this.token.mint(voter1, new BN(100)),
      this.token.mint(voter2, new BN(60)),
      this.token.mint(voter3, new BN(50)),
    ]);
    this.dao = await DAO.new(
      this.token.address,
      1,
      QUORUM_BPS,
      ZERO_ADDRESS,
      0
    );
    await this.token.addMinter(this.dao.address);
  });

  it('simple vote', async function () {
    const start = Math.floor(await time.latest()) + 60;
    const tx = await this.dao.submitProposal(
      start,
      start + 60,
      start + 120,
      'vote',
      PROPOSAL_VOTE,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      0,
      0,
      ZERO_ADDRESS,
      0
    );
    printGas('submit', tx);
    await time.increaseTo(start);
    const [vtx1, vtx2, vtx3] = await Promise.all([
      this.dao.submitVote(1, VOTE_YES, { from: voter1 }),
      this.dao.submitVote(1, VOTE_YES, { from: voter2 }),
      this.dao.submitVote(1, VOTE_YES, { from: voter3 }),
    ]);
    printGas('vote1', vtx1);
    printGas('vote2', vtx2);
    printGas('vote3', vtx3);
    await time.increaseTo(start + 121);
    const validate_tx = await this.dao.validateVoteList(1, [
      voter1,
      voter2,
      voter3,
    ]);
    printGas('validateVoteList', validate_tx);
    const process_tx = await this.dao.processProposal(1);
    printGas('processProposal', process_tx);
    await _dumpProposal(this, 1);
    const proposal = await this.dao.proposals(1);
    expect(proposal.complete).to.be.true;
    expect(proposal.result).to.be.bignumber.equal(RESULT_YES);
    expect(proposal.executed).to.be.false;
  });
  it('simple grant', async function () {
    const start = Math.floor(await time.latest()) + 60;
    const tx = await this.dao.submitProposal(
      start,
      start + 60,
      start + 120,
      'grant',
      PROPOSAL_GRANT,
      recipient,
      ZERO_ADDRESS,
      ether('1'),
      0,
      ZERO_ADDRESS,
      0,
      { value: ether('1') }
    );
    await time.increaseTo(start);
    expect(
      await balance.current(this.dao.address, 'ether')
    ).to.be.bignumber.equal('1');
    await Promise.all([
      this.dao.submitVote(1, VOTE_YES, { from: voter1 }),
      this.dao.submitVote(1, VOTE_YES, { from: voter2 }),
      this.dao.submitVote(1, VOTE_YES, { from: voter3 }),
    ]);
    await time.increaseTo(start + 121);
    await this.dao.validateVoteList(1, [voter1, voter2, voter3]);
    await this.dao.processProposal(1);
    await _dumpProposal(this, 1);
    const proposal = await this.dao.proposals(1);
    expect(proposal.complete).to.be.true;
    expect(proposal.result).to.be.bignumber.equal(RESULT_YES);
    expect(proposal.executed).to.be.false;
    expect(await balance.current(recipient, 'ether')).to.be.bignumber.equal(
      '100'
    );

    const execute_tx = await this.dao.executeGrantProposal(1);
    printGas('executeGrantProposal', execute_tx);
    expect(
      await balance.current(this.dao.address, 'ether')
    ).to.be.bignumber.equal('0');
    expect(await balance.current(recipient, 'ether')).to.be.bignumber.equal(
      '101'
    );
  });
  it('simple mint', async function () {
    const start = Math.floor(await time.latest()) + 60;
    const tx = await this.dao.submitProposal(
      start,
      start + 60,
      start + 120,
      'mint',
      PROPOSAL_MINT,
      recipient,
      this.token.address,
      10,
      0,
      ZERO_ADDRESS,
      0
    );
    await time.increaseTo(start);
    await Promise.all([
      this.dao.submitVote(1, VOTE_YES, { from: voter1 }),
      this.dao.submitVote(1, VOTE_YES, { from: voter2 }),
      this.dao.submitVote(1, VOTE_YES, { from: voter3 }),
    ]);
    await time.increaseTo(start + 121);
    await this.dao.validateVoteList(1, [voter1, voter2, voter3]);
    await this.dao.processProposal(1);
    await _dumpProposal(this, 1);
    const proposal = await this.dao.proposals(1);
    expect(proposal.complete).to.be.true;
    expect(proposal.result).to.be.bignumber.equal(RESULT_YES);
    expect(proposal.executed).to.be.false;
    expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal('0');

    const execute_tx = await this.dao.executeMintProposal(1);
    printGas('executeMintProposal', execute_tx);
    expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal('10');
  });

  describe('Voting', async function () {
    beforeEach(async function () {
      this.start_ts = Math.floor(await time.latest()) + 60;
      const tx = await this.dao.submitProposal(
        this.start_ts,
        this.start_ts + 60,
        this.start_ts + 120,
        'vote',
        PROPOSAL_VOTE,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        0,
        0,
        ZERO_ADDRESS,
        0
      );
      await time.increaseTo(this.start_ts);
    });
    it('vote no', async function () {
      await Promise.all([
        this.dao.submitVote(1, VOTE_YES, { from: voter1 }),
        this.dao.submitVote(1, VOTE_NO, { from: voter2 }),
        this.dao.submitVote(1, VOTE_NO, { from: voter3 }),
      ]);
      await _complete(this, [voter1, voter2, voter3]);
      await _dumpProposal(this, 1);
      const proposal = await this.dao.proposals(1);
      expect(proposal.complete).to.be.true;
      expect(proposal.result).to.be.bignumber.equal(RESULT_NO);
      expect(proposal.executed).to.be.false;
    });
    it('vote yes - invalidate voter3', async function () {
      await Promise.all([
        this.dao.submitVote(1, VOTE_YES, { from: voter1 }),
        this.dao.submitVote(1, VOTE_NO, { from: voter2 }),
        this.dao.submitVote(1, VOTE_NO, { from: voter3 }),
      ]);
      await this.token.transfer(voter1, 1, { from: voter3 });
      await _complete(this, [voter1, voter2, voter3]);
      await _dumpProposal(this, 1);
      const proposal = await this.dao.proposals(1);
      expect(proposal.complete).to.be.true;
      expect(proposal.result).to.be.bignumber.equal(RESULT_YES);
      expect(proposal.executed).to.be.false;
    });
    it('vote no - lots of bad yes', async function () {
      await Promise.all([
        this.dao.submitVote(1, VOTE_YES, { from: voter1 }),
        this.dao.submitVote(1, VOTE_NO, { from: voter2 }),
        this.dao.submitVote(1, VOTE_NO, { from: voter3 }),
      ]);
      await this.token.transfer(voter4, 100, { from: voter1 });
      await this.dao.submitVote(1, VOTE_YES, { from: voter4 });
      await this.token.transfer(voter5, 100, { from: voter4 });
      await this.dao.submitVote(1, VOTE_YES, { from: voter5 });
      await _complete(this, [voter1, voter2, voter3]);
      await _dumpProposal(this, 1);
      const proposal = await this.dao.proposals(1);
      expect(proposal.complete).to.be.true;
      expect(proposal.result).to.be.bignumber.equal(RESULT_NO);
      expect(proposal.executed).to.be.false;
    });
    it('vote yes - lots of bad no', async function () {
      await Promise.all([
        this.dao.submitVote(1, VOTE_NO, { from: voter1 }),
        this.dao.submitVote(1, VOTE_NO, { from: voter2 }),
        this.dao.submitVote(1, VOTE_YES, { from: voter3 }),
      ]);
      await this.token.transfer(voter4, 100, { from: voter1 });
      await this.dao.submitVote(1, VOTE_NO, { from: voter4 });
      await this.token.transfer(voter1, 100, { from: voter4 });

      await this.token.transfer(voter5, 60, { from: voter2 });
      await this.dao.submitVote(1, VOTE_NO, { from: voter5 });
      await this.token.transfer(voter2, 60, { from: voter5 });

      await _complete(this, [voter1, voter2, voter3, voter4, voter5]);
      await _dumpProposal(this, 1);
      const proposal = await this.dao.proposals(1);
      expect(proposal.complete).to.be.true;
      expect(proposal.result).to.be.bignumber.equal(RESULT_YES);
      expect(proposal.executed).to.be.false;
    });
    it('vote yes - lots of bad yes', async function () {
      await Promise.all([
        this.dao.submitVote(1, VOTE_YES, { from: voter1 }),
        this.dao.submitVote(1, VOTE_NO, { from: voter2 }),
      ]);
      await this.token.transfer(voter4, 100, { from: voter1 });
      await this.dao.submitVote(1, VOTE_YES, { from: voter4 });
      await this.token.transfer(voter5, 100, { from: voter4 });
      await this.dao.submitVote(1, VOTE_YES, { from: voter5 });

      await _complete(this, [voter1, voter2, voter4, voter5]);
      await _dumpProposal(this, 1);
      const proposal = await this.dao.proposals(1);
      expect(proposal.complete).to.be.true;
      expect(proposal.result).to.be.bignumber.equal(RESULT_YES);
      expect(proposal.executed).to.be.false;
    });
    it('vote yes - lots of bad no, min validate', async function () {
      await Promise.all([
        this.dao.submitVote(1, VOTE_NO, { from: voter1 }),
        this.dao.submitVote(1, VOTE_YES, { from: voter2 }),
        this.dao.submitVote(1, VOTE_YES, { from: voter3 }),
      ]);
      await this.token.transfer(voter4, 100, { from: voter1 });
      await this.dao.submitVote(1, VOTE_NO, { from: voter4 });
      await this.token.transfer(voter5, 100, { from: voter4 });
      await this.dao.submitVote(1, VOTE_NO, { from: voter5 });
      await this.token.transfer(voter1, 100, { from: voter5 });

      await _complete(this, [voter2, voter3]);
      await _dumpProposal(this, 1);
      const proposal = await this.dao.proposals(1);
      expect(proposal.complete).to.be.true;
      expect(proposal.result).to.be.bignumber.equal(RESULT_YES);
      expect(proposal.executed).to.be.false;
    });
  });
});

async function _complete(that, voters) {
  await time.increaseTo(that.start_ts + 121);
  await that.dao.validateVoteList(1, voters);
  await that.dao.processProposal(1);
}
async function _dumpProposal(that, index) {
  const proposal = await that.dao.proposals(1);
  const {
    details,
    totalVotes,
    invalidCount,
    executed,
    complete,
    proposalType,
  } = proposal;
  const result = RESULT_MAP[proposal.result.toNumber()];
  console.log(
    '> proposal:',
    index,
    details,
    'totalVotes:',
    totalVotes.toNumber(),
    'invalidCount:',
    invalidCount.toNumber(),
    'complete:',
    complete,
    'result:',
    result
  );
}
