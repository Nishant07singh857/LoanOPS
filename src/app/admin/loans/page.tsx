'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Landmark, Eye, Filter, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { api } from '@/lib/api-client'
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

interface LoanRow {
  id: string
  loanNumber: string
  candidateName: string
  candidateMobile: string
  principalAmount: string
  frequency: string
  installments: number
  outstandingPrincipal: string
  status: string
  nextDueDate?: string | null
  overdue?: boolean
  agent?: { id: string; name: string } | null
}

function isOverdue(nextDue?: string | null, backendOverdue?: boolean) {
  if (backendOverdue) return true
  if (!nextDue) return false
  const d = new Date(nextDue)
  return d < new Date() && d.toDateString() !== new Date().toDateString()
}

function fmtDate(dateStr?: string | null) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function LoansPage() {
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [status, setStatus] = React.useState<string>('all')
  const [frequency, setFrequency] = React.useState<string>('all')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const urlStatus = new URLSearchParams(window.location.search).get('status')
    if (urlStatus) {
      const validChips: ChipKey[] = ['ALL', 'ACTIVE', 'PENDING_DISBURSEMENT', 'OVERDUE', 'CLOSED', 'DEFAULTED']
      if (validChips.includes(urlStatus as ChipKey)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChip(urlStatus as ChipKey)
      }
      if (urlStatus !== 'OVERDUE') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStatus(urlStatus)
      }
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1)
  }, [search, status, frequency, chip])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-loans', search, status, frequency, page],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '100', page: String(page) })
      if (search) params.set('search', search)
      if (status !== 'all') params.set('status', status)
      if (frequency !== 'all') params.set('frequency', frequency)
      return api.get<{ items: LoanRow[]; total: number }>(`/api/owner/loans?${params.toString()}`)
    },
  })

  const allLoans = data?.items ?? []
  const filtered = allLoans.filter((l) => {
    if (chip === 'OVERDUE' && !isOverdue(l.nextDueDate, l.overdue)) return false
    if (chip !== 'ALL' && chip !== 'OVERDUE' && l.status !== chip) return false
    return true
  })
  const router = useRouter()

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Loans"
        description="Manage all loans across the portfolio — active, pending disbursement, overdue, and closed."
        icon={<Landmark className="h-5 w-5" />}
        action={
          <Button asChild size="sm" className="gap-1.5 min-h-[44px] sm:min-h-8">
            <Link href="/admin/create-loan"><Landmark className="h-4 w-4" /> New Loan</Link>
          </Button>
        }
      />

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  aria-label="Search loans"
                  placeholder="Search loan number, candidate, agent..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 min-h-[44px] sm:min-h-9"
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full md:w-[180px] min-h-[44px] sm:min-h-9" aria-label="Filter by status">
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
                <SelectTrigger className="w-full md:w-[160px] min-h-[44px] sm:min-h-9" aria-label="Filter by frequency">
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

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1 flex-shrink-0">
                <Filter className="h-3 w-3" /> Quick filter:
              </span>
              {CHIPS.map((c) => {
                const active = chip === c.key
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setChip(c.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 min-h-[44px] sm:min-h-7 sm:h-7 rounded-full text-xs font-medium border transition-all flex-shrink-0',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card hover:bg-muted border-border text-muted-foreground'
                    )}
                  >
                    {active && c.key !== 'ALL' && <X className="h-3 w-3" />}
                    {c.label}
                  </button>
                )
              })}
              {(chip !== 'ALL' || status !== 'all' || frequency !== 'all' || search) && (
                <Button
                  variant="ghost" size="sm"
                  className="min-h-[44px] sm:min-h-7 sm:h-7 text-xs flex-shrink-0"
                  onClick={() => { setChip('ALL'); setStatus('all'); setFrequency('all'); setSearch('') }}
                >
                  Clear all
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <div className="flex items-center justify-between py-1">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? 'Loading…'
            : <>Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {allLoans.length} loans</>}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading loans">
          <Card className="shadow-premium hidden md:block"><CardContent className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent></Card>
          <div className="md:hidden space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-24" />
              </CardContent></Card>
            ))}
          </div>
        </div>
      ) : isError ? (
        <Card className="border-destructive/40 bg-destructive/5 shadow-premium">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-destructive">Failed to load loans</p>
              <p className="text-xs text-muted-foreground mt-0.5">Could not fetch loan portfolio data. Please try again.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="min-h-[44px] sm:min-h-8">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-6 w-6" />}
          title="No loans match these filters"
          description="Try adjusting your search or filters, or create a new loan."
        />
      ) : (
        <>
          <Card className="shadow-premium hidden md:block overflow-hidden">
            <div className="overflow-x-auto table-scroll w-full">
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
                  const overdue = isOverdue(l.nextDueDate, l.overdue)
                  return (
                    <TableRow key={l.id} className="cursor-pointer" onClick={() => { router.push(`/admin/loans/${l.id}`) }}>
                      <TableCell className="pl-6 font-mono font-semibold text-primary">{l.loanNumber}</TableCell>
                      <TableCell>
                        <p className="font-medium">{l.candidateName}</p>
                        <p className="text-xs text-muted-foreground">{l.candidateMobile}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(l.principalAmount))}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                          {l.frequency}
                        </span>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{l.installments}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatPaiseToINR(Number(l.outstandingPrincipal))}</TableCell>
                      <TableCell>
                        <StatusBadge variant={overdue ? 'OVERDUE' : l.status}>{overdue ? 'Overdue' : formatStatus(l.status)}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.agent?.name ?? '—'}</TableCell>
                      <TableCell className={cn('text-xs', overdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                        {fmtDate(l.nextDueDate)}
                      </TableCell>
                      <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" asChild aria-label={`View loan ${l.loanNumber}`}>
                          <Link href={`/admin/loans/${l.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </div>
          </Card>

          <StaggerContainer className="md:hidden space-y-3">
            {filtered.map((l) => {
              const overdue = isOverdue(l.nextDueDate, l.overdue)
              return (
                <StaggerItem key={l.id}>
                  <Link href={`/admin/loans/${l.id}`}>
                    <Card className="shadow-premium hover:border-primary/40 transition-all active:scale-[0.99]">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono font-semibold text-primary text-sm">{l.loanNumber}</p>
                            <p className="text-sm font-medium mt-0.5">{l.candidateName}</p>
                            <p className="text-xs text-muted-foreground">{l.candidateMobile}</p>
                          </div>
                          <StatusBadge variant={overdue ? 'OVERDUE' : l.status}>{overdue ? 'Overdue' : formatStatus(l.status)}</StatusBadge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Principal</p>
                            <p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Number(l.principalAmount))}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</p>
                            <p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Number(l.outstandingPrincipal))}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Frequency</p>
                            <p className="text-sm">{l.frequency} · {l.installments} inst.</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next due</p>
                            <p className={cn('text-sm', overdue ? 'text-destructive font-medium' : '')}>{fmtDate(l.nextDueDate)}</p>
                          </div>
                        </div>
                        {l.agent?.name && (
                          <div className="flex items-center justify-between pt-2 border-t border-border">
                            <span className="text-xs text-muted-foreground">Agent: {l.agent.name}</span>
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
          <PaginationControls page={page} pageSize={100} total={data?.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
