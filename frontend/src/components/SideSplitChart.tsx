import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import type { SideCount } from "../types"

const COLORS = { buy: "#10B981", sell: "#F87171" }

interface Props { data: SideCount[] }

export function SideSplitChart({ data }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1
  const buyPct = ((data.find(d => d.side === "buy")?.count ?? 0) / total * 100).toFixed(1)

  return (
    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
          Buy / Sell Pressure
        </h2>
        <span style={{ fontSize: 13, fontWeight: 700, color: Number(buyPct) >= 50 ? "#10B981" : "#F87171" }}>
          {buyPct}% buys
        </span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="side"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={3}
            isAnimationActive={false}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={COLORS[d.side as keyof typeof COLORS] ?? "#94A3B8"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#0F172A", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
            formatter={(v, name) => [`${v} trades`, name]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span style={{ color: "#94A3B8", fontSize: 12, textTransform: "capitalize" }}>{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
