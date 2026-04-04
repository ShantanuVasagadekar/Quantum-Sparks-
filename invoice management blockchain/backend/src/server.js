const app = require('./app')
const env = require('./config/env')
const { startCronJobs } = require('./services/cron.service')
const { autoSeedIfEmpty } = require('./services/bootstrap.service')

const server = app.listen(env.port, () => {
  console.log(`API running on http://localhost:${env.port}`)
  autoSeedIfEmpty().catch(() => {})
  startCronJobs()
})

process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})
