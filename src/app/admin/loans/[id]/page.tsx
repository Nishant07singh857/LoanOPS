'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Landmark, Banknote, Receipt, FileText, ClipboardList, ScrollText,
  FileSignature, MessageCircle, Eye, EyeOff, Calendar, Phone, User, Wallet,
  CreditCard, AlertCircle, Building2, FilePen,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatBpsToPercent } from '@/lib/money'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

interface LoanDetail {
  id: string
  loanNumber: string
  candidateId: string
  principalAmount: string
  interestType: string
  interestRate?: number | null
  fixedInterest?: string | null
  frequency: string
  installments: number
  installmentAmount: string
  totalRepayable: string
  outstandingPrincipal: string
  outstandingInterest: string
  outstandingFees: string
  totalCollected: string
  firstDueDate: string
  finalDueDate: string
  processingFee?: string | null
  otherFees?: string | null
  status: string
  disbursedAt?: string | null
  closedAt?: string | null
  createdAt: string
  candidate: {
    id: string
    fullName: string
    mobile: string
    email?: string | null
    address?: string | null
    occupation?: string | null
    employer?: string | null
    monthlyIncome?: number | null
    bankName?: string | null
    bankAccount?: string | null
    bankIfsc?: string | null
    upiId?: string | null
    aadhaarMasked?: string | null
    panMasked?: string | null
    assignedAgent?: { id: string; name: string; phone?: string | null } | null
  }
  schedule: Array<{
    id: string
    installmentNumber: number
    dueDate: string
    openingPrincipal: string
    principalComponent: string
    interestComponent: string
    feesComponent: string
    totalDue: string
    closingPrincipal: string
    paidFees: string
    paidInterest: string
    paidPrincipal: string
    paidAmount: string
    status: string
    paidAt?: string | null
  }>
  payments: Array<{
    id: string
    paymentNumber: string
    amount: string
    method: string
    status: string
    receiptNumber?: string | null
    reference?: string | null
    allocatedPrincipal: string
    allocatedInterest: string
    allocatedFees: string
    createdAt: string
    allocatedAt?: string | null
  }>
  disbursements: Array<{
    id: string
    method: string
    amount: string
    status: string
    reference?: string | null
    notes?: string | null
    initiatedAt: string
    completedAt?: string | null
    initiatedBy?: string | null
    initiatedById?: string | null
  }>
  ptps: Array<{
    id: string
    promisedAmount: string
    promiseDate: string
    status: string
    notes?: string | null
    agent?: string | { name?: string } | null
    createdAt: string
  }>
  escalations: Array<{
    id: string
    reason: string
    status: string
    description?: string | null
    agent?: string | { name?: string } | null
    createdAt: string
  }>
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(d?: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function maskAadhaar(val?: string | null) {
  if (!val) return '—'
  const clean = val.replace(/\s|-/g, '')
  if (clean.length < 4) return 'XXXX-XXXX'
  return `XXXX-XXXX-${clean.slice(-4)}`
}

function maskPan(val?: string | null) {
  if (!val) return '—'
  const clean = val.trim().toUpperCase()
  if (clean.length >= 10) return `${clean.slice(0, 5)}****${clean.slice(-1)}`
  if (clean.length > 4) return `••••${clean.slice(-4)}`
  return '••••••••••'
}

function maskBankAccount(val?: string | null) {
  if (!val) return '—'
  const clean = val.trim()
  if (clean.length <= 4) return `••••••${clean}`
  return `••••••${clean.slice(-4)}`
}

export default function LoanDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: loan, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-loan', params.id],
    queryFn: () => api.get<LoanDetail>(`/api/owner/loans/${params.id}`),
    enabled: !!params.id,
  })

  const [agreementOpen, setAgreementOpen] = React.useState(false)
  const [agreementDoc, setAgreementDoc] = React.useState<{ name: string; version: string; body: string } | null>(null)
  const [agreementLoading, setAgreementLoading] = React.useState(false)

  const viewAgreement = async () => {
    setAgreementLoading(true)
    try {
      const res = await api.get<{ items: { id: string; name: string; version: string; body: string; isActive: boolean }[] }>('/api/owner/agreements')
      const found = res.items.find((a) => a.isActive) ?? res.items[0]
      if (!found) {
        toast.error('No agreement template exists yet', { description: 'Create one under Owner → Agreements first.' })
        return
      }
      setAgreementDoc(found)
      setAgreementOpen(true)
    } catch {
      toast.error('Could not load the agreement', { description: 'Please try again.' })
    } finally {
      setAgreementLoading(false)
    }
  }

  const [disburseOpen, setDisburseOpen] = React.useState(false)
  const [restructureOpen, setRestructureOpen] = React.useState(false)
  const [showPii, setShowPii] = React.useState(false)
  const [revealedPii, setRevealedPii] = React.useState<{
    aadhaar?: string | null
    pan?: string | null
    bankAccount?: string | null
  } | null>(null)
  const [revealingPii, setRevealingPii] = React.useState(false)

  const handleTogglePii = async () => {
    if (showPii) {
      setShowPii(false)
      return
    }
    if (revealedPii) {
      setShowPii(true)
      return
    }
    setRevealingPii(true)
    try {
      const data = await api.post<{ aadhaar: string | null; pan: string | null; bankAccount: string | null }>(
        '/api/owner/pii/reveal',
        { entityType: 'LOAN', entityId: params.id }
      )
      setRevealedPii(data)
      setShowPii(true)
      toast.success('PII revealed (audit logged)')
    } catch (err: any) {
      toast.error('Failed to reveal PII', { description: err.message })
    } finally {
      setRevealingPii(false)
    }
  }

  const disburseMutation = useMutation({
    mutationFn: (input: { method: 'ONLINE' | 'OFFLINE'; reference?: string; notes?: string }) =>
      api.post(`/api/owner/loans/${params.id}/disburse`, {
        method: input.method,
        amount: loan?.principalAmount,
        reference: input.reference,
        notes: input.notes,
      }),
    onSuccess: (data: any) => {
      const amt = Number(data?.amount ?? loan?.principalAmount ?? 0)
      toast.success('Disbursement initiated', {
        description: `${data.method} - ${formatPaiseToINR(amt)} to ${loan?.candidate.fullName}`,
      })
      queryClient.invalidateQueries({ queryKey: ['owner-loan', params.id] })
      queryClient.invalidateQueries({ queryKey: ['owner-loans'] })
      queryClient.invalidateQueries({ queryKey: ['owner-dashboard'] })
      setDisburseOpen(false)
    },
    onError: (err: any) => toast.error('Disbursement failed', { description: err.message }),
  })

  const restructureMutation = useMutation({
    mutationFn: (input: { tenureMonths: number; newFrequency: string; notes: string }) =>
      api.post(`/api/owner/loans/${params.id}/restructure`, input),
    onSuccess: () => {
      toast.success('Loan successfully restructured')
      queryClient.invalidateQueries({ queryKey: ['owner-loan', params.id] })
      queryClient.invalidateQueries({ queryKey: ['owner-loans'] })
      queryClient.invalidateQueries({ queryKey: ['owner-dashboard'] })
      setRestructureOpen(false)
    },
    onError: (err: any) => toast.error('Restructure failed', { description: err.message }),
  })

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading loan details">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/loans')} className="gap-1 min-h-[44px] sm:min-h-8">
          <ArrowLeft className="h-4 w-4" /> Back to Loans
        </Button>
        <Card className="shadow-premium"><CardContent className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </CardContent></Card>
      </div>
    )
  }

  if (isError || !loan) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/loans')} className="gap-1 min-h-[44px] sm:min-h-8">
          <ArrowLeft className="h-4 w-4" /> Back to Loans
        </Button>
        <Card className="border-destructive/40 bg-destructive/5 shadow-premium">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-destructive">Failed to load loan details</p>
              <p className="text-xs text-muted-foreground mt-0.5">The loan could not be found or there was a network error.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="min-h-[44px] sm:min-h-8">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const overdue = loan.status === 'ACTIVE'
    && loan.schedule.some((s) => s.status === 'OVERDUE' || (s.status === 'DUE' && new Date(s.dueDate) < new Date()))

  const onWhatsApp = () => {
    const nextDue = loan.schedule.find((s) => s.status !== 'PAID' && s.status !== 'UPCOMING') ?? loan.schedule.find((s) => s.status === 'UPCOMING')
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.PAYMENT_REMINDER, {
      candidateName: loan.candidate.fullName,
      loanNumber: loan.loanNumber,
      amount: (Number(loan.installmentAmount) / 100).toLocaleString('en-IN'),
      dueDate: nextDue ? fmtDate(nextDue.dueDate) : 'soon',
    })
    openWhatsApp(loan.candidate.mobile, msg)
    toast.success('WhatsApp draft opened', { description: `Press Send in WhatsApp to deliver the reminder to ${loan.candidate.fullName}.` })
  }

  const hasSensitivePii = Boolean(loan.candidate.bankAccount || loan.candidate.aadhaarMasked || loan.candidate.panMasked)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/loans')} className="gap-1 min-h-[44px] sm:min-h-8">
          <ArrowLeft className="h-4 w-4" /> Back to Loans
        </Button>
      </div>

      <SectionHeading
        title={loan.loanNumber}
        description={`${loan.candidate.fullName} · ${loan.frequency} · ${loan.installments} installments`}
        icon={<Landmark className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onWhatsApp} className="min-h-[44px] sm:min-h-8">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
            {loan.payments?.find((p) => p.receiptNumber) ? (
              <Button asChild variant="outline" size="sm" className="min-h-[44px] sm:min-h-8">
                <Link href={`/admin/receipts/${loan.payments.find((p) => p.receiptNumber)!.id}`}>
                  <Receipt className="h-4 w-4" /> Latest Receipt
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled className="min-h-[44px] sm:min-h-8">
                <Receipt className="h-4 w-4" /> No Receipts Yet
              </Button>
            )}
            {loan.status === 'PENDING_DISBURSEMENT' && (
              <Button size="sm" onClick={() => setDisburseOpen(true)} className="min-h-[44px] sm:min-h-8">
                <Banknote className="h-4 w-4" /> Disburse
              </Button>
            )}
            {loan.status === 'ACTIVE' && (
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 min-h-[44px] sm:min-h-8" onClick={() => setRestructureOpen(true)}>
                <FilePen className="h-4 w-4 mr-2" /> Change Installment Type
              </Button>
            )}
          </div>
        }
      />

      <FadeIn>
        <Card className={cn('border-l-4 shadow-premium', overdue ? 'border-l-destructive' : loan.status === 'CLOSED' ? 'border-l-muted-foreground' : 'border-l-primary')}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge variant={overdue ? 'OVERDUE' : loan.status}>{overdue ? 'Overdue' : formatStatus(loan.status)}</StatusBadge>
                <div>
                  <p className="text-xs text-muted-foreground">Outstanding principal</p>
                  <p className="text-2xl font-bold tabular-nums">{formatPaiseToINR(Number(loan.outstandingPrincipal))}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-6 sm:gap-10">
                <div><p className="text-xs text-muted-foreground">Collected</p><p className="text-base font-semibold tabular-nums">{formatPaiseToINR(Number(loan.totalCollected))}</p></div>
                <div><p className="text-xs text-muted-foreground">Next due</p><p className={cn('text-base font-semibold', overdue ? 'text-destructive' : '')}>{fmtDate(loan.schedule.find((s) => s.status !== 'PAID' && s.status !== 'UPCOMING')?.dueDate ?? null) || '—'}</p></div>
                <div className="hidden sm:block"><p className="text-xs text-muted-foreground">Disbursed</p><p className="text-base font-semibold">{fmtDate(loan.disbursedAt)}</p></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex w-full overflow-x-auto no-scrollbar h-auto justify-start">
          <TabsTrigger value="overview" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">Overview</TabsTrigger>
          <TabsTrigger value="schedule" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">Schedule</TabsTrigger>
          <TabsTrigger value="payments" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">Payments</TabsTrigger>
          <TabsTrigger value="collections" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">Collections</TabsTrigger>
          <TabsTrigger value="ptp" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">PTP</TabsTrigger>
          <TabsTrigger value="disbursement" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">Disbursement</TabsTrigger>
          <TabsTrigger value="agreement" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">Agreement</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="shadow-premium">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Candidate</CardTitle>
                {hasSensitivePii && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={revealingPii}
                    onClick={handleTogglePii}
                    aria-label={showPii ? 'Mask candidate PII' : 'Reveal candidate PII'}
                    className="h-8 px-2 text-xs text-muted-foreground"
                  >
                    {showPii ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                    {showPii ? 'Mask' : 'Reveal'}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {loan.candidate.fullName.split(' ').map(p => p[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{loan.candidate.fullName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {loan.candidate.mobile}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border text-sm">
                  <div><p className="text-xs text-muted-foreground">Agent</p><p className="truncate">{loan.candidate.assignedAgent?.name ?? '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Loan type</p><p>{loan.interestType}</p></div>
                  {loan.candidate.bankAccount && (
                    <div><p className="text-xs text-muted-foreground">Bank A/C</p><p className="font-mono text-xs">{showPii ? (revealedPii?.bankAccount ?? loan.candidate.bankAccount) : maskBankAccount(loan.candidate.bankAccount)}</p></div>
                  )}
                  {loan.candidate.panMasked && (
                    <div><p className="text-xs text-muted-foreground">PAN</p><p className="font-mono text-xs">{showPii ? (revealedPii?.pan ?? loan.candidate.panMasked) : maskPan(loan.candidate.panMasked)}</p></div>
                  )}
                  {loan.candidate.aadhaarMasked && (
                    <div className="col-span-2"><p className="text-xs text-muted-foreground">Aadhaar</p><p className="font-mono text-xs">{showPii ? (revealedPii?.aadhaar ?? maskAadhaar(loan.candidate.aadhaarMasked)) : maskAadhaar(loan.candidate.aadhaarMasked)}</p></div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-premium lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Terms Snapshot</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Term label="Principal" value={formatPaiseToINR(Number(loan.principalAmount))} />
                  <Term label="Interest" value={loan.interestType === 'PERCENTAGE' ? `${formatBpsToPercent(loan.interestRate ?? 0)} (flat)` : loan.interestType === 'FIXED' ? formatPaiseToINR(Number(loan.fixedInterest ?? 0)) : 'No interest'} />
                  <Term label="Frequency" value={loan.frequency} />
                  <Term label="Installments" value={String(loan.installments)} />
                  <Term label="Installment Amt" value={formatPaiseToINR(Number(loan.installmentAmount))} />
                  <Term label="Total Repayable" value={formatPaiseToINR(Number(loan.totalRepayable))} />
                  <Term label="Outstanding" value={formatPaiseToINR(Number(loan.outstandingPrincipal))} />
                  <Term label="Collected" value={formatPaiseToINR(Number(loan.totalCollected))} />
                  <Term label="Disbursed On" value={fmtDate(loan.disbursedAt)} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Schedule */}
        <TabsContent value="schedule">
          <Card className="shadow-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Installment Schedule</CardTitle>
              <CardDescription>{loan.schedule.length} installments · total {formatPaiseToINR(Number(loan.totalRepayable))}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="hidden md:block overflow-x-auto table-scroll w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-6">#</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead className="text-right">Interest</TableHead>
                      <TableHead className="text-right">Fees</TableHead>
                      <TableHead className="text-right">Total Due</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right pr-6">Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loan.schedule.map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell className="pl-6 font-mono font-semibold">{inst.installmentNumber}</TableCell>
                        <TableCell><span className="inline-flex items-center gap-1.5 text-sm"><Calendar className="h-3 w-3 text-muted-foreground" /> {fmtDate(inst.dueDate)}</span></TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(inst.principalComponent))}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(inst.interestComponent))}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(inst.feesComponent))}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatPaiseToINR(Number(inst.totalDue))}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatPaiseToINR(Number(inst.paidAmount))}</TableCell>
                        <TableCell><StatusBadge variant={inst.status}>{formatStatus(inst.status)}</StatusBadge></TableCell>
                        <TableCell className="text-right tabular-nums pr-6 text-muted-foreground">{formatPaiseToINR(Number(inst.closingPrincipal))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden space-y-3">
                {loan.schedule.map((inst) => (
                  <div key={inst.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-primary text-sm">#{inst.installmentNumber}</span>
                      <StatusBadge variant={inst.status}>{formatStatus(inst.status)}</StatusBadge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(inst.dueDate)}</p>
                    <p className="text-lg font-bold mt-1 tabular-nums">{formatPaiseToINR(Number(inst.totalDue))}</p>
                    <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t border-border text-xs">
                      <div><p className="text-muted-foreground">Principal</p><p className="tabular-nums">{formatPaiseToINR(Number(inst.principalComponent))}</p></div>
                      <div><p className="text-muted-foreground">Interest</p><p className="tabular-nums">{formatPaiseToINR(Number(inst.interestComponent))}</p></div>
                      <div><p className="text-muted-foreground">Balance</p><p className="tabular-nums">{formatPaiseToINR(Number(inst.closingPrincipal))}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base">Payments</CardTitle><CardDescription>Recorded payments against this loan</CardDescription></CardHeader>
            <CardContent>
              {loan.payments.length === 0 ? (
                <EmptyState icon={<Wallet className="h-6 w-6" />} title="No payments yet" description="Payments will appear here once the candidate pays or agents record cash." />
              ) : (
                <div className="overflow-x-auto table-scroll w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="pl-6">Payment #</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right pr-6">Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loan.payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="pl-6 font-mono">{p.paymentNumber}</TableCell>
                          <TableCell><span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{p.method.replace(/_/g, ' ')}</span></TableCell>
                          <TableCell className="text-sm">{fmtDate(p.createdAt)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(p.amount))}</TableCell>
                          <TableCell><StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge></TableCell>
                          <TableCell className="text-right pr-6">
                            {p.receiptNumber ? (
                              <Button asChild variant="ghost" size="sm" aria-label={`View receipt ${p.receiptNumber}`}>
                                <Link href={`/admin/receipts/${p.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Collections */}
        <TabsContent value="collections">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base">Cash Collections</CardTitle><CardDescription>Cash pickup records for this loan</CardDescription></CardHeader>
            <CardContent>
              {loan.payments.filter((p) => p.method === 'CASH').length === 0 ? (
                <EmptyState icon={<Wallet className="h-6 w-6" />} title="No cash collections recorded" description="Cash collections made by agents will appear here." />
              ) : (
                <div className="space-y-2">
                  {loan.payments.filter((p) => p.method === 'CASH').map((p) => (
                    <div key={p.id} className="rounded-xl border border-border p-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-medium">{p.receiptNumber ?? p.reference ?? p.paymentNumber}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(p.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge>
                        <span className="font-semibold tabular-nums">{formatPaiseToINR(Number(p.amount))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PTP */}
        <TabsContent value="ptp">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base">Promise-to-Pay</CardTitle><CardDescription>Commitments from the candidate</CardDescription></CardHeader>
            <CardContent>
              {loan.ptps.length === 0 ? (
                <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No PTPs recorded" />
              ) : (
                <div className="space-y-3">
                  {loan.ptps.map((p) => {
                    const agentLabel = typeof p.agent === 'string' ? p.agent : p.agent?.name ?? loan.candidate.assignedAgent?.name ?? 'Agent'
                    return (
                      <div key={p.id} className="rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge>
                            <span className="text-sm font-medium">Promise on {fmtDate(p.promiseDate)}</span>
                          </div>
                          {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                          <p className="text-xs text-muted-foreground mt-1">By {agentLabel}</p>
                        </div>
                        <p className="text-xl font-bold tabular-nums">{formatPaiseToINR(Number(p.promisedAmount))}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disbursement */}
        <TabsContent value="disbursement">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base">Disbursement Information</CardTitle><CardDescription>Records of disbursements made for this loan</CardDescription></CardHeader>
            <CardContent>
              {loan.disbursements.length === 0 ? (
                <EmptyState icon={<Banknote className="h-6 w-6" />} title="No disbursements yet" description="Click 'Disburse' to initiate a disbursement." />
              ) : (
                <div className="overflow-x-auto table-scroll w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="pl-6">Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Initiated By</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loan.disbursements.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="pl-6"><span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{d.method}</span></TableCell>
                          <TableCell className="font-mono text-xs">{d.reference ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(d.amount))}</TableCell>
                          <TableCell><StatusBadge variant={d.status}>{formatStatus(d.status)}</StatusBadge></TableCell>
                          <TableCell className="text-xs">{d.initiatedBy ?? 'Owner'}</TableCell>
                          <TableCell className="text-xs">{fmtDateTime(d.initiatedAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agreement */}
        <TabsContent value="agreement">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileSignature className="h-4 w-4" /> Agreement</CardTitle><CardDescription>Standard Personal Loan Agreement</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">
                <p className="font-semibold mb-2"># Loan Agreement</p>
                <p className="text-muted-foreground">This agreement is entered into between the Lender and <strong>{loan.candidate.fullName}</strong> ("Borrower"). The principal amount of <strong>{formatPaiseToINR(Number(loan.principalAmount))}</strong> shall be repaid in <strong>{loan.installments} {loan.frequency.toLowerCase()}</strong> installments of <strong>{formatPaiseToINR(Number(loan.installmentAmount))}</strong> each, commencing on the disbursement date.</p>
                <p className="text-muted-foreground mt-2">The complete, legally binding agreement text for this loan is the document opened by "View Full Agreement" below — this summary is only a convenience overview of the loan's own figures.</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
                {loan.disbursedAt ? (
                  <StatusBadge variant="VERIFIED">Accepted {fmtDate(loan.disbursedAt)}</StatusBadge>
                ) : (
                  <StatusBadge variant={loan.status}>{formatStatus(loan.status)}</StatusBadge>
                )}
                <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-8" onClick={viewAgreement} disabled={agreementLoading}>{agreementLoading ? 'Loading…' : 'View Full Agreement'}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={disburseOpen} onOpenChange={setDisburseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disburse Loan - {loan.loanNumber}</DialogTitle>
            <DialogDescription>Choose a channel and confirm the disbursement.</DialogDescription>
          </DialogHeader>
          <DisburseForm
            loan={loan}
            submitting={disburseMutation.isPending}
            onSubmit={(input) => disburseMutation.mutate(input)}
            onClose={() => setDisburseOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={restructureOpen} onOpenChange={setRestructureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restructure Loan - {loan.loanNumber}</DialogTitle>
            <DialogDescription>Change the EMI installment amount. This will recalculate the remaining amortization schedule.</DialogDescription>
          </DialogHeader>
          <RestructureForm
            loan={loan}
            submitting={restructureMutation.isPending}
            onSubmit={(input) => restructureMutation.mutate(input)}
            onClose={() => setRestructureOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={agreementOpen} onOpenChange={setAgreementOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{agreementDoc?.name ?? 'Agreement'}</DialogTitle>
            <DialogDescription>{agreementDoc ? `Version ${agreementDoc.version}` : ''}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-muted/40 p-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{agreementDoc?.body}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgreementOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5 break-words">{value}</p>
    </div>
  )
}

function DisburseForm({ loan, onSubmit, onClose, submitting }: {
  loan: LoanDetail
  onSubmit: (input: { method: 'ONLINE' | 'OFFLINE'; reference?: string; notes?: string }) => void
  onClose: () => void
  submitting: boolean
}) {
  const [channel, setChannel] = React.useState<'ONLINE' | 'OFFLINE'>('ONLINE')
  const [reference, setReference] = React.useState('')
  const [notes, setNotes] = React.useState('')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(['ONLINE', 'OFFLINE'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChannel(c)}
            aria-pressed={channel === c}
            className={cn(
              'rounded-xl border-2 p-4 text-left transition-all min-h-[44px]',
              channel === c ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {c === 'ONLINE' ? <Building2 className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
              <p className="text-sm font-semibold">{c === 'ONLINE' ? 'Online Transfer' : 'Offline Cash'}</p>
            </div>
            <p className="text-xs text-muted-foreground">{c === 'ONLINE' ? 'Bank/UPI transfer to candidate account' : 'Cash handed to candidate'}</p>
          </button>
        ))}
      </div>
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Principal</span><span className="font-semibold tabular-nums">{formatPaiseToINR(Number(loan.principalAmount))}</span></div>
        <div className="flex justify-between mt-1"><span className="text-muted-foreground">Channel</span><span className="font-medium">{channel === 'ONLINE' ? 'Online (waits for webhook)' : 'Offline (immediate)'}</span></div>
      </div>
      {channel === 'ONLINE' && (
        <div>
          <Label htmlFor="ref">Reference / UTR</Label>
          <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / Transaction ID" className="min-h-[44px] sm:min-h-9" />
        </div>
      )}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={3} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={submitting} className="min-h-[44px] sm:min-h-9">Cancel</Button>
        <Button onClick={() => onSubmit({ method: channel, reference, notes })} disabled={submitting} className="min-h-[44px] sm:min-h-9">
          {submitting ? 'Processing…' : 'Confirm Disbursement'}
        </Button>
      </DialogFooter>
    </div>
  )
}

function RestructureForm({ loan, onSubmit, onClose, submitting }: {
  loan: LoanDetail
  onSubmit: (input: { tenureMonths: number; newFrequency: string; notes: string }) => void
  onClose: () => void
  submitting: boolean
}) {
  const [tenureMonths, setTenureMonths] = React.useState(12)
  const [newFreq, setNewFreq] = React.useState(loan.frequency)
  const [notes, setNotes] = React.useState('')

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Current EMI</span><span className="font-semibold tabular-nums">{formatPaiseToINR(Number(loan.installmentAmount))} ({loan.frequency})</span></div>
        <div className="flex justify-between mt-1"><span className="text-muted-foreground">Outstanding</span><span className="font-semibold tabular-nums">{formatPaiseToINR(Number(loan.outstandingPrincipal))}</span></div>
      </div>
      <div>
        <Label htmlFor="tenure">Tenure (in Months)</Label>
        <Input id="tenure" type="number" value={tenureMonths} onChange={(e) => setTenureMonths(Number(e.target.value))} min={1} className="min-h-[44px] sm:min-h-9" />
        <p className="text-xs text-muted-foreground mt-1">The number of installments will be calculated based on frequency.</p>
      </div>
      <div>
        <Label htmlFor="freq">New Frequency</Label>
        <select
          id="freq"
          value={newFreq}
          onChange={(e) => setNewFreq(e.target.value)}
          className="flex min-h-[44px] sm:min-h-10 sm:h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
        </select>
      </div>
      <div>
        <Label htmlFor="rnotes">Restructure Reason / Notes</Label>
        <Textarea id="rnotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Customer requested lower EMI..." rows={3} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={submitting} className="min-h-[44px] sm:min-h-9">Cancel</Button>
        <Button onClick={() => onSubmit({ tenureMonths, newFrequency: newFreq, notes })} disabled={submitting} className="min-h-[44px] sm:min-h-9">
          {submitting ? 'Recalculating...' : 'Apply Restructure'}
        </Button>
      </DialogFooter>
    </div>
  )
}

