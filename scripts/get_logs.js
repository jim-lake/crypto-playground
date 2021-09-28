const argv = process.argv.slice(2);
const ethers = require('ethers');
const fs = require('fs');
const BigNumber = ethers.utils.BigNumber;
const {
  contract_addr,
  http_provider_url,
  chain,
  gas_override,
} = require('./settings.js');

if (argv.length < 1) {
  console.error('Usage get_logs.js <address> [abi] [event] [args]');
  process.exit(-1);
}

const address = argv[0];
const abi = argv[1];
const event = argv[2];
const extra = argv.slice(3);

const provider = new ethers.providers.JsonRpcProvider(http_provider_url);
console.error('Reading contract abi from path:', abi);

let filter;
if (event && abi) {
  const contract_abi = JSON.parse(fs.readFileSync(abi, 'utf8'));
  const contract = new ethers.Contract(address, contract_abi, provider);
  const filter = contract.filters[event](...extra);
} else {
  filter = { address, topics: [] };
}

console.log('getLogs:', filter);
provider.getLogs(filter).then(
  (results) => {
    console.log('getLogs: results:', results);
  },
  (err) => {
    console.log('getLogs: err:', err);
  }
);
