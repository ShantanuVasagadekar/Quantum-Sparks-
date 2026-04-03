function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' })
}

function errorHandler(err, req, res, next) {
  console.error(err)
  // Zod v4 uses err.errors; Zod v3 used err.issues — support both
  const zodErrors = err && (err.errors || err.issues)
  if (err && err.name === 'ZodError' && zodErrors) {
    return res.status(400).json({ error: 'Validation error', details: zodErrors })
  }
  const status = err.status || 500
  res.status(status).json({ error: err.message || 'Internal server error' })
}

module.exports = {
  notFound,
  errorHandler
}
