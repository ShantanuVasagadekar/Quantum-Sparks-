const express = require('express')
const invoiceController = require('../controllers/invoice.controller')

const router = express.Router()

router.get('/', invoiceController.list)
router.post('/', invoiceController.create)
router.get('/:id', invoiceController.getById)
router.patch('/:id', invoiceController.update)
router.post('/:id/send', invoiceController.send)
router.post('/:id/cancel', invoiceController.cancel)
router.post('/:id/anchor', invoiceController.anchor)
router.post('/:id/accept', invoiceController.accept)
router.post('/:id/dispute', invoiceController.dispute)
router.get('/:id/verify', invoiceController.verify)
router.get('/:id/events', invoiceController.events)
router.post('/:id/reminder', invoiceController.reminder)
router.get('/:id/timeline', invoiceController.timeline)
router.get('/:id/pdf', invoiceController.pdf)

module.exports = router
