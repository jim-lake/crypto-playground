const argv = process.argv.slice(2);
const ethers = require('ethers');
const BigNumber = ethers.utils.BigNumber;
const {
  contract_addr,
  http_provider_url,
  chain,
  gas_override,
} = require('./settings.js');

if (argv.length < 1) {
  console.error('Usage get_logs.js <address>');
  process.exit(-1);
}

const address = argv[0];
const provider = new ethers.providers.JsonRpcProvider(http_provider_url);

provider.getLogs([address]).then(
  (results) => {
    console.log('getLogs: results:', results);
  },
  (err) => {
    console.log('getLogs: err:', err);
  }
);
