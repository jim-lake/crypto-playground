const Bip39 = require('bip39');
const HDKey = require('ethereumjs-wallet/hdkey');
const EthereumJsTx = require('ethereumjs-tx');
const ethers = require('ethers');
const config = require('../config.json');
const argv = process.argv.slice(2);
const fs = require('fs');

if (argv.length === 0) {
  console.error('Usage: test_wallet.js <mnemonic>');
  process.exit(-1);
}

const mnemonic = argv.join(' ');
if (!mnemonic) {
  process.exit(-99);
}

const path = process.env.WALLET_PATH || "m/44'/60'/0'/0/0";
const seed = Bip39.mnemonicToSeedSync(mnemonic);
const hdwallet = HDKey.fromMasterSeed(seed);
const wallet = hdwallet.derivePath(path).getWallet();

const address = '0x' + wallet.getAddress().toString('hex');
const private_key = '0x' + wallet.getPrivateKey().toString('hex');

console.error('wallet address:', address);
console.error('');

console.error('private_key:', private_key);
console.error('');
