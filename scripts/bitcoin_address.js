process.env.CHAIN = 'mainnet';
const { chain, common } = require('./settings');
const ethers = require('ethers');
const config = require('../config.json');
const bitcoin = require('bitcoinjs-lib');

const argv = process.argv.slice(2);
const mnemonic = argv[0] || config.SIGN_MNEMONIC;

function ethAddr() {
  const path = "m/44'/60'/0'/0/0";
  const wallet = ethers.Wallet.fromMnemonic(mnemonic);

  const eth_address = wallet.address;
  console.log('eth_address:', eth_address);
}

function getSegwit() {
  const path = "m/84'/0'/0'/0/0";
  const hdnode = ethers.utils.HDNode.fromMnemonic(mnemonic).derivePath(path);

  const public_key = ethers.utils.arrayify(hdnode.publicKey);
  console.log('public_key:', hdnode.publicKey);

  const segwit = bitcoin.payments.p2wpkh({
    pubkey: public_key,
    network: bitcoin.networks.bitcoin,
  });
  console.log('segwit:', segwit.address);

  console.log(
    'segwit testnet:',
    bitcoin.payments.p2wpkh({
      pubkey: public_key,
      network: bitcoin.networks.testnet,
    }).address
  );
}

function getDoge() {
  const DOGE = {
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    bech32: 'doge',
    bip32: {
      public: 0x02facafd,
      private: 0x02fac398,
    },
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e,
  };

  const path = "m/44'/3'/0'/0/0";
  const hdnode = ethers.utils.HDNode.fromMnemonic(mnemonic).derivePath(path);

  const public_key = ethers.utils.arrayify(hdnode.publicKey);
  console.log('doge public_key:', hdnode.publicKey);

  const pkh = bitcoin.payments.p2pkh({
    pubkey: public_key,
    network: DOGE,
  });
  console.log('doge:', pkh.address);
}

ethAddr();
console.log();
getSegwit();
console.log();
getDoge();
