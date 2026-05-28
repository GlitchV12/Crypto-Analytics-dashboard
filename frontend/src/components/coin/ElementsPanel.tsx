import type { ElementFactor } from "../../lib/forecast"

interface Props {
  elements:    ElementFactor[]
  fearGreed:   number
  onChange:    (elements: ElementFactor[]) => void
  onFearGreed: (v: number) => void
}

export function ElementsPanel({ elements, fearGreed, onChange, onFearGreed }: Props) {
  const toggle = (id: string) =>
    onChange(elements.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e))

  const fgLabel = fearGreed < 25 ? "Extreme Fear" : fearGreed < 45 ? "Fear" : fearGreed < 55 ? "Neutral" : fearGreed < 75 ? "Greed" : "Extreme Greed"
  const fgColor = fearGreed < 40 ? "#EF4444" : fearGreed > 60 ? "#10B981" : "#94A3B8"

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
        Market Elements
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
        {elements.map(el => {
          const isPos = el.effect > 0
          return (
            <button
              key={el.id}
              onClick={() => toggle(el.id)}
              title={el.description}
              style={{
                padding:       "8px 10px",
                borderRadius:  8,
                border:        `1px solid ${el.enabled ? (isPos ? "#10B981" : "#EF4444") : "#1E293B"}`,
                background:    el.enabled ? (isPos ? "#10B98122" : "#EF444422") : "#0F172A",
                cursor:        "pointer",
                textAlign:     "left",
                transition:    "all 0.15s",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: el.enabled ? (isPos ? "#10B981" : "#EF4444") : "#64748B" }}>
                {el.label}
              </div>
              <div style={{ fontSize: 10, color: el.enabled ? (isPos ? "#6EE7B7" : "#FCA5A5") : "#475569", marginTop: 2 }}>
                {isPos ? "+" : ""}{(el.effect * 100).toFixed(0)}%
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#94A3B8" }}>Fear &amp; Greed Index</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: fgColor }}>{fgLabel} ({fearGreed})</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={fearGreed}
        onChange={e => onFearGreed(Number(e.target.value))}
        style={{ width: "100%", accentColor: fgColor, cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 4 }}>
        <span>Fear</span>
        <span>Neutral</span>
        <span>Greed</span>
      </div>
    </div>
  )
}
