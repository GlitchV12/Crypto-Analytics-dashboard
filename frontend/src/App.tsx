import { Routes, Route } from "react-router-dom"
import { TrendingUp, Activity, DollarSign, Zap } from "lucide-react"
import { useAnalytics } from "./hooks/useAnalytics"
import { StatCard }      from "./components/StatCard"
import { PriceChart }    from "./components/PriceChart"
import { TradesChart }   from "./components/TradesChart"
import { SymbolTable }   from "./components/SymbolTable"
import { SideSplitChart } from "./components/SideSplitChart"
import { VolumeBar }     from "./components/VolumeBar"
import { ConnectionBadge } from "./components/ConnectionBadge"
import { CoinDetail }    from "./pages/CoinDetail"
import { formatUSD, formatRate, formatPrice, formatNumber } from "./lib/format"

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"]

function Home() {
  const { stats, connectionState, lastUpdate } = useAnalytics()

  const btc     = stats?.symbolStats?.find(s => s.symbol === "BTCUSDT")
  const topVol  = stats?.symbolStats?.[0]
  const volume  = stats?.totalVolume ?? 0

  return (
    <div style={{
      minHeight:  "100vh",
      background: "#0F172A",
      color:      "#F1F5F9",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Header */}
      <header style={{
        borderBottom:   "1px solid #1E293B",
        padding:        "0 32px",
        height:         60,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        background:     "#0A1220",
        position:       "sticky",
        top:            0,
        zIndex:         100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <TrendingUp size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", letterSpacing: "-0.01em" }}>
              CryptoStream
            </div>
            <div style={{ fontSize: 11, color: "#475569" }}>
              Live Binance trades · BTC · ETH · BNB · SOL · XRP
            </div>
          </div>
        </div>
        <ConnectionBadge state={connectionState} lastUpdate={lastUpdate} />
      </header>

      <main style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>

        {/* KPI row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 16, marginBottom: 20,
        }}>
          <StatCard
            label="BTC Price"
            value={btc ? formatPrice(btc.lastPrice) : "—"}
            subValue="BTCUSDT · last trade"
            icon={<TrendingUp size={18} />}
            accent="blue"
          />
          <StatCard
            label="Trades / Second"
            value={formatRate(stats?.tradesPerSec ?? 0)}
            subValue="across all 5 pairs"
            icon={<Zap size={18} />}
            accent="blue"
          />
          <StatCard
            label="Volume (5 min)"
            value={formatUSD(volume)}
            subValue="sum of price × qty"
            icon={<DollarSign size={18} />}
            accent="green"
          />
          <StatCard
            label="Total Trades (5 min)"
            value={formatNumber(stats?.totalTrades ?? 0)}
            subValue={topVol ? `Top: ${topVol.symbol.replace("USDT","")}` : "—"}
            icon={<Activity size={18} />}
            accent="green"
          />
        </div>

        {/* Trade throughput chart */}
        <div style={{ marginBottom: 16 }}>
          <TradesChart data={stats?.timeline ?? []} />
        </div>

        {/* Middle: symbol table + side split */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 16, marginBottom: 16,
        }}>
          <SymbolTable data={stats?.symbolStats ?? []} />
          <SideSplitChart data={stats?.sideSplit ?? []} />
        </div>

        {/* Bottom: price history + volume bar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}>
          <PriceChart data={stats?.priceHistory ?? []} symbols={SYMBOLS} />
          <VolumeBar  data={stats?.symbolStats ?? []} />
        </div>

      </main>

      {/* Connecting overlay */}
      {!stats && connectionState === "connecting" && (
        <div style={{
          position: "fixed", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#0F172Acc", gap: 16, zIndex: 200,
        }}>
          <div style={{
            width: 40, height: 40,
            border: "3px solid #1E293B",
            borderTopColor: "#3B82F6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <span style={{ color: "#64748B", fontSize: 14 }}>Connecting to Binance stream…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/"             element={<Home />} />
      <Route path="/coin/:symbol" element={<CoinDetail />} />
    </Routes>
  )
}
