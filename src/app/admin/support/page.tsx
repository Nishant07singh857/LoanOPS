'use client'

import * as React from 'react'
import { LifeBuoy, Search, Eye, CheckCircle2, Clock, MessageSquare, Filter, X } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { supportTickets } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

type ChipKey = 'ALL' | 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_REVIEW', label: 'In Review' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
]

// Synthesize more tickets for richer UI
const extraTickets = [
  { id: 'st3', ticketNumber: 'SUP-2024-118', category: 'KYC', subject: 'Aadhaar upload failed', status: 'OPEN' as const, createdAt: '4 hours ago' },
  { id: 'st4', ticketNumber: 'SUP-2024-117', category: 'Disbursement', subject: 'Disbursement not received', status: 'IN_REVIEW' as const, createdAt: '6 hours ago' },
  { id: 'st5', ticketNumber: 'SUP-2024-116', category: 'Schedule', subject: 'Need to change due date', status: 'RESOLVED' as const, createdAt: '2 days ago', resolution: 'Due date shifted to 25th' },
  { id: 'st6', ticketNumber: 'SUP-2024-115', category: 'Payment', subject: 'Payment success but loan shows overdue', status: 'CLOSED' as const, createdAt: '5 days ago', resolution: 'Allocation fixed and overdue removed' },
]

const allTickets = [...supportTickets, ...extraTickets]

export default function SupportPage() {
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [search, setSearch] = React.useState('')

  const filtered = allTickets.filter((t) => {
    if (chip !== 'ALL' && t.status !== chip) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return t.ticketNumber.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Support Tickets"
        description="Manage candidate support requests across repayment, KYC, disbursement, and more."
        icon={<LifeBuoy className="h-5 w-5" />}
      />

      {/* KPI strip */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Open Tickets</p><p className="text-2xl font-bold tabular-nums text-info">{allTickets.filter((t) => t.status === 'OPEN').length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">In Review</p><p className="text-2xl font-bold tabular-nums text-warning">{allTickets.filter((t) => t.status === 'IN_REVIEW').length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Resolved</p><p className="text-2xl font-bold tabular-nums text-success">{allTickets.filter((t) => t.status === 'RESOLVED').length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold tabular-nums">{allTickets.length}</p></CardContent></Card></StaggerItem>
      </StaggerContainer>

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search ticket #, subject, category..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Filter className="h-3 w-3" /> Filter:</span>
              {CHIPS.map((c) => {
                const active = chip === c.key
                return (
                  <button
                    key={c.key}
                    onClick={() => setChip(c.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-medium border transition-all',
                      active ? 'bg-primary text-primary-foreground border-primary shadow-glow' : 'bg-card hover:bg-muted border-border text-muted-foreground'
                    )}
                  >
                    {active && <X className="h-3 w-3" />}
                    {c.label}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {filtered.length === 0 ? (
        <EmptyState icon={<LifeBuoy className="h-6 w-6" />} title="No tickets match these filters" />
      ) : (
        <FadeIn>
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base">Tickets</CardTitle><CardDescription>{filtered.length} shown</CardDescription></CardHeader>
            <CardContent>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-6">Ticket #</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resolution</TableHead>
                      <TableHead className="text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="pl-6 font-mono text-xs font-semibold text-primary">{t.ticketNumber}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{t.category}</span>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{t.subject}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.createdAt}</TableCell>
                        <TableCell><StatusBadge variant={t.status}>{formatStatus(t.status)}</StatusBadge></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{t.resolution || '—'}</TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => toast.info(`Opening ${t.ticketNumber}`)}><Eye className="h-4 w-4" /></Button>
                            {(t.status === 'OPEN' || t.status === 'IN_REVIEW') && (
                              <Button size="sm" onClick={() => toast.success('Ticket resolved', { description: `${t.ticketNumber} marked RESOLVED.` })}>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <StaggerContainer className="md:hidden space-y-3">
                {filtered.map((t) => (
                  <StaggerItem key={t.id}>
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs text-primary font-semibold">{t.ticketNumber}</p>
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium mt-1">{t.category}</span>
                        </div>
                        <StatusBadge variant={t.status}>{formatStatus(t.status)}</StatusBadge>
                      </div>
                      <p className="text-sm font-medium mt-2">{t.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.createdAt}{t.resolution ? ` · ${t.resolution}` : ''}</p>
                      {(t.status === 'OPEN' || t.status === 'IN_REVIEW') && (
                        <Button size="sm" className="w-full mt-3" onClick={() => toast.success('Ticket resolved')}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                        </Button>
                      )}
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  )
}
