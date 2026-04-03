const express = require('express')
const invoiceController = require('../controllers/invoice.controller')
const blockchainController = require('../controllers/blockchain.controller')

const router = express.Router()

router.post('/invoices/:id/anchor', invoiceController.anchor)
router.get('/tx/:txId', blockchainController.txById)

module.exports = router
