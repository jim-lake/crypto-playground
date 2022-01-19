const ethers = require('ethers');
const AppConfig = require('../config.json');
const config = require('../config.json');
const web3 = require('web3');
const fs = require('fs');
const argv = process.argv.slice(2);
const {
  chain,
  http_provider_url,
  gas_override,
  gas_limit,
  chain_params,
} = require('./settings.js');

if (argv.length < 3) {
  console.log(
    'Usage: contract_tester.js <abi> <contract_addr> <from> <method> [args]'
  );
  process.exit(-1);
}

const _origLog = console.log;
console.log = console.error;

const GAS_LIMIT_ETH = gas_limit || 0.1;
const infuraProvider = new ethers.providers.JsonRpcProvider(http_provider_url);

const contract_abi_path = argv[0];
const contract_addr = argv[1];
const from_addr = argv[2];
const method = argv[3];

console.error('Reading contract abi from path:', contract_abi_path);
const contract_abi = JSON.parse(fs.readFileSync(contract_abi_path, 'utf8'));

const contract = new ethers.Contract(
  contract_addr,
  contract_abi,
  infuraProvider
);
const contract_interface = new ethers.utils.Interface(contract_abi);

const call_inputs = contract_interface.getFunction(method).inputs;
const call_args = argv.slice(4).map((arg, i) => {
  const spec = call_inputs[i];
  return _fixupArg(arg, spec);
});
console.error('call_args:', ...call_args);

getContractTx();

async function getContractTx() {
  try {
    if (contract_interface.getFunction(method).stateMutability === 'view') {
      const ret = await contract.functions[method](...call_args, {
        from: from_addr,
      });
      console.error('static call ret:', ret);
      process.exit(0);
    }

    const nonce = await infuraProvider.getTransactionCount(from_addr);
    const gas = await contract.estimateGas[method](...call_args, {
      from: from_addr,
      nonce,
    });

    const etherscanProvider = new ethers.providers.EtherscanProvider(
      null,
      'CRS43J3ZNGDM6ZU8YYCZSINCHNCZUG8S2Y'
    );
    const feeData = await infuraProvider.getFeeData();
    const {
      gasPrice: remoteGasPrice,
      maxPriorityFeePerGas,
      maxFeePerGas,
    } = feeData;
    let gasData = null;
    let gasEth;
    console.error('');
    if (
      !gas_override &&
      maxFeePerGas &&
      maxPriorityFeePerGas &&
      chain_params.hardfork === 'london'
    ) {
      gasData = {
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
      };
      _printGas('priorityFee:', gas, maxPriorityFeePerGas);
      gasEth = _printGas('maxFee:', gas, maxFeePerGas);
    } else {
      _printGas('remoteGasPrice:', gas, remoteGasPrice);
      const gasPrice =
        gas_override !== undefined ? gas_override : remoteGasPrice;
      gasData = {
        gasPrice: String(gasPrice),
      };
      gasEth = _printGas('picked gasPrice:', gas, gasData.gasPrice);
    }
    console.error('');

    if (gasEth > GAS_LIMIT_ETH) {
      console.error(
        'Gas cost over limit in eth, gasEth:',
        gasEth,
        'GAS_LIMIT_ETH:',
        GAS_LIMIT_ETH
      );
      throw 'too_expensive';
    }

    const fake_tx = await contract.populateTransaction[method](...call_args);
    _origLog(
      JSON.stringify(
        {
          from: from_addr,
          to: contract_addr,
          value: 0,
          gas: gas.toString(),
          ...gasData,
          data: fake_tx.data,
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
  } else if (spec.type === 'address' && value === '0x0') {
    value = '0x0000000000000000000000000000000000000000';
  }
  return value;
}
function _printGas(label, gas, gasPrice) {
  const gasEth = parseFloat(ethers.utils.formatEther(gas.mul(gasPrice)));
  console.error(
    label,
    web3.utils.fromWei(gasPrice.toString(), 'gwei') + ' (gwei)',
    'TX Total Cost in Eth:',
    gasEth + ' (eth)'
  );
  return gasEth;
}
