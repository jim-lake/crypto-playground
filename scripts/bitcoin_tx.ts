export {};

import * as bitcoin from 'bitcoinjs-lib';
const request = require('request');
const ethers = require('ethers');
const ecpair = require('ecpair');
const config = require('../config.json');
const { COIN, CHAIN } = require('./bitcoin_settings');
const util = require('util');

const NETWORK = bitcoin.networks.testnet;
const DUST = 546;

const argv = process.argv.slice(2);
if (argv.length < 3) {
  console.error('Usage: bitcoin_send.js <src> <dest> <coins> [fee_per_byte]');
  process.exit(-99);
}

const src = argv[0];
const dest = argv[1];
const coins = parseInt(argv[2]);

console.error(src, '->', dest, 'coins:', coins);

const path = "m/84'/0'/0'/0/0";
const hdnode = ethers.utils.HDNode.fromMnemonic(
  config.SIGN_MNEMONIC
).derivePath(path);
const public_key = ethers.utils.arrayify(hdnode.publicKey);
const sign_address = bitcoin.payments.p2wpkh({
  pubkey: public_key,
  network: NETWORK,
}).address;
if (sign_address !== src) {
  console.error('sign_address and src mismatch:', sign_address, src);
  //process.exit(-1);
}
const signer = ecpair.ECPair.fromPrivateKey(
  Buffer.from(ethers.utils.arrayify(hdnode.privateKey))
);

const fake_signer = ecpair.ECPair.makeRandom({ network: NETWORK });
const fake_signer_address = bitcoin.payments.p2wpkh({
  pubkey: fake_signer.publicKey,
  network: NETWORK,
}).address;

makeTransaction();

async function makeTransaction() {
  const {
    high_fee_per_kb,
    medium_fee_per_kb,
    low_fee_per_kb,
  } = await getFeeRate();
  console.error(
    'fee(high, medium, low):',
    high_fee_per_kb,
    medium_fee_per_kb,
    low_fee_per_kb
  );
  const fee_per_byte = Math.ceil(
    argv[3] ? parseInt(argv[3]) : high_fee_per_kb / 1024
  );
  console.error('using fee:', fee_per_byte, 'per vbyte');

  const { balance, tx_list } = await getUnspent(src);
  if (balance < coins) {
    console.error('not enough coins:', balance, '<', coins);
    process.exit(-1);
  }
  //console.log('unspent:', tx_list);

  console.error('');
  console.error(src, '->', dest, 'coins:', coins);
  const ret = _makeTx(tx_list, coins, src, dest, fee_per_byte, NETWORK, DUST);
  console.log(ret);
}
function getUnspent(address) {
  return new Promise((resolve, reject) => {
    const opts = {
      url: `https://api.blockcypher.com/v1/${COIN}/${CHAIN}/addrs/${address}?unspentOnly=true&includeScript=true&limit=2000`,
      method: 'GET',
      json: true,
    };
    request(opts, (err, response, body) => {
      if (err) {
        console.error('failed:', err, body);
        reject(err);
      } else if (response && response.statusCode > 299) {
        console.error('bad status:', response.statusCode, body);
        reject(response.statusCode);
      } else {
        const { txrefs, final_balance, unconfirmed_balance } = body;
        const data = {
          balance: unconfirmed_balance + final_balance,
          tx_list: txrefs.map((tx) => ({
            hash: tx.tx_hash,
            value: tx.value,
            index: tx.tx_output_n,
            script: Buffer.from(tx.script, 'hex'),
          })),
        };
        resolve(data);
      }
    });
  });
}

function getFeeRate(address) {
  return new Promise((resolve, reject) => {
    const opts = {
      url: `https://api.blockcypher.com/v1/${COIN}/${CHAIN}`,
      method: 'GET',
      json: true,
    };
    request(opts, (err, response, body) => {
      if (err) {
        console.error('failed:', err, body);
        reject(err);
      } else if (response && response.statusCode > 299) {
        console.error('bad status:', response.statusCode, body);
        reject(response.statusCode);
      } else {
        resolve(body);
      }
    });
  });
}

const MAX_LOOP = 10 * 1000;
function _makeTx(
  unspent_list,
  send_value,
  from,
  to,
  fee_per_byte,
  bitcoin_network,
  dust
) {
  unspent_list.sort(_sortHighest);
  let min_inputs = 0;
  let min_amount = 0;
  let min_fee;
  const all_opts = {
    send_value,
    from,
    to,
    fee_per_byte,
    bitcoin_network,
    dust,
  };
  unspent_list.every(({ value }) => {
    let ret = true;
    if (min_amount < send_value) {
      min_inputs++;
      min_amount += value;
    } else {
      min_fee = _calculateFee({
        ...all_opts,
        input_list: unspent_list.slice(0, min_inputs),
        include_change: false,
      });
      if (min_amount > send_value + min_fee) {
        ret = false;
      } else {
        min_inputs++;
        min_amount += value;
      }
    }
    return ret;
  });
  console.log({ min_inputs, min_amount, min_fee });
  let ret;
  if (min_amount > send_value + min_fee) {
    ret = _findPerfect({
      ...all_opts,
      unspent_list,
      input_count: min_inputs,
    });
    if (!ret) {
      console.log('change_tx:', unspent_list.slice(0, min_inputs));
      ret = _makeChangeTx({
        ...all_opts,
        input_list: unspent_list.slice(0, min_inputs),
      });
    }
  }
  return ret;
}
function _findPerfect(params) {
  const { send_value, dust, unspent_list, input_count } = params;
  let ret;

  const fee = _calculateFee({
    ...params,
    input_list: unspent_list.slice(0, input_count),
    make_change: false,
  });
  const change_fee = _calculateFee({
    ...params,
    input_list: unspent_list.slice(0, input_count),
    make_change: true,
  });
  const min = send_value + Math.ceil(fee * 0.9);
  const max = send_value + Math.max(change_fee, dust);
  console.log({ min, max });
  const value_list = unspent_list.map((tx) => tx.value);

  const found_list = _findSumList(value_list, input_count, min, max);
  console.log(found_list);
  if (found_list) {
    const input_sum = _sum(found_list);
    const input_list = [];
    unspent_list.forEach((tx) => {
      const index = found_list.indexOf(tx.value);
      if (index !== -1) {
        found_list[index] = 0;
        input_list.push(tx);
      }
    });
    console.log('perfect_fit:', input_list);
    const unsigned_tx = _makeUnsigned({
      ...params,
      input_list,
      change: 0,
    });
    const fee = input_sum - send_value;
    ret = {
      unsigned_tx,
      fee,
    };
  }
  return ret;
}
function _makeChangeTx(params) {
  const { input_list, send_value, dust } = params;
  let ret;

  const fee = _calculateFee({
    ...params,
    make_change: true,
  });
  const input_sum = input_list.reduce((memo, { value }) => memo + value, 0);
  const change = input_sum - fee - send_value;
  console.log({ change });
  if (change > dust) {
    const unsigned_tx = _makeUnsigned({
      ...params,
      change,
    });
    ret = {
      unsigned_tx,
      fee,
    };
  }
  return ret;
}
function _calculateFee(params): number {
  const { make_change, dust, fee_per_byte } = params;
  const psbt = _makeUnsigned({
    ...params,
    send_value: dust,
    fake_inputs: true,
    change: make_change ? dust : 0,
  });
  psbt.signAllInputs(fake_signer);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction(true);
  const fee = Math.ceil(tx.virtualSize() * fee_per_byte);
  return fee;
}
function _makeUnsigned(params): bitcoin.Psbt {
  const {
    input_list,
    change,
    from,
    to,
    send_value,
    dust,
    fake_inputs,
  } = params;
  const psbt = new bitcoin.Psbt({ network: params.bitcoin_network });

  let fake_script;
  if (fake_inputs) {
    fake_script = bitcoin.address.toOutputScript(
      fake_signer_address,
      params.bitcoin_network
    );
  }
  input_list.forEach((input) => {
    const opts = {
      witnessUtxo: {
        script: fake_script || input.script,
        value: input.value,
      },
      hash: input.hash,
      index: input.index,
    };
    psbt.addInput(opts);
  });
  psbt.addOutput({ address: to, value: send_value });
  if (change) {
    psbt.addOutput({ address: from, value: change });
  }
  return psbt;
}
function _sortHighest(a, b) {
  return b.value - a.value;
}
function _findSumList(list, input_count, min, max) {
  let test_list = list.slice(0, input_count - 1);
  let result_list;
  let loop_count = 0;
  while (test_list && loop_count < MAX_LOOP) {
    const test_sum = _sum(test_list);
    if (test_sum < max) {
      for (let i = 0, test_i = 0; i < list.length; i++) {
        const val = list[i];
        if (test_i < test_list.length) {
          if (test_list[i] === val) {
            test_i++;
          }
        } else {
          const new_val = val + test_sum;
          if (new_val < min) {
            break;
          } else if (new_val >= min && new_val <= max) {
            result_list = [...test_list, val];
            break;
          }
        }
      }
      loop_count += list.length;
    }
    if (result_list) {
      break;
    } else {
      const old_list = test_list;
      test_list = null;
      for (let i = old_list.length - 1; i > 0; i--) {
        const val = old_list[i];
        const found_index = list.findIndex((v) => v < val);
        if (found_index !== -1) {
          test_list = [
            ...old_list.slice(0, i - 1),
            ...list.slice(found_index, found_index + input_count - i - 2),
          ];
          break;
        }
      }
    }
  }
  return result_list;
}
function _sum(list) {
  return list.reduce((memo, value) => memo + value, 0);
}
