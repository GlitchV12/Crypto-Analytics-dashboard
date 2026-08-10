console.log("🚀 CryptoStream main.tsx loaded — build:", new Date().toISOString())

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { GoogleOAuthProvider } from "@react-oauth/google"
import { AuthProvider } from "./contexts/AuthContext"
import App from "./App"

// Set VITE_GOOGLE_CLIENT_ID in .env to enable real Google OAuth.
// Without it, the login UI renders but Google will block the OAuth flow.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""

const root = document.getElementById("root")!
createRoot(root).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  </StrictMode>
)
