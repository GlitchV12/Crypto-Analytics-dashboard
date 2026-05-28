export interface BBPoint  { time: number; upper: number; middle: number; lower: number }
export interface RSIPoint  { time: number; value: number }
export interface MACDPoint { time: number; macd: number; signal: number; histogram: number }

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = 0; i < period - 1; i++) result.push(NaN)
  result.push(prev)
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

export function computeBB(closes: number[], times: number[], period = 20, mult = 2): BBPoint[] {
  const result: BBPoint[] = []
  for (let i = period - 1; i < closes.length; i++) {
    const slice  = closes.slice(i - period + 1, i + 1)
    const mean   = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period
    const std    = Math.sqrt(variance)
    result.push({ time: times[i], upper: mean + mult * std, middle: mean, lower: mean - mult * std })
  }
  return result
}

export function computeRSI(closes: number[], times: number[], period = 14): RSIPoint[] {
  if (closes.length < period + 1) return []
  const result: RSIPoint[] = []
  let avgGain = 0, avgLoss = 0

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) avgGain += diff; else avgLoss -= diff
  }
  avgGain /= period
  avgLoss /= period
  result.push({ time: times[period], value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) })

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    result.push({ time: times[i], value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) })
  }
  return result
}

export function computeMACD(
  closes: number[], times: number[],
  fast = 12, slow = 26, signal = 9,
): MACDPoint[] {
  const ema12 = ema(closes, fast)
  const ema26 = ema(closes, slow)
  const macdLine = ema12.map((v, i) => (isNaN(v) || isNaN(ema26[i])) ? NaN : v - ema26[i])

  const validMacd = macdLine.filter(v => !isNaN(v))
  const signalLine = ema(validMacd, signal)

  const result: MACDPoint[] = []
  let sigIdx = 0
  for (let i = 0; i < macdLine.length; i++) {
    if (isNaN(macdLine[i])) continue
    const sig = signalLine[sigIdx] ?? NaN
    if (!isNaN(sig)) {
      result.push({
        time:      times[i],
        macd:      macdLine[i],
        signal:    sig,
        histogram: macdLine[i] - sig,
      })
    }
    sigIdx++
  }
  return result
}
