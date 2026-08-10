import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useGoogleLogin } from "@react-oauth/google"
import { TrendingUp, Shield, Zap, BarChart2, Lock } from "lucide-react"
import { useAuth } from "../contexts/AuthContext"

export function LoginPage() {
  const { login, user } = useAuth()
  const navigate         = useNavigate()
  const [error, setError] = useState("")
  const [busy,  setBusy]  = useState(false)
  const canvasRef          = useRef<HTMLCanvasElement>(null)

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate("/", { replace: true })
  }, [user, navigate])

  // Animated background particles
  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement | null
    if (!canvas) return
    const cv  = canvas
    const ctx = cv.getContext("2d")!
    cv.width  = window.innerWidth
    cv.height = window.innerHeight

    const particles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] = []
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r:  Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.4 + 0.1,
      })
    }

    let raf: number
    function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > cv.width)  p.vx *= -1
        if (p.y < 0 || p.y > cv.height) p.vy *= -1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(59,130,246,${p.alpha})`
        ctx.fill()
      })
      // Draw lines between nearby particles
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach(b => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y)
          if (dist < 100) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(59,130,246,${0.08 * (1 - dist / 100)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        })
      })
      raf = requestAnimationFrame(draw)
    }
    draw()

    const onResize = () => {
      cv.width  = window.innerWidth
      cv.height = window.innerHeight
    }
    window.addEventListener("resize", onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize) }
  }, [])

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setBusy(true)
      setError("")
      try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        if (!res.ok) throw new Error("Failed to fetch user info")
        const data = await res.json()
        login({
          name:    data.name    ?? "User",
          email:   data.email   ?? "",
          picture: data.picture ?? "",
          sub:     data.sub     ?? "",
        })
        navigate("/", { replace: true })
      } catch (e) {
        setError("Google sign-in failed. Please try again.")
      } finally {
        setBusy(false)
      }
    },
    onError: () => {
      setError("Google sign-in was cancelled or failed.")
      setBusy(false)
    },
  })

  const features = [
    { icon: <BarChart2 size={16} />, label: "Live crypto charts" },
    { icon: <Zap        size={16} />, label: "Real-time trade feed" },
    { icon: <TrendingUp size={16} />, label: "Commodities tracker" },
    { icon: <Shield     size={16} />, label: "Portfolio analytics" },
  ]

  return (
    <div style={{ minHeight: "100vh", background: "#0A1220", display: "flex", position: "relative", overflow: "hidden" }}>

      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      {/* Left branding panel */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "60px 80px",
        borderRight: "1px solid #1E293B",
        position: "relative", zIndex: 1,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <TrendingUp size={22} color="#fff" />
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9", letterSpacing: "-0.02em" }}>
            CryptoStream
          </span>
        </div>

        <h1 style={{
          fontSize: 42, fontWeight: 800, color: "#F1F5F9",
          lineHeight: 1.15, marginBottom: 16, letterSpacing: "-0.03em",
        }}>
          Markets at your<br />
          <span style={{ background: "linear-gradient(90deg,#3B82F6,#8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            fingertips
          </span>
        </h1>
        <p style={{ fontSize: 16, color: "#64748B", lineHeight: 1.6, marginBottom: 40, maxWidth: 380 }}>
          Track live crypto prices, commodities, and execute trades — all in one real-time dashboard.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {features.map(f => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: "#1E293B", border: "1px solid #334155",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#3B82F6",
              }}>
                {f.icon}
              </div>
              <span style={{ fontSize: 14, color: "#94A3B8" }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right login panel */}
      <div style={{
        width: 480, display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center",
        padding: "60px 56px", position: "relative", zIndex: 1,
      }}>
        <div style={{
          width: "100%", maxWidth: 360,
          background: "#0F172A", border: "1px solid #1E293B",
          borderRadius: 20, padding: "40px 36px",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
        }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 12,
              background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <Lock size={24} color="#fff" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#F1F5F9", marginBottom: 6 }}>Welcome back</h2>
            <p style={{ fontSize: 13, color: "#475569" }}>Sign in to access your dashboard</p>
          </div>

          {/* Google Sign-In Button */}
          <button
            onClick={() => { setError(""); setBusy(true); googleLogin() }}
            disabled={busy}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "12px 20px", borderRadius: 10, border: "1px solid #334155",
              background: busy ? "#1E293B" : "#fff",
              color:      busy ? "#64748B"  : "#1F2937",
              fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer",
              transition: "all 0.15s", opacity: busy ? 0.7 : 1,
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

          {error && (
            <div style={{
              marginTop: 14, padding: "10px 14px", borderRadius: 8,
              background: "#EF444420", border: "1px solid #EF444440",
              fontSize: 12, color: "#EF4444", textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 28, padding: "16px 0 0", borderTop: "1px solid #1E293B" }}>
            <p style={{ fontSize: 11, color: "#334155", textAlign: "center", lineHeight: 1.6 }}>
              By signing in you agree to our Terms of Service.<br />
              Your data is secured and never shared.
            </p>
          </div>
        </div>

        <p style={{ marginTop: 20, fontSize: 11, color: "#334155" }}>
          Protected by Google OAuth 2.0
        </p>
      </div>
    </div>
  )
}
