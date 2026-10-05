'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { PortalLayout, type PortalNavGroup } from '@/components/portal/layout'

import { SessionProvider } from '@/lib/session'
import { OWNER_BRAND, OWNER_NAV } from '@/components/portal/owner-nav'
import { EnsureRole } from '@/components/portal/ensure-role'
import { api } from '@/lib/api-client'

interface OwnerDashboardKPIs {
  activeLoans: number
  pendingApplications: number
  pendingCashVerification: number
  loansReadyForDisbursement: number
  openEscalations: number
}

function useOwnerNavBadges() {
  const { data: kpis } = useQuery<OwnerDashboardKPIs>({
    queryKey: ['owner-dashboard'],
    queryFn: () => api.get<OwnerDashboardKPIs>('/api/owner/dashboard'),
    staleTime: 30 * 1000,
    retry: 1,
  })
  const { data: notifData } = useQuery<{ unreadCount?: number; total?: number } | { items: unknown[]; unreadCount?: number }>({
    queryKey: ['owner-notifications-badges'],
    queryFn: () => api.get<{ unreadCount?: number; total?: number } | { items: unknown[]; unreadCount?: number }>('/api/notifications?pageSize=1'),
    staleTime: 30 * 1000,
    retry: 1,
  })

  return React.useMemo(() => {
    const badges: Record<string, number> = {
      '/admin/loans': kpis?.activeLoans ?? 0,
      '/admin/applications': kpis?.pendingApplications ?? 0,
      '/admin/collections': kpis?.pendingCashVerification ?? 0,
      '/admin/loans?status=PENDING_DISBURSEMENT': kpis?.loansReadyForDisbursement ?? 0,
    }
    const notifCount = (notifData as { unreadCount?: number })?.unreadCount ?? 0
    return { badges, notifCount }
  }, [kpis, notifData])
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { badges, notifCount } = useOwnerNavBadges()

  const groups: PortalNavGroup[] = React.useMemo(() => {
    return OWNER_NAV.map((g) => ({
      ...g,
      items: g.items.map((it) => {
        if (it.href in badges && badges[it.href] > 0) {
          return { ...it, badge: badges[it.href] }
        }
        // Strip static mock badges so the sidebar reflects reality
        if (it.href in badges) return { ...it, badge: undefined }
        return it
      }),
    }))
  }, [badges])

  return (
    <SessionProvider>
      <EnsureRole role="OWNER">
        <PortalLayout
          role="OWNER"
          navMode="sidebar"
          groups={groups}
          brand={OWNER_BRAND}
          notifications={{ count: notifCount }}
        >
          {children}
        </PortalLayout>
      </EnsureRole>
    </SessionProvider>
  )
}
