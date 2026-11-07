import type { Metadata } from 'next'
import CandidateShell from './portal-shell'
import { requireSectionRole } from '@/lib/server/section-guard'

// The borrower portal is an authenticated internal area: keep it out of
// search indexes. The interactive shell itself is a client component
// (portal-shell.tsx), which cannot export metadata, so this server
// layout carries it and renders the shell unchanged.
//
// The layout also gates the section server-side (A-to-Z QA, D2): only
// a CANDIDATE session ever receives the shell markup — other roles are
// redirected to their own section, and sessionless requests to /login,
// before any chrome is rendered.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireSectionRole('CANDIDATE')
  return <CandidateShell>{children}</CandidateShell>
}
