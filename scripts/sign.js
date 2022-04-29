const { chain, common } = require('./settings');
const Bip39 = require('bip39');
const HDKey = require('ethereumjs-wallet/hdkey');
const EthereumJsTx = require('@ethereumjs/tx');
const config = require('../config.json');
const fs = require('fs');
const argv = process.argv.slice(2);

const mnemonic = process.env.SIGN_MNEMONIC || config.SIGN_MNEMONIC;
if (!mnemonic) {
  console.error('No mnemonic found');
  process.exit(-2);
}

const path = "m/44'/60'/0'/0/0";
const seed = Bip39.mnemonicToSeedSync(mnemonic);
const hdwallet = HDKey.fromMasterSeed(seed);
const wallet = hdwallet.derivePath(path).getWallet();

const address = '0x' + wallet.getAddress().toString('hex');
const private_key = wallet.getPrivateKey();

if (argv.length !== 1) {
  console.error('Usage: sign.js <filename>');
  process.exit(-1);
}

let source = argv[0];
if (source === '-') {
  source = 0;
  console.error('Reading transaction from stdin');
} else {
  console.error('Reading transaction from stdin');
}

const tx = JSON.parse(fs.readFileSync(source, 'utf8'));
if (!tx || !tx.gas) {
  console.error(
    'bad transaction provided, please sign a filename or provide data on the stdin'
  );
  process.exit(-3);
}

tx.gasLimit = parseInt(tx.gas);
delete tx.gas;
if (tx.gasPrice) {
  tx.gasPrice = parseInt(tx.gasPrice);
}
if (tx.maxFeePerGas) {
  tx.maxFeePerGas = parseInt(tx.maxFeePerGas);
}
if (tx.maxPriorityFeePerGas) {
  tx.maxPriorityFeePerGas = parseInt(tx.maxPriorityFeePerGas);
}

console.error('Ether Address from wallet:', address);
if (address.toLowerCase() !== tx.from.toLowerCase()) {
  console.error(
    "Error: wallet.address and tx.from didn't match, transaction wont work"
  );
  process.exit(-1);
}

if (tx.chain !== chain) {
  console.error('Error: tx.chain(' + tx.chain + ') !== chain(' + chain + ')');
  process.exit(-2);
}
delete tx.chain;

let ether_tx;
if (tx.maxFeePerGas) {
  console.error('EIP1559Tx');
  tx.chainId = common._chainParams.chainId;
  ether_tx = new EthereumJsTx.FeeMarketEIP1559Transaction(tx, { common });
  //console.log(ether_tx);
} else {
  ether_tx = new EthereumJsTx.Transaction(tx, { common });
}
console.error('Signing transaction:', tx);
const signedTx = ether_tx.sign(private_key);
console.error('');
console.error('Signed Transaction:');
console.error('');
//console.error('ether_tx:', ether_tx);
const signed_hex = signedTx.serialize().toString('hex');
console.log(signed_hex);
//const decoded = EthereumJsTx.FeeMarketEIP1559Transaction.fromSerializedTx(signed_hex);
//console.error('decoded:', decoded);
console.error('');
