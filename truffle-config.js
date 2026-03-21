require('dotenv').config();

module.exports = {

  networks: {

    // ── LOCAL Ganache Network ─────────────────────────────
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",    // Match any network ID from Ganache
    },

    // ── CLOUD Sepolia Network (add later) ─────────────────
    // sepolia: {
    //   provider: () => new HDWalletProvider(
    //     process.env.PRIVATE_KEY,
    //     process.env.INFURA_URL
    //   ),
    //   network_id: 11155111,
    //   gas: 4465030,
    // },

  },

  // Solidity compiler settings
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },

};