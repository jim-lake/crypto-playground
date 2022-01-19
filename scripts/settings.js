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
    chain,
    customChains: [
      {
        name: chain,
        chainId: chain_data.CHAIN_ID,
        networkId: chain_data.CHAIN_ID,
        hardforks: [
          {
            name: 'chainstart',
            block: 0,
            forkHash: '0x010ffe56',
          },
          {
            name: 'homestead',
            block: 0,
            forkHash: '0x010ffe56',
          },
          {
            name: 'tangerineWhistle',
            block: 0,
            forkHash: '0x010ffe56',
          },
          {
            name: 'spuriousDragon',
            block: 0,
            forkHash: '0x010ffe56',
          },
          {
            name: 'byzantium',
            block: 0,
            forkHash: '0x7f83c620',
          },
          {
            name: 'constantinople',
            block: 0,
            forkHash: '0xa94e3dc4',
          },
          {
            name: 'petersburg',
            block: 0,
            forkHash: '0x186874aa',
          },
          {
            name: 'istanbul',
            block: 0,
            forkHash: '0x7f6599a6',
          },
        ],
      },
    ],
  };
  if (chain_data.EIP1559) {
    params.customChains[0].hardforks.push(
      {
        name: 'muirGlacier',
        block: 0,
        forkHash: '0xe029e991',
      },
      {
        name: 'berlin',
        block: 0,
        forkHash: '0x0eb440f6',
      },
      {
        name: 'london',
        block: 0,
        forkHash: '0xb715077d',
      }
    );
    params.hardfork = 'london';
  }

  exports.chain_params = params;
  common = new Common.default(params);
  console.error('custom chain id:', chain_data.CHAIN_ID);
} else {
  common = new Common.default({ chain, hardfork: 'london' });
  exports.chain_params = {
    chain: common._chainParams.name,
    chainId: common.chainId(),
    hardfork: common.hardfork(),
  };
}

console.error('');

exports.contract_addr = contract_addr;
exports.http_provider_url = http_provider_url;
exports.chain = chain;
exports.common = common;
exports.gas_override = gas_override;
exports.gas_limit = chain_data.GAS_LIMIT;
