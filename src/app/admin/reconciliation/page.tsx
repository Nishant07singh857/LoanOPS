'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Scale, CheckCircle2, AlertTriangle, Search,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR } from '@/lib/money'
import { cn } from '@/lib/utils'

interface ReconRun {
  id: string
  runNumber: string
  periodStart: string
  periodEnd: string
  totalExpected: string
  totalCaptured: string
  totalAllocated: string
  exceptionsCount: number
  status: string
  createdAt: string
}

interface ReconException {
  id: string
  runId?: string | null
  runNumber?: string | null
  type: string
  severity: string
  description: string
  reference?: string | null
  createdAt: string
}

const typeTint: Record<string, string> = {
  DUPLICATE_PROVIDER_EVENT: 'bg-warning/15 text-warning',
  LEDGER_MISMATCH: 'bg-destructive/15 text-destructive',
  MISSING_LEDGER: 'bg-destructive/15 text-destructive',
  AMOUNT_MISMATCH: 'bg-warning/15 text-warning',
  UNMATCHED: 'bg-info/15 text-info',
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ReconciliationPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [runOpen, setRunOpen] = React.useState(false)
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')

  const { data: runsData } = useQuery({
    queryKey: ['owner-recon-runs'],
    queryFn: () => api.get<{ items: ReconRun[] }>('/api/owner/reconciliation/runs'),
  })
  const runs = runsData?.items ?? []

  const { data: exData, isLoading: exLoading } = useQuery({
    queryKey: ['owner-recon-exceptions'],
    queryFn: () => api.get<{ items: ReconException[] }>('/api/owner/reconciliation/exceptions'),
  })
  const exceptions = exData?.items ?? []
  const filteredExceptions = exceptions.filter((e) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (e.reference ?? '').toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.type.toLowerCase().includes(q)
  })

  const runMutation = useMutation({
    mutationFn: (input: { from: string; to: string }) => api.post('/api/owner/reconciliation/run', input),
    onSuccess: (data: any) => {
      toast.success('Reconciliation run completed', { description: `${data.exceptionsCount} exception(s) detected.` })
      queryClient.invalidateQueries({ queryKey: ['owner-recon-runs'] })
      queryClient.invalidateQueries({ queryKey: ['owner-recon-exceptions'] })
      setRunOpen(false)
      setFrom(''); setTo('')
    },
    onError: (err: any) => toast.error('Reconciliation failed', { description: err.message }),
  })

  const latestRun = runs[0]
  const totalExpected = Number(latestRun?.totalExpected ?? 0)
  const totalCaptured = Number(latestRun?.totalCaptured ?? 0)
  const totalDiff = totalExpected - totalCaptured
  const openExceptions = exceptions.filter((e) => !e.resolvedAt).length

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Reconciliation"
        description="Reconcile expected inflows with captured payments and surface exceptions."
        icon={<Scale className="h-5 w-5" />}
        action={
          <Button variant="outline" size="sm" onClick={() => setRunOpen(true)}>
            Run Recon Now
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <FadeIn>
          <Card className="shadow-premium border-l-4 border-l-info h-full">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4" /> Latest Run</CardTitle><CardDescription>{latestRun ? `${latestRun.runNumber} · ${fmtDate(latestRun.periodStart)} → ${fmtDate(latestRun.periodEnd)}` : 'No runs yet'}</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Expected</span>
                <span className="font-medium tabular-nums">{formatPaiseToINR(totalExpected)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Captured</span>
                <span className="font-medium tabular-nums">{formatPaiseToINR(totalCaptured)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Allocated</span>
                <span className="font-medium tabular-nums">{formatPaiseToINR(Number(latestRun?.totalAllocated ?? 0))}</span>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card className="shadow-premium border-l-4 border-l-success h-full">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Captured</CardTitle><CardDescription>Payments recorded in period</CardDescription></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{formatPaiseToINR(totalCaptured)}</p>
              <p className="text-xs text-muted-foreground mt-1">{runs.length} total reconciliation runs</p>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card className={cn('shadow-premium border-l-4 h-full', totalDiff > 0 ? 'border-l-warning' : 'border-l-destructive')}>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Exceptions</CardTitle><CardDescription>Variance & pending items</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Variance</span>
                  <span className={cn('font-semibold tabular-nums', totalDiff > 0 ? 'text-warning' : 'text-success')}>{formatPaiseToINR(Math.abs(totalDiff))}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-destructive/5 p-3">
                  <p className="text-xs text-muted-foreground">Open exceptions</p>
                  <p className="text-xl font-bold text-destructive">{openExceptions}</p>
                </div>
                <div className="rounded-xl bg-success/5 p-3">
                  <p className="text-xs text-muted-foreground">Runs total</p>
                  <p className="text-xl font-bold text-success">{runs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent Runs</CardTitle><CardDescription>{runs.length} runs</CardDescription></CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <EmptyState icon={<Scale className="h-6 w-6" />} title="No reconciliation runs yet" description="Click 'Run Recon Now' to start a new reconciliation run." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-6">Run #</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Captured</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-center">Exceptions</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-6 font-mono text-xs font-semibold">{r.runNumber}</TableCell>
                      <TableCell className="text-xs">{fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(r.totalExpected))}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(r.totalCaptured))}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(r.totalAllocated))}</TableCell>
                      <TableCell className="text-center">{r.exceptionsCount}</TableCell>
                      <TableCell><StatusBadge variant={r.status}>{formatStatus(r.status)}</StatusBadge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Exceptions</CardTitle>
                <CardDescription>{filteredExceptions.length} open reconciliation exceptions</CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search type, description..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 sm:w-64" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {exLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : filteredExceptions.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="No open exceptions" description="All reconciliation exceptions are resolved." />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="pl-6">Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExceptions.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="pl-6">
                            <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', typeTint[e.type] || 'bg-muted text-muted-foreground')}>{e.type.replace(/_/g, ' ')}</span>
                          </TableCell>
                          <TableCell><StatusBadge variant={e.severity === 'HIGH' ? 'OVERDUE' : e.severity === 'MEDIUM' ? 'PENDING' : 'ACTIVE'}>{e.severity}</StatusBadge></TableCell>
                          <TableCell className="font-mono text-xs">{e.reference ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[320px] truncate">{e.description}</TableCell>
                          <TableCell className="text-xs">{fmtDate(e.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <StaggerContainer className="md:hidden space-y-3">
                  {filteredExceptions.map((e) => (
                    <StaggerItem key={e.id}>
                      <div className="rounded-xl border border-border p-4">
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', typeTint[e.type] || 'bg-muted text-muted-foreground')}>{e.type.replace(/_/g, ' ')}</span>
                          <StatusBadge variant={e.severity === 'HIGH' ? 'OVERDUE' : e.severity === 'MEDIUM' ? 'PENDING' : 'ACTIVE'}>{e.severity}</StatusBadge>
                        </div>
                        <p className="font-mono text-xs mt-2">{e.reference ?? '—'}</p>
                        <p className="text-sm mt-1">{e.description}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{fmtDate(e.createdAt)}</p>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Reconciliation</DialogTitle>
            <DialogDescription>Select a period to reconcile expected vs captured vs allocated payments.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)}>Cancel</Button>
            <Button onClick={() => runMutation.mutate({ from, to })} disabled={runMutation.isPending || !from || !to}>
              {runMutation.isPending ? 'Running…' : 'Run Reconciliation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
