/**
 * useLivePrices — Binance REST API polling.
 * CORS-friendly, no API key, works from browser globally.
 */
import { useEffect, useRef, useState } from "react"

console.log("[useLivePrices] module loaded")

export interface LivePrice {
  symbol:    string
  price:     number
  change24h: number
  high24h:   number
  low24h:    number
}

export type FetchStatus = "idle" | "loading" | "ok" | "error"

const BINANCE_REST =
  'https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT"]'

const EMPTY: Record<string, LivePrice> = {}

export function useLivePrices() {
  const [prices,    setPrices]    = useState<Record<string, LivePrice>>(EMPTY)
  const [status,    setStatus]    = useState<FetchStatus>("idle")
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [errMsg,    setErrMsg]    = useState("")
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const unmounted = useRef(false)

  async function fetchPrices() {
    console.log("[useLivePrices] fetching from Binance REST...")
    setStatus("loading")
    try {
      const res = await fetch(BINANCE_REST)
      console.log("[useLivePrices] Binance REST status:", res.status)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json() as {
        symbol: string
        lastPrice: string
        priceChangePercent: string
        highPrice: string
        lowPrice: string
      }[]

      console.log("[useLivePrices] got", data.length, "tickers")

      const next: Record<string, LivePrice> = {}
      for (const row of data) {
        next[row.symbol] = {
          symbol:    row.symbol,
          price:     parseFloat(row.lastPrice),
          change24h: parseFloat(row.priceChangePercent),
          high24h:   parseFloat(row.highPrice),
          low24h:    parseFloat(row.lowPrice),
        }
        console.log(`[useLivePrices] ${row.symbol} = $${row.lastPrice} (${row.priceChangePercent}%)`)
      }

      if (!unmounted.current) {
        setPrices(next)
        setStatus("ok")
        setLastFetch(new Date())
        setErrMsg("")
      }
    } catch (err) {
      console.error("[useLivePrices] fetch failed:", err)
      if (!unmounted.current) {
        setStatus("error")
        setErrMsg(String(err))
      }
    }
  }

  useEffect(() => {
    console.log("[useLivePrices] mounting — starting Binance REST polling")
    unmounted.current = false
    fetchPrices()
    timerRef.current = setInterval(fetchPrices, 15_000)
    return () => {
      unmounted.current = true
      if (timerRef.current) clearInterval(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { prices, status, lastFetch, errMsg }
}
