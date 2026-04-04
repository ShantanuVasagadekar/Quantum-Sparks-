const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    console.log('Adding portal_token to invoices...');
    await pool.query('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE;');
    
    console.log('Populating existing invoices with UUIDs...');
    // We update invoices that do not have a portal token yet with gen_random_uuid()
    const { rowCount } = await pool.query(`
      UPDATE invoices
      SET portal_token = gen_random_uuid()::text
      WHERE portal_token IS NULL;
    `);
    
    console.log(`Updated ${rowCount} invoices with portal tokens.`);
    console.log('Migration successful.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}

runMigration();
