/**
 * useLivePrices — fetches real crypto prices via CoinGecko REST API.
 * No WebSocket, no Binance dependency, works everywhere globally.
 * Polls every 15 seconds. Zero API key required.
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

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price" +
  "?ids=bitcoin,ethereum,binancecoin,solana,ripple" +
  "&vs_currencies=usd" +
  "&include_24hr_change=true" +
  "&include_24hr_vol=true" +
  "&include_high_vol=false"

const ID_TO_SYMBOL: Record<string, string> = {
  bitcoin:     "BTCUSDT",
  ethereum:    "ETHUSDT",
  binancecoin: "BNBUSDT",
  solana:      "SOLUSDT",
  ripple:      "XRPUSDT",
}

const EMPTY: Record<string, LivePrice> = {}

export function useLivePrices() {
  const [prices,    setPrices]    = useState<Record<string, LivePrice>>(EMPTY)
  const [status,    setStatus]    = useState<FetchStatus>("idle")
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [errMsg,    setErrMsg]    = useState("")
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const unmounted = useRef(false)

  async function fetchPrices() {
    console.log("[useLivePrices] fetching CoinGecko prices...")
    setStatus("loading")
    try {
      const res = await fetch(COINGECKO_URL, {
        headers: { Accept: "application/json" },
      })
      console.log("[useLivePrices] response status:", res.status)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as Record<string, Record<string, number>>
      console.log("[useLivePrices] raw data:", data)

      const next: Record<string, LivePrice> = {}
      for (const [id, vals] of Object.entries(data)) {
        const sym = ID_TO_SYMBOL[id]
        if (!sym) continue
        next[sym] = {
          symbol:    sym,
          price:     vals["usd"]            ?? 0,
          change24h: vals["usd_24h_change"] ?? 0,
          high24h:   0,
          low24h:    0,
        }
        console.log(`[useLivePrices] ${sym} = $${next[sym].price} (${next[sym].change24h.toFixed(2)}%)`)
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
    console.log("[useLivePrices] useEffect mounted — starting price polling")
    unmounted.current = false
    fetchPrices()
    timerRef.current = setInterval(fetchPrices, 15_000)
    return () => {
      unmounted.current = true
      if (timerRef.current) clearInterval(timerRef.current)
      console.log("[useLivePrices] unmounted")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { prices, status, lastFetch, errMsg }
}
