const ethers = require('ethers');
const AppConfig = require('../config.json');
const config = require('../config.json');
const web3 = require('web3');
const fs = require('fs');
const argv = process.argv.slice(2);
const { chain, http_provider_url, gas_override } = require('./settings.js');

if (argv.length < 3) {
  console.log(
    'Usage: contract_tester.js <abi> <contract_addr> <from> <method> [args]'
  );
  process.exit(-1);
}

const _origLog = console.log;
console.log = console.error;

const GAS_LIMIT_ETH = 0.01;
const infuraProvider = new ethers.providers.JsonRpcProvider(http_provider_url);

const contract_abi_path = argv[0];
const contract_addr = argv[1];
const from_addr = argv[2];
const method = argv[3];
const call_args = argv.slice(4);

console.error('Reading contract abi from path:', contract_abi_path);
const contract_abi = JSON.parse(fs.readFileSync(contract_abi_path, 'utf8'));

const contract = new ethers.Contract(
  contract_addr,
  contract_abi,
  infuraProvider
);
const contract_interface = new ethers.utils.Interface(contract_abi);

getContractTx();

async function getContractTx() {
  try {
    if (contract_interface.functions[method].type === 'call') {
      const ret = await contract.functions[method](...call_args, {
        from: from_addr,
      });
      console.error('static call ret:', ret);
      process.exit(0);
    }

    const gas = await contract.estimate[method](...call_args, {
      from: from_addr,
    });
    const remoteGasPrice = await infuraProvider.getGasPrice();
    const gasPrice = gas_override || remoteGasPrice;
    const gasEth = parseFloat(ethers.utils.formatEther(gas.mul(gasPrice)));

    const etherscanProvider = new ethers.providers.EtherscanProvider();
    const ethUSD = await etherscanProvider.getEtherPrice();
    const gasUSD = ethUSD * gasEth;

    console.error(
      'GasPrice: ' + web3.utils.fromWei(gasPrice.toString(), 'gwei') + ' (gwei)'
    );
    console.error(
      'TX Total Cost in Eth:',
      gasEth + ' (eth)',
      'USD: $' + gasUSD.toFixed(4)
    );
    if (gasEth > GAS_LIMIT_ETH) {
      console.error(
        'Gas cost over limit in eth, gasEth:',
        gasEth,
        'GAS_LIMIT_ETH:',
        GAS_LIMIT_ETH
      );
      throw 'too_expensive';
    }

    const call_abi = contract_interface.functions[method].encode(call_args);
    const nonce = await infuraProvider.getTransactionCount(from_addr);

    _origLog(
      JSON.stringify(
        {
          from: from_addr,
          to: contract_addr,
          value: 0,
          gas: gas.toString(),
          gasPrice: gasPrice.toString(),
          data: call_abi,
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
