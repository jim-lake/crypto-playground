const _ = require('lodash');
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
const extra = argv.slice(3).map(_fixupExtra);

const provider = new ethers.providers.JsonRpcProvider(http_provider_url);
console.error('Reading contract abi from path:', abi);

let filter;
if (event && abi) {
  const contract_abi = JSON.parse(fs.readFileSync(abi, 'utf8'));
  const contract = new ethers.Contract(address, contract_abi, provider);
  console.log('extra:', extra);
  console.log(contract.filters[event]);
  const filter = _makeFilter(contract, event, extra);
  console.log('filter:', filter);
  contract.queryFilter(filter, 0, 100 * 1000 * 1000).then(
    (results) => {
      console.log(
        'queryFilter: results:',
        results.map((r) => contract.interface.parseLog(r))
      );
    },
    (err) => {
      console.log('queryFilter: err:', err);
    }
  );
} else {
  filter = { address, topics: [] };
  console.log('filter:', filter);
  provider.getLogs(filter).then(
    (results) => {
      console.log('getLogs: results:', results);
    },
    (err) => {
      console.log('getLogs: err:', err);
    }
  );
}

function _fixupExtra(arg) {
  if (!arg) {
    arg = null;
  }
  return arg;
}

function _makeFilter(contract, event, extra) {
  const events = event.split('|');
  const filters = events.map((event) => contract.filters[event](...extra));
  filters[0].topics[0] = filters.map((f) => f.topics[0]);
  return filters[0];
  /*
  const topic_lists = [];
  for (let i = 0 ; i < filters[0].topics.length ; i++) {
    topic_lists[i] = filters.map(f => f.topics[i]);
  }
  const filter = {
    address: filters[0].address,
    topics: topic_lists.map(_makeTopic),
  };
  return filter;
  */
}
function _makeTopic(topic_list) {
  let ret = _.uniq(topic_list);
  if (ret.length === 1) {
    ret = ret[0];
  }
  return ret;
}
