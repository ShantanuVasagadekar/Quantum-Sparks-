const pool = require('../config/db')

async function resolveWalletColumn(client) {
  const walletColumnRes = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'users'
       AND column_name IN ('wallet_address', 'algo_wallet_address')
     ORDER BY CASE WHEN column_name = 'wallet_address' THEN 0 ELSE 1 END
     LIMIT 1`
  )
  const walletColumn = walletColumnRes.rows[0]?.column_name
  if (!walletColumn) {
    const err = new Error('No wallet column found in users table. Run database migrations.')
    err.status = 500
    throw err
  }
  return walletColumn
}

async function attachWalletAddress(userId, walletAddress) {
  const normalizedAddress = walletAddress.trim()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const walletColumn = await resolveWalletColumn(client)

    const conflictRes = await client.query(
      `SELECT id
       FROM users
       WHERE ${walletColumn} = $1
         AND id <> $2
       LIMIT 1`,
      [normalizedAddress, userId]
    )

    if (conflictRes.rows[0]) {
      const err = new Error('Wallet address already linked to another user')
      err.status = 409
      throw err
    }

    const { rows } = await client.query(
      `UPDATE users
       SET ${walletColumn} = $2,
           updated_at = now()
       WHERE id = $1
       RETURNING id, email, ${walletColumn} AS wallet_address, updated_at`,
      [userId, normalizedAddress]
    )

    if (!rows[0]) {
      const err = new Error('User not found')
      err.status = 404
      throw err
    }

    await client.query('COMMIT')
    return rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  attachWalletAddress
}
