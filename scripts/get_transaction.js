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
  console.error('Usage get_transaction.js <hash>');
  process.exit(-1);
}

const hash = argv[0];
const provider = new ethers.providers.JsonRpcProvider(http_provider_url);

provider.getTransaction(hash).then(
  (result) => {
    console.log('tx:', result);
  },
  (err) => {
    console.error('err:', err);
  }
);
