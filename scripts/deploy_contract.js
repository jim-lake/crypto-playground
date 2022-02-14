const Web3 = require('web3');
const BN = Web3.utils.BN;
const AppConfig = require('../config.json');
const config = require('../config.json');
const argv = process.argv.slice(2);
const fs = require('fs');
const ethers = require('ethers');
const BigNumber = ethers.utils.BigNumber;
const {
  contract_addr,
  http_provider_url,
  chain,
  gas_override,
} = require('./settings.js');

const GAS_LIMIT_ETH = config.GAS_LIMIT_ETH;

if (argv.length < 3) {
  console.error(
    'Usage deploy_contact.js <contract_bin_path> <contract_abi_path> <from_addr> [args]'
  );
  process.exit(-1);
}

const _origLog = console.log;
console.log = console.error;

const contract_bin_path = argv[0];
const contract_abi_path = argv[1];
const from_addr = argv[2];
const contract_args = argv.slice(3);

console.error('Reading contract from path:', contract_bin_path);
const raw_data = fs.readFileSync(contract_bin_path, 'utf8').trim();
const contract_data =
  raw_data.slice(0, 2) === '0x' ? raw_data : '0x' + raw_data;

console.error('Reading contract abi from path:', contract_abi_path);
const contract_abi = JSON.parse(fs.readFileSync(contract_abi_path, 'utf8'));

const web3 = new Web3(new Web3.providers.HttpProvider(http_provider_url));
const infuraProvider = new ethers.providers.JsonRpcProvider(http_provider_url);

const contractFactory = new ethers.ContractFactory(contract_abi, contract_data);
const constructor_inputs = contractFactory.interface.deploy.inputs;

getDeployTx();
async function getDeployTx() {
  try {
    const fixed_args = contract_args.map((arg, i) => {
      const spec = constructor_inputs[i];
      return _fixupArg(arg, spec);
    });
    console.error('fixed_args:', ...fixed_args);
    const tx = contractFactory.getDeployTransaction(...fixed_args);

    const remoteGasPrice = await infuraProvider.getGasPrice();
    const gasPrice = gas_override || remoteGasPrice;

    const nonce = await infuraProvider.getTransactionCount(from_addr);
    const gas = await infuraProvider.estimateGas({
      from: from_addr,
      to: 0x0,
      value: 0,
      data: tx.data,
      gasPrice: gasPrice.toString(),
      nonce,
      chain,
    });

    const gasEth = parseFloat(ethers.utils.formatEther(gas.mul(gasPrice)));
    console.error(
      'GasPrice: ' + web3.utils.fromWei(gasPrice.toString(), 'gwei') + ' (gwei)'
    );
    console.error('TX Total Cost in Eth:', gasEth + ' (eth)');
    if (gasEth > GAS_LIMIT_ETH) {
      console.error(
        'Gas cost over limit in eth, gasEth:',
        gasEth,
        'GAS_LIMIT_ETH:',
        GAS_LIMIT_ETH
      );
      throw 'too_expensive';
    }

    _origLog(
      JSON.stringify(
        {
          from: from_addr,
          value: 0,
          gas: gas.toString(),
          gasPrice: gasPrice.toString(),
          data: tx.data,
          nonce,
          chain,
        },
        null,
        ' '
      )
    );
  } catch (e) {
    console.error('threw:', e);
  }
}

function _fixupArg(value, spec) {
  let ret = value;
  if (spec.type === 'uint256' && value.indexOf('gwei') !== -1) {
    value = ethers.utils.parseUnits(value.split('gwei')[0], 'gwei').toString();
  } else if (spec.type === 'uint256' && value.indexOf('eth') !== -1) {
    value = ethers.utils.parseUnits(value.split('eth')[0], 'ether').toString();
  }
  return value;
}
