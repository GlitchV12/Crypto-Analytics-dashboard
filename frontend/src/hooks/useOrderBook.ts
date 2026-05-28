import { useEffect, useRef, useState } from "react"

export interface DepthLevel { price: number; qty: number }

export interface OrderBook {
  bids: DepthLevel[]   // sorted descending (highest bid first)
  asks: DepthLevel[]   // sorted ascending  (lowest ask first)
}

export interface DepthPoint {
  price:    number
  bidDepth?: number   // cumulative bid volume at/above this price
  askDepth?: number   // cumulative ask volume at/below this price
}

export function toDepthChart(book: OrderBook, levels = 20): DepthPoint[] {
  // Bids: sorted desc → cumulate from the top (highest bid downward)
  const bids = book.bids.slice(0, levels)
  const asks = book.asks.slice(0, levels)
  const points: DepthPoint[] = []

  let cum = 0
  for (let i = bids.length - 1; i >= 0; i--) {
    cum += bids[i].qty
    points.unshift({ price: bids[i].price, bidDepth: cum })
  }
  cum = 0
  for (const ask of asks) {
    cum += ask.qty
    points.push({ price: ask.price, askDepth: cum })
  }
  return points
}

export function useOrderBook(symbol: string): OrderBook | null {
  const [book, setBook] = useState<OrderBook | null>(null)
  const wsRef      = useRef<WebSocket | null>(null)
  const unmounted  = useRef(false)

  useEffect(() => {
    unmounted.current = false
    const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth20@100ms`
    const ws  = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (ev) => {
      if (unmounted.current) return
      try {
        const raw = JSON.parse(ev.data)
        setBook({
          bids: raw.bids.map(([p, q]: [string, string]) => ({ price: parseFloat(p), qty: parseFloat(q) })),
          asks: raw.asks.map(([p, q]: [string, string]) => ({ price: parseFloat(p), qty: parseFloat(q) })),
        })
      } catch { /* ignore */ }
    }

    ws.onerror = () => ws.close()

    return () => {
      unmounted.current = true
      ws.close()
    }
  }, [symbol])

  return book
}
