import type { Metadata } from 'next'
import CandidateShell from './portal-shell'

// The borrower portal is an authenticated internal area: keep it out of
// search indexes. The interactive shell itself is a client component
// (portal-shell.tsx), which cannot export metadata, so this server
// layout carries it and renders the shell unchanged.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <CandidateShell>{children}</CandidateShell>
}
