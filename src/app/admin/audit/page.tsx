'use client'

import * as React from 'react'
import {
  ScrollText, Search, Download, Filter, X,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId?: string | null
  description: string
  metadata?: any
  user?: { name: string; email: string } | null
  createdAt: string
}

const actionTint: Record<string, string> = {
  CREATE: 'bg-success/15 text-success',
  UPDATE: 'bg-info/15 text-info',
  APPROVE: 'bg-success/15 text-success',
  REJECT: 'bg-destructive/15 text-destructive',
  DISBURSE: 'bg-warning/15 text-warning',
  LOGIN: 'bg-muted text-muted-foreground',
  LOGOUT: 'bg-muted text-muted-foreground',
  VIEW: 'bg-muted text-muted-foreground',
  EXPORT: 'bg-info/15 text-info',
  PTP_CREATE: 'bg-warning/15 text-warning',
  PTP_UPDATE: 'bg-warning/15 text-warning',
  ALLOCATE: 'bg-success/15 text-success',
  PAYMENT: 'bg-success/15 text-success',
  SUBMIT: 'bg-info/15 text-info',
  VERIFY: 'bg-success/15 text-success',
  AGREE: 'bg-info/15 text-info',
  REFUND: 'bg-warning/15 text-warning',
  CORRECT: 'bg-warning/15 text-warning',
  REVOKE: 'bg-destructive/15 text-destructive',
  DELETE: 'bg-destructive/15 text-destructive',
  ESCALATE: 'bg-destructive/15 text-destructive',
}

const ACTIONS = [
  'CREATE', 'UPDATE', 'APPROVE', 'REJECT', 'DISBURSE', 'LOGIN', 'LOGOUT',
  'VIEW', 'EXPORT', 'PTP_CREATE', 'PTP_UPDATE', 'ALLOCATE', 'SUBMIT', 'VERIFY',
  'AGREE', 'REFUND', 'CORRECT', 'REVOKE', 'DELETE', 'ESCALATE',
]

function fmtTimestamp(d: string) {
  const date = new Date(d)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AuditPage() {
  const [search, setSearch] = React.useState('')
  const [action, setAction] = React.useState<string>('all')
  const [actor, setActor] = React.useState<string>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['owner-audit', action],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '100' })
      if (action !== 'all') params.set('action', action)
      return api.get<{ items: AuditEntry[]; total: number }>(`/api/owner/audit?${params.toString()}`)
    },
  })

  const allEntries = data?.items ?? []
  const actors = Array.from(new Set(allEntries.map((a) => a.user?.name ?? 'System')))

  const filtered = allEntries.filter((a) => {
    const actorName = a.user?.name ?? 'System'
    if (actor !== 'all' && actorName !== actor) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return a.description.toLowerCase().includes(q)
        || actorName.toLowerCase().includes(q)
        || a.entityType.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Audit Trail"
        description="Append-only log of every action across the platform. Filter by actor, action, or search text."
        icon={<ScrollText className="h-5 w-5" />}
        action={
          <Button variant="outline" size="sm" onClick={() => toast.success('Exporting audit log...', { description: 'CSV will download shortly.' })}>
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      {/* Filters */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search description, actor, entity..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="md:w-[180px]"><SelectValue placeholder="Action" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={actor} onValueChange={setActor}>
                <SelectTrigger className="md:w-[200px]"><SelectValue placeholder="Actor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actors</SelectItem>
                  {actors.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Loading…' : <>Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {allEntries.length} entries</>}
        </p>
      </div>

      {isLoading ? (
        <Card className="shadow-premium"><CardContent className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6" />}
          title="No audit entries match these filters"
          description="Try adjusting your search or filters."
        />
      ) : (
        <FadeIn>
          <Card className="shadow-premium">
            <CardContent className="p-0">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-6">Timestamp</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => {
                      const actorName = a.user?.name ?? 'System'
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="pl-6 text-xs text-muted-foreground whitespace-nowrap">{fmtTimestamp(a.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px] bg-muted">{actorName.split(' ').map(p => p[0]).join('').slice(0, 2)}</AvatarFallback>
                              </Avatar>
                              <span className="text-xs">{actorName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', actionTint[a.action] ?? 'bg-muted text-muted-foreground')}>{a.action}</span>
                          </TableCell>
                          <TableCell className="text-xs">{a.entityType}</TableCell>
                          <TableCell className="text-sm">{a.description}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <StaggerContainer className="md:hidden divide-y divide-border">
                {filtered.map((a) => {
                  const actorName = a.user?.name ?? 'System'
                  return (
                    <StaggerItem key={a.id}>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-[10px] bg-muted">{actorName.split(' ').map(p => p[0]).join('').slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-medium">{actorName}</p>
                              <p className="text-[11px] text-muted-foreground">{fmtTimestamp(a.createdAt)}</p>
                            </div>
                          </div>
                          <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', actionTint[a.action] ?? 'bg-muted text-muted-foreground')}>{a.action}</span>
                        </div>
                        <p className="text-sm mt-2">{a.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                          <span>{a.entityType}</span>
                        </div>
                      </div>
                    </StaggerItem>
                  )
                })}
              </StaggerContainer>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  )
}
