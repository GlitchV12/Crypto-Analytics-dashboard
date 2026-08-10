import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export interface AuthUser {
  name:    string
  email:   string
  picture: string
  sub:     string
}

interface AuthContextType {
  user:    AuthUser | null
  login:   (u: AuthUser) => void
  logout:  () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user:    null,
  login:   () => {},
  logout:  () => {},
  loading: true,
})

const STORAGE_KEY = "cs_auth_user"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setUser(JSON.parse(raw) as AuthUser)
    } catch {}
    setLoading(false)
  }, [])

  function login(u: AuthUser) {
    setUser(u)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
  }

  function logout() {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
    // Also revoke Google session if GIS available
    if ((window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.disableAutoSelect()
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
