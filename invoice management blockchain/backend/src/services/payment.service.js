const pool = require('../config/db')
const realtime = require('./realtime.service')
const { resolveInvoiceStatus } = require('../utils/invoice.util')
const env = require('../config/env')
const { verifyInvoiceOnChain, verifyAlgorandTransaction } = require('./algorand.service')

async function listInvoicePayments(userId, invoiceId) {
  const invoiceCheck = await pool.query('SELECT id FROM invoices WHERE user_id = $1 AND id = $2', [userId, invoiceId])
  if (!invoiceCheck.rows[0]) {
    const err = new Error('Invoice not found')
    err.status = 404
    throw err
  }

  const { rows } = await pool.query(
    `SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date DESC`,
    [invoiceId]
  )
  return rows
}

async function getPaymentById(userId, paymentId) {
  const { rows } = await pool.query(
    `SELECT p.*
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     WHERE p.id = $1 AND i.user_id = $2`,
    [paymentId, userId]
  )
  return rows[0] || null
}

async function recordPayment(userId, invoiceId, payload) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const invoiceRes = await client.query(
      `SELECT * FROM invoices WHERE user_id = $1 AND id = $2 FOR UPDATE`,
      [userId, invoiceId]
    )
    const invoice = invoiceRes.rows[0]

    if (!invoice) {
      const err = new Error('Invoice not found')
      err.status = 404
      throw err
    }
    if (invoice.is_cancelled) {
      const err = new Error('Cannot add payment to cancelled invoice')
      err.status = 400
      throw err
    }

    const amount = Number(payload.amount)
    if (amount > Number(invoice.outstanding_amount)) {
      const err = new Error('Payment exceeds outstanding amount')
      err.status = 400
      throw err
    }

    const paymentRes = await client.query(
      `INSERT INTO payments (invoice_id, user_id, amount, payment_date, payment_method, reference_number, algo_tx_id, algo_sender_address, algo_verified, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        invoiceId,
        userId,
        amount.toFixed(2),
        payload.payment_date || new Date().toISOString(),
        payload.payment_method,
        payload.reference_number || null,
        payload.algo_tx_id || null,
        payload.algo_sender_address || null,
        Boolean(payload.algo_verified),
        payload.notes || null
      ]
    )

    const totalsRes = await client.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric(14,2) AS paid_amount FROM payments WHERE invoice_id = $1`,
      [invoiceId]
    )
    const paidAmount = Number(totalsRes.rows[0].paid_amount)
    const outstanding = Number(invoice.total_amount) - paidAmount
    const nextStatus = resolveInvoiceStatus({
      ...invoice,
      paid_amount: paidAmount,
      outstanding_amount: outstanding
    })

    const nextPaidAt = nextStatus === 'paid' ? new Date().toISOString() : null

    const updateRes = await client.query(
      `UPDATE invoices
       SET paid_amount = $3,
           status = $4::invoice_status,
           paid_at = COALESCE($5, paid_at),
           overdue_at = CASE WHEN $4::text = 'overdue' THEN now() ELSE overdue_at END,
           updated_at = now()
       WHERE user_id = $1 AND id = $2
       RETURNING *`,
      [userId, invoiceId, paidAmount.toFixed(2), nextStatus, nextPaidAt]
    )

    await client.query(
      `INSERT INTO invoice_events (invoice_id, event_type, event_payload)
       VALUES ($1, 'payment.recorded', $2::jsonb)`,
      [invoiceId, JSON.stringify({ invoice_id: invoiceId, payment_id: paymentRes.rows[0].id, amount })]
    )

    await client.query('COMMIT')

    realtime.emit('payment.recorded', {
      userId,
      invoiceId,
      paymentId: paymentRes.rows[0].id,
      amount,
      status: updateRes.rows[0].status,
      paidAmount: updateRes.rows[0].paid_amount,
      outstandingAmount: updateRes.rows[0].outstanding_amount
    })
    realtime.emit('invoice.updated', {
      userId,
      invoiceId,
      status: updateRes.rows[0].status,
      paidAmount: updateRes.rows[0].paid_amount,
      outstandingAmount: updateRes.rows[0].outstanding_amount
    })

    return {
      payment: paymentRes.rows[0],
      invoice: updateRes.rows[0]
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function verifyChainPayment(userId, paymentId, payload) {
  const paymentUpdate = await pool.query(
    `UPDATE payments p
     SET algo_tx_id = COALESCE($3, p.algo_tx_id),
         algo_sender_address = COALESCE($4, p.algo_sender_address),
         algo_verified = COALESCE(p.algo_verified, false)
     FROM invoices i
     WHERE p.id = $1 AND i.id = p.invoice_id AND i.user_id = $2
     RETURNING p.*`,
    [paymentId, userId, payload.algo_tx_id, payload.algo_sender_address]
  )
  if (!paymentUpdate.rows[0]) {
    const err = new Error('Payment not found')
    err.status = 404
    throw err
  }

  const { rows } = await pool.query(
    `SELECT p.*, i.anchor_tx_id, i.algo_anchor_tx_id
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     WHERE p.id = $1 AND i.user_id = $2`,
    [paymentId, userId]
  )

  if (!rows[0]) {
    const err = new Error('Payment not found')
    err.status = 404
    throw err
  }

  const data = rows[0]
  const txId = data.anchor_tx_id || data.algo_anchor_tx_id

  // Fetch full invoice and line items for deterministic hash verification
  const invoiceRes = await pool.query(`SELECT * FROM invoices WHERE id = $1`, [data.invoice_id])
  const lineItemsRes = await pool.query(`SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY sort_order ASC`, [data.invoice_id])
  
  const verification = await verifyInvoiceOnChain(txId, invoiceRes.rows[0], lineItemsRes.rows)

  const finalUpdate = await pool.query(
    `UPDATE payments p
     SET algo_verified = $3
     FROM invoices i
     WHERE p.id = $1 AND i.id = p.invoice_id AND i.user_id = $2
     RETURNING p.*`,
    [paymentId, userId, Boolean(verification.verified)]
  )

  return {
    payment: finalUpdate.rows[0],
    verification
  }
}

module.exports = {
  listInvoicePayments,
  getPaymentById,
  recordPayment,
  verifyChainPayment,
  recordCryptoPayment
}

async function recordCryptoPayment(userId, payload) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const invoiceRes = await client.query(
      `SELECT * FROM invoices WHERE user_id = $1 AND id = $2 FOR UPDATE`,
      [userId, payload.invoice_id]
    )
    const invoice = invoiceRes.rows[0]
    if (!invoice) {
      const err = new Error('Invoice not found')
      err.status = 404
      throw err
    }

    const outstandingAmount = Number(invoice.outstanding_amount)
    if (outstandingAmount <= 0) {
      const err = new Error('Invoice already fully paid')
      err.status = 400
      throw err
    }

    const expectedReceiver = env.anchorReceiver
    if (!expectedReceiver) {
      const err = new Error('Business Algorand wallet is not configured')
      err.status = 400
      throw err
    }
    const expectedAmountMicro = Math.round(outstandingAmount * 1_000_000)
    const verification = await verifyAlgorandTransaction(
      payload.txn_id,
      expectedReceiver,
      expectedAmountMicro,
      payload.invoice_id
    )

    const paymentRes = await client.query(
      `INSERT INTO payments (
         invoice_id, user_id, amount, payment_date, payment_method,
         reference_number, algo_tx_id, algo_sender_address, algo_verified, notes,
         txn_id, source, status
       )
       VALUES ($1,$2,$3,$4,'algo',$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        payload.invoice_id,
        userId,
        outstandingAmount.toFixed(2),
        new Date().toISOString(),
        payload.txn_id,
        payload.txn_id,
        verification.sender || null,
        Boolean(verification.confirmed),
        'Algorand payment',
        payload.txn_id,
        'algorand',
        verification.confirmed ? 'confirmed' : 'pending'
      ]
    )

    const paidAmount = Number(invoice.paid_amount) + outstandingAmount
    const nextStatus = resolveInvoiceStatus({
      ...invoice,
      paid_amount: paidAmount,
      outstanding_amount: Number(invoice.total_amount) - paidAmount
    })
    const updateRes = await client.query(
      `UPDATE invoices
       SET paid_amount = $3,
           status = $4::invoice_status,
           paid_at = CASE WHEN $4::text = 'paid' THEN now() ELSE paid_at END,
           updated_at = now()
       WHERE user_id = $1 AND id = $2
       RETURNING *`,
      [userId, payload.invoice_id, paidAmount.toFixed(2), nextStatus]
    )

    await client.query('COMMIT')
    return {
      payment: paymentRes.rows[0],
      invoice: updateRes.rows[0],
      verification
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
