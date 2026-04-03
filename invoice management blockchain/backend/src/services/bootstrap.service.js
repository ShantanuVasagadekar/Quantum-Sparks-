const pool = require('../config/db')
const { runSeed } = require('../../scripts/seed-faker')

let attemptedBootstrapSeed = false

async function autoSeedIfEmpty() {
  if (attemptedBootstrapSeed) return
  attemptedBootstrapSeed = true

  const client = await pool.connect()
  try {
    const clientsCountRes = await client.query('SELECT COUNT(*)::int AS count FROM clients')
    const clientsCount = Number(clientsCountRes.rows[0]?.count || 0)

    if (clientsCount < 10) {
      console.log('Auto-seeding demo data...')
      await runSeed({ closePoolOnExit: false })
      console.log('Seeding complete')
    }
  } catch (error) {
    console.error('Auto-seed skipped:', error.message)
  } finally {
    client.release()
  }
}

module.exports = {
  autoSeedIfEmpty,
}
