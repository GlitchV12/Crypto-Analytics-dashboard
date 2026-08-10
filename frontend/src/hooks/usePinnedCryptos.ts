import { useState, useEffect, useRef, useCallback } from "react"

const STORAGE_KEY  = "cs_pinned_cryptos"
const DEFAULT_PINS = ["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT"]

export interface CryptoInfo {
  symbol:    string   // e.g. BTCUSDT
  base:      string   // BTC
  quote:     string   // USDT
  lastPrice: number
  change24h: number
  volume:    number
}

function loadPins(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as string[]
      if (Array.isArray(arr) && arr.length) return arr
    }
  } catch {}
  return [...DEFAULT_PINS]
}

function savePins(pins: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pins))
}

export function usePinnedCryptos() {
  const [pinned,       setPinned]       = useState<string[]>(loadPins)
  const [prices,       setPrices]       = useState<Record<string, CryptoInfo>>({})
  const [searchQuery,  setSearchQuery]  = useState("")
  const [searchResult, setSearchResult] = useState<CryptoInfo[]>([])
  const [searching,    setSearching]    = useState(false)
  const [searchErr,    setSearchErr]    = useState("")
  const unmounted = useRef(false)
  const pollRef   = useRef<ReturnType<typeof setInterval>|null>(null)

  // Fetch prices for all pinned symbols
  const fetchPrices = useCallback(async (symbols: string[]) => {
    if (!symbols.length) return
    try {
      const enc = encodeURIComponent(JSON.stringify(symbols))
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${enc}`)
      if (!res.ok) return
      const rows = await res.json() as {
        symbol: string; lastPrice: string
        priceChangePercent: string; quoteVolume: string
      }[]
      const next: Record<string, CryptoInfo> = {}
      rows.forEach(r => {
        next[r.symbol] = {
          symbol:    r.symbol,
          base:      r.symbol.replace(/USDT$|BTC$|ETH$|BNB$/, ""),
          quote:     r.symbol.endsWith("USDT") ? "USDT" : r.symbol.slice(-3),
          lastPrice: parseFloat(r.lastPrice),
          change24h: parseFloat(r.priceChangePercent),
          volume:    parseFloat(r.quoteVolume),
        }
      })
      if (!unmounted.current) setPrices(next)
    } catch {}
  }, [])

  // Poll prices for pinned symbols every 5s
  useEffect(() => {
    unmounted.current = false
    fetchPrices(pinned)
    pollRef.current = setInterval(() => fetchPrices(pinned), 5_000)
    return () => {
      unmounted.current = true
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [pinned, fetchPrices])

  // Search Binance for matching symbols
  const search = useCallback(async (query: string) => {
    const q = query.trim().toUpperCase()
    if (!q) { setSearchResult([]); return }
    setSearching(true)
    setSearchErr("")
    try {
      // Use exchange info to find matching symbols (cached in browser)
      const res = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbols=` +
        encodeURIComponent(JSON.stringify(
          // Build candidate symbols: append USDT if no suffix
          [q + "USDT", q + "BTC", q + "ETH", q + "BNB",
           "BTC" + q, "ETH" + q]
        ))
      ).catch(() => null)

      // Also try a broader search via exchangeInfo filter
      const res2 = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr`
      ).catch(() => null)

      if (res2 && res2.ok) {
        const all = await res2.json() as { symbol:string; lastPrice:string; priceChangePercent:string; quoteVolume:string }[]
        const matches = all
          .filter(r =>
            r.symbol.startsWith(q) ||
            r.symbol.includes(q) ||
            r.symbol.endsWith("USDT") && r.symbol.startsWith(q)
          )
          .filter(r => r.symbol.endsWith("USDT"))   // only USDT pairs for simplicity
          .slice(0, 20)
          .map(r => ({
            symbol:    r.symbol,
            base:      r.symbol.replace("USDT",""),
            quote:     "USDT",
            lastPrice: parseFloat(r.lastPrice),
            change24h: parseFloat(r.priceChangePercent),
            volume:    parseFloat(r.quoteVolume),
          }))
        if (!unmounted.current) setSearchResult(matches)
      } else if (res && res.ok) {
        const rows = await res.json() as { symbol:string; lastPrice:string; priceChangePercent:string; quoteVolume:string }[]
        const valid = rows.filter(r => parseFloat(r.lastPrice) > 0).map(r => ({
          symbol: r.symbol, base: r.symbol.replace(/USDT|BTC|ETH|BNB$/,""),
          quote: "USDT", lastPrice: parseFloat(r.lastPrice),
          change24h: parseFloat(r.priceChangePercent), volume: parseFloat(r.quoteVolume),
        }))
        if (!unmounted.current) setSearchResult(valid)
      }
    } catch(e) {
      setSearchErr("Search failed — check connection")
    } finally {
      if (!unmounted.current) setSearching(false)
    }
  }, [])

  const pin = useCallback((symbol: string) => {
    setPinned(prev => {
      if (prev.includes(symbol)) return prev
      const next = [...prev, symbol]
      savePins(next)
      return next
    })
  }, [])

  const unpin = useCallback((symbol: string) => {
    setPinned(prev => {
      if (DEFAULT_PINS.includes(symbol)) return prev  // can't unpin defaults
      const next = prev.filter(s => s !== symbol)
      savePins(next)
      return next
    })
  }, [])

  const isPinned     = useCallback((s: string) => pinned.includes(s), [pinned])
  const isDefault    = useCallback((s: string) => DEFAULT_PINS.includes(s), [])

  return {
    pinned, prices,
    searchQuery, setSearchQuery,
    searchResult, searching, searchErr,
    search, pin, unpin, isPinned, isDefault,
  }
}
