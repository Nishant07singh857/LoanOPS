'use client'

import { PortalLayout } from '@/components/portal/layout'
import { PageTransition } from '@/components/ui/motion'
import { SessionProvider } from '@/lib/session'
import { CANDIDATE_BRAND, CANDIDATE_NAV } from '@/components/portal/candidate-nav'
import { EnsureRole } from '@/components/portal/ensure-role'

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <EnsureRole role="CANDIDATE">
        <PortalLayout
          role="CANDIDATE"
          navMode="topbottom"
          groups={CANDIDATE_NAV}
          brand={CANDIDATE_BRAND}
          notifications={{ count: 1 }}
        >
          <PageTransition>{children}</PageTransition>
        </PortalLayout>
      </EnsureRole>
    </SessionProvider>
  )
}
