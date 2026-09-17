// Client-side session context.
// Backed by HTTP-only cookie set by /api/auth/login (owner/agent) or
// /api/auth/candidate-login (candidate). On mount, fetches /api/auth/me
// to hydrate the current user. login() posts to the real API.
// loginAs() is retained as a dev convenience that hits a /api/auth/dev-login
// endpoint only when NODE_ENV !== 'production'.

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

export type Role = 'OWNER' | 'AGENT' | 'CANDIDATE'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
  organizationId: string
  organizationName: string
  phone?: string | null
  candidateId?: string | null
}

interface SessionContextValue {
  user: SessionUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  loginCandidate: (mobile: string, password: string) => Promise<{ ok: boolean; error?: string }>
  loginAs: (role: Role) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const SessionContext = React.createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(null)
  const [loading, setLoading] = React.useState(true)
  const router = useRouter()

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'same-origin' })
      if (r.ok) {
        const json = await r.json()
        setUser(json.data)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  const login = async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    })
    if (r.ok) {
      const json = await r.json()
      setUser(json.data)
      return { ok: true }
    }
    const json = await r.json().catch(() => ({}))
    return { ok: false, error: json?.error?.message || 'Login failed' }
  }

  const loginCandidate = async (mobile: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const r = await fetch('/api/auth/candidate-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ mobile, password }),
    })
    if (r.ok) {
      const json = await r.json()
      setUser(json.data)
      return { ok: true }
    }
    const json = await r.json().catch(() => ({}))
    return { ok: false, error: json?.error?.message || 'Login failed' }
  }

  const loginAs = async (role: Role) => {
    // Dev convenience — hits the dev-login endpoint which auto-creates a session
    // using seeded demo credentials. Only available when NODE_ENV !== production.
    const r = await fetch('/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ role }),
    })
    if (r.ok) {
      const json = await r.json()
      setUser(json.data)
    }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    setUser(null)
    router.push('/')
  }

  return (
    <SessionContext.Provider value={{ user, loading, login, loginCandidate, loginAs, logout, refresh }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
