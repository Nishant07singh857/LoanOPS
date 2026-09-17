'use client'

import { PortalLayout } from '@/components/portal/layout'
import { PageTransition } from '@/components/ui/motion'
import { SessionProvider } from '@/lib/session'
import { AGENT_BRAND, AGENT_NAV } from '@/components/portal/agent-nav'
import { EnsureRole } from '@/components/portal/ensure-role'

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <EnsureRole role="AGENT">
        <PortalLayout
          role="AGENT"
          navMode="topbottom"
          groups={AGENT_NAV}
          brand={AGENT_BRAND}
          notifications={{ count: 5 }}
        >
          <PageTransition>{children}</PageTransition>
        </PortalLayout>
      </EnsureRole>
    </SessionProvider>
  )
}
