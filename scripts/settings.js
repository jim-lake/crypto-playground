const AppConfig = require('../config.json');
const config = require('../config.json');
const BlockChains = require('./blockchains');
const { basename } = require('path');
const Common = require('ethereumjs-common');

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
console.error('');
const contract_addr = BlockChains[chain].DNC_CONTRACT;
const http_provider_url = BlockChains[chain].HTTP_PROVIDER;

let common;
if (chain === 'sokol') {
  const params = { name: 'sokol', chainId: 77, networkId: 77 };
  common = Common.default.forCustomChain('mainnet', params, 'byzantium');
} else {
  common = new Common({ chain });
}

exports.contract_addr = contract_addr;
exports.http_provider_url = http_provider_url;
exports.chain = chain;
exports.common = common;
