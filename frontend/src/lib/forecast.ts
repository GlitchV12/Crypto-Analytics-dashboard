import type { CoinMinuteBucket } from "../types"

export interface ElementFactor {
  id:          string
  label:       string
  description: string
  effect:      number   // decimal, e.g. -0.40 = -40%
  enabled:     boolean
}

export const DEFAULT_ELEMENTS: ElementFactor[] = [
  { id: "crash",       label: "Market Crash",         description: "Broad macro selloff",          effect: -0.40, enabled: false },
  { id: "bullrun",     label: "Bull Run",              description: "Strong upward momentum",       effect:  0.60, enabled: false },
  { id: "whale",       label: "Whale Dump",            description: "Large holder liquidates",      effect: -0.20, enabled: false },
  { id: "halving",     label: "BTC Halving Effect",    description: "Post-halving supply shock",    effect:  0.30, enabled: false },
  { id: "regulation",  label: "Regulatory Crackdown",  description: "New restrictive laws",         effect: -0.25, enabled: false },
  { id: "institutional", label: "Institutional Buy",   description: "Major fund allocation",        effect:  0.35, enabled: false },
  { id: "defi",        label: "DeFi Boom",             description: "Protocol adoption surge",      effect:  0.25, enabled: false },
  { id: "hack",        label: "Exchange Hack",         description: "Security breach / FUD",        effect: -0.30, enabled: false },
]

export interface ChartPoint {
  minute:           number    // unix seconds
  actual?:          number
  forecast?:        number
  forecastAdjusted?: number
}

export interface ForecastResult {
  chartData:       ChartPoint[]
  currentPrice:    number
  baseTarget:      number
  adjustedTarget:  number
  percentChange:   number
  trendDirection:  "up" | "down" | "flat"
}

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 }
  // Normalize x to avoid floating-point drift with large timestamps
  const x0  = xs[0]
  const nxs = xs.map(x => x - x0)
  const mX  = nxs.reduce((a, b) => a + b, 0) / n
  const mY  = ys.reduce((a, b) => a + b, 0) / n
  const ssXX = nxs.reduce((a, x) => a + (x - mX) ** 2, 0)
  const ssXY = nxs.reduce((a, x, i) => a + (x - mX) * (ys[i] - mY), 0)
  const slope     = ssXX === 0 ? 0 : ssXY / ssXX
  const intercept = mY - slope * mX   // intercept at x=0 (normalized, i.e. at first data point)
  return { slope, intercept }
}

export function computeForecast(
  history:        CoinMinuteBucket[],
  horizonMinutes: number,
  elements:       ElementFactor[],
  fearGreed:      number,   // 0–100
): ForecastResult {
  if (history.length === 0) {
    return { chartData: [], currentPrice: 0, baseTarget: 0, adjustedTarget: 0, percentChange: 0, trendDirection: "flat" }
  }

  const xs = history.map(b => b.minute)
  const ys = history.map(b => b.avgPrice)

  const x0 = xs[0]
  const { slope, intercept } = linearRegression(xs, ys)
  const predict = (sec: number) => Math.max(intercept + slope * (sec - x0), ys[ys.length - 1] * 0.1)

  const currentPrice = ys[ys.length - 1]
  const lastMinute   = xs[xs.length - 1]

  // Element & fear/greed multiplier (all compound multiplicatively)
  const elemMult      = elements.filter(e => e.enabled).reduce((m, e) => m * (1 + e.effect), 1)
  const fgEffect      = ((fearGreed - 50) / 50) * 0.20
  const totalMult     = elemMult * (1 + fgEffect)
  const hasAdjustment = elements.some(e => e.enabled) || fearGreed !== 50

  const chartData: ChartPoint[] = history.map(b => ({ minute: b.minute, actual: b.avgPrice }))

  for (let i = 1; i <= horizonMinutes; i++) {
    const minute   = lastMinute + i * 60
    const base     = predict(minute)
    const adjusted = hasAdjustment ? base * totalMult : undefined
    chartData.push({ minute, forecast: base, forecastAdjusted: adjusted })
  }

  const baseTarget     = predict(lastMinute + horizonMinutes * 60)
  const adjustedTarget = hasAdjustment ? baseTarget * totalMult : baseTarget
  const percentChange  = ((adjustedTarget - currentPrice) / currentPrice) * 100
  const trendDirection = slope > 0.001 ? "up" : slope < -0.001 ? "down" : "flat"

  return { chartData, currentPrice, baseTarget, adjustedTarget, percentChange, trendDirection }
}
