import { useState } from "react"
import { useNavigate }       from "react-router-dom"
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { useCommodities }    from "../hooks/useCommodities"
import type { Commodity }    from "../hooks/useCommodities"
import { ConnectionBadge }   from "../components/ConnectionBadge"
import { useAnalytics }      from "../hooks/useAnalytics"

/* ─── Tiny sparkline (SVG) ─────────────────────────────── */
function Sparkline({ history, color, width = 140, height = 44 }: {
  history: { price: number }[]
  color:   string
  width?:  number
  height?: number
}) {
  if (history.length < 2) return null
  const prices = history.map(h => h.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width
    const y = height - ((p - min) / range) * (height - 6) - 3
    return `${x},${y}`
  })
  const pathD = "M" + pts.join(" L")
  const areaD = `${pathD} L${width},${height} L0,${height} Z`

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#sg-${color.replace("#","")})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─── Commodity card ────────────────────────────────────── */
function CommodityCard({ c, selected, onClick }: {
  c:        Commodity
  selected: boolean
  onClick:  () => void
}) {
  const up      = c.changePct >= 0
  const TrendIcon = c.changePct === 0 ? Minus : up ? TrendingUp : TrendingDown
  const trendColor = c.changePct === 0 ? "#94A3B8" : up ? "#10B981" : "#EF4444"

  function fmtPrice(p: number) {
    if (p >= 1000) return `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    if (p >= 10)   return `$${p.toFixed(2)}`
    return `$${p.toFixed(4)}`
  }

  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? c.color + "12" : "#1E293B",
        border:     `1px solid ${selected ? c.color : "#334155"}`,
        borderRadius: 12, padding: "18px 20px", cursor: "pointer",
        textAlign: "left", width: "100%", transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: c.color,
              background: c.color + "20", borderRadius: 4,
              padding: "2px 6px", letterSpacing: "0.04em",
            }}>
              {c.symbol}
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>{c.name}</div>
          <div style={{ fontSize: 10, color: "#475569" }}>{c.unit}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: trendColor }}>
          <TrendIcon size={13} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>
            {c.changePct >= 0 ? "+" : ""}{c.changePct.toFixed(2)}%
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
          {fmtPrice(c.price)}
        </div>
        <div style={{ fontSize: 11, color: trendColor, fontVariantNumeric: "tabular-nums" }}>
          {c.change >= 0 ? "+" : ""}{c.change.toFixed(c.price >= 100 ? 2 : 4)}
        </div>
      </div>

      <Sparkline history={c.history} color={c.changePct >= 0 ? "#10B981" : "#EF4444"} />

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <div style={{ fontSize: 10, color: "#475569" }}>
          L <span style={{ color: "#EF4444", fontVariantNumeric: "tabular-nums" }}>{fmtPrice(c.low24)}</span>
        </div>
        <div style={{ fontSize: 10, color: "#475569" }}>
          H <span style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>{fmtPrice(c.high24)}</span>
        </div>
      </div>
    </button>
  )
}

/* ─── Large price chart (SVG) ───────────────────────────── */
function PriceChart({ c }: { c: Commodity }) {
  const prices = c.history.map(h => h.price)
  const min    = Math.min(...prices)
  const max    = Math.max(...prices)
  const range  = max - min || 1
  const W = 700, H = 200

  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W
    const y = H - ((p - min) / range) * (H - 20) - 10
    return `${x},${y}`
  })
  const pathD = "M" + pts.join(" L")
  const areaD = `${pathD} L${W},${H} L0,${H} Z`

  const up = c.changePct >= 0
  const lineColor = up ? "#10B981" : "#EF4444"

  function fmtPrice(p: number) {
    if (p >= 1000) return `$${p.toFixed(2)}`
    if (p >= 10)   return `$${p.toFixed(2)}`
    return `$${p.toFixed(4)}`
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={lineColor} stopOpacity={0.2} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = H - t * (H - 20) - 10
        return (
          <g key={i}>
            <line x1={0} y1={y} x2={W} y2={y} stroke="#1E293B" strokeWidth={1} />
            <text x={-8} y={y + 4} fill="#334155" fontSize={10} textAnchor="end">
              {fmtPrice(min + t * range)}
            </text>
          </g>
        )
      })}
      <path d={areaD} fill="url(#chartFill)" />
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─── Stats row ─────────────────────────────────────────── */
function StatBadge({ label, value, color = "#94A3B8" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, padding: "12px 16px", minWidth: 130 }}>
      <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────── */
export function CommoditiesPage() {
  const navigate                              = useNavigate()
  const commodities                           = useCommodities()
  const { connectionState, lastUpdate }       = useAnalytics()
  const [selected, setSelected]               = useState<string>("gold")
  const [filter,   setFilter]                 = useState<"all"|"metals"|"energy">("all")

  const active = commodities.find(c => c.id === selected) ?? commodities[0]

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: "all",    label: "All" },
    { key: "metals", label: "Precious Metals" },
    { key: "energy", label: "Energy" },
  ]

  const metalIds  = ["gold","silver","platinum","palladium","copper"]
  const energyIds = ["crude_oil","nat_gas","coal"]

  const visible = commodities.filter(c => {
    if (filter === "metals") return metalIds.includes(c.id)
    if (filter === "energy") return energyIds.includes(c.id)
    return true
  })

  function fmtPrice(p: number) {
    if (p >= 1000) return `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    if (p >= 10)   return `$${p.toFixed(2)}`
    return `$${p.toFixed(4)}`
  }

  const up = active ? active.changePct >= 0 : true
  const TrendIcon = !active ? Minus : active.changePct === 0 ? Minus : up ? TrendingUp : TrendingDown

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "#F1F5F9", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>

      {/* Header */}
      <header style={{
        borderBottom: "1px solid #1E293B", padding: "0 32px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#0A1220", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => navigate("/")} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none",
            border: "1px solid #334155", borderRadius: 6, padding: "5px 10px",
            color: "#94A3B8", cursor: "pointer", fontSize: 13,
          }}>
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg,#F59E0B,#D97706)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
            }}>
              🏅
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9" }}>Commodities</div>
              <div style={{ fontSize: 11, color: "#475569" }}>Metals · Energy · Live simulated feed</div>
            </div>
          </div>
        </div>
        <ConnectionBadge state={connectionState} lastUpdate={lastUpdate} />
      </header>

      <main style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: "6px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer",
              border:     `1px solid ${filter === f.key ? "#F59E0B" : "#334155"}`,
              background: filter === f.key ? "#F59E0B20" : "transparent",
              color:      filter === f.key ? "#F59E0B" : "#64748B",
            }}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>

          {/* Left: detail panel */}
          <div>
            {active && (
              <>
                {/* Hero card */}
                <div style={{
                  background: "#1E293B", border: `1px solid ${active.color}40`,
                  borderRadius: 16, padding: "26px 28px", marginBottom: 16,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <div style={{
                          fontSize: 11, fontWeight: 700, color: active.color,
                          background: active.color + "20", borderRadius: 6, padding: "3px 8px",
                        }}>
                          {active.symbol}
                        </div>
                        <span style={{ fontSize: 13, color: "#475569" }}>{active.unit}</span>
                      </div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: "#F1F5F9", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                        {fmtPrice(active.price)}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <TrendIcon size={14} color={up ? "#10B981" : "#EF4444"} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: up ? "#10B981" : "#EF4444", fontVariantNumeric: "tabular-nums" }}>
                          {active.change >= 0 ? "+" : ""}{active.change.toFixed(active.price >= 100 ? 2 : 4)}
                          {" "}({active.changePct >= 0 ? "+" : ""}{active.changePct.toFixed(2)}%)
                        </span>
                        <span style={{ fontSize: 11, color: "#475569" }}>session</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
                    <StatBadge label="Session High" value={fmtPrice(active.high24)} color="#10B981" />
                    <StatBadge label="Session Low"  value={fmtPrice(active.low24)}  color="#EF4444" />
                    <StatBadge label="Open"         value={fmtPrice(active.history[0]?.price ?? active.price)} />
                    <StatBadge label="Spread"       value={`${(((active.high24 - active.low24) / active.low24) * 100).toFixed(2)}%`} />
                  </div>

                  {/* Chart */}
                  <div style={{ padding: "0 10px 0 40px" }}>
                    <PriceChart c={active} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingLeft: 40, fontSize: 10, color: "#334155" }}>
                    <span>5 min ago</span>
                    <span>now</span>
                  </div>
                </div>

                {/* Market info */}
                <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "18px 22px" }}>
                  <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                    About {active.name}
                  </div>
                  <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, margin: 0 }}>
                    {ABOUT[active.id] ?? `${active.name} is a globally traded commodity. Prices shown are simulated from real-world baseline values updated every 3 seconds.`}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Right: commodity cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.map(c => (
              <CommodityCard
                key={c.id}
                c={c}
                selected={selected === c.id}
                onClick={() => setSelected(c.id)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

const ABOUT: Record<string, string> = {
  gold:      "Gold (XAU) is the premier safe-haven asset, widely held by central banks as a reserve. Prices are driven by inflation expectations, USD strength, and geopolitical risk. Measured in troy ounces (oz).",
  silver:    "Silver (XAG) serves dual roles as an industrial metal (electronics, solar panels) and a monetary asset. More volatile than gold due to smaller market size and industrial demand swings.",
  platinum:  "Platinum (XPT) is rarer than gold, primarily used in automotive catalytic converters and hydrogen fuel cells. South Africa and Russia supply over 70% of global output.",
  palladium: "Palladium (XPD) is critical for gasoline-engine catalytic converters. Supply is heavily concentrated in Russia and South Africa, making it prone to geopolitical price shocks.",
  crude_oil: "West Texas Intermediate (WTI) crude oil is the primary US benchmark. Prices are influenced by OPEC+ production decisions, US inventories, global demand, and USD strength.",
  nat_gas:   "Natural Gas (Henry Hub) is a key energy commodity for electricity generation and heating. Prices are highly seasonal, responding to weather patterns and storage levels.",
  coal:      "Thermal coal is used primarily for electricity generation. Demand is driven by Asian power markets (China, India). Prices respond to LNG prices and renewable energy adoption.",
  copper:    "Copper (HG) is called 'Dr. Copper' because its price is considered a barometer of global economic health. Used extensively in construction, EVs, and electrical infrastructure.",
}
