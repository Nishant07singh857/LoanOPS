'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession, type Role } from '@/lib/session'

// Ensures the user has the given role before rendering children.
// - If no session: redirects to /login (real auth page) using replace()
//   so the protected URL is not added to browser history (prevents back-button loops).
// - If session with wrong role: shows Forbidden screen with link back to home.
// - If session with right role: renders children.
// This is REAL access control — not auto-login.
export function EnsureRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, loading } = useSession()
  const router = useRouter()
  React.useEffect(() => {
    if (loading) return
    if (!user) {
      // Redirect to login with return path. Use replace() so the protected URL
      // is replaced by /login in history — back button won't bounce back to /admin
      // and trigger another redirect loop.
      const path = role === 'OWNER' ? '/admin' : role === 'AGENT' ? '/agent' : '/portal'
      router.replace(`/login?redirect=${encodeURIComponent(path)}&role=${role}`)
    }
  }, [user, loading, role, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading portal...</p>
        </div>
      </div>
    )
  }

  if (user!.role !== role) {
    const userHome = user!.role === 'OWNER' ? '/admin' : user!.role === 'AGENT' ? '/agent' : '/portal'
    const roleLabel = user!.role === 'OWNER' ? 'Owner' : user!.role === 'AGENT' ? 'Agent' : 'Candidate'
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
          <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              href={userHome}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
            >
              Go to {roleLabel} Portal
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Return home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
