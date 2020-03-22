const Web3 = require('web3');
const BN = Web3.utils.BN;
const AppConfig = require('../config.json');
const config = require('../config.json');
const contract_abi = require('../contracts/DCToken.abi.json');
const ethers = require('ethers');
const argv = process.argv.slice(2);
const { chain, http_provider_url, contract_addr } = require('./settings.js');

if (argv.length < 1) {
  console.error('Usage: mint.js <amount> [dest]');
  process.exit(-99);
}

const mint_amount = argv[0];
if (parseInt(mint_amount) != mint_amount) {
  console.error('Invalid mint amount:', mint_amount);
  process.exit(-99);
}

const GAS_LIMIT_ETH = 0.001;

const web3 = new Web3(new Web3.providers.HttpProvider(http_provider_url));

const mint_src = AppConfig.MINT_SRC;
const mint_dest = argv[1] || AppConfig.MINT_DEST;

if (!web3.utils.isAddress(mint_dest)) {
  console.error('Invalid dest address:', mint_dest);
  process.exit(-98);
}

const contract = new web3.eth.Contract(contract_abi, contract_addr);
getContractTx();

async function getContractTx() {
  try {
    const amount = web3.utils.toWei(mint_amount);

    contract.defaultAccount = mint_src;
    const call = contract.methods.mint(mint_dest, amount);

    const gas = await call.estimateGas();
    const gasPrice = await web3.eth.getGasPrice();
    const gasEth = web3.utils.fromWei(new BN(gas).mul(new BN(gasPrice)));
    const etherscanProvider = new ethers.providers.EtherscanProvider();
    const ethUSD = await etherscanProvider.getEtherPrice();
    const gasUSD = ethUSD * gasEth;

    console.error(
      'Mint:',
      numberWithCommas(mint_amount),
      'coins (' + numberWithCommas(amount) + ' wei)'
    );
    console.error('Dest:', mint_dest);
    console.error(
      'GasPrice: ' + web3.utils.fromWei(gasPrice, 'gwei') + ' (gwei)'
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

    const call_abi = call.encodeABI();
    const nonce = await web3.eth.getTransactionCount(mint_src);

    console.log(
      JSON.stringify(
        {
          from: mint_src,
          to: contract_addr,
          value: 0,
          gas,
          gasPrice,
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

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
