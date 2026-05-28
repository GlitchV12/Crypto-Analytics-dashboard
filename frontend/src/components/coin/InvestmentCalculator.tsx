import { useState } from "react"
import { formatUSD, formatPrice } from "../../lib/format"

interface Props {
  currentPrice:  number
  trendSlope:    number   // price change per second from regression
}

type Strategy = "lump" | "dca_weekly" | "dca_monthly"
type Horizon  = 7 | 30 | 90 | 365

const HORIZONS: Horizon[] = [7, 30, 90, 365]
const HORIZON_LABEL: Record<Horizon, string> = { 7: "1 week", 30: "1 month", 90: "3 months", 365: "1 year" }

function project(
  currentPrice: number,
  amount:       number,
  strategy:     Strategy,
  horizonDays:  Horizon,
  slopePerSec:  number,
  scenarioMult: number,
): { totalInvested: number; finalValue: number; gain: number; returnPct: number } {
  const horizonSec = horizonDays * 86400
  const futurePrice = Math.max(currentPrice + slopePerSec * horizonSec * scenarioMult, 0.000001)

  if (strategy === "lump") {
    const coins = amount / currentPrice
    const finalValue = coins * futurePrice
    const gain = finalValue - amount
    return { totalInvested: amount, finalValue, gain, returnPct: (gain / amount) * 100 }
  }

  // DCA: simulate periodic buys
  const intervalDays = strategy === "dca_weekly" ? 7 : 30
  const periods = Math.max(1, Math.floor(horizonDays / intervalDays))
  const perPeriod = amount / periods
  let totalCoins = 0
  let totalInvested = 0

  for (let i = 0; i < periods; i++) {
    const daysSoFar = i * intervalDays
    const priceAtBuy = Math.max(currentPrice + slopePerSec * daysSoFar * 86400 * scenarioMult, 0.000001)
    totalCoins    += perPeriod / priceAtBuy
    totalInvested += perPeriod
  }

  const finalValue = totalCoins * futurePrice
  const gain = finalValue - totalInvested
  return { totalInvested, finalValue, gain, returnPct: (gain / totalInvested) * 100 }
}

export function InvestmentCalculator({ currentPrice, trendSlope }: Props) {
  const [amount,   setAmount]   = useState(1000)
  const [strategy, setStrategy] = useState<Strategy>("lump")
  const [horizon,  setHorizon]  = useState<Horizon>(30)

  if (currentPrice === 0) {
    return (
      <div style={{ color: "#475569", fontSize: 13 }}>Waiting for price data…</div>
    )
  }

  const scenarios: { label: string; mult: number; color: string }[] = [
    { label: "Bear",       mult: 0.7,  color: "#EF4444" },
    { label: "Base",       mult: 1.0,  color: "#94A3B8" },
    { label: "Bull",       mult: 1.5,  color: "#10B981" },
  ]

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
        Investment Calculator
      </div>

      {/* Inputs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={{ fontSize: 11, color: "#475569", display: "block", marginBottom: 4 }}>Amount (USD)</label>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
            style={{
              width: "100%", padding: "7px 10px",
              background: "#0F172A", border: "1px solid #334155",
              borderRadius: 6, color: "#F1F5F9", fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={{ fontSize: 11, color: "#475569", display: "block", marginBottom: 4 }}>Strategy</label>
          <select
            value={strategy}
            onChange={e => setStrategy(e.target.value as Strategy)}
            style={{
              width: "100%", padding: "7px 10px",
              background: "#0F172A", border: "1px solid #334155",
              borderRadius: 6, color: "#F1F5F9", fontSize: 13,
              boxSizing: "border-box",
            }}
          >
            <option value="lump">Lump Sum</option>
            <option value="dca_weekly">DCA Weekly</option>
            <option value="dca_monthly">DCA Monthly</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={{ fontSize: 11, color: "#475569", display: "block", marginBottom: 4 }}>Horizon</label>
          <select
            value={horizon}
            onChange={e => setHorizon(Number(e.target.value) as Horizon)}
            style={{
              width: "100%", padding: "7px 10px",
              background: "#0F172A", border: "1px solid #334155",
              borderRadius: 6, color: "#F1F5F9", fontSize: 13,
              boxSizing: "border-box",
            }}
          >
            {HORIZONS.map(h => <option key={h} value={h}>{HORIZON_LABEL[h]}</option>)}
          </select>
        </div>
      </div>

      {/* Current price context */}
      <div style={{ fontSize: 11, color: "#475569", marginBottom: 12 }}>
        Current price: <span style={{ color: "#F1F5F9" }}>{formatPrice(currentPrice)}</span>
        &nbsp;·&nbsp;Trend: <span style={{ color: trendSlope >= 0 ? "#10B981" : "#EF4444" }}>
          {trendSlope >= 0 ? "▲" : "▼"} {Math.abs(trendSlope * 60).toFixed(4)}/min
        </span>
      </div>

      {/* Results table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {["Scenario", "Invested", "Value", "Gain/Loss", "Return"].map(h => (
              <th key={h} style={{
                textAlign: h === "Scenario" ? "left" : "right",
                color: "#475569", fontWeight: 600, paddingBottom: 8,
                textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 10,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scenarios.map(sc => {
            const r = project(currentPrice, amount, strategy, horizon, trendSlope, sc.mult)
            const gainColor = r.gain >= 0 ? "#10B981" : "#EF4444"
            return (
              <tr key={sc.label} style={{ borderTop: "1px solid #1F2937" }}>
                <td style={{ padding: "9px 0", color: sc.color, fontWeight: 600 }}>{sc.label}</td>
                <td style={{ textAlign: "right", color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>
                  {formatUSD(r.totalInvested)}
                </td>
                <td style={{ textAlign: "right", color: "#F1F5F9", fontVariantNumeric: "tabular-nums" }}>
                  {formatUSD(r.finalValue)}
                </td>
                <td style={{ textAlign: "right", color: gainColor, fontVariantNumeric: "tabular-nums" }}>
                  {r.gain >= 0 ? "+" : ""}{formatUSD(r.gain)}
                </td>
                <td style={{ textAlign: "right", color: gainColor, fontVariantNumeric: "tabular-nums" }}>
                  {r.returnPct >= 0 ? "+" : ""}{r.returnPct.toFixed(1)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 10, color: "#334155", marginTop: 10, lineHeight: 1.5 }}>
        Bear = trend × 0.7 · Base = trend · Bull = trend × 1.5. Not financial advice — projections are illustrative only.
      </div>
    </div>
  )
}
