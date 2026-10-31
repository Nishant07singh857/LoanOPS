'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { BellRing, CheckCircle2, Clock3, Ban, AlertTriangle } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api-client'

interface ReminderRow {
  id: string
  candidateName: string
  candidateMobile: string
  loanNumber: string
  installmentNumber: number | null
  stage: string
  channel: string
  status: 'SENT' | 'QUEUED' | 'SKIPPED_PTP' | 'FAILED'
  message: string
  error: string | null
  createdAt: string
}

interface RemindersResponse {
  remindersEnabled: boolean
  todayCounts: Record<string, number>
  items: ReminderRow[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

function fmtWhen(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function RemindersPage() {
  const [status, setStatus] = React.useState<string>('ALL')
  const [page, setPage] = React.useState(1)

  const query = React.useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (status !== 'ALL') p.set('status', status)
    return p.toString()
  }, [page, status])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['owner-reminders', query],
    queryFn: () => api.get<RemindersResponse>(`/api/owner/reminders?${query}`),
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const counts = data?.todayCounts ?? {}

  const stats = [
    { label: 'Sent today', value: counts.SENT ?? 0, icon: <CheckCircle2 className="h-4 w-4 text-success" /> },
    { label: 'Queued for staff today', value: counts.QUEUED ?? 0, icon: <Clock3 className="h-4 w-4 text-warning" /> },
    { label: 'Skipped (active PTP) today', value: counts.SKIPPED_PTP ?? 0, icon: <Ban className="h-4 w-4 text-muted-foreground" /> },
    { label: 'Failed today', value: counts.FAILED ?? 0, icon: <AlertTriangle className="h-4 w-4 text-destructive" /> },
  ]

  return (
    <FadeIn className="space-y-6">
      <SectionHeading
        title="Auto Reminders"
        description="Due-date and overdue reminders sent to borrowers — portal notifications and WhatsApp. Queued rows are waiting on a staff member: the WhatsApp draft sits in the linked collection task."
      />

      {data && !data.remindersEnabled && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="py-4 text-sm">
            Auto reminders are <strong>disabled</strong> for this organization
            (kill switch off). The daily runner and receipt notifications will
            skip this org until it is re-enabled.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
              {s.icon}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5" /> Reminder log
            </CardTitle>
            <CardDescription>
              Every reminder the engine has claimed — one row per borrower,
              stage and channel. Nothing is re-sent once a row exists.
            </CardDescription>
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="QUEUED">Queued for staff</SelectItem>
              <SelectItem value="SKIPPED_PTP">Skipped (PTP)</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8" />}
              title="Could not load reminders"
              description="Please refresh the page and try again."
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<BellRing className="h-8 w-8" />}
              title="No reminders yet"
              description="Rows appear here after the daily reminder runner executes (scripts/send-reminders.ts)."
            />
          ) : (
            <>
              <div className="overflow-x-auto table-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Loan</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">{fmtWhen(r.createdAt)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{r.candidateName}</div>
                          <div className="text-xs text-muted-foreground">{r.candidateMobile}</div>
                        </TableCell>
                        <TableCell>
                          <div>{r.loanNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.installmentNumber ? `Installment ${r.installmentNumber}` : 'Receipt'}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatStatus(r.stage)}</TableCell>
                        <TableCell>{formatStatus(r.channel)}</TableCell>
                        <TableCell>
                          <StatusBadge variant={r.status}>{formatStatus(r.status)}</StatusBadge>
                          {r.error && (
                            <div className="mt-1 max-w-48 truncate text-xs text-destructive" title={r.error}>
                              {r.error}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-72">
                          <span className="block truncate" title={r.message}>
                            {r.message}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {total} entr{total === 1 ? 'y' : 'ies'} · Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  )
}
