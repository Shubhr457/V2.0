require('@nomicfoundation/hardhat-toolbox')
require('@nomicfoundation/hardhat-verify')
require('dotenv').config()

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {},
    polygonAmoy: {
      url: process.env.RPC_URL || '',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002,
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.20',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  sourcify: {
    enabled: true,
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.Oklink_APi_key || '',
    },
    customChains: [
      {
        network: 'polygonAmoy',
        chainId: 80002,
        urls: {
          apiURL:
            'https://www.oklink.com/api/explorer/v1/contract/verify/async/api/polygonAmoy',
          browserURL: 'https://www.oklink.com/amoy',
        },
      },
    ],
  },
}
