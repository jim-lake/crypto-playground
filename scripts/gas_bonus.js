const fs = require('fs');
const argv = process.argv.slice(2);

if (argv.length !== 1) {
  console.error('Usage: gas_bonus.js <bonus_mult>');
  process.exit(-1);
}

const tx = JSON.parse(fs.readFileSync(0, 'utf8'));
if (!tx || !tx.gasPrice) {
  console.error('bad transaction provided, please provide data on the stdin');
  process.exit(-3);
}

const mult = parseFloat(argv[0]);
const gasPrice = parseInt(tx.gasPrice);
tx.gasPrice = Math.floor(gasPrice * mult).toString();
console.log(JSON.stringify(tx, null, ' '));
