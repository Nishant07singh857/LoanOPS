'use client'

import { PortalLayout } from '@/components/portal/layout'
import { PageTransition } from '@/components/ui/motion'
import { SessionProvider } from '@/lib/session'
import { OWNER_BRAND, OWNER_NAV } from '@/components/portal/owner-nav'
import { EnsureRole } from '@/components/portal/ensure-role'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <EnsureRole role="OWNER">
        <PortalLayout
          role="OWNER"
          navMode="sidebar"
          groups={OWNER_NAV}
          brand={OWNER_BRAND}
          notifications={{ count: 8 }}
        >
          <PageTransition>{children}</PageTransition>
        </PortalLayout>
      </EnsureRole>
    </SessionProvider>
  )
}
