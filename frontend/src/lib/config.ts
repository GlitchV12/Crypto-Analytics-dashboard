/**
 * Runtime API config.
 * Set these in Vercel → Project Settings → Environment Variables:
 *   VITE_API_URL  = https://your-railway-app.railway.app
 *   VITE_WS_URL   = wss://your-railway-app.railway.app/ws
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? ""
const WS_EXPLICIT = import.meta.env.VITE_WS_URL as string | undefined

export function getApiUrl(path: string): string {
  return `${API_BASE}${path}`
}

export function getWsUrl(): string {
  if (WS_EXPLICIT) return WS_EXPLICIT
  if (import.meta.env.DEV) return "ws://localhost:8080/ws"
  // In production without env var — derive from VITE_API_URL
  if (API_BASE) {
    return API_BASE.replace(/^https?/, (p) => (p === "https" ? "wss" : "ws")) + "/ws"
  }
  // Last resort (will fail on Vercel — set VITE_API_URL!)
  return (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws"
}
