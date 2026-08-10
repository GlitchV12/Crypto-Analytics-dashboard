import { useState, useEffect, useRef } from "react"
import type { PricePoint }   from "./types"
import { Routes, Route, useNavigate, useLocation } from "react-router-dom"
import { TrendingUp, Activity, DollarSign, Zap, BarChart2, LogOut, User, Search } from "lucide-react"
import { useAnalytics }      from "./hooks/useAnalytics"
import { usePinnedCryptos }  from "./hooks/usePinnedCryptos"
import { StatCard }          from "./components/StatCard"
import { PriceChart }        from "./components/PriceChart"
import { TradesChart }       from "./components/TradesChart"
import { SymbolTable }       from "./components/SymbolTable"
import { SideSplitChart }    from "./components/SideSplitChart"
import { VolumeBar }         from "./components/VolumeBar"
import { ConnectionBadge }   from "./components/ConnectionBadge"
import { CoinDetail }        from "./pages/CoinDetail"
import { ErrorBoundary }     from "./components/ErrorBoundary"
import { CryptoSearch }      from "./components/CryptoSearch"
import { TradePage }         from "./pages/TradePage"
import { CommoditiesPage }   from "./pages/CommoditiesPage"
import { LoginPage }         from "./pages/LoginPage"
import { LandingPage }       from "./pages/LandingPage"
import { useAuth }           from "./contexts/AuthContext"
import { formatUSD, formatRate, formatPrice, formatNumber } from "./lib/format"

/* ─── Protected Route ────────────────────────────── */
function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user)   return <LandingPage />
  return <>{children}</>
}

/* ─── Shared Nav Header ──────────────────────────── */
function AppHeader() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout } = useAuth()

  const NAV = [
    { path: "/",            label: "Dashboard",   icon: <BarChart2 size={14} /> },
    { path: "/trade",       label: "Trade",       icon: <DollarSign size={14} /> },
    { path: "/commodities", label: "Commodities", icon: <TrendingUp size={14} /> },
  ]

  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  return (
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
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => navigate("/")}>
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
          </div>
        </div>

        {/* Nav tabs */}
        <nav style={{ display: "flex", gap: 2, marginLeft: 12 }}>
          {NAV.map(n => {
            const active = location.pathname === n.path
            return (
              <button
                key={n.path}
                onClick={() => navigate(n.path)}
                style={{
                  display:    "flex",
                  alignItems: "center",
                  gap:        6,
                  padding:    "5px 14px",
                  borderRadius: 8,
                  border:     `1px solid ${active ? "#3B82F6" : "transparent"}`,
                  background: active ? "#3B82F620" : "transparent",
                  color:      active ? "#3B82F6" : "#64748B",
                  fontSize:   13,
                  fontWeight: active ? 600 : 400,
                  cursor:     "pointer",
                  transition: "all 0.12s",
                }}
              >
                {n.icon}
                {n.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Right: user info + logout */}
      {user && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "#1E293B", border: "1px solid #334155",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <User size={14} color="#64748B" />
              </div>
            )}
            <span style={{ fontSize: 13, color: "#94A3B8" }}>{user.name}</span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display:    "flex",
              alignItems: "center",
              gap:        5,
              padding:    "5px 10px",
              borderRadius: 6,
              border:     "1px solid #334155",
              background: "none",
              color:      "#64748B",
              fontSize:   12,
              cursor:     "pointer",
            }}
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      )}
    </header>
  )
}

/* ─── Home ───────────────────────────────────────── */
function Home() {
  const { stats, connectionState, lastUpdate } = useAnalytics()
  const navigate    = useNavigate()
  const [showSearch, setShowSearch] = useState(false)
  const {
    pinned, prices: pinnedPrices,
    searchResult, searching, searchErr,
    search, pin, unpin, isPinned, isDefault,
  } = usePinnedCryptos()

  // Merge live WS stats with REST prices for ALL pinned symbols
  const allSymbolStats = pinned.map(sym => {
    const live = stats?.symbolStats?.find(s => s.symbol === sym)
    const pinP = pinnedPrices[sym]
    return {
      symbol:    sym,
      lastPrice: live?.lastPrice ?? pinP?.lastPrice ?? 0,
      avgPrice:  live?.avgPrice  ?? pinP?.lastPrice ?? 0,
      trades:    live?.trades    ?? 0,
      volume:    live?.volume    ?? pinP?.volume    ?? 0,
    }
  })

  const btc    = stats?.symbolStats?.find(s => s.symbol === "BTCUSDT")
  const topVol = stats?.symbolStats?.[0]
  const volume = stats?.totalVolume ?? 0

  // Build merged price history — uses refs so the interval never restarts
  const localHistRef      = useRef<PricePoint[]>([])
  const allStatsRef       = useRef(allSymbolStats)
  const pinnedPricesRef   = useRef(pinnedPrices)
  const [mergedHistory, setMergedHistory] = useState<PricePoint[]>([])

  // Keep refs current without triggering effect re-runs
  useEffect(() => { allStatsRef.current     = allSymbolStats }, [allSymbolStats])
  useEffect(() => { pinnedPricesRef.current = pinnedPrices   }, [pinnedPrices])

  // Single stable interval — reads from refs, never restarts
  useEffect(() => {
    const id = setInterval(() => {
      const prices: Record<string, number> = {}
      allStatsRef.current.forEach(s     => { if (s.lastPrice   > 0) prices[s.symbol]   = s.lastPrice })
      Object.values(pinnedPricesRef.current).forEach(p => { if (p.lastPrice > 0) prices[p.symbol] = p.lastPrice })
      if (Object.keys(prices).length === 0) return
      localHistRef.current = [...localHistRef.current.slice(-299), { second: Math.floor(Date.now() / 1000), prices }]
      setMergedHistory([...localHistRef.current])
    }, 1_000)
    return () => clearInterval(id)
  }, []) // empty deps — intentional, reads via refs

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "#F1F5F9", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      <AppHeader />

      <main style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>

        {/* Sub-header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#475569" }}>
            Live Binance trades · BTC · ETH · BNB · SOL · XRP
          </div>
          <ConnectionBadge state={connectionState} lastUpdate={lastUpdate} />
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <button onClick={() => navigate("/trade")} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8, border: "1px solid #10B98140",
            background: "#10B98110", color: "#10B981", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            <DollarSign size={14} /> Trade Crypto
          </button>
          <button onClick={() => navigate("/commodities")} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8, border: "1px solid #F59E0B40",
            background: "#F59E0B10", color: "#F59E0B", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            🏅 Commodities
          </button>
          <button onClick={() => setShowSearch(true)} style={{
            display: "flex", alignItems: "center", gap: 6, marginLeft: "auto",
            padding: "8px 18px", borderRadius: 8, border: "1px solid #3B82F640",
            background: "#3B82F610", color: "#3B82F6", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            <Search size={14} /> Search &amp; Pin Crypto
          </button>
        </div>

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
          <SymbolTable data={allSymbolStats} />
          <SideSplitChart data={stats?.sideSplit ?? []} />
        </div>

        {/* Bottom: price history + volume bar */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}>
          <PriceChart data={mergedHistory} symbols={pinned} />
          <VolumeBar  data={allSymbolStats} />
        </div>
      </main>

      {/* Crypto Search Modal */}
      {showSearch && (
        <CryptoSearch
          onClose={() => setShowSearch(false)}
          onSearch={search}
          results={searchResult}
          searching={searching}
          searchErr={searchErr}
          isPinned={isPinned}
          isDefault={isDefault}
          pin={pin}
          unpin={unpin}
          pinned={pinned}
          prices={pinnedPrices}
        />
      )}

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

/* ─── Coin Detail wrapper (adds AppHeader) ───────── */
function CoinDetailPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "#F1F5F9", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      <AppHeader />
      <CoinDetail embedded />
    </div>
  )
}

/* ─── Router ─────────────────────────────────────── */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <Protected><Home /></Protected>
      } />
      <Route path="/coin/:symbol" element={
        <ErrorBoundary><Protected><CoinDetailPage /></Protected></ErrorBoundary>
      } />
      <Route path="/trade" element={
        <Protected><TradePage /></Protected>
      } />
      <Route path="/commodities" element={
        <Protected><CommoditiesPage /></Protected>
      } />
    </Routes>
  )
}
