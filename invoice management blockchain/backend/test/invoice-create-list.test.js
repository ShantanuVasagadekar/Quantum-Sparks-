const test = require('node:test')
const assert = require('node:assert/strict')
const { once } = require('node:events')

const app = require('../src/app')
const pool = require('../src/config/db')

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111'

let server
let baseUrl
let clientId
const createdInvoiceIds = []

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options)
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  return { response, data }
}

test.before(async () => {
  server = app.listen(0)
  await once(server, 'listening')
  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`

  const clientResult = await pool.query(
    `INSERT INTO clients (user_id, name, email, company_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      TEST_USER_ID,
      `Invoice Test Client ${Date.now()}`,
      `invoice-test-${Date.now()}@example.com`,
      'Invoice Test Company'
    ]
  )

  clientId = clientResult.rows[0].id
})

test.after(async () => {
  if (createdInvoiceIds.length > 0) {
    await pool.query('DELETE FROM invoices WHERE id = ANY($1::uuid[])', [createdInvoiceIds])
  }
  if (clientId) {
    await pool.query('DELETE FROM clients WHERE id = $1', [clientId])
  }

  if (server) {
    server.close()
    await once(server, 'close')
  }

  await pool.end()
})

test('create invoice accepts description/quantity/unit_price and appears in list', async () => {
  const payload = {
    client_id: clientId,
    title: 'Integration test invoice A',
    description: 'created via integration test',
    line_items: [
      {
        description: 'Design work',
        quantity: 2,
        unit_price: 1500
      }
    ]
  }

  const { response: createResponse, data: createdInvoice } = await request('/api/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': TEST_USER_ID
    },
    body: JSON.stringify(payload)
  })

  assert.equal(createResponse.status, 201)
  assert.ok(createdInvoice.id)
  createdInvoiceIds.push(createdInvoice.id)

  const { response: listResponse, data: invoices } = await request('/api/invoices', {
    headers: {
      'x-user-id': TEST_USER_ID
    }
  })

  assert.equal(listResponse.status, 200)
  assert.ok(Array.isArray(invoices))

  const listedInvoice = invoices.find((invoice) => invoice.id === createdInvoice.id)
  assert.ok(listedInvoice)
  assert.equal(listedInvoice.client_name.startsWith('Invoice Test Client'), true)
  assert.equal(Number(listedInvoice.paid_amount), 0)
  assert.equal(Number(listedInvoice.outstanding_amount), Number(createdInvoice.total_amount))
})

test('create invoice accepts name/qty/rate and appears in list', async () => {
  const payload = {
    client_id: clientId,
    title: 'Integration test invoice B',
    line_items: [
      {
        name: 'Development sprint',
        qty: 3,
        rate: 1000
      }
    ]
  }

  const { response: createResponse, data: createdInvoice } = await request('/api/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': TEST_USER_ID
    },
    body: JSON.stringify(payload)
  })

  assert.equal(createResponse.status, 201)
  assert.ok(createdInvoice.id)
  createdInvoiceIds.push(createdInvoice.id)

  const { response: listResponse, data: invoices } = await request('/api/invoices', {
    headers: {
      'x-user-id': TEST_USER_ID
    }
  })

  assert.equal(listResponse.status, 200)
  assert.ok(Array.isArray(invoices))

  const listedInvoice = invoices.find((invoice) => invoice.id === createdInvoice.id)
  assert.ok(listedInvoice)
  assert.equal(Number(listedInvoice.outstanding_amount), Number(createdInvoice.total_amount))
})
