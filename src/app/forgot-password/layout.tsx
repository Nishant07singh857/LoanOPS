import type { Metadata } from 'next'

// Password recovery is a per-user utility flow, not a page to index.
// The page itself is a client component, which cannot export metadata,
// so this server layout carries it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
