const { z } = require('zod')
const pool = require('../config/db')
const invoiceService = require('../services/invoice.service')
const paymentService = require('../services/payment.service')

const disputeSchema = z.object({
  reason: z.string().optional()
})

const acceptSchema = z.object({
  accepted_by: z.string().optional(),
  acceptance_note: z.string().optional()
})

async function resolveInvoiceByToken(token) {
  const { rows } = await pool.query(
    'SELECT id, user_id FROM invoices WHERE portal_token = $1',
    [token]
  )
  if (!rows[0]) throw new Error('Invalid or expired portal token')
  return rows[0]
}

async function getInvoice(req, res, next) {
  try {
    const { token } = req.params
    const { id, user_id } = await resolveInvoiceByToken(token)
    
    // Fetch full invoice detail using the standard service method
    const data = await invoiceService.getInvoiceById(user_id, id)
    if (!data) return res.status(404).json({ error: 'Invoice not found' })
    
    // We intentionally return the full data for the portal to render the PDF
    res.json(data)
  } catch (error) {
    if (error.message === 'Invalid or expired portal token') {
      return res.status(404).json({ error: error.message })
    }
    next(error)
  }
}

async function accept(req, res, next) {
  try {
    const { token } = req.params
    const payload = acceptSchema.parse(req.body)
    const { id, user_id } = await resolveInvoiceByToken(token)
    
    const data = await invoiceService.acceptInvoice(user_id, id, {
      accepted_by: payload.accepted_by || 'Client (via Portal)',
      acceptance_note: payload.acceptance_note || 'Terms electronically accepted'
    })
    
    res.json(data)
  } catch (error) {
    if (error.message === 'Invalid or expired portal token') {
      return res.status(404).json({ error: error.message })
    }
    next(error)
  }
}

async function dispute(req, res, next) {
  try {
    const { token } = req.params
    const payload = disputeSchema.parse(req.body)
    const { id, user_id } = await resolveInvoiceByToken(token)
    
    const data = await invoiceService.disputeInvoice(user_id, id, {
      reason: payload.reason || 'Disputed via Portal'
    })
    
    res.json(data)
  } catch (error) {
    if (error.message === 'Invalid or expired portal token') {
      return res.status(404).json({ error: error.message })
    }
    next(error)
  }
}

async function createCryptoPayment(req, res, next) {
  try {
    const { token } = req.params
    const payload = req.body
    const { id, user_id } = await resolveInvoiceByToken(token)

    const data = await paymentService.createCryptoPayment(user_id, id, payload)
    res.json(data)
  } catch (error) {
    if (error.message === 'Invalid or expired portal token') {
      return res.status(404).json({ error: error.message })
    }
    next(error)
  }
}

async function recordPayment(req, res, next) {
  try {
    const { token } = req.params
    const payload = req.body // Expects amount, payment_mode, reference_number, notes
    const { id, user_id } = await resolveInvoiceByToken(token)

    const data = await paymentService.recordPayment(user_id, id, {
      amount: payload.amount,
      payment_mode: payload.payment_mode,
      reference_number: payload.reference_number || 'PORTAL-PAY',
      notes: payload.notes || 'Recorded by Client via Portal'
    })
    res.json(data)
  } catch (error) {
    if (error.message === 'Invalid or expired portal token') {
      return res.status(404).json({ error: error.message })
    }
    next(error)
  }
}

module.exports = {
  getInvoice,
  accept,
  dispute,
  createCryptoPayment,
  recordPayment
}
