import type { Metadata } from 'next'
import AdminShell from './admin-shell'
import { requireSectionRole } from '@/lib/server/section-guard'

// The owner console is an authenticated internal area: keep it out of
// search indexes. The interactive shell itself is a client component
// (admin-shell.tsx), which cannot export metadata, so this server
// layout carries it and renders the shell unchanged.
//
// The layout also gates the section server-side (A-to-Z QA, D2): only
// an OWNER session ever receives the shell markup — other roles are
// redirected to their own section, and sessionless requests to /login,
// before any chrome is rendered.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSectionRole('OWNER')
  return <AdminShell>{children}</AdminShell>
}
