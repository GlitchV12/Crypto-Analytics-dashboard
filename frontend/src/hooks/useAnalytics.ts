import { useEffect, useRef, useState, useCallback } from "react"
import type { Stats, WSMessage, TriggeredAlert } from "../types"
import { getWsUrl } from "../lib/config"

const WS_URL = getWsUrl()

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_DELAY = 30_000

export type ConnectionState = "connecting" | "connected" | "disconnected"

interface UseAnalyticsReturn {
  stats:            Stats | null
  connectionState:  ConnectionState
  lastUpdate:       Date | null
  triggeredAlerts:  TriggeredAlert[]
  clearAlerts:      () => void
}

export function useAnalytics(): UseAnalyticsReturn {
  const [stats, setStats]                     = useState<Stats | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting")
  const [lastUpdate, setLastUpdate]           = useState<Date | null>(null)
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([])
  const wsRef      = useRef<WebSocket | null>(null)
  const delayRef   = useRef(RECONNECT_DELAY_MS)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmounted  = useRef(false)

  const clearAlerts = useCallback(() => setTriggeredAlerts([]), [])

  const connect = useCallback(() => {
    if (unmounted.current) return
    setConnectionState("connecting")
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return }
      setConnectionState("connected")
      delayRef.current = RECONNECT_DELAY_MS
    }

    ws.onmessage = (ev) => {
      try {
        const msg: WSMessage = JSON.parse(ev.data)
        if (msg.type === "stats") {
          setStats(msg.payload)
          setLastUpdate(new Date())
        } else if (msg.type === "alert_triggered") {
          const alert = msg.payload
          setTriggeredAlerts(prev => [...prev.slice(-9), alert])
          // Browser push notification (only if permission granted)
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(`Price Alert: ${alert.symbol}`, {
              body: `${alert.direction === "above" ? "Rose above" : "Fell below"} $${alert.targetPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })} — now $${alert.currentPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
            })
          }
        }
      } catch { /* ignore malformed frames */ }
    }

    ws.onclose = () => {
      if (unmounted.current) return
      setConnectionState("disconnected")
      timerRef.current = setTimeout(() => {
        delayRef.current = Math.min(delayRef.current * 1.5, MAX_RECONNECT_DELAY)
        connect()
      }, delayRef.current)
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    unmounted.current = false
    connect()
    return () => {
      unmounted.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { stats, connectionState, lastUpdate, triggeredAlerts, clearAlerts }
}
