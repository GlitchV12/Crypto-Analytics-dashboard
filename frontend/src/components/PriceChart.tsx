import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts"
import type { PricePoint } from "../types"
import { shortSym } from "../lib/format"

const COLORS: Record<string, string> = {
  BTCUSDT: "#F59E0B",
  ETHUSDT: "#3B82F6",
  BNBUSDT: "#10B981",
  SOLUSDT: "#8B5CF6",
  XRPUSDT: "#EC4899",
}

interface Props {
  data:    PricePoint[]
  symbols: string[]
}

function fmtTime(sec: number) {
  const d = new Date(sec * 1000)
  return `${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`
}

// recharts needs flat objects — transform PricePoint[] into that shape
function flatten(data: PricePoint[]) {
  return data
    .slice(-60)
    .map(p => ({ second: p.second, ...p.prices }))
    .sort((a, b) => a.second - b.second)
}

export function PriceChart({ data, symbols }: Props) {
  const flat = flatten(data)

  return (
    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px" }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 16px" }}>
        Price History — Last 60s
      </h2>
      {symbols.map(sym => (
        <div key={sym} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: COLORS[sym] ?? "#94A3B8", fontWeight: 600, marginBottom: 6 }}>
            {shortSym(sym)} / USDT
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={flat} margin={{ top: 2, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
              <XAxis dataKey="second" tickFormatter={fmtTime} tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis
                domain={["auto","auto"]}
                tick={{ fill: "#475569", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={60}
                tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(2)}
              />
              <Tooltip
                contentStyle={{ background: "#0F172A", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }}
                labelFormatter={(v) => fmtTime(v as number)}
                formatter={(v: number) => [`$${v.toLocaleString("en-US", { maximumFractionDigits: 4 })}`, shortSym(sym)]}
                labelStyle={{ color: "#94A3B8" }}
              />
              <Line
                type="monotone"
                dataKey={sym}
                stroke={COLORS[sym] ?? "#3B82F6"}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
      {flat.length === 0 && (
        <div style={{ color: "#475569", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
          Waiting for price data…
        </div>
      )}
    </div>
  )
}
