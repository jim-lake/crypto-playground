
const fs = require('fs');
const Web3 = require('web3');
const AppConfig = require('../config.json');
const config = require('../config.json');
const argv = process.argv.slice(2);
const {
  http_provider_url,
} = require('./settings.js');

if (argv.length < 1) {
  console.error("Usage: send_tx.js <tx_string|filename>");
  process.exit(-99);
}

let signed_tx;
if (fs.existsSync(argv[0])) {
  console.error("reading tx string from:",argv[0]);
  signed_tx = fs.readFileSync(argv[0],'utf8').trim();
} else if (argv[0] === '-'){
  console.error("reading tx string from stdin");
  signed_tx = fs.readFileSync(0,'utf8').trim();
} else {
  console.error("reading tx string from args");
  signed_tx = argv[0].trim();
}

const web3 = new Web3(new Web3.providers.HttpProvider(http_provider_url));

const VERIFY_BLOCKS = 5;

sendTx();

async function sendTx() {
  try {
    console.log("sending tx: 0x" + signed_tx);
    const receipt = await web3.eth.sendSignedTransaction("0x" + signed_tx);
    const { transactionHash, blockNumber } = receipt;
    console.log("Receipt Data:");
    console.log(JSON.stringify(receipt,null," "));
    console.log("");
    if (!receipt.status) {
      throw "bad status returned:" + receipt.status;
    }

    console.log(`waiting ${VERIFY_BLOCKS} for confirmations`);
    let waited = false;
    while (!waited) {
      await timeout(10*1000);

      const curr_block = await web3.eth.getBlockNumber();
      const delta_blocks = curr_block - blockNumber;
      console.log("  loop: delta_blocks:",delta_blocks);

      if (delta_blocks >= VERIFY_BLOCKS) {
        waited = true;
      }
    }

    console.log("Double checking transaction:",transactionHash);
    const receipt2 = await web3.eth.getTransaction(transactionHash);

    if (!receipt2) {
      console.log("verify failed:",receipt2);
      throw "bad verify receipt2";
    }

    if (receipt2.blockNumber !== blockNumber) {
      console.log("verify failed, block number changed, please verify manually, receipt2:",receipt2);
      throw "bad verify block number";
    }

    console.log("success!!");
  } catch (e) {
    console.error("FAILED:",e);
  }
}

function timeout(ms) {
  return new Promise(res => setTimeout(res,ms));
}
