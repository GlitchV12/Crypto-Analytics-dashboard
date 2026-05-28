import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts"
import type { ChartPoint } from "../../lib/forecast"

interface Props {
  data:    ChartPoint[]
  color:   string
  nowSec:  number
}

function fmtTime(sec: number) {
  const d = new Date(sec * 1000)
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

export function ForecastChart({ data, color, nowSec }: Props) {
  if (data.length === 0) {
    return (
      <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 13 }}>
        Collecting price data — check back in a minute…
      </div>
    )
  }

  const prices = data.flatMap(d => [d.actual, d.forecast, d.forecastAdjusted].filter(Boolean) as number[])
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const pad  = (maxP - minP) * 0.08 || maxP * 0.02

  const tickFmt = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
        <XAxis
          dataKey="minute"
          tickFormatter={fmtTime}
          tick={{ fill: "#475569", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minP - pad, maxP + pad]}
          tick={{ fill: "#475569", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={tickFmt}
        />
        <Tooltip
          contentStyle={{ background: "#0F172A", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }}
          labelFormatter={v => fmtTime(v as number)}
          formatter={(v: number, name: string) => {
            const labels: Record<string, string> = {
              actual:          "Actual",
              forecast:        "Base forecast",
              forecastAdjusted: "Adjusted forecast",
            }
            return [`$${v.toLocaleString("en-US", { maximumFractionDigits: 4 })}`, labels[name] ?? name]
          }}
          labelStyle={{ color: "#94A3B8" }}
        />
        <Legend
          formatter={(value) => {
            const m: Record<string, string> = {
              actual:           "Actual price",
              forecast:         "Base forecast",
              forecastAdjusted: "With elements",
            }
            return <span style={{ fontSize: 11, color: "#94A3B8" }}>{m[value] ?? value}</span>
          }}
        />
        <ReferenceLine x={nowSec} stroke="#334155" strokeDasharray="4 4" label={{ value: "Now", fill: "#475569", fontSize: 10 }} />
        <Line
          type="monotone"
          dataKey="actual"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="forecast"
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="6 3"
          dot={false}
          isAnimationActive={false}
          connectNulls
          strokeOpacity={0.6}
        />
        <Line
          type="monotone"
          dataKey="forecastAdjusted"
          stroke="#10B981"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
