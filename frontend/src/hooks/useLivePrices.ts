import { useEffect, useRef, useState } from "react"

export interface LivePrice {
  symbol:    string   // e.g. "BTCUSDT"
  price:     number
  change:    number   // 24h change %
  high:      number
  low:       number
  connected: boolean
}

const PAIRS   = ["btcusdt","ethusdt","bnbusdt","solusdt","xrpusdt"]
const STREAM  = "wss://stream.binance.com:9443/stream?streams=" +
  PAIRS.map(s => `${s}@miniTicker`).join("/")

const DEFAULT: Record<string, LivePrice> = {
  BTCUSDT: { symbol:"BTCUSDT", price:0, change:0, high:0, low:0, connected:false },
  ETHUSDT: { symbol:"ETHUSDT", price:0, change:0, high:0, low:0, connected:false },
  BNBUSDT: { symbol:"BNBUSDT", price:0, change:0, high:0, low:0, connected:false },
  SOLUSDT: { symbol:"SOLUSDT", price:0, change:0, high:0, low:0, connected:false },
  XRPUSDT: { symbol:"XRPUSDT", price:0, change:0, high:0, low:0, connected:false },
}

export type WSStatus = "connecting" | "connected" | "error" | "blocked"

export function useLivePrices() {
  const [prices,   setPrices]   = useState<Record<string, LivePrice>>(DEFAULT)
  const [status,   setStatus]   = useState<WSStatus>("connecting")
  const [errMsg,   setErrMsg]   = useState("")
  const wsRef     = useRef<WebSocket | null>(null)
  const unmounted = useRef(false)

  useEffect(() => {
    unmounted.current = false

    function connect() {
      console.log("[useLivePrices] opening →", STREAM)
      const ws = new WebSocket(STREAM)
      wsRef.current = ws

      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn("[useLivePrices] connection timed out after 8s")
          setStatus("blocked")
          setErrMsg("WebSocket timed out — Binance may be blocked on this network")
          ws.close()
        }
      }, 8000)

      ws.onopen = () => {
        clearTimeout(timeout)
        if (unmounted.current) { ws.close(); return }
        console.log("[useLivePrices] ✓ connected")
        setStatus("connected")
        setErrMsg("")
      }

      ws.onmessage = (ev) => {
        if (unmounted.current) return
        try {
          const msg  = JSON.parse(ev.data)
          const d    = msg.data
          const sym  = (d.s as string).toUpperCase()
          const c    = parseFloat(d.c)   // close price
          const P    = parseFloat(d.P)   // price change %
          const h    = parseFloat(d.h)
          const l    = parseFloat(d.l)
          setPrices(prev => ({
            ...prev,
            [sym]: { symbol: sym, price: c, change: P, high: h, low: l, connected: true },
          }))
        } catch { /* ignore */ }
      }

      ws.onerror = () => {
        clearTimeout(timeout)
        console.error("[useLivePrices] WebSocket error — likely blocked")
        setStatus("error")
        setErrMsg("WebSocket error — check if Binance is reachable")
      }

      ws.onclose = (e) => {
        clearTimeout(timeout)
        console.warn("[useLivePrices] closed — code:", e.code)
        if (unmounted.current) return
        if (e.code === 1006) {
          setStatus("blocked")
          setErrMsg(`Connection refused (code 1006) — Binance WebSocket may be blocked`)
        }
        // Retry after 4s
        setTimeout(() => { if (!unmounted.current) connect() }, 4000)
      }
    }

    connect()
    return () => {
      unmounted.current = true
      wsRef.current?.close()
    }
  }, [])

  return { prices, status, errMsg }
}
