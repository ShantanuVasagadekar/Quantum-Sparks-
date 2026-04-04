const { faker } = require('@faker-js/faker')
const pool = require('../src/config/db')

const USER_ID = process.env.FAKER_USER_ID || process.env.DEMO_USER_ID || '11111111-1111-1111-1111-111111111111'
const CLIENT_COUNT = Number(process.env.FAKER_CLIENTS || 150)
const INVOICE_COUNT = Number(process.env.FAKER_INVOICES || 2000)
const MAX_PAYMENTS_PER_INVOICE = Number(process.env.FAKER_MAX_PAYMENTS || 5)

async function hasColumn(client, tableName, columnName) {
  const res = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  )
  return Boolean(res.rows[0])
}

function randomDateBetween(from, to) {
  return faker.date.between({ from, to })
}

async function createClient(client, userId) {
  const name = faker.company.name()
  const email = faker.internet.email().toLowerCase()
  const state = faker.location.state()

  const result = await client.query(
    `INSERT INTO clients (user_id, name, email, phone, company_name, city, state, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [
      userId,
      name,
      email,
      faker.phone.number(),
      name,
      faker.location.city(),
      state,
      faker.company.catchPhrase(),
    ]
  )
  return { id: result.rows[0].id, state, name }
}

async function createInvoiceWithDetails(client, userId, invoiceNumber, attachedClient, capabilities) {
  const issueDate = randomDateBetween(new Date('2025-01-01'), new Date())
  const dueDate = faker.date.soon({ days: 45, refDate: issueDate })
  const lineItemCount = faker.number.int({ min: 1, max: 5 })

  let subtotal = 0
  const lineItems = []
  for (let i = 0; i < lineItemCount; i += 1) {
    const quantity = faker.number.float({ min: 1, max: 12, multipleOf: 1 })
    const unitPrice = faker.number.float({ min: 200, max: 12000, multipleOf: 0.01 })
    const lineTotal = Number((quantity * unitPrice).toFixed(2))
    subtotal += lineTotal
    lineItems.push({
      description: faker.commerce.productName(),
      quantity,
      unitPrice,
      gstPercent: faker.helpers.arrayElement([0, 5, 12, 18]),
      lineTotal,
      sortOrder: i,
    })
  }

  const discount = faker.number.float({ min: 0, max: subtotal * 0.2, multipleOf: 0.01 })
  const tax = Number((subtotal * 0.18).toFixed(2))
  const total = Number((subtotal + tax - discount).toFixed(2))

  const invoiceInsert = await client.query(
    `INSERT INTO invoices
      (user_id, client_id, invoice_number, title, description, currency, subtotal_amount, tax_amount, discount_amount, total_amount, paid_amount, status, issue_date, due_date)
     VALUES
      ($1,$2,$3,$4,$5,'INR',$6,$7,$8,$9,0,'draft',$10,$11)
     RETURNING id, total_amount`,
    [
      userId,
      attachedClient.id,
      invoiceNumber,
      `Invoice for ${attachedClient.name}`,
      faker.commerce.productDescription(),
      subtotal.toFixed(2),
      tax.toFixed(2),
      discount.toFixed(2),
      total.toFixed(2),
      issueDate.toISOString().slice(0, 10),
      dueDate.toISOString().slice(0, 10),
    ]
  )

  const invoice = invoiceInsert.rows[0]
  for (const item of lineItems) {
    if (capabilities.lineItemsHasGstPercent && capabilities.lineItemsHasGstAmount) {
      await client.query(
        `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, gst_percent, gst_amount, line_total, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          invoice.id,
          item.description,
          item.quantity,
          item.unitPrice,
          item.gstPercent,
          Number((item.lineTotal * (item.gstPercent / 100)).toFixed(2)),
          item.lineTotal.toFixed(2),
          item.sortOrder,
        ]
      )
    } else if (capabilities.lineItemsHasGstPercent) {
      await client.query(
        `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, gst_percent, line_total, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          invoice.id,
          item.description,
          item.quantity,
          item.unitPrice,
          item.gstPercent,
          item.lineTotal.toFixed(2),
          item.sortOrder,
        ]
      )
    } else {
      await client.query(
        `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, line_total, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          invoice.id,
          item.description,
          item.quantity,
          item.unitPrice,
          item.lineTotal.toFixed(2),
          item.sortOrder,
        ]
      )
    }
  }

  const paymentCount = faker.number.int({ min: 1, max: MAX_PAYMENTS_PER_INVOICE })
  let paidAmount = 0
  for (let p = 0; p < paymentCount; p += 1) {
    const remaining = Number(invoice.total_amount) - paidAmount
    if (remaining <= 0) break

    let amount;
    if (remaining <= 100) {
      amount = Number(remaining.toFixed(2))
    } else {
      amount = Number(faker.number.float({ min: 100, max: remaining, multipleOf: 0.01 }).toFixed(2))
    }
    paidAmount = Number((paidAmount + amount).toFixed(2))
    const method = faker.helpers.arrayElement(['cash', 'bank', 'upi', 'manual'])
    if (capabilities.paymentsHasSourceAndStatus) {
      await client.query(
        `INSERT INTO payments (invoice_id, user_id, amount, payment_date, payment_method, reference_number, source, status)
         VALUES ($1,$2,$3,$4,$5,$6,'manual','confirmed')`,
        [
          invoice.id,
          userId,
          amount.toFixed(2),
          faker.date.between({ from: issueDate, to: new Date() }).toISOString(),
          method,
          faker.string.alphanumeric(12).toUpperCase(),
        ]
      )
    } else {
      await client.query(
        `INSERT INTO payments (invoice_id, user_id, amount, payment_date, payment_method, reference_number)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          invoice.id,
          userId,
          amount.toFixed(2),
          faker.date.between({ from: issueDate, to: new Date() }).toISOString(),
          method,
          faker.string.alphanumeric(12).toUpperCase(),
        ]
      )
    }
  }

  const totalAmount = Number(invoice.total_amount)
  const randomStatus = faker.helpers.weightedArrayElement([
    { value: 'paid', weight: 35 },
    { value: 'partial', weight: 30 },
    { value: 'overdue', weight: 20 },
    { value: 'sent', weight: 15 }, // pending equivalent in this schema
  ])
  let status = randomStatus
  if (status === 'paid') {
    paidAmount = totalAmount
  } else if (status === 'partial') {
    paidAmount = Number(faker.number.float({ min: totalAmount * 0.2, max: totalAmount * 0.85, multipleOf: 0.01 }).toFixed(2))
  } else if (status === 'overdue') {
    paidAmount = Number(faker.number.float({ min: 0, max: totalAmount * 0.5, multipleOf: 0.01 }).toFixed(2))
  } else {
    paidAmount = 0
  }
  if (paidAmount >= totalAmount) status = 'paid'
  const outstanding = Number((totalAmount - paidAmount).toFixed(2))

  await client.query(
    `UPDATE invoices
     SET paid_amount = $2,
         status = $3::invoice_status,
         paid_at = CASE WHEN $3::text = 'paid' THEN now() ELSE paid_at END,
         sent_at = COALESCE(sent_at, now())
     WHERE id = $1`,
    [invoice.id, paidAmount.toFixed(2), status]
  )
}

async function ensureUser(client) {
  // Upsert the demo user and return the actual user_id from the DB
  const email = process.env.FAKER_USER_EMAIL || 'demo@quantumsparks.com'
  // bcrypt hash of 'password123'
  const passwordHash = '$2b$10$w09dK1L/ZfS3P6P6X7t4O.5yF4y.U9L0u6T5X0v1mO7K4Y7Yv7dWu'

  const result = await client.query(
    `INSERT INTO users (email, password_hash, business_name, owner_name, gst_number, phone, address, city, state, pincode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (email) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [
      email,
      passwordHash,
      'Quantum Sparks Pvt Ltd',
      'Shantanu Vasagadekar',
      '27AABCQ1234A1Z5',
      '9876543210',
      '12, Inspire Hub, Bandra Kurla Complex',
      'Mumbai',
      'Maharashtra',
      '400051',
    ]
  )
  const userId = result.rows[0].id
  console.log(`Demo user ensured: ${email} (id: ${userId})`)
  return userId
}

async function runSeed(options = {}) {
  const closePoolOnExit = options.closePoolOnExit !== false
  const client = await pool.connect()
  try {
    console.log('Starting faker seed...')
    await client.query('BEGIN')

    // Step 1: Ensure user exists and get the real user_id from DB
    const userId = await ensureUser(client)

    const capabilities = {
      lineItemsHasGstPercent: await hasColumn(client, 'invoice_line_items', 'gst_percent'),
      lineItemsHasGstAmount:  await hasColumn(client, 'invoice_line_items', 'gst_amount'),
      paymentsHasSourceAndStatus:
        (await hasColumn(client, 'payments', 'source')) &&
        (await hasColumn(client, 'payments', 'status')),
    }
    console.log('Schema capabilities:', capabilities)
    if (!capabilities.lineItemsHasGstPercent) {
      console.warn('Warning: invoice_line_items.gst_percent missing. Seeding without GST columns.')
    }

    // Step 2: Create clients using the real user_id
    const clients = []
    for (let i = 0; i < CLIENT_COUNT; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      clients.push(await createClient(client, userId))
    }
    console.log(`Created ${clients.length} clients`)

    // Step 3: Create invoices using the real user_id and real client.ids
    for (let i = 1; i <= INVOICE_COUNT; i += 1) {
      const selectedClient = faker.helpers.arrayElement(clients)
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(i).padStart(5, '0')}-${faker.number.int({ min: 10, max: 99 })}`
      // eslint-disable-next-line no-await-in-loop
      await createInvoiceWithDetails(client, userId, invoiceNumber, selectedClient, capabilities)
      if (i % 50 === 0) console.log(`Created ${i}/${INVOICE_COUNT} invoices...`)
    }

    await client.query('COMMIT')
    console.log(`Seeded ${CLIENT_COUNT} clients and ${INVOICE_COUNT} invoices for user ${userId}`)
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Faker seed failed:', error.message)
    process.exitCode = 1
  } finally {
    client.release()
    if (closePoolOnExit) {
      await pool.end()
    }
  }
}

if (require.main === module) {
  runSeed({ closePoolOnExit: true })
}

module.exports = {
  runSeed,
}
