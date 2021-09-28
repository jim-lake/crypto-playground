module.exports = {
  mainnet: {
    DNC_CONTRACT: '0xf220af718a8d13cce7f5a466722f2b5857cd4215',
    HTTP_PROVIDER:
      'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  },
  rinkeby: {
    DNC_CONTRACT: '0xf220af718a8d13cce7f5a466722f2b5857cd4215',
    HTTP_PROVIDER:
      'https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    GAS_LIMIT: 1,
  },
  ropsten: {
    DNC_CONTRACT: '0xf220af718a8d13cce7f5a466722f2b5857cd4215',
    HTTP_PROVIDER:
      'https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  },
  goerli: {
    DNC_CONTRACT: '',
    HTTP_PROVIDER:
      'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  },
  sokol: {
    DNC_CONTRACT: '',
    HTTP_PROVIDER: 'https://sokol.poa.network',
    CHAIN_ID: 77,
  },
  kovan: {
    DNC_CONTRACT: '',
    HTTP_PROVIDER:
      'https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  },
  xdai: {
    DNC_CONTRACT: '',
    HTTP_PROVIDER: 'https://dai.poa.network',
    CHAIN_ID: 100,
    GAS_OVERRIDE: 1e9,
  },
  aurora: {
    DNC_CONTRACT: '',
    HTTP_PROVIDER: 'https://mainnet.aurora.dev',
    CHAIN_ID: 1313161554,
    GAS_OVERRIDE: 0,
  },
  aurora_testnet: {
    DNC_CONTRACT: '',
    HTTP_PROVIDER: 'https://testnet.aurora.dev',
    CHAIN_ID: 1313161555,
    GAS_OVERRIDE: 0,
  },
};
