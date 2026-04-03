const { algodClient } = require('../services/algorand.service')

async function txById(req, res, next) {
  try {
    const tx = await algodClient.pendingTransactionInformation(req.params.txId).do()
    res.json(tx)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  txById
}
