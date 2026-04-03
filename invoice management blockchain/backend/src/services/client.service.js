const pool = require('../config/db')

async function listClients(userId, search = '') {
  const values = [userId]
  let whereClause = 'user_id = $1'
  if (search && search.trim()) {
    values.push(`%${search.trim()}%`)
    whereClause += ` AND (
      name ILIKE $2
      OR COALESCE(company_name, '') ILIKE $2
      OR COALESCE(email, '') ILIKE $2
      OR COALESCE(phone, '') ILIKE $2
      OR COALESCE(city, '') ILIKE $2
      OR COALESCE(state, '') ILIKE $2
    )`
  }
  const { rows } = await pool.query(
    `SELECT * FROM clients WHERE ${whereClause} ORDER BY name ASC`,
    values
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
  try {
    const { rows } = await pool.query(
      `INSERT INTO clients (user_id, name, email, phone, gst_number, company_name, address, city, state, zip, algo_wallet_address, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        userId,
        payload.name,
        payload.email || null,
        payload.phone || null,
        payload.gst_number || null,
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
  } catch (error) {
    if (error?.code !== '42703') throw error
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
}

async function updateClient(userId, id, payload) {
  try {
    const { rows } = await pool.query(
      `UPDATE clients
       SET name = COALESCE($3, name),
           email = COALESCE($4, email),
           phone = COALESCE($5, phone),
           gst_number = COALESCE($6, gst_number),
           company_name = COALESCE($7, company_name),
           address = COALESCE($8, address),
           city = COALESCE($9, city),
           state = COALESCE($10, state),
           zip = COALESCE($11, zip),
           algo_wallet_address = COALESCE($12, algo_wallet_address),
           notes = COALESCE($13, notes),
           updated_at = now()
       WHERE user_id = $1 AND id = $2
       RETURNING *`,
      [
        userId,
        id,
        payload.name,
        payload.email,
        payload.phone,
        payload.gst_number,
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
  } catch (error) {
    if (error?.code !== '42703') throw error
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
