import type { Metadata } from 'next'
import AdminShell from './admin-shell'

// The owner console is an authenticated internal area: keep it out of
// search indexes. The interactive shell itself is a client component
// (admin-shell.tsx), which cannot export metadata, so this server
// layout carries it and renders the shell unchanged.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
