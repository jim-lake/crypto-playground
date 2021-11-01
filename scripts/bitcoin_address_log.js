const request = require('request');
const argv = process.argv.slice(2);

const { COIN, CHAIN } = require('./bitcoin_settings');

if (argv.length < 1) {
  console.error('Usage: bitcoin_address_log.js <addesss>');
  process.exit(-99);
}

const address = argv[0];
console.log('getting log for address:', address);
const opts = {
  url: `https://api.blockcypher.com/v1/${COIN}/${CHAIN}/addrs/${address}?limit=2000`,
  method: 'GET',
  json: true,
};
request(opts, (err, response, body) => {
  if (err) {
    console.error('failed:', err, body);
  } else if (response && response.statusCode > 299) {
    console.error('bad status:', response.statusCode, body);
  } else {
    const { txrefs, final_balance, unconfirmed_balance } = body;
    console.log('final_balance:', final_balance / 1e8);
    console.log('unconfirmed_balance:', unconfirmed_balance / 1e8);
    if (txrefs) {
      txrefs.forEach((tx) => {
        const { block_height, value, tx_hash, confirmations } = tx;
        console.log(
          'block:',
          block_height,
          'confirmations:',
          confirmations,
          'hash:',
          tx_hash
        );
        console.log('  - value:', value / 1e8);
      });
    }
  }
});
