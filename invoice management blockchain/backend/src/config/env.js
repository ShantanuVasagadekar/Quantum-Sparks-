const dotenv = require('dotenv')

dotenv.config()

module.exports = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  demoUserId: process.env.DEMO_USER_ID || '',
  algodServer: process.env.ALGO_NODE_URL || process.env.ALGORAND_ALGOD_SERVER || 'https://testnet-api.algonode.cloud',
  algodPort: process.env.ALGO_NODE_PORT || process.env.ALGORAND_ALGOD_PORT || '',
  algodToken: process.env.ALGO_NODE_TOKEN || process.env.ALGORAND_ALGOD_TOKEN || '',
  indexerServer: process.env.ALGO_INDEXER_URL || process.env.ALGORAND_INDEXER_SERVER || 'https://testnet-idx.algonode.cloud',
  indexerPort: process.env.ALGO_INDEXER_PORT || process.env.ALGORAND_INDEXER_PORT || '',
  indexerToken: process.env.ALGO_INDEXER_TOKEN || process.env.ALGORAND_INDEXER_TOKEN || '',
  anchorMnemonic: process.env.ALGORAND_ANCHOR_MNEMONIC || '',
  anchorReceiver: process.env.ALGORAND_ANCHOR_RECEIVER || '',
  explorerBaseUrl: process.env.ALGORAND_EXPLORER_BASE_URL || 'https://testnet.algoexplorer.io/tx/',
  overdueJobIntervalMs: Number(process.env.OVERDUE_JOB_INTERVAL_MS || 60000),
  businessName: process.env.BUSINESS_NAME || 'Your Business Name',
  businessAddress: process.env.BUSINESS_ADDRESS || '123 Street Address',
  businessCityState: process.env.BUSINESS_CITY_STATE || 'Mumbai, MH 400001',
  businessPhone: process.env.BUSINESS_PHONE || '(000) 000-0000',
  businessEmail: process.env.BUSINESS_EMAIL || 'contact@yourbusiness.com',
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS
}
