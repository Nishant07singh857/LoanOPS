'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FadeIn, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { api, ApiRequestError } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface NotificationRow {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminNotificationsPage() {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-notifications'],
    queryFn: () => api.get<{ items: NotificationRow[]; total: number; unreadCount: number }>('/api/notifications?pageSize=100'),
  })
  const items = data?.items ?? []
  const unread = data?.unreadCount ?? items.filter((n) => !n.isRead).length

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post('/api/notifications', { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-notifications'] }),
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.message : 'Please try again.'
      toast.error('Could not mark as read', { description: message })
    },
  })

  const markAllMutation = useMutation({
    mutationFn: () => api.post('/api/notifications', { all: true }),
    onSuccess: () => {
      toast.success('All notifications marked as read')
      queryClient.invalidateQueries({ queryKey: ['owner-notifications'] })
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.message : 'Please try again.'
      toast.error('Could not mark all as read', { description: message })
    },
  })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : 'You are all caught up.'}
        icon={<Bell className="h-5 w-5" />}
        action={
          unread > 0 ? (
            <Button size="sm" variant="outline" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium text-destructive">Could not load notifications.</p>
            <p className="text-xs text-muted-foreground mt-1">Please check your connection and try again.</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" description="New activity will appear here." />
      ) : (
        <FadeIn>
          <div className="space-y-2.5">
            {items.map((n) => (
              <Card key={n.id} className={cn(!n.isRead && 'border-primary/40 bg-primary/5')}>
                <CardContent className="p-4 flex items-start gap-3">
                  <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', n.isRead ? 'bg-muted' : 'bg-primary')} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{n.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{fmtDateTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      disabled={markReadMutation.isPending}
                      onClick={() => markReadMutation.mutate(n.id)}
                    >
                      Mark read
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </FadeIn>
      )}
    </div>
  )
}
