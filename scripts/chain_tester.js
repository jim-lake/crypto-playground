const Bip39 = require('bip39');
const HDKey = require('ethereumjs-wallet/hdkey');
const ethers = require('ethers');
const config = require('../config.json');
const argv = process.argv.slice(2);
const fs = require('fs');

let list = [];

argv.forEach((arg) => {
  const hash = ethers.utils.id(arg);
  console.log('Arg:', arg, 'Hash:', hash);
  console.log('');
  list.push(hash);
});

const all = ethers.utils.concat(list);
console.log('Hash of all:', ethers.utils.keccak256(all));
console.log('');
