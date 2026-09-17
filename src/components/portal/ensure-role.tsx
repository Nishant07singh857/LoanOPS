'use client'

import * as React from 'react'
import { useSession, type Role } from '@/lib/session'

// Ensures the user has the given role before rendering children.
// - If no session: redirects to /login (real auth page).
// - If session with wrong role: shows Forbidden screen.
// - If session with right role: renders children.
// This is REAL access control — not auto-login.
export function EnsureRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, loading } = useSession()
  const [handled, setHandled] = React.useState(false)

  React.useEffect(() => {
    if (loading) return
    if (!user) {
      // Redirect to login with return path
      const path = role === 'OWNER' ? '/admin' : role === 'AGENT' ? '/agent' : '/portal'
      window.location.href = `/login?redirect=${encodeURIComponent(path)}&role=${role}`
      return
    }
    setHandled(true)
  }, [user, loading, role])

  if (loading || !handled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading portal...</p>
        </div>
      </div>
    )
  }

  if (user!.role !== role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center">
          <div className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
              <path d="M12 9v4M12 17h.01M4.93 4.93l14.14 14.14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Access denied</h1>
          <p className="text-sm text-muted-foreground mt-2">
            You are signed in as <strong>{user!.role}</strong> but this area requires <strong>{role}</strong> access.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
          >
            Return home
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
