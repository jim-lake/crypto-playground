const fs = require('fs');
const request = require('request');
const config = require('../config.json');
const argv = process.argv.slice(2);

const { COIN, CHAIN } = require('./bitcoin_settings');

if (argv.length < 1) {
  console.error('Usage: bitcoin_send.js <tx_string|filename>');
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

const opts = {
  url: `https://api.blockcypher.com/v1/${COIN}/${CHAIN}/txs/push`,
  method: 'POST',
  json: {
    tx: signed_tx,
  },
};
request(opts, (err, response, body) => {
  if (err) {
    console.error('failed:', err, body);
  } else if (response && response.statusCode > 299) {
    console.error('bad status:', response.statusCode, body);
  } else {
    console.log('result:', body);
  }
});
