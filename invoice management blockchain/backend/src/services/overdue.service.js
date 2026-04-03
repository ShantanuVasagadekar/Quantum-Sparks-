const pool = require('../config/db')
const realtime = require('./realtime.service')

async function markOverdueInvoices() {
  const { rows } = await pool.query(
    `UPDATE invoices
     SET status = 'overdue',
         overdue_at = COALESCE(overdue_at, now()),
         updated_at = now()
     WHERE is_cancelled = false
       AND status IN ('sent', 'partial')
       AND due_date < current_date
       AND outstanding_amount > 0
     RETURNING id, user_id, status, paid_amount, outstanding_amount`
  )

  for (const row of rows) {
    await pool.query(
      `INSERT INTO invoice_events (invoice_id, event_type, event_payload)
       VALUES ($1, 'invoice.overdue', $2::jsonb)`,
      [row.id, JSON.stringify({ invoice_id: row.id, status: 'overdue' })]
    )
    realtime.emit('overdue.detected', {
      userId: row.user_id,
      invoiceId: row.id,
      status: 'overdue',
      paidAmount: row.paid_amount,
      outstandingAmount: row.outstanding_amount
    })
  }

  return rows.length
}

module.exports = {
  markOverdueInvoices
}
