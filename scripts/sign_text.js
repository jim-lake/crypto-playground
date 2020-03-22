const Bip39 = require('bip39');
const HDKey = require('ethereumjs-wallet/hdkey');
const ethers = require('ethers');
const config = require('../config.json');
const argv = process.argv.slice(2);
const fs = require('fs');

const mnemonic = config.SIGN_MNEMONIC;

const path = "m/44'/60'/0'/0/0";
const seed = Bip39.mnemonicToSeedSync(mnemonic);
const hdwallet = HDKey.fromMasterSeed(seed);
const wallet = hdwallet.derivePath(path).getWallet();

const address = '0x' + wallet.getAddress().toString('hex');
const private_key = wallet.getPrivateKey();

const ethersWallet = new ethers.Wallet(private_key);

if (argv.length !== 1) {
  console.error('Usage: sign_text.js <message_text>');
  process.exit(-1);
}

let message_text = argv[0];
if (message_text === '-') {
  console.error('Reading message_text from stdin');
  message_text = fs.readFileSync(0, 'utf8');
}

signText();

async function signText() {
  const flatSig = await ethersWallet.signMessage(message_text);
  console.error('Signing Address:', address);
  console.error('');
  console.error('Message Signature:');
  console.error('');
  console.log(flatSig);
  console.error('');
}
