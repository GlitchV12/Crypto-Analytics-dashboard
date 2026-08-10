import { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  TrendingUp, TrendingDown, Zap, Shield, BarChart2,
  DollarSign, Bell, Globe, ArrowRight, ChevronDown,
} from "lucide-react"

/* ══════════════════════════════════════════════
   3D GLOBE — rotating wireframe sphere
══════════════════════════════════════════════ */
function Globe3D() {
  const cv = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = cv.current as HTMLCanvasElement | null
    if (!canvas) return
    const el  = canvas
    const ctx = el.getContext("2d")!
    let W = el.width = el.offsetWidth
    let H = el.height = el.offsetHeight
    let raf: number
    let angle = 0

    // Fibonacci sphere points
    const N = 220
    const pts: [number, number, number][] = []
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < N; i++) {
      const y   = 1 - (i / (N - 1)) * 2
      const r   = Math.sqrt(1 - y * y)
      const phi = golden * i
      pts.push([Math.cos(phi) * r, y, Math.sin(phi) * r])
    }

    function project(x: number, y: number, z: number, cx: number, cy: number, R: number, fl: number) {
      const scale = fl / (fl + z * R)
      return { px: cx + x * R * scale, py: cy + y * R * scale, scale }
    }

    function draw() {
      angle += 0.003
      W = el.width = el.offsetWidth
      H = el.height = el.offsetHeight
      ctx.clearRect(0, 0, W, H)

      const cx = W / 2, cy = H / 2
      const R  = Math.min(W, H) * 0.38
      const fl = 800

      const sin = Math.sin(angle), cos = Math.cos(angle)
      // tilt
      const tiltSin = Math.sin(0.3), tiltCos = Math.cos(0.3)

      const projected = pts.map(([x, y, z]) => {
        // rotate Y
        const rx = x * cos + z * sin
        const rz = -x * sin + z * cos
        // tilt X
        const ry2 = y * tiltCos - rz * tiltSin
        const rz2 = y * tiltSin + rz * tiltCos
        const p = project(rx, ry2, rz2, cx, cy, R, fl)
        return { ...p, z: rz2 }
      })

      // Draw connections
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = projected[i], b = projected[j]
          const dist = Math.hypot(a.px - b.px, a.py - b.py)
          if (dist < R * 0.28) {
            const depth = ((a.z + b.z) / 2 + 1) / 2
            const alpha = depth * 0.22 * (1 - dist / (R * 0.28))
            ctx.beginPath()
            ctx.moveTo(a.px, a.py)
            ctx.lineTo(b.px, b.py)
            ctx.strokeStyle = `rgba(99,179,237,${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      // Draw dots
      projected.forEach(p => {
        const depth = (p.z + 1) / 2
        const alpha = 0.3 + depth * 0.7
        const r     = (0.8 + depth * 1.8) * p.scale
        ctx.beginPath()
        ctx.arc(p.px, p.py, Math.max(0.4, r), 0, Math.PI * 2)
        const hue = 200 + depth * 60
        ctx.fillStyle = `hsla(${hue},90%,70%,${alpha})`
        ctx.fill()
      })

      raf = requestAnimationFrame(draw)
    }

    draw()
    const ro = new ResizeObserver(() => { W = el.width = el.offsetWidth; H = el.height = el.offsetHeight })
    ro.observe(el)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <canvas
      ref={cv}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  )
}

/* ══════════════════════════════════════════════
   TILT CARD — 3D perspective on hover
══════════════════════════════════════════════ */
function TiltCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref  = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [glow, setGlow] = useState({ x: 50, y: 50 })
  const [hover, setHover] = useState(false)

  const onMove = useCallback((e: React.MouseEvent) => {
    const el   = ref.current!
    const rect = el.getBoundingClientRect()
    const x    = (e.clientX - rect.left) / rect.width
    const y    = (e.clientY - rect.top)  / rect.height
    setTilt({ x: (y - 0.5) * -16, y: (x - 0.5) * 16 })
    setGlow({ x: x * 100, y: y * 100 })
  }, [])

  const onLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 })
    setHover(false)
  }, [])

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={onLeave}
      style={{
        ...style,
        transform:  `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) ${hover ? "scale(1.03)" : "scale(1)"}`,
        transition: hover ? "transform 0.08s ease-out" : "transform 0.4s ease-out",
        willChange: "transform",
        position:   "relative",
        overflow:   "hidden",
      }}
    >
      {/* Radial glow that follows mouse */}
      {hover && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
          background: `radial-gradient(circle at ${glow.x}% ${glow.y}%, rgba(99,102,241,0.12) 0%, transparent 60%)`,
        }} />
      )}
      {children}
    </div>
  )
}

/* ══════════════════════════════════════════════
   SCROLL REVEAL
══════════════════════════════════════════════ */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref    = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); ob.disconnect() } }, { threshold: 0.12 })
    ob.observe(el)
    return () => ob.disconnect()
  }, [])

  return (
    <div ref={ref} style={{
      opacity:   vis ? 1 : 0,
      transform: vis ? "translateY(0)" : "translateY(36px)",
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

/* ══════════════════════════════════════════════
   TICKER — animated price pill
══════════════════════════════════════════════ */
const TICKERS = [
  { symbol: "BTC", price: "67,234.50", change: "+2.4%", up: true,  color: "#F59E0B" },
  { symbol: "ETH", price: "3,512.80",  change: "+1.8%", up: true,  color: "#3B82F6" },
  { symbol: "SOL", price: "178.90",    change: "-0.6%", up: false, color: "#8B5CF6" },
  { symbol: "XAU", price: "2,345.60",  change: "+0.9%", up: true,  color: "#EAB308" },
  { symbol: "WTI", price: "82.14",     change: "+1.2%", up: true,  color: "#F97316" },
  { symbol: "XRP", price: "0.5821",    change: "+3.1%", up: true,  color: "#EC4899" },
]

function TickerPill({ t }: { t: typeof TICKERS[0] }) {
  return (
    <div style={{
      display:      "flex",
      alignItems:   "center",
      gap:          10,
      padding:      "10px 16px",
      borderRadius: 40,
      background:   "rgba(15,23,42,0.85)",
      border:       `1px solid ${t.color}30`,
      backdropFilter: "blur(12px)",
      boxShadow:    `0 0 20px ${t.color}15`,
      whiteSpace:   "nowrap",
      fontFamily:   "'Inter',sans-serif",
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: t.color, boxShadow: `0 0 6px ${t.color}`,
      }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{t.symbol}</span>
      <span style={{ fontSize: 12, color: "#E2E8F0", fontVariantNumeric: "tabular-nums" }}>${t.price}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: t.up ? "#10B981" : "#EF4444" }}>
        {t.up ? <TrendingUp size={10} style={{ display: "inline", marginRight: 2 }} /> : <TrendingDown size={10} style={{ display: "inline", marginRight: 2 }} />}
        {t.change}
      </span>
    </div>
  )
}

/* ══════════════════════════════════════════════
   FEATURES data
══════════════════════════════════════════════ */
const FEATURES = [
  {
    icon:  <Zap size={22} />,
    color: "#3B82F6",
    title: "Live Trade Stream",
    desc:  "Real-time Binance WebSocket feed for BTC, ETH, BNB, SOL and XRP. Trade-by-trade accuracy, zero delay.",
    tag:   "REAL-TIME",
  },
  {
    icon:  <DollarSign size={22} />,
    color: "#10B981",
    title: "Crypto Trading",
    desc:  "Place market and limit orders. Full portfolio wallet, P&L tracking, and transaction history.",
    tag:   "BUY · SELL",
  },
  {
    icon:  <Globe size={22} />,
    color: "#F59E0B",
    title: "Commodities",
    desc:  "Track Gold, Silver, Platinum, Palladium, Crude Oil, Natural Gas, Coal and Copper live.",
    tag:   "8 MARKETS",
  },
  {
    icon:  <BarChart2 size={22} />,
    color: "#8B5CF6",
    title: "AI Price Forecast",
    desc:  "Machine-learning trend model with adjustable market sentiment and element factors for 15–60 min outlooks.",
    tag:   "FORECAST",
  },
  {
    icon:  <Bell size={22} />,
    color: "#EC4899",
    title: "Smart Alerts",
    desc:  "Set price thresholds for any asset. Get notified the moment the market crosses your target.",
    tag:   "ALERTS",
  },
  {
    icon:  <Shield size={22} />,
    color: "#06B6D4",
    title: "Order Book Depth",
    desc:  "Full bid-ask visualization with live depth chart to read market liquidity at a glance.",
    tag:   "ORDER BOOK",
  },
]

/* ══════════════════════════════════════════════
   COMMODITIES PREVIEW data
══════════════════════════════════════════════ */
const COMMS = [
  { name: "Gold",       sym: "XAU", price: "$2,345.60", pct: "+0.9%",  up: true,  color: "#F59E0B" },
  { name: "Silver",     sym: "XAG", price: "$30.48",    pct: "+1.2%",  up: true,  color: "#94A3B8" },
  { name: "Platinum",   sym: "XPT", price: "$1,012",    pct: "-0.3%",  up: false, color: "#E2E8F0" },
  { name: "Crude Oil",  sym: "WTI", price: "$82.14",    pct: "+1.8%",  up: true,  color: "#F97316" },
  { name: "Nat. Gas",   sym: "NGS", price: "$2.87",     pct: "-1.1%",  up: false, color: "#3B82F6" },
  { name: "Copper",     sym: "HG",  price: "$4.52",     pct: "+0.6%",  up: true,  color: "#EF4444" },
]

/* ══════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════ */
export function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", fn)
    return () => window.removeEventListener("scroll", fn)
  }, [])

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { background: #030712; }
    ::selection { background: #3B82F640; }
    @keyframes float   { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-12px)} }
    @keyframes floatB  { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-8px)}  }
    @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }
    @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
    @keyframes spin3d  { from{transform:rotateY(0deg)} to{transform:rotateY(360deg)} }
    @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  `

  const S: Record<string, React.CSSProperties> = {
    page: {
      fontFamily:   "'Inter',system-ui,sans-serif",
      background:   "#030712",
      color:        "#F1F5F9",
      overflowX:    "hidden",
    },

    /* NAV */
    nav: {
      position:       "fixed",
      top:            0, left: 0, right: 0,
      zIndex:         200,
      padding:        "0 40px",
      height:         64,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      background:     scrolled ? "rgba(3,7,18,0.9)" : "transparent",
      backdropFilter: scrolled ? "blur(20px)" : "none",
      borderBottom:   scrolled ? "1px solid rgba(255,255,255,0.05)" : "none",
      transition:     "all 0.3s",
    },
    logo: {
      display:    "flex",
      alignItems: "center",
      gap:        10,
      cursor:     "pointer",
    },
    logoIcon: {
      width:          36,
      height:         36,
      borderRadius:   10,
      background:     "linear-gradient(135deg,#1D4ED8,#3B82F6)",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      boxShadow:      "0 0 20px rgba(59,130,246,0.4)",
    },
    logoText: {
      fontSize:      18,
      fontWeight:    800,
      letterSpacing: "-0.02em",
      color:         "#F1F5F9",
    },

    /* HERO */
    hero: {
      minHeight:      "100vh",
      display:        "flex",
      alignItems:     "center",
      position:       "relative",
      overflow:       "hidden",
      padding:        "100px 60px 60px",
    },
    heroBg: {
      position:   "absolute",
      inset:      0,
      background: "radial-gradient(ellipse 80% 60% at 60% 40%,rgba(29,78,216,0.15) 0%,transparent 60%), radial-gradient(ellipse 60% 50% at 80% 20%,rgba(124,58,237,0.12) 0%,transparent 60%)",
    },
    heroGrid: {
      position:   "absolute",
      inset:      0,
      backgroundImage: "linear-gradient(rgba(59,130,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.04) 1px,transparent 1px)",
      backgroundSize:  "64px 64px",
      maskImage:       "radial-gradient(ellipse 80% 80% at 50% 50%,black,transparent)",
    },
    heroLeft: {
      flex:        1,
      maxWidth:    640,
      position:    "relative",
      zIndex:      2,
    },
    badge: {
      display:        "inline-flex",
      alignItems:     "center",
      gap:            6,
      padding:        "6px 14px",
      borderRadius:   40,
      background:     "rgba(59,130,246,0.1)",
      border:         "1px solid rgba(59,130,246,0.25)",
      fontSize:       11,
      fontWeight:     600,
      color:          "#93C5FD",
      letterSpacing:  "0.08em",
      marginBottom:   28,
    },
    h1: {
      fontSize:      68,
      fontWeight:    900,
      lineHeight:    1.0,
      letterSpacing: "-0.04em",
      marginBottom:  24,
    },
    h1Grad: {
      background:             "linear-gradient(135deg,#F1F5F9 0%,#93C5FD 40%,#A78BFA 70%,#F1F5F9 100%)",
      backgroundSize:         "200% auto",
      WebkitBackgroundClip:   "text",
      WebkitTextFillColor:    "transparent",
      animation:              "shimmer 4s linear infinite",
    },
    heroSub: {
      fontSize:     18,
      color:        "#64748B",
      lineHeight:   1.7,
      marginBottom: 40,
      maxWidth:     480,
    },
    btnRow: {
      display:    "flex",
      gap:        12,
      alignItems: "center",
    },
    btnPrimary: {
      display:        "flex",
      alignItems:     "center",
      gap:            8,
      padding:        "14px 28px",
      borderRadius:   12,
      border:         "none",
      background:     "linear-gradient(135deg,#1D4ED8,#2563EB)",
      color:          "#fff",
      fontSize:       15,
      fontWeight:     700,
      cursor:         "pointer",
      boxShadow:      "0 4px 24px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.1)",
      transition:     "all 0.2s",
    },
    btnSecondary: {
      display:        "flex",
      alignItems:     "center",
      gap:            8,
      padding:        "14px 28px",
      borderRadius:   12,
      border:         "1px solid rgba(255,255,255,0.08)",
      background:     "rgba(255,255,255,0.03)",
      color:          "#94A3B8",
      fontSize:       15,
      fontWeight:     600,
      cursor:         "pointer",
      backdropFilter: "blur(8px)",
      transition:     "all 0.2s",
    },
    heroRight: {
      flex:       1,
      height:     540,
      position:   "relative",
      zIndex:     2,
    },

    /* SECTIONS */
    section: {
      padding:   "100px 60px",
      maxWidth:  1280,
      margin:    "0 auto",
      position:  "relative",
    },
    sectionLabel: {
      fontSize:      11,
      fontWeight:    700,
      letterSpacing: "0.14em",
      color:         "#3B82F6",
      marginBottom:  14,
    },
    sectionTitle: {
      fontSize:      44,
      fontWeight:    800,
      letterSpacing: "-0.03em",
      lineHeight:    1.1,
      marginBottom:  16,
    },
    sectionSub: {
      fontSize:  17,
      color:     "#475569",
      lineHeight: 1.7,
      maxWidth:  520,
    },
  }

  return (
    <div style={S.page}>
      <style>{css}</style>

      {/* ── NAV ── */}
      <nav style={S.nav}>
        <div style={S.logo} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <div style={S.logoIcon}><TrendingUp size={18} color="#fff" /></div>
          <span style={S.logoText}>CryptoStream</span>
        </div>
        <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {["Features","Markets","Trade"].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{
              fontSize: 14, fontWeight: 500, color: "#64748B",
              textDecoration: "none", transition: "color 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.color = "#F1F5F9")}
              onMouseLeave={e => (e.currentTarget.style.color = "#64748B")}
            >
              {l}
            </a>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate("/login")} style={{
            padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
            background: "transparent", color: "#94A3B8", fontSize: 14, fontWeight: 500, cursor: "pointer",
          }}>
            Sign In
          </button>
          <button onClick={() => navigate("/login")} style={{
            padding: "8px 18px", borderRadius: 8, border: "none",
            background: "linear-gradient(135deg,#1D4ED8,#2563EB)",
            color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
            boxShadow: "0 2px 12px rgba(37,99,235,0.4)",
          }}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={S.hero}>
        <div style={S.heroBg} />
        <div style={S.heroGrid} />

        <div style={S.heroLeft}>
          <div style={S.badge}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", animation: "pulse 1.5s infinite" }} />
            LIVE MARKET DATA
          </div>

          <h1 style={S.h1}>
            <span style={S.h1Grad}>
              Markets<br />in motion.
            </span>
          </h1>

          <p style={S.heroSub}>
            Real-time crypto trading, commodities tracking, and AI-powered forecasts — all in one terminal built for speed.
          </p>

          <div style={S.btnRow}>
            <button
              style={S.btnPrimary}
              onClick={() => navigate("/login")}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 30px rgba(37,99,235,0.55)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 24px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.1)" }}
            >
              Start Trading <ArrowRight size={16} />
            </button>
            <button
              style={S.btnSecondary}
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.18)"; (e.currentTarget as HTMLButtonElement).style.color = "#F1F5F9" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8" }}
            >
              Explore Features <ChevronDown size={16} />
            </button>
          </div>

          {/* Floating tickers */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 48 }}>
            {TICKERS.slice(0, 3).map(t => (
              <div key={t.symbol} style={{ animation: "floatB 3s ease-in-out infinite", animationDelay: `${TICKERS.indexOf(t) * 0.4}s` }}>
                <TickerPill t={t} />
              </div>
            ))}
          </div>
        </div>

        {/* Globe */}
        <div style={S.heroRight}>
          {/* Outer glow ring */}
          <div style={{
            position: "absolute", inset: "10%",
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(59,130,246,0.08) 0%,transparent 70%)",
            animation: "float 6s ease-in-out infinite",
          }} />
          <Globe3D />

          {/* Floating stat cards around globe */}
          {[
            { top: "12%", left: "5%",  label: "24h Volume",  val: "$2.4B",   color: "#3B82F6", delay: "0s" },
            { top: "55%", right: "4%", label: "Active Pairs", val: "5 Live",  color: "#10B981", delay: "1s" },
            { top: "78%", left: "10%", label: "Commodities",  val: "8 Assets",color: "#F59E0B", delay: "0.5s" },
          ].map(c => (
            <div key={c.label} style={{
              position: "absolute",
              ...("right" in c ? { right: c.right } : { left: c.left }),
              top: c.top,
              padding: "12px 18px",
              borderRadius: 12,
              background: "rgba(10,18,32,0.85)",
              border: `1px solid ${c.color}25`,
              backdropFilter: "blur(16px)",
              boxShadow: `0 4px 24px rgba(0,0,0,0.4)`,
              animation: `float 4s ease-in-out infinite`,
              animationDelay: c.delay,
              minWidth: 120,
            }}>
              <div style={{ fontSize: 10, color: "#475569", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 4 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.color, fontVariantNumeric: "tabular-nums" }}>
                {c.val}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TICKER MARQUEE ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", overflow: "hidden", padding: "18px 0", background: "rgba(255,255,255,0.01)" }}>
        <div style={{ display: "flex", animation: "marquee 20s linear infinite", width: "max-content" }}>
          {[...TICKERS, ...TICKERS, ...TICKERS, ...TICKERS].map((t, i) => (
            <div key={i} style={{ marginRight: 16 }}>
              <TickerPill t={t} />
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div id="features" />
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "100px 60px" }}>
        <Reveal>
          <div style={S.sectionLabel}>CAPABILITIES</div>
          <h2 style={{ ...S.sectionTitle, maxWidth: 560 }}>
            Everything a serious<br />trader needs
          </h2>
          <p style={{ ...S.sectionSub, marginBottom: 60 }}>
            Built on real Binance WebSocket data with zero compromises on speed or depth.
          </p>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <TiltCard style={{
                background:   "rgba(15,23,42,0.6)",
                border:       "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16,
                padding:      "28px 28px",
                height:       "100%",
                backdropFilter: "blur(12px)",
                cursor:       "default",
              }}>
                {/* Top border accent */}
                <div style={{
                  position: "absolute", top: 0, left: 20, right: 20, height: 1,
                  background: `linear-gradient(90deg,transparent,${f.color}60,transparent)`,
                }} />

                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: `${f.color}15`,
                  border: `1px solid ${f.color}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: f.color, marginBottom: 20, position: "relative", zIndex: 2,
                }}>
                  {f.icon}
                </div>

                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: f.color, marginBottom: 10, position: "relative", zIndex: 2 }}>
                  {f.tag}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 10, position: "relative", zIndex: 2 }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.65, position: "relative", zIndex: 2 }}>
                  {f.desc}
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── COMMODITIES ── */}
      <div id="markets" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(245,158,11,0.02)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "100px 60px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
            <Reveal>
              <div style={S.sectionLabel}>COMMODITIES</div>
              <h2 style={{ ...S.sectionTitle, marginBottom: 20 }}>
                Beyond crypto.<br />
                <span style={{
                  background: "linear-gradient(135deg,#F59E0B,#EAB308)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>Real markets.</span>
              </h2>
              <p style={{ ...S.sectionSub, marginBottom: 32 }}>
                Track Gold, Silver, Platinum, Crude Oil, Natural Gas, Coal, Copper and Palladium with live simulated feeds and session charts.
              </p>
              <button
                onClick={() => navigate("/login")}
                style={{ ...S.btnPrimary, display: "inline-flex" }}
              >
                View Commodities <ArrowRight size={15} />
              </button>
            </Reveal>

            <Reveal delay={120}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {COMMS.map(c => (
                  <TiltCard key={c.sym} style={{
                    background:   "rgba(15,23,42,0.7)",
                    border:       `1px solid ${c.color}18`,
                    borderRadius: 12,
                    padding:      "16px 18px",
                    backdropFilter: "blur(12px)",
                    cursor:       "default",
                  }}>
                    <div style={{ position: "relative", zIndex: 2 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: c.color, letterSpacing: "0.08em" }}>{c.sym}</div>
                        <div style={{
                          fontSize: 10, fontWeight: 600,
                          color: c.up ? "#10B981" : "#EF4444",
                          display: "flex", alignItems: "center", gap: 2,
                        }}>
                          {c.up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                          {c.pct}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9", fontVariantNumeric: "tabular-nums" }}>{c.price}</div>
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{c.name}</div>
                    </div>
                  </TiltCard>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      {/* ── TRADE SECTION ── */}
      <div id="trade">
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "100px 60px" }}>
          <Reveal>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 60 }}>
              <div>
                <div style={S.sectionLabel}>TRADING ENGINE</div>
                <h2 style={{ ...S.sectionTitle, marginBottom: 0 }}>
                  Execute with<br />
                  <span style={{
                    background: "linear-gradient(135deg,#10B981,#059669)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  }}>confidence</span>
                </h2>
              </div>
              <button onClick={() => navigate("/login")} style={{ ...S.btnPrimary, display: "inline-flex" }}>
                Open Terminal <ArrowRight size={15} />
              </button>
            </div>
          </Reveal>

          {/* Mock trade UI */}
          <Reveal delay={100}>
            <div style={{
              background:   "rgba(10,18,32,0.8)",
              border:       "1px solid rgba(255,255,255,0.07)",
              borderRadius: 20,
              overflow:     "hidden",
              backdropFilter: "blur(20px)",
              boxShadow:    "0 40px 80px rgba(0,0,0,0.5)",
            }}>
              {/* Window bar */}
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 8 }}>
                {["#EF4444","#F59E0B","#10B981"].map(c => (
                  <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
                ))}
                <span style={{ marginLeft: 8, fontSize: 12, color: "#334155" }}>CryptoStream — Trade Terminal</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: 380 }}>
                {/* Order panel mock */}
                <div style={{ borderRight: "1px solid rgba(255,255,255,0.04)", padding: 24 }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
                    {["Buy BTC","Sell BTC"].map((l, i) => (
                      <div key={l} style={{
                        flex: 1, textAlign: "center", padding: "8px",
                        borderRadius: 8, fontSize: 13, fontWeight: 700,
                        background: i === 0 ? "#10B981" : "rgba(255,255,255,0.03)",
                        border: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                        color: i === 0 ? "#fff" : "#334155",
                      }}>{l}</div>
                    ))}
                  </div>
                  {["Market Price","USDT Amount","BTC Amount"].map((l, i) => (
                    <div key={l} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: "#334155", marginBottom: 6 }}>{l}</div>
                      <div style={{
                        padding: "10px 12px", borderRadius: 8,
                        background: "#060D18", border: "1px solid #1E293B",
                        fontSize: 13, color: i === 0 ? "#10B981" : "#475569",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {i === 0 ? "$67,234.50" : i === 1 ? "1,000.00" : "0.014874"}
                      </div>
                    </div>
                  ))}
                  <div style={{
                    padding: "12px", borderRadius: 10, background: "linear-gradient(135deg,#10B981,#059669)",
                    color: "#fff", fontSize: 14, fontWeight: 700, textAlign: "center",
                    marginTop: 8, cursor: "pointer",
                  }}>
                    Buy BTC
                  </div>
                </div>

                {/* Holdings mock */}
                <div style={{ padding: 24 }}>
                  <div style={{ fontSize: 11, color: "#334155", letterSpacing: "0.08em", marginBottom: 16 }}>PORTFOLIO</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
                    {[
                      { label: "Total Value",  val: "$12,840.50", color: "#F1F5F9" },
                      { label: "Available",    val: "$10,000.00",  color: "#10B981" },
                      { label: "Trades",       val: "14",         color: "#3B82F6" },
                    ].map(s => (
                      <div key={s.label} style={{ background: "#060D18", borderRadius: 10, padding: "14px 16px", border: "1px solid #1E293B" }}>
                        <div style={{ fontSize: 10, color: "#334155", marginBottom: 6 }}>{s.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontVariantNumeric: "tabular-nums" }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                  {/* Transaction rows */}
                  {[
                    { type: "BUY",  sym: "BTC", amt: "0.0148", usdt: "$994.20",  time: "14:22" },
                    { type: "SELL", sym: "ETH", amt: "0.280",  usdt: "$983.58",  time: "13:55" },
                    { type: "BUY",  sym: "SOL", amt: "5.500",  usdt: "$983.95",  time: "13:41" },
                  ].map((tx, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: 8,
                      background: "#060D18", border: "1px solid #0F172A", marginBottom: 8,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: 6,
                          background: tx.type === "BUY" ? "#10B98120" : "#EF444420",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 800, color: tx.type === "BUY" ? "#10B981" : "#EF4444",
                        }}>{tx.type}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8" }}>{tx.amt} {tx.sym}</div>
                          <div style={{ fontSize: 10, color: "#334155" }}>@ {tx.time}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: tx.type === "BUY" ? "#EF4444" : "#10B981", fontVariantNumeric: "tabular-nums" }}>
                        {tx.type === "BUY" ? "-" : "+"}{tx.usdt}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── STATS BAND ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(59,130,246,0.03)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "60px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 40 }}>
          {[
            { val: "5",         label: "Live trading pairs",   suffix: " pairs" },
            { val: "8",         label: "Commodity markets",    suffix: " assets" },
            { val: "< 100",     label: "Data latency",         suffix: "ms" },
            { val: "24 / 7",    label: "Market coverage",      suffix: "" },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 60}>
              <div>
                <div style={{
                  fontSize: 42, fontWeight: 900, letterSpacing: "-0.03em", color: "#F1F5F9",
                  fontVariantNumeric: "tabular-nums",
                  background: "linear-gradient(135deg,#F1F5F9,#93C5FD)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  {s.val}<span style={{ fontSize: 22 }}>{s.suffix}</span>
                </div>
                <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "100px 60px" }}>
        <Reveal>
          <div style={{
            background:     "radial-gradient(ellipse 80% 100% at 50% 0%,rgba(37,99,235,0.15) 0%,transparent 70%), rgba(10,18,32,0.8)",
            border:         "1px solid rgba(255,255,255,0.07)",
            borderRadius:   24,
            padding:        "80px 60px",
            textAlign:      "center",
            position:       "relative",
            overflow:       "hidden",
          }}>
            {/* glow */}
            <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 400, height: 200, background: "radial-gradient(circle,rgba(59,130,246,0.25),transparent 70%)", pointerEvents: "none" }} />

            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#3B82F6", marginBottom: 20 }}>
              START NOW — FREE
            </div>
            <h2 style={{
              fontSize: 52, fontWeight: 900, letterSpacing: "-0.04em",
              marginBottom: 20, position: "relative",
              background: "linear-gradient(135deg,#F1F5F9 0%,#93C5FD 50%,#A78BFA 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Your edge starts here.
            </h2>
            <p style={{ fontSize: 18, color: "#475569", marginBottom: 40, maxWidth: 440, margin: "0 auto 40px" }}>
              Join thousands of traders using CryptoStream to stay ahead of the market.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => navigate("/login")}
                style={{ ...S.btnPrimary, fontSize: 16, padding: "16px 36px" }}
              >
                Create Free Account <ArrowRight size={17} />
              </button>
              <button
                onClick={() => navigate("/login")}
                style={{ ...S.btnSecondary, fontSize: 16, padding: "16px 36px" }}
              >
                Sign In
              </button>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "32px 60px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ ...S.logoIcon, width: 28, height: 28, borderRadius: 7 }}>
            <TrendingUp size={13} color="#fff" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>CryptoStream</span>
        </div>
        <span style={{ fontSize: 12, color: "#1E293B" }}>
          Simulated exchange · For demonstration purposes only
        </span>
      </footer>
    </div>
  )
}
