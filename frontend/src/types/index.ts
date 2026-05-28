export interface SymbolStat {
  symbol:    string
  trades:    number
  volume:    number
  lastPrice: number
  avgPrice:  number
}

export interface SideCount {
  side:  string
  count: number
}

export interface TimePoint {
  second: number
  count:  number
}

export interface PricePoint {
  second: number
  prices: Record<string, number>
}

export interface Stats {
  tradesPerSec: number
  totalTrades:  number
  totalVolume:  number
  symbolStats:  SymbolStat[]
  sideSplit:    SideCount[]
  timeline:     TimePoint[]
  priceHistory: PricePoint[]
  timestamp:    number
}

export interface CoinMinuteBucket {
  minute:    number
  avgPrice:  number
  trades:    number
  volume:    number
  buyCount:  number
  sellCount: number
}

export interface CoinDetail {
  symbol:    string
  history:   CoinMinuteBucket[]
  lastPrice: number
  minPrice:  number
  maxPrice:  number
  trades:    number
  volume:    number
  buyCount:  number
  sellCount: number
}

export interface Candle {
  symbol:   string
  openTime: number   // Unix seconds
  open:     number
  high:     number
  low:      number
  close:    number
  volume:   number
}

export interface Alert {
  id:        number
  symbol:    string
  direction: "above" | "below"
  price:     number
  active:    boolean
  createdAt: number
}

export interface TriggeredAlert {
  id:           number
  symbol:       string
  direction:    "above" | "below"
  targetPrice:  number
  currentPrice: number
}

export type WSMessage =
  | { type: "stats";           payload: Stats }
  | { type: "alert_triggered"; payload: TriggeredAlert }
