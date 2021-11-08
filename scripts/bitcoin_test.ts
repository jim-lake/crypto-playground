export {};

import * as bitcoin from 'bitcoinjs-lib';
import { makeTx } from './bitcoin_tx_tools';
const request = require('request');
const ethers = require('ethers');
const ecpair = require('ecpair');
const config = require('../config.json');
const { COIN, CHAIN } = require('./bitcoin_settings');
const util = require('util');
const { HASH_CACHE } = require('./test/hash_cache');

const NETWORK = bitcoin.networks.testnet;
const DUST = 546;

const argv = process.argv.slice(2);
if (argv.length < 3) {
  console.error('Usage: bitcoin_test.js <src> <dest> <coins> [fee_per_byte] [fake]');
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

  const { balance, tx_list } = await getUnspent(src, true);
  if (balance < coins) {
    console.error('not enough coins:', balance, '<', coins);
    process.exit(-1);
  }
  //console.log('unspent:', tx_list);

  console.error('');
  console.error(src, '->', dest, 'coins:', coins);
  const result = makeTx(
    tx_list,
    coins,
    src,
    dest,
    fee_per_byte,
    NETWORK,
    DUST,
    'p2pkh'
  );
  console.error(util.inspect(result, { depth: 99 }));
  const psbt = result.unsigned_tx;
  psbt.signAllInputs(signer);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction(true);
  console.error('virtualSize:', tx.virtualSize());
  const fee = Math.ceil(tx.virtualSize() * fee_per_byte);
  console.error({ fee });
  console.log(tx.toHex());
  console.error();
  console.error('HASH_CACHE:', JSON.stringify(HASH_CACHE, null, ' '));
}
function getUnspent(address, fetch_raw) {
  return new Promise((resolve, reject) => {
    const opts = {
      url: `https://api.blockcypher.com/v1/${COIN}/${CHAIN}/addrs/${address}?unspentOnly=true&includeScript=true&limit=2000`,
      method: 'GET',
      json: true,
    };
    request(opts, async (err, response, body) => {
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
        if (fetch_raw) {
          await Promise.all(
            data.tx_list.map((tx) => {
              return getRawTx(tx);
            })
          );
          data.tx_list.forEach((tx) => {
            tx.raw = Buffer.from(tx.hex, 'hex');
          });
        }
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
function getRawTx(tx) {
  const key = `${COIN}_${CHAIN}_${tx.hash}`;
  if (key in HASH_CACHE) {
    tx.hex = HASH_CACHE[key];
    return Promise.resolve(tx.hex);
  }
  return new Promise((resolve, reject) => {
    const opts = {
      url: `https://api.blockchair.com/bitcoin/testnet/raw/transaction/${tx.hash}`,
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
        tx.hex = body.data[tx.hash].raw_transaction;
        HASH_CACHE[key] = tx.hex;
        resolve(tx.hex);
      }
    });
  });
}
