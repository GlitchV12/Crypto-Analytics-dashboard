import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useOrderBook, toDepthChart } from "../../hooks/useOrderBook"
import { formatPrice } from "../../lib/format"

interface Props { symbol: string }

export function OrderBookDepth({ symbol }: Props) {
  const book = useOrderBook(symbol)

  if (!book) {
    return (
      <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 13 }}>
        Connecting to order book…
      </div>
    )
  }

  const depthData = toDepthChart(book, 20)
  const midPrice  = book.bids[0]?.price ?? 0
  const spread    = book.asks[0] && book.bids[0] ? book.asks[0].price - book.bids[0].price : 0
  const spreadPct = midPrice > 0 ? (spread / midPrice) * 100 : 0

  const topBid = book.bids[0]
  const topAsk = book.asks[0]

  return (
    <div>
      {/* Spread info */}
      <div style={{ display: "flex", gap: 20, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Best Bid</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#10B981", fontVariantNumeric: "tabular-nums" }}>
            {topBid ? formatPrice(topBid.price) : "—"}
            <span style={{ fontSize: 10, color: "#64748B", marginLeft: 6 }}>{topBid ? topBid.qty.toFixed(4) : ""}</span>
          </div>
        </div>
        <div>
          <span style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Spread</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>
            {formatPrice(spread)} <span style={{ fontSize: 11, color: "#475569" }}>({spreadPct.toFixed(3)}%)</span>
          </div>
        </div>
        <div>
          <span style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Best Ask</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#EF4444", fontVariantNumeric: "tabular-nums" }}>
            {topAsk ? formatPrice(topAsk.price) : "—"}
            <span style={{ fontSize: 10, color: "#64748B", marginLeft: 6 }}>{topAsk ? topAsk.qty.toFixed(4) : ""}</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={depthData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
          <XAxis
            dataKey="price"
            tick={{ fill: "#475569", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatPrice(v)}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#475569", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(2)}
          />
          <Tooltip
            contentStyle={{ background: "#0F172A", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }}
            labelFormatter={v => `Price: ${formatPrice(v as number)}`}
            formatter={(v: number, name: string) => [
              `${v.toFixed(4)} ${symbol.replace("USDT","")}`,
              name === "bidDepth" ? "Cumulative Bids" : "Cumulative Asks",
            ]}
          />
          <Area
            type="stepAfter"
            dataKey="bidDepth"
            stroke="#10B981"
            fill="#10B98122"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
          <Area
            type="stepBefore"
            dataKey="askDepth"
            stroke="#EF4444"
            fill="#EF444422"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Top 5 bid/ask ladder */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: "#10B981", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Bids</div>
          {book.bids.slice(0, 5).map((b, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94A3B8", padding: "2px 0", fontVariantNumeric: "tabular-nums" }}>
              <span style={{ color: "#10B981" }}>{formatPrice(b.price)}</span>
              <span>{b.qty.toFixed(4)}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#EF4444", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Asks</div>
          {book.asks.slice(0, 5).map((a, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94A3B8", padding: "2px 0", fontVariantNumeric: "tabular-nums" }}>
              <span style={{ color: "#EF4444" }}>{formatPrice(a.price)}</span>
              <span>{a.qty.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
