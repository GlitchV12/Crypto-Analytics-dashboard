import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export interface AuthUser {
  name:    string
  email:   string
  picture: string
  sub:     string
}

interface StoredAccount {
  email:    string
  password: string   // plaintext — client-side demo only
  name:     string
}

interface AuthContextType {
  user:           AuthUser | null
  login:          (u: AuthUser) => void
  logout:         () => void
  loading:        boolean
  signUp:         (name: string, email: string, password: string) => string | null
  signInEmail:    (email: string, password: string) => string | null
}

const AuthContext = createContext<AuthContextType>({
  user:        null,
  login:       () => {},
  logout:      () => {},
  loading:     true,
  signUp:      () => null,
  signInEmail: () => null,
})

const USER_KEY     = "cs_auth_user"
const ACCOUNTS_KEY = "cs_accounts"

function loadAccounts(): StoredAccount[] {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") } catch { return [] }
}
function saveAccounts(accs: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accs))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      if (raw) setUser(JSON.parse(raw) as AuthUser)
    } catch {}
    setLoading(false)
  }, [])

  function login(u: AuthUser) {
    setUser(u)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
  }

  function logout() {
    setUser(null)
    localStorage.removeItem(USER_KEY)
    if ((window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.disableAutoSelect()
    }
  }

  /** Returns error string or null on success */
  function signUp(name: string, email: string, password: string): string | null {
    if (!name.trim())     return "Name is required."
    if (!email.includes("@")) return "Enter a valid email."
    if (password.length < 6)  return "Password must be at least 6 characters."
    const accounts = loadAccounts()
    if (accounts.find(a => a.email.toLowerCase() === email.toLowerCase())) {
      return "An account with this email already exists."
    }
    accounts.push({ email: email.toLowerCase(), password, name: name.trim() })
    saveAccounts(accounts)
    login({ name: name.trim(), email: email.toLowerCase(), picture: "", sub: email.toLowerCase() })
    return null
  }

  /** Returns error string or null on success */
  function signInEmail(email: string, password: string): string | null {
    const accounts = loadAccounts()
    const acc = accounts.find(a => a.email.toLowerCase() === email.toLowerCase())
    if (!acc)               return "No account found with that email."
    if (acc.password !== password) return "Incorrect password."
    login({ name: acc.name, email: acc.email, picture: "", sub: acc.email })
    return null
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, signUp, signInEmail }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
