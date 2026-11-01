'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { PortalLayout, type PortalNavGroup } from '@/components/portal/layout'

import { SessionProvider } from '@/lib/session'
import { CANDIDATE_BRAND, CANDIDATE_NAV } from '@/components/portal/candidate-nav'
import { EnsureRole } from '@/components/portal/ensure-role'
import { api } from '@/lib/api-client'

interface CandidateNotifsResp {
  unreadCount?: number
  total?: number
  items?: unknown[]
}

function useCandidateNotifCount() {
  const { data } = useQuery<CandidateNotifsResp>({
    queryKey: ['candidate-notifications-count'],
    queryFn: () => api.get<CandidateNotifsResp>('/api/candidate/notifications?pageSize=1'),
    staleTime: 30 * 1000,
  })
  return data?.unreadCount ?? 0
}

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  const notifCount = useCandidateNotifCount()

  const groups: PortalNavGroup[] = React.useMemo(() => {
    return CANDIDATE_NAV.map((g) => ({
      ...g,
      items: g.items.map((it) => {
        if (it.href === '/portal/notifications') {
          return { ...it, badge: notifCount > 0 ? notifCount : undefined }
        }
        return it
      }),
    }))
  }, [notifCount])

  return (
    <SessionProvider>
      <EnsureRole role="CANDIDATE">
        <PortalLayout
          role="CANDIDATE"
          navMode="topbottom"
          groups={groups}
          brand={CANDIDATE_BRAND}
          notifications={{ count: notifCount }}
        >
          {children}
        </PortalLayout>
      </EnsureRole>
    </SessionProvider>
  )
}
