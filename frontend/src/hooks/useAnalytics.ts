import { useEffect, useRef, useState, useCallback } from "react"
import type { Stats, WSMessage, TriggeredAlert } from "../types"
import { getWsUrl } from "../lib/config"

const WS_URL     = getWsUrl()
const HAS_BACKEND = !!import.meta.env.VITE_API_URL

const RECONNECT_DELAY_MS  = 2000
const MAX_RECONNECT_DELAY = 30_000

// Direct Binance combined stream — used when no backend is configured
const BINANCE_STREAM =
  "wss://stream.binance.com:9443/stream?streams=" +
  ["btcusdt","ethusdt","bnbusdt","solusdt","xrpusdt"]
    .map(s => `${s}@aggTrade/${s}@miniTicker`)
    .join("/")

export type ConnectionState = "connecting" | "connected" | "disconnected"

interface UseAnalyticsReturn {
  stats:           Stats | null
  connectionState: ConnectionState
  lastUpdate:      Date | null
  triggeredAlerts: TriggeredAlert[]
  clearAlerts:     () => void
}

// ─── Binance fallback state builder ──────────────────────────────
interface SymState {
  symbol:    string
  trades:    number
  volume:    number
  lastPrice: number
  prices:    number[]   // rolling last 60s
  buyCount:  number
  sellCount: number
}

function makeStats(syms: Record<string, SymState>, timeline: { second: number; count: number }[]): Stats {
  const symbolStats = Object.values(syms).map(s => ({
    symbol:    s.symbol,
    trades:    s.trades,
    volume:    s.volume,
    lastPrice: s.lastPrice,
    avgPrice:  s.prices.length ? s.prices.reduce((a,b)=>a+b,0)/s.prices.length : s.lastPrice,
  }))
  const sideSplit = [
    { side: "Buy",  count: Object.values(syms).reduce((a,s) => a+s.buyCount,  0) },
    { side: "Sell", count: Object.values(syms).reduce((a,s) => a+s.sellCount, 0) },
  ]
  return {
    tradesPerSec: timeline.length > 1
      ? timeline[timeline.length-1].count / Math.max(1, timeline.length)
      : 0,
    totalTrades: Object.values(syms).reduce((a,s) => a+s.trades, 0),
    totalVolume: Object.values(syms).reduce((a,s) => a+s.volume, 0),
    symbolStats,
    sideSplit,
    timeline,
    priceHistory: [],   // not available in fallback
    timestamp:    Date.now() / 1000,
  }
}

// ─── Main hook ───────────────────────────────────────────────────
export function useAnalytics(): UseAnalyticsReturn {
  const [stats,           setStats]           = useState<Stats | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting")
  const [lastUpdate,      setLastUpdate]      = useState<Date | null>(null)
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([])

  const wsRef     = useRef<WebSocket | null>(null)
  const delayRef  = useRef(RECONNECT_DELAY_MS)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmounted = useRef(false)

  const clearAlerts = useCallback(() => setTriggeredAlerts([]), [])

  // ── Backend mode ──────────────────────────────────────────────
  const connectBackend = useCallback(() => {
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
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(`Price Alert: ${alert.symbol}`, {
              body: `${alert.direction === "above" ? "Rose above" : "Fell below"} $${alert.targetPrice.toLocaleString()}`,
            })
          }
        }
      } catch { /* ignore */ }
    }

    ws.onclose = () => {
      if (unmounted.current) return
      setConnectionState("disconnected")
      timerRef.current = setTimeout(() => {
        delayRef.current = Math.min(delayRef.current * 1.5, MAX_RECONNECT_DELAY)
        connectBackend()
      }, delayRef.current)
    }

    ws.onerror = () => ws.close()
  }, [])

  // ── Binance direct fallback mode ──────────────────────────────
  const connectBinance = useCallback(() => {
    if (unmounted.current) return
    setConnectionState("connecting")

    const syms: Record<string, SymState> = {}
    const PAIRS = ["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT"]
    PAIRS.forEach(p => {
      syms[p] = { symbol: p, trades: 0, volume: 0, lastPrice: 0, prices: [], buyCount: 0, sellCount: 0 }
    })

    const timeline: { second: number; count: number }[] = []
    let   tickCount = 0

    // Broadcast every 500ms so UI feels live
    const broadcastId = setInterval(() => {
      if (unmounted.current) return
      setStats(makeStats(syms, timeline))
      setLastUpdate(new Date())
    }, 500)

    // Roll timeline every second
    const timelineId = setInterval(() => {
      timeline.push({ second: Math.floor(Date.now()/1000), count: tickCount })
      tickCount = 0
      if (timeline.length > 300) timeline.shift()
    }, 1000)

    const ws = new WebSocket(BINANCE_STREAM)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return }
      setConnectionState("connected")
      delayRef.current = RECONNECT_DELAY_MS
    }

    ws.onmessage = (ev) => {
      if (unmounted.current) return
      try {
        const msg = JSON.parse(ev.data) as { stream: string; data: Record<string, unknown> }
        const d   = msg.data
        const sym = (d["s"] as string).toUpperCase()
        if (!syms[sym]) return

        if (msg.stream.includes("@aggTrade")) {
          const price = parseFloat(d["p"] as string)
          const qty   = parseFloat(d["q"] as string)
          const isBuy = !(d["m"] as boolean)  // market maker = sell side

          syms[sym].lastPrice = price
          syms[sym].trades   += 1
          syms[sym].volume   += price * qty
          syms[sym].prices    = [...syms[sym].prices.slice(-59), price]
          if (isBuy) syms[sym].buyCount++; else syms[sym].sellCount++
          tickCount++
        } else if (msg.stream.includes("@miniTicker")) {
          // Fill in price immediately from ticker if no trades yet
          const c = parseFloat(d["c"] as string)
          if (syms[sym].lastPrice === 0) syms[sym].lastPrice = c
        }
      } catch { /* ignore malformed */ }
    }

    ws.onclose = () => {
      clearInterval(broadcastId)
      clearInterval(timelineId)
      if (unmounted.current) return
      setConnectionState("disconnected")
      timerRef.current = setTimeout(() => {
        delayRef.current = Math.min(delayRef.current * 1.5, MAX_RECONNECT_DELAY)
        connectBinance()
      }, delayRef.current)
    }

    ws.onerror = () => ws.close()

    return () => { clearInterval(broadcastId); clearInterval(timelineId) }
  }, [])

  useEffect(() => {
    unmounted.current = false
    if (HAS_BACKEND) {
      connectBackend()
    } else {
      connectBinance()
    }
    return () => {
      unmounted.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connectBackend, connectBinance])

  return { stats, connectionState, lastUpdate, triggeredAlerts, clearAlerts }
}
