'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wallet, Banknote, AlertTriangle, Clock, CheckCircle2, XCircle, Eye,
  Receipt, Users, ShieldCheck,
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
import { PaginationControls } from '@/components/ui/pagination-controls'
import { api } from '@/lib/api-client'
import { formatPaiseToINR } from '@/lib/money'

interface CashCollectionRow {
  id: string
  amount: string
  collectionDate: string
  collectionTime: string
  installmentNumber?: number | null
  reference?: string | null
  receiptNumber?: string | null
  notes?: string | null
  status: 'RECORDED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'ALLOCATED' | 'REJECTED'
  verificationStatus?: string
  rejectionReason?: string | null
  recordedBy: string
  verifiedBy?: string | null
  candidate: { fullName: string; mobile: string }
  loan: { loanNumber: string }
  createdAt: string
  verifiedAt?: string | null
}

interface AgentCashInHandItem {
  agentId?: string
  agentName?: string
  name?: string
  pendingCount?: number
  count?: number
  unverifiedAmount?: string | number
  totalAmount?: string | number
  unverifiedCashInHand?: string | number
  amount?: string | number
}

interface CashCollectionsResponse {
  items: CashCollectionRow[]
  total: number
  agentCashInHand?: AgentCashInHandItem[]
  totalUnverifiedCash?: string | number
  totalUnverifiedCashInHand?: string | number
}

interface EscalationRow {
  id: string
  reason: string
  description?: string | null
  resolutionNotes?: string | null
  resolvedAt?: string | null
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

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(t?: string | null) {
  if (!t) return ''
  const parsed = new Date(t)
  if (!Number.isNaN(parsed.getTime()) && t.includes('T')) {
    return parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }
  return t
}

function isRowPendingVerification(c: CashCollectionRow) {
  return c.status === 'PENDING_VERIFICATION' || c.verificationStatus === 'PENDING_VERIFICATION'
}

function isRowVerifiedOrAllocated(c: CashCollectionRow) {
  return (
    c.status === 'VERIFIED' ||
    c.status === 'ALLOCATED' ||
    c.verificationStatus === 'VERIFIED' ||
    Boolean(c.receiptNumber)
  )
}

export default function CollectionsPage() {
  const queryClient = useQueryClient()
  const [verifyTarget, setVerifyTarget] = React.useState<CashCollectionRow | null>(null)
  const [rejectTarget, setRejectTarget] = React.useState<CashCollectionRow | null>(null)
  const [reason, setReason] = React.useState('')
  const [viewCollection, setViewCollection] = React.useState<CashCollectionRow | null>(null)
  const [viewEscalation, setViewEscalation] = React.useState<EscalationRow | null>(null)
  const [cashPage, setCashPage] = React.useState(1)
  const [escPage, setEscPage] = React.useState(1)

  const {
    data: cashData,
    isLoading: cashLoading,
    isError: cashError,
    refetch: refetchCash,
  } = useQuery({
    queryKey: ['owner-cash-collections', cashPage],
    queryFn: () => api.get<CashCollectionsResponse>(`/api/owner/cash-collections?pageSize=100&page=${cashPage}`),
  })

  const {
    data: escData,
    isLoading: escLoading,
    isError: escError,
    refetch: refetchEsc,
  } = useQuery({
    queryKey: ['owner-escalations', escPage],
    queryFn: () => api.get<{ items: EscalationRow[]; total: number }>(`/api/owner/escalations?pageSize=100&page=${escPage}`),
  })

  const { data: kpis } = useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: () => api.get<DashboardKPIs>('/api/owner/dashboard'),
  })

  const cashCollections = cashData?.items ?? []
  const escalations = escData?.items ?? []
  const pendingCash = cashCollections.filter((c) => isRowPendingVerification(c))
  const todaysCollections = cashCollections
    .filter((c) => new Date(c.collectionDate).toDateString() === new Date().toDateString())
    .reduce((s, c) => s + Number(c.amount), 0)

  const agentCashInHandList = (() => {
    if (cashData?.agentCashInHand && cashData.agentCashInHand.length > 0) {
      return cashData.agentCashInHand.map((item, idx) => ({
        key: item.agentId || item.agentName || item.name || String(idx),
        agentName: item.agentName ?? item.name ?? 'Field Agent',
        pendingCount: Number(item.pendingCount ?? item.count ?? 0),
        totalAmountPaise: Number(item.unverifiedAmount ?? item.totalAmount ?? item.unverifiedCashInHand ?? item.amount ?? 0),
      }))
    }
    const grouped = new Map<string, { agentName: string; pendingCount: number; totalAmountPaise: number }>()
    for (const c of pendingCash) {
      const name = c.recordedBy || 'Field Agent'
      const existing = grouped.get(name) ?? { agentName: name, pendingCount: 0, totalAmountPaise: 0 }
      existing.pendingCount += 1
      existing.totalAmountPaise += Number(c.amount || 0)
      grouped.set(name, existing)
    }
    return Array.from(grouped.entries()).map(([key, val]) => ({ key, ...val }))
  })()

  const totalAgentUnverifiedPaise =
    cashData?.totalUnverifiedCash !== undefined
      ? Number(cashData.totalUnverifiedCash)
      : cashData?.totalUnverifiedCashInHand !== undefined
        ? Number(cashData.totalUnverifiedCashInHand)
        : agentCashInHandList.reduce((sum, a) => sum + a.totalAmountPaise, 0)

  const invalidateCollectionsQueries = () => {
    const keys = [
      ['owner-cash-collections'],
      ['owner-payments'],
      ['owner-ledger'],
      ['owner-loans'],
      ['owner-dashboard'],
      ['agent-cash'],
      ['agent-cash-collections'],
      ['candidate-payments'],
      ['candidate-receipts'],
    ]
    for (const key of keys) {
      queryClient.invalidateQueries({ queryKey: key })
    }
  }

  const verifyMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/owner/cash-collections/${id}/verify`, { action: 'VERIFY' }),
    onSuccess: (res: any) => {
      toast.success('Cash verified (Cash Deposited)', {
        description: res?.receiptNumber ? `Receipt ${res.receiptNumber} confirmed.` : 'Agent cash handover verified and recorded.',
      })
      invalidateCollectionsQueries()
      setVerifyTarget(null)
    },
    onError: (e: Error) => toast.error('Failed to verify', { description: e.message }),
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/api/owner/cash-collections/${rejectTarget!.id}/verify`, {
      action: 'REJECT',
      rejectionReason: reason.trim(),
    }),
    onSuccess: () => {
      toast.success('Cash collection disputed / rejected', {
        description: `${rejectTarget?.candidate.fullName}'s collection rejected.`,
      })
      invalidateCollectionsQueries()
      setRejectTarget(null)
      setReason('')
    },
    onError: (e: Error) => toast.error('Failed to reject', { description: e.message }),
  })

  const submitReject = () => {
    if (!rejectTarget) return
    if (!reason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    rejectMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Collections"
        description="Track cash pickups, agent unverified cash in hand, escalations, broken PTPs and overdue loans in one place."
        icon={<Wallet className="h-5 w-5" />}
      />

      {/* KPI strip */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StaggerItem>
          <KPICard label="Today's Collections" value={formatPaiseToINR(todaysCollections)} icon={<Banknote className="h-5 w-5" />} variant="success" />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Pending Cash Verify" value={String(kpis?.pendingCashVerification ?? pendingCash.length)} icon={<Clock className="h-5 w-5" />} variant="warning" />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Broken PTP" value={String(kpis?.brokenPtp ?? 0)} icon={<XCircle className="h-5 w-5" />} variant="destructive" />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="PTP Due Today" value={String(kpis?.ptpDueToday ?? 0)} icon={<Clock className="h-5 w-5" />} variant="info" />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Overdue Loans" value={String(kpis?.overdueLoans ?? 0)} icon={<AlertTriangle className="h-5 w-5" />} variant="destructive" />
        </StaggerItem>
      </StaggerContainer>

      {/* Agent Unverified Cash in Hand */}
      <FadeIn>
        <Card className="shadow-premium border-warning/30 bg-gradient-to-br from-warning/5 via-card to-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-warning" /> Agent Unverified Cash in Hand
                </CardTitle>
                <CardDescription>
                  Physical cash collected by field agents awaiting Owner verification and deposit confirmation.
                </CardDescription>
              </div>
              <div className="rounded-xl bg-warning/15 border border-warning/30 px-3 py-1.5 text-right">
                <p className="text-[10px] uppercase tracking-wider text-warning font-semibold">Total Unverified Cash</p>
                <p className="text-base font-bold tabular-nums text-warning">{formatPaiseToINR(totalAgentUnverifiedPaise)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cashLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : agentCashInHandList.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                <span>All agent cash collections have been verified and deposited. Zero unverified cash in hand.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {agentCashInHandList.map((agent) => (
                  <div
                    key={agent.key}
                    className="rounded-xl border border-warning/30 bg-card p-4 flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{agent.agentName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {agent.pendingCount} pending {agent.pendingCount === 1 ? 'collection' : 'collections'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cash in Hand</p>
                      <p className="text-base font-bold tabular-nums text-warning">
                        {formatPaiseToINR(agent.totalAmountPaise)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

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
              <div className="space-y-3" role="status" aria-label="Loading cash collections">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : cashError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3" role="alert">
                <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
                <p className="text-sm font-medium text-destructive">Failed to load cash collections</p>
                <Button variant="outline" size="sm" className="h-11 px-4" onClick={() => refetchCash()}>Retry</Button>
              </div>
            ) : cashCollections.length === 0 ? (
              <EmptyState icon={<Banknote className="h-6 w-6" />} title="No cash collections" description="Cash collections recorded by agents will appear here." />
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto w-full">
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
                      {cashCollections.map((c) => {
                        const pending = isRowPendingVerification(c)
                        const hasReceipt = isRowVerifiedOrAllocated(c)
                        const badgeStatus = c.verificationStatus ?? c.status
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="pl-6 font-mono text-xs">{c.receiptNumber ?? c.reference ?? '—'}</TableCell>
                            <TableCell className="font-medium">{c.candidate.fullName}</TableCell>
                            <TableCell className="font-mono text-xs">{c.loan.loanNumber}</TableCell>
                            <TableCell className="text-xs">{c.recordedBy ?? '—'}</TableCell>
                            <TableCell className="text-sm">{fmtDate(c.collectionDate)}{fmtTime(c.collectionTime) ? ` · ${fmtTime(c.collectionTime)}` : ''}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{formatPaiseToINR(Number(c.amount))}</TableCell>
                            <TableCell><StatusBadge variant={badgeStatus}>{formatStatus(badgeStatus)}</StatusBadge></TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.notes || c.rejectionReason || '—'}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex gap-1.5 justify-end items-center">
                                {pending && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      aria-label={`Reject or dispute cash collection for ${c.candidate.fullName}`}
                                      disabled={rejectMutation.isPending}
                                      onClick={() => { setRejectTarget(c); setReason('') }}
                                      className="h-8 px-2.5 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                                    >
                                      <XCircle className="h-3.5 w-3.5" /> Reject
                                    </Button>
                                    <Button
                                      size="sm"
                                      aria-label={`Verify cash deposited for ${c.candidate.fullName}`}
                                      disabled={verifyMutation.isPending}
                                      onClick={() => setVerifyTarget(c)}
                                      className="h-8 px-2.5 text-xs"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Verify (Cash Deposited)
                                    </Button>
                                  </>
                                )}
                                {hasReceipt && (
                                  <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2.5 text-xs"
                                  >
                                    <Link href={`/admin/receipts/${c.id}`}>
                                      <Receipt className="h-3.5 w-3.5" /> View Receipt
                                    </Link>
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  aria-label={`View cash collection details for ${c.candidate.fullName}`}
                                  onClick={() => setViewCollection(c)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                <StaggerContainer className="md:hidden space-y-3">
                  {cashCollections.map((c) => {
                    const pending = isRowPendingVerification(c)
                    const hasReceipt = isRowVerifiedOrAllocated(c)
                    const badgeStatus = c.verificationStatus ?? c.status
                    return (
                      <StaggerItem key={c.id}>
                        <div className="rounded-xl border border-border p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono text-xs text-muted-foreground truncate">{c.receiptNumber ?? c.reference ?? '—'}</p>
                              <p className="text-sm font-medium mt-0.5 truncate">{c.candidate.fullName}</p>
                              <p className="text-xs text-muted-foreground truncate">{c.loan.loanNumber}</p>
                            </div>
                            <StatusBadge variant={badgeStatus}>{formatStatus(badgeStatus)}</StatusBadge>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Number(c.amount))}</p></div>
                            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Collected</p><p className="text-xs sm:text-sm">{fmtDate(c.collectionDate)}{fmtTime(c.collectionTime) ? ` · ${fmtTime(c.collectionTime)}` : ''}</p></div>
                          </div>
                          {(c.notes || c.rejectionReason) && (
                            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                              {c.rejectionReason ? `Rejected: ${c.rejectionReason}` : c.notes}
                            </p>
                          )}
                          {pending && (
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-10 text-destructive border-destructive/40 hover:bg-destructive/10"
                                disabled={rejectMutation.isPending}
                                onClick={() => { setRejectTarget(c); setReason('') }}
                              >
                                Reject / Dispute
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1 h-10"
                                disabled={verifyMutation.isPending}
                                onClick={() => setVerifyTarget(c)}
                              >
                                Verify (Cash Deposited)
                              </Button>
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            {hasReceipt && (
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="flex-1 h-10"
                              >
                                <Link href={`/admin/receipts/${c.id}`}>
                                  <Receipt className="h-4 w-4" /> View Receipt
                                </Link>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="flex-1 h-10"
                              aria-label={`View cash collection details for ${c.candidate.fullName}`}
                              onClick={() => setViewCollection(c)}
                            >
                              <Eye className="h-4 w-4" /> Details
                            </Button>
                          </div>
                        </div>
                      </StaggerItem>
                    )
                  })}
                </StaggerContainer>
                <PaginationControls page={cashPage} pageSize={100} total={cashData?.total ?? 0} onPageChange={setCashPage} />
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
              <div className="space-y-3" role="status" aria-label="Loading escalations">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : escError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3" role="alert">
                <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
                <p className="text-sm font-medium text-destructive">Failed to load escalations</p>
                <Button variant="outline" size="sm" className="h-11 px-4" onClick={() => refetchEsc()}>Retry</Button>
              </div>
            ) : escalations.length === 0 ? (
              <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="No escalations" description="Agent escalations will appear here." />
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto w-full">
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 px-3"
                              aria-label={`View escalation for ${e.candidate.fullName}`}
                              onClick={() => setViewEscalation(e)}
                            >
                              View
                            </Button>
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
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{e.candidate.fullName}</p>
                            <p className="font-mono text-xs text-muted-foreground truncate">{e.loan.loanNumber}</p>
                          </div>
                          <StatusBadge variant={e.status}>{formatStatus(e.status)}</StatusBadge>
                        </div>
                        <div className="mt-2 pt-2 border-t border-border">
                          <StatusBadge variant={e.reason === 'LONG_OVERDUE' || e.reason === 'BROKEN_PTP' ? 'AI_HIGH' : 'AI_MEDIUM'}>{reasonLabel[e.reason] || e.reason}</StatusBadge>
                          <p className="text-xs text-muted-foreground mt-2">{e.description ?? '—'}</p>
                          <p className="text-[11px] text-muted-foreground mt-2">Created {fmtDate(e.createdAt)} · {e.agent.name}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-11 mt-3"
                          aria-label={`View escalation for ${e.candidate.fullName}`}
                          onClick={() => setViewEscalation(e)}
                        >
                          <Eye className="h-4 w-4" /> View Escalation
                        </Button>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
                <PaginationControls page={escPage} pageSize={100} total={escData?.total ?? 0} onPageChange={setEscPage} />
              </>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Verify (Cash Deposited) Confirmation Dialog */}
      <Dialog open={!!verifyTarget} onOpenChange={(o) => { if (!o) setVerifyTarget(null) }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" /> Confirm Cash Deposited
            </DialogTitle>
            <DialogDescription>
              Verify that the field agent has physically handed over or deposited this cash collection.
            </DialogDescription>
          </DialogHeader>
          {verifyTarget && (
            <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Candidate</span>
                <span className="font-semibold">{verifyTarget.candidate.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loan #</span>
                <span className="font-mono">{verifyTarget.loan.loanNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collected By</span>
                <span className="font-medium">{verifyTarget.recordedBy ?? 'Field Agent'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collection Date</span>
                <span>{fmtDate(verifyTarget.collectionDate)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border font-semibold text-base">
                <span>Cash Amount</span>
                <span className="tabular-nums text-success">{formatPaiseToINR(Number(verifyTarget.amount))}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setVerifyTarget(null)}>
              Cancel
            </Button>
            <Button
              className="h-11"
              disabled={verifyMutation.isPending}
              onClick={() => verifyTarget && verifyMutation.mutate(verifyTarget.id)}
            >
              <CheckCircle2 className="h-4 w-4" />
              {verifyMutation.isPending ? 'Verifying…' : 'Verify (Cash Deposited)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject / Dispute dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setReason('') } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject / Dispute Cash Collection</DialogTitle>
            <DialogDescription>
              {rejectTarget ? `${rejectTarget.candidate.fullName} · ${rejectTarget.loan.loanNumber} · ${formatPaiseToINR(Number(rejectTarget.amount))}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="reason">Reason for rejection / dispute (required)</Label>
              <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Cash not received, count mismatch, etc." className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => { setRejectTarget(null); setReason('') }}>Cancel</Button>
            <Button variant="destructive" className="h-11" onClick={submitReject} disabled={rejectMutation.isPending || !reason.trim()}>
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject / Dispute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Cash Collection dialog */}
      <Dialog open={!!viewCollection} onOpenChange={(o) => !o && setViewCollection(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cash Collection Details</DialogTitle>
            <DialogDescription>{viewCollection?.receiptNumber ?? viewCollection?.reference ?? viewCollection?.loan.loanNumber}</DialogDescription>
          </DialogHeader>
          {viewCollection && (
            <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Candidate</span><span className="font-medium">{viewCollection.candidate.fullName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Mobile</span><span>{viewCollection.candidate.mobile}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Loan #</span><span className="font-mono">{viewCollection.loan.loanNumber}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold tabular-nums">{formatPaiseToINR(Number(viewCollection.amount))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge variant={viewCollection.verificationStatus ?? viewCollection.status}>{formatStatus(viewCollection.verificationStatus ?? viewCollection.status)}</StatusBadge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Recorded By</span><span>{viewCollection.recordedBy ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Verified By</span><span>{viewCollection.verifiedBy ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{fmtDate(viewCollection.collectionDate)} {fmtTime(viewCollection.collectionTime)}</span></div>
              {viewCollection.notes && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-xs mt-0.5">{viewCollection.notes}</p>
                </div>
              )}
              {viewCollection.rejectionReason && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-destructive font-medium">Rejection Reason</p>
                  <p className="text-xs mt-0.5">{viewCollection.rejectionReason}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setViewCollection(null)}>Close</Button>
            {viewCollection && isRowVerifiedOrAllocated(viewCollection) && (
              <Button asChild className="h-11">
                <Link href={`/admin/receipts/${viewCollection.id}`}>
                  <Receipt className="h-4 w-4" /> View Receipt
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Escalation dialog */}
      <Dialog open={!!viewEscalation} onOpenChange={(o) => !o && setViewEscalation(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escalation Details</DialogTitle>
            <DialogDescription>{viewEscalation?.loan.loanNumber} · {viewEscalation?.candidate.fullName}</DialogDescription>
          </DialogHeader>
          {viewEscalation && (
            <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Candidate</span><span className="font-medium">{viewEscalation.candidate.fullName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Mobile</span><span>{viewEscalation.candidate.mobile}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Loan #</span><span className="font-mono">{viewEscalation.loan.loanNumber}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Agent</span><span>{viewEscalation.agent.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reason</span><span>{reasonLabel[viewEscalation.reason] || viewEscalation.reason}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge variant={viewEscalation.status}>{formatStatus(viewEscalation.status)}</StatusBadge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{fmtDate(viewEscalation.createdAt)}</span></div>
              {viewEscalation.description && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-xs mt-0.5">{viewEscalation.description}</p>
                </div>
              )}
              {viewEscalation.resolutionNotes && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">Resolution Notes</p>
                  <p className="text-xs mt-0.5">{viewEscalation.resolutionNotes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setViewEscalation(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
