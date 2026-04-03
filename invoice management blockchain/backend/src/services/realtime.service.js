// --- User-scoped SSE service with event replay, heartbeat, and zombie cleanup ---

// Global monotonic event counter (survives no restarts, but that's fine for SSE)
let eventCounter = 0

// Per-user event buffer for replay on reconnect (ring buffer, capped)
const MAX_BUFFER_PER_USER = 50
const userEventBuffers = new Map() // userId -> [{id, type, data}]

// Per-user connected clients: userId -> Set<{res, alive}>
const userClients = new Map()

// Heartbeat interval handle
let heartbeatHandle = null
const HEARTBEAT_INTERVAL_MS = 25000 // 25s keeps connection alive through proxies (typical 30s timeout)

// --- Client management ---

function addClient(userId, res, lastEventId) {
  if (!userClients.has(userId)) {
    userClients.set(userId, new Set())
  }

  const client = { res, alive: true }
  userClients.get(userId).add(client)

  // Replay missed events if client sent Last-Event-ID
  if (lastEventId) {
    replayEvents(userId, Number(lastEventId), res)
  }

  // Start heartbeat if first client
  if (!heartbeatHandle) {
    startHeartbeat()
  }
}

function removeClient(userId, res) {
  const clients = userClients.get(userId)
  if (!clients) return

  for (const client of clients) {
    if (client.res === res) {
      clients.delete(client)
      break
    }
  }

  if (clients.size === 0) {
    userClients.delete(userId)
  }

  // Stop heartbeat if no clients left
  if (userClients.size === 0 && heartbeatHandle) {
    clearInterval(heartbeatHandle)
    heartbeatHandle = null
  }
}

// --- Event emission with ID tracking ---

function emit(type, payload) {
  const userId = payload.userId
  if (!userId) return

  eventCounter += 1
  const id = eventCounter
  const data = JSON.stringify({ ...payload, timestamp: new Date().toISOString() })

  // Buffer for replay
  bufferEvent(userId, { id, type, data })

  // Send to all connected clients for this user
  const clients = userClients.get(userId)
  if (!clients || clients.size === 0) return

  const message = formatSseMessage(id, type, data)
  const dead = []

  for (const client of clients) {
    try {
      client.res.write(message)
      client.alive = true
    } catch {
      dead.push(client)
    }
  }

  // Cleanup any that errored on write
  for (const client of dead) {
    clients.delete(client)
  }
  if (clients.size === 0) {
    userClients.delete(userId)
  }
}

// --- Replay missed events ---

function replayEvents(userId, afterId, res) {
  const buffer = userEventBuffers.get(userId)
  if (!buffer) return

  for (const event of buffer) {
    if (event.id > afterId) {
      try {
        res.write(formatSseMessage(event.id, event.type, event.data))
      } catch {
        break // connection already dead
      }
    }
  }
}

function bufferEvent(userId, event) {
  if (!userEventBuffers.has(userId)) {
    userEventBuffers.set(userId, [])
  }
  const buffer = userEventBuffers.get(userId)
  buffer.push(event)

  // Ring buffer: drop oldest if over cap
  if (buffer.length > MAX_BUFFER_PER_USER) {
    buffer.splice(0, buffer.length - MAX_BUFFER_PER_USER)
  }
}

// --- Heartbeat: detect zombie connections + keep proxies alive ---

function startHeartbeat() {
  heartbeatHandle = setInterval(() => {
    for (const [userId, clients] of userClients) {
      const dead = []

      for (const client of clients) {
        try {
          // SSE comment line — invisible to EventSource API but keeps TCP alive
          client.res.write(`:heartbeat ${Date.now()}\n\n`)
        } catch {
          dead.push(client)
        }
      }

      for (const client of dead) {
        clients.delete(client)
      }

      if (clients.size === 0) {
        userClients.delete(userId)
      }
    }

    // Stop heartbeat if all clients gone
    if (userClients.size === 0 && heartbeatHandle) {
      clearInterval(heartbeatHandle)
      heartbeatHandle = null
    }
  }, HEARTBEAT_INTERVAL_MS)
}

// --- SSE message formatting ---

function formatSseMessage(id, type, data) {
  return `id: ${id}\nevent: ${type}\ndata: ${data}\n\n`
}

// --- Stats (for health/debug endpoints) ---

function getStats() {
  let totalConnections = 0
  for (const clients of userClients.values()) {
    totalConnections += clients.size
  }
  return {
    users: userClients.size,
    connections: totalConnections,
    eventCounter,
    bufferSize: [...userEventBuffers.values()].reduce((sum, b) => sum + b.length, 0)
  }
}

module.exports = {
  addClient,
  removeClient,
  emit,
  getStats
}
