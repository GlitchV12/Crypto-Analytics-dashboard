/**
 * useAnalytics
 * Priority order:
 *  1. Railway backend WS (if VITE_API_URL is set)
 *  2. Binance direct WS  (wss://stream.binance.com)
 *  3. CoinGecko REST     (polling, fallback when WS blocked)
 */
import { useEffect, useRef, useState, useCallback } from "react"
import type { Stats, TriggeredAlert } from "../types"
import { getWsUrl } from "../lib/config"

console.log("[useAnalytics] module loaded")

const WS_URL      = getWsUrl()
const HAS_BACKEND = !!import.meta.env.VITE_API_URL

const RECONNECT_MS        = 3000
const MAX_RECONNECT_MS    = 30_000
const WS_CONNECT_TIMEOUT  = 8000   // give up on WS after 8s, fall back to REST

const BINANCE_STREAM =
  "wss://stream.binance.com:9443/stream?streams=" +
  ["btcusdt","ethusdt","bnbusdt","solusdt","xrpusdt"]
    .map(s => `${s}@aggTrade/${s}@miniTicker`).join("/")

// Binance REST — CORS-friendly, no API key needed
const BINANCE_REST =
  'https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT"]'

export type ConnectionState = "connecting" | "connected" | "disconnected"

interface SymState {
  symbol: string; trades: number; volume: number
  lastPrice: number; prices: number[]; buyCount: number; sellCount: number
}

function symStateMap() {
  const m: Record<string,SymState> = {}
  for (const s of ["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT"]) {
    m[s] = { symbol:s, trades:0, volume:0, lastPrice:0, prices:[], buyCount:0, sellCount:0 }
  }
  return m
}

function buildStats(syms: Record<string,SymState>, timeline: {second:number;count:number}[]): Stats {
  const symbolStats = Object.values(syms).map(s => ({
    symbol: s.symbol, trades: s.trades, volume: s.volume,
    lastPrice: s.lastPrice,
    avgPrice: s.prices.length ? s.prices.reduce((a,b)=>a+b,0)/s.prices.length : s.lastPrice,
  }))
  return {
    tradesPerSec: timeline.length > 1 ? (timeline[timeline.length-1]?.count ?? 0) : 0,
    totalTrades:  Object.values(syms).reduce((a,s)=>a+s.trades,0),
    totalVolume:  Object.values(syms).reduce((a,s)=>a+s.volume,0),
    symbolStats,
    sideSplit: [
      { side:"Buy",  count: Object.values(syms).reduce((a,s)=>a+s.buyCount,0) },
      { side:"Sell", count: Object.values(syms).reduce((a,s)=>a+s.sellCount,0) },
    ],
    timeline,
    priceHistory: [],
    timestamp: Date.now()/1000,
  }
}

export interface UseAnalyticsReturn {
  stats:           Stats | null
  connectionState: ConnectionState
  lastUpdate:      Date | null
  triggeredAlerts: TriggeredAlert[]
  clearAlerts:     () => void
  dataSource:      "backend" | "binance-ws" | "coingecko" | "none"
}

export function useAnalytics(): UseAnalyticsReturn {
  const [stats,           setStats]           = useState<Stats|null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting")
  const [lastUpdate,      setLastUpdate]      = useState<Date|null>(null)
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([])
  const [dataSource,      setDataSource]      = useState<UseAnalyticsReturn["dataSource"]>("none")

  const wsRef      = useRef<WebSocket|null>(null)
  const delayRef   = useRef(RECONNECT_MS)
  const timerRef   = useRef<ReturnType<typeof setTimeout>|null>(null)
  const pollRef    = useRef<ReturnType<typeof setInterval>|null>(null)
  const unmounted  = useRef(false)
  const symsRef    = useRef(symStateMap())
  const timelineRef= useRef<{second:number;count:number}[]>([])

  const clearAlerts = useCallback(() => setTriggeredAlerts([]), [])

  // ── CoinGecko REST polling (always works) ─────────────────────
  const startCoinGecko = useCallback(() => {
    if (pollRef.current) return   // already polling
    console.log("[CoinGecko] starting REST polling")
    setDataSource(prev => prev === "none" ? "coingecko" : prev)

    async function poll() {
      console.log("[Binance REST] polling prices...")
      try {
        const res  = await fetch(BINANCE_REST)
        console.log("[Binance REST] status:", res.status)
        const data = await res.json() as {symbol:string; lastPrice:string; priceChangePercent:string}[]
        console.log("[Binance REST] got", data.length, "symbols")
        const syms = symStateMap()
        for (const row of data) {
          const sym = row.symbol
          if (!syms[sym]) continue
          const price = parseFloat(row.lastPrice)
          syms[sym].lastPrice = price
          syms[sym].prices    = [price]
          console.log(`[Binance REST] ${sym} = $${price}`)
        }
        if (!unmounted.current) {
          setStats(buildStats(syms, []))
          setLastUpdate(new Date())
        }
      } catch(err) {
        console.error("[CoinGecko] poll error:", err)
      }
    }

    poll()
    pollRef.current = setInterval(poll, 15_000)
  }, [])

  // ── Binance direct WS ─────────────────────────────────────────
  const connectBinance = useCallback(() => {
    if (unmounted.current) return
    console.log("[Binance WS] attempting connection →", BINANCE_STREAM)
    setConnectionState("connecting")

    const ws = new WebSocket(BINANCE_STREAM)
    wsRef.current = ws
    const syms     = symsRef.current
    let   tickCount = 0

    // If not connected in 8s → fall back to CoinGecko
    const timeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn("[Binance WS] timed out after 8s — falling back to CoinGecko")
        ws.close()
        startCoinGecko()
      }
    }, WS_CONNECT_TIMEOUT)

    const broadcastId = setInterval(() => {
      if (unmounted.current) return
      setStats(buildStats(syms, timelineRef.current))
      setLastUpdate(new Date())
    }, 500)

    const timelineId = setInterval(() => {
      timelineRef.current.push({ second: Math.floor(Date.now()/1000), count: tickCount })
      tickCount = 0
      if (timelineRef.current.length > 300) timelineRef.current.shift()
    }, 1000)

    ws.onopen = () => {
      clearTimeout(timeout)
      if (unmounted.current) { ws.close(); return }
      console.log("[Binance WS] ✓ connected")
      setDataSource("binance-ws")
      setConnectionState("connected")
      delayRef.current = RECONNECT_MS
    }

    ws.onmessage = (ev) => {
      if (unmounted.current) return
      try {
        const msg = JSON.parse(ev.data) as { stream:string; data:Record<string,unknown> }
        const d   = msg.data
        const sym = (d["s"] as string).toUpperCase()
        if (!syms[sym]) return

        if (msg.stream.includes("@aggTrade")) {
          const price = parseFloat(d["p"] as string)
          const qty   = parseFloat(d["q"] as string)
          const isBuy = !(d["m"] as boolean)
          if (syms[sym].trades === 0) console.log(`[Binance WS] first trade ${sym} → $${price}`)
          syms[sym].lastPrice = price
          syms[sym].trades   += 1
          syms[sym].volume   += price * qty
          syms[sym].prices    = [...syms[sym].prices.slice(-59), price]
          if (isBuy) syms[sym].buyCount++; else syms[sym].sellCount++
          tickCount++
        } else if (msg.stream.includes("@miniTicker")) {
          const c = parseFloat(d["c"] as string)
          if (syms[sym].lastPrice === 0) {
            console.log(`[Binance WS] miniTicker ${sym} → $${c}`)
            syms[sym].lastPrice = c
          }
        }
      } catch(err) { console.error("[Binance WS] parse error:", err) }
    }

    ws.onclose = (e) => {
      clearTimeout(timeout)
      clearInterval(broadcastId)
      clearInterval(timelineId)
      console.warn("[Binance WS] closed — code:", e.code, "reason:", e.reason || "(none)")
      if (unmounted.current) return
      if (e.code === 1006 || e.code === 1001) {
        console.warn("[Binance WS] abnormal close — switching to CoinGecko")
        startCoinGecko()
        return
      }
      setConnectionState("disconnected")
      timerRef.current = setTimeout(() => {
        delayRef.current = Math.min(delayRef.current * 1.5, MAX_RECONNECT_MS)
        connectBinance()
      }, delayRef.current)
    }

    ws.onerror = (e) => {
      console.error("[Binance WS] onerror:", e)
      clearTimeout(timeout)
      ws.close()
    }
  }, [startCoinGecko])

  // ── Railway backend WS ────────────────────────────────────────
  const connectBackend = useCallback(() => {
    if (unmounted.current) return
    console.log("[Backend WS] connecting →", WS_URL)
    setConnectionState("connecting")
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return }
      console.log("[Backend WS] ✓ connected")
      setDataSource("backend")
      setConnectionState("connected")
      delayRef.current = RECONNECT_MS
    }

    let msgCount = 0
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === "stats") {
          msgCount++
          if (msgCount === 1) console.log("[Backend WS] first stats message received:", JSON.stringify(msg.payload).slice(0, 200))
          if (msgCount <= 3) console.log(`[Backend WS] stats #${msgCount} — BTC lastPrice:`, msg.payload?.symbolStats?.find((s: {symbol:string}) => s.symbol === "BTCUSDT")?.lastPrice)
          setStats(msg.payload)
          setLastUpdate(new Date())
        } else if (msg.type === "alert_triggered") {
          setTriggeredAlerts(p => [...p.slice(-9), msg.payload])
        } else {
          console.log("[Backend WS] unknown message type:", msg.type)
        }
      } catch(e) { console.error("[Backend WS] parse error:", e) }
    }

    ws.onclose = (e) => {
      console.warn("[Backend WS] closed — code:", e.code)
      if (unmounted.current) return
      setConnectionState("disconnected")
      timerRef.current = setTimeout(() => {
        delayRef.current = Math.min(delayRef.current * 1.5, MAX_RECONNECT_MS)
        connectBackend()
      }, delayRef.current)
    }

    ws.onerror = (e) => { console.error("[Backend WS] error:", e); ws.close() }
  }, [])

  // ── Bootstrap ─────────────────────────────────────────────────
  useEffect(() => {
    unmounted.current = false
    console.log("════════════════════════════════════════")
    console.log("[CryptoStream] useAnalytics mounted")
    console.log("[CryptoStream] HAS_BACKEND:", HAS_BACKEND)
    console.log("[CryptoStream] VITE_API_URL:", import.meta.env.VITE_API_URL ?? "(not set)")
    console.log("════════════════════════════════════════")

    // ALWAYS start CoinGecko immediately so prices show right away
    startCoinGecko()

    // Also try WebSocket for real-time data on top
    if (HAS_BACKEND) {
      connectBackend()
    } else {
      connectBinance()
    }

    return () => {
      unmounted.current = true
      console.log("[CryptoStream] useAnalytics unmounted — cleaning up")
      if (timerRef.current) clearTimeout(timerRef.current)
      if (pollRef.current)  clearInterval(pollRef.current)
      wsRef.current?.close()
    }
  }, [connectBackend, connectBinance, startCoinGecko])

  return { stats, connectionState, lastUpdate, triggeredAlerts, clearAlerts, dataSource }
}
