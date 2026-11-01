'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { PortalLayout, type PortalNavGroup } from '@/components/portal/layout'

import { SessionProvider } from '@/lib/session'
import { AGENT_BRAND, AGENT_NAV } from '@/components/portal/agent-nav'
import { EnsureRole } from '@/components/portal/ensure-role'
import { api } from '@/lib/api-client'

interface AgentDashboard {
  todayTasksCount?: number
  todayFollowUpsCount?: number
  ptpDueCount?: number
  pendingCashVerificationsCount?: number
  overdueCandidatesCount?: number
}

function useAgentNavBadges() {
  const { data } = useQuery<AgentDashboard>({
    queryKey: ['agent-dashboard-badges'],
    queryFn: () => api.get<AgentDashboard>('/api/agent/dashboard'),
    staleTime: 30 * 1000,
  })
  const { data: notifData } = useQuery<{ unreadCount?: number; total?: number } | { items: unknown[]; unreadCount?: number }>({
    queryKey: ['agent-notifications-badges'],
    queryFn: () => api.get<{ unreadCount?: number; total?: number } | { items: unknown[]; unreadCount?: number }>('/api/notifications?pageSize=50'),
    staleTime: 30 * 1000,
  })

  return React.useMemo(() => {
    const badges: Record<string, number> = {
      '/agent/tasks': data?.todayTasksCount ?? 0,
      '/agent/followups': data?.todayFollowUpsCount ?? 0,
      '/agent/ptp': data?.ptpDueCount ?? 0,
      '/agent/cash': data?.pendingCashVerificationsCount ?? 0,
    }
    const notifCount = (notifData as { unreadCount?: number })?.unreadCount ?? 0
    return { badges, notifCount }
  }, [data, notifData])
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const { badges, notifCount } = useAgentNavBadges()

  const groups: PortalNavGroup[] = React.useMemo(() => {
    return AGENT_NAV.map((g) => ({
      ...g,
      items: g.items.map((it) => {
        if (it.href in badges && badges[it.href] > 0) {
          return { ...it, badge: badges[it.href] }
        }
        if (it.href in badges) return { ...it, badge: undefined }
        return it
      }),
    }))
  }, [badges])

  return (
    <SessionProvider>
      <EnsureRole role="AGENT">
        <PortalLayout
          role="AGENT"
          navMode="topbottom"
          groups={groups}
          brand={AGENT_BRAND}
          notifications={{ count: notifCount }}
        >
          {children}
        </PortalLayout>
      </EnsureRole>
    </SessionProvider>
  )
}
