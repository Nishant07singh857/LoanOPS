'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, FileText, User, Phone, CreditCard, Banknote, CheckCircle2,
  XCircle, Info, ShieldCheck, FileSignature, History, Briefcase, Eye, EyeOff,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatBpsToPercent } from '@/lib/money'
import { cn } from '@/lib/utils'

type ActionKind = 'APPROVE' | 'REJECT' | 'REQUEST_INFO'

interface ApplicationDetail {
  id: string
  applicationNumber: string
  candidate: {
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
    assignedAgent?: { id: string; name: string } | null
    kyc?: { status: string; aadhaarNumber?: string | null; panNumber?: string | null } | null
  }
  principalAmount: string
  currency: string
  purpose: string
  interestType: string
  interestRate?: number | null
  fixedInterest?: string | null
  frequency: string
  tenureCount: number
  installments: number
  firstDueDate: string
  finalDueDate?: string | null
  processingFee?: string | null
  otherFees?: string | null
  totalRepayable?: string | null
  installmentAmount?: string | null
  status: string
  kycAadhaar?: string | null
  kycPan?: string | null
  kycStatus?: string | null
  agreementTemplateId?: string | null
  agreementVersion?: string | null
  agreementAcceptedAt?: string | null
  reviewedAt?: string | null
  reviewNotes?: string | null
  rejectionReason?: string | null
  infoRequested?: string | null
  submittedAt?: string | null
  createdAt: string
  loan?: { id: string; loanNumber: string; status: string } | null
  qrLink?: { id: string; token: string; isRevoked: boolean; expiresAt: string | null } | null
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: app, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-application', params.id],
    queryFn: () => api.get<ApplicationDetail>(`/api/owner/applications/${params.id}`),
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

  const [action, setAction] = React.useState<ActionKind | null>(null)
  const [reason, setReason] = React.useState('')
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
        { entityType: 'APPLICATION', entityId: params.id }
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

  const actionMutation = useMutation({
    mutationFn: async (input: { kind: ActionKind; reason: string }) => {
      if (input.kind === 'APPROVE') {
        return api.post(`/api/owner/applications/${params.id}/approve`, { reviewNotes: input.reason })
      }
      if (input.kind === 'REJECT') {
        return api.post(`/api/owner/applications/${params.id}/reject`, { rejectionReason: input.reason })
      }
      return api.post(`/api/owner/applications/${params.id}/request-info`, { message: input.reason })
    },
    onSuccess: (_data: any, vars) => {
      if (vars.kind === 'APPROVE') toast.success('Application approved', { description: `${app?.applicationNumber} marked APPROVED. Loan ready for disbursement.` })
      if (vars.kind === 'REJECT') toast.error('Application rejected', { description: `${app?.applicationNumber} marked REJECTED.` })
      if (vars.kind === 'REQUEST_INFO') toast.info('Information requested', { description: `Notification sent to ${app?.candidate.fullName}.` })
      queryClient.invalidateQueries({ queryKey: ['owner-application', params.id] })
      queryClient.invalidateQueries({ queryKey: ['owner-applications'] })
      queryClient.invalidateQueries({ queryKey: ['owner-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['owner-loans'] })
      setAction(null)
      setReason('')
    },
    onError: (err: any) => toast.error('Action failed', { description: err.message }),
  })

  const qrRegenerate = useMutation({
    mutationFn: () => api.post(`/api/owner/qr-links/${app?.qrLink?.id}/regenerate`, {}),
    onSuccess: () => {
      toast.success('QR link regenerated')
      queryClient.invalidateQueries({ queryKey: ['owner-application', params.id] })
    },
    onError: (err: any) => toast.error('Failed to regenerate QR', { description: err.message }),
  })

  const qrRevoke = useMutation({
    mutationFn: () => api.post(`/api/owner/qr-links/${app?.qrLink?.id}/revoke`, {}),
    onSuccess: () => {
      toast.success('QR link revoked')
      queryClient.invalidateQueries({ queryKey: ['owner-application', params.id] })
    },
    onError: (err: any) => toast.error('Failed to revoke QR', { description: err.message }),
  })

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading application details">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/applications')} className="gap-1 min-h-[44px] sm:min-h-8">
          <ArrowLeft className="h-4 w-4" /> Back to Applications
        </Button>
        <Card className="shadow-premium"><CardContent className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </CardContent></Card>
      </div>
    )
  }

  if (isError || !app) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/applications')} className="gap-1 min-h-[44px] sm:min-h-8">
          <ArrowLeft className="h-4 w-4" /> Back to Applications
        </Button>
        <Card className="border-destructive/40 bg-destructive/5 shadow-premium">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-destructive">Failed to load application details</p>
              <p className="text-xs text-muted-foreground mt-0.5">The application could not be found or there was a network error.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="min-h-[44px] sm:min-h-8">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const c = app.candidate
  const canAct = app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW' || app.status === 'INFORMATION_REQUESTED'
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const rawAadhaar = app.kycAadhaar ?? c.aadhaarMasked ?? c.kyc?.aadhaarNumber
  const rawPan = app.kycPan ?? c.panMasked ?? c.kyc?.panNumber

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/applications')} className="gap-1 min-h-[44px] sm:min-h-8">
          <ArrowLeft className="h-4 w-4" /> Back to Applications
        </Button>
      </div>

      <SectionHeading
        title={app.applicationNumber}
        description={`${c.fullName} · ${app.purpose}`}
        icon={<FileText className="h-5 w-5" />}
        action={
          canAct ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAction('REQUEST_INFO')} className="min-h-[44px] sm:min-h-8">
                <Info className="h-4 w-4" /> Request Info
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAction('REJECT')} className="text-destructive border-destructive/40 hover:bg-destructive/10 min-h-[44px] sm:min-h-8">
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button size="sm" onClick={() => setAction('APPROVE')} className="min-h-[44px] sm:min-h-8">
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            </div>
          ) : (
            <StatusBadge variant={app.status}>{formatStatus(app.status)}</StatusBadge>
          )
        }
      />

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {c.fullName.split(' ').map(p => p[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.fullName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {c.mobile}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 sm:gap-6">
                <div><p className="text-xs text-muted-foreground">Amount</p><p className="text-base font-semibold tabular-nums">{formatPaiseToINR(Number(app.principalAmount))}</p></div>
                <div><p className="text-xs text-muted-foreground">Terms</p><p className="text-base font-semibold">{app.frequency} · {app.installments}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge variant={app.status}>{formatStatus(app.status)}</StatusBadge></div>
              </div>
            </div>
            {app.status === 'INFORMATION_REQUESTED' && app.infoRequested && (
              <div className="mt-3 rounded-lg bg-warning/10 border border-warning/30 p-3 text-xs">
                <span className="font-semibold text-warning">Info requested: </span><span>{app.infoRequested}</span>
              </div>
            )}
            {app.status === 'REJECTED' && app.rejectionReason && (
              <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs">
                <span className="font-semibold text-destructive">Rejected: </span><span>{app.rejectionReason}</span>
              </div>
            )}
            {app.status === 'APPROVED' && app.loan && (
              <div className="mt-3 rounded-lg bg-success/10 border border-success/30 p-3 text-xs">
                <span className="font-semibold text-success">Approved: </span>
                <span>Loan {app.loan.loanNumber} created. <Link href={`/admin/loans/${app.loan.id}`} className="text-primary underline">View loan →</Link></span>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex w-full overflow-x-auto no-scrollbar h-auto">
          <TabsTrigger value="overview" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">Overview</TabsTrigger>
          {app.qrLink && <TabsTrigger value="qr" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">QR Link</TabsTrigger>}
          <TabsTrigger value="kyc" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">KYC</TabsTrigger>
          <TabsTrigger value="agreement" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">Agreement</TabsTrigger>
          <TabsTrigger value="history" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">History</TabsTrigger>
        </TabsList>

        {app.qrLink && (
          <TabsContent value="qr">
            <Card className="shadow-premium">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">Application Link</CardTitle>
                <CardDescription>Share this QR code or link with the candidate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex flex-col items-center p-4 bg-muted/20 rounded-xl">
                  <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                    <QRCodeSVG value={`${origin}/apply/${app.qrLink?.token}`} size={200} />
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full max-w-md">
                    <div className="bg-background border rounded px-3 py-2 text-sm flex-1 truncate font-mono">
                      {`${origin}/apply/${app.qrLink?.token}`}
                    </div>
                    <Button variant="secondary" className="min-h-[44px] sm:min-h-9" onClick={() => {
                      navigator.clipboard.writeText(`${origin}/apply/${app.qrLink?.token}`)
                      toast.success('Link copied')
                    }}>Copy</Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t w-full max-w-md justify-center">
                    <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-8" onClick={() => qrRegenerate.mutate()} disabled={qrRegenerate.isPending || app.qrLink?.isRevoked}>
                      Regenerate
                    </Button>
                    <Button variant="destructive" size="sm" className="min-h-[44px] sm:min-h-8" onClick={() => qrRevoke.mutate()} disabled={qrRevoke.isPending || app.qrLink?.isRevoked}>
                      {app.qrLink?.isRevoked ? 'Revoked' : 'Revoke'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Personal Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Term label="Full Name" value={c.fullName} />
                <Term label="Mobile" value={c.mobile} />
                <Term label="Email" value={c.email ?? '—'} />
                <Term label="DOB" value={fmtDate(c.dob)} />
                <Term label="Address" value={c.address ?? '—'} />
                <Term label="Occupation" value={c.occupation ?? '—'} />
              </CardContent>
            </Card>

            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4" /> Financial Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Term label="Employment" value={c.occupation ?? '—'} />
                <Term label="Employer" value={c.employer ?? '—'} />
                <Term label="Monthly Income" value={c.monthlyIncome ? formatPaiseToINR(c.monthlyIncome) : '—'} />
                <Term label="Loan Purpose" value={app.purpose} />
                <Term label="Tenure" value={`${app.installments} ${app.frequency.toLowerCase()}`} />
                <Term label="First Due" value={fmtDate(app.firstDueDate)} />
              </CardContent>
            </Card>

            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Banknote className="h-4 w-4" /> Loan Request</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Term label="Principal" value={formatPaiseToINR(Number(app.principalAmount))} />
                <Term label="Frequency" value={app.frequency} />
                <Term label="Installments" value={String(app.installments)} />
                <Term label="Installment Amt" value={app.installmentAmount ? formatPaiseToINR(Number(app.installmentAmount)) : '—'} />
                <Term label="Interest Rate" value={app.interestType === 'PERCENTAGE' ? formatBpsToPercent(app.interestRate ?? 0) : app.interestType === 'FIXED' ? formatPaiseToINR(Number(app.fixedInterest ?? 0)) : 'No interest'} />
                <Term label="Total Repayable" value={app.totalRepayable ? formatPaiseToINR(Number(app.totalRepayable)) : '—'} />
              </CardContent>
            </Card>

            <Card className="shadow-premium">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Bank Details</CardTitle>
                {c.bankAccount && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={revealingPii}
                    onClick={handleTogglePii}
                    aria-label={showPii ? 'Hide sensitive bank account number' : 'Show sensitive bank account number'}
                    className="h-8 px-2 text-xs text-muted-foreground"
                  >
                    {showPii ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                    {showPii ? 'Mask' : 'Reveal'}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Term label="Bank" value={c.bankName ?? '—'} />
                <Term label="Account Number" value={showPii ? (revealedPii?.bankAccount ?? c.bankAccount ?? '—') : maskBankAccount(c.bankAccount)} />
                <Term label="IFSC" value={c.bankIfsc ?? '—'} />
                <Term label="UPI ID" value={c.upiId ?? '—'} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="kyc">
          <Card className="shadow-premium">
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> KYC Verification</CardTitle>
                <CardDescription>Aadhaar, PAN, and KYC documents</CardDescription>
              </div>
              {(rawAadhaar || rawPan) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={revealingPii}
                  onClick={handleTogglePii}
                  aria-label={showPii ? 'Mask KYC identifiers' : 'Reveal KYC identifiers'}
                  className="min-h-[44px] sm:min-h-8 text-xs"
                >
                  {showPii ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                  {showPii ? 'Mask PII' : 'Reveal PII'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border p-4 hover:border-primary/40 transition-all">
                  <div>
                    <p className="text-sm font-medium">Aadhaar Card</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{showPii ? (revealedPii?.aadhaar ?? maskAadhaar(rawAadhaar)) : maskAadhaar(rawAadhaar)}</p>
                  </div>
                  <StatusBadge variant={app.kycStatus ?? 'PENDING'}>{formatStatus(app.kycStatus ?? 'PENDING')}</StatusBadge>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border p-4 hover:border-primary/40 transition-all">
                  <div>
                    <p className="text-sm font-medium">PAN Card</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{showPii ? (revealedPii?.pan ?? rawPan ?? '—') : maskPan(rawPan)}</p>
                  </div>
                  <StatusBadge variant={app.kycStatus ?? 'PENDING'}>{formatStatus(app.kycStatus ?? 'PENDING')}</StatusBadge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agreement">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileSignature className="h-4 w-4" /> Agreement</CardTitle><CardDescription>{app.agreementVersion ? `Standard Personal Loan Agreement v${app.agreementVersion}` : 'Standard Personal Loan Agreement'}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">
                <p className="font-semibold mb-2"># Loan Agreement</p>
                <p className="text-muted-foreground">This agreement is entered into between the Lender and <strong>{c.fullName}</strong> ("Borrower"). The principal amount of <strong>{formatPaiseToINR(Number(app.principalAmount))}</strong> shall be repaid in <strong>{app.installments} {app.frequency.toLowerCase()}</strong> installments, commencing on disbursement.</p>
                <p className="text-muted-foreground mt-2">This agreement is governed by applicable RBI guidelines and NBFC regulations.</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <StatusBadge variant={app.agreementAcceptedAt ? 'VERIFIED' : 'PENDING'}>
                  {app.agreementAcceptedAt ? `Accepted ${fmtDate(app.agreementAcceptedAt)}` : 'Pending acceptance'}
                </StatusBadge>
                <Button variant="outline" size="sm" onClick={viewAgreement} disabled={agreementLoading}>{agreementLoading ? 'Loading…' : 'View Full Agreement'}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Application History</CardTitle><CardDescription>Audit trail of all changes</CardDescription></CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="relative z-10 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 ring-4 ring-background">
                      <History className="h-3 w-3" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">Application created</p>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(app.createdAt)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Application {app.applicationNumber} created</p>
                    </div>
                  </li>
                  {app.submittedAt && (
                    <li className="flex items-start gap-3">
                      <div className="relative z-10 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 ring-4 ring-background">
                        <History className="h-3 w-3" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">Application submitted</p>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{fmtDate(app.submittedAt)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Submitted by {c.fullName}</p>
                      </div>
                    </li>
                  )}
                  {app.agreementAcceptedAt && (
                    <li className="flex items-start gap-3">
                      <div className="relative z-10 h-6 w-6 rounded-full bg-success/10 text-success flex items-center justify-center flex-shrink-0 ring-4 ring-background">
                        <History className="h-3 w-3" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">Agreement accepted</p>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{fmtDate(app.agreementAcceptedAt)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">v{app.agreementVersion ?? '1.0'}</p>
                      </div>
                    </li>
                  )}
                  {app.reviewedAt && (
                    <li className="flex items-start gap-3">
                      <div className="relative z-10 h-6 w-6 rounded-full bg-success/10 text-success flex items-center justify-center flex-shrink-0 ring-4 ring-background">
                        <History className="h-3 w-3" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">Reviewed</p>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{fmtDate(app.reviewedAt)}</span>
                        </div>
                        {app.reviewNotes && <p className="text-xs text-muted-foreground mt-0.5">{app.reviewNotes}</p>}
                      </div>
                    </li>
                  )}
                  {app.status === 'APPROVED' && (
                    <li className="flex items-start gap-3">
                      <div className="relative z-10 h-6 w-6 rounded-full bg-success/10 text-success flex items-center justify-center flex-shrink-0 ring-4 ring-background">
                        <CheckCircle2 className="h-3 w-3" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">Application approved</p>
                          {app.loan && <span className="text-xs text-muted-foreground">· Loan {app.loan.loanNumber} created</span>}
                        </div>
                      </div>
                    </li>
                  )}
                  {app.status === 'REJECTED' && (
                    <li className="flex items-start gap-3">
                      <div className="relative z-10 h-6 w-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0 ring-4 ring-background">
                        <XCircle className="h-3 w-3" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">Application rejected</p>
                        </div>
                        {app.rejectionReason && <p className="text-xs text-muted-foreground mt-0.5">{app.rejectionReason}</p>}
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={action !== null} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'APPROVE' && 'Approve Application'}
              {action === 'REJECT' && 'Reject Application'}
              {action === 'REQUEST_INFO' && 'Request Information'}
            </DialogTitle>
            <DialogDescription>
              {action === 'APPROVE' && `Confirm approval of ${app.applicationNumber}. A loan will be created and queued for disbursement.`}
              {action === 'REJECT' && `Confirm rejection of ${app.applicationNumber}. The candidate will be notified.`}
              {action === 'REQUEST_INFO' && `Request additional information from ${c.fullName}. Specify what is needed.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">{action === 'REJECT' ? 'Rejection reason' : action === 'APPROVE' ? 'Approval notes (optional)' : 'Information requested'}</Label>
              <Textarea
                id="reason"
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  action === 'REJECT' ? 'e.g. Income insufficient for requested amount' :
                  action === 'REQUEST_INFO' ? 'e.g. Please upload latest 3 months bank statement' :
                  'Optional approval notes'
                }
              />
              {(action === 'REJECT' || action === 'REQUEST_INFO') && reason.trim().length > 0 && reason.trim().length < 3 && (
                <p className="text-xs text-destructive mt-1">Please enter at least 3 characters.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={actionMutation.isPending} className="min-h-[44px] sm:min-h-9">Cancel</Button>
            <Button
              variant={action === 'REJECT' ? 'destructive' : 'default'}
              onClick={() => action && actionMutation.mutate({ kind: action, reason })}
              disabled={actionMutation.isPending || (action === 'REJECT' && reason.trim().length < 3) || (action === 'REQUEST_INFO' && reason.trim().length < 3)}
              className="min-h-[44px] sm:min-h-9"
            >
              {actionMutation.isPending ? 'Processing…' : action === 'APPROVE' ? 'Confirm Approval' : action === 'REJECT' ? 'Confirm Rejection' : 'Send Request'}
            </Button>
          </DialogFooter>
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
