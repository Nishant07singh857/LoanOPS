// Server-side role gate for the authenticated section layouts
// (A-to-Z pre-launch QA, defect D2).
//
// The proxy (src/proxy.ts) only checks that a session-shaped cookie
// exists, and the client shells (EnsureRole) bounce by role only after
// render — so a valid borrower session used to receive the full owner
// console markup with a 200. The section layouts now resolve the real
// session on the server, before any shell markup is produced:
//
// - no valid session → redirect to /login (the same destination the
//   proxy uses for tokenless requests);
// - valid session, wrong role → redirect to the session's OWN section
//   home. That section's layout admits this role, so the redirect
//   cannot loop, and the user lands somewhere they are allowed to be.
//
// Data was never at risk (every section API enforces its own
// requireOwner/requireAgent/requireCandidate check); this closes the
// shell-markup exposure and makes the bounce work with JS disabled.
import { redirect } from 'next/navigation'
import { getSession, getSessionCookie, type AuthUser } from './auth'

export const ROLE_HOME: Record<AuthUser['role'], string> = {
  OWNER: '/admin',
  AGENT: '/agent',
  CANDIDATE: '/portal',
}

/**
 * Resolves the session for a section layout and guarantees the
 * session's role matches `role` — otherwise it redirects (and never
 * returns). Returns the authenticated user for the admitted role.
 */
export async function requireSectionRole(role: AuthUser['role']): Promise<AuthUser> {
  const token = await getSessionCookie()
  const user = await getSession(token)
  if (!user) {
    redirect('/login')
  }
  if (user.role !== role) {
    redirect(ROLE_HOME[user.role])
  }
  return user
}
