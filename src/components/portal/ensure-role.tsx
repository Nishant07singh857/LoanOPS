'use client'

import * as React from 'react'
import { useSession, type Role } from '@/lib/session'

// Auto-sets the session to the given role if it's not already set
// or if the current session's role doesn't match. This lets users
// navigate directly to a portal route without manually logging in.
export function EnsureRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, loading, loginAs } = useSession()
  const [ensured, setEnsured] = React.useState(false)

  React.useEffect(() => {
    if (loading) return
    if (!user || user.role !== role) {
      loginAs(role).then(() => setEnsured(true))
    } else {
      setEnsured(true)
    }
  }, [user, loading, role, loginAs])

  if (!ensured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading portal...</p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}
