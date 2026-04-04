const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/invoice_tracker' });

async function migrate() {
  try {
    const {rows} = await pool.query('SELECT id FROM users ORDER BY created_at DESC LIMIT 1');
    const currentUserId = rows[0].id;
    const demoUser = '11111111-1111-1111-1111-111111111111';
    
    console.log('Migrating from', demoUser, 'to', currentUserId);
    
    if (currentUserId === demoUser) {
      console.log('Already assigned!');
      return;
    }
    
    // Update clients
    await pool.query('UPDATE clients SET user_id = $1 WHERE user_id = $2', [currentUserId, demoUser]);
    console.log('Clients updated');
    
    // Update invoices. If there is a unique invoice_number conflict, we can temporarily change the invoice number.
    const invoicesRes = await pool.query('SELECT id, invoice_number FROM invoices WHERE user_id = $1', [demoUser]);
    for (const inv of invoicesRes.rows) {
      try {
        await pool.query('UPDATE invoices SET user_id = $1 WHERE id = $2', [currentUserId, inv.id]);
      } catch (err) {
        if (err.code === '23505') {
          // unique violation, modify invoice number
          const newNumber = inv.invoice_number + '-migrated-' + Math.floor(Math.random() * 1000);
          await pool.query('UPDATE invoices SET user_id = $1, invoice_number = $2 WHERE id = $3', [currentUserId, newNumber, inv.id]);
        } else {
          throw err;
        }
      }
    }
    console.log('Invoices updated');
    
    // Update payments
    await pool.query('UPDATE payments SET user_id = $1 WHERE user_id = $2', [currentUserId, demoUser]);
    console.log('Payments updated');
    
    console.log('Data migrated successfully!');
  } catch(err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
}
migrate();
