pragma solidity ^0.8.16;

// SPDX-License-Identifier: MIT

interface IERC20 {
  function totalSupply() external view returns (uint256);

  function balanceOf(address account) external view returns (uint256);

  function allowance(address owner, address spender)
    external
    view
    returns (uint256);

  function transfer(address recipient, uint256 amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);

  function mint(address account, uint256 amount) external returns (bool);
}

interface ITrackedToken is IERC20 {
  function lastSendBlockOf(address account) external view returns (uint256);
}

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

contract HarbourDAO {
  uint256 public constant MAX_FUTURE_TIME = 30 * 24 * 60 * 60;
  IERC20 constant ZERO_ERC20 = IERC20(address(0));
  enum Vote {
    Null,
    Yes,
    No
  }
  enum ProposalType {
    Null,
    GenericVote,
    Mint,
    Grant,
    Update
  }
  struct ProposalVote {
    Vote vote;
    bool processed;
    bool invalid;
    uint48 blockNumber;
    uint256 voteCount;
  }
  struct Proposal {
    string details;
    uint256 voterCount;
    uint256 totalVotes;
    uint256 validatedYesCount;
    uint256 validatedNoCount;
    uint256 invalidCount;
    mapping(address => ProposalVote) votesByVoter;
    uint48 startTime;
    uint48 endTime;
    uint48 resolveTime;
    Vote result;
    bool complete;
    bool executed;
    ProposalType proposalType;
    IERC20 resultToken;
    address payable resultAddress;
    uint256 resultAmount;
    uint256 newQuorumBps;
    IERC20 newFeeToken;
    uint256 newFeeAmount;
  }
  event SubmitProposal(
    uint256 indexed proposalIndex,
    address indexed proposer,
    uint48 indexed startTime,
    uint48 endTime
  );
  event SubmitVote(
    uint256 indexed proposalIndex,
    address indexed voter,
    uint256 voteCount,
    bool yes
  );
  event ValidateVote(
    uint256 indexed proposalIndex,
    address indexed voter,
    uint256 voteCount,
    bool yes
  );
  event ProcessProposal(uint256 indexed proposalIndex, bool yes);
  event Update(
    uint256 newQuorumBps,
    IERC20 newProposalFeeToken,
    uint256 newProposalFeeAmount
  );
  event Grant(
    IERC20 indexed resultToken,
    address indexed resultAddress,
    uint256 resultAmount
  );
  event Mint(
    IERC20 indexed resultToken,
    address indexed resultAddress,
    uint256 resultAmount
  );

  ITrackedToken public voteToken;
  mapping(uint256 => Proposal) public proposals;
  uint256 public proposalCount;
  uint256 public quorumBps;
  uint256 public feeAmount;
  IERC20 public feeToken;
  uint48 public minVoteTime;

  constructor(
    address token,
    uint48 newMinVoteTime,
    uint256 newQuorumBps,
    IERC20 newFeeToken,
    uint256 newFeeAmount
  ) {
    voteToken = ITrackedToken(token);
    minVoteTime = newMinVoteTime;
    quorumBps = newQuorumBps;
    feeToken = newFeeToken;
    feeAmount = newFeeAmount;
  }

  function submitProposal(
    uint48 startTime,
    uint48 endTime,
    uint48 resolveTime,
    string calldata details,
    ProposalType proposalType,
    address payable resultAddress,
    IERC20 resultToken,
    uint256 resultAmount,
    uint256 newQuorumBps,
    IERC20 newFeeToken,
    uint256 newFeeAmount
  ) public payable returns (uint256) {
    require(startTime > block.timestamp, 'invalid_start_time');
    require(endTime - startTime > minVoteTime, 'invalid_end_time');
    require(resolveTime > endTime, 'invalid_resolve_time');
    require(resolveTime < block.timestamp + MAX_FUTURE_TIME, 'resolve_too_far');
    require(proposalType > ProposalType.Null, 'invalid_proposal_type');

    if (feeAmount > 0) {
      if (feeToken == ZERO_ERC20) {
        require(msg.value >= feeAmount, 'invalid_deposit');
      } else {
        feeToken.transferFrom(msg.sender, address(this), feeAmount);
      }
    }

    uint256 proposalIndex = proposalCount += 1;
    Proposal storage proposal = proposals[proposalIndex];
    proposal.startTime = startTime;
    proposal.endTime = endTime;
    proposal.resolveTime = resolveTime;
    proposal.details = details;
    proposal.proposalType = proposalType;
    if (
      proposalType == ProposalType.Mint || proposalType == ProposalType.Grant
    ) {
      proposal.resultToken = resultToken;
      proposal.resultAddress = resultAddress;
      proposal.resultAmount = resultAmount;
    } else if (proposalType == ProposalType.Update) {
      proposal.newQuorumBps = newQuorumBps;
      proposal.newFeeToken = newFeeToken;
      proposal.newFeeAmount = newFeeAmount;
      if (newFeeToken != feeToken) {
        if (newFeeToken == ZERO_ERC20) {
          require(msg.value >= newFeeAmount, 'invalid_update');
        } else {
          newFeeToken.transferFrom(msg.sender, address(this), newFeeAmount);
        }
      } else if (newFeeAmount > feeAmount) {
        if (newFeeToken == ZERO_ERC20) {
          require(msg.value >= newFeeAmount, 'invalid_update');
        } else {
          newFeeToken.transferFrom(
            msg.sender,
            address(this),
            newFeeAmount - feeAmount
          );
        }
      }
    }
    emit SubmitProposal(proposalIndex, msg.sender, startTime, endTime);
    return proposalIndex;
  }

  function isVotingActive(uint256 proposalIndex) public view returns (bool) {
    Proposal storage proposal = proposals[proposalIndex];
    bool active = true;
    if (block.timestamp < proposal.startTime) {
      active = false;
    } else if (block.timestamp > proposal.endTime) {
      active = false;
    }
    return active;
  }

  function isResolvingActive(uint256 proposalIndex) public view returns (bool) {
    Proposal storage proposal = proposals[proposalIndex];
    return block.timestamp > proposal.resolveTime;
  }

  function submitVote(uint256 proposalIndex, bool yes) public {
    require(isVotingActive(proposalIndex), 'voting_not_active');
    uint256 voteCount = voteToken.balanceOf(msg.sender);
    require(voteCount > 0, 'zero_balance');

    Proposal storage proposal = proposals[proposalIndex];
    ProposalVote storage vote = proposal.votesByVoter[msg.sender];
    if (vote.voteCount == 0) {
      proposal.voterCount += 1;
      proposal.totalVotes += voteCount;
    } else if (vote.voteCount != voteCount) {
      proposal.totalVotes -= vote.voteCount;
      proposal.totalVotes += voteCount;
    }
    vote.vote = yes ? Vote.Yes : Vote.No;
    vote.blockNumber = uint48(block.number);
    vote.voteCount = voteCount;
    emit SubmitVote(proposalIndex, msg.sender, voteCount, yes);
  }

  function _validateVote(uint256 proposalIndex, address voter)
    internal
    returns (bool)
  {
    Proposal storage proposal = proposals[proposalIndex];
    ProposalVote storage vote = proposal.votesByVoter[voter];
    if (vote.voteCount > 0 && !vote.processed) {
      uint256 balance = voteToken.balanceOf(voter);
      uint256 lastSendBlock = voteToken.lastSendBlockOf(voter);
      if (lastSendBlock < vote.blockNumber && balance >= vote.voteCount) {
        if (vote.vote == Vote.Yes) {
          proposal.validatedYesCount += vote.voteCount;
          emit ValidateVote(proposalIndex, voter, vote.voteCount, true);
        } else {
          proposal.validatedNoCount += vote.voteCount;
          emit ValidateVote(proposalIndex, voter, vote.voteCount, false);
        }
      } else {
        proposal.invalidCount += vote.voteCount;
        vote.invalid = true;
        emit ValidateVote(proposalIndex, voter, 0, false);
      }
      vote.processed = true;
    }
    return vote.processed;
  }

  function checkVote(uint256 proposalIndex, address voter)
    public
    view
    returns (bool, uint256)
  {
    Proposal storage proposal = proposals[proposalIndex];
    ProposalVote storage vote = proposal.votesByVoter[voter];
    uint256 balance = voteToken.balanceOf(voter);
    uint256 lastSendBlock = voteToken.lastSendBlockOf(voter);
    bool valid = lastSendBlock < vote.blockNumber && balance >= vote.voteCount;
    return (valid, vote.voteCount);
  }

  function validateVote(uint256 proposalIndex, address voter)
    public
    returns (bool)
  {
    require(isResolvingActive(proposalIndex), 'voting_not_closed');
    Proposal storage proposal = proposals[proposalIndex];
    ProposalVote storage vote = proposal.votesByVoter[voter];
    require(vote.voteCount > 0, 'no_votes');
    require(!vote.processed, 'already_processed');
    return _validateVote(proposalIndex, voter);
  }

  function validateVoteList(uint256 proposalIndex, address[] calldata list)
    public
  {
    require(isResolvingActive(proposalIndex), 'voting_not_closed');
    uint256 count = list.length;
    for (uint256 i = 0; i < count; i++) {
      _validateVote(proposalIndex, list[i]);
    }
  }

  function _min(uint256 a, uint256 b) internal pure returns (uint256) {
    return a < b ? a : b;
  }

  function processProposal(uint256 proposalIndex) public returns (Vote) {
    require(isResolvingActive(proposalIndex), 'voting_not_closed');
    Proposal storage proposal = proposals[proposalIndex];
    require(!proposal.complete, 'already_complete');

    uint256 totalValid = proposal.validatedYesCount + proposal.validatedNoCount;
    uint256 totalSupply = voteToken.totalSupply();
    require(totalValid >= (totalSupply * quorumBps) / 1000, 'no_quorum');

    uint256 validCount = proposal.totalVotes - proposal.invalidCount;
    validCount = _min(validCount, totalSupply);

    Vote result;
    if (proposal.validatedYesCount * 2 > validCount) {
      result = Vote.Yes;
    } else if (proposal.validatedNoCount * 2 > validCount) {
      result = Vote.No;
    } else {
      revert('not_determined');
    }

    proposal.result = result;
    proposal.complete = true;
    emit ProcessProposal(proposalIndex, result == Vote.Yes);
    return proposal.result;
  }

  function executeUpdateProposal(uint256 proposalIndex) public {
    Proposal storage proposal = proposals[proposalIndex];
    require(proposal.complete, 'not_complete');
    require(!proposal.executed, 'already_executed');
    require(proposal.proposalType == ProposalType.Update, 'not_update');
    proposal.executed = true;
    quorumBps = proposal.newQuorumBps;
    feeToken = proposal.newFeeToken;
    feeAmount = proposal.newFeeAmount;
    emit Update(quorumBps, feeToken, feeAmount);
  }

  function executeGrantProposal(uint256 proposalIndex) public {
    Proposal storage proposal = proposals[proposalIndex];
    require(proposal.complete, 'not_complete');
    require(!proposal.executed, 'already_executed');
    require(proposal.proposalType == ProposalType.Grant, 'not_grant');
    proposal.executed = true;
    if (proposal.resultToken == ZERO_ERC20) {
      // solhint-disable-next-line avoid-low-level-calls
      (bool success, ) = proposal.resultAddress.call{
        value: proposal.resultAmount
      }('');
      require(success, 'tx_failed');
    } else {
      proposal.resultToken.transferFrom(
        address(this),
        proposal.resultAddress,
        proposal.resultAmount
      );
    }
    emit Grant(
      proposal.resultToken,
      proposal.resultAddress,
      proposal.resultAmount
    );
  }

  function executeMintProposal(uint256 proposalIndex) public {
    Proposal storage proposal = proposals[proposalIndex];
    require(proposal.complete, 'not_complete');
    require(!proposal.executed, 'already_executed');
    require(proposal.proposalType == ProposalType.Mint, 'not_mint');
    proposal.executed = true;
    proposal.resultToken.mint(proposal.resultAddress, proposal.resultAmount);
    emit Mint(
      proposal.resultToken,
      proposal.resultAddress,
      proposal.resultAmount
    );
  }

  function getProposalVote(uint256 proposalIndex, address voter)
    public
    view
    returns (ProposalVote memory)
  {
    Proposal storage proposal = proposals[proposalIndex];
    return proposal.votesByVoter[voter];
  }

  function getProposalResult(uint256 proposalIndex) public view returns (Vote) {
    Proposal storage proposal = proposals[proposalIndex];
    return proposal.result;
  }

  function getProposalVoterCount(uint256 proposalIndex)
    public
    view
    returns (uint256)
  {
    Proposal storage proposal = proposals[proposalIndex];
    return proposal.voterCount;
  }
}
