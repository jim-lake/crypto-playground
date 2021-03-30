const ethers = require('ethers');
const AppConfig = require('../config.json');
const config = require('../config.json');
const erc721_abi = require('../contracts/erc721_union_abi.json');
const web3 = require('web3');
const argv = process.argv.slice(2);

const erc721_interface = new ethers.utils.Interface(erc721_abi);

const { getAddress } = ethers.utils;

if (argv.length < 1) {
  console.log(`Usage: ${process.argv[1]} <contract_addr> [erc721|erc20]`);
  process.exit(-1);
}

const contract_addr = argv[0].toLowerCase();

const is_erc721 = argv[1] === 'erc721';
const is_erc20 = argv[1] === 'erc20';

const LIMIT = 9999;
const DAY = 24 * 60 * 60;
const etherscanProvider = new ethers.providers.EtherscanProvider();

getContractStats();

let first_time = Date.now();
let last_time = 0;
let tx_count = 0;
const from_map = {};
const tx_map = {};
const data_map = {};
const unknown_sighash = {};
const function_calls = {};
const burned_tokens = {};
const live_tokens = {};
const mint_tokens = {};
const operator_map = {};
const minters = {};
const token_holders = {};
const burners = {};
const mint_dests = {};
let transfer_count = 0;
let mint_count = 0;
let burn_count = 0;
let funding_total = 0;

async function getContractStats() {
  try {
    let start_block = 0;
    for (let i = 0; i < LIMIT; i++) {
      console.log('');
      console.error(
        `fetch(${i}): addr:`,
        contract_addr,
        'start_block:',
        start_block
      );

      const history = await _getHistory(contract_addr, start_block, 'latest');
      console.error('got:', history.length);

      let process_count = 0;
      if (history && history.length > 0) {
        history.forEach((tx) => {
          const { hash: tx_hash, data, blockNumber, timestamp, value } = tx;
          const to = tx.to && tx.to.toLowerCase();
          const from_addr = tx.from.toLowerCase();

          start_block = Math.max(start_block, blockNumber);
          first_time = Math.min(timestamp, first_time);
          last_time = Math.max(timestamp, last_time);

          if (!(tx_hash in tx_map)) {
            tx_map[tx_hash] = true;
            process_count++;
            tx_count++;

            if (to === null) {
              console.log('contract creation: block:', blockNumber);
            } else if (to === contract_addr) {
              //console.log("from_addr:",from_addr,"data:",data);
              from_map[from_addr] = (from_map[from_addr] || 0) + 1;
            } else {
              console.log('weird:', tx);
            }
            const v_f = parseFloat(value.toString());
            if (v_f > 0) {
              funding_total += v_f;
            }

            if (to !== null) {
              if (is_erc721) {
                _parse721(tx);
              } else {
                const old_data_count = data_map[data];
                if (old_data_count) {
                  data_map[data] = old_data_count + 1;
                } else {
                  data_map[data] = 1;
                  if (data.length < 20) {
                    console.log('new data:', data);
                  }
                }
              }
            }
          } else {
            console.log('ignore dup');
          }
        });
      } else {
        console.log('empty history, assuming done');
        break;
      }
      if (process_count === 0) {
        console.log('all dups, assuming done');
        break;
      }
    }

    const addr_count = Object.keys(from_map).length;
    const delta_t = last_time - first_time;
    const delta_days = delta_t / DAY;

    console.log('');
    console.log('--------------');
    console.log('stats:');
    console.log('--------------');
    console.log(
      'first time:',
      first_time,
      new Date(first_time * 1000).toLocaleString()
    );
    console.log(
      'last time:',
      last_time,
      new Date(last_time * 1000).toLocaleString()
    );
    console.log('transactions:', tx_count);
    console.log('unique addresses:', addr_count);
    console.log(
      'funding total:',
      funding_total + '(wei)',
      funding_total / 1e18 + '(eth)'
    );
    console.log('');
    console.log('delta_t days:', delta_days);
    console.log('tx/addr:', tx_count / addr_count);
    console.log('tx/day:', tx_count / delta_days);
    console.log('');
    console.log('data_map:', data_map);
    console.log('');
    console.log('function_calls:', function_calls);
    console.log('');
    console.log('unknown_sighash:', unknown_sighash);
    console.log('');

    const live_count = mint_count - burn_count;
    const holder_count = Object.keys(token_holders).length;

    console.log('----------------');
    console.log('token stats:');
    console.log('----------------');
    console.log('minted:', mint_count);
    console.log('burned:', burn_count);
    console.log('live:', live_count);
    console.log('transfers:', transfer_count);
    console.log('');
    console.log('mints/day:', mint_count / delta_days);
    console.log('burns/day:', burn_count / delta_days);
    console.log('transfers/day:', transfer_count / delta_days);
    console.log('');
    console.log('operator count:', Object.keys(operator_map).length);
    console.log('live token count:', Object.keys(live_tokens).length);
    console.log('token holders:', holder_count);
    console.log('mint dests (players?):', Object.keys(mint_dests).length);
    console.log('burners:', Object.keys(burners).length);
    console.log('');
    console.log('minters:', Object.keys(minters));
    console.log('');
  } catch (e) {
    console.error('threw:', e);
  }
}

function _parse721(tx) {
  try {
    let ret = erc721_interface.parseTransaction(tx);
    if (!ret) {
      ret = _customIdentify(tx.data);
    }

    if (ret) {
      const { name } = ret;
      function_calls[name] = (function_calls[name] || 0) + 1;

      if (name === 'transferFrom') {
        const _from = ret.args[0].toLowerCase();
        const _to = ret.args[1].toLowerCase();
        const _tokenId = ret.args[2];
        live_tokens[_tokenId.toNumber()] = true;
        token_holders[_to] = true;
        transfer_count++;
      } else if (name === 'safeTransferFrom') {
        const _from = ret.args[0].toLowerCase();
        const _to = ret.args[1].toLowerCase();
        const _tokenId = ret.args[2];
        live_tokens[_tokenId.toNumber()] = true;
        token_holders[_to] = true;
        transfer_count++;
      } else if (name === 'setApprovalForAll') {
        const operator = ret.args[0].toLowerCase();
        operator_map[operator] = (operator_map[operator] || 0) + 1;
      } else if (name === 'burn') {
        const _from = tx.from.toLowerCase();
        const _tokenId = ret.args[0];
        burned_tokens[_tokenId.toNumber()] = true;
        burners[_from] = true;
        delete live_tokens[_tokenId.toNumber()];
        burn_count++;
      } else if (name === 'transfer') {
        const _from = tx.from.toLowerCase();
        const _dest = ret.args[0].toLowerCase();
        const _tokenId = ret.args[1];
        live_tokens[_tokenId.toNumber()] = true;
        token_holders[_dest] = true;
        transfer_count++;
      } else if (name === 'guess_mint') {
        const _dest = ret.args[0].toLowerCase();
        token_holders[_dest] = true;
        mint_dests[_dest] = true;
        mint_count++;
      } else if (name === 'addMinter') {
        const _minter = ret.args[0].toLowerCase();
        minters[_minter] = true;
      } else if (name === 'copyUntil') {
        const _minter = tx.from.toLowerCase();
        const count = ret.args[0].toNumber();
        minters[_minter] = true;
        mint_count += count;
      } else if (name === 'addFactory') {
        //console.log("addFactory:",tx);
      }
    } else if (tx.data.length > 10) {
      const sighash = tx.data.substring(0, 10).toLowerCase();
      const old = unknown_sighash[sighash];
      if (old) {
        unknown_sighash[sighash] = old + 1;
        console.log('unknown sighash:', sighash, 'hash:', tx.hash);
      } else {
        unknown_sighash[sighash] = 1;
        console.log('unknown sighash:', sighash, 'data:', tx);
      }
    } else if (tx.data.length > 2) {
      console.log('short data:', tx.data, tx);
    } else {
      //console.log("funding?",tx);
    }
  } catch (e) {
    console.error('_parse721 throw:', e);
  }
}

function _customIdentify(data) {
  let ret;
  if (data && data.length >= 10) {
    const sighash = data.substring(0, 10).toLowerCase();
    if (sighash === '0xd8bbe6b4') {
      const inputs = [
        {
          indexed: false,
          name: 'destination',
          type: 'address',
        },
        {
          indexed: false,
          name: 'unknown1',
          type: 'uint256',
        },
        {
          indexed: false,
          name: 'unknown2',
          type: 'uint256',
        },
        {
          indexed: false,
          name: 'unknown3',
          type: 'uint256',
        },
        {
          indexed: false,
          name: 'unknown4',
          type: 'uint256',
        },
      ];
      const args = ethers.utils.defaultAbiCoder.decode(
        inputs,
        '0x' + data.substring(10)
      );
      ret = {
        name: 'guess_mint',
        args,
      };
    } else if (sighash === '0xad49e8c7') {
      const inputs = [
        {
          indexed: false,
          name: 'unknown1',
          type: 'bool',
        },
      ];
      const args = ethers.utils.defaultAbiCoder.decode(
        inputs,
        '0x' + data.substring(10)
      );
      ret = {
        name: 'knightstory721_unknown1',
        args,
      };
    } else if (sighash === '0x7004fb84') {
      // invalid whatever from cryptokitties
      ret = {
        name: 'kitty_unknown_fail1',
        args: [],
      };
    }
  }

  return ret;
}

async function _getHistory(contract_addr, start_block, end_block) {
  let ret;
  for (let i = 0; i < 5; i++) {
    try {
      ret = await etherscanProvider.getHistory(
        contract_addr,
        start_block,
        end_block
      );
    } catch (e) {
      console.error('_getHistory: failed:', e);
      console.error('_getHistory: sleeping');
      await timeout(1000);
      console.error('_getHistory: retry:', i + 1);
    }
    if (ret) {
      break;
    }
  }
  return ret;
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
