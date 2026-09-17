'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { PortalLayout } from '@/components/portal/layout'
import { PageTransition } from '@/components/ui/motion'
import { SessionProvider } from '@/lib/session'
import { CANDIDATE_BRAND, CANDIDATE_NAV } from '@/components/portal/candidate-nav'
import { EnsureRole } from '@/components/portal/ensure-role'
import { QueryProvider } from '@/components/query-provider'
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

  return (
    <SessionProvider>
      <EnsureRole role="CANDIDATE">
        <QueryProvider>
          <PortalLayout
            role="CANDIDATE"
            navMode="topbottom"
            groups={CANDIDATE_NAV}
            brand={CANDIDATE_BRAND}
            notifications={{ count: notifCount }}
          >
            <PageTransition>{children}</PageTransition>
          </PortalLayout>
        </QueryProvider>
      </EnsureRole>
    </SessionProvider>
  )
}
