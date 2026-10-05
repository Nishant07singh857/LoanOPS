// Shared TanStack Query provider. Mounted in each portal layout (admin/agent/portal).
// The apply/[token] flow is standalone and does not use this provider.

'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) => {
          // Do not retry client errors (4xx)
          if (error?.status && error.status >= 400 && error.status < 500) {
            return false
          }
          return failureCount < 1
        },
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => createQueryClient())
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

