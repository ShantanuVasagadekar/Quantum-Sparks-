const app = require('./app')
const env = require('./config/env')
const { markOverdueInvoices } = require('./services/overdue.service')

const server = app.listen(env.port, () => {
  console.log(`API running on http://localhost:${env.port}`)
})

setInterval(() => {
  markOverdueInvoices().catch((error) => {
    console.error('Overdue job failed', error)
  })
}, env.overdueJobIntervalMs)

process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})
