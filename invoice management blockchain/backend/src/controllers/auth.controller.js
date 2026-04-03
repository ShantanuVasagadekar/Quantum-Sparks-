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
  algo_wallet_address: z.string().optional()
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
      `INSERT INTO users (email, password_hash, business_name, algo_wallet_address)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, business_name, algo_wallet_address, created_at, updated_at`,
      [payload.email, passwordHash, payload.business_name, payload.algo_wallet_address || null]
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
      `SELECT id, email, business_name, algo_wallet_address, password_hash, created_at, updated_at
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
      `SELECT id, email, business_name, algo_wallet_address, created_at, updated_at
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

module.exports = {
  signup,
  login,
  me
}
