const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-west-2' });
const ethers = require('ethers');
const EthereumJsTx = require('ethereumjs-tx');
const fs = require('fs');
const { KMSProvider } = require('@rumblefishdev/eth-signer-kms');
const AppConfig = require('../config.json');
const {
  chain,
  common,
  http_provider_url,
  gas_override,
  gas_limit,
  chain_params,
} = require('./settings.js');

const _origLog = console.log;
console.log = console.error;

const argv = process.argv.slice(2);
if (argv.length !== 1) {
  console.error('Usage: sign_kms.js <filename>');
  process.exit(-1);
}
let source = argv[0];
if (source === '-') {
  source = 0;
  console.error('Reading transaction from stdin');
} else {
  console.error('Reading transaction from:', source);
}

const tx = JSON.parse(fs.readFileSync(source, 'utf8'));
if (!tx) {
  console.error(
    'bad transaction provided, please sign a filename or provide data on the stdin'
  );
  process.exit(-1);
}

const keyId = process.env.KEYID || AppConfig.KMS_MAP[tx.from.toLowerCase()];
if (!keyId) {
  console.error('No key_id');
  process.exit(-2);
}
console.error('KeyId:', keyId);

tx.gas = parseInt(tx.gas);
if (tx.gasPrice) {
  tx.gasPrice = parseInt(tx.gasPrice);
}
if (tx.maxFeePerGas) {
  tx.maxFeePerGas = parseInt(tx.maxFeePerGas);
  tx.chainId = common.chainId();
  tx.type = 2;
  delete tx.chain;
}
if (tx.maxPriorityFeePerGas) {
  tx.maxPriorityFeePerGas = parseInt(tx.maxPriorityFeePerGas);
}

sign();
async function sign() {
  try {
    const infuraProvider = new ethers.providers.JsonRpcProvider(
      http_provider_url
    );

    const kmsProvider = new KMSProvider({
      keyId,
      providerOrUrl: http_provider_url,
      chainSettings: chain_params,
    });

    const signer = await new ethers.providers.Web3Provider(
      kmsProvider
    ).getSigner();
    const address = await signer.getAddress();
    console.error('KMSProvider: Ether Address from wallet:', address);

    if (address.toLowerCase() !== tx.from.toLowerCase()) {
      console.error(
        "Error: wallet.address and tx.from didn't match, transaction wont work"
      );
      process.exit(-1);
    }
    console.error('Signing transaction:', tx);
    const newRawTx = await kmsProvider.engine._providers[0].signTransaction(tx);
    console.error('');
    console.error('Got signed tx:', newRawTx.slice(2));
    console.error('');
    _origLog(newRawTx.slice(2));
    console.error('');
    process.exit(0);
  } catch (e) {
    console.error('threw:', e, e.stack);
    process.exit(-2);
  }
}
