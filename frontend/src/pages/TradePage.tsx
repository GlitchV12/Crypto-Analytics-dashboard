import { useState, useEffect } from "react"
import { useNavigate }     from "react-router-dom"
import { ArrowLeft, DollarSign, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { useAnalytics }    from "../hooks/useAnalytics"
import { useWallet }       from "../hooks/useWallet"
import { ConnectionBadge } from "../components/ConnectionBadge"
import { formatPrice, formatUSD } from "../lib/format"

const SYMBOLS = [
  { id: "BTCUSDT",  label: "Bitcoin",  short: "BTC",  color: "#F59E0B" },
  { id: "ETHUSDT",  label: "Ethereum", short: "ETH",  color: "#3B82F6" },
  { id: "BNBUSDT",  label: "BNB",      short: "BNB",  color: "#10B981" },
  { id: "SOLUSDT",  label: "Solana",   short: "SOL",  color: "#8B5CF6" },
  { id: "XRPUSDT",  label: "XRP",      short: "XRP",  color: "#EC4899" },
]

type Side = "buy" | "sell"
type OrderType = "market" | "limit"
type ConfirmState = "idle" | "confirm" | "success" | "fail"

function fmt6(n: number) { return n < 0.01 ? n.toFixed(6) : n.toFixed(4) }

export function TradePage() {
  const navigate                         = useNavigate()
  const { stats, connectionState, lastUpdate } = useAnalytics()
  const { balances, history, buy, sell, resetWallet, error, setError } = useWallet()

  const [symbol,    setSymbol]    = useState("BTCUSDT")
  const [side,      setSide]      = useState<Side>("buy")
  const [orderType, setOrderType] = useState<OrderType>("market")
  const [usdtAmt,   setUsdtAmt]   = useState("")
  const [cryptoAmt, setCryptoAmt] = useState("")
  const [limitPx,   setLimitPx]   = useState("")
  const [confirm,   setConfirm]   = useState<ConfirmState>("idle")
  const [confMsg,   setConfMsg]   = useState("")

  const coin     = SYMBOLS.find(s => s.id === symbol)!
  const symStat  = stats?.symbolStats?.find(s => s.symbol === symbol)
  const price    = symStat?.lastPrice ?? 0
  const holding  = (balances[symbol as keyof typeof balances] as number) ?? 0

  // Auto-fill crypto when USDT changes
  useEffect(() => {
    if (!usdtAmt || !price) { setCryptoAmt(""); return }
    const p = orderType === "limit" && limitPx ? parseFloat(limitPx) : price
    if (!p) return
    setCryptoAmt((parseFloat(usdtAmt) / p).toFixed(6))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdtAmt, price, limitPx, orderType])

  // Auto-fill USDT when crypto changes
  function onCryptoChange(val: string) {
    setCryptoAmt(val)
    if (!val || !price) { setUsdtAmt(""); return }
    const p = orderType === "limit" && limitPx ? parseFloat(limitPx) : price
    if (!p) return
    setUsdtAmt((parseFloat(val) * p).toFixed(2))
  }

  function handleMaxUsdt() {
    setUsdtAmt(balances.USDT.toFixed(2))
  }

  function handleMaxCrypto() {
    setCryptoAmt(fmt6(holding))
    if (price) setUsdtAmt((holding * price).toFixed(2))
  }

  function handleSubmit() {
    setError("")
    const p   = orderType === "limit" ? parseFloat(limitPx) : price
    const amt = parseFloat(cryptoAmt)
    if (!amt || !p) { setError("Enter valid amount."); return }
    setConfirm("confirm")
  }

  function executeOrder() {
    const p   = orderType === "limit" ? parseFloat(limitPx) : price
    const amt = parseFloat(cryptoAmt)
    const ok  = side === "buy" ? buy(symbol, amt, p) : sell(symbol, amt, p)
    if (ok) {
      setConfMsg(`${side === "buy" ? "Bought" : "Sold"} ${fmt6(amt)} ${coin.short} @ ${formatPrice(p)}`)
      setConfirm("success")
      setUsdtAmt(""); setCryptoAmt("")
    } else {
      setConfirm("fail")
    }
  }

  const totalPortfolioUSD = balances.USDT + SYMBOLS.reduce((acc, s) => {
    const livePrice = stats?.symbolStats?.find(x => x.symbol === s.id)?.lastPrice ?? 0
    return acc + (balances[s.id as keyof typeof balances] as number) * livePrice
  }, 0)

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
              background: "linear-gradient(135deg,#10B981,#059669)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <DollarSign size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9" }}>Crypto Trade</div>
              <div style={{ fontSize: 11, color: "#475569" }}>Simulated exchange · market &amp; limit orders</div>
            </div>
          </div>
        </div>
        <ConnectionBadge state={connectionState} lastUpdate={lastUpdate} />
      </header>

      <main style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>

        {/* Portfolio Overview */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20,
        }}>
          <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "18px 22px" }}>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Total Portfolio
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#F1F5F9", fontVariantNumeric: "tabular-nums" }}>
              {formatUSD(totalPortfolioUSD)}
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>USDT + crypto holdings</div>
          </div>
          <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "18px 22px" }}>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Available USDT
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#10B981", fontVariantNumeric: "tabular-nums" }}>
              {formatUSD(balances.USDT)}
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Ready to deploy</div>
          </div>
          <div style={{
            background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "18px 22px",
            display: "flex", flexDirection: "column", justifyContent: "space-between",
          }}>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Trades
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#F1F5F9" }}>{history.length}</div>
            <button onClick={resetWallet} style={{
              display: "flex", alignItems: "center", gap: 5, background: "none",
              border: "1px solid #334155", borderRadius: 6, padding: "4px 10px",
              color: "#64748B", cursor: "pointer", fontSize: 11, width: "fit-content", marginTop: 6,
            }}>
              <RefreshCw size={11} /> Reset wallet
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20 }}>

          {/* Trade Panel */}
          <div>
            {/* Coin selector */}
            <div style={{
              background: "#1E293B", border: "1px solid #334155", borderRadius: 12,
              padding: "18px 20px", marginBottom: 14,
            }}>
              <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Select Asset
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {SYMBOLS.map(s => {
                  const sp     = stats?.symbolStats?.find(x => x.symbol === s.id)?.lastPrice ?? 0
                  const held   = (balances[s.id as keyof typeof balances] as number) ?? 0
                  const isSelected = symbol === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSymbol(s.id)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                        border:     `1px solid ${isSelected ? s.color : "#334155"}`,
                        background: isSelected ? s.color + "15" : "transparent",
                        color:      "#F1F5F9",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: 6, background: s.color + "22",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, color: s.color,
                        }}>
                          {s.short.slice(0,3)}
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{s.short}</div>
                          <div style={{ fontSize: 10, color: "#475569" }}>{s.label}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: "#F1F5F9" }}>
                          {sp ? formatPrice(sp) : "—"}
                        </div>
                        {held > 0 && (
                          <div style={{ fontSize: 10, color: "#475569" }}>{fmt6(held)} {s.short}</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Order Form */}
            <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px" }}>
              {/* Buy / Sell tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
                {(["buy","sell"] as Side[]).map(s => (
                  <button key={s} onClick={() => setSide(s)} style={{
                    flex: 1, padding: "9px", borderRadius: 8, fontWeight: 700,
                    fontSize: 13, cursor: "pointer", border: "none",
                    background: side === s
                      ? (s === "buy" ? "#10B981" : "#EF4444")
                      : "#0F172A",
                    color: side === s ? "#fff" : "#475569",
                  }}>
                    {s === "buy" ? "Buy" : "Sell"} {coin.short}
                  </button>
                ))}
              </div>

              {/* Order type */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                {(["market","limit"] as OrderType[]).map(t => (
                  <button key={t} onClick={() => setOrderType(t)} style={{
                    flex: 1, padding: "6px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                    border:     `1px solid ${orderType === t ? "#3B82F6" : "#334155"}`,
                    background: orderType === t ? "#3B82F620" : "transparent",
                    color:      orderType === t ? "#3B82F6" : "#64748B",
                  }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* Market price display */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", borderRadius: 8, background: "#0F172A",
                border: "1px solid #1E293B", marginBottom: 12,
              }}>
                <span style={{ fontSize: 11, color: "#475569" }}>
                  {orderType === "market" ? "Market Price" : "Limit Price"}
                </span>
                {orderType === "market" ? (
                  <span style={{ fontSize: 14, fontWeight: 700, color: coin.color, fontVariantNumeric: "tabular-nums" }}>
                    {price ? formatPrice(price) : "—"}
                  </span>
                ) : (
                  <input
                    type="number" value={limitPx} placeholder="Enter price"
                    onChange={e => setLimitPx(e.target.value)}
                    style={{
                      background: "none", border: "none", outline: "none",
                      color: coin.color, fontSize: 14, fontWeight: 700,
                      textAlign: "right", width: 140, fontVariantNumeric: "tabular-nums",
                    }}
                  />
                )}
              </div>

              {/* USDT amount */}
              <label style={{ display: "block", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>{side === "buy" ? "Spend (USDT)" : "Receive (USDT)"}</span>
                  <button onClick={handleMaxUsdt} style={{
                    background: "none", border: "none", color: "#3B82F6",
                    fontSize: 10, cursor: "pointer", padding: 0,
                  }}>
                    Max {formatUSD(balances.USDT)}
                  </button>
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#0F172A", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px",
                }}>
                  <input
                    type="number" value={usdtAmt} placeholder="0.00"
                    onChange={e => setUsdtAmt(e.target.value)}
                    style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#F1F5F9", fontSize: 14 }}
                  />
                  <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>USDT</span>
                </div>
              </label>

              {/* Crypto amount */}
              <label style={{ display: "block", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>{side === "sell" ? "Sell Amount" : "Receive"} ({coin.short})</span>
                  {side === "sell" && holding > 0 && (
                    <button onClick={handleMaxCrypto} style={{
                      background: "none", border: "none", color: "#3B82F6",
                      fontSize: 10, cursor: "pointer", padding: 0,
                    }}>
                      Max {fmt6(holding)} {coin.short}
                    </button>
                  )}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#0F172A", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px",
                }}>
                  <input
                    type="number" value={cryptoAmt} placeholder="0.000000"
                    onChange={e => onCryptoChange(e.target.value)}
                    style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#F1F5F9", fontSize: 14 }}
                  />
                  <span style={{ fontSize: 12, color: coin.color, fontWeight: 600 }}>{coin.short}</span>
                </div>
              </label>

              {/* Fee info */}
              {cryptoAmt && price && (
                <div style={{
                  padding: "10px 14px", borderRadius: 8, background: "#0F172A",
                  border: "1px solid #1E293B", marginBottom: 14, fontSize: 11,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#475569", marginBottom: 4 }}>
                    <span>Trading fee (0.1%)</span>
                    <span style={{ color: "#64748B" }}>{formatUSD((parseFloat(usdtAmt)||0) * 0.001)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#94A3B8" }}>
                    <span style={{ fontWeight: 600 }}>Total {side === "buy" ? "cost" : "received"}</span>
                    <span style={{ fontWeight: 700, color: "#F1F5F9", fontVariantNumeric: "tabular-nums" }}>
                      {formatUSD((parseFloat(usdtAmt)||0) * (side === "buy" ? 1.001 : 0.999))}
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div style={{
                  marginBottom: 12, padding: "8px 12px", borderRadius: 6,
                  background: "#EF444418", border: "1px solid #EF444430",
                  fontSize: 12, color: "#EF4444",
                }}>
                  <AlertTriangle size={11} style={{ marginRight: 4, display: "inline" }} />
                  {error}
                </div>
              )}

              <button onClick={handleSubmit} disabled={!cryptoAmt || !price} style={{
                width: "100%", padding: "12px", borderRadius: 10, border: "none",
                background: side === "buy"
                  ? (!cryptoAmt||!price ? "#1E293B" : "linear-gradient(135deg,#10B981,#059669)")
                  : (!cryptoAmt||!price ? "#1E293B" : "linear-gradient(135deg,#EF4444,#DC2626)"),
                color:  (!cryptoAmt||!price) ? "#475569" : "#fff",
                fontSize: 14, fontWeight: 700, cursor: (!cryptoAmt||!price) ? "not-allowed" : "pointer",
              }}>
                {side === "buy" ? "Buy" : "Sell"} {coin.short}
              </button>
            </div>
          </div>

          {/* Right: Holdings + History */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Holdings grid */}
            <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
                Holdings
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 10 }}>
                {/* USDT */}
                <div style={{ background: "#0F172A", border: "1px solid #334155", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>USDT</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#10B981", fontVariantNumeric: "tabular-nums" }}>
                    {formatUSD(balances.USDT)}
                  </div>
                </div>
                {SYMBOLS.map(s => {
                  const h  = (balances[s.id as keyof typeof balances] as number) ?? 0
                  const sp = stats?.symbolStats?.find(x => x.symbol === s.id)?.lastPrice ?? 0
                  return (
                    <div key={s.id} style={{ background: "#0F172A", border: "1px solid #334155", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, color: "#475569", marginBottom: 2 }}>{s.short}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: h > 0 ? s.color : "#334155", fontVariantNumeric: "tabular-nums" }}>
                        {fmt6(h)}
                      </div>
                      {h > 0 && sp > 0 && (
                        <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{formatUSD(h * sp)}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Transaction history */}
            <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px", flex: 1 }}>
              <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
                Transaction History
              </div>
              {history.length === 0 ? (
                <div style={{ color: "#334155", fontSize: 13, padding: "30px 0", textAlign: "center" }}>
                  No transactions yet. Place your first order.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
                  {history.map(tx => {
                    const s = SYMBOLS.find(x => x.id === tx.symbol)!
                    return (
                      <div key={tx.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", borderRadius: 8,
                        background: "#0F172A", border: "1px solid #1E293B",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: tx.type === "buy" ? "#10B98120" : "#EF444420",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 700,
                            color: tx.type === "buy" ? "#10B981" : "#EF4444",
                          }}>
                            {tx.type === "buy" ? "B" : "S"}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9" }}>
                              {tx.type === "buy" ? "Bought" : "Sold"} {fmt6(tx.amount)} {s?.short}
                            </div>
                            <div style={{ fontSize: 10, color: "#475569" }}>
                              @ {formatPrice(tx.price)} · {new Date(tx.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{
                            fontSize: 13, fontWeight: 700,
                            color: tx.type === "buy" ? "#EF4444" : "#10B981",
                            fontVariantNumeric: "tabular-nums",
                          }}>
                            {tx.type === "buy" ? "-" : "+"}{formatUSD(tx.total)}
                          </div>
                          <div style={{ fontSize: 10, color: "#10B981" }}>completed</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Confirmation modal */}
      {confirm !== "idle" && (
        <div style={{
          position: "fixed", inset: 0, background: "#000a", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#0F172A", border: "1px solid #334155", borderRadius: 16,
            padding: "36px 40px", maxWidth: 380, width: "90%", textAlign: "center",
          }}>
            {confirm === "confirm" && (
              <>
                <AlertTriangle size={40} color="#F59E0B" style={{ marginBottom: 14 }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 8 }}>Confirm Order</h3>
                <p style={{ fontSize: 14, color: "#64748B", marginBottom: 4 }}>
                  {side === "buy" ? "Buy" : "Sell"} <strong style={{ color: coin.color }}>{cryptoAmt} {coin.short}</strong>
                </p>
                <p style={{ fontSize: 14, color: "#64748B", marginBottom: 22 }}>
                  {side === "buy" ? "Spend" : "Receive"} ~<strong style={{ color: "#F1F5F9" }}>{formatUSD(parseFloat(usdtAmt)||0)}</strong>
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setConfirm("idle")} style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #334155",
                    background: "none", color: "#94A3B8", cursor: "pointer", fontSize: 13,
                  }}>
                    Cancel
                  </button>
                  <button onClick={executeOrder} style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: "none",
                    background: side === "buy" ? "#10B981" : "#EF4444",
                    color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700,
                  }}>
                    Confirm {side === "buy" ? "Buy" : "Sell"}
                  </button>
                </div>
              </>
            )}
            {confirm === "success" && (
              <>
                <CheckCircle size={44} color="#10B981" style={{ marginBottom: 14 }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 8 }}>Order Executed!</h3>
                <p style={{ fontSize: 13, color: "#64748B", marginBottom: 22 }}>{confMsg}</p>
                <button onClick={() => setConfirm("idle")} style={{
                  padding: "10px 28px", borderRadius: 8, border: "none",
                  background: "#10B981", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700,
                }}>
                  Done
                </button>
              </>
            )}
            {confirm === "fail" && (
              <>
                <XCircle size={44} color="#EF4444" style={{ marginBottom: 14 }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 8 }}>Order Failed</h3>
                <p style={{ fontSize: 13, color: "#EF4444", marginBottom: 22 }}>{error}</p>
                <button onClick={() => setConfirm("idle")} style={{
                  padding: "10px 28px", borderRadius: 8, border: "none",
                  background: "#334155", color: "#fff", cursor: "pointer", fontSize: 13,
                }}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
