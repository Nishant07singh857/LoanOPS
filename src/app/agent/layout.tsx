import type { Metadata } from 'next'
import AgentShell from './agent-shell'
import { requireSectionRole } from '@/lib/server/section-guard'

// The agent console is an authenticated internal area: keep it out of
// search indexes. The interactive shell itself is a client component
// (agent-shell.tsx), which cannot export metadata, so this server
// layout carries it and renders the shell unchanged.
//
// The layout also gates the section server-side (A-to-Z QA, D2): only
// an AGENT session ever receives the shell markup — other roles are
// redirected to their own section, and sessionless requests to /login,
// before any chrome is rendered.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  await requireSectionRole('AGENT')
  return <AgentShell>{children}</AgentShell>
}
