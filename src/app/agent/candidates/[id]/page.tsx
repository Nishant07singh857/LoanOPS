'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, User, Phone, Mail, MapPin, Building2, MessageCircle,
  Banknote, Handshake, AlertTriangle, Calendar, Clock,
  ScrollText, ChevronRight, Send, Plus, CheckCircle2, XCircle, History,
  Receipt, Upload, ShieldCheck,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { api, ApiRequestError } from '@/lib/api-client'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

interface CandidateDetail {
  id: string
  fullName: string
  mobile: string
  email?: string | null
  dob?: string | null
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
  status: string
  assignedAgent: { id: string; name: string; phone?: string | null } | null
  loans: Array<{
    id: string
    loanNumber: string
    principalAmount: string
    installmentAmount: string
    totalRepayable: string
    outstandingPrincipal: string
    outstandingInterest: string
    outstandingFees?: string
    totalOutstanding?: string
    status: string
    frequency: string
    installments: number
    firstDueDate: string
    overdueInstallmentsCount: number
    schedule: Array<{
      installmentNumber: number
      dueDate: string
      totalDue: string
      paidAmount: string
      status: string
    }>
  }>
  ptps: Array<{
    id: string
    promisedAmount: string
    promiseDate: string
    status: string
    notes?: string | null
    createdAt: string
  }>
  followUps: Array<{
    id: string
    contactDate: string
    contactMethod: string
    outcome?: string | null
    notes?: string | null
    nextFollowUp?: string | null
    loanNumber?: string | null
  }>
  escalations: Array<{
    id: string
    reason: string
    description?: string | null
    status: string
    createdAt: string
  }>
  cashCollections: Array<{
    id: string
    amount: string
    collectionDate: string
    status: string
    verificationStatus?: string
    receiptNumber?: string | null
    reference?: string | null
  }>
  kyc: any | null
  createdAt: string
}

const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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

const reasonLabel: Record<string, string> = {
  REPEATED_MISSED_PAYMENT: 'Repeated Missed Payment',
  BROKEN_PTP: 'Broken PTP',
  LONG_OVERDUE: 'Long Overdue',
  FAILED_CONTACT: 'Failed Contact',
  HIGH_OUTSTANDING: 'High Outstanding',
  OTHER: 'Other',
}

export default function AgentCandidateDetailPage() {
  const params = useParams<{ id: string }>()
  const candidateId = params.id
  const queryClient = useQueryClient()

  const [collectOpen, setCollectOpen] = React.useState(false)
  const [presetInstallment, setPresetInstallment] = React.useState<number | null>(null)
  const [presetAmountPaise, setPresetAmountPaise] = React.useState<number | null>(null)

  const { data: c, isLoading } = useQuery({
    queryKey: ['agent-candidate', candidateId],
    queryFn: () => api.get<CandidateDetail>(`/api/agent/candidates/${candidateId}`),
    enabled: !!candidateId,
  })

  const loan = c?.loans.find((l) => l.status === 'ACTIVE') ?? c?.loans[0]
  const ptps = c?.ptps ?? []
  const escs = c?.escalations ?? []
  const followUps = c?.followUps ?? []
  const cashCollections = c?.cashCollections ?? []

  const scheduleRemainingPaise = React.useMemo(() => {
    if (!loan?.schedule) return 0
    return loan.schedule.reduce(
      (sum, s) => sum + Math.max(0, Number(s.totalDue || 0) - Number(s.paidAmount || 0)),
      0
    )
  }, [loan])

  const totalOutstandingPaise = React.useMemo(() => {
    if (!loan) return 0
    const raw =
      loan.totalOutstanding !== undefined
        ? Number(loan.totalOutstanding)
        : Number(loan.outstandingPrincipal || 0) +
          Number(loan.outstandingInterest || 0) +
          Number(loan.outstandingFees || 0)
    return raw > 0 ? raw : scheduleRemainingPaise
  }, [loan, scheduleRemainingPaise])

  const nextInstallmentRow = React.useMemo(() => {
    if (!loan?.schedule) return null
    return (
      loan.schedule.find((s) => s.status === 'OVERDUE' || s.status === 'DUE' || s.status === 'PARTIALLY_PAID') ??
      loan.schedule.find((s) => s.status !== 'PAID') ??
      null
    )
  }, [loan])

  const nextInstallmentDuePaise = React.useMemo(() => {
    if (nextInstallmentRow) {
      return Math.max(0, Number(nextInstallmentRow.totalDue || 0) - Number(nextInstallmentRow.paidAmount || 0))
    }
    return Number(loan?.installmentAmount || 0)
  }, [nextInstallmentRow, loan])

  const openCollectCash = (instNum?: number | null, duePaise?: number | null) => {
    setPresetInstallment(instNum ?? nextInstallmentRow?.installmentNumber ?? null)
    setPresetAmountPaise(duePaise ?? nextInstallmentDuePaise)
    setCollectOpen(true)
  }

  const onWhatsApp = () => {
    if (!c) return
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.PAYMENT_REMINDER, {
      candidateName: c.fullName,
      loanNumber: loan?.loanNumber ?? '',
      amount: loan ? (totalOutstandingPaise / 100).toLocaleString('en-IN') : '0',
      dueDate: loan ? fmtDate(nextInstallmentRow?.dueDate ?? loan.firstDueDate) : '',
    })
    openWhatsApp(c.mobile, msg)
    toast.success('WhatsApp draft opened')
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      <div>
        <Link href="/agent/candidates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to candidates
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !c ? (
        <EmptyState
          icon={<User className="h-6 w-6" />}
          title="Candidate not found"
          description="This candidate record could not be loaded or is not assigned to you."
        />
      ) : (
        <>
          {/* Header */}
          <FadeIn>
            <Card className="shadow-premium overflow-hidden">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <Avatar className="h-16 w-16 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                        {initials(c.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h1 className="text-lg sm:text-2xl font-bold tracking-tight">{c.fullName}</h1>
                      <p className="text-xs sm:text-sm text-muted-foreground">{c.mobile}{c.email ? ` · ${c.email}` : ''}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge>
                        {c.assignedAgent && (
                          <span className="inline-flex items-center rounded-md bg-info/15 px-2 py-0.5 text-xs font-medium text-info">
                            <User className="h-3 w-3 mr-1" /> {c.assignedAgent.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {loan && totalOutstandingPaise > 0 && (
                      <Button
                        size="sm"
                        onClick={() => openCollectCash(nextInstallmentRow?.installmentNumber ?? null, nextInstallmentDuePaise)}
                        className="bg-success text-success-foreground hover:bg-success/90 shadow-sm"
                      >
                        <Banknote className="h-4 w-4" /> Collect Cash
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={onWhatsApp} className="text-info border-info/40 hover:bg-info/10">
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`tel:${c.mobile.replace(/\s/g, '')}`}>
                        <Phone className="h-4 w-4" /> Call
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Summary cards */}
          {loan && (
            <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <StaggerItem><Card className="shadow-premium"><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-xl font-bold tabular-nums">{formatPaiseToINRShort(totalOutstandingPaise)}</p>
              </CardContent></Card></StaggerItem>
              <StaggerItem><Card className="shadow-premium"><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Installment</p>
                <p className="text-xl font-bold tabular-nums">{formatPaiseToINRShort(Number(loan.installmentAmount))}</p>
              </CardContent></Card></StaggerItem>
              <StaggerItem><Card className="shadow-premium"><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Overdue Inst.</p>
                <p className="text-xl font-bold tabular-nums text-destructive">{loan.overdueInstallmentsCount}</p>
              </CardContent></Card></StaggerItem>
              <StaggerItem><Card className="shadow-premium"><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Loan #</p>
                <p className="text-sm font-mono font-semibold truncate">{loan.loanNumber}</p>
              </CardContent></Card></StaggerItem>
            </StaggerContainer>
          )}

          {/* Tabs */}
          <Tabs defaultValue="overview">
            <TabsList className="w-full overflow-x-auto no-scrollbar justify-start sm:justify-center">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="loan">Loan</TabsTrigger>
              <TabsTrigger value="ptp">PTP</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="escalations">Escalations</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card className="shadow-premium">
                <CardHeader className="pb-2"><CardTitle className="text-base">Personal Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <DetailRow icon={<User className="h-4 w-4" />} label="Name" value={c.fullName} />
                  <DetailRow icon={<Phone className="h-4 w-4" />} label="Mobile" value={c.mobile} />
                  <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={c.email ?? '—'} />
                  <DetailRow icon={<Calendar className="h-4 w-4" />} label="DOB" value={fmtDate(c.dob)} />
                  <DetailRow icon={<MapPin className="h-4 w-4" />} label="Address" value={c.address ?? '—'} />
                  <DetailRow icon={<Building2 className="h-4 w-4" />} label="Employer" value={c.employer ?? '—'} />
                  <DetailRow icon={<Banknote className="h-4 w-4" />} label="Monthly Income" value={c.monthlyIncome ? formatPaiseToINR(c.monthlyIncome) : '—'} />
                  <DetailRow icon={<ScrollText className="h-4 w-4" />} label="Aadhaar" value={c.aadhaarMasked ?? '—'} />
                  <DetailRow icon={<ScrollText className="h-4 w-4" />} label="PAN" value={c.panMasked ?? '—'} />
                  <DetailRow icon={<Building2 className="h-4 w-4" />} label="Bank Account" value={c.bankAccount ? `•••• •••• ${c.bankAccount.slice(-4)}` : '—'} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="loan" className="space-y-4">
              {!loan ? (
                <EmptyState icon={<Banknote className="h-6 w-6" />} title="No active loans" description="This candidate has no loan records." />
              ) : (
                <>
                  <Card className="shadow-premium">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <CardTitle className="text-base">{loan.loanNumber}</CardTitle>
                          <CardDescription>{loan.frequency} · {loan.installments} installments · {formatPaiseToINR(Number(loan.principalAmount))}</CardDescription>
                        </div>
                        {totalOutstandingPaise > 0 && (
                          <Button
                            size="sm"
                            onClick={() => openCollectCash(nextInstallmentRow?.installmentNumber ?? null, nextInstallmentDuePaise)}
                          >
                            <Banknote className="h-4 w-4" /> Collect Cash
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Schedule</p>
                      <div className="rounded-lg border border-border overflow-x-auto table-scroll">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40">
                              <TableHead className="pl-4">#</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead className="text-right">Total Due</TableHead>
                              <TableHead className="text-right">Paid</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right pr-4">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loan.schedule.map((s) => {
                              const remainingRowPaise = Math.max(0, Number(s.totalDue || 0) - Number(s.paidAmount || 0))
                              const canCollect = s.status !== 'PAID' && remainingRowPaise > 0 && totalOutstandingPaise > 0
                              return (
                                <TableRow key={s.installmentNumber}>
                                  <TableCell className="pl-4 font-mono text-xs">{s.installmentNumber}</TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(s.dueDate)}</TableCell>
                                  <TableCell className="text-right tabular-nums text-xs whitespace-nowrap">{formatPaiseToINR(Number(s.totalDue))}</TableCell>
                                  <TableCell className="text-right tabular-nums text-xs whitespace-nowrap">{formatPaiseToINR(Number(s.paidAmount))}</TableCell>
                                  <TableCell><StatusBadge variant={s.status}>{formatStatus(s.status)}</StatusBadge></TableCell>
                                  <TableCell className="text-right pr-4">
                                    {canCollect ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => openCollectCash(s.installmentNumber, remainingRowPaise)}
                                      >
                                        <Banknote className="h-3.5 w-3.5" /> Collect Cash
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {cashCollections.length > 0 && (
                    <Card className="shadow-premium">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Cash Collections & Receipts</CardTitle>
                        <CardDescription>{cashCollections.length} recorded cash collections</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2.5">
                        {cashCollections.map((cc) => (
                          <div key={cc.id} className="rounded-xl border border-border p-3 flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <p className="text-sm font-bold tabular-nums">{formatPaiseToINR(Number(cc.amount))}</p>
                              <p className="text-xs text-muted-foreground">{fmtDate(cc.collectionDate)}{cc.reference ? ` · ${cc.reference}` : ''}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge variant={cc.verificationStatus ?? cc.status}>
                                {formatStatus(cc.verificationStatus ?? cc.status)}
                              </StatusBadge>
                              <Button asChild size="sm" variant="outline" className="h-8">
                                <Link href={`/agent/receipts/${cc.id}`}>
                                  <Receipt className="h-3.5 w-3.5" /> Receipt
                                </Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="ptp" className="space-y-4">
              <PTPSection candidateId={c.id} loanId={loan?.id} ptps={ptps} />
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <FollowUpSection candidateId={c.id} loanId={loan?.id} followUps={followUps} />
            </TabsContent>

            <TabsContent value="escalations" className="space-y-4">
              <EscalationSection candidateId={c.id} loanId={loan?.id} escalations={escs} />
            </TabsContent>
          </Tabs>

          {loan && collectOpen && (
            <CollectCashDialog
              open={collectOpen}
              onOpenChange={setCollectOpen}
              candidateId={c.id}
              candidateName={c.fullName}
              loanId={loan.id}
              loanNumber={loan.loanNumber}
              totalOutstandingPaise={totalOutstandingPaise}
              nextInstallmentDuePaise={nextInstallmentDuePaise}
              nextInstallmentNumber={nextInstallmentRow?.installmentNumber ?? null}
              presetInstallment={presetInstallment}
              presetAmountPaise={presetAmountPaise}
            />
          )}
        </>
      )}
    </div>
  )
}

function CollectCashDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  loanId,
  loanNumber,
  totalOutstandingPaise,
  nextInstallmentDuePaise,
  nextInstallmentNumber,
  presetInstallment,
  presetAmountPaise,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  candidateId: string
  candidateName: string
  loanId: string
  loanNumber: string
  totalOutstandingPaise: number
  nextInstallmentDuePaise: number
  nextInstallmentNumber: number | null
  presetInstallment: number | null
  presetAmountPaise: number | null
}) {
  const queryClient = useQueryClient()
  const [amountRupees, setAmountRupees] = React.useState(() => {
    const initialPaise =
      presetAmountPaise && presetAmountPaise > 0
        ? Math.min(presetAmountPaise, totalOutstandingPaise)
        : Math.min(nextInstallmentDuePaise, totalOutstandingPaise)
    return initialPaise > 0 ? String(initialPaise / 100) : ''
  })
  const [collectionDate, setCollectionDate] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [installmentNumber, setInstallmentNumber] = React.useState<number | null>(
    () => presetInstallment ?? nextInstallmentNumber
  )
  const [notes, setNotes] = React.useState('')
  const [proofBase64, setProofBase64] = React.useState<string | null>(null)
  const [proofFileName, setProofFileName] = React.useState('')
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => generateCashIdempotencyKey())

  const handleAmountChange = (val: string) => {
    setAmountRupees(val)
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
        setProofFileName(file.name)
      }
    }
    reader.readAsDataURL(file)
  }

  const parsedRupees = Number(amountRupees)
  const amountPaise = !Number.isNaN(parsedRupees) && parsedRupees > 0 ? Math.round(parsedRupees * 100) : 0
  const isAmountValid = amountPaise > 0 && amountPaise <= totalOutstandingPaise

  const collectMutation = useMutation({
    mutationFn: () => {
      if (!isAmountValid) {
        throw new Error(`Amount must be between ₹1 and ${formatPaiseToINR(totalOutstandingPaise)}`)
      }
      return postCashCollectionWithIdempotency(
        {
          loanId,
          candidateId,
          amount: String(amountPaise),
          collectionDate,
          installmentNumber,
          notes: notes.trim() || null,
          proofUrl: proofBase64 || null,
        },
        idempotencyKey
      )
    },
    onSuccess: (res: any) => {
      const receiptLabel = res?.receiptNumber || res?.paymentNumber || 'Issued'
      toast.success('Cash collected & receipt issued', {
        description: `Receipt ${receiptLabel} · ${formatPaiseToINR(amountPaise)} for ${candidateName} (${loanNumber})`,
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
      onOpenChange(false)
    },
    onError: (e: Error) => {
      toast.error('Failed to record cash collection', { description: e.message })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-success" /> Collect Cash
          </DialogTitle>
          <DialogDescription>
            Record cash repayment from borrower. Schedule updates immediately and a digital receipt is issued.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Candidate & Loan summary */}
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Candidate</span>
              <span className="font-semibold">{candidateName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Loan Number</span>
              <span className="font-mono text-xs font-semibold">{loanNumber}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
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
          </div>

          {/* Quick-fill buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Quick-fill:</span>
            {nextInstallmentDuePaise > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => {
                  const fillPaise = Math.min(nextInstallmentDuePaise, totalOutstandingPaise)
                  handleAmountChange(String(fillPaise / 100))
                  if (nextInstallmentNumber) setInstallmentNumber(nextInstallmentNumber)
                }}
              >
                Next Installment ({formatPaiseToINR(Math.min(nextInstallmentDuePaise, totalOutstandingPaise))})
              </Button>
            )}
            {totalOutstandingPaise > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => {
                  handleAmountChange(String(totalOutstandingPaise / 100))
                  setInstallmentNumber(null)
                }}
              >
                Full Outstanding ({formatPaiseToINR(totalOutstandingPaise)})
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="collect-amount">Amount Collected (₹)</Label>
              <Input
                id="collect-amount"
                type="number"
                min="1"
                max={totalOutstandingPaise / 100}
                step="any"
                placeholder="Enter amount in ₹"
                value={amountRupees}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
              {amountRupees && !isAmountValid && (
                <p className="text-[11px] text-destructive">
                  Enter an amount between ₹1 and {formatPaiseToINR(totalOutstandingPaise)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="collect-date">Collection Date</Label>
              <Input
                id="collect-date"
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="collect-notes">Note (optional)</Label>
            <Textarea
              id="collect-notes"
              rows={2}
              placeholder="e.g. Collected cash at candidate's shop"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Receipt Photo Upload (optional · JPEG/PNG/WEBP ≤ 5 MB)</Label>
            <label className="block rounded-xl border-2 border-dashed border-border hover:border-primary/40 p-3 text-center text-xs text-muted-foreground cursor-pointer transition-colors">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handlePhotoUpload}
              />
              <Upload className="h-5 w-5 mx-auto mb-1 opacity-60" />
              {proofFileName ? (
                <span className="font-medium text-foreground">{proofFileName}</span>
              ) : (
                'Tap to upload receipt photo (JPEG, PNG, WEBP up to 5 MB)'
              )}
            </label>
          </div>

          <div className="rounded-lg bg-info/10 border border-info/20 p-2.5 text-[11px] text-info flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            <span>Idempotency-protected · Schedule updates immediately &amp; tracks Cash-in-Hand until Owner verification.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => collectMutation.mutate()}
            disabled={collectMutation.isPending || !isAmountValid || !collectionDate}
          >
            <Banknote className="h-4 w-4" />
            {collectMutation.isPending ? 'Recording…' : 'Confirm Cash Collection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

function PTPSection({ candidateId, loanId, ptps }: {
  candidateId: string
  loanId?: string
  ptps: CandidateDetail['ptps']
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [amount, setAmount] = React.useState('')
  const [promiseDate, setPromiseDate] = React.useState('')
  const [notes, setNotes] = React.useState('')

  const createMutation = useMutation({
    mutationFn: () => {
      if (!loanId) throw new Error('No active loan for this candidate')
      return api.post('/api/agent/ptp', {
        candidateId,
        loanId,
        // The form collects RUPEES; the API stores PAISE. Convert here —
        // sending the raw rupee value stored promises 100x too small.
        promisedAmount: String(Math.round(Number(amount) * 100)),
        promiseDate,
        notes,
      })
    },
    onSuccess: () => {
      toast.success('PTP created', { description: `Promise for ${formatPaiseToINR(Number(amount) * 100)}` })
      queryClient.invalidateQueries({ queryKey: ['agent-candidate', candidateId] })
      queryClient.invalidateQueries({ queryKey: ['agent-ptp'] })
      queryClient.invalidateQueries({ queryKey: ['agent-dashboard'] })
      setOpen(false); setAmount(''); setPromiseDate(''); setNotes('')
    },
    onError: (e: Error) => toast.error('Failed to create PTP', { description: e.message }),
  })

  const fulfillMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/agent/ptp/${id}/fulfill`),
    onSuccess: () => {
      toast.success('PTP fulfilled')
      queryClient.invalidateQueries({ queryKey: ['agent-candidate', candidateId] })
      queryClient.invalidateQueries({ queryKey: ['agent-ptp'] })
    },
    onError: (e: Error) => toast.error('Failed', { description: e.message }),
  })

  const breakMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/agent/ptp/${id}/break`),
    onSuccess: () => {
      toast.success('PTP marked broken')
      queryClient.invalidateQueries({ queryKey: ['agent-candidate', candidateId] })
      queryClient.invalidateQueries({ queryKey: ['agent-ptp'] })
    },
    onError: (e: Error) => toast.error('Failed', { description: e.message }),
  })

  return (
    <Card className="shadow-premium">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Handshake className="h-4 w-4" /> Promise to Pay</CardTitle>
            <CardDescription className="text-xs">{ptps.length} total</CardDescription>
          </div>
          <Button size="sm" onClick={() => setOpen(true)} disabled={!loanId}>
            <Plus className="h-4 w-4" /> New PTP
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {ptps.length === 0 ? (
          <EmptyState icon={<Handshake className="h-6 w-6" />} title="No PTPs yet" description="Create a promise-to-pay record." />
        ) : (
          ptps.map((p) => (
            <div key={p.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold tabular-nums">{formatPaiseToINR(Number(p.promisedAmount))}</p>
                  <p className="text-xs text-muted-foreground">Promise: {fmtDate(p.promiseDate)}</p>
                  {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                </div>
                <StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge>
              </div>
              {p.status === 'ACTIVE' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <Button size="sm" className="flex-1" disabled={fulfillMutation.isPending} onClick={() => fulfillMutation.mutate(p.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark Fulfilled
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/40 hover:bg-destructive/10" disabled={breakMutation.isPending} onClick={() => breakMutation.mutate(p.id)}>
                    <XCircle className="h-3.5 w-3.5" /> Mark Broken
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Promise to Pay</DialogTitle>
            <DialogDescription>Record a payment promise from this candidate.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount (₹)</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" type="text" inputMode="decimal" />
            </div>
            <div>
              <Label>Promise Date</Label>
              <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Will pay after shop revenue comes in" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !amount || !promiseDate}>Create PTP</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function FollowUpSection({ candidateId, loanId, followUps }: {
  candidateId: string
  loanId?: string
  followUps: CandidateDetail['followUps']
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [contactMethod, setContactMethod] = React.useState('PHONE')
  const [outcome, setOutcome] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [nextFollowUp, setNextFollowUp] = React.useState('')

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/agent/follow-ups', {
      candidateId,
      loanId: loanId ?? null,
      contactDate: new Date().toISOString(),
      contactMethod,
      outcome: outcome || null,
      notes: notes || null,
      nextFollowUp: nextFollowUp ? new Date(nextFollowUp).toISOString() : null,
    }),
    onSuccess: () => {
      toast.success('Follow-up recorded')
      queryClient.invalidateQueries({ queryKey: ['agent-candidate', candidateId] })
      queryClient.invalidateQueries({ queryKey: ['agent-follow-ups'] })
      setOpen(false); setOutcome(''); setNotes(''); setNextFollowUp('')
    },
    onError: (e: Error) => toast.error('Failed to record follow-up', { description: e.message }),
  })

  return (
    <Card className="shadow-premium">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Contact History</CardTitle>
            <CardDescription className="text-xs">{followUps.length} entries</CardDescription>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Log Contact
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {followUps.length === 0 ? (
          <EmptyState icon={<History className="h-6 w-6" />} title="No contact history" description="Log your first follow-up." />
        ) : (
          followUps.map((f) => (
            <div key={f.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold inline-flex items-center gap-1.5">
                    <StatusBadge variant={f.contactMethod}>{f.contactMethod}</StatusBadge>
                    <span className="text-muted-foreground">{fmtDate(f.contactDate)}</span>
                  </p>
                  {f.outcome && <p className="text-sm mt-1">Outcome: {f.outcome}</p>}
                  {f.notes && <p className="text-xs text-muted-foreground mt-1">{f.notes}</p>}
                  {f.nextFollowUp && (
                    <p className="text-[11px] text-info mt-1 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Next: {fmtDate(f.nextFollowUp)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Contact</DialogTitle>
            <DialogDescription>Record a follow-up interaction.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Contact Method</Label>
              <Select value={contactMethod} onValueChange={setContactMethod}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHONE">Phone</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="IN_APP">In-App</SelectItem>
                  <SelectItem value="FIELD_VISIT">Field Visit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Outcome</Label>
              <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Reminded, PTP given, no answer" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes from the call" />
            </div>
            <div>
              <Label>Next Follow-up Date</Label>
              <Input type="date" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function EscalationSection({ candidateId, loanId, escalations }: {
  candidateId: string
  loanId?: string
  escalations: CandidateDetail['escalations']
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState('REPEATED_MISSED_PAYMENT')
  const [description, setDescription] = React.useState('')

  const createMutation = useMutation({
    mutationFn: () => {
      if (!loanId) throw new Error('No active loan for this candidate')
      return api.post('/api/agent/escalations', {
        candidateId,
        loanId,
        reason,
        description,
      })
    },
    onSuccess: () => {
      toast.success('Escalation created')
      queryClient.invalidateQueries({ queryKey: ['agent-candidate', candidateId] })
      queryClient.invalidateQueries({ queryKey: ['agent-escalations'] })
      setOpen(false); setDescription('')
    },
    onError: (e: Error) => toast.error('Failed to escalate', { description: e.message }),
  })

  return (
    <Card className="shadow-premium">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Escalations</CardTitle>
            <CardDescription className="text-xs">{escalations.length} total</CardDescription>
          </div>
          <Button size="sm" onClick={() => setOpen(true)} disabled={!loanId}>
            <Plus className="h-4 w-4" /> Escalate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {escalations.length === 0 ? (
          <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="No escalations" description="Escalate when collection requires owner intervention." />
        ) : (
          escalations.map((e) => (
            <div key={e.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <StatusBadge variant={e.reason === 'LONG_OVERDUE' || e.reason === 'BROKEN_PTP' ? 'AI_HIGH' : 'AI_MEDIUM'}>
                    {reasonLabel[e.reason] ?? e.reason}
                  </StatusBadge>
                  <p className="text-xs text-muted-foreground mt-1">{e.description ?? '—'}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{fmtDate(e.createdAt)}</p>
                </div>
                <StatusBadge variant={e.status}>{formatStatus(e.status)}</StatusBadge>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalate Candidate</DialogTitle>
            <DialogDescription>Escalate to owner for intervention.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="REPEATED_MISSED_PAYMENT">Repeated Missed Payment</SelectItem>
                  <SelectItem value="BROKEN_PTP">Broken PTP</SelectItem>
                  <SelectItem value="LONG_OVERDUE">Long Overdue</SelectItem>
                  <SelectItem value="FAILED_CONTACT">Failed Contact</SelectItem>
                  <SelectItem value="HIGH_OUTSTANDING">High Outstanding</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain why escalation is needed" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !description}>Escalate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
