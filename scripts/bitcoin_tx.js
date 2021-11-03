const request = require('request');
const ethers = require('ethers');
const ecpair = require('ecpair');
const config = require('../config.json');
const bitcoin = require('bitcoinjs-lib');
const { COIN, CHAIN } = require('./bitcoin_settings');

const NETWORK = bitcoin.networks.testnet;

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
  network: bitcoin.networks.testnet,
}).address;
if (sign_address !== src) {
  console.error('sign_address and src mismatch:', sign_address, src);
  process.exit(-1);
}
const signer = ecpair.ECPair.fromPrivateKey(
  Buffer.from(ethers.utils.arrayify(hdnode.privateKey))
);

makeTransaction();

async function makeTransaction() {
  const { high_fee_per_kb, medium_fee_per_kb, low_fee_per_kb } =
    await getFeeRate();
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

  let is_done = false;
  let target_fee = 0;
  let tx;
  let psbt;
  let change;
  let bounce_count = 0;
  while (1) {
    const result = _incrementalTransaction(
      tx_list,
      coins,
      fee_per_byte,
      target_fee
    );

    if (target_fee === result.next_target_fee) {
      console.error('done!');
      tx = result.tx;
      psbt = result.psbt;
      change = result.change;
      break;
    } else {
      if (target_fee > result.next_target_fee) {
        bounce_count++;
        if (bounce_count > 1) {
          console.error('bounce done!');
          tx = result.tx;
          psbt = result.psbt;
          change = result.change;
          break;
        }
      }
      target_fee = result.next_target_fee;
    }
  }

  console.error('');
  console.error(src, '->', dest, 'coins:', coins);
  console.error('change:', change || 0);
  console.error('psbt.getFee():', psbt.getFee());
  console.error('total spent:', psbt.getFee() + coins);
  console.error('');
  console.error('tx.getId():', tx.getId());
  console.error('');
  console.log(tx.toHex());
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
          tx_list: txrefs,
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

function _incrementalTransaction(tx_list, coins, fee_per_byte, old_target_fee) {
  const psbt = new bitcoin.Psbt({ network: NETWORK });
  const target_input_coins = coins + old_target_fee;
  let input_coins = 0;
  tx_list.every((tx) => {
    const { tx_hash, value, script, tx_output_n } = tx;
    input_coins += value;
    const opts = {
      witnessUtxo: {
        script: Buffer.from(script, 'hex'),
        value,
      },
      hash: tx_hash,
      index: tx_output_n,
    };
    //console.error('adding input:', opts);
    psbt.addInput(opts);
    return target_input_coins > input_coins;
  });
  //console.error(' - input_coins:', input_coins);

  psbt.addOutput({ address: dest, value: coins });
  const change = input_coins - coins - old_target_fee;
  if (change > 0) {
    //console.error(' - change:', change);
    psbt.addOutput({ address: src, value: change });
  }
  psbt.signAllInputs(signer);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();

  const new_fee = psbt.getFee();
  //console.error(' - new_fee:', new_fee);
  const next_target_fee = Math.floor(tx.virtualSize() * fee_per_byte);
  //console.error(' - next_target_fee:', next_target_fee);
  return { psbt, tx, next_target_fee, change };
}
