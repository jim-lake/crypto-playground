const AppConfig = require('../config.json');
const config = require('../config.json');
const BlockChains = require('./blockchains');
const { basename } = require('path');
const Common = require('@ethereumjs/common');

let chain;
if (process.env['CHAIN']) {
  chain = process.env.CHAIN;
} else {
  console.error('CHAIN is required');
  process.exit(-1);
}

console.error('');
console.error('command:', basename(process.argv[1]));
console.error('***********  ENV:', chain, '**********');

const chain_data = BlockChains[chain];

const contract_addr = chain_data.DNC_CONTRACT;
const http_provider_url = chain_data.HTTP_PROVIDER;
const gas_override = chain_data.GAS_OVERRIDE;

let common;
if (chain_data.CHAIN_ID) {
  const params = {
    name: chain,
    chainId: chain_data.CHAIN_ID,
    networkId: chain_data.CHAIN_ID,
  };
  common = Common.default.forCustomChain('mainnet', params, 'byzantium');
  console.error('custom chain id:', chain_data.CHAIN_ID);
} else {
  common = new Common.default({ chain, hardfork: 'london' });
}

console.error('');

exports.contract_addr = contract_addr;
exports.http_provider_url = http_provider_url;
exports.chain = chain;
exports.common = common;
exports.gas_override = gas_override;
exports.gas_limit = chain_data.GAS_LIMIT;
