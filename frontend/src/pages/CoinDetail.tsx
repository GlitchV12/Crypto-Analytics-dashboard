import { useEffect, useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Activity, DollarSign } from "lucide-react"
import { useAnalytics }           from "../hooks/useAnalytics"
import { ForecastChart }          from "../components/coin/ForecastChart"
import { ElementsPanel }          from "../components/coin/ElementsPanel"
import { InvestmentCalculator }   from "../components/coin/InvestmentCalculator"
import { CoinInsights }           from "../components/coin/CoinInsights"
import { CandlestickChart }       from "../components/coin/CandlestickChart"
import { OrderBookDepth }         from "../components/coin/OrderBookDepth"
import { AlertsPanel }            from "../components/coin/AlertsPanel"
import { ConnectionBadge }        from "../components/ConnectionBadge"
import { formatPrice, formatUSD, formatNumber, shortSym } from "../lib/format"
import { computeForecast, DEFAULT_ELEMENTS } from "../lib/forecast"
import type { ElementFactor }     from "../lib/forecast"
import type { CoinDetail as CoinDetailType, Candle } from "../types"

const COIN_COLORS: Record<string, string> = {
  BTCUSDT: "#F59E0B",
  ETHUSDT: "#3B82F6",
  BNBUSDT: "#10B981",
  SOLUSDT: "#8B5CF6",
  XRPUSDT: "#EC4899",
}

const HORIZON_OPTIONS = [15, 30, 60] as const
type HorizonMin = typeof HORIZON_OPTIONS[number]
type ChartTab   = "candles" | "forecast" | "orderbook"

function StatPill({ label, value, color = "#94A3B8" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 8, padding: "10px 16px", minWidth: 120 }}>
      <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  )
}

export function CoinDetail() {
  const { symbol = "" }          = useParams<{ symbol: string }>()
  const navigate                 = useNavigate()
  const { stats, connectionState, lastUpdate, triggeredAlerts, clearAlerts } = useAnalytics()

  const [detail,    setDetail]    = useState<CoinDetailType | null>(null)
  const [candles,   setCandles]   = useState<Candle[]>([])
  const [loading,   setLoading]   = useState(true)
  const [chartTab,  setChartTab]  = useState<ChartTab>("candles")
  const [elements,  setElements]  = useState<ElementFactor[]>(DEFAULT_ELEMENTS)
  const [fearGreed, setFearGreed] = useState(50)
  const [horizon,   setHorizon]   = useState<HorizonMin>(30)

  // Fetch coin detail + candles
  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    Promise.all([
      fetch(`/api/coin/${symbol}`).then(r => r.json()),
      fetch(`/api/coin/${symbol}/candles`).then(r => r.json()),
    ]).then(([det, cdls]: [CoinDetailType, Candle[]]) => {
      setDetail(det)
      setCandles(cdls ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [symbol])

  // Refresh candles every 90s
  useEffect(() => {
    if (!symbol) return
    const id = setInterval(() => {
      fetch(`/api/coin/${symbol}/candles`).then(r => r.json()).then((cdls: Candle[]) => setCandles(cdls ?? [])).catch(() => {})
    }, 90_000)
    return () => clearInterval(id)
  }, [symbol])

  const liveSymStat = stats?.symbolStats?.find(s => s.symbol === symbol)
  const livePrice   = liveSymStat?.lastPrice ?? detail?.lastPrice ?? 0
  const color       = COIN_COLORS[symbol] ?? "#3B82F6"
  const short       = shortSym(symbol)

  const trendSlope = useMemo(() => {
    if (!detail || detail.history.length < 2) return 0
    const xs = detail.history.map(b => b.minute)
    const ys = detail.history.map(b => b.avgPrice)
    const x0   = xs[0]
    const nxs  = xs.map(x => x - x0)
    const mX   = nxs.reduce((a, b) => a + b, 0) / nxs.length
    const mY   = ys.reduce((a, b) => a + b, 0) / ys.length
    const ssXX = nxs.reduce((a, x) => a + (x - mX) ** 2, 0)
    const ssXY = nxs.reduce((a, x, i) => a + (x - mX) * (ys[i] - mY), 0)
    return ssXX === 0 ? 0 : ssXY / ssXX
  }, [detail])

  const forecast = useMemo(
    () => computeForecast(detail?.history ?? [], horizon, elements, fearGreed),
    [detail, horizon, elements, fearGreed],
  )

  const history = detail?.history ?? []
  const nowSec  = history.length > 0 ? history[history.length - 1].minute : Math.floor(Date.now() / 1000)

  const priceChange = livePrice && detail?.minPrice
    ? ((livePrice - (detail.minPrice + detail.maxPrice) / 2) / ((detail.minPrice + detail.maxPrice) / 2)) * 100
    : null

  const buyPct = detail && (detail.buyCount + detail.sellCount) > 0
    ? (detail.buyCount / (detail.buyCount + detail.sellCount)) * 100
    : null

  const CHART_TABS: { key: ChartTab; label: string }[] = [
    { key: "candles",   label: "Candlestick + Indicators" },
    { key: "forecast",  label: "Forecast" },
    { key: "orderbook", label: "Order Book" },
  ]

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "#F1F5F9", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>

      {/* Header */}
      <header style={{
        borderBottom: "1px solid #1E293B", padding: "0 32px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#0A1220", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "1px solid #334155", borderRadius: 6,
              padding: "5px 10px", color: "#94A3B8", cursor: "pointer", fontSize: 13,
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: color + "22",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color,
            }}>
              {short.slice(0, 3)}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9" }}>{short} / USDT</div>
              <div style={{ fontSize: 11, color: "#475569" }}>Binance live stream</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {livePrice > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", fontVariantNumeric: "tabular-nums" }}>
                {formatPrice(livePrice)}
              </span>
              {priceChange !== null && (
                <span style={{ fontSize: 12, fontWeight: 600, color: priceChange >= 0 ? "#10B981" : "#EF4444", display: "flex", alignItems: "center", gap: 3 }}>
                  {priceChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                </span>
              )}
            </div>
          )}
          <ConnectionBadge state={connectionState} lastUpdate={lastUpdate} />
        </div>
      </header>

      <main style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>
        {loading ? (
          <div style={{ color: "#475569", fontSize: 14, padding: "60px 0", textAlign: "center" }}>Loading coin data…</div>
        ) : (
          <>
            {/* Stat pills */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <StatPill label="Last Price"   value={formatPrice(livePrice)} color={color} />
              <StatPill label="2h Low"       value={detail ? formatPrice(detail.minPrice) : "—"} />
              <StatPill label="2h High"      value={detail ? formatPrice(detail.maxPrice) : "—"} />
              <StatPill label="2h Trades"    value={detail ? formatNumber(detail.trades) : "—"} />
              <StatPill label="2h Volume"    value={detail ? formatUSD(detail.volume) : "—"} />
              {buyPct !== null && (
                <StatPill label="Buy Pressure" value={`${buyPct.toFixed(1)}% buys`} color={buyPct >= 50 ? "#10B981" : "#EF4444"} />
              )}
            </div>

            {/* Chart section with tabs */}
            <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
              {/* Tab bar */}
              <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid #1F2937", paddingBottom: 12 }}>
                {CHART_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setChartTab(tab.key)}
                    style={{
                      padding: "5px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                      border:     `1px solid ${chartTab === tab.key ? color : "#334155"}`,
                      background: chartTab === tab.key ? color + "22" : "transparent",
                      color:      chartTab === tab.key ? color : "#64748B",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Candlestick + Indicators */}
              {chartTab === "candles" && (
                <CandlestickChart candles={candles} color={color} />
              )}

              {/* Forecast */}
              {chartTab === "forecast" && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                    <h2 style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                      Price History + Forecast
                    </h2>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#475569", marginRight: 4 }}>Horizon:</span>
                      {HORIZON_OPTIONS.map(h => (
                        <button
                          key={h}
                          onClick={() => setHorizon(h)}
                          style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                            border:     `1px solid ${horizon === h ? color : "#334155"}`,
                            background: horizon === h ? color + "22" : "transparent",
                            color:      horizon === h ? color : "#64748B",
                          }}
                        >
                          {h}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <ForecastChart data={forecast.chartData} color={color} nowSec={nowSec} />
                  {forecast.currentPrice > 0 && (
                    <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 12, color: "#475569" }}>
                        Base target in {horizon}m: <span style={{ color: "#F1F5F9", fontVariantNumeric: "tabular-nums" }}>{formatPrice(forecast.baseTarget)}</span>
                      </div>
                      {(elements.some(e => e.enabled) || fearGreed !== 50) && (
                        <div style={{ fontSize: 12, color: "#475569" }}>
                          Adjusted: <span style={{ color: forecast.percentChange >= 0 ? "#10B981" : "#EF4444", fontVariantNumeric: "tabular-nums" }}>
                            {formatPrice(forecast.adjustedTarget)} ({forecast.percentChange >= 0 ? "+" : ""}{forecast.percentChange.toFixed(2)}%)
                          </span>
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
                        Trend:&nbsp;
                        {forecast.trendDirection === "up"   && <><TrendingUp   size={12} color="#10B981" /><span style={{ color: "#10B981" }}>Upward</span></>}
                        {forecast.trendDirection === "down" && <><TrendingDown size={12} color="#EF4444" /><span style={{ color: "#EF4444" }}>Downward</span></>}
                        {forecast.trendDirection === "flat" && <><Minus        size={12} color="#94A3B8" /><span style={{ color: "#94A3B8" }}>Flat</span></>}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Order Book */}
              {chartTab === "orderbook" && (
                <OrderBookDepth symbol={symbol} />
              )}
            </div>

            {/* Three panels: Elements | Calculator | Alerts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px" }}>
                <ElementsPanel elements={elements} fearGreed={fearGreed} onChange={setElements} onFearGreed={setFearGreed} />
              </div>
              <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px" }}>
                <InvestmentCalculator currentPrice={livePrice} trendSlope={trendSlope} />
              </div>
              <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px" }}>
                <AlertsPanel
                  symbol={symbol}
                  currentPrice={livePrice}
                  triggeredAlerts={triggeredAlerts}
                  onClear={clearAlerts}
                />
              </div>
            </div>

            {/* Insights */}
            <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
              <CoinInsights symbol={symbol} />
            </div>

            {/* Live stats */}
            {liveSymStat && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {[
                  { label: "Trades (1 min)",   value: formatNumber(liveSymStat.trades),  icon: <Activity size={16} />,   color: "#3B82F6" },
                  { label: "Volume (1 min)",    value: formatUSD(liveSymStat.volume),     icon: <DollarSign size={16} />, color: "#10B981" },
                  { label: "Avg Price (1 min)", value: formatPrice(liveSymStat.avgPrice), icon: <TrendingUp size={16} />, color },
                ].map(item => (
                  <div key={item.label} style={{
                    background: "#1E293B", border: "1px solid #334155", borderRadius: 12,
                    padding: "16px 20px", display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div style={{ color: item.color }}>{item.icon}</div>
                    <div>
                      <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", fontVariantNumeric: "tabular-nums" }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
