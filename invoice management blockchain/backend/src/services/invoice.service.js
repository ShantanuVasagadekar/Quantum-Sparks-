const pool = require('../config/db')
const env = require('../config/env')
const realtime = require('./realtime.service')
const { resolveInvoiceStatus } = require('../utils/invoice.util')
const { anchorInvoiceToAlgorand } = require('./algorand.service')

async function listInvoices(userId, filters) {
  const values = [userId]
  const conditions = ['i.user_id = $1']

  if (filters.status) {
    values.push(filters.status)
    conditions.push(`i.status = $${values.length}`)
  }
  if (filters.clientId) {
    values.push(filters.clientId)
    conditions.push(`i.client_id = $${values.length}`)
  }
  if (filters.from) {
    values.push(filters.from)
    conditions.push(`i.issue_date >= $${values.length}`)
  }
  if (filters.to) {
    values.push(filters.to)
    conditions.push(`i.issue_date <= $${values.length}`)
  }
  if (filters.overdue === 'true') {
    conditions.push(`i.due_date < current_date AND i.outstanding_amount > 0 AND i.is_cancelled = false`)
  }

  const { rows } = await pool.query(
    `WITH payment_profile AS (
       SELECT
         i.client_id,
         AVG(
           CASE
             WHEN fp.first_payment_date IS NULL THEN 0
             ELSE GREATEST((fp.first_payment_date - i.due_date), 0)
           END
         ) AS avg_delay_days,
         COUNT(*) FILTER (WHERE i.status = 'overdue' AND i.outstanding_amount > 0)::int AS overdue_invoices,
         COALESCE(
           AVG(
             CASE
               WHEN i.paid_amount > 0 AND i.paid_amount < i.total_amount THEN 1
               ELSE 0
             END
           ),
           0
         ) AS partial_ratio
       FROM invoices i
       LEFT JOIN (
         SELECT invoice_id, MIN(payment_date::date) AS first_payment_date
         FROM payments
         GROUP BY invoice_id
       ) fp ON fp.invoice_id = i.id
       WHERE i.user_id = $1 AND i.is_cancelled = false
       GROUP BY i.client_id
     )
     SELECT
       i.*,
       c.name AS client_name,
       COALESCE(i.paid_amount, 0)::numeric(14,2) AS paid_amount,
       (COALESCE(i.total_amount, 0) - COALESCE(i.paid_amount, 0))::numeric(14,2) AS outstanding_amount,
       LEAST(
         100,
         ROUND(
           COALESCE(pp.avg_delay_days, 0) * 6 +
           COALESCE(pp.overdue_invoices, 0) * 18 +
           COALESCE(pp.partial_ratio, 0) * 25
         )
       )::int AS risk_score,
       CASE
         WHEN LEAST(100, ROUND(COALESCE(pp.avg_delay_days, 0) * 6 + COALESCE(pp.overdue_invoices, 0) * 18 + COALESCE(pp.partial_ratio, 0) * 25)) >= 67 THEN 'High Risk'
         WHEN LEAST(100, ROUND(COALESCE(pp.avg_delay_days, 0) * 6 + COALESCE(pp.overdue_invoices, 0) * 18 + COALESCE(pp.partial_ratio, 0) * 25)) >= 34 THEN 'Medium Risk'
         ELSE 'Low Risk'
       END AS risk_level
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     LEFT JOIN payment_profile pp ON pp.client_id = i.client_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY i.created_at DESC`,
    values
  )
  return rows
}

async function getInvoiceById(userId, invoiceId) {
  const { rows } = await pool.query(
    `SELECT i.*, c.name AS client_name
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.user_id = $1 AND i.id = $2`,
    [userId, invoiceId]
  )
  if (!rows[0]) return null

  const lineItems = await pool.query(
    `SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [invoiceId]
  )
  const payments = await pool.query(
    `SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date DESC`,
    [invoiceId]
  )
  const events = await pool.query(
    `SELECT * FROM invoice_events WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [invoiceId]
  )

  return {
    ...rows[0],
    line_items: lineItems.rows,
    payments: payments.rows,
    events: events.rows
  }
}

async function getInvoiceByIdForUpdate(clientConn, userId, invoiceId) {
  const { rows } = await clientConn.query(
    `SELECT i.*, c.name AS client_name
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.user_id = $1 AND i.id = $2
     FOR UPDATE`,
    [userId, invoiceId]
  )
  if (!rows[0]) return null

  const lineItems = await clientConn.query(
    `SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [invoiceId]
  )
  const payments = await clientConn.query(
    `SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date DESC`,
    [invoiceId]
  )
  
  return {
    ...rows[0],
    line_items: lineItems.rows,
    payments: payments.rows
  }
}

async function createInvoice(userId, payload) {
  let clientId = payload.client_id;
  
  if (!clientId && payload.client_name) {
    const existing = await pool.query('SELECT id FROM clients WHERE user_id = $1 AND name ILIKE $2', [userId, payload.client_name]);
    if (existing.rows[0]) {
      clientId = existing.rows[0].id;
    } else {
      const newClient = await pool.query(
        'INSERT INTO clients (user_id, name) VALUES ($1, $2) RETURNING id',
        [userId, payload.client_name]
      );
      clientId = newClient.rows[0].id;
    }
  } else if (clientId) {
    const client = await pool.query(`SELECT id FROM clients WHERE user_id = $1 AND id = $2`, [userId, clientId])
    if (!client.rows[0]) {
      const err = new Error('Client not found')
      err.status = 400
      throw err
    }
  } else {
    const err = new Error('Client name or ID required')
    err.status = 400
    throw err
  }

  const subtotal = payload.line_items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0)
  const tax = Number(payload.tax_amount || 0)
  const discount = Number(payload.discount_amount || 0)
  const total = Number(payload.total_amount || subtotal + tax - discount)
  const status = 'draft'
  const issueDate = payload.issue_date || new Date().toISOString().slice(0, 10)
  const dueDate = payload.due_date || issueDate
  const invoiceNumber = payload.invoice_number || `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`

  const clientConn = await pool.connect()
  try {
    await clientConn.query('BEGIN')

    const invoiceRes = await clientConn.query(
      `INSERT INTO invoices (user_id, client_id, invoice_number, title, description, currency, subtotal_amount, tax_amount, discount_amount, total_amount, paid_amount, status, issue_date, due_date, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12,$13,$14)
       RETURNING *`,
      [
        userId,
        clientId,
        invoiceNumber,
        payload.title || null,
        payload.description || null,
        payload.currency || 'INR',
        subtotal.toFixed(2),
        tax.toFixed(2),
        discount.toFixed(2),
        total.toFixed(2),
        status,
        issueDate,
        dueDate,
        payload.metadata || null
      ]
    )

    const invoice = invoiceRes.rows[0]
    for (let i = 0; i < payload.line_items.length; i += 1) {
      const item = payload.line_items[i]
      const lineTotal = Number(item.quantity) * Number(item.unit_price)
      await clientConn.query(
        `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, line_total, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [invoice.id, item.description, item.quantity, item.unit_price, lineTotal.toFixed(2), i]
      )
    }

    await clientConn.query(
      `INSERT INTO invoice_events (invoice_id, event_type, event_payload)
       VALUES ($1, 'invoice.created', $2::jsonb)`,
      [invoice.id, JSON.stringify({ invoice_id: invoice.id, status: invoice.status })]
    )

    await clientConn.query('COMMIT')
    realtime.emit('invoice.created', {
      userId,
      invoiceId: invoice.id,
      status: invoice.status,
      totalAmount: invoice.total_amount,
      outstandingAmount: invoice.outstanding_amount
    })

    return invoice
  } catch (error) {
    await clientConn.query('ROLLBACK')
    throw error
  } finally {
    clientConn.release()
  }
}

async function updateInvoice(userId, invoiceId, payload) {
  const clientConn = await pool.connect()
  try {
    await clientConn.query('BEGIN')

    const current = await getInvoiceByIdForUpdate(clientConn, userId, invoiceId)
    if (!current) {
      const err = new Error('Invoice not found')
      err.status = 404
      throw err
    }
    if (current.is_cancelled) {
      const err = new Error('Cancelled invoice cannot be edited')
      err.status = 400
      throw err
    }

    const isAnchored = !!(current.algo_anchor_tx_id || current.anchor_tx_id)
    
    // 1. Snapshot current state into invoice_versions if it is already anchored
    if (isAnchored) {
      await clientConn.query(
        `INSERT INTO invoice_versions (invoice_id, version, invoice_number, total_amount, due_date, invoice_hash, algo_anchor_tx_id, line_items_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          invoiceId,
          current.version || 1,
          current.invoice_number,
          current.total_amount,
          current.due_date,
          current.invoice_hash || current.anchor_hash,
          current.algo_anchor_tx_id || current.anchor_tx_id,
          JSON.stringify(current.line_items || [])
        ]
      )
    }

    const nextSentAt = payload.mark_sent ? new Date().toISOString() : current.sent_at
    const updatedTotalAmount = payload.total_amount ?? current.total_amount
    const invoiceDraft = {
      ...current,
      paid_amount: Number(current.paid_amount),
      total_amount: Number(updatedTotalAmount),
      outstanding_amount: Number(updatedTotalAmount) - Number(current.paid_amount),
      due_date: payload.due_date || current.due_date,
      sent_at: nextSentAt
    }
    const nextStatus = resolveInvoiceStatus(invoiceDraft)

    const { rows } = await clientConn.query(
      `UPDATE invoices
       SET title = COALESCE($3, title),
           description = COALESCE($4, description),
           due_date = COALESCE($5, due_date),
           total_amount = COALESCE($6, total_amount),
           sent_at = $7,
           status = $8,
           version = COALESCE(version, 1) + CASE WHEN $9::boolean THEN 1 ELSE 0 END,
           invoice_hash = CASE WHEN $9::boolean THEN NULL ELSE invoice_hash END,
           algo_anchor_tx_id = CASE WHEN $9::boolean THEN NULL ELSE algo_anchor_tx_id END,
           algo_anchor_status = CASE WHEN $9::boolean THEN 'pending_anchor' ELSE algo_anchor_status END,
           anchor_hash = CASE WHEN $9::boolean THEN NULL ELSE anchor_hash END,
           anchor_tx_id = CASE WHEN $9::boolean THEN NULL ELSE anchor_tx_id END,
           anchored_at = CASE WHEN $9::boolean THEN NULL ELSE anchored_at END,
           updated_at = now()
       WHERE user_id = $1 AND id = $2
       RETURNING *`,
      [userId, invoiceId, payload.title, payload.description, payload.due_date, payload.total_amount, nextSentAt, nextStatus, isAnchored]
    )

    // 3. Update line items if provided in payload
    if (payload.line_items && Array.isArray(payload.line_items)) {
      await clientConn.query(`DELETE FROM invoice_line_items WHERE invoice_id = $1`, [invoiceId]);
      for (let i = 0; i < payload.line_items.length; i++) {
        const item = payload.line_items[i];
        await clientConn.query(
          `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, line_total, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [invoiceId, item.description, item.quantity, item.unit_price, (item.quantity * item.unit_price), i]
        )
      }
    }

    await clientConn.query(
      `INSERT INTO invoice_events (invoice_id, event_type, event_payload)
       VALUES ($1, 'invoice.updated', $2::jsonb)`,
      [invoiceId, JSON.stringify({ invoice_id: invoiceId, status: nextStatus, version: rows[0].version })]
    )

    await clientConn.query('COMMIT')

    // 4. Trigger auto re-anchor if it was previously anchored
    if (isAnchored) {
      anchorInvoice(userId, invoiceId).catch(err => {
        console.error('Auto-reanchor failed:', err)
      })
    }

    realtime.emit('invoice.updated', {
      userId,
      invoiceId,
      status: nextStatus,
      paidAmount: rows[0].paid_amount,
      outstandingAmount: rows[0].outstanding_amount
    })

    return rows[0]
  } catch (error) {
    await clientConn.query('ROLLBACK')
    throw error
  } finally {
    clientConn.release()
  }
}

async function sendInvoice(userId, invoiceId) {
  const current = await getInvoiceById(userId, invoiceId)
  if (!current) {
    const err = new Error('Invoice not found')
    err.status = 404
    throw err
  }
  if (current.is_cancelled) {
    const err = new Error('Cancelled invoice cannot be sent')
    err.status = 400
    throw err
  }
  if (current.status !== 'draft') {
    const err = new Error('Only draft invoices can be marked as sent')
    err.status = 400
    throw err
  }

  return updateInvoice(userId, invoiceId, { mark_sent: true })
}

async function cancelInvoice(userId, invoiceId) {
  const clientConn = await pool.connect()
  try {
    await clientConn.query('BEGIN')

    const current = await getInvoiceByIdForUpdate(clientConn, userId, invoiceId)
    if (!current) {
      const err = new Error('Invoice not found')
      err.status = 404
      throw err
    }

    if (current.payments && current.payments.length > 0) {
      const err = new Error('Invoice with payment records cannot be cancelled')
      err.status = 400
      throw err
    }

    const { rows } = await clientConn.query(
      `UPDATE invoices
       SET is_cancelled = true,
           status = 'cancelled',
           updated_at = now()
       WHERE user_id = $1 AND id = $2
       RETURNING *`,
      [userId, invoiceId]
    )

    await clientConn.query(
      `INSERT INTO invoice_events (invoice_id, event_type, event_payload)
       VALUES ($1, 'invoice.cancelled', $2::jsonb)`,
      [invoiceId, JSON.stringify({ invoice_id: invoiceId, status: 'cancelled' })]
    )

    await clientConn.query('COMMIT')

    realtime.emit('invoice.updated', {
      userId,
      invoiceId,
      status: 'cancelled',
      paidAmount: rows[0].paid_amount,
      outstandingAmount: rows[0].outstanding_amount
    })

    return rows[0]
  } catch (error) {
    await clientConn.query('ROLLBACK')
    throw error
  } finally {
    clientConn.release()
  }
}

async function anchorInvoice(userId, invoiceId) {
  const invoice = await getInvoiceById(userId, invoiceId)
  if (!invoice) {
    const err = new Error('Invoice not found')
    err.status = 404
    throw err
  }

  const tx = await anchorInvoiceToAlgorand(invoice, invoice.line_items)

  const { rows } = await pool.query(
    `UPDATE invoices
     SET invoice_hash = $3,
         algo_anchor_tx_id = $4,
         algo_anchor_status = $5,
         anchor_hash = $3,
         anchor_tx_id = $4,
         anchor_simulated = $6,
         anchor_explorer_url = $7,
         anchored_at = now(),
         updated_at = now()
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    [userId, invoiceId, tx.hash, tx.txId, tx.simulated ? 'simulated' : 'confirmed', tx.simulated, tx.explorerUrl]
  )

  await pool.query(
    `INSERT INTO invoice_events (invoice_id, event_type, event_payload)
     VALUES ($1, 'invoice.anchored', $2::jsonb)`,
    [invoiceId, JSON.stringify({ invoice_id: invoiceId, hash: tx.hash, tx_id: tx.txId, simulated: tx.simulated })]
  )

  realtime.emit('anchor.confirmed', {
    userId,
    invoiceId,
    txId: tx.txId,
    status: tx.simulated ? 'simulated' : 'confirmed'
  })

  return {
    success: true,
    txId: tx.txId,
    hash: tx.hash,
    simulated: tx.simulated,
    explorerUrl: tx.explorerUrl,
    invoice: rows[0]
  }
}

async function getInvoiceEvents(userId, invoiceId) {
  const check = await pool.query('SELECT id FROM invoices WHERE user_id = $1 AND id = $2', [userId, invoiceId])
  if (!check.rows[0]) {
    const err = new Error('Invoice not found')
    err.status = 404
    throw err
  }
  const { rows } = await pool.query(
    `SELECT * FROM invoice_events WHERE invoice_id = $1 ORDER BY created_at DESC`,
    [invoiceId]
  )
  return rows
}

async function generateReminder(userId, invoiceId) {
  const invoice = await getInvoiceById(userId, invoiceId)
  if (!invoice) {
    const err = new Error('Invoice not found')
    err.status = 404
    throw err
  }

  const totalAmount = Number(invoice.total_amount).toFixed(2)
  const outstandingAmount = Number(invoice.outstanding_amount).toFixed(2)
  const dueDate = new Date(invoice.due_date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  const message = `Hi ${invoice.client_name}, this is a reminder for invoice ${invoice.invoice_number}. Total amount is INR ${totalAmount}, outstanding is INR ${outstandingAmount}, due on ${dueDate}. Please share payment update. Thank you.`

  return {
    invoice_id: invoice.id,
    client_name: invoice.client_name,
    message
  }
}

async function getInvoiceTimeline(userId, invoiceId) {
  const invoice = await getInvoiceById(userId, invoiceId)
  if (!invoice) {
    const err = new Error('Invoice not found')
    err.status = 404
    throw err
  }

  const { rows: payments } = await pool.query(
    `SELECT id, amount, payment_date, payment_method, created_at
     FROM payments
     WHERE invoice_id = $1
     ORDER BY payment_date ASC, created_at ASC`,
    [invoiceId]
  )

  const timeline = []

  timeline.push({
    type: 'invoice.created',
    label: 'Invoice created',
    at: invoice.created_at,
    meta: {
      invoice_number: invoice.invoice_number,
      total_amount: invoice.total_amount
    }
  })

  if (invoice.sent_at) {
    timeline.push({
      type: 'invoice.sent',
      label: 'Invoice marked as sent',
      at: invoice.sent_at,
      meta: {}
    })
  }

  let runningPaid = 0
  for (const payment of payments) {
    runningPaid += Number(payment.amount)
    const paymentType = runningPaid >= Number(invoice.total_amount) ? 'payment.full' : 'payment.partial'
    timeline.push({
      type: paymentType,
      label: paymentType === 'payment.full' ? 'Final payment received' : 'Partial payment received',
      at: payment.payment_date,
      meta: {
        amount: payment.amount,
        payment_method: payment.payment_method,
        payment_id: payment.id
      }
    })
  }

  if (invoice.status === 'paid' && invoice.paid_at) {
    timeline.push({
      type: 'invoice.paid',
      label: 'Invoice fully paid',
      at: invoice.paid_at,
      meta: {}
    })
  }

  if (invoice.status === 'overdue' && invoice.overdue_at) {
    timeline.push({
      type: 'invoice.overdue',
      label: 'Invoice became overdue',
      at: invoice.overdue_at,
      meta: {
        due_date: invoice.due_date
      }
    })
  }

  if (invoice.is_cancelled) {
    timeline.push({
      type: 'invoice.cancelled',
      label: 'Invoice cancelled',
      at: invoice.updated_at,
      meta: {}
    })
  }

  const proofTxId = invoice.anchor_tx_id || invoice.algo_anchor_tx_id
  const proofHash = invoice.anchor_hash || invoice.invoice_hash
  const proofUrl = invoice.anchor_explorer_url || (proofTxId ? `${env.explorerBaseUrl}${proofTxId}` : null)
  if (proofTxId) {
    timeline.push({
      type: 'invoice.anchored',
      label: 'Invoice verified on-chain',
      at: invoice.anchored_at || invoice.updated_at,
      meta: {
        tx_id: proofTxId,
        hash: proofHash,
        explorer_url: proofUrl
      }
    })
  }

  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  return {
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    timeline
  }
}

async function getInvoicePdfData(userId, invoiceId) {
  const { rows } = await pool.query(
    `SELECT i.*, c.id AS client_id, c.name AS client_name, c.email AS client_email, c.phone AS client_phone,
            c.company_name, c.address AS client_address, c.city AS client_city, c.state AS client_state, c.zip AS client_zip, c.notes
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.user_id = $1 AND i.id = $2`,
    [userId, invoiceId]
  )

  if (!rows[0]) {
    const err = new Error('Invoice not found')
    err.status = 404
    throw err
  }

  const invoice = rows[0]
  const lineItemsRes = await pool.query(
    `SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [invoiceId]
  )
  const paymentsRes = await pool.query(
    `SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date ASC`,
    [invoiceId]
  )

  const client = {
    id: invoice.client_id,
    name: invoice.client_name,
    company_name: invoice.company_name,
    email: invoice.client_email,
    phone: invoice.client_phone,
    address: invoice.client_address || '',
    city: invoice.client_city || '',
    state: invoice.client_state || '',
    zip: invoice.client_zip || '',
    notes: invoice.notes || ''
  }

  return {
    invoice,
    client,
    lineItems: lineItemsRes.rows,
    payments: paymentsRes.rows
  }
}

module.exports = {
  listInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  sendInvoice,
  cancelInvoice,
  anchorInvoice,
  getInvoiceEvents,
  generateReminder,
  getInvoiceTimeline,
  getInvoicePdfData
}
