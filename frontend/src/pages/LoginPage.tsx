import { useEffect, useRef, useState } from "react"
import { useNavigate }        from "react-router-dom"
import { useGoogleLogin }     from "@react-oauth/google"
import { TrendingUp, Eye, EyeOff, Mail, Lock, User, AlertCircle } from "lucide-react"
import { useAuth }            from "../contexts/AuthContext"

/* ─── Sci-fi canvas background ──────────────────────────── */
function SciFiBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current as HTMLCanvasElement | null
    if (!cv) return
    const ctx = cv.getContext("2d")!
    let W = cv.width  = window.innerWidth
    let H = cv.height = window.innerHeight
    let raf: number
    let t = 0

    /* Stars */
    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.4 + 0.2,
      alpha: Math.random() * 0.6 + 0.2,
      pulse: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.01 + 0.005,
    }))

    /* Floating data nodes */
    const nodes = Array.from({ length: 28 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 1,
      alpha: Math.random() * 0.5 + 0.15,
      color: Math.random() > 0.5 ? "#3B82F6" : "#8B5CF6",
    }))

    /* Horizontal scan lines */
    let scanY = -80

    /* Hexagon grid coords */
    const hexes: { x: number; y: number; size: number; alpha: number; phase: number }[] = []
    const hexSize = 60
    const hexW = hexSize * Math.sqrt(3)
    const hexH = hexSize * 2
    for (let row = -1; row < Math.ceil(H / (hexH * 0.75)) + 2; row++) {
      for (let col = -1; col < Math.ceil(W / hexW) + 2; col++) {
        const xOff = (row % 2) * (hexW / 2)
        hexes.push({
          x: col * hexW + xOff,
          y: row * hexH * 0.75,
          size: hexSize,
          alpha: Math.random() * 0.04 + 0.015,
          phase: Math.random() * Math.PI * 2,
        })
      }
    }

    function hexPath(x: number, y: number, s: number) {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6
        const px = x + s * Math.cos(a)
        const py = y + s * Math.sin(a)
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.closePath()
    }

    function draw() {
      t++
      ctx.clearRect(0, 0, W, H)

      /* Deep space gradient */
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.8)
      bg.addColorStop(0, "#0D1B2A")
      bg.addColorStop(0.5, "#080F1A")
      bg.addColorStop(1, "#04080F")
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      /* Hex grid */
      hexes.forEach(h => {
        const a = h.alpha + Math.sin(t * 0.015 + h.phase) * 0.02
        hexPath(h.x, h.y, h.size)
        ctx.strokeStyle = `rgba(59,130,246,${Math.max(0, a)})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      })

      /* Stars */
      stars.forEach(s => {
        const a = s.alpha * (0.5 + 0.5 * Math.sin(t * s.speed + s.pulse))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200,220,255,${a})`
        ctx.fill()
      })

      /* Node connections */
      nodes.forEach(a => {
        a.x += a.vx; a.y += a.vy
        if (a.x < 0 || a.x > W) a.vx *= -1
        if (a.y < 0 || a.y > H) a.vy *= -1
        nodes.forEach(b => {
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < 120 && d > 0) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(59,130,246,${0.12 * (1 - d / 120)})`
            ctx.lineWidth = 0.8
            ctx.stroke()
          }
        })
      })

      /* Node dots */
      nodes.forEach(n => {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = n.color + Math.round(n.alpha * 255).toString(16).padStart(2, "0")
        ctx.fill()
      })

      /* Glowing orbs (large, blurred via radial gradient) */
      const orbs = [
        { x: W * 0.15, y: H * 0.25, c: "#1D4ED8", r: 200 },
        { x: W * 0.85, y: H * 0.7,  c: "#7C3AED", r: 240 },
        { x: W * 0.5,  y: H * 0.1,  c: "#0EA5E9", r: 160 },
      ]
      orbs.forEach(o => {
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r)
        const pulse = 0.06 + 0.02 * Math.sin(t * 0.008 + o.x)
        g.addColorStop(0, o.c + "28")
        g.addColorStop(0.5, o.c + "10")
        g.addColorStop(1, "transparent")
        ctx.globalAlpha = pulse * 2
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      })

      /* Horizontal scan line */
      scanY += 0.8
      if (scanY > H + 80) scanY = -80
      const sg = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40)
      sg.addColorStop(0, "rgba(59,130,246,0)")
      sg.addColorStop(0.5, "rgba(59,130,246,0.06)")
      sg.addColorStop(1, "rgba(59,130,246,0)")
      ctx.fillStyle = sg
      ctx.fillRect(0, scanY - 40, W, 80)

      /* Vertical data columns (matrix-style) */
      if (t % 4 === 0) {
        ctx.font = "10px monospace"
        for (let i = 0; i < 6; i++) {
          const cx = Math.floor(Math.random() * W)
          const cy = Math.floor(Math.random() * H)
          ctx.fillStyle = `rgba(59,130,246,0.15)`
          ctx.fillText(Math.random().toFixed(4), cx, cy)
        }
      }

      raf = requestAnimationFrame(draw)
    }

    draw()

    const onResize = () => {
      W = cv.width  = window.innerWidth
      H = cv.height = window.innerHeight
    }
    window.addEventListener("resize", onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize) }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}
    />
  )
}

/* ─── Input field ────────────────────────────────────────── */
function Field({
  icon, type, placeholder, value, onChange, extra,
}: {
  icon:        React.ReactNode
  type:        string
  placeholder: string
  value:       string
  onChange:    (v: string) => void
  extra?:      React.ReactNode
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "#0A1220", border: "1px solid #1E293B",
      borderRadius: 10, padding: "11px 14px",
      transition: "border-color 0.15s",
    }}
      onFocus={e => (e.currentTarget.style.borderColor = "#3B82F6")}
      onBlur={e  => (e.currentTarget.style.borderColor = "#1E293B")}
    >
      <span style={{ color: "#334155", flexShrink: 0 }}>{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          flex: 1, background: "none", border: "none", outline: "none",
          color: "#F1F5F9", fontSize: 14,
        }}
      />
      {extra}
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────── */
export function LoginPage() {
  const { login, user, signUp, signInEmail } = useAuth()
  const navigate = useNavigate()

  type Tab = "signin" | "signup"
  const [tab,      setTab]      = useState<Tab>("signin")
  const [name,     setName]     = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [confirm,  setConfirm]  = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState("")
  const [busy,     setBusy]     = useState(false)
  const [googleErr, setGoogleErr] = useState("")

  useEffect(() => {
    if (user) navigate("/", { replace: true })
  }, [user, navigate])

  /* ── Google login — call directly from onClick, no async before ── */
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setBusy(true)
      setGoogleErr("")
      try {
        const res  = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        const data = await res.json()
        login({ name: data.name ?? "User", email: data.email ?? "", picture: data.picture ?? "", sub: data.sub ?? "" })
        navigate("/", { replace: true })
      } catch {
        setGoogleErr("Could not fetch user info. Try again.")
      } finally {
        setBusy(false)
      }
    },
    onError: (e) => {
      console.error(e)
      setGoogleErr("Google sign-in failed or was cancelled.")
    },
  })

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (tab === "signup") {
      if (password !== confirm) { setError("Passwords do not match."); return }
      const err = signUp(name, email, password)
      if (err) { setError(err); return }
    } else {
      const err = signInEmail(email, password)
      if (err) { setError(err); return }
    }
    navigate("/", { replace: true })
  }

  const divider = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
      <div style={{ flex: 1, height: 1, background: "#1E293B" }} />
      <span style={{ fontSize: 11, color: "#334155" }}>or continue with</span>
      <div style={{ flex: 1, height: 1, background: "#1E293B" }} />
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", display: "flex" }}>
      <SciFiBackground />

      {/* Glass overlay */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "linear-gradient(135deg,rgba(13,27,42,0.55) 0%,rgba(4,8,15,0.45) 100%)",
      }} />

      {/* Left — branding */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "60px 80px", position: "relative", zIndex: 2,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 30px rgba(59,130,246,0.4)",
          }}>
            <TrendingUp size={22} color="#fff" />
          </div>
          <span style={{
            fontSize: 24, fontWeight: 800, color: "#F1F5F9",
            letterSpacing: "-0.02em", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
          }}>
            CryptoStream
          </span>
        </div>

        <h1 style={{
          fontSize: 52, fontWeight: 900, lineHeight: 1.1,
          letterSpacing: "-0.04em", marginBottom: 20,
          fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
          color: "transparent",
          background: "linear-gradient(135deg,#E2E8F0 0%,#3B82F6 50%,#8B5CF6 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          Trade smarter.<br />Move faster.
        </h1>

        <p style={{
          fontSize: 16, color: "#64748B", lineHeight: 1.7,
          maxWidth: 400, marginBottom: 48,
          fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
        }}>
          Real-time crypto analytics, commodity tracking, and portfolio management — all in one terminal.
        </p>

        {/* Feature badges */}
        {[
          { label: "Live Binance trade stream", color: "#3B82F6" },
          { label: "Buy & sell crypto instantly", color: "#10B981" },
          { label: "Gold · Silver · Oil · Gas tracking", color: "#F59E0B" },
          { label: "AI price forecast engine", color: "#8B5CF6" },
        ].map(f => (
          <div key={f.label} style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
            fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: f.color, boxShadow: `0 0 8px ${f.color}`,
            }} />
            <span style={{ fontSize: 14, color: "#94A3B8" }}>{f.label}</span>
          </div>
        ))}
      </div>

      {/* Right — auth card */}
      <div style={{
        width: 460, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 40px", position: "relative", zIndex: 2,
      }}>
        <div style={{
          width: "100%",
          background: "rgba(10,18,32,0.85)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(59,130,246,0.15)",
          borderRadius: 20,
          padding: "36px 32px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
          fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
        }}>

          {/* Tab toggle */}
          <div style={{
            display: "flex", gap: 0, background: "#060D18",
            borderRadius: 10, padding: 4, marginBottom: 28,
            border: "1px solid #1E293B",
          }}>
            {(["signin","signup"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); setGoogleErr("") }}
                style={{
                  flex: 1, padding: "8px", borderRadius: 8, fontSize: 13,
                  fontWeight: tab === t ? 700 : 400,
                  border: "none",
                  background: tab === t
                    ? "linear-gradient(135deg,#1D4ED8,#2563EB)"
                    : "transparent",
                  color: tab === t ? "#fff" : "#475569",
                  cursor: "pointer", transition: "all 0.2s",
                  boxShadow: tab === t ? "0 2px 12px rgba(37,99,235,0.4)" : "none",
                }}
              >
                {t === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <h2 style={{
            fontSize: 20, fontWeight: 700, color: "#F1F5F9",
            marginBottom: 4,
          }}>
            {tab === "signin" ? "Welcome back" : "Create account"}
          </h2>
          <p style={{ fontSize: 12, color: "#475569", marginBottom: 22 }}>
            {tab === "signin"
              ? "Sign in to your CryptoStream account"
              : "Start tracking markets in seconds"}
          </p>

          {/* Email/Password form */}
          <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tab === "signup" && (
              <Field
                icon={<User size={15} />}
                type="text"
                placeholder="Full name"
                value={name}
                onChange={setName}
              />
            )}
            <Field
              icon={<Mail size={15} />}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={setEmail}
            />
            <Field
              icon={<Lock size={15} />}
              type={showPw ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={setPassword}
              extra={
                <button type="button" onClick={() => setShowPw(p => !p)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#334155", padding: 0, lineHeight: 0, flexShrink: 0,
                }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />
            {tab === "signup" && (
              <Field
                icon={<Lock size={15} />}
                type={showPw ? "text" : "password"}
                placeholder="Confirm password"
                value={confirm}
                onChange={setConfirm}
              />
            )}

            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 12px", borderRadius: 8,
                background: "#EF444415", border: "1px solid #EF444430",
                color: "#EF4444", fontSize: 12,
              }}>
                <AlertCircle size={13} />
                {error}
              </div>
            )}

            {tab === "signin" && (
              <div style={{ textAlign: "right", marginTop: -4 }}>
                <button type="button" style={{
                  background: "none", border: "none", color: "#3B82F6",
                  fontSize: 11, cursor: "pointer", padding: 0,
                }}>
                  Forgot password?
                </button>
              </div>
            )}

            <button type="submit" style={{
              width: "100%", padding: "12px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#1D4ED8,#2563EB)",
              color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
              marginTop: 4, boxShadow: "0 4px 20px rgba(37,99,235,0.35)",
              transition: "opacity 0.15s",
            }}>
              {tab === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {divider}

          {/* Google button — call googleLogin() DIRECTLY, no async gap */}
          <button
            type="button"
            disabled={busy}
            onClick={() => { setGoogleErr(""); googleLogin() }}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 10, padding: "11px 20px", borderRadius: 10,
              border: "1px solid #1E293B",
              background: busy ? "#0A1220" : "rgba(255,255,255,0.97)",
              color: busy ? "#475569" : "#1F2937",
              fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1, transition: "all 0.15s",
            }}
          >
            {!busy && (
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04c-.72.49-1.63.78-2.7.78-2.08 0-3.84-1.41-4.47-3.29H1.88v2.07A8 8 0 0 0 8.98 17z"/>
                <path fill="#FBBC05" d="M4.51 10.51A4.8 4.8 0 0 1 4.26 9c0-.52.09-1.02.25-1.51V5.42H1.88A8 8 0 0 0 .98 9c0 1.29.31 2.51.9 3.58l2.63-2.07z"/>
                <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 8.98 1 8 8 0 0 0 1.88 5.42l2.63 2.07c.63-1.88 2.39-3.91 4.47-3.91z"/>
              </svg>
            )}
            {busy ? "Signing in…" : "Continue with Google"}
          </button>

          {googleErr && (
            <div style={{
              marginTop: 10, display: "flex", alignItems: "center", gap: 7,
              padding: "9px 12px", borderRadius: 8,
              background: "#EF444415", border: "1px solid #EF444430",
              color: "#EF4444", fontSize: 12,
            }}>
              <AlertCircle size={13} />
              {googleErr}
            </div>
          )}

          {/* Note for Google OAuth setup */}
          {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <p style={{
              marginTop: 12, fontSize: 10, color: "#334155",
              textAlign: "center", lineHeight: 1.5,
            }}>
              Google login requires{" "}
              <code style={{ color: "#475569" }}>VITE_GOOGLE_CLIENT_ID</code>{" "}
              env variable. Email login works without it.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
