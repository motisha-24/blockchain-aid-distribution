// ================================================================
//  truffle-config.js
//  Supports LOCAL Ganache and CLOUD Alchemy Sepolia
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const INFURA_URL  = process.env.INFURA_URL;

module.exports = {

  networks: {

    // ── LOCAL — Ganache ───────────────────────────────────
    development: {
      host      : "127.0.0.1",
      port      : 7545,
      network_id: "*",
      gas       : 6721975
    },

    // ── CLOUD — Alchemy Sepolia ───────────────────────────
    sepolia: {
      provider: () => new HDWalletProvider(
        PRIVATE_KEY,
        INFURA_URL
      ),
      network_id   : "11155111",
      gas          : 4465030,
      gasPrice     : 5000000000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun   : true
    },

  },

  // ── Solidity compiler settings ────────────────────────────
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs   : 200
        }
      }
    }
  },

};
