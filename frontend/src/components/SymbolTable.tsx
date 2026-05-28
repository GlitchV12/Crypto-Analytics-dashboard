import { useNavigate } from "react-router-dom"
import type { SymbolStat } from "../types"
import { formatUSD, formatPrice, shortSym } from "../lib/format"

const COIN_COLORS: Record<string, string> = {
  BTC: "#F59E0B",
  ETH: "#3B82F6",
  BNB: "#10B981",
  SOL: "#8B5CF6",
  XRP: "#EC4899",
}

interface Props { data: SymbolStat[] }

export function SymbolTable({ data }: Props) {
  const navigate = useNavigate()
  return (
    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
          Pairs — Last 1 min
        </h2>
        <span style={{ fontSize: 11, color: "#334155" }}>Click a row to explore →</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Pair", "Price", "Trades", "Volume (USD)"].map(h => (
              <th key={h} style={{
                textAlign: h === "Pair" ? "left" : "right",
                fontSize: 11, color: "#475569", fontWeight: 600,
                paddingBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const sym = shortSym(row.symbol)
            const color = COIN_COLORS[sym] ?? "#94A3B8"
            return (
              <tr
                key={row.symbol}
                onClick={() => navigate(`/coin/${row.symbol}`)}
                style={{ borderTop: "1px solid #1F2937", cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#0F172A")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "10px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: color + "22",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color,
                    }}>{sym.slice(0,3)}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9" }}>{sym}</div>
                      <div style={{ fontSize: 11, color: "#475569" }}>USDT</div>
                    </div>
                  </div>
                </td>
                <td style={{ textAlign: "right", fontSize: 13, color: "#F1F5F9", fontVariantNumeric: "tabular-nums" }}>
                  {formatPrice(row.lastPrice)}
                </td>
                <td style={{ textAlign: "right", fontSize: 13, color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>
                  {row.trades.toLocaleString()}
                </td>
                <td style={{ textAlign: "right", fontSize: 13, color: "#10B981", fontVariantNumeric: "tabular-nums" }}>
                  {formatUSD(row.volume)}
                </td>
              </tr>
            )
          })}
          {data.length === 0 && (
            <tr><td colSpan={4} style={{ color: "#475569", fontSize: 13, padding: "12px 0" }}>Waiting for trades…</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
