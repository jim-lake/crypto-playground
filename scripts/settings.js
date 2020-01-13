
const AppConfig = require('../config.json');
const config = require('../config.json');

let contract_addr;
let http_provider_url;
let chain;

if (config.ENV === 'production') {
  console.error("***********  ENV: production **********");
  console.error("");
  contract_addr = AppConfig.DNC_CONTRACT_PROD;
  http_provider_url = AppConfig.INFURA_PROD;
  chain = 'mainnet';
} else {
  console.error("***********  ENV: dev **********");
  console.error("");
  contract_addr = AppConfig.DNC_CONTRACT_DEV;
  http_provider_url = AppConfig.INFURA_DEV;
  chain = 'ropsten';
}

exports.contract_addr = contract_addr;
exports.http_provider_url = http_provider_url;
exports.chain = chain;
