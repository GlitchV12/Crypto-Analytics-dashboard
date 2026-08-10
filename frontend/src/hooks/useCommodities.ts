import { useState, useEffect, useRef } from "react"

export interface CommodityPoint { t: number; price: number }

export interface Commodity {
  id:       string
  name:     string
  symbol:   string
  unit:     string
  price:    number
  change:   number   // absolute
  changePct:number   // %
  high24:   number
  low24:    number
  color:    string
  history:  CommodityPoint[]
}

const SEEDS: Omit<Commodity, "change"|"changePct"|"high24"|"low24"|"history">[] = [
  { id: "gold",       name: "Gold",         symbol: "XAU",  unit: "per oz",     price: 2345.60, color: "#F59E0B" },
  { id: "silver",     name: "Silver",       symbol: "XAG",  unit: "per oz",     price: 30.48,   color: "#94A3B8" },
  { id: "platinum",   name: "Platinum",     symbol: "XPT",  unit: "per oz",     price: 1012.40, color: "#E2E8F0" },
  { id: "palladium",  name: "Palladium",    symbol: "XPD",  unit: "per oz",     price: 924.75,  color: "#A78BFA" },
  { id: "crude_oil",  name: "Crude Oil",    symbol: "WTI",  unit: "per bbl",    price: 82.14,   color: "#F97316" },
  { id: "nat_gas",    name: "Natural Gas",  symbol: "NGS",  unit: "per MMBtu",  price: 2.87,    color: "#3B82F6" },
  { id: "coal",       name: "Coal",         symbol: "COAL", unit: "per ton",    price: 131.50,  color: "#6B7280" },
  { id: "copper",     name: "Copper",       symbol: "HG",   unit: "per lb",     price: 4.52,    color: "#EF4444" },
]

const HISTORY_LEN = 60  // 60 data points

function jitter(base: number, volatility = 0.002) {
  return base * (1 + (Math.random() - 0.5) * volatility * 2)
}

function buildHistory(seed: number, volatility: number): CommodityPoint[] {
  const now  = Date.now()
  const hist: CommodityPoint[] = []
  let   p    = seed
  for (let i = HISTORY_LEN; i >= 0; i--) {
    p = jitter(p, volatility * 3)
    hist.push({ t: now - i * 5_000, price: p })
  }
  return hist
}

function volatilityOf(id: string) {
  const map: Record<string, number> = {
    gold: 0.0008, silver: 0.0015, platinum: 0.0012,
    palladium: 0.002, crude_oil: 0.0018, nat_gas: 0.003,
    coal: 0.001, copper: 0.0016,
  }
  return map[id] ?? 0.001
}

function initCommodities(): Commodity[] {
  return SEEDS.map(s => {
    const vol  = volatilityOf(s.id)
    const hist = buildHistory(s.price, vol)
    const open = hist[0].price
    return {
      ...s,
      change:    s.price - open,
      changePct: ((s.price - open) / open) * 100,
      high24:    Math.max(...hist.map(h => h.price)) * (1 + Math.random() * 0.005),
      low24:     Math.min(...hist.map(h => h.price)) * (1 - Math.random() * 0.005),
      history:   hist,
    }
  })
}

export function useCommodities() {
  const [commodities, setCommodities] = useState<Commodity[]>(() => initCommodities())
  const openPrices = useRef<Record<string, number>>({})

  // Store open prices on first render
  useEffect(() => {
    commodities.forEach(c => {
      if (!(c.id in openPrices.current)) {
        openPrices.current[c.id] = c.history[0]?.price ?? c.price
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tick every 3s
  useEffect(() => {
    const id = setInterval(() => {
      setCommodities(prev => prev.map(c => {
        const vol     = volatilityOf(c.id)
        const newPrice= jitter(c.price, vol)
        const newHist = [...c.history.slice(1), { t: Date.now(), price: newPrice }]
        const open    = openPrices.current[c.id] ?? newHist[0].price
        return {
          ...c,
          price:     newPrice,
          change:    newPrice - open,
          changePct: ((newPrice - open) / open) * 100,
          high24:    Math.max(c.high24, newPrice),
          low24:     Math.min(c.low24,  newPrice),
          history:   newHist,
        }
      }))
    }, 3_000)
    return () => clearInterval(id)
  }, [])

  return commodities
}
