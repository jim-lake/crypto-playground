const ethers = require('ethers');
const AppConfig = require('../config.json');
const config = require('../config.json');
const contract_abi = require('../contracts/erc721.abi.json');
const web3 = require('web3');
const argv = process.argv.slice(2);
const { chain, http_provider_url } = require('./settings.js');

if (argv.length < 0) {
  console.log('Usage: kitty_tester.js');
  process.exit(-1);
}

const GAS_LIMIT_ETH = 0.0001;
const infuraProvider = new ethers.providers.JsonRpcProvider(http_provider_url);

const contract_addr = '0x2fb5d7dda4f1f20f974a0fdd547c38674e8d940c';

const contract = new ethers.Contract(
  contract_addr,
  contract_abi,
  infuraProvider
);
const contract_interface = new ethers.utils.Interface(contract_abi);

getContractTx();

async function getContractTx() {
  try {
    //const kitty = await contract.getKitty(1);
    //console.log("kitty:",kitty);
    //console.log("");

    const name = await contract.name();
    const symbol = await contract.symbol();
    console.log('name:', name, 'symbol:', symbol);
    console.log('');

    //const tokens = await contract.tokensOfOwner("0x838147f864310aa9cc200de3ee4df11607bffc23");
    //console.log("tokens:",tokens);
    //console.log("");

    const metadata = await contract.tokenURI(19794);
    console.log('metadata:', metadata);
    console.log('');
  } catch (e) {
    console.error('threw:', e);
  }
}
