process.env.CHAIN = 'mainnet';
const { chain, common } = require('./settings');
const ethers = require('ethers');
const config = require('../config.json');
const bitcoin = require('bitcoinjs-lib');
const cashaddr = require('cashaddrjs');

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

  const public_key = Buffer.from(hdnode.publicKey.slice(2), 'hex');
  console.log('public_key:', public_key);

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
function getBCH() {
  const BCH = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'q',
    bip32: {
      public: 0x019da462,
      private: 0x019d9cfe,
    },
    pubKeyHash: 0x00,
    scriptHash: 0x32,
    wif: 0xb0,
  };
  const path = "m/44'/145'/0'/0/0";
  const hdnode = ethers.utils.HDNode.fromMnemonic(mnemonic).derivePath(path);

  const public_key = ethers.utils.arrayify(hdnode.publicKey);
  console.log('bch public_key:', hdnode.publicKey);

  const pkh = bitcoin.payments.p2pkh({
    pubkey: public_key,
    network: BCH,
  });
  console.log('bch:', cashaddr.encode('bitcoincash', 'P2PKH', pkh.hash));
}

ethAddr();
console.log();
getSegwit();
console.log();
getDoge();
console.log();
getBCH();
