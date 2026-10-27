'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, FileText, Landmark, FileCheck, Wallet, AlertTriangle, ClipboardList,
  Filter, Download, Play, RefreshCw,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { escapeCsvCell } from '@/lib/csv'
import { cn } from '@/lib/utils'

// Maps UI report keys → API report type
const REPORT_TYPES = [
  { key: 'loans', label: 'Loans Report', desc: 'All loans with status breakdown', icon: Landmark, tint: 'text-success bg-success/10' },
  { key: 'applications', label: 'Applications Report', desc: 'Submitted, approved, rejected stats', icon: FileText, tint: 'text-info bg-info/10' },
  { key: 'payments', label: 'Payments Report', desc: 'Online vs cash, by method', icon: FileCheck, tint: 'text-success bg-success/10' },
  { key: 'collections', label: 'Collections Report', desc: 'Cash verification and PTP stats', icon: Wallet, tint: 'text-warning bg-warning/10' },
  { key: 'ptps', label: 'PTP Report', desc: 'Promise-to-pay fulfillment metrics', icon: ClipboardList, tint: 'text-warning bg-warning/10' },
]

interface AgentRow {
  id: string
  name: string
  zone?: string | null
}

export default function ReportsPage() {
  const [active, setActive] = React.useState<string>('loans')
  const [dateRange, setDateRange] = React.useState<string>('30d')
  const [agent, setAgent] = React.useState<string>('all')
  const [status, setStatus] = React.useState<string>('all')

  const { data: agentsData } = useQuery({
    queryKey: ['owner-agents-for-reports'],
    queryFn: () => api.get<{ items: AgentRow[] }>('/api/owner/agents'),
  })
  const agents = agentsData?.items ?? []

  // Build date range params
  const { from, to } = React.useMemo(() => {
    const now = new Date()
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    let from: Date | null = null
    if (dateRange === '7d') from = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
    else if (dateRange === '30d') from = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
    else if (dateRange === '90d') from = new Date(now.getTime() - 90 * 24 * 3600 * 1000)
    else if (dateRange === 'mtd') from = new Date(now.getFullYear(), now.getMonth(), 1)
    else if (dateRange === 'ytd') from = new Date(now.getFullYear(), 0, 1)
    return { from, to }
  }, [dateRange])

  const params = new URLSearchParams({ type: active })
  if (from) params.set('from', from.toISOString().slice(0, 10))
  if (to) params.set('to', to.toISOString().slice(0, 10))
  if (agent !== 'all') params.set('agent', agent)
  if (status !== 'all') params.set('status', status)

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['owner-report', active, from?.toISOString(), to?.toISOString(), agent, status],
    queryFn: () => api.get<any>(`/api/owner/reports?${params.toString()}`),
    enabled: ['loans', 'applications', 'payments', 'collections', 'ptps'].includes(active),
  })

  const items: any[] = data?.items ?? []

  const generate = (key: string, label: string) => {
    if (active !== key) {
      setActive(key)
    } else {
      refetch()
    }
    toast.success(`Generating ${label}...`, { description: 'Preview updated with latest filtered records.' })
  }

  const exportCsv = () => {
    if (items.length === 0) {
      toast.error('No records to export')
      return
    }
    const headers = Object.keys(items[0])
    const csvRows = [
      headers.map(escapeCsvCell).join(','),
      ...items.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(',')),
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${active}-report-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Exported ${items.length} records to CSV`)
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Reports"
        description="Generate and export operational and financial reports."
        icon={<BarChart3 className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filter sidebar */}
        <FadeIn className="lg:col-span-1">
          <Card className="shadow-premium lg:sticky lg:top-20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</CardTitle>
              <CardDescription>Refine report scope</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-full h-11 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="mtd">Month to date</SelectItem>
                    <SelectItem value="ytd">Year to date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Agent</Label>
                <Select value={agent} onValueChange={setAgent}>
                  <SelectTrigger className="w-full h-11 mt-1"><SelectValue placeholder="All agents" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All agents</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full h-11 mt-1"><SelectValue placeholder="Any status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                    <SelectItem value="PENDING_DISBURSEMENT">Pending Disbursement</SelectItem>
                    <SelectItem value="ALLOCATED">Allocated (Payments)</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted (Apps)</SelectItem>
                    <SelectItem value="APPROVED">Approved (Apps)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-11"
                onClick={() => { setDateRange('30d'); setAgent('all'); setStatus('all') }}
              >
                Reset Filters
              </Button>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Report cards + preview */}
        <div className="lg:col-span-3 space-y-6">
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {REPORT_TYPES.map((r) => {
              const Icon = r.icon
              const isActive = active === r.key
              return (
                <StaggerItem key={r.key}>
                  <Card
                    className={cn(
                      'shadow-premium cursor-pointer transition-all hover:border-primary/40 hover:shadow-glow',
                      isActive && 'border-primary ring-2 ring-primary/20'
                    )}
                    onClick={() => setActive(r.key)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', r.tint)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{r.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.desc}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isActive ? 'default' : 'outline'}
                        className="w-full mt-3 h-11"
                        onClick={(e) => { e.stopPropagation(); generate(r.key, r.label) }}
                      >
                        <Play className="h-3.5 w-3.5" /> Generate
                      </Button>
                    </CardContent>
                  </Card>
                </StaggerItem>
              )
            })}
          </StaggerContainer>

          {/* Sample preview */}
          <FadeIn>
            <Card className="shadow-premium">
              <CardHeader className="pb-2 flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{REPORT_TYPES.find((r) => r.key === active)?.label} — Preview</CardTitle>
                  <CardDescription>
                    {isLoading ? 'Loading…' : isFetching ? 'Updating…' : `${items.length} records`}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" className="h-11 px-3" disabled={items.length === 0} onClick={exportCsv}>
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : isError ? (
                  <div className="py-8 flex flex-col items-center text-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                    <div>
                      <p className="font-semibold text-sm">Failed to load report</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Please check your connection and try again.</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-11" onClick={() => refetch()}>
                      <RefreshCw className="h-4 w-4" /> Retry
                    </Button>
                  </div>
                ) : items.length === 0 ? (
                  <EmptyState icon={<FileText className="h-6 w-6" />} title="No records found" description="Adjust filters and try a different report type." />
                ) : active === 'loans' ? (
                  <div className="overflow-x-auto w-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="pl-6">Loan #</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead className="hidden md:table-cell">Agent</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">Principal</TableHead>
                          <TableHead className="text-right">Outstanding</TableHead>
                          <TableHead className="hidden lg:table-cell">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((l: any) => (
                          <TableRow key={l.id}>
                            <TableCell className="pl-6 font-mono text-xs text-primary font-semibold">{l.loanNumber}</TableCell>
                            <TableCell>{l.candidateName}</TableCell>
                            <TableCell className="text-xs hidden md:table-cell">{l.agent ?? '—'}</TableCell>
                            <TableCell className="text-right tabular-nums hidden sm:table-cell">{formatPaiseToINR(Number(l.principalAmount))}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(l.outstandingPrincipal))}</TableCell>
                            <TableCell className="hidden lg:table-cell"><StatusBadge variant={l.status}>{formatStatus(l.status)}</StatusBadge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : active === 'applications' ? (
                  <div className="overflow-x-auto w-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="pl-6">App #</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">Amount</TableHead>
                          <TableHead className="hidden md:table-cell">Purpose</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell className="pl-6 font-mono text-xs text-primary font-semibold">{a.applicationNumber}</TableCell>
                            <TableCell>{a.candidateName}</TableCell>
                            <TableCell className="text-right tabular-nums hidden sm:table-cell">{formatPaiseToINR(Number(a.principalAmount))}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate hidden md:table-cell">{a.purpose}</TableCell>
                            <TableCell><StatusBadge variant={a.status}>{formatStatus(a.status)}</StatusBadge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : active === 'payments' ? (
                  <div className="overflow-x-auto w-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="pl-6">Payment #</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead className="hidden md:table-cell">Loan</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="hidden sm:table-cell">Method</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="pl-6 font-mono text-xs text-primary font-semibold">{p.paymentNumber}</TableCell>
                            <TableCell>{p.candidateName}</TableCell>
                            <TableCell className="font-mono text-xs hidden md:table-cell">{p.loanNumber}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(p.amount))}</TableCell>
                            <TableCell className="text-xs hidden sm:table-cell">{p.method.replace('_', ' ')}</TableCell>
                            <TableCell><StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : active === 'collections' ? (
                  <div className="overflow-x-auto w-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="pl-6 hidden sm:table-cell">Loan</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead className="hidden md:table-cell">Recorded By</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell className="pl-6 font-mono text-xs hidden sm:table-cell">{c.loanNumber}</TableCell>
                            <TableCell>{c.candidateName}</TableCell>
                            <TableCell className="text-xs hidden md:table-cell">{c.recordedBy}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(c.amount))}</TableCell>
                            <TableCell><StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : active === 'ptps' ? (
                  <div className="overflow-x-auto w-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="pl-6 hidden sm:table-cell">Loan</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead className="text-right">Promised</TableHead>
                          <TableHead className="hidden md:table-cell">Promise Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="pl-6 font-mono text-xs hidden sm:table-cell">{p.loanNumber}</TableCell>
                            <TableCell>{p.candidateName}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(p.promisedAmount))}</TableCell>
                            <TableCell className="text-xs hidden md:table-cell">{new Date(p.promiseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                            <TableCell><StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}

                {data?.total !== undefined && (
                  <div className="px-4 py-3 mt-3 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-3 justify-between">
                    <span>Total records: <strong>{data.total}</strong></span>
                    {data.totalDisbursed && <span>Total Disbursed: <strong>{formatPaiseToINRShort(Number(data.totalDisbursed))}</strong></span>}
                    {data.totalOutstanding && <span>Total Outstanding: <strong>{formatPaiseToINRShort(Number(data.totalOutstanding))}</strong></span>}
                    {data.totalAmount && <span>Total Amount: <strong>{formatPaiseToINRShort(Number(data.totalAmount))}</strong></span>}
                    {data.totalPrincipal && <span>Total Principal: <strong>{formatPaiseToINRShort(Number(data.totalPrincipal))}</strong></span>}
                    {data.totalPromised && <span>Total Promised: <strong>{formatPaiseToINRShort(Number(data.totalPromised))}</strong></span>}
                  </div>
                )}
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </div>
    </div>
  )
}
