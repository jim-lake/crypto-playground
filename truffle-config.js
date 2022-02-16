module.exports = {
  networks: {},
  mocha: {},
  contracts_directory: "./contracts/truffle/",
  compilers: {
    solc: {
      version: '0.8.9',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        evmVersion: 'istanbul',
      },
    },
  },
};
