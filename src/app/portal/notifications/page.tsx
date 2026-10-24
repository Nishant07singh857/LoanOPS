'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell, CheckCircle2, Clock, IndianRupee, CheckCheck, Filter,
  AlertCircle, Info,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

type FilterKey = 'ALL' | 'UNREAD' | 'REMINDERS' | 'CONFIRMATIONS' | 'DISBURSEMENTS'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UNREAD', label: 'Unread' },
  { key: 'REMINDERS', label: 'Reminders' },
  { key: 'CONFIRMATIONS', label: 'Confirmations' },
  { key: 'DISBURSEMENTS', label: 'Disbursements' },
]

interface NotificationRow {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

function matchFilter(n: NotificationRow, filter: FilterKey): boolean {
  if (filter === 'ALL') return true
  if (filter === 'UNREAD') return !n.isRead
  if (filter === 'REMINDERS') return n.type === 'PAYMENT_REMINDER'
  if (filter === 'CONFIRMATIONS') return n.type === 'PAYMENT_CONFIRMATION'
  if (filter === 'DISBURSEMENTS') return n.type === 'DISBURSEMENT'
  return true
}

function iconFor(type: string) {
  if (type === 'PAYMENT_REMINDER') return <Clock className="h-4 w-4" />
  if (type === 'PAYMENT_CONFIRMATION') return <CheckCircle2 className="h-4 w-4" />
  if (type === 'DISBURSEMENT') return <IndianRupee className="h-4 w-4" />
  return <Info className="h-4 w-4" />
}

function tintFor(type: string, isRead: boolean) {
  if (isRead) return 'bg-muted text-muted-foreground'
  if (type === 'PAYMENT_REMINDER') return 'bg-warning/15 text-warning'
  if (type === 'PAYMENT_CONFIRMATION') return 'bg-success/15 text-success'
  if (type === 'DISBURSEMENT') return 'bg-info/15 text-info'
  return 'bg-primary/10 text-primary'
}

function fmtTimestamp(d: string) {
  const date = new Date(d)
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = React.useState<FilterKey>('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['candidate-notifications-list'],
    queryFn: () => api.get<{ items: NotificationRow[]; total: number; unreadCount: number }>('/api/candidate/notifications?pageSize=100'),
  })
  const items = data?.items ?? []
  const filtered = items.filter((n) => matchFilter(n, filter))
  const unreadCount = data?.unreadCount ?? items.filter((n) => !n.isRead).length

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post('/api/candidate/notifications', { id }),
    onSuccess: () => {
      toast.success('Marked as read')
      queryClient.invalidateQueries({ queryKey: ['candidate-notifications-list'] })
      queryClient.invalidateQueries({ queryKey: ['candidate-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['candidate-notifications-count'] })
    },
    onError: () => {
      toast.error('Could not mark as read', { description: 'Please try again.' })
    },
  })

  const onMarkRead = (id: string) => {
    markReadMutation.mutate(id)
  }

  const onMarkAllRead = async () => {
    try {
      await api.post('/api/candidate/notifications', { all: true })
    } catch {
      const unread = items.filter((n) => !n.isRead)
      let failed = 0
      for (const n of unread) {
        try { await api.post(`/api/notifications/${n.id}/read`) } catch { failed++ }
      }
      if (failed > 0) {
        toast.error('Some notifications could not be marked as read', { description: `${failed} failed — please try again.` })
        queryClient.invalidateQueries({ queryKey: ['candidate-notifications-list'] })
        return
      }
    }
    queryClient.invalidateQueries({ queryKey: ['candidate-notifications-list'] })
    queryClient.invalidateQueries({ queryKey: ['candidate-notifications'] })
    queryClient.invalidateQueries({ queryKey: ['candidate-notifications-count'] })
    toast.success('All notifications marked as read')
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Notifications"
        description={`${unreadCount} unread · ${items.length} total`}
        icon={<Bell className="h-5 w-5" />}
        action={
          <Button variant="outline" size="sm" onClick={onMarkAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="h-4 w-4" /> Mark All Read
          </Button>
        }
      />

      <FadeIn>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mr-1 flex-shrink-0">
            <Filter className="h-3.5 w-3.5" /> Filter:
          </span>
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full border transition-all flex-shrink-0 min-h-[36px]',
                  active ? 'bg-primary text-primary-foreground border-primary shadow-glow' :
                  'bg-card border-border hover:border-primary/40'
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </FadeIn>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Notifications</CardTitle>
            <CardDescription className="text-xs">Tap any notification to mark it as read</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications match this filter" description="Try a different filter or check back later." />
            ) : (
              <StaggerContainer className="space-y-2.5">
                {filtered.map((n) => (
                  <StaggerItem key={n.id}>
                    <button
                      onClick={() => !n.isRead && onMarkRead(n.id)}
                      className={cn(
                        'w-full text-left rounded-xl border bg-card p-3.5 hover:border-primary/40 hover:shadow-premium transition-all',
                        n.isRead ? 'border-border' : 'border-success/30 bg-success/5'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0', tintFor(n.type, n.isRead))}>
                          {iconFor(n.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{n.title}</p>
                            {!n.isRead ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success uppercase tracking-wider">
                                <span className="h-1.5 w-1.5 rounded-full bg-success" /> New
                              </span>
                            ) : (
                              <StatusBadge variant="PASSIVE" dot={false}>Read</StatusBadge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                          <p className="text-[11px] text-muted-foreground mt-1.5 inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {fmtTimestamp(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <div className="rounded-xl bg-info/5 border border-info/15 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-info">Stay on top of your loan</p>
            <p className="text-xs text-muted-foreground mt-1">We'll send you reminders before each due date and confirmations after every payment. You can also enable WhatsApp notifications from your agent.</p>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
