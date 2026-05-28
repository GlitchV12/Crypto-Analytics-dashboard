import type { ConnectionState } from "../hooks/useAnalytics"

const CONFIG = {
  connected:    { label: "Live",         color: "#10B981", pulse: true  },
  connecting:   { label: "Connecting…",  color: "#F59E0B", pulse: false },
  disconnected: { label: "Disconnected", color: "#F87171", pulse: false },
}

interface Props {
  state:      ConnectionState
  lastUpdate: Date | null
}

export function ConnectionBadge({ state, lastUpdate }: Props) {
  const cfg = CONFIG[state]
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      {lastUpdate && (
        <span style={{ fontSize: 12, color: "#475569" }}>
          Updated {lastUpdate.toLocaleTimeString()}
        </span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          display:      "inline-block",
          width:        8,
          height:       8,
          borderRadius: "50%",
          background:   cfg.color,
          boxShadow:    cfg.pulse ? `0 0 0 2px ${cfg.color}33` : "none",
        }} />
        <span style={{ fontSize: 12, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
      </div>
    </div>
  )
}
