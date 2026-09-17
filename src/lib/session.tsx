// Simple session-based auth context for demo
// In production: replace with NextAuth + bcrypt + JWT/session in DB
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
  phone?: string
}

interface SessionContextValue {
  user: SessionUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  loginAs: (role: Role) => Promise<void>
  logout: () => Promise<void>
}

const SessionContext = React.createContext<SessionContextValue | null>(null)

const DEMO_ACCOUNTS: Record<Role, SessionUser> = {
  OWNER: {
    id: 'demo-owner',
    email: 'owner@loanops.in',
    name: 'Ravi Mehta',
    role: 'OWNER',
    organizationId: 'demo-org',
    organizationName: ' Sterling Lending',
    phone: '+91 98200 11223',
  },
  AGENT: {
    id: 'demo-agent',
    email: 'agent@loanops.in',
    name: 'Arjun Nair',
    role: 'AGENT',
    organizationId: 'demo-org',
    organizationName: ' Sterling Lending',
    phone: '+91 98201 44556',
  },
  CANDIDATE: {
    id: 'demo-candidate',
    email: 'candidate@loanops.in',
    name: 'Priya Sharma',
    role: 'CANDIDATE',
    organizationId: 'demo-org',
    organizationName: ' Sterling Lending',
    phone: '+91 98202 77889',
  },
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(null)
  const [loading, setLoading] = React.useState(true)
  const router = useRouter()

  React.useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('loanops-session') : null
      if (saved) setUser(JSON.parse(saved))
    } catch {}
    setLoading(false)
  }, [])

  const persist = (u: SessionUser | null) => {
    setUser(u)
    if (typeof window !== 'undefined') {
      if (u) localStorage.setItem('loanops-session', JSON.stringify(u))
      else localStorage.removeItem('loanops-session')
    }
  }

  const login = async (email: string, _password: string): Promise<{ ok: boolean; error?: string }> => {
    const e = email.toLowerCase().trim()
    if (e.includes('owner')) {
      persist(DEMO_ACCOUNTS.OWNER)
      return { ok: true }
    }
    if (e.includes('agent')) {
      persist(DEMO_ACCOUNTS.AGENT)
      return { ok: true }
    }
    if (e.includes('candidate') || e.includes('user')) {
      persist(DEMO_ACCOUNTS.CANDIDATE)
      return { ok: true }
    }
    return { ok: false, error: 'Use owner@ / agent@ / candidate@ loanops.in' }
  }

  const loginAs = async (role: Role) => {
    persist(DEMO_ACCOUNTS[role])
  }

  const logout = async () => {
    persist(null)
    router.push('/')
  }

  return (
    <SessionContext.Provider value={{ user, loading, login, loginAs, logout }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
