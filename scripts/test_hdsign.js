
const Bip39 = require('bip39');
const HDKey = require("ethereumjs-wallet/hdkey")
const EthereumJsTx = require('ethereumjs-tx');
const ethers = require('ethers');
const config = require('../config.json');
const argv = process.argv.slice(2);
const fs = require('fs');

if (argv.length !== 3) {
  console.error("Usage: test_hdsign.js <key_name> <index> <xpub>");
  process.exit(-1);
}

const key_name = argv[0];
const index = argv[1];
const xpub = argv[2];

const mnemonic = config[key_name];
if (!mnemonic) {
  console.error("No key in config named:",key_name);
  process.exit(-99);
}

const path = "m/44/60/0/0/" + index;
console.error("Using wallet path:",path);

const seed = Bip39.mnemonicToSeedSync(mnemonic);
const hdwallet = HDKey.fromMasterSeed(seed);
const wallet = hdwallet.derivePath(path).getWallet();

const address = "0x" + wallet.getAddress().toString("hex");
const private_key = wallet.getPrivateKey();

const xpub_hdwallet = ethers.utils.HDNode.fromExtendedKey(xpub);

const xpub_public_key = xpub_hdwallet.derivePath(path).publicKey;
const xpub_addr = ethers.utils.computeAddress(xpub_public_key);

console.error("wallet address:",address);
console.error("");

console.error("xpub_addr:",xpub_addr);
console.error("");

if (xpub_addr.toLowerCase() === address.toLowerCase()) {
  console.error("Success!!!");
} else {
  console.error("No Match!!!");
}
