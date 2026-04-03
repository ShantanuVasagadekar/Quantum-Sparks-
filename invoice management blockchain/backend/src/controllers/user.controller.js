const { z } = require('zod')
const userService = require('../services/user.service')
const { isValidAlgorandAddress } = require('../utils/algorand.util')

const walletSchema = z.object({
  wallet_address: z.string().min(1)
})

async function updateMyWallet(req, res, next) {
  try {
    const payload = walletSchema.parse(req.body || {})

    if (!isValidAlgorandAddress(payload.wallet_address)) {
      return res.status(400).json({ error: 'Invalid Algorand wallet address' })
    }

    const result = await userService.attachWalletAddress(req.user.id, payload.wallet_address)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  updateMyWallet
}
