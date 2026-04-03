import { useEffect, useRef, useState } from 'react'
import { getToken } from './auth'

const SSE_EVENTS = [
  'invoice.created',
  'invoice.updated',
  'payment.recorded',
  'overdue.detected',
  'anchor.confirmed'
]

const MIN_RETRY_MS = 1000
const MAX_RETRY_MS = 30000

export function useSseReload() {
  const [refreshToken, setRefreshToken] = useState(0)
  const retryDelayRef = useRef(MIN_RETRY_MS)
  const lastEventIdRef = useRef(null)

  useEffect(() => {
    const token = getToken()
    if (!token) return

    const isProd = import.meta.env.PROD
    const base = import.meta.env.VITE_API_URL || (isProd ? 'https://replace-me-with-railway-url.up.railway.app/api' : 'http://localhost:5000/api')
    let source = null
    let retryTimeout = null
    let disposed = false

    function connect() {
      if (disposed) return

      let url = `${base}/events/stream?token=${encodeURIComponent(token)}`

      // Pass last known event ID so server replays missed events
      if (lastEventIdRef.current) {
        url += `&lastEventId=${lastEventIdRef.current}`
      }

      source = new EventSource(url)

      const onEvent = (e) => {
        // Track the server-assigned event ID for reconnection replay
        if (e.lastEventId) {
          lastEventIdRef.current = e.lastEventId
        }
        setRefreshToken((v) => v + 1)
      }

      for (const eventName of SSE_EVENTS) {
        source.addEventListener(eventName, onEvent)
      }

      source.addEventListener('connected', () => {
        // Reset backoff on successful connection
        retryDelayRef.current = MIN_RETRY_MS
      })

      source.onerror = () => {
        source.close()

        if (disposed) return

        // Exponential backoff with jitter
        const delay = retryDelayRef.current
        const jitter = Math.random() * 500
        retryTimeout = setTimeout(connect, delay + jitter)

        // Increase delay for next attempt (capped)
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_MS)
      }
    }

    connect()

    return () => {
      disposed = true
      if (retryTimeout) clearTimeout(retryTimeout)
      if (source) source.close()
    }
  }, [])

  return refreshToken
}
