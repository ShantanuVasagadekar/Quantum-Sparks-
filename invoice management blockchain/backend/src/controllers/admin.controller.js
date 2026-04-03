const { z } = require('zod')
const adminService = require('../services/admin.service')

const seedSchema = z.object({
  clients: z.coerce.number().int().positive().optional(),
  invoices: z.coerce.number().int().positive().optional(),
  maxPayments: z.coerce.number().int().min(0).optional(),
}).optional()

async function seedDemo(req, res, next) {
  try {
    const payload = seedSchema.parse(req.body || {})
    const result = await adminService.seedDemoData(payload || {})
    res.json(result)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  seedDemo,
}
