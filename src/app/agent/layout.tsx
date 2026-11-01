import type { Metadata } from 'next'
import AgentShell from './agent-shell'

// The agent console is an authenticated internal area: keep it out of
// search indexes. The interactive shell itself is a client component
// (agent-shell.tsx), which cannot export metadata, so this server
// layout carries it and renders the shell unchanged.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return <AgentShell>{children}</AgentShell>
}
