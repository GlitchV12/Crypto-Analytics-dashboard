import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import type { SymbolStat } from "../types"
import { shortSym } from "../lib/format"

const COLORS = ["#F59E0B", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899"]

interface Props { data: SymbolStat[] }

export function VolumeBar({ data }: Props) {
  const chartData = data.map(s => ({ name: shortSym(s.symbol), volume: Math.round(s.volume) }))
  return (
    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px" }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 16px" }}>
        Volume by Pair (1m)
      </h2>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: "#64748B", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}
          />
          <Tooltip
            contentStyle={{ background: "#0F172A", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
            cursor={{ fill: "#1F2937" }}
            formatter={(v: number) => [`$${v.toLocaleString()}`, "Volume"]}
          />
          <Bar dataKey="volume" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
