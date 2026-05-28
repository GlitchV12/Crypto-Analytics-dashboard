import { INSIGHTS, TYPE_COLOR } from "../../lib/insightsData"
import type { InsightType } from "../../lib/insightsData"

interface Props { symbol: string }

const TYPE_ICON: Record<InsightType, string> = {
  tip:      "💡",
  warning:  "⚠️",
  info:     "ℹ️",
  strategy: "📈",
}

const TYPE_LABEL: Record<InsightType, string> = {
  tip:      "Tip",
  warning:  "Warning",
  info:     "Info",
  strategy: "Strategy",
}

export function CoinInsights({ symbol }: Props) {
  const items = INSIGHTS[symbol] ?? []

  if (items.length === 0) {
    return (
      <div style={{ color: "#475569", fontSize: 13 }}>No insights available for this pair yet.</div>
    )
  }

  return (
    <div>
      <div style={{
        fontSize: 13, fontWeight: 600, color: "#94A3B8",
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16,
      }}>
        Insights &amp; Strategy
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {items.map((item, i) => {
          const color = TYPE_COLOR[item.type]
          return (
            <div
              key={i}
              style={{
                background:   "#0F172A",
                border:       `1px solid ${color}33`,
                borderLeft:   `3px solid ${color}`,
                borderRadius: 10,
                padding:      "14px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{TYPE_ICON[item.type]}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {TYPE_LABEL[item.type]}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9", marginBottom: 6 }}>
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.6 }}>
                {item.body}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
