const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { z } = require('zod')
const pool = require('../config/db')
const env = require('../config/env')

const SALT_ROUNDS = 12

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  business_name: z.string().min(1),
  owner_name: z.string().optional(),
  gst_number: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid Indian GST Number').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  algo_wallet_address: z.string().optional()
})

const updateProfileSchema = z.object({
  business_name: z.string().optional().nullable(),
  owner_name: z.string().optional().nullable(),
  gst_number: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid Indian GST Number').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  algo_wallet_address: z.string().optional().nullable()
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  )
}

function sanitizeUser(row) {
  const { password_hash, ...user } = row
  return user
}

async function signup(req, res, next) {
  try {
    const payload = signupSchema.parse(req.body)
    const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS)

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [payload.email])
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, business_name, owner_name, gst_number, phone, address, city, state, pincode, algo_wallet_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, email, business_name, owner_name, gst_number, phone, address, city, state, pincode, algo_wallet_address, created_at, updated_at`,
      [
        payload.email, passwordHash, payload.business_name,
        payload.owner_name || null, payload.gst_number || null, payload.phone || null,
        payload.address || null, payload.city || null, payload.state || null, payload.pincode || null,
        payload.algo_wallet_address || null
      ]
    )

    const user = rows[0]
    const token = signToken(user)

    res.status(201).json({ user: sanitizeUser(user), token })
  } catch (error) {
    next(error)
  }
}

async function login(req, res, next) {
  try {
    const payload = loginSchema.parse(req.body)

    const { rows } = await pool.query(
      `SELECT id, email, business_name, owner_name, gst_number, phone, address, city, state, pincode, algo_wallet_address, password_hash, created_at, updated_at
       FROM users
       WHERE email = $1`,
      [payload.email]
    )

    if (!rows[0]) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const user = rows[0]
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Account requires password reset (migrated from demo)' })
    }

    const valid = await bcrypt.compare(payload.password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = signToken(user)
    res.json({ user: sanitizeUser(user), token })
  } catch (error) {
    next(error)
  }
}

async function me(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, business_name, owner_name, gst_number, phone, address, city, state, pincode, algo_wallet_address, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    )
    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json(rows[0])
  } catch (error) {
    next(error)
  }
}

async function updateProfile(req, res, next) {
  try {
    const payload = updateProfileSchema.parse(req.body)

    const { rows } = await pool.query(
      `UPDATE users
       SET business_name = COALESCE($2, business_name),
           owner_name = COALESCE($3, owner_name),
           gst_number = COALESCE($4, gst_number),
           phone = COALESCE($5, phone),
           address = COALESCE($6, address),
           city = COALESCE($7, city),
           state = COALESCE($8, state),
           pincode = COALESCE($9, pincode),
           algo_wallet_address = COALESCE($10, algo_wallet_address),
           updated_at = now()
       WHERE id = $1
       RETURNING id, email, business_name, owner_name, gst_number, phone, address, city, state, pincode, algo_wallet_address, created_at, updated_at`,
      [
        req.user.id,
        payload.business_name,
        payload.owner_name,
        payload.gst_number || null,
        payload.phone,
        payload.address,
        payload.city,
        payload.state,
        payload.pincode,
        payload.algo_wallet_address
      ]
    )

    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(rows[0])
  } catch (error) {
    if (error && error.issues && error.issues.length > 0) {
      const msg = error.issues[0].message
      const path = error.issues[0].path.join('.')
      return res.status(400).json({ error: `Validation error on ${path}: ${msg}` })
    }
    next(error)
  }
}

module.exports = {
  signup,
  login,
  me,
  updateProfile
}
