const realtime = require('../services/realtime.service')

function stream(req, res) {
  const userId = req.user.id

  // Last-Event-ID: sent automatically by EventSource on reconnect
  const lastEventId = req.header('Last-Event-ID') || req.query.lastEventId || null

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering
  res.flushHeaders()

  // Initial connection event (no id — this is not a replayable event)
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`)

  realtime.addClient(userId, res, lastEventId)

  req.on('close', () => {
    realtime.removeClient(userId, res)
  })
}

function stats(req, res) {
  res.json(realtime.getStats())
}

module.exports = {
  stream,
  stats
}
