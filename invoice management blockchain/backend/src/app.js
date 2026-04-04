const express = require('express')
const cors = require('cors')
const env = require('./config/env')
const { requireUser } = require('./middleware/auth.middleware')
const { errorHandler, notFound } = require('./middleware/error.middleware')

const authRoutes = require('./routes/auth.routes')
const clientRoutes = require('./routes/client.routes')
const invoiceRoutes = require('./routes/invoice.routes')
const paymentRoutes = require('./routes/payment.routes')
const dashboardRoutes = require('./routes/dashboard.routes')
const blockchainRoutes = require('./routes/blockchain.routes')
const eventRoutes = require('./routes/event.routes')
const userRoutes = require('./routes/user.routes')
const portalRoutes = require('./routes/portal.routes')

const app = express()

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

app.get('/', (req, res) => {
  res.json({ message: 'Invoice Management API is running. Use /api routes.' })
})

// Public routes (no JWT required)
app.use('/api/auth', authRoutes)
app.use('/api/portal', portalRoutes)

// SSE route (uses query-param JWT via its own middleware)
app.use('/api/events', eventRoutes)

// All remaining /api/* routes require Bearer JWT
app.use('/api', requireUser)
app.use('/api/clients', clientRoutes)
app.use('/api/invoices', invoiceRoutes)
app.use('/api', paymentRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/blockchain', blockchainRoutes)
app.use('/api/users', userRoutes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
