const ethers = require('ethers');

const argv = process.argv.slice(2);
const fs = require('fs');

if (argv.length !== 2) {
  console.error('Usage: sign_text.js <message> <signature>');
  process.exit(-1);
}

const message = argv[0];
const signature = argv[1];
console.error("input:");
console.error("--------");

let digest = message;
if (message.startsWith('0x')) {
  digest = message;
} else {
  digest = ethers.utils.id("\x19Ethereum Signed Message:\n" + message.length + message);
}
console.error("message:", message);
console.error("digest:", digest);
console.error("signature:", signature);

const address = ethers.utils.recoverAddress(digest, signature);
console.error("");
console.error("output:");
console.error("--------");
console.error('Signing Address:', address);
