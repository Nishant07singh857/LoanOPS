'use client'

import * as React from 'react'
import {
  ScrollText, Search, Download, Filter, X, Plus, User, FileText, Banknote, Activity,
  CheckCircle2, XCircle, Clock, AlertTriangle,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { recentActivity } from '@/lib/mock-data'
import { formatPaiseToINR } from '@/lib/money'
import { cn } from '@/lib/utils'

type AuditAction = 'CREATE' | 'UPDATE' | 'APPROVE' | 'REJECT' | 'DISBURSE' | 'LOGIN' | 'VIEW' | 'EXPORT' | 'PTP' | 'PAYMENT'

interface AuditEntry {
  id: string
  timestamp: string
  actor: string
  action: AuditAction
  entityType: string
  description: string
  amount?: number
}

const actionTint: Record<AuditAction, string> = {
  CREATE: 'bg-success/15 text-success',
  UPDATE: 'bg-info/15 text-info',
  APPROVE: 'bg-success/15 text-success',
  REJECT: 'bg-destructive/15 text-destructive',
  DISBURSE: 'bg-warning/15 text-warning',
  LOGIN: 'bg-muted text-muted-foreground',
  VIEW: 'bg-muted text-muted-foreground',
  EXPORT: 'bg-info/15 text-info',
  PTP: 'bg-warning/15 text-warning',
  PAYMENT: 'bg-success/15 text-success',
}

const seedAudit: AuditEntry[] = [
  ...recentActivity.map((a, i) => ({
    id: `s${i}`,
    timestamp: a.timestamp,
    actor: a.actor,
    action: (a.type === 'APPLICATION' ? 'CREATE' : a.type === 'DISBURSEMENT' ? 'DISBURSE' : a.type === 'PAYMENT' ? 'PAYMENT' : a.type === 'PTP' ? 'PTP' : a.type === 'ESCALATION' ? 'UPDATE' : a.type === 'CASH' ? 'PAYMENT' : 'VIEW') as AuditAction,
    entityType: a.type,
    description: a.description,
    amount: a.amount,
  })),
  // Synthesize more audit entries
  { id: 'a10', timestamp: '5h ago', actor: 'Owner', action: 'LOGIN', entityType: 'SESSION', description: 'Owner logged in from web' },
  { id: 'a11', timestamp: '6h ago', actor: 'Agent: Divya Menon', action: 'PTP', entityType: 'PTP', description: 'Created PTP for ₹5,40,000 on 25 Sep', amount: 540000 },
  { id: 'a12', timestamp: '8h ago', actor: 'Owner', action: 'APPROVE', entityType: 'APPLICATION', description: 'Approved APP-2024-1018 — Karthik Iyer' },
  { id: 'a13', timestamp: '10h ago', actor: 'Owner', action: 'EXPORT', entityType: 'REPORT', description: 'Exported Reconciliation Report CSV' },
  { id: 'a14', timestamp: '12h ago', actor: 'Agent: Vikram Singh', action: 'PAYMENT', entityType: 'PAYMENT', description: 'Cash verified ₹2,850', amount: 285000 },
  { id: 'a15', timestamp: '14h ago', actor: 'Owner', action: 'REJECT', entityType: 'APPLICATION', description: 'Rejected APP-2024-1019 — insufficient income' },
  { id: 'a16', timestamp: '1 day ago', actor: 'Agent: Arjun Nair', action: 'UPDATE', entityType: 'ESCALATION', description: 'Marked escalation as resolved for LON-2024-0812' },
  { id: 'a17', timestamp: '1 day ago', actor: 'System', action: 'CREATE', entityType: 'LEDGER', description: 'Auto-posted ledger entry LED-10521', amount: 50000 },
  { id: 'a18', timestamp: '2 days ago', actor: 'Owner', action: 'CREATE', entityType: 'QR_LINK', description: 'Generated QR link a3f8d2e9' },
  { id: 'a19', timestamp: '2 days ago', actor: 'Agent: Sneha Kapoor', action: 'VIEW', entityType: 'LOAN', description: 'Viewed LON-2024-0712 schedule' },
  { id: 'a20', timestamp: '3 days ago', actor: 'Owner', action: 'DISBURSE', entityType: 'LOAN', description: 'Disbursed LON-2024-0834 ₹1,50,000', amount: 15000000 },
]

const ACTIONS: AuditAction[] = ['CREATE', 'UPDATE', 'APPROVE', 'REJECT', 'DISBURSE', 'LOGIN', 'VIEW', 'EXPORT', 'PTP', 'PAYMENT']

export default function AuditPage() {
  const [search, setSearch] = React.useState('')
  const [action, setAction] = React.useState<string>('all')
  const [actor, setActor] = React.useState<string>('all')

  const actors = Array.from(new Set(seedAudit.map((a) => a.actor)))

  const filtered = seedAudit.filter((a) => {
    if (action !== 'all' && a.action !== action) return false
    if (actor !== 'all' && a.actor !== actor) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return a.description.toLowerCase().includes(q) || a.actor.toLowerCase().includes(q) || a.entityType.toLowerCase().includes(q)
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
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {seedAudit.length} entries
        </p>
      </div>

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
                    <TableHead className="text-right pr-6">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="pl-6 text-xs text-muted-foreground whitespace-nowrap">{a.timestamp}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px] bg-muted">{a.actor.split(' ').map(p => p[0]).join('').slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{a.actor}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', actionTint[a.action])}>{a.action}</span>
                      </TableCell>
                      <TableCell className="text-xs">{a.entityType}</TableCell>
                      <TableCell className="text-sm">{a.description}</TableCell>
                      <TableCell className="text-right tabular-nums pr-6 text-xs">{a.amount ? formatPaiseToINR(a.amount) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <StaggerContainer className="md:hidden divide-y divide-border">
              {filtered.map((a) => (
                <StaggerItem key={a.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] bg-muted">{a.actor.split(' ').map(p => p[0]).join('').slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-medium">{a.actor}</p>
                          <p className="text-[11px] text-muted-foreground">{a.timestamp}</p>
                        </div>
                      </div>
                      <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', actionTint[a.action])}>{a.action}</span>
                    </div>
                    <p className="text-sm mt-2">{a.description}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      <span>{a.entityType}</span>
                      {a.amount && <><span>·</span><span className="tabular-nums">{formatPaiseToINR(a.amount)}</span></>}
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
