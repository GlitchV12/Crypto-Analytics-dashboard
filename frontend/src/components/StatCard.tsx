import type { ReactNode } from "react"

interface StatCardProps {
  label:     string
  value:     string
  subValue?: string
  icon:      ReactNode
  accent?:   "blue" | "green"
}

export function StatCard({ label, value, subValue, icon, accent = "blue" }: StatCardProps) {
  const color = accent === "green" ? "#10B981" : "#3B82F6"
  return (
    <div style={{
      background:   "#1E293B",
      border:       "1px solid #334155",
      borderRadius: 12,
      padding:      "20px 24px",
      display:      "flex",
      flexDirection: "column",
      gap:          8,
      position:     "relative",
      overflow:     "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {label}
        </span>
        <div style={{ color, opacity: 0.85 }}>{icon}</div>
      </div>
      <span style={{ fontSize: 30, fontWeight: 700, color: "#F1F5F9", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
      {subValue && <span style={{ fontSize: 12, color: "#64748B" }}>{subValue}</span>}
    </div>
  )
}
