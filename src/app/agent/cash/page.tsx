'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Banknote, CheckCircle2, XCircle, Clock, Plus, ShieldCheck,
  Filter, X, AlertCircle, Receipt, Upload, Wallet,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { api, ApiRequestError } from '@/lib/api-client'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { cn } from '@/lib/utils'

type ChipKey = 'ALL' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'ALLOCATED'

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING_VERIFICATION', label: 'Pending Verification' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'ALLOCATED', label: 'Allocated' },
  { key: 'REJECTED', label: 'Rejected' },
]

interface CashRow {
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

interface CashListResponse {
  items: CashRow[]
  total: number
  unverifiedCashInHand?: string | number
}

interface CandidateRow {
  id: string
  fullName: string
  mobile: string
  activeLoanNumbers: string[]
}

function generateCashIdempotencyKey() {
  return `cash_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

async function postCashCollectionWithIdempotency(payload: Record<string, any>, idempotencyKey: string) {
  const r = await fetch('/api/agent/cash-collections', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ ...payload, idempotencyKey }),
  })
  const text = await r.text()
  let json: any = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      // ignore non-JSON
    }
  }
  if (!r.ok) {
    const rawErr = json?.error
    const message =
      rawErr && typeof rawErr === 'object'
        ? String(rawErr.message || r.statusText || 'Request failed')
        : typeof rawErr === 'string'
          ? rawErr
          : r.statusText || 'Request failed'
    throw new ApiRequestError(
      String(rawErr?.code || 'UNKNOWN'),
      message,
      r.status,
      rawErr?.details
    )
  }
  return json && typeof json === 'object' && 'data' in json ? json.data : json
}

function isToday(d: Date) {
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function fmtTime(t?: string | null) {
  if (!t) return ''
  const parsed = new Date(t)
  if (!Number.isNaN(parsed.getTime()) && t.includes('T')) {
    return parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }
  return t
}

export default function AgentCashPage() {
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [newOpen, setNewOpen] = React.useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agent-cash', chip],
    queryFn: () => api.get<CashListResponse>(
      `/api/agent/cash-collections?pageSize=100${chip !== 'ALL' ? `&status=${chip}` : ''}`
    ),
  })

  const allCash = data?.items ?? []

  const todaysCash = allCash
    .filter((c) => isToday(new Date(c.collectionDate)))
    .reduce((s, c) => s + Number(c.amount), 0)

  const pendingRows = allCash.filter(
    (c) => c.status === 'PENDING_VERIFICATION' || c.verificationStatus === 'PENDING_VERIFICATION'
  )
  const pendingCount = pendingRows.length
  const unverifiedCashInHandPaise =
    data?.unverifiedCashInHand !== undefined
      ? Number(data.unverifiedCashInHand)
      : pendingRows.reduce((s, c) => s + Number(c.amount), 0)

  const verifiedCount = allCash.filter(
    (c) =>
      (c.status === 'VERIFIED' || c.status === 'ALLOCATED') &&
      c.verificationStatus !== 'PENDING_VERIFICATION'
  ).length
  const rejectedCount = allCash.filter((c) => c.status === 'REJECTED').length

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Cash Collection"
        description="Record cash pickups from candidates — schedule updates immediately and tracks unverified cash in hand."
        icon={<Banknote className="h-5 w-5" />}
        action={
          <Button onClick={() => setNewOpen(true)} size="sm">
            <Plus className="h-4 w-4" /> Collect Cash
          </Button>
        }
      />

      {isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-destructive font-medium">Could not load cash collections. Figures below may be incomplete — this is a loading error, not empty data.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* Notice */}
      <FadeIn>
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-warning">
                <span className="font-semibold">Cash-in-Hand Tracking:</span> Collected cash immediately updates the borrower&apos;s repayment schedule and issues a digital receipt. Amounts remain in your Unverified Cash in Hand until physical handover is verified by the Owner.
              </p>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <StaggerContainer className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <StaggerItem>
          <KPICard
            label="Unverified Cash in Hand"
            value={formatPaiseToINR(unverifiedCashInHandPaise)}
            icon={<Wallet className="h-5 w-5" />}
            variant="warning"
            spark={[100, 140, 180, 200, 220, 240, 260]}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Today's Cash"
            value={formatPaiseToINRShort(todaysCash)}
            icon={<Banknote className="h-5 w-5" />}
            variant="success"
            spark={[120, 180, 220, 280, 320, 380, 420]}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Pending Verification"
            value={String(pendingCount)}
            icon={<Clock className="h-5 w-5" />}
            variant="warning"
            spark={[1, 2, 2, 2, 2, 2, 2]}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Verified"
            value={String(verifiedCount)}
            icon={<CheckCircle2 className="h-5 w-5" />}
            variant="info"
            spark={[1, 2, 3, 3, 4, 4, 5]}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Rejected"
            value={String(rejectedCount)}
            icon={<XCircle className="h-5 w-5" />}
            variant="destructive"
            spark={[0, 1, 1, 1, 1, 1, 2]}
          />
        </StaggerItem>
      </StaggerContainer>

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filter:
              </span>
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

      {isLoading ? (
        <Card className="shadow-premium"><CardContent className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent></Card>
      ) : allCash.length === 0 ? (
        <EmptyState icon={<Banknote className="h-6 w-6" />} title="No cash collections" description="Record your first cash pickup." />
      ) : (
        <FadeIn>
          <Card className="shadow-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cash Collections</CardTitle>
              <CardDescription>{allCash.length} shown · all amounts in INR</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-6">Reference</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Loan</TableHead>
                      <TableHead>Date · Time</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right pr-6">Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allCash.map((r) => {
                      const badgeStatus = r.verificationStatus ?? r.status
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="pl-6 font-mono text-xs">{r.receiptNumber ?? r.reference ?? '—'}</TableCell>
                          <TableCell className="font-medium">{r.candidate.fullName}</TableCell>
                          <TableCell className="font-mono text-xs">{r.loan.loanNumber}</TableCell>
                          <TableCell className="text-sm">{fmtDate(r.collectionDate)}{fmtTime(r.collectionTime) ? ` · ${fmtTime(r.collectionTime)}` : ''}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">{formatPaiseToINR(Number(r.amount))}</TableCell>
                          <TableCell><StatusBadge variant={badgeStatus}>{formatStatus(badgeStatus)}</StatusBadge></TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.notes || '—'}</TableCell>
                          <TableCell className="text-right pr-6">
                            <Button asChild size="sm" variant="outline" className="h-8">
                              <Link href={`/agent/receipts/${r.id}`}>
                                <Receipt className="h-3.5 w-3.5" /> Receipt
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <StaggerContainer className="md:hidden space-y-3">
                {allCash.map((r) => {
                  const badgeStatus = r.verificationStatus ?? r.status
                  return (
                    <StaggerItem key={r.id}>
                      <div className="rounded-xl border border-border p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs text-muted-foreground">{r.receiptNumber ?? r.reference ?? '—'}</p>
                            <p className="text-sm font-medium mt-0.5">{r.candidate.fullName}</p>
                            <p className="text-xs text-muted-foreground">{r.loan.loanNumber}</p>
                          </div>
                          <StatusBadge variant={badgeStatus}>{formatStatus(badgeStatus)}</StatusBadge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Number(r.amount))}</p></div>
                          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Collected</p><p className="text-sm">{fmtDate(r.collectionDate)}{fmtTime(r.collectionTime) ? ` · ${fmtTime(r.collectionTime)}` : ''}</p></div>
                        </div>
                        {r.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{r.notes}</p>}
                        <div className="mt-3 pt-3 border-t border-border flex justify-end">
                          <Button asChild size="sm" variant="outline" className="h-9">
                            <Link href={`/agent/receipts/${r.id}`}>
                              <Receipt className="h-3.5 w-3.5" /> View Receipt
                            </Link>
                          </Button>
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

      {newOpen && <NewCashDialog open={newOpen} onOpenChange={setNewOpen} />}
    </div>
  )
}

function NewCashDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data: candidatesData } = useQuery({
    queryKey: ['agent-candidates-for-cash'],
    queryFn: () => api.get<{ items: CandidateRow[] }>('/api/agent/candidates?pageSize=100'),
  })
  const candidates = candidatesData?.items ?? []

  const [candidateId, setCandidateId] = React.useState('')
  const [loanNumber, setLoanNumber] = React.useState('')
  const [loanId, setLoanId] = React.useState('')
  const [totalOutstandingPaise, setTotalOutstandingPaise] = React.useState(0)
  const [nextInstallmentDuePaise, setNextInstallmentDuePaise] = React.useState(0)
  const [nextInstallmentNumber, setNextInstallmentNumber] = React.useState<number | null>(null)
  const [loadingLoan, setLoadingLoan] = React.useState(false)
  const activeFetchCandidateRef = React.useRef<string>('')
  const [amount, setAmount] = React.useState('')
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [time, setTime] = React.useState(() => new Date().toTimeString().slice(0, 5))
  const [installment, setInstallment] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [proofBase64, setProofBase64] = React.useState<string | null>(null)
  const [receiptFileName, setReceiptFileName] = React.useState('')
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => generateCashIdempotencyKey())

  const handleAmountChange = (val: string) => {
    setAmount(val)
    setIdempotencyKey(generateCashIdempotencyKey())
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validMimeTypes.includes(file.type)) {
      toast.error('Invalid file format', { description: 'Receipt photo must be JPEG, PNG, or WEBP.' })
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large', { description: 'Receipt photo must be 5 MB or smaller.' })
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProofBase64(reader.result)
        setReceiptFileName(file.name)
      }
    }
    reader.readAsDataURL(file)
  }

  const parsedRupees = Number(amount)
  const amountPaise = !Number.isNaN(parsedRupees) && parsedRupees > 0 ? Math.round(parsedRupees * 100) : 0
  const isAmountValid =
    amountPaise > 0 && (totalOutstandingPaise === 0 || amountPaise <= totalOutstandingPaise)

  const createMutation = useMutation({
    mutationFn: () => {
      if (!loanId) throw new Error('Select a candidate with an active loan')
      if (!isAmountValid) {
        throw new Error(
          totalOutstandingPaise > 0
            ? `Amount must be between ₹1 and ${formatPaiseToINR(totalOutstandingPaise)}`
            : 'Enter a valid positive amount'
        )
      }
      return postCashCollectionWithIdempotency(
        {
          loanId,
          candidateId,
          amount: String(amountPaise),
          collectionDate: date,
          collectionTime: time,
          installmentNumber: installment ? Number(installment) : null,
          notes: notes.trim() || null,
          proofUrl: proofBase64 || null,
        },
        idempotencyKey
      )
    },
    onSuccess: (res: any) => {
      const receiptLabel = res?.receiptNumber || res?.paymentNumber || 'Issued'
      toast.success('Cash collected & receipt issued', {
        description: `Receipt ${receiptLabel} · ${res?.loanNumber ?? loanNumber} · ${candidates.find((c) => c.id === candidateId)?.fullName ?? ''} · ${formatPaiseToINR(amountPaise)}`,
      })
      const keysToInvalidate = [
        ['agent-candidate', candidateId],
        ['agent-candidates'],
        ['agent-cash'],
        ['agent-cash-collections'],
        ['agent-dashboard'],
        ['agent-tasks'],
        ['owner-dashboard'],
        ['owner-loans'],
        ['owner-payments'],
        ['owner-cash-collections'],
        ['owner-ledger'],
        ['candidate-loan'],
        ['candidate-payments'],
        ['candidate-receipts'],
        ['candidate-schedule'],
      ]
      for (const key of keysToInvalidate) {
        queryClient.invalidateQueries({ queryKey: key })
      }
      setCandidateId('')
      setLoanId('')
      setLoanNumber('')
      setTotalOutstandingPaise(0)
      setNextInstallmentDuePaise(0)
      setNextInstallmentNumber(null)
      setLoadingLoan(false)
      setAmount('')
      setInstallment('')
      setNotes('')
      setProofBase64(null)
      setReceiptFileName('')
      activeFetchCandidateRef.current = ''
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error('Failed to record cash', { description: e.message }),
  })

  const onCandidateChange = (v: string) => {
    setCandidateId(v)
    setLoanId('')
    setTotalOutstandingPaise(0)
    setNextInstallmentDuePaise(0)
    setNextInstallmentNumber(null)
    setIdempotencyKey(generateCashIdempotencyKey())
    activeFetchCandidateRef.current = v
    const c = candidates.find((c) => c.id === v)
    if (c) {
      setLoanNumber(c.activeLoanNumbers[0] ?? '')
      setLoadingLoan(true)
      api.get<any>(`/api/agent/candidates/${v}`)
        .then((res) => {
          if (activeFetchCandidateRef.current !== v) return
          const loan = res.loans?.find((l: any) => l.status === 'ACTIVE') ?? res.loans?.[0]
          if (loan) {
            setLoanId(loan.id)
            if (loan.loanNumber) setLoanNumber(loan.loanNumber)
            const scheduleRem = (loan.schedule ?? []).reduce(
              (sum: number, s: any) => sum + Math.max(0, Number(s.totalDue || 0) - Number(s.paidAmount || 0)),
              0
            )
            const rawOut =
              loan.totalOutstanding !== undefined
                ? Number(loan.totalOutstanding)
                : Number(loan.outstandingPrincipal || 0) +
                  Number(loan.outstandingInterest || 0) +
                  Number(loan.outstandingFees || 0)
            const outPaise = rawOut > 0 ? rawOut : scheduleRem
            setTotalOutstandingPaise(outPaise)

            const nextRow =
              (loan.schedule ?? []).find(
                (s: any) => s.status === 'OVERDUE' || s.status === 'DUE' || s.status === 'PARTIALLY_PAID'
              ) ??
              (loan.schedule ?? []).find((s: any) => s.status !== 'PAID') ??
              null
            const nextPaise = nextRow
              ? Math.max(0, Number(nextRow.totalDue || 0) - Number(nextRow.paidAmount || 0))
              : Number(loan.installmentAmount || 0)
            setNextInstallmentDuePaise(nextPaise)
            setNextInstallmentNumber(nextRow?.installmentNumber ?? null)
            if (nextPaise > 0) {
              setAmount(String(Math.min(nextPaise, outPaise > 0 ? outPaise : nextPaise) / 100))
            }
            if (nextRow?.installmentNumber) {
              setInstallment(String(nextRow.installmentNumber))
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (activeFetchCandidateRef.current === v) setLoadingLoan(false)
        })
    } else {
      setLoanNumber('')
      setLoadingLoan(false)
    }
  }

  const submit = () => {
    if (!candidateId || !amount || !date) {
      toast.error('Candidate, amount, and date are required')
      return
    }
    if (!isAmountValid) {
      toast.error('Invalid amount', {
        description:
          totalOutstandingPaise > 0
            ? `Amount must be between ₹1 and ${formatPaiseToINR(totalOutstandingPaise)}`
            : 'Enter a valid positive amount',
      })
      return
    }
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-success" /> Collect Cash
          </DialogTitle>
          <DialogDescription>
            Capture a cash pickup from a candidate. Schedule updates immediately and a digital receipt is issued.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Candidate</Label>
            <Select value={candidateId} onValueChange={onCandidateChange}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select candidate" /></SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.fullName} · {c.mobile}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Loan (auto-selected)</Label>
            <Input
              value={loadingLoan ? 'Resolving active loan...' : (loanNumber || '—')}
              readOnly
              className="bg-muted/30 font-mono text-base md:text-xs"
            />
          </div>

          {loanId && (totalOutstandingPaise > 0 || nextInstallmentDuePaise > 0) && (
            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Outstanding</p>
                  <p className="text-sm font-bold tabular-nums">{formatPaiseToINR(totalOutstandingPaise)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Next Installment Due {nextInstallmentNumber ? `(#${nextInstallmentNumber})` : ''}
                  </p>
                  <p className="text-sm font-bold tabular-nums text-primary">{formatPaiseToINR(nextInstallmentDuePaise)}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-border">
                <span className="text-[11px] text-muted-foreground">Quick-fill:</span>
                {nextInstallmentDuePaise > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      const fill = totalOutstandingPaise > 0 ? Math.min(nextInstallmentDuePaise, totalOutstandingPaise) : nextInstallmentDuePaise
                      handleAmountChange(String(fill / 100))
                      if (nextInstallmentNumber) setInstallment(String(nextInstallmentNumber))
                    }}
                  >
                    Next Installment
                  </Button>
                )}
                {totalOutstandingPaise > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      handleAmountChange(String(totalOutstandingPaise / 100))
                      setInstallment('')
                    }}
                  >
                    Full Outstanding
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input
                placeholder="e.g. 5000"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                type="number"
                min="1"
                max={totalOutstandingPaise > 0 ? totalOutstandingPaise / 100 : undefined}
                step="any"
              />
              {amount && !isAmountValid && totalOutstandingPaise > 0 && (
                <p className="text-[11px] text-destructive">
                  Must be between ₹1 and {formatPaiseToINR(totalOutstandingPaise)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Installment # (optional)</Label>
              <Input placeholder="e.g. 2" value={installment} onChange={(e) => setInstallment(e.target.value)} type="number" min="1" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Collection Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Collection Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Receipt Photo Upload (optional · JPEG/PNG/WEBP ≤ 5 MB)</Label>
            <label className="block rounded-xl border-2 border-dashed border-border hover:border-primary/40 p-3.5 text-center text-xs text-muted-foreground cursor-pointer transition-colors">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handlePhotoUpload}
              />
              <Upload className="h-5 w-5 mx-auto mb-1.5 opacity-50" />
              {receiptFileName ? (
                <span className="font-medium text-foreground">{receiptFileName}</span>
              ) : (
                'Tap to upload receipt photo (JPEG, PNG, WEBP up to 5 MB)'
              )}
            </label>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea placeholder="e.g. collected from shop" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="rounded-lg bg-warning/5 border border-warning/20 p-2.5 text-[11px] text-warning inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" /> Idempotency-protected · Tracks in Unverified Cash in Hand until Owner verification.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={createMutation.isPending || loadingLoan || (Boolean(candidateId) && !loanId) || !isAmountValid}
          >
            {createMutation.isPending ? 'Recording…' : 'Record Cash'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
