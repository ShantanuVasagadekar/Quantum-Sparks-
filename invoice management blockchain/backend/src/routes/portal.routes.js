const express = require('express')
const portalController = require('../controllers/portal.controller')

const router = express.Router()

// Publicly accessible via the unguessable magic token
router.get('/:token', portalController.getInvoice)
router.post('/:token/accept', portalController.accept)
router.post('/:token/dispute', portalController.dispute)
router.post('/:token/crypto-pay', portalController.createCryptoPayment)
router.post('/:token/record-payment', portalController.recordPayment)

module.exports = router
