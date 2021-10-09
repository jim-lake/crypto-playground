const fs = require('fs');
const ethers = require('ethers');
const AppConfig = require('../config.json');
const config = require('../config.json');
const argv = process.argv.slice(2);
const { http_provider_url } = require('./settings.js');

if (argv.length < 1) {
  console.error('Usage: send_tx.js <tx_string|filename>');
  process.exit(-99);
}

let signed_tx;
if (fs.existsSync(argv[0])) {
  console.error('reading tx string from:', argv[0]);
  signed_tx = fs.readFileSync(argv[0], 'utf8').trim();
} else if (argv[0] === '-') {
  console.error('reading tx string from stdin');
  signed_tx = fs.readFileSync(0, 'utf8').trim();
} else {
  console.error('reading tx string from args');
  signed_tx = argv[0].trim();
}

const infuraProvider = new ethers.providers.JsonRpcProvider(http_provider_url);

const VERIFY_BLOCKS = 5;

sendTx();

async function sendTx() {
  try {
    console.log('sending tx: 0x' + signed_tx);
    const response = await infuraProvider.sendTransaction('0x' + signed_tx);
    const transactionHash = response.hash;
    console.log('transactionHash:', transactionHash);

    let blockNumber = null;
    console.log(`waiting ${VERIFY_BLOCKS} for confirmations`);
    let waited = false;
    while (!waited) {
      await timeout(10 * 1000);

      if (blockNumber) {
        const curr_block = await infuraProvider.getBlockNumber();
        const delta_blocks = curr_block - blockNumber;
        console.log('  loop: delta_blocks:', delta_blocks);

        if (delta_blocks >= VERIFY_BLOCKS) {
          waited = true;
        }
      } else {
        const receipt = await infuraProvider.getTransactionReceipt(
          transactionHash
        );
        if (receipt) {
          console.log('receipt:', receipt);
          blockNumber = receipt.blockNumber;
          if (blockNumber) {
            if (receipt.status === 0) {
              console.error('bad status returned:' + receipt.status);
            }
          }
        } else {
          console.log('  not mined yet....');
        }
      }
    }

    console.log('Double checking transaction:', transactionHash);
    const receipt2 = await infuraProvider.getTransactionReceipt(
      transactionHash
    );

    if (!receipt2) {
      console.log('verify failed:', receipt2);
      throw 'bad verify receipt2';
    }

    if (receipt2.blockNumber !== blockNumber) {
      console.log(
        'verify failed, block number changed, please verify manually, receipt2:',
        receipt2
      );
      throw 'bad verify block number';
    }
    if (!receipt2.status === 0) {
      console.error('bad status receipt2 returned:' + receipt2.status);
    }

    console.log('success!!');
  } catch (e) {
    console.error('FAILED:', e);
  }
}

function timeout(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
