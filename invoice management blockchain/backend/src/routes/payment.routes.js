const express = require('express')
const paymentController = require('../controllers/payment.controller')

const router = express.Router()

router.get('/invoices/:id/payments', paymentController.listInvoicePayments)
router.post('/invoices/:id/payments', paymentController.createInvoicePayment)
router.get('/payments/:id', paymentController.getPayment)
router.post('/payments/crypto', paymentController.createCryptoPayment)
router.post('/payments/:id/verify-chain', paymentController.verifyChain)

module.exports = router
