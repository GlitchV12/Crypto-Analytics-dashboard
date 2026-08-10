import { Component, type ReactNode } from "react"

interface Props  { children: ReactNode }
interface State  { crashed: boolean; error: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false, error: "" }

  static getDerivedStateFromError(err: Error): State {
    return { crashed: true, error: err?.message ?? "Unknown error" }
  }

  componentDidCatch(err: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] caught:", err, info.componentStack)
  }

  render() {
    if (this.state.crashed) {
      return (
        <div style={{
          minHeight: "100vh", background: "#0F172A",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Inter',sans-serif", flexDirection: "column", gap: 16,
        }}>
          <div style={{
            background: "#1E293B", border: "1px solid #EF444430",
            borderRadius: 16, padding: "36px 40px", maxWidth: 440, textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ color: "#F1F5F9", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ color: "#475569", fontSize: 13, marginBottom: 20 }}>
              {this.state.error}
            </p>
            <button
              onClick={() => { this.setState({ crashed: false, error: "" }); window.location.href = "/" }}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none",
                background: "#3B82F6", color: "#fff", fontSize: 14,
                fontWeight: 600, cursor: "pointer",
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
