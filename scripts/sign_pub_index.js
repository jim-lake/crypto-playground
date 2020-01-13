
const Bip39 = require('bip39');
const HDKey = require("ethereumjs-wallet/hdkey")
const EthereumJsTx = require('ethereumjs-tx');
const config = require('../config.json');
const argv = process.argv.slice(2);
const fs = require('fs');

if (argv.length !== 3) {
  console.error("Usage: sign_pub_index.js <key_name> <index> <filename>");
  process.exit(-1);
}

const key_name = argv[0];
const index = argv[1];

let source = argv[2];
if (source === '-') {
  source = 0;
  console.error("Reading transaction from stdin");
} else {
  console.error("Reading transaction from file:",source);
}

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

const tx = JSON.parse(fs.readFileSync(source,'utf8'));
if (!tx || !tx.gasPrice) {
  console.error("bad transaction provided, please sign a filename or provide data on the stdin");
  process.exit(-1);
}

tx.gas = parseInt(tx.gas);
tx.gasPrice = parseInt(tx.gasPrice);

console.error("Ether Address from wallet:",address);
if (address.toLowerCase() !== tx.from.toLowerCase()) {
  console.error("Error: wallet.address and tx.from didn't match, transaction wont work");
  process.exit(-1);
}

const chain_opts = {
  chain: tx.chain,
};
delete tx.chain;

const ether_tx = new EthereumJsTx.Transaction(tx,chain_opts);
console.error("Signing transaction:",tx);
ether_tx.sign(private_key);
console.error("");
console.error("Signed Transaction:")
console.error("");
console.log(ether_tx.serialize().toString('hex'));
console.error("");
