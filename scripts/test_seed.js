const Bip39 = require('bip39');
const HDKey = require('ethereumjs-wallet/hdkey');
const ethers = require('ethers');
const config = require('../config.json');
const argv = process.argv.slice(2);
const fs = require('fs');
const crypto = require('crypto');

const path = "m/44'/60'/0'/0/0";

let entropy;
let mnemonic;
if (argv.length > 10) {
} else {
  entropy = crypto.randomBytes(32);
  console.error('entropy:', entropy.toString('hex'));

  console.time('entropyToMnemonic');
  mnemonic = Bip39.entropyToMnemonic(entropy);
  console.timeEnd('entropyToMnemonic');
  console.error('mnemonic:', mnemonic);
}

console.time('mnemonicToSeedSync');
const seed = Bip39.mnemonicToSeedSync(mnemonic);
console.timeEnd('mnemonicToSeedSync');
console.error('seed:', seed.toString('hex'));

console.time('fromMnemonic');
const ethers_hd = ethers.utils.HDNode.fromMnemonic(mnemonic);
console.timeEnd('fromMnemonic');

console.time('fromSeed');
const ethers_hd_from_seed = ethers.utils.HDNode.fromSeed(seed);
console.timeEnd('fromSeed');

console.time('fromMasterSeed');
const hdwallet = HDKey.fromMasterSeed(seed);
console.timeEnd('fromMasterSeed');

console.time('getWallet');
const wallet = hdwallet.derivePath(path).getWallet();
console.timeEnd('getWallet');

const address = '0x' + wallet.getAddress().toString('hex');
const private_key = '0x' + wallet.getPrivateKey().toString('hex');

console.error('wallet address:', address);
console.error('');

console.error('private_key:', private_key);
console.error('');

console.time('new Wallet');
const ether_wallet = new ethers.Wallet(wallet.getPrivateKey());
console.timeEnd('new Wallet');

console.error('ethers addr:', ether_wallet.address);
console.error('');
