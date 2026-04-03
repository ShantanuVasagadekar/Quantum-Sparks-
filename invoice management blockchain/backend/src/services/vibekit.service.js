const env = require('../config/env')

function getVibeKitConfig() {
  return {
    network: process.env.ALGO_NETWORK || 'testnet',
    algod: {
      server: env.algodServer,
      port: String(env.algodPort || ''),
      token: env.algodToken || '',
    },
    indexer: {
      server: env.indexerServer,
      port: String(env.indexerPort || ''),
      token: env.indexerToken || '',
    },
    explorerBaseUrl: env.explorerBaseUrl,
  }
}

module.exports = {
  getVibeKitConfig,
}
