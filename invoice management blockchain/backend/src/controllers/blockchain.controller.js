const { algodClient } = require('../services/algorand.service')
const { getVibeKitConfig } = require('../services/vibekit.service')

async function txById(req, res, next) {
  try {
    const tx = await algodClient.pendingTransactionInformation(req.params.txId).do()
    res.json(tx)
  } catch (error) {
    next(error)
  }
}

function vibekitConfig(req, res) {
  res.json(getVibeKitConfig())
}

module.exports = {
  txById,
  vibekitConfig
}
