const ethers = require('ethers');
const fs = require('fs');
const argv = process.argv.slice(2);

if (argv.length < 1) {
  console.log('Usage: contract_tester.js <abi> [map_file]');
  process.exit(-1);
}
const contract_abi_path = argv[0];
const map_file = argv[1];

console.error('Reading contract abi from path:', contract_abi_path);
const contract_abi = JSON.parse(fs.readFileSync(contract_abi_path, 'utf8'));
const contract_interface = new ethers.utils.Interface(contract_abi);

let obj = {};
if (map_file) {
  obj = JSON.parse(fs.readFileSync(map_file, 'utf8'));
}
const partial = {};
for (let key in contract_interface.functions) {
  const func = contract_interface.functions[key];
  if (func.constant) {
    continue;
  }
  const sighash = contract_interface.getSighash(func);
  const args = func.inputs.map(
    (input) => input.type + ' ' + _clean(input.name)
  );
  const sig = `${func.name}(${args.join(',')})`;
  obj[sighash] = sig;
  partial[sighash] = sig;
}

console.log(JSON.stringify(partial, null, ' '));

if (map_file) {
  fs.writeFileSync(map_file, JSON.stringify(obj, null, ' '));
}

function _clean(s) {
  if (s[0] === '_') {
    return s.slice(1);
  }
  return s;
}
