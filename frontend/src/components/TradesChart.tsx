import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts"
import type { TimePoint } from "../types"

interface Props { data: TimePoint[] }

function fmtTime(sec: number) {
  const d = new Date(sec * 1000)
  return `${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`
}

export function TradesChart({ data }: Props) {
  const display = [...data].sort((a, b) => a.second - b.second).slice(-60)
  return (
    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px" }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 16px" }}>
        Trades / Second — Last 60s
      </h2>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={display} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="tgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
          <XAxis dataKey="second" tickFormatter={fmtTime} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip
            contentStyle={{ background: "#0F172A", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(v) => `Time: ${fmtTime(v as number)}`}
            formatter={(v) => [`${v} trades`, "Count"]}
            labelStyle={{ color: "#94A3B8" }}
            itemStyle={{ color: "#3B82F6" }}
          />
          <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} fill="url(#tgrad)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
