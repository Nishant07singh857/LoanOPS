'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wallet, Banknote, AlertTriangle, Clock, CheckCircle2, XCircle, Eye,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR } from '@/lib/money'

interface CashCollectionRow {
  id: string
  amount: string
  collectionDate: string
  collectionTime: string
  installmentNumber?: number | null
  reference?: string | null
  notes?: string | null
  status: 'RECORDED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'ALLOCATED' | 'REJECTED'
  rejectionReason?: string | null
  recordedBy: string
  verifiedBy?: string | null
  candidate: { fullName: string; mobile: string }
  loan: { loanNumber: string }
  createdAt: string
  verifiedAt?: string | null
}

interface EscalationRow {
  id: string
  reason: string
  description?: string | null
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'
  candidate: { fullName: string; mobile: string }
  loan: { loanNumber: string }
  agent: { name: string }
  createdAt: string
}

interface DashboardKPIs {
  pendingCashVerification: number
  brokenPtp: number
  ptpDueToday: number
  overdueLoans: number
}

const reasonLabel: Record<string, string> = {
  REPEATED_MISSED_PAYMENT: 'Repeated Missed Payment',
  BROKEN_PTP: 'Broken PTP',
  LONG_OVERDUE: 'Long Overdue',
  FAILED_CONTACT: 'Failed Contact',
  HIGH_OUTSTANDING: 'High Outstanding',
  OTHER: 'Other',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CollectionsPage() {
  const queryClient = useQueryClient()
  const [rejectTarget, setRejectTarget] = React.useState<CashCollectionRow | null>(null)
  const [reason, setReason] = React.useState('')

  const { data: cashData, isLoading: cashLoading } = useQuery({
    queryKey: ['owner-cash-collections'],
    queryFn: () => api.get<{ items: CashCollectionRow[]; total: number }>('/api/owner/cash-collections?pageSize=100'),
  })

  const { data: escData, isLoading: escLoading } = useQuery({
    queryKey: ['owner-escalations'],
    queryFn: () => api.get<{ items: EscalationRow[]; total: number }>('/api/owner/escalations?pageSize=100'),
  })

  const { data: kpis } = useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: () => api.get<DashboardKPIs>('/api/owner/dashboard'),
  })

  const cashCollections = cashData?.items ?? []
  const escalations = escData?.items ?? []
  const pendingCash = cashCollections.filter((c) => c.status === 'PENDING_VERIFICATION')
  const todaysCollections = cashCollections
    .filter((c) => new Date(c.collectionDate).toDateString() === new Date().toDateString())
    .reduce((s, c) => s + Number(c.amount), 0)

  const verifyMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/owner/cash-collections/${id}/verify`, { action: 'VERIFY' }),
    onSuccess: (res: any) => {
      toast.success('Cash verified', { description: `Receipt ${res.receiptNumber} generated.` })
      queryClient.invalidateQueries({ queryKey: ['owner-cash-collections'] })
      queryClient.invalidateQueries({ queryKey: ['owner-payments'] })
    },
    onError: (e: Error) => toast.error('Failed to verify', { description: e.message }),
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/api/owner/cash-collections/${rejectTarget!.id}/verify`, {
      action: 'REJECT',
      rejectionReason: reason,
    }),
    onSuccess: () => {
      toast.success('Cash rejected', { description: `${rejectTarget?.candidate.fullName}'s collection rejected.` })
      queryClient.invalidateQueries({ queryKey: ['owner-cash-collections'] })
      setRejectTarget(null); setReason('')
    },
    onError: (e: Error) => toast.error('Failed to reject', { description: e.message }),
  })

  const submitReject = () => {
    if (!rejectTarget) return
    if (!reason) { toast.error('Please provide a rejection reason'); return }
    rejectMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Collections"
        description="Track cash pickups, escalations, broken PTPs and overdue loans in one place."
        icon={<Wallet className="h-5 w-5" />}
      />

      {/* KPI strip */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StaggerItem>
          <KPICard label="Today's Collections" value={formatPaiseToINR(todaysCollections)} icon={<Banknote className="h-5 w-5" />} variant="success" spark={[100, 120, 140, 130, 160, 180, 200]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Pending Cash Verify" value={String(kpis?.pendingCashVerification ?? 0)} icon={<Clock className="h-5 w-5" />} variant="warning" spark={[5, 6, 7, 8, 9, 9, 9]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Broken PTP" value={String(kpis?.brokenPtp ?? 0)} icon={<XCircle className="h-5 w-5" />} variant="destructive" spark={[2, 3, 4, 5, 6, 6, 6]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="PTP Due Today" value={String(kpis?.ptpDueToday ?? 0)} icon={<Clock className="h-5 w-5" />} variant="info" spark={[10, 12, 13, 14, 14, 14, 14]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Overdue Loans" value={String(kpis?.overdueLoans ?? 0)} icon={<AlertTriangle className="h-5 w-5" />} variant="destructive" spark={[28, 32, 35, 38, 38, 38, 38]} />
        </StaggerItem>
      </StaggerContainer>

      {/* Cash collections */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4" /> Cash Collections</CardTitle>
                <CardDescription>{pendingCash.length} pending verification · {cashCollections.length} total</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cashLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : cashCollections.length === 0 ? (
              <EmptyState icon={<Banknote className="h-6 w-6" />} title="No cash collections" description="Cash collections recorded by agents will appear here." />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="pl-6">Reference</TableHead>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Loan</TableHead>
                        <TableHead>Recorded By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashCollections.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="pl-6 font-mono text-xs">{c.reference ?? '—'}</TableCell>
                          <TableCell className="font-medium">{c.candidate.fullName}</TableCell>
                          <TableCell className="font-mono text-xs">{c.loan.loanNumber}</TableCell>
                          <TableCell className="text-xs">{c.recordedBy}</TableCell>
                          <TableCell className="text-sm">{fmtDate(c.collectionDate)} · {c.collectionTime}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatPaiseToINR(Number(c.amount))}</TableCell>
                          <TableCell><StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge></TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.notes || '—'}</TableCell>
                          <TableCell className="text-right pr-6">
                            {c.status === 'PENDING_VERIFICATION' ? (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="outline" disabled={rejectMutation.isPending} onClick={() => { setRejectTarget(c); setReason('') }} className="h-7 px-2 text-destructive border-destructive/40 hover:bg-destructive/10">
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" disabled={verifyMutation.isPending} onClick={() => verifyMutation.mutate(c.id)} className="h-7 px-2">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <StaggerContainer className="md:hidden space-y-3">
                  {cashCollections.map((c) => (
                    <StaggerItem key={c.id}>
                      <div className="rounded-xl border border-border p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs text-muted-foreground">{c.reference ?? '—'}</p>
                            <p className="text-sm font-medium mt-0.5">{c.candidate.fullName}</p>
                            <p className="text-xs text-muted-foreground">{c.loan.loanNumber}</p>
                          </div>
                          <StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Number(c.amount))}</p></div>
                          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Collected</p><p className="text-sm">{fmtDate(c.collectionDate)} · {c.collectionTime}</p></div>
                        </div>
                        {c.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{c.notes}</p>}
                        {c.status === 'PENDING_VERIFICATION' && (
                          <div className="flex gap-2 mt-3">
                            <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/40 hover:bg-destructive/10" disabled={rejectMutation.isPending} onClick={() => { setRejectTarget(c); setReason('') }}>Reject</Button>
                            <Button size="sm" className="flex-1" disabled={verifyMutation.isPending} onClick={() => verifyMutation.mutate(c.id)}>Verify</Button>
                          </div>
                        )}
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Escalations */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Escalations</CardTitle>
            <CardDescription>{escalations.filter((e) => e.status === 'OPEN').length} open · {escalations.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            {escLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : escalations.length === 0 ? (
              <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="No escalations" description="Agent escalations will appear here." />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="pl-6">Candidate</TableHead>
                        <TableHead>Loan</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {escalations.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="pl-6 font-medium">{e.candidate.fullName}</TableCell>
                          <TableCell className="font-mono text-xs">{e.loan.loanNumber}</TableCell>
                          <TableCell className="text-xs">{e.agent.name}</TableCell>
                          <TableCell><StatusBadge variant={e.reason === 'LONG_OVERDUE' || e.reason === 'BROKEN_PTP' ? 'AI_HIGH' : 'AI_MEDIUM'}>{reasonLabel[e.reason] || e.reason}</StatusBadge></TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{e.description ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(e.createdAt)}</TableCell>
                          <TableCell><StatusBadge variant={e.status}>{formatStatus(e.status)}</StatusBadge></TableCell>
                          <TableCell className="text-right pr-6">
                            <Button variant="ghost" size="sm" onClick={() => toast.info('Opening escalation details')}>View</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <StaggerContainer className="md:hidden space-y-3">
                  {escalations.map((e) => (
                    <StaggerItem key={e.id}>
                      <div className="rounded-xl border border-border p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{e.candidate.fullName}</p>
                            <p className="font-mono text-xs text-muted-foreground">{e.loan.loanNumber}</p>
                          </div>
                          <StatusBadge variant={e.status}>{formatStatus(e.status)}</StatusBadge>
                        </div>
                        <div className="mt-2 pt-2 border-t border-border">
                          <StatusBadge variant={e.reason === 'LONG_OVERDUE' || e.reason === 'BROKEN_PTP' ? 'AI_HIGH' : 'AI_MEDIUM'}>{reasonLabel[e.reason] || e.reason}</StatusBadge>
                          <p className="text-xs text-muted-foreground mt-2">{e.description ?? '—'}</p>
                          <p className="text-[11px] text-muted-foreground mt-2">Created {fmtDate(e.createdAt)} · {e.agent.name}</p>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Cash Collection</DialogTitle>
            <DialogDescription>
              {rejectTarget ? `${rejectTarget.candidate.fullName} · ${rejectTarget.loan.loanNumber} · ${formatPaiseToINR(Number(rejectTarget.amount))}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="reason">Reason for rejection</Label>
              <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Cash not received, count mismatch, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setReason('') }}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject} disabled={rejectMutation.isPending}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
