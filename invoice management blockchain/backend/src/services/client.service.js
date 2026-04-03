const pool = require('../config/db')

async function listClients(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM clients WHERE user_id = $1 ORDER BY name ASC`,
    [userId]
  )
  return rows
}

async function getClientById(userId, id) {
  const { rows } = await pool.query(
    `SELECT * FROM clients WHERE user_id = $1 AND id = $2`,
    [userId, id]
  )
  return rows[0] || null
}

async function createClient(userId, payload) {
  const { rows } = await pool.query(
    `INSERT INTO clients (user_id, name, email, phone, company_name, address, city, state, zip, algo_wallet_address, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      userId,
      payload.name,
      payload.email || null,
      payload.phone || null,
      payload.company_name || null,
      payload.address || null,
      payload.city || null,
      payload.state || null,
      payload.zip || null,
      payload.algo_wallet_address || null,
      payload.notes || null
    ]
  )
  return rows[0]
}

async function updateClient(userId, id, payload) {
  const { rows } = await pool.query(
    `UPDATE clients
     SET name = COALESCE($3, name),
         email = COALESCE($4, email),
         phone = COALESCE($5, phone),
         company_name = COALESCE($6, company_name),
         address = COALESCE($7, address),
         city = COALESCE($8, city),
         state = COALESCE($9, state),
         zip = COALESCE($10, zip),
         algo_wallet_address = COALESCE($11, algo_wallet_address),
         notes = COALESCE($12, notes),
         updated_at = now()
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    [
      userId,
      id,
      payload.name,
      payload.email,
      payload.phone,
      payload.company_name,
      payload.address,
      payload.city,
      payload.state,
      payload.zip,
      payload.algo_wallet_address,
      payload.notes
    ]
  )
  return rows[0] || null
}

async function deleteClient(userId, id) {
  const { rowCount } = await pool.query(
    `DELETE FROM clients WHERE user_id = $1 AND id = $2`,
    [userId, id]
  )
  return rowCount > 0
}

module.exports = {
  listClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient
}
