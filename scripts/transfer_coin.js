const ethers = require('ethers');
const AppConfig = require('../config.json');
const config = require('../config.json');
const contract_abi = require('../contracts/DCToken.abi.json');
const web3 = require('web3');
const argv = process.argv.slice(2);
const { chain, http_provider_url, contract_addr } = require('./settings.js');

if (argv.length < 3) {
  console.log('Usage: transfer_coin.js <src> <dest> <amount>');
  process.exit(-1);
}

const GAS_LIMIT_ETH = 0.0001;
const infuraProvider = new ethers.providers.JsonRpcProvider(http_provider_url);

const src = argv[0];
const dest = argv[1];
const amount = ethers.utils.parseEther(argv[2]);

const contract = new ethers.Contract(
  contract_addr,
  contract_abi,
  infuraProvider
);
const contract_interface = new ethers.utils.Interface(contract_abi);

getContractTx();

async function getContractTx() {
  try {
    const gas = await contract.estimate.transfer(dest, amount, { from: src });
    const gasPrice = await infuraProvider.getGasPrice();
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

    const call_abi = contract_interface.functions.transfer.encode([
      dest,
      amount,
    ]);
    const nonce = await infuraProvider.getTransactionCount(src);

    console.log(
      JSON.stringify(
        {
          from: src,
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
