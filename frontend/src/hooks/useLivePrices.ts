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

// No custom headers — simple GET avoids CORS preflight, CoinGecko allows it
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price" +
  "?ids=bitcoin,ethereum,binancecoin,solana,ripple" +
  "&vs_currencies=usd" +
  "&include_24hr_change=true" +
  "&include_high_vol=false"

const ID_MAP: Record<string, string> = {
  bitcoin: "BTCUSDT", ethereum: "ETHUSDT",
  binancecoin: "BNBUSDT", solana: "SOLUSDT", ripple: "XRPUSDT",
}

export function useLivePrices() {
  const [prices,    setPrices]    = useState<Record<string, LivePrice>>({})
  const [status,    setStatus]    = useState<FetchStatus>("idle")
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [errMsg,    setErrMsg]    = useState("")
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const unmounted = useRef(false)

  async function fetchPrices() {
    console.log("[useLivePrices] fetching CoinGecko...")
    setStatus("loading")
    try {
      // Plain fetch — no custom headers to avoid CORS preflight
      const res = await fetch(COINGECKO_URL)
      console.log("[useLivePrices] CoinGecko status:", res.status)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json() as Record<string, Record<string, number>>
      console.log("[useLivePrices] CoinGecko data:", data)

      const next: Record<string, LivePrice> = {}
      for (const [id, vals] of Object.entries(data)) {
        const sym = ID_MAP[id]
        if (!sym) continue
        next[sym] = {
          symbol:    sym,
          price:     vals["usd"]            ?? 0,
          change24h: vals["usd_24h_change"] ?? 0,
          high24h:   0,
          low24h:    0,
        }
        console.log(`[useLivePrices] ${sym} = $${next[sym].price}`)
      }

      if (!unmounted.current) {
        setPrices(next)
        setStatus("ok")
        setLastFetch(new Date())
        setErrMsg("")
      }
    } catch (err) {
      console.error("[useLivePrices] failed:", err)
      if (!unmounted.current) { setStatus("error"); setErrMsg(String(err)) }
    }
  }

  useEffect(() => {
    console.log("[useLivePrices] mounted — polling CoinGecko every 15s")
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
