const jwt = require('jsonwebtoken')
const env = require('../config/env')

function requireUser(req, res, next) {
  const header = req.header('Authorization')
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' })
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, env.jwtSecret)
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/**
 * Extract user from token in query string (for SSE/EventSource which can't set headers).
 * Falls back to 401 if missing/invalid.
 */
function requireUserFromQuery(req, res, next) {
  const token = req.query.token
  if (!token) {
    return res.status(401).json({ error: 'Missing token query parameter' })
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret)
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = {
  requireUser,
  requireUserFromQuery
}
