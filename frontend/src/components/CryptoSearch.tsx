import { useEffect, useRef, useState } from "react"
import { Search, X, Pin, PinOff, TrendingUp, TrendingDown, Check } from "lucide-react"
import type { CryptoInfo } from "../hooks/usePinnedCryptos"

interface Props {
  onClose:      () => void
  onSearch:     (q: string) => void
  results:      CryptoInfo[]
  searching:    boolean
  searchErr:    string
  isPinned:     (s: string) => boolean
  isDefault:    (s: string) => boolean
  pin:          (s: string) => void
  unpin:        (s: string) => void
  pinned:       string[]
  prices:       Record<string, CryptoInfo>
}

function fmtPrice(n: number) {
  if (n >= 1000)  return `$${n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`
  if (n >= 1)     return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

function fmtVol(n: number) {
  if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n/1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function CryptoRow({ info, pinned, isDefault, onPin, onUnpin }: {
  info:      CryptoInfo
  pinned:    boolean
  isDefault: boolean
  onPin:     () => void
  onUnpin:   () => void
}) {
  const up = info.change24h >= 0
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px", borderRadius: 8,
      background: pinned ? "rgba(59,130,246,0.06)" : "transparent",
      border: `1px solid ${pinned ? "#3B82F630" : "#1E293B"}`,
      transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: up ? "#10B98115" : "#EF444415",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, color: up ? "#10B981" : "#EF4444",
        }}>
          {info.base.slice(0, 4)}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>{info.base}</div>
          <div style={{ fontSize: 11, color: "#475569" }}>{info.symbol} · Vol {fmtVol(info.volume)}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", fontVariantNumeric: "tabular-nums" }}>
            {info.lastPrice ? fmtPrice(info.lastPrice) : "—"}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: up ? "#10B981" : "#EF4444", display:"flex", alignItems:"center", gap:2, justifyContent:"flex-end" }}>
            {up ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
            {info.change24h >= 0 ? "+" : ""}{info.change24h.toFixed(2)}%
          </div>
        </div>

        {isDefault ? (
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: "#1E293B", border: "1px solid #334155",
            display: "flex", alignItems: "center", justifyContent: "center",
          }} title="Default pair — always pinned">
            <Check size={14} color="#10B981" />
          </div>
        ) : (
          <button
            onClick={pinned ? onUnpin : onPin}
            title={pinned ? "Unpin" : "Pin to dashboard"}
            style={{
              width: 32, height: 32, borderRadius: 6, cursor: "pointer",
              border: `1px solid ${pinned ? "#3B82F6" : "#334155"}`,
              background: pinned ? "#3B82F620" : "#1E293B",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: pinned ? "#3B82F6" : "#64748B",
              transition: "all 0.15s",
            }}
          >
            {pinned ? <PinOff size={14}/> : <Pin size={14}/>}
          </button>
        )}
      </div>
    </div>
  )
}

export function CryptoSearch(props: Props) {
  const { onClose, onSearch, results, searching, searchErr, isPinned, isDefault, pin, unpin, pinned, prices } = props
  const [q, setQ] = useState("")
  const inputRef  = useRef<HTMLInputElement>(null)
  const debounce  = useRef<ReturnType<typeof setTimeout>|null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [onClose])

  function handleChange(val: string) {
    setQ(val)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => onSearch(val), 400)
  }

  // What to show: if search is empty, show pinned non-default pairs
  const pinnedExtras = pinned.filter(s => !["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT"].includes(s))

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 80,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: "100%", maxWidth: 560,
        background: "#0F172A", border: "1px solid #1E293B",
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 25px 60px rgba(0,0,0,0.7)",
        maxHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column",
      }}>
        {/* Search input */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 20px", borderBottom: "1px solid #1E293B",
        }}>
          <Search size={18} color="#475569" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => handleChange(e.target.value)}
            placeholder="Search any crypto — BTC, DOGE, PEPE, LINK…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 16, color: "#F1F5F9",
            }}
          />
          {q && (
            <button onClick={() => { setQ(""); setQ(""); onSearch("") }} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#475569", lineHeight: 0, flexShrink: 0,
            }}>
              <X size={16} />
            </button>
          )}
          <button onClick={onClose} style={{
            background: "#1E293B", border: "1px solid #334155",
            borderRadius: 6, padding: "4px 10px",
            color: "#64748B", fontSize: 12, cursor: "pointer",
          }}>
            ESC
          </button>
        </div>

        {/* Results */}
        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px" }}>

          {/* Pinned extras */}
          {!q && pinnedExtras.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", letterSpacing: "0.1em", marginBottom: 8, paddingLeft: 4 }}>
                PINNED BY YOU
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {pinnedExtras.map(s => {
                  const info = prices[s]
                  if (!info) return null
                  return (
                    <CryptoRow key={s} info={info} pinned={true} isDefault={false}
                      onPin={() => pin(s)} onUnpin={() => unpin(s)} />
                  )
                })}
              </div>
            </>
          )}

          {/* Search results */}
          {q && (
            <>
              {searching && (
                <div style={{ color: "#475569", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                  Searching Binance…
                </div>
              )}
              {searchErr && (
                <div style={{ color: "#EF4444", fontSize: 13, padding: "20px 0", textAlign: "center" }}>{searchErr}</div>
              )}
              {!searching && results.length === 0 && !searchErr && (
                <div style={{ color: "#475569", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                  No USDT pairs found for "{q}"
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {results.map(info => (
                  <CryptoRow
                    key={info.symbol} info={info}
                    pinned={isPinned(info.symbol)}
                    isDefault={isDefault(info.symbol)}
                    onPin={() => pin(info.symbol)}
                    onUnpin={() => unpin(info.symbol)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Empty state */}
          {!q && pinnedExtras.length === 0 && (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <Search size={32} color="#1E293B" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, color: "#475569" }}>Search any crypto to pin it to your dashboard</div>
              <div style={{ fontSize: 12, color: "#334155", marginTop: 6 }}>Try: DOGE, SHIB, LINK, AVAX, ADA…</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
