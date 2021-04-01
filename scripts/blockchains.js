module.exports = {
  mainnet: {
    DNC_CONTRACT: '0xf220af718a8d13cce7f5a466722f2b5857cd4215',
    HTTP_PROVIDER:
      'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  },
  ropsten: {
    DNC_CONTRACT: '0xf220af718a8d13cce7f5a466722f2b5857cd4215',
    HTTP_PROVIDER:
      'https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
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
  xdia: {
    DNC_CONTRACT: '',
    HTTP_PROVIDER: 'https://dai.poa.network',
    CHAIN_ID: 100,
    GAS_OVERRIDE: 1e9,
  },
};
