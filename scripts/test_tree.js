'use strict';

const async = require('async');
const BN = require('bn.js');
const Common = require('ethereumjs-common').default;
const Blockchain = require('ethereumjs-blockchain').default;
const EthUtil = require('ethereumjs-util');
const Account = require('ethereumjs-account').default;
const mainnetGenesisState = require('ethereumjs-common/dist/genesisStates/mainnet');
const VM = require('ethereumjs-vm').default;
const StateManager = require('ethereumjs-vm/dist/state/stateManager').default;
const rlp = require('rlp');
const Block = require('ethereumjs-block');
const level = require('level');
const fs = require('fs');
const argv = require('yargs').argv;
const Trie = require('merkle-patricia-tree/secure.js');

const stateTrie = new Trie();
const common = new Common('mainnet');

const BUFFER_MIN = 10000000;
const READ_LEN = BUFFER_MIN * 2;
const PERIODIC_PRINT = 60 * 1000;

const input_file = argv._[0];

console.error('input file:', input_file);

const read_buffer = Buffer.allocUnsafe(READ_LEN);
const fd = fs.openSync(input_file, 'r');
if (!fd) {
  console.error('failed to open file:', input_file);
  process.exit(-1);
}
const bytes_read = fs.readSync(fd, read_buffer, 0, READ_LEN, null);

let remainder;
if (bytes_read === 0) {
  console.error('no bytes read form file.');
  process.exit(-2);
} else {
  // omg i fucking hate node
  remainder = Buffer.concat([read_buffer], bytes_read);
}

function _updateRemainder() {
  let ret;
  if (remainder.length > 0) {
    try {
      const rlp_ret = rlp.decode(remainder, true);
      if (rlp_ret.data.length > 0) {
        remainder = rlp_ret.remainder;
        ret = rlp_ret.data;
      }
    } catch (e) {
      console.error('rlp.decode threw:', e);
    }
  }

  return ret;
}

let really_done = false;
let file_done = false;
const generateRlpBlock = {
  // LOL
  [Symbol.toStringTag]: 'AsyncGenerator',
  next: () =>
    new Promise((resolve, reject) => {
      if (really_done) {
        resolve({ done: true });
      } else if (remainder.length === 0 && file_done) {
        resolve({ done: true });
      } else if (remainder.length > BUFFER_MIN || file_done) {
        const data = _updateRemainder();
        if (data) {
          resolve({ value: data });
        } else {
          resolve({ done: true });
        }
      } else {
        fs.read(fd, read_buffer, 0, READ_LEN, null, (err, bytes_read) => {
          if (err) {
            console.error('file read error:', err);
            reject(err);
          } else {
            if (bytes_read === 0) {
              file_done = true;
            } else {
              remainder = Buffer.concat(
                [remainder, read_buffer],
                remainder.length + bytes_read
              );
            }

            const data = _updateRemainder();
            if (data) {
              resolve({ value: data });
            } else {
              resolve({ done: true });
            }
          }
        });
      }
    }),
};

const hardfork = common.activeHardfork(0);
const block_common = new Common('mainnet', hardfork);

let lastStateRoot;

async.eachLimit(
  generateRlpBlock,
  1,
  (data, done) => {
    const block_number = _getInt(data[0][8]);
    const hardfork = common.activeHardfork(block_number);
    const block_common = new Common('mainnet', hardfork);
    const b = new Block(data, { common: block_common });

    console.error('');
    console.error('block_number:', block_number);
    console.error('stateRoot:', b.header.stateRoot.toString('hex'));
    console.error(
      'transactionsTrie:',
      b.header.transactionsTrie.toString('hex')
    );
    console.error('receiptTrie:', b.header.receiptTrie.toString('hex'));
    console.error('coinbase:', b.header.coinbase.toString('hex'));

    lastStateRoot = b.header.stateRoot.toString('hex');

    _runBlock({ block: b, block_number }, err => {
      const root_s = stateTrie.root.toString('hex');
      console.error('stateTrie.root:', root_s);
      done();
    });
  },
  err => {
    const s = stateTrie.createReadStream();
    s.on('data', ({ key, value }) => {
      const account = new Account(value);
      console.log(
        key.toString('hex'),
        new BN(account.nonce).toNumber(),
        new BN(account.balance).toString(),
        account.stateRoot.toString('hex'),
        account.codeHash.toString('hex')
      );
    });

    console.error('');
    console.error('done done');
    console.error('');
  }
);

function _runBlock(params, done) {
  const { block, block_number } = params;
  async.series(
    [
      done => {
        if (block_number === 0) {
          _runGenesis(done);
        } else {
          done();
        }
      },
      done => {
        if (block_number > 0) {
          _rewardCoinbase(params, done);
        } else {
          done();
        }
      },
      done => {
        _rewardUncles(block, done);
      },
    ],
    done
  );
}
function _runGenesis(done) {
  const key_list = Object.keys(mainnetGenesisState);
  async.eachSeries(
    key_list,
    (key, done) => {
      try {
        const addr = key.slice(2);
        const account = new Account();
        const val = mainnetGenesisState[key];
        if (val.slice(0, 2) !== '0x') {
          console.error('wtf');
        }
        account.balance = new BN(val.slice(2), 16).toArrayLike(Buffer);
        const addressBuffer = EthUtil.toBuffer(key);
        stateTrie.put(addressBuffer, account.serialize(), () => {
          done();
        });
      } catch (e) {
        console.error(e.stack);
      }
    },
    done
  );
}

function _rewardCoinbase(params, done) {
  const { block, block_number } = params;
  const reward = new BN(
    common.paramByBlock('pow', 'minerReward', block_number)
  );
  const uncle_count = block.uncleHeaders ? block.uncleHeaders.length : 0;
  if (uncle_count) {
    console.error('uncles:', uncle_count);
    const uncle_reward = reward.divn(32);
    uncle_reward.imultn(uncle_count);
    reward.iadd(uncle_reward);
  }
  console.error('block.coinbase:', block.header.coinbase);
  _rewardAccount(block.header.coinbase, reward, done);
}
function _rewardUncles(block, done) {
  done();
}

function _rewardAccount(addr, amount, done) {
  stateTrie.get(addr, (err, serialized) => {
    let account;
    if (err) {
      console.error('_rewardAccount: get err:', err);
    } else if (serialized) {
      account = new Account(serialized);
      const old_balance = new BN(account.balance);
      account.balance = old_balance.iadd(amount);
    } else {
      account = new Account();
      account.balance = amount.toArrayLike(Buffer);
    }
    console.error(
      'put:',
      addr,
      new BN(account.nonce).toNumber(),
      new BN(account.balance).toString(),
      account.stateRoot.toString('hex'),
      account.codeHash.toString('hex')
    );
    stateTrie.put(addr, account.serialize(), done);
  });
}

function _getInt(buf) {
  let ret = 0;
  if (buf.length > 6) {
    ret = new BN(buf);
  } else if (buf.length > 0) {
    ret = buf.readUIntBE(0, buf.length);
  }
  return ret;
}
