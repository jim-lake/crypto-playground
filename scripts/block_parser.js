const rlp = require('rlp');
const Common = require('ethereumjs-common').default;
const mainnetGenesisState = require('ethereumjs-common/dist/genesisStates/mainnet');
const Block = require('ethereumjs-block');
const fs = require('fs');
const argv = process.argv.slice(2);

const common = new Common('mainnet');
const data = fs.readFileSync(argv[0]);

let remainder = data;
while (remainder.length > 0) {
  const rlp_ret = rlp.decode(remainder, true);
  remainder = rlp_ret.remainder;
  const decoded = rlp_ret.data;

  const b = new Block(decoded);

  let blocknumber = 0;
  if (b.header.number.length > 0) {
    console.log(b.header.number);
    blocknumber = b.header.number.readUIntBE(0, b.header.number.length);
  }
  const baseReward = common.paramByBlock('pow', 'minerReward', blocknumber);

  console.log('hash:', b.hash().toString('hex'));
  console.log('coinbase(miner):', '0x' + b.header.coinbase.toString('hex'));
  console.log('block number:', blocknumber);
  console.log('baseReward:', baseReward);
  console.log('transactions:', b.transactions.length);
  console.log('uncles:', b.uncleHeaders);

  if (blocknumber === 0) {
    console.log('should add genesis state');
    //console.log("state:",mainnetGenesisState);
  }
  console.log('');
  console.log('-----------------');
  console.log('');
}

console.log('done done');
