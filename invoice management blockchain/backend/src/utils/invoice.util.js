const crypto = require('crypto')

function resolveInvoiceStatus(invoice) {
  if (invoice.is_cancelled) return 'cancelled'
  if (Number(invoice.paid_amount) >= Number(invoice.total_amount)) return 'paid'
  if (invoice.due_date && new Date(invoice.due_date) < startOfToday() && Number(invoice.outstanding_amount) > 0) return 'overdue'
  if (Number(invoice.paid_amount) > 0) return 'partial'
  if (invoice.sent_at) return 'sent'
  return 'draft'
}

function startOfToday() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

/**
 * Build a deterministic, canonical payload from an invoice + its line items.
 * This is the SINGLE SOURCE OF TRUTH for what gets hashed and anchored.
 *
 * Rules:
 *  - Only include fields that define the financial commitment
 *  - Normalize all numbers to fixed-precision strings to avoid floating-point drift
 *  - Sort line items by description+unit_price to guarantee deterministic order
 *  - Never include mutable metadata (status, paid_amount, timestamps, anchored_at)
 */
function buildCanonicalPayload(invoice, lineItems) {
  const sortedItems = (lineItems || [])
    .map(item => ({
      description: String(item.description || ''),
      quantity: Number(item.quantity).toFixed(4),
      unit_price: Number(item.unit_price).toFixed(4)
    }))
    .sort((a, b) => {
      const cmp = a.description.localeCompare(b.description)
      if (cmp !== 0) return cmp
      return a.unit_price.localeCompare(b.unit_price)
    })

  return {
    id: invoice.id,
    invoice_number: String(invoice.invoice_number),
    client_id: invoice.client_id,
    issue_date: invoice.issue_date ? new Date(invoice.issue_date).toISOString().slice(0, 10) : null,
    due_date: invoice.due_date ? new Date(invoice.due_date).toISOString().slice(0, 10) : null,
    total_amount: Number(invoice.total_amount).toFixed(2),
    tax_amount: Number(invoice.tax_amount || 0).toFixed(2),
    discount_amount: Number(invoice.discount_amount || 0).toFixed(2),
    currency: String(invoice.currency || 'INR'),
    line_items: sortedItems
  }
}

/**
 * Compute the SHA-256 hash of a canonical payload.
 * Always call buildCanonicalPayload first — never hash raw invoice objects.
 */
function computeInvoiceHash(invoice, lineItems) {
  const payload = buildCanonicalPayload(invoice, lineItems)
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

module.exports = {
  resolveInvoiceStatus,
  buildCanonicalPayload,
  computeInvoiceHash
}
