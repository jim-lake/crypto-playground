
const Web3 = require('web3');
const BN = Web3.utils.BN;
const AppConfig = require('../config.json');
const config = require('../config.json');
const contract_abi = require('../contracts/DCToken.abi.json');
const argv = process.argv.slice(2);
const fs = require('fs');
const ethers = require('ethers');
const {
  contract_addr,
  http_provider_url,
  chain,
} = require('./settings.js');

const GAS_LIMIT_ETH = 0.01;

if (argv.length < 3) {
  console.error("Usage deploy_contact.js <contract_bin_path> <coin_name> <symbol>");
  process.exit(-1);
}

const contract_path = argv[0];
const coin_name = argv[1];
const coin_symbol = argv[2];
console.error("Reading contract from path:",contract_path);
const contract_data = "0x" + fs.readFileSync(contract_path,'utf8');

const web3 = new Web3(new Web3.providers.HttpProvider(http_provider_url));

const contract_src = AppConfig.MINT_SRC;
const contract = new web3.eth.Contract(contract_abi);

getDeployTx();

async function getDeployTx() {
  try {
    const initialAmount = web3.utils.toWei("1000");

    contract.defaultAccount = contract_src;
    const deploy_opts = {
      data: contract_data,
      arguments: [coin_name,coin_symbol,initialAmount],
    };
    const deploy = contract.deploy(deploy_opts);

    const gas = await deploy.estimateGas();
    const gasPrice = await web3.eth.getGasPrice();

    const gasEth = web3.utils.fromWei(new BN(gas).mul(new BN(gasPrice)));
    const etherscanProvider = new ethers.providers.EtherscanProvider();
    const ethUSD = await etherscanProvider.getEtherPrice();
    const gasUSD = ethUSD * gasEth;

    console.error("Creating coin:",coin_name,"(" + coin_symbol + ")");
    console.error("Gas Price in Eth:",gasEth + " (eth)","USD: $" + gasUSD.toFixed(4));

    if (gasEth > GAS_LIMIT_ETH) {
      console.error("Gas cost over limit in eth, gasEth:",gasEth,"GAS_LIMIT_ETH:",GAS_LIMIT_ETH);
      throw "too_expensive";
    }

    const data = deploy.encodeABI();
    const nonce = await web3.eth.getTransactionCount(contract_src);

    console.log(JSON.stringify({
      from: contract_src,
      value: 0,
      gas,
      gasPrice,
      data,
      nonce,
      chain,
    },null," "));
  } catch (e) {
    console.error("threw:",e);
  }
}
