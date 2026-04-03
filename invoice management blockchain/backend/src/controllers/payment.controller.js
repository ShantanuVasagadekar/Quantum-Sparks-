const { z } = require('zod')
const paymentService = require('../services/payment.service')

const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  payment_date: z.string().optional(),
  payment_method: z.enum(['cash', 'bank', 'upi', 'algo', 'manual']),
  reference_number: z.string().optional(),
  algo_tx_id: z.string().optional(),
  algo_sender_address: z.string().optional(),
  algo_verified: z.boolean().optional(),
  notes: z.string().optional()
})

const verifySchema = z.object({
  algo_tx_id: z.string().optional(),
  algo_sender_address: z.string().optional()
})
const cryptoPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  txn_id: z.string().min(1)
})

async function listInvoicePayments(req, res, next) {
  try {
    const data = await paymentService.listInvoicePayments(req.user.id, req.params.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function createInvoicePayment(req, res, next) {
  try {
    const payload = paymentSchema.parse(req.body)
    const data = await paymentService.recordPayment(req.user.id, req.params.id, payload)
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
}

async function getPayment(req, res, next) {
  try {
    const data = await paymentService.getPaymentById(req.user.id, req.params.id)
    if (!data) return res.status(404).json({ error: 'Payment not found' })
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function verifyChain(req, res, next) {
  try {
    const payload = verifySchema.parse(req.body || {})
    const data = await paymentService.verifyChainPayment(req.user.id, req.params.id, payload)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function createCryptoPayment(req, res, next) {
  try {
    const payload = cryptoPaymentSchema.parse(req.body || {})
    const data = await paymentService.recordCryptoPayment(req.user.id, payload)
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  listInvoicePayments,
  createInvoicePayment,
  getPayment,
  verifyChain,
  createCryptoPayment
}
