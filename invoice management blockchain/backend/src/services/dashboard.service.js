const pool = require('../config/db')
const { calculateRiskScore, riskLevelFromScore } = require('../utils/risk.util')

async function getSummary(userId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total_invoices,
       COALESCE(SUM(total_amount), 0)::numeric(14,2) AS total_invoiced,
       COALESCE(SUM(paid_amount), 0)::numeric(14,2) AS total_collected,
       COALESCE(SUM(outstanding_amount), 0)::numeric(14,2) AS total_outstanding,
       COALESCE(SUM(CASE WHEN status = 'overdue' THEN outstanding_amount ELSE 0 END), 0)::numeric(14,2) AS total_overdue,
       COUNT(*) FILTER (WHERE status = 'overdue')::int AS overdue_count
     FROM invoices
     WHERE user_id = $1 AND is_cancelled = false`,
    [userId]
  )
  return rows[0]
}

async function getOverdueInvoices(userId) {
  const { rows } = await pool.query(
    `SELECT i.*, c.name AS client_name,
            (current_date - i.due_date) AS days_overdue
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.user_id = $1
       AND i.outstanding_amount > 0
       AND i.due_date < current_date
       AND i.is_cancelled = false
     ORDER BY i.due_date ASC`,
    [userId]
  )
  return rows
}

async function getCollectionsTrend(userId) {
  const { rows } = await pool.query(
    `SELECT to_char(date_trunc('month', payment_date), 'YYYY-MM') AS month,
            COALESCE(SUM(amount),0)::numeric(14,2) AS collected
     FROM payments
     WHERE user_id = $1
     GROUP BY date_trunc('month', payment_date)
     ORDER BY date_trunc('month', payment_date) ASC`,
    [userId]
  )
  return rows
}

async function getInvoiceCountTrend(userId) {
  const { rows } = await pool.query(
    `SELECT to_char(date_trunc('month', issue_date::timestamp), 'YYYY-MM') AS month,
            COUNT(*)::int AS invoices
     FROM invoices
     WHERE user_id = $1
       AND is_cancelled = false
     GROUP BY date_trunc('month', issue_date::timestamp)
     ORDER BY date_trunc('month', issue_date::timestamp) ASC`,
    [userId]
  )
  return rows
}

async function getClientAnalytics(userId) {
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
     SELECT c.id,
            c.name,
            COUNT(i.id)::int AS invoices,
            COALESCE(SUM(i.total_amount),0)::numeric(14,2) AS total_invoiced,
            COALESCE(SUM(i.paid_amount),0)::numeric(14,2) AS total_collected,
            COALESCE(SUM(i.outstanding_amount),0)::numeric(14,2) AS total_outstanding,
            COALESCE(pp.avg_delay_days,0) AS avg_delay_days,
            COALESCE(pp.overdue_invoices,0) AS overdue_invoices,
            COALESCE(pp.partial_ratio,0) AS partial_ratio
     FROM clients c
     LEFT JOIN invoices i ON i.client_id = c.id
     LEFT JOIN payment_profile pp ON pp.client_id = c.id
     WHERE c.user_id = $1
     GROUP BY c.id, c.name, pp.avg_delay_days, pp.overdue_invoices, pp.partial_ratio
     ORDER BY total_outstanding DESC, c.name ASC`,
    [userId]
  )

  return rows.map((row) => {
    const riskScore = calculateRiskScore({
      avgDelayDays: Number(row.avg_delay_days || 0),
      overdueInvoices: Number(row.overdue_invoices || 0),
      partialRatio: Number(row.partial_ratio || 0)
    })
    return {
      ...row,
      risk_score: riskScore,
      risk_level: riskLevelFromScore(riskScore)
    }
  })
}

async function getClientLeaderboard(userId) {
  const topPaying = await pool.query(
    `SELECT
       c.id,
       c.name,
       COALESCE(SUM(p.amount), 0)::numeric(14,2) AS total_paid,
       COUNT(p.id)::int AS payment_count
     FROM clients c
     LEFT JOIN invoices i ON i.client_id = c.id AND i.user_id = $1
     LEFT JOIN payments p ON p.invoice_id = i.id
     WHERE c.user_id = $1
     GROUP BY c.id, c.name
     ORDER BY total_paid DESC, payment_count DESC, c.name ASC
     LIMIT 5`,
    [userId]
  )

  const mostDelayed = await pool.query(
    `WITH invoice_delay AS (
       SELECT
         i.client_id,
         CASE
           WHEN fp.first_payment_date IS NULL AND i.outstanding_amount > 0 AND i.due_date < current_date THEN (current_date - i.due_date)
           WHEN fp.first_payment_date IS NULL THEN 0
           ELSE GREATEST((fp.first_payment_date - i.due_date), 0)
         END AS delay_days
       FROM invoices i
       LEFT JOIN (
         SELECT invoice_id, MIN(payment_date::date) AS first_payment_date
         FROM payments
         GROUP BY invoice_id
       ) fp ON fp.invoice_id = i.id
       WHERE i.user_id = $1 AND i.is_cancelled = false
     )
     SELECT
       c.id,
       c.name,
       ROUND(COALESCE(AVG(d.delay_days), 0), 1) AS avg_delay_days,
       COUNT(*) FILTER (WHERE d.delay_days > 0)::int AS delayed_invoices
     FROM clients c
     LEFT JOIN invoice_delay d ON d.client_id = c.id
     WHERE c.user_id = $1
     GROUP BY c.id, c.name
     ORDER BY avg_delay_days DESC, delayed_invoices DESC, c.name ASC
     LIMIT 5`,
    [userId]
  )

  return {
    top_paying_clients: topPaying.rows,
    most_delayed_clients: mostDelayed.rows
  }
}

async function getCashflowPrediction(userId) {
  const dueInvoicesRes = await pool.query(
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
       i.id,
       i.invoice_number,
       i.due_date,
       i.outstanding_amount,
       c.id AS client_id,
       c.name AS client_name,
       COALESCE(pp.avg_delay_days,0) AS avg_delay_days,
       COALESCE(pp.overdue_invoices,0) AS overdue_invoices,
       COALESCE(pp.partial_ratio,0) AS partial_ratio
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     LEFT JOIN payment_profile pp ON pp.client_id = i.client_id
     WHERE i.user_id = $1
       AND i.outstanding_amount > 0
       AND i.is_cancelled = false
       AND i.due_date BETWEEN current_date AND (current_date + INTERVAL '7 day')
     ORDER BY i.due_date ASC`,
    [userId]
  )

  const predictions = dueInvoicesRes.rows.map((row) => {
    const riskScore = calculateRiskScore({
      avgDelayDays: Number(row.avg_delay_days || 0),
      overdueInvoices: Number(row.overdue_invoices || 0),
      partialRatio: Number(row.partial_ratio || 0)
    })
    const riskLevel = riskLevelFromScore(riskScore)
    const collectProbability = riskLevel === 'High Risk' ? 0.35 : riskLevel === 'Medium Risk' ? 0.65 : 0.9
    const expectedIncoming = Number(row.outstanding_amount) * collectProbability

    return {
      invoice_id: row.id,
      invoice_number: row.invoice_number,
      due_date: row.due_date,
      client_id: row.client_id,
      client_name: row.client_name,
      risk_score: riskScore,
      risk_level: riskLevel,
      collect_probability: collectProbability,
      outstanding_amount: Number(row.outstanding_amount),
      expected_incoming: Number(expectedIncoming.toFixed(2))
    }
  })

  const totalExpectedIncoming = predictions.reduce((sum, item) => sum + item.expected_incoming, 0)

  return {
    horizon_days: 7,
    invoice_count: predictions.length,
    total_expected_incoming: Number(totalExpectedIncoming.toFixed(2)),
    predictions
  }
}

module.exports = {
  getSummary,
  getOverdueInvoices,
  getCollectionsTrend,
  getInvoiceCountTrend,
  getClientAnalytics,
  getClientLeaderboard,
  getCashflowPrediction
}
