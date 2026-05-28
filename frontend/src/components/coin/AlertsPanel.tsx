import { useEffect, useState } from "react"
import { Bell, BellOff, Trash2 } from "lucide-react"
import type { Alert, TriggeredAlert } from "../../types"
import { formatPrice } from "../../lib/format"

interface Props {
  symbol:          string
  currentPrice:    number
  triggeredAlerts: TriggeredAlert[]
  onClear:         () => void
}

export function AlertsPanel({ symbol, currentPrice, triggeredAlerts, onClear }: Props) {
  const [alerts,    setAlerts]    = useState<Alert[]>([])
  const [direction, setDirection] = useState<"above" | "below">("above")
  const [price,     setPrice]     = useState("")
  const [creating,  setCreating]  = useState(false)
  const [error,     setError]     = useState("")
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default")

  useEffect(() => {
    if (typeof Notification !== "undefined") setNotifPerm(Notification.permission)
  }, [])

  useEffect(() => {
    fetch(`/api/alerts?symbol=${symbol}`)
      .then(r => r.json())
      .then((data: Alert[]) => setAlerts(data.filter(a => a.symbol === symbol)))
      .catch(() => {})
  }, [symbol])

  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined") return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
  }

  const createAlert = async () => {
    const p = parseFloat(price)
    if (!price || isNaN(p) || p <= 0) { setError("Enter a valid price"); return }
    setCreating(true); setError("")
    try {
      const resp = await fetch("/api/alerts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ symbol, direction, price: p }),
      })
      if (!resp.ok) throw new Error("Failed")
      const alert: Alert = await resp.json()
      setAlerts(prev => [alert, ...prev])
      setPrice("")
    } catch {
      setError("Could not create alert")
    } finally {
      setCreating(false)
    }
  }

  const deleteAlert = async (id: number) => {
    try {
      await fetch(`/api/alerts/${id}`, { method: "DELETE" })
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch { /* ignore */ }
  }

  const activeAlerts    = alerts.filter(a => a.active)
  const triggeredForSym = triggeredAlerts.filter(a => a.symbol === symbol)

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Price Alerts
        </div>
        {notifPerm !== "granted" && (
          <button
            onClick={requestNotifPermission}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 10, color: "#F59E0B", background: "#F59E0B22",
              border: "1px solid #F59E0B44", borderRadius: 5, padding: "3px 8px", cursor: "pointer",
            }}
          >
            <Bell size={10} /> Enable notifications
          </button>
        )}
        {notifPerm === "granted" && (
          <span style={{ fontSize: 10, color: "#10B981", display: "flex", alignItems: "center", gap: 3 }}>
            <Bell size={10} /> Notifications on
          </span>
        )}
      </div>

      {/* Triggered alerts toast */}
      {triggeredForSym.length > 0 && (
        <div style={{ background: "#F59E0B22", border: "1px solid #F59E0B44", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#F59E0B" }}>Triggered</span>
            <button onClick={onClear} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 10 }}>
              Clear
            </button>
          </div>
          {triggeredForSym.map((t, i) => (
            <div key={i} style={{ fontSize: 11, color: "#F1F5F9", marginBottom: 2 }}>
              {t.direction === "above" ? "▲" : "▼"}&nbsp;
              {symbol.replace("USDT","")} hit {formatPrice(t.targetPrice)} &nbsp;
              <span style={{ color: "#64748B" }}>(now {formatPrice(t.currentPrice)})</span>
            </div>
          ))}
        </div>
      )}

      {/* Create alert form */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {(["above","below"] as const).map(d => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              style={{
                flex: 1, padding: "6px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                border:     `1px solid ${direction === d ? (d === "above" ? "#10B981" : "#EF4444") : "#334155"}`,
                background: direction === d ? (d === "above" ? "#10B98122" : "#EF444422") : "transparent",
                color:      direction === d ? (d === "above" ? "#10B981" : "#EF4444") : "#64748B",
              }}
            >
              {d === "above" ? "▲ Above" : "▼ Below"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="number"
            min={0}
            placeholder={`Price (now ${formatPrice(currentPrice)})`}
            value={price}
            onChange={e => { setPrice(e.target.value); setError("") }}
            onKeyDown={e => e.key === "Enter" && createAlert()}
            style={{
              flex: 1, padding: "7px 10px",
              background: "#0F172A", border: "1px solid #334155",
              borderRadius: 6, color: "#F1F5F9", fontSize: 12,
            }}
          />
          <button
            onClick={createAlert}
            disabled={creating}
            style={{
              padding: "7px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer",
              background: "#3B82F6", border: "none", color: "#fff", fontWeight: 600,
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? "…" : "Set"}
          </button>
        </div>
        {error && <div style={{ fontSize: 11, color: "#EF4444", marginTop: 4 }}>{error}</div>}
      </div>

      {/* Active alerts list */}
      {activeAlerts.length === 0 ? (
        <div style={{ fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
          <BellOff size={13} /> No active alerts for {symbol.replace("USDT","")}
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Active ({activeAlerts.length})
          </div>
          {activeAlerts.map(a => (
            <div key={a.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "7px 0", borderTop: "1px solid #1F2937",
            }}>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: a.direction === "above" ? "#10B981" : "#EF4444", fontWeight: 600 }}>
                  {a.direction === "above" ? "▲" : "▼"} {a.direction}
                </span>
                <span style={{ color: "#F1F5F9", marginLeft: 6, fontVariantNumeric: "tabular-nums" }}>
                  {formatPrice(a.price)}
                </span>
              </div>
              <button
                onClick={() => deleteAlert(a.id)}
                style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 4 }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
