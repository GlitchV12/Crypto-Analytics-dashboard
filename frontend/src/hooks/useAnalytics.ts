import { useEffect, useRef, useState, useCallback } from "react"
import type { Stats, WSMessage, TriggeredAlert } from "../types"
import { getWsUrl } from "../lib/config"

const WS_URL      = getWsUrl()
const HAS_BACKEND = !!import.meta.env.VITE_API_URL

const RECONNECT_DELAY_MS  = 2000
const MAX_RECONNECT_DELAY = 30_000

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

interface SymState {
  symbol:    string
  trades:    number
  volume:    number
  lastPrice: number
  prices:    number[]
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
    priceHistory: [],
    timestamp:    Date.now() / 1000,
  }
}

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
    console.log("[Backend WS] connecting →", WS_URL)
    setConnectionState("connecting")
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return }
      console.log("[Backend WS] ✓ connected")
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

    ws.onclose = (e) => {
      console.warn("[Backend WS] closed — code:", e.code, "| reason:", e.reason || "(none)")
      if (unmounted.current) return
      setConnectionState("disconnected")
      timerRef.current = setTimeout(() => {
        delayRef.current = Math.min(delayRef.current * 1.5, MAX_RECONNECT_DELAY)
        connectBackend()
      }, delayRef.current)
    }

    ws.onerror = (e) => {
      console.error("[Backend WS] error:", e)
      ws.close()
    }
  }, [])

  // ── Direct Binance fallback ───────────────────────────────────
  const connectBinance = useCallback(() => {
    if (unmounted.current) return
    console.log("[Binance WS] connecting →", BINANCE_STREAM)
    setConnectionState("connecting")

    const PAIRS = ["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT"]
    const syms: Record<string, SymState> = {}
    PAIRS.forEach(p => {
      syms[p] = { symbol: p, trades: 0, volume: 0, lastPrice: 0, prices: [], buyCount: 0, sellCount: 0 }
    })

    const timeline: { second: number; count: number }[] = []
    let tickCount = 0

    const broadcastId = setInterval(() => {
      if (unmounted.current) return
      setStats(makeStats(syms, timeline))
      setLastUpdate(new Date())
    }, 500)

    const timelineId = setInterval(() => {
      timeline.push({ second: Math.floor(Date.now()/1000), count: tickCount })
      tickCount = 0
      if (timeline.length > 300) timeline.shift()
    }, 1000)

    const ws = new WebSocket(BINANCE_STREAM)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return }
      console.log("[Binance WS] ✓ connected — waiting for first trade messages...")
      setConnectionState("connected")
      delayRef.current = RECONNECT_DELAY_MS
    }

    ws.onmessage = (ev) => {
      if (unmounted.current) return
      try {
        const msg = JSON.parse(ev.data) as { stream: string; data: Record<string, unknown> }
        const d   = msg.data
        const sym = (d["s"] as string).toUpperCase()
        if (!syms[sym]) {
          console.warn("[Binance WS] unknown symbol in message:", sym)
          return
        }

        if (msg.stream.includes("@aggTrade")) {
          const price = parseFloat(d["p"] as string)
          const qty   = parseFloat(d["q"] as string)
          const isBuy = !(d["m"] as boolean)

          if (syms[sym].trades === 0) {
            console.log(`[Binance WS] first trade ${sym} → $${price}`)
          }

          syms[sym].lastPrice = price
          syms[sym].trades   += 1
          syms[sym].volume   += price * qty
          syms[sym].prices    = [...syms[sym].prices.slice(-59), price]
          if (isBuy) syms[sym].buyCount++; else syms[sym].sellCount++
          tickCount++

        } else if (msg.stream.includes("@miniTicker")) {
          const c = parseFloat(d["c"] as string)
          if (syms[sym].lastPrice === 0) {
            console.log(`[Binance WS] miniTicker seed ${sym} → $${c}`)
            syms[sym].lastPrice = c
          }
        }
      } catch (err) {
        console.error("[Binance WS] parse error:", err, "raw:", ev.data.slice(0, 120))
      }
    }

    ws.onclose = (e) => {
      clearInterval(broadcastId)
      clearInterval(timelineId)
      console.warn("[Binance WS] closed — code:", e.code, "| reason:", e.reason || "(none)")
      if (unmounted.current) return
      setConnectionState("disconnected")
      timerRef.current = setTimeout(() => {
        delayRef.current = Math.min(delayRef.current * 1.5, MAX_RECONNECT_DELAY)
        connectBinance()
      }, delayRef.current)
    }

    ws.onerror = (e) => {
      console.error("[Binance WS] error event:", e)
      ws.close()
    }

    return () => { clearInterval(broadcastId); clearInterval(timelineId) }
  }, [])

  useEffect(() => {
    unmounted.current = false
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log("[CryptoStream] starting up")
    console.log("[CryptoStream] mode       :", HAS_BACKEND ? "backend (Railway)" : "direct Binance WS")
    console.log("[CryptoStream] VITE_API_URL:", import.meta.env.VITE_API_URL ?? "(not set)")
    console.log("[CryptoStream] WS target   :", HAS_BACKEND ? WS_URL : BINANCE_STREAM)
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

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
