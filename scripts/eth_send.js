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
  console.log('Usage: eth_send.js <from> <to> <amount>');
  process.exit(-1);
}

const _origLog = console.log;
console.log = console.error;

const GAS_LIMIT_ETH = gas_limit || 0.1;
const infuraProvider = new ethers.providers.JsonRpcProvider(http_provider_url);

const from_addr = argv[0];
const to_addr = argv[1];
let amount = argv[2];
if (amount.indexOf('eth')) {
  amount = ethers.utils.parseUnits(amount.split('eth')[0], 'ether').toString();
}

getTx();

async function getTx() {
  try {
    const nonce = await infuraProvider.getTransactionCount(from_addr);

    console.log('gasPrice:', (await infuraProvider.getGasPrice()).toString());
    const feeData = await infuraProvider.getFeeData();
    const {
      gasPrice: remoteGasPrice,
      maxPriorityFeePerGas,
      maxFeePerGas,
    } = feeData;
    console.log('feeData.gasPrice:', remoteGasPrice.toString());
    let gasData = null;
    let gasEth;
    const gas = ethers.BigNumber.from('21000');
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

    _origLog(
      JSON.stringify(
        {
          from: from_addr,
          to: to_addr,
          value: ethers.BigNumber.from(amount).toHexString(),
          gas: gas.toString(),
          ...gasData,
          nonce,
          chain,
          data: '',
        },
        null,
        ' '
      )
    );
  } catch (e) {
    console.error('threw:', e);
  }
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
