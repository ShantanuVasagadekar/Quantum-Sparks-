const { z } = require('zod')
const env = require('../config/env')
const invoiceService = require('../services/invoice.service')
const { generateInvoicePDF } = require('../services/pdfGenerator')

const lineItemSchema = z.object({
  description: z.string().optional(),
  name: z.string().optional(),
  quantity: z.coerce.number().positive().optional(),
  qty: z.coerce.number().positive().optional(),
  unit_price: z.coerce.number().nonnegative().optional(),
  rate: z.coerce.number().nonnegative().optional()
}).transform((item) => ({
  description: item.description || item.name,
  quantity: Number(item.quantity ?? item.qty),
  unit_price: Number(item.unit_price ?? item.rate)
}))

const invoiceCreateSchema = z.object({
  client_id: z.string().min(1).optional(),
  client_name: z.string().min(1).optional(),
  invoice_number: z.string().min(1).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  currency: z.string().optional(),
  tax_amount: z.coerce.number().nonnegative().optional(),
  discount_amount: z.coerce.number().nonnegative().optional(),
  total_amount: z.coerce.number().nonnegative().optional(),
  issue_date: z.string().optional(),
  due_date: z.string().optional(),
  metadata: z.any().optional(),
  line_items: z.array(lineItemSchema).min(1)
}).refine(data => data.client_id || data.client_name, {
  message: "Either client_id or client_name must be provided"
})

const invoiceUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  due_date: z.string().optional(),
  total_amount: z.coerce.number().nonnegative().optional()
})

async function list(req, res, next) {
  try {
    console.log('[invoices.list] user', req.user.id, 'query', req.query)
    const data = await invoiceService.listInvoices(req.user.id, req.query)
    res.json(data)
  } catch (error) {
    console.error('[invoices.list] failed', error)
    res.status(error.status || 500).json({ error: error.message || 'Failed to fetch invoices' })
  }
}

async function create(req, res, next) {
  try {
    console.log('[invoices.create] user', req.user.id, 'body', req.body)
    const payload = invoiceCreateSchema.parse(req.body)
    for (const item of payload.line_items) {
      if (!item.description || Number.isNaN(item.quantity) || Number.isNaN(item.unit_price)) {
        return res.status(400).json({ error: 'Invalid line_items. Expected name/description, qty/quantity, rate/unit_price.' })
      }
    }
    const data = await invoiceService.createInvoice(req.user.id, payload)
    res.status(201).json(data)
  } catch (error) {
    console.error('[invoices.create] failed', error)
    if (error && error.issues) {
      return res.status(400).json({ error: 'Validation error', details: error.issues })
    }
    res.status(error.status || 500).json({ error: error.message || 'Failed to create invoice' })
  }
}

async function getById(req, res, next) {
  try {
    const data = await invoiceService.getInvoiceById(req.user.id, req.params.id)
    if (!data) return res.status(404).json({ error: 'Invoice not found' })
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function update(req, res, next) {
  try {
    const payload = invoiceUpdateSchema.parse(req.body)
    const data = await invoiceService.updateInvoice(req.user.id, req.params.id, payload)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function send(req, res, next) {
  try {
    const data = await invoiceService.sendInvoice(req.user.id, req.params.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function cancel(req, res, next) {
  try {
    const data = await invoiceService.cancelInvoice(req.user.id, req.params.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function anchor(req, res, next) {
  try {
    const data = await invoiceService.anchorInvoice(req.user.id, req.params.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function events(req, res, next) {
  try {
    const data = await invoiceService.getInvoiceEvents(req.user.id, req.params.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function reminder(req, res, next) {
  try {
    const data = await invoiceService.generateReminder(req.user.id, req.params.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function timeline(req, res, next) {
  try {
    const data = await invoiceService.getInvoiceTimeline(req.user.id, req.params.id)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function pdf(req, res, next) {
  try {
    const data = await invoiceService.getInvoicePdfData(req.user.id, req.params.id)
    const business = {
      company_name: env.businessName,
      address: env.businessAddress,
      city_state_zip: env.businessCityState,
      phone: env.businessPhone,
      email: env.businessEmail
    }
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${data.invoice.invoice_number}.pdf"`)
    const pdfStream = generateInvoicePDF(data.invoice, data.client, data.lineItems, data.payments, business)
    pdfStream.pipe(res)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  list,
  create,
  getById,
  update,
  send,
  cancel,
  anchor,
  events,
  reminder,
  timeline,
  pdf
}
