const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkConnection() {
  console.log('Testing connection to:', process.env.DATABASE_URL);
  try {
    const client = await pool.connect();
    console.log('Successfully connected to the database');
    const res = await client.query('SELECT current_database(), current_user');
    console.log('DB Info:', res.rows[0]);
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
}

checkConnection();
