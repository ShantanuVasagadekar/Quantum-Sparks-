const { z } = require('zod')
const clientService = require('../services/client.service')

const clientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  algo_wallet_address: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
})

async function list(req, res, next) {
  try {
    const data = await clientService.listClients(req.user.id, req.query.search || '')
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function create(req, res, next) {
  try {
    const payload = clientSchema.parse(req.body)
    const data = await clientService.createClient(req.user.id, payload)
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
}

async function getById(req, res, next) {
  try {
    const data = await clientService.getClientById(req.user.id, req.params.id)
    if (!data) return res.status(404).json({ error: 'Client not found' })
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function update(req, res, next) {
  try {
    const payload = clientSchema.partial().parse(req.body)
    const data = await clientService.updateClient(req.user.id, req.params.id, payload)
    if (!data) return res.status(404).json({ error: 'Client not found' })
    res.json(data)
  } catch (error) {
    next(error)
  }
}

async function remove(req, res, next) {
  try {
    const ok = await clientService.deleteClient(req.user.id, req.params.id)
    if (!ok) return res.status(404).json({ error: 'Client not found' })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

module.exports = {
  list,
  create,
  getById,
  update,
  remove
}
