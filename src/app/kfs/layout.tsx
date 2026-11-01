import type { Metadata } from 'next'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'

// The KFS page is a client component, which cannot export metadata, so
// this server layout carries the title its sibling compliance pages
// (privacy, terms, grievance, fair-practices) declare for themselves.
// `absolute` keeps the rendered title identical to that house style.
export const metadata: Metadata = {
  title: { absolute: `Key Facts Statement (KFS) | ${COMPLIANCE_CONFIG.companyName}` },
}

export default function KfsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
