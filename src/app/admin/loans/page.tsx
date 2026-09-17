'use client'

import * as React from 'react'
import Link from 'next/link'
import { Search, Landmark, Eye, Filter, X } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { loans } from '@/lib/mock-data'
import { formatPaiseToINR } from '@/lib/money'
import { cn } from '@/lib/utils'

type ChipKey = 'ALL' | 'ACTIVE' | 'PENDING_DISBURSEMENT' | 'OVERDUE' | 'CLOSED' | 'DEFAULTED'

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'PENDING_DISBURSEMENT', label: 'Pending Disbursement' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'DEFAULTED', label: 'Defaulted' },
]

const isOverdue = (next?: string) => !!next && /OVERDUE/i.test(next)

export default function LoansPage() {
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [status, setStatus] = React.useState<string>('all')
  const [frequency, setFrequency] = React.useState<string>('all')
  const [search, setSearch] = React.useState('')

  const filtered = loans.filter((l) => {
    if (chip === 'OVERDUE' && !isOverdue(l.nextDueDate)) return false
    if (chip !== 'ALL' && chip !== 'OVERDUE' && l.status !== chip) return false
    if (status !== 'all' && l.status !== status) return false
    if (frequency !== 'all' && l.frequency !== frequency) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        l.loanNumber.toLowerCase().includes(q) ||
        l.candidateName.toLowerCase().includes(q) ||
        (l.agentName || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Loans"
        description="Manage all loans across the portfolio — active, pending disbursement, overdue, and closed."
        icon={<Landmark className="h-5 w-5" />}
        action={
          <Button asChild size="sm">
            <Link href="/admin/create-loan">New Loan</Link>
          </Button>
        }
      />

      {/* Filter bar */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search loan number, candidate, agent..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PENDING_DISBURSEMENT">Pending Disbursement</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                  <SelectItem value="DEFAULTED">Defaulted</SelectItem>
                  <SelectItem value="WRITTEN_OFF">Written Off</SelectItem>
                </SelectContent>
              </Select>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="md:w-[160px]">
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All frequencies</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Filter className="h-3 w-3" /> Quick filter:
              </span>
              {CHIPS.map((c) => {
                const active = chip === c.key
                return (
                  <button
                    key={c.key}
                    onClick={() => setChip(c.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-medium border transition-all',
                      active
                        ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                        : 'bg-card hover:bg-muted border-border text-muted-foreground'
                    )}
                  >
                    {active && <X className="h-3 w-3" />}
                    {c.label}
                  </button>
                )
              })}
              {(chip !== 'ALL' || status !== 'all' || frequency !== 'all' || search) && (
                <Button
                  variant="ghost" size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setChip('ALL'); setStatus('all'); setFrequency('all'); setSearch('') }}
                >
                  Clear all
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Results summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {loans.length} loans
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-6 w-6" />}
          title="No loans match these filters"
          description="Try adjusting your search or filters."
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="shadow-premium hidden md:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-6">Loan No.</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-center">Inst.</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Next Due</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const overdue = isOverdue(l.nextDueDate)
                  return (
                    <TableRow key={l.id} className="cursor-pointer" onClick={() => { window.location.href = `/admin/loans/${l.id}` }}>
                      <TableCell className="pl-6 font-mono font-semibold text-primary">{l.loanNumber}</TableCell>
                      <TableCell>
                        <p className="font-medium">{l.candidateName}</p>
                        <p className="text-xs text-muted-foreground">{l.mobile}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatPaiseToINR(l.principalAmount)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                          {l.frequency}
                        </span>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{l.installments}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatPaiseToINR(l.outstandingPrincipal)}</TableCell>
                      <TableCell>
                        <StatusBadge variant={overdue ? 'OVERDUE' : l.status}>{overdue ? 'Overdue' : formatStatus(l.status)}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.agentName || '—'}</TableCell>
                      <TableCell className={cn('text-xs', overdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                        {l.nextDueDate || '—'}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/loans/${l.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <StaggerContainer className="md:hidden space-y-3">
            {filtered.map((l) => {
              const overdue = isOverdue(l.nextDueDate)
              return (
                <StaggerItem key={l.id}>
                  <Link href={`/admin/loans/${l.id}`}>
                    <Card className="shadow-premium hover:border-primary/40 transition-all active:scale-[0.99]">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono font-semibold text-primary text-sm">{l.loanNumber}</p>
                            <p className="text-sm font-medium mt-0.5">{l.candidateName}</p>
                            <p className="text-xs text-muted-foreground">{l.mobile}</p>
                          </div>
                          <StatusBadge variant={overdue ? 'OVERDUE' : l.status}>{overdue ? 'Overdue' : formatStatus(l.status)}</StatusBadge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Principal</p>
                            <p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(l.principalAmount)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</p>
                            <p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(l.outstandingPrincipal)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Frequency</p>
                            <p className="text-sm">{l.frequency} · {l.installments} inst.</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next due</p>
                            <p className={cn('text-sm', overdue ? 'text-destructive font-medium' : '')}>{l.nextDueDate || '—'}</p>
                          </div>
                        </div>
                        {l.agentName && (
                          <div className="flex items-center justify-between pt-2 border-t border-border">
                            <span className="text-xs text-muted-foreground">Agent: {l.agentName}</span>
                            <span className="text-xs text-primary inline-flex items-center gap-1 font-medium">
                              View <Eye className="h-3 w-3" />
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                </StaggerItem>
              )
            })}
          </StaggerContainer>
        </>
      )}
    </div>
  )
}
