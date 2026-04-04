const cron = require('node-cron')
const pool = require('../config/db')
const { realtime } = require('./realtime.service')

async function updateOverdueInvoices() {
  console.log('[cron] Running automated check for overdue invoices...')
  const clientConn = await pool.connect()
  try {
    await clientConn.query('BEGIN')
    
    // Find outstanding invoices that just crossed their due date today
    const { rows } = await clientConn.query(`
      UPDATE invoices
      SET status = 'overdue', 
          updated_at = now()
      WHERE status IN ('draft', 'sent') 
        AND is_cancelled = false
        AND due_date < CURRENT_DATE
      RETURNING id, user_id, invoice_number;
    `)
    
    if (rows.length > 0) {
      console.log(`[cron] Found and marked ${rows.length} invoices as overdue.`)
      // Insert event logs for all updated invoices
      for (const row of rows) {
        await clientConn.query(
          `INSERT INTO invoice_events (invoice_id, event_type, event_payload)
           VALUES ($1, 'invoice.overdue', $2::jsonb)`,
          [row.id, JSON.stringify({ invoice_id: row.id, status: 'overdue' })]
        )
        
        // Push realtime socket notification if client is active
        realtime.emit('invoice.updated', {
          userId: row.user_id,
          invoiceId: row.id,
          status: 'overdue'
        })
      }
    } else {
      console.log('[cron] No new overdue invoices found.')
    }
    
    await clientConn.query('COMMIT')
  } catch (error) {
    await clientConn.query('ROLLBACK')
    console.error('[cron] Error updating overdue invoices:', error)
  } finally {
    clientConn.release()
  }
}

function startCronJobs() {
  console.log('[cron] Initializing scheduled background jobs...')
  // Run once immediately on startup
  updateOverdueInvoices()
  
  // Run at midnight every day
  cron.schedule('0 0 * * *', () => {
    updateOverdueInvoices()
  }, {
    timezone: 'Asia/Kolkata' // Indian Standard Time matching local business context
  })
}

module.exports = {
  startCronJobs
}
