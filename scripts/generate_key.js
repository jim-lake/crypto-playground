const Bip39 = require('bip39');
const crypto = require('crypto');
const HDKey = require('ethereumjs-wallet/hdkey');

generateKey();

async function generateKey() {
  try {
    const private_key = await crypto.randomBytes(32).toString('hex');
    console.log('Private Key:', private_key);

    const mnemonic = Bip39.entropyToMnemonic(private_key);
    console.log('Mnemonic:', mnemonic);

    const seed = Bip39.mnemonicToSeedSync(mnemonic);
    const hdwallet = HDKey.fromMasterSeed(seed);
    const path = "m/44'/60'/0'/0/0";
    const wallet = hdwallet.derivePath(path).getWallet();
    const eth_address = '0x' + wallet.getAddress().toString('hex');

    console.log('Ether Address:', eth_address);
    const xpub = hdwallet.publicExtendedKey();
    console.log('xpub:', xpub);
  } catch (e) {
    console.log('throw:', e);
  }
}
