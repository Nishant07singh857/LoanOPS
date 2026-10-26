'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wallet, CreditCard, CalendarClock, FileText, MessageCircle,
  Bell, ShieldCheck, Landmark, CheckCircle2, Clock, ChevronRight,
  ArrowRight, Sparkles, Sun, IndianRupee, Lock, LifeBuoy,
  Upload, AlertCircle, Eye, EyeOff, Loader2, IdCard, Building2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatBpsToPercent } from '@/lib/money'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { useSession } from '@/lib/session'
import {
  cn,
  maskAadhaar,
  maskPan,
  maskBankAccount,
  AADHAAR_REGEX,
  PAN_REGEX,
  IFSC_REGEX,
  BANK_ACCOUNT_REGEX,
} from '@/lib/utils'

const TRUST = [
  { icon: <ShieldCheck className="h-4 w-4" />, label: 'Bank-grade security' },
  { icon: <Lock className="h-4 w-4" />, label: 'Personal data encrypted' },
]

interface CandidateLoan {
  id: string
  loanNumber?: string
  principalAmount: string
  installmentAmount: string
  totalRepayable: string
  outstandingPrincipal: string
  outstandingInterest: string
  outstandingFees: string
  totalCollected: string
  installments: number
  paidInstallments: number
  overdueInstallments: number
  status: string
  firstDueDate: string
  finalDueDate: string
  nextDue?: {
    installmentNumber: number
    dueDate: string
    totalDue: string
  } | null
  draftApplication?: any
  hasKyc?: boolean
  agreement?: any
  assignedAgent?: { name?: string; phone?: string | null } | null
}

interface NotificationRow {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CandidateHomePage() {
  const { user } = useSession()
  const candidateName = user?.name || 'Candidate'
  const firstName = candidateName.split(' ')[0]

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  // Loan data — gracefully handle no loan case
  const { data: loan, isLoading: loanLoading } = useQuery({
    queryKey: ['candidate-loan'],
    queryFn: () => api.get<CandidateLoan>('/api/candidate/loan'),
    retry: false,
  })

  const { data: notifData } = useQuery({
    queryKey: ['candidate-notifications'],
    queryFn: () => api.get<{ items: NotificationRow[]; total: number; unreadCount: number }>('/api/candidate/notifications?pageSize=10'),
  })
  const notifications = notifData?.items ?? []

  const paidCount = loan?.paidInstallments ?? 0
  const installmentsTotal = loan?.installments ?? 0
  const progress = installmentsTotal > 0 ? Math.round((paidCount / installmentsTotal) * 100) : 0
  const nextInstallment = loan?.nextDue

  const onWhatsAppAgent = () => {
    const agentPhone = loan?.assignedAgent?.phone
    if (!agentPhone) {
      toast.error('No agent assigned yet', { description: 'Please raise a support request and the lender will assign an agent.' })
      return
    }
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.CANDIDATE_TO_AGENT, {
      candidateName,
      loanNumber: loan?.loanNumber ?? '',
    })
    openWhatsApp(agentPhone, msg)
    toast.success('WhatsApp draft opened', { description: 'Your agent will respond shortly.' })
  }

  // Countdown to next due date
  const dueDate = nextInstallment?.dueDate ? new Date(nextInstallment.dueDate) : null
  const now = new Date()
  const daysLeft = dueDate ? Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Greeting hero */}
      <FadeIn>
        <Card className="overflow-hidden border-success/15 bg-gradient-to-br from-success/10 via-primary/5 to-transparent">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-success/15 text-success flex items-center justify-center flex-shrink-0">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <Sun className="h-3.5 w-3.5" /> {today}
                  </p>
                  <h1 className="text-lg sm:text-2xl font-bold tracking-tight mt-0.5">
                    Hello, {firstName} <span className="inline-block">👋</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {loan?.loanNumber ? (
                      <>Your loan is <span className="font-semibold text-success">on track</span>. {paidCount} of {installmentsTotal} installments paid.</>
                    ) : loan?.draftApplication ? (
                      <>Complete your loan application below to unlock instant disbursement.</>
                    ) : (
                      <>Welcome! No active loan yet — check back after your application is approved.</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/portal/loan"><Wallet className="h-4 w-4" /> My Loan</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/portal/payments"><CreditCard className="h-4 w-4" /> Cash Payments</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {loanLoading ? (
        <Card className="shadow-premium"><CardContent className="p-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent></Card>
      ) : !loan?.loanNumber && loan?.draftApplication ? (
        loan.draftApplication.status === 'DRAFT' || loan.draftApplication.status === 'INFORMATION_REQUESTED' ? (
          <DraftApplicationFlow
            draftApplication={loan.draftApplication}
            hasKyc={Boolean(loan.hasKyc)}
            agreement={loan.agreement}
            candidateName={candidateName}
          />
        ) : (
          <FadeIn>
            <Card className="shadow-premium border-blue-400 bg-blue-500/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <FileText className="h-5 w-5" /> Application {loan.draftApplication.status.replace(/_/g, ' ')}
                </CardTitle>
                <CardDescription>Your application is currently being processed by the lending team. You will be notified once a decision is made.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-background border border-border">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Principal</p>
                    <p className="font-bold tabular-nums">{formatPaiseToINR(Number(loan.draftApplication.principalAmount))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Installments</p>
                    <p className="font-bold">{loan.draftApplication.installments} ({loan.draftApplication.frequency.toLowerCase()})</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Installment (EMI)</p>
                    <p className="font-bold tabular-nums">
                      {formatPaiseToINR(
                        Number(
                          loan.draftApplication.installmentAmount ||
                            Math.round(
                              Number(loan.draftApplication.totalRepayable || loan.draftApplication.principalAmount) /
                                Math.max(1, Number(loan.draftApplication.installments || 1))
                            )
                        )
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Total Repayable</p>
                    <p className="font-bold tabular-nums">
                      {formatPaiseToINR(Number(loan.draftApplication.totalRepayable || loan.draftApplication.principalAmount))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        )
      ) : loan && loan.loanNumber ? (
        <>
          {/* Active loan card + next due */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <FadeIn className="lg:col-span-2">
              <Card className="shadow-premium h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-success/15 text-success flex items-center justify-center">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Active Loan</CardTitle>
                        <CardDescription className="text-xs font-mono">{loan.loanNumber}</CardDescription>
                      </div>
                    </div>
                    <StatusBadge variant={loan.status}>Active</StatusBadge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Outstanding</p>
                      <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">
                        {formatPaiseToINR(Number(loan.outstandingPrincipal) + Number(loan.outstandingInterest) + Number(loan.outstandingFees || 0))}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Next Due</p>
                      <p className="text-base sm:text-lg font-bold mt-1">{nextInstallment ? fmtDate(nextInstallment.dueDate) : '—'}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3 col-span-2 sm:col-span-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Installment</p>
                      <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">
                        {formatPaiseToINR(Number(loan.installmentAmount))}
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Repayment progress</span>
                      <span className="font-medium">{paidCount} of {installmentsTotal} paid · {progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2.5" />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/portal/loan">View Details <ChevronRight className="h-3.5 w-3.5" /></Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/portal/schedule"><CalendarClock className="h-3.5 w-3.5" /> Schedule</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            <FadeIn delay={0.05}>
              <Card className="shadow-premium h-full border-warning/20 bg-gradient-to-br from-warning/10 via-card to-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-warning">
                    <Clock className="h-4 w-4" /> Next Payment Due
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums">
                      {nextInstallment ? formatPaiseToINR(Number(nextInstallment.totalDue)) : formatPaiseToINR(Number(loan.installmentAmount))}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Installment #{nextInstallment?.installmentNumber ?? 1} · {nextInstallment ? fmtDate(nextInstallment.dueDate) : fmtDate(loan.firstDueDate)}</p>
                  </div>
                  <div className="rounded-xl bg-warning/10 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Time remaining</p>
                    <p className="text-2xl font-bold text-warning mt-0.5">
                      {daysLeft} <span className="text-base font-medium">days</span>
                    </p>
                  </div>
                  <Button asChild className="w-full" size="sm">
                    <Link href="/portal/payments"><CreditCard className="h-4 w-4" /> Cash Payments</Link>
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>
          </div>

          {/* Quick Actions */}
          <FadeIn>
            <Card className="shadow-premium border-primary/15">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                    <CardDescription className="text-xs">Everything you need, one tap away</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Cash Payments', icon: <CreditCard className="h-5 w-5" />, tint: 'bg-success/15 text-success', href: '/portal/payments' },
                    { label: 'View Schedule', icon: <CalendarClock className="h-5 w-5" />, tint: 'bg-primary/10 text-primary', href: '/portal/schedule' },
                    { label: 'Download Receipt', icon: <FileText className="h-5 w-5" />, tint: 'bg-info/15 text-info', href: '/portal/receipts' },
                    { label: 'WhatsApp Support', icon: <MessageCircle className="h-5 w-5" />, tint: 'bg-warning/15 text-warning', onClick: onWhatsAppAgent },
                  ].map((q) => {
                    const inner = (
                      <>
                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center mb-3', q.tint)}>
                          {q.icon}
                        </div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          {q.label}
                          <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                        </p>
                      </>
                    )
                    return q.href ? (
                      <Link
                        key={q.label}
                        href={q.href}
                        className="group rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-premium transition-all min-h-[88px]"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        key={q.label}
                        onClick={q.onClick}
                        className="group rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-premium transition-all min-h-[88px] text-left"
                      >
                        {inner}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </>
      ) : null}

      {/* Notifications preview + Need Help */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <FadeIn className="lg:col-span-2">
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-info/15 text-info flex items-center justify-center">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Recent Notifications</CardTitle>
                    <CardDescription className="text-xs">{notifications.length} updates</CardDescription>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/portal/notifications">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" description="You'll see updates here." />
              ) : (
                <StaggerContainer className="space-y-2.5">
                  {notifications.slice(0, 3).map((n) => (
                    <StaggerItem key={n.id}>
                      <Link
                        href="/portal/notifications"
                        className={cn(
                          'block rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-premium transition-all',
                          !n.isRead && 'border-success/30 bg-success/5'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', n.isRead ? 'bg-muted text-muted-foreground' : 'bg-success/15 text-success')}>
                            {n.type === 'PAYMENT_REMINDER' ? <Clock className="h-4 w-4" /> : n.type === 'PAYMENT_CONFIRMATION' ? <CheckCircle2 className="h-4 w-4" /> : <IndianRupee className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">{n.title}</p>
                              {!n.isRead && <span className="h-2 w-2 rounded-full bg-success flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{fmtDate(n.createdAt)}</p>
                          </div>
                        </div>
                      </Link>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card className="shadow-premium h-full border-info/15">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-4 w-4 text-info" /> Need Help?</CardTitle>
              <CardDescription className="text-xs">Reach out — we're here for you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loan?.assignedAgent?.phone ? (
                <div className="rounded-xl border border-info/20 bg-info/5 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Your Agent</p>
                  <p className="text-sm font-semibold">{loan.assignedAgent.name ?? 'Assigned Agent'}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{loan.assignedAgent.phone}</p>
                  <Button size="sm" variant="outline" className="w-full mt-3 text-info border-info/40 hover:bg-info/10" onClick={onWhatsAppAgent}>
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Agent
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-info/20 bg-info/5 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Your Agent</p>
                  <p className="text-sm font-semibold">No agent assigned yet</p>
                  <p className="text-[11px] text-muted-foreground">Raise a support request and the lender will assign an agent to your loan.</p>
                </div>
              )}
              <div className="rounded-xl border border-success/20 bg-success/5 p-3">
                <p className="text-xs text-muted-foreground mb-1">Lender Support</p>
                <p className="text-sm font-semibold">Support Team</p>
                <p className="text-[11px] text-muted-foreground">For escalations, raise a ticket — the lender team responds in Support.</p>
                <Button asChild size="sm" variant="outline" className="w-full mt-3 text-success border-success/40 hover:bg-success/10">
                  <Link href="/portal/support">
                    <LifeBuoy className="h-3.5 w-3.5" /> Open Support
                  </Link>
                </Button>
              </div>
              <Button asChild size="sm" variant="ghost" className="w-full">
                <Link href="/portal/support"><LifeBuoy className="h-3.5 w-3.5" /> Open Support</Link>
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Trust strip */}
      <FadeIn>
        <Card className="border-border/60 bg-muted/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {TRUST.map((t) => (
                <div key={t.label} className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-success/10 text-success flex items-center justify-center flex-shrink-0">
                    {t.icon}
                  </div>
                  <p className="text-xs sm:text-sm font-medium">{t.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

function DraftApplicationFlow({
  draftApplication,
  hasKyc,
  agreement,
  candidateName,
}: {
  draftApplication: any
  hasKyc: boolean
  agreement?: any
  candidateName: string
}) {
  const { user } = useSession()
  const orgName = user?.organizationName || 'Your Lender'
  const queryClient = useQueryClient()
  const [step, setStep] = React.useState<1 | 2 | 3>(1)

  // KYC & Bank inputs
  const [aadhaarNumber, setAadhaarNumber] = React.useState('')
  const [panNumber, setPanNumber] = React.useState('')
  const [showSensitive, setShowSensitive] = React.useState(false)
  const [aadhaarBase64, setAadhaarBase64] = React.useState<string>('')
  const [aadhaarFileName, setAadhaarFileName] = React.useState<string>('')
  const [panBase64, setPanBase64] = React.useState<string>('')
  const [panFileName, setPanFileName] = React.useState<string>('')
  const [bankName, setBankName] = React.useState('')
  const [bankAccount, setBankAccount] = React.useState('')
  const [bankIfsc, setBankIfsc] = React.useState('')
  const [upiId, setUpiId] = React.useState('')

  // Agreement
  const [agreementAccepted, setAgreementAccepted] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const principalPaise = Number(draftApplication.principalAmount || 0)
  const totalRepayablePaise = Number(draftApplication.totalRepayable || principalPaise)
  const installmentsCount = Math.max(1, Number(draftApplication.installments || 1))
  const installmentPaise = Number(
    draftApplication.installmentAmount || Math.round(totalRepayablePaise / installmentsCount)
  )
  const processingFeePaise = Number(draftApplication.processingFee || 0)
  const otherFeesPaise = Number(draftApplication.otherFees || 0)
  const totalInterestPaise = Math.max(
    0,
    totalRepayablePaise - principalPaise - processingFeePaise - otherFeesPaise
  )

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (b64: string) => void,
    nameSetter: (name: string) => void,
    fieldKey: string
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, [fieldKey]: 'File size must be under 5 MB' }))
      toast.error('File too large', { description: 'Please choose a file smaller than 5 MB.' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result)
        nameSetter(file.name)
        setErrors((prev) => {
          const next = { ...prev }
          delete next[fieldKey]
          return next
        })
      }
    }
    reader.readAsDataURL(file)
  }

  const validateStep2 = () => {
    const nextErrors: Record<string, string> = {}
    const cleanAadhaar = aadhaarNumber.replace(/[\s-]/g, '')
    const cleanPan = panNumber.trim().toUpperCase()
    const cleanAccount = bankAccount.trim().replace(/\s+/g, '')
    const cleanIfsc = bankIfsc.trim().toUpperCase()

    if (!hasKyc) {
      if (cleanAadhaar && !AADHAAR_REGEX.test(cleanAadhaar)) {
        nextErrors.aadhaarNumber = 'Enter a valid 12-digit Aadhaar number (digits only).'
      }
      if (cleanPan && !PAN_REGEX.test(cleanPan)) {
        nextErrors.panNumber = 'Enter a valid 10-character PAN (e.g., ABCDE1234F).'
      }
      if (!aadhaarBase64 && !cleanAadhaar) {
        nextErrors.aadhaarDoc = 'Please upload your Aadhaar document or enter your 12-digit Aadhaar number.'
      }
      if (!panBase64 && !cleanPan) {
        nextErrors.panDoc = 'Please upload your PAN document or enter your 10-character PAN.'
      }
    } else {
      if (cleanAadhaar && !AADHAAR_REGEX.test(cleanAadhaar)) {
        nextErrors.aadhaarNumber = 'Enter a valid 12-digit Aadhaar number.'
      }
      if (cleanPan && !PAN_REGEX.test(cleanPan)) {
        nextErrors.panNumber = 'Enter a valid 10-character PAN (e.g., ABCDE1234F).'
      }
    }

    if (cleanAccount && !BANK_ACCOUNT_REGEX.test(cleanAccount)) {
      nextErrors.bankAccount = 'Bank account number must be 8–20 alphanumeric characters.'
    }
    if (cleanIfsc && !IFSC_REGEX.test(cleanIfsc)) {
      nextErrors.bankIfsc = 'IFSC must be 11 characters (e.g., HDFC0001234).'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post<{ message: string; applicationNumber: string }>('/api/candidate/application/submit', {
        ...(aadhaarBase64 ? { aadhaarBase64 } : {}),
        ...(panBase64 ? { panBase64 } : {}),
        ...(aadhaarNumber.trim() ? { aadhaarNumber: aadhaarNumber.replace(/[\s-]/g, '') } : {}),
        ...(panNumber.trim() ? { panNumber: panNumber.trim().toUpperCase() } : {}),
        ...(bankName.trim() ? { bankName: bankName.trim() } : {}),
        ...(bankAccount.trim() ? { bankAccount: bankAccount.trim().replace(/\s+/g, '') } : {}),
        ...(bankIfsc.trim() ? { bankIfsc: bankIfsc.trim().toUpperCase() } : {}),
        ...(upiId.trim() ? { upiId: upiId.trim() } : {}),
        agreementAccepted,
      }),
    onSuccess: (res) => {
      toast.success('Application submitted!', {
        description: `Application ${res.applicationNumber} has been sent for approval.`,
      })
      queryClient.invalidateQueries({ queryKey: ['candidate-loan'] })
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] })
    },
    onError: (e: Error) => {
      toast.error('Submission failed', { description: e.message })
    },
  })

  const handleFinalSubmit = () => {
    if (!agreementAccepted) {
      setErrors((prev) => ({
        ...prev,
        agreement: 'You must read and accept the Loan Agreement before submitting.',
      }))
      return
    }
    setErrors({})
    submitMutation.mutate()
  }

  const stepProgress = step === 1 ? 33 : step === 2 ? 66 : 100

  return (
    <FadeIn>
      <Card className="shadow-premium border-amber-400/50 bg-gradient-to-br from-amber-500/5 via-card to-card">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <FileText className="h-5 w-5" /> Complete Your Loan Application
              </CardTitle>
              <CardDescription className="mt-0.5">
                Application <span className="font-mono font-medium">{draftApplication.applicationNumber}</span> · Follow the 3 quick steps below to submit for instant review.
              </CardDescription>
            </div>
            <StatusBadge variant="PENDING">Step {step} of 3</StatusBadge>
          </div>

          <div className="space-y-2">
            <Progress value={stepProgress} className="h-2" aria-label={`Application progress step ${step} of 3`} />
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { num: 1, label: '1. Loan & EMI Breakdown' },
                { num: 2, label: '2. KYC & Bank Details' },
                { num: 3, label: '3. Agreement & Submit' },
              ].map((s) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (s.num < step) setStep(s.num as 1 | 2 | 3)
                    else if (s.num === 2 && step === 1) setStep(2)
                    else if (s.num === 3 && step === 2 && validateStep2()) setStep(3)
                  }}
                  className={cn(
                    'text-left font-medium py-1 px-2 rounded-lg transition-colors truncate',
                    step === s.num
                      ? 'bg-primary/10 text-primary font-semibold'
                      : step > s.num
                        ? 'text-success hover:bg-success/10'
                        : 'text-muted-foreground'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 rounded-xl bg-background border border-border">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Principal Amount</p>
                  <p className="text-base sm:text-lg font-bold tabular-nums mt-0.5">{formatPaiseToINR(principalPaise)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Installment (EMI)</p>
                  <p className="text-base sm:text-lg font-bold text-primary tabular-nums mt-0.5">{formatPaiseToINR(installmentPaise)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Tenure & Frequency</p>
                  <p className="text-base sm:text-lg font-bold mt-0.5">
                    {installmentsCount} × {String(draftApplication.frequency || 'MONTHLY').toLowerCase()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Repayable</p>
                  <p className="text-base sm:text-lg font-bold tabular-nums mt-0.5">{formatPaiseToINR(totalRepayablePaise)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transparent EMI & Cost Breakdown</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Loan Principal</span>
                    <span className="font-medium tabular-nums">{formatPaiseToINR(principalPaise)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Interest Type</span>
                    <span className="font-medium">
                      {draftApplication.interestType === 'PERCENTAGE'
                        ? `Percentage (${draftApplication.interestRate ? formatBpsToPercent(Number(draftApplication.interestRate)) : 'Flat'})`
                        : draftApplication.interestType === 'FIXED'
                          ? 'Fixed Interest'
                          : 'Zero Interest (0%)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Interest</span>
                    <span className="font-medium tabular-nums">{formatPaiseToINR(totalInterestPaise)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Processing & Other Fees</span>
                    <span className="font-medium tabular-nums">{formatPaiseToINR(processingFeePaise + otherFeesPaise)}</span>
                  </div>
                  <div className="flex items-center justify-between sm:col-span-2 pt-2 border-t border-border font-semibold">
                    <span>Total Amount Payable ({installmentsCount} installments of {formatPaiseToINR(installmentPaise)})</span>
                    <span className="tabular-nums">{formatPaiseToINR(totalRepayablePaise)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} className="min-h-[44px]">
                  Continue to KYC & Bank Details <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {hasKyc && (
                <div className="rounded-xl border border-success/30 bg-success/10 p-3.5 flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold text-success">KYC Documents on File</p>
                    <p className="text-muted-foreground mt-0.5">
                      Your Aadhaar and PAN documents are already uploaded. You may proceed directly to Step 3 or update your details below.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <IdCard className="h-4 w-4" /> Identity Verification (KYC)
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSensitive((v) => !v)}
                  className="h-8 text-xs"
                >
                  {showSensitive ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                  {showSensitive ? 'Mask IDs' : 'Show Full IDs'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="kyc-aadhaar">Aadhaar Number (12 digits)</Label>
                  <Input
                    id="kyc-aadhaar"
                    inputMode="numeric"
                    maxLength={14}
                    placeholder="e.g. 1234 5678 9012"
                    value={aadhaarNumber}
                    onChange={(e) => {
                      setAadhaarNumber(e.target.value)
                      if (errors.aadhaarNumber || errors.aadhaarDoc) {
                        setErrors((prev) => ({ ...prev, aadhaarNumber: '', aadhaarDoc: '' }))
                      }
                    }}
                    aria-invalid={Boolean(errors.aadhaarNumber)}
                  />
                  {aadhaarNumber.trim() && (
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Stored masked as: <span className="font-semibold text-foreground">{showSensitive ? aadhaarNumber : maskAadhaar(aadhaarNumber)}</span>
                    </p>
                  )}
                  {errors.aadhaarNumber && (
                    <p className="text-xs text-destructive flex items-center gap-1" role="alert">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {errors.aadhaarNumber}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kyc-pan">PAN Number (10 characters)</Label>
                  <Input
                    id="kyc-pan"
                    maxLength={10}
                    placeholder="e.g. ABCDE1234F"
                    value={panNumber}
                    onChange={(e) => {
                      setPanNumber(e.target.value.toUpperCase())
                      if (errors.panNumber || errors.panDoc) {
                        setErrors((prev) => ({ ...prev, panNumber: '', panDoc: '' }))
                      }
                    }}
                    className="uppercase font-mono"
                    aria-invalid={Boolean(errors.panNumber)}
                  />
                  {panNumber.trim() && (
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Stored masked as: <span className="font-semibold text-foreground">{showSensitive ? panNumber : maskPan(panNumber)}</span>
                    </p>
                  )}
                  {errors.panNumber && (
                    <p className="text-xs text-destructive flex items-center gap-1" role="alert">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {errors.panNumber}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Aadhaar Document (Image / PDF)</Label>
                  <label className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-background p-3.5 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/20 transition-colors cursor-pointer min-h-[48px]">
                    <span className="inline-flex items-center gap-2 truncate">
                      <Upload className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="truncate">{aadhaarFileName || (hasKyc ? 'Uploaded (click to replace)' : 'Upload Aadhaar front/back')}</span>
                    </span>
                    {aadhaarFileName && <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      onChange={(e) => handleFileChange(e, setAadhaarBase64, setAadhaarFileName, 'aadhaarDoc')}
                    />
                  </label>
                  {errors.aadhaarDoc && (
                    <p className="text-xs text-destructive flex items-center gap-1" role="alert">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {errors.aadhaarDoc}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>PAN Card Document (Image / PDF)</Label>
                  <label className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-background p-3.5 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/20 transition-colors cursor-pointer min-h-[48px]">
                    <span className="inline-flex items-center gap-2 truncate">
                      <Upload className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="truncate">{panFileName || (hasKyc ? 'Uploaded (click to replace)' : 'Upload PAN card')}</span>
                    </span>
                    {panFileName && <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      onChange={(e) => handleFileChange(e, setPanBase64, setPanFileName, 'panDoc')}
                    />
                  </label>
                  {errors.panDoc && (
                    <p className="text-xs text-destructive flex items-center gap-1" role="alert">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {errors.panDoc}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-border space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" /> Disbursement Bank Details (Optional if already provided)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="bank-name">Bank Name</Label>
                    <Input
                      id="bank-name"
                      placeholder="e.g. HDFC Bank"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bank-account">Account Number</Label>
                    <Input
                      id="bank-account"
                      placeholder="e.g. 50100234567890"
                      value={bankAccount}
                      onChange={(e) => {
                        setBankAccount(e.target.value)
                        if (errors.bankAccount) setErrors((prev) => ({ ...prev, bankAccount: '' }))
                      }}
                      className="font-mono"
                    />
                    {bankAccount.trim() && (
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Display preview: {showSensitive ? bankAccount : maskBankAccount(bankAccount)}
                      </p>
                    )}
                    {errors.bankAccount && (
                      <p className="text-xs text-destructive flex items-center gap-1" role="alert">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {errors.bankAccount}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bank-ifsc">IFSC Code</Label>
                    <Input
                      id="bank-ifsc"
                      placeholder="e.g. HDFC0001234"
                      maxLength={11}
                      value={bankIfsc}
                      onChange={(e) => {
                        setBankIfsc(e.target.value.toUpperCase())
                        if (errors.bankIfsc) setErrors((prev) => ({ ...prev, bankIfsc: '' }))
                      }}
                      className="uppercase font-mono"
                    />
                    {errors.bankIfsc && (
                      <p className="text-xs text-destructive flex items-center gap-1" role="alert">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {errors.bankIfsc}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bank-upi">UPI ID</Label>
                    <Input
                      id="bank-upi"
                      placeholder="e.g. name@okhdfcbank"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="min-h-[44px]">
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (validateStep2()) setStep(3)
                  }}
                  className="min-h-[44px]"
                >
                  Continue to Agreement <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-background p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-success" />
                    {agreement?.name ?? 'Standard Personal Loan Agreement'}
                  </p>
                  <span className="text-xs text-muted-foreground font-mono">
                    Version {agreement?.version ?? '3.1'}
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-3 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                  {agreement?.body ??
                    `LOAN AGREEMENT — ${orgName.toUpperCase()}\n\nBorrower: ${candidateName}\nApplication No: ${draftApplication.applicationNumber}\nPrincipal Amount: ${formatPaiseToINR(principalPaise)}\nInstallment Amount (EMI): ${formatPaiseToINR(installmentPaise)} (${installmentsCount} ${String(draftApplication.frequency || 'MONTHLY').toLowerCase()} installments)\nTotal Repayable: ${formatPaiseToINR(totalRepayablePaise)}\n\n1. REPAYMENT OBLIGATION: The Borrower agrees to repay the Principal Amount along with applicable interest and fees according to the repayment schedule.\n2. KYC & PRIVACY: All Aadhaar, PAN, and Bank details are encrypted and masked in accordance with RBI Digital Lending Guidelines.\n3. PREPAYMENT: The Borrower may prepay the loan in part or in full at any time.`}
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 cursor-pointer hover:border-primary/40 transition-colors">
                <input
                  type="checkbox"
                  checked={agreementAccepted}
                  onChange={(e) => {
                    setAgreementAccepted(e.target.checked)
                    if (errors.agreement) setErrors((prev) => ({ ...prev, agreement: '' }))
                  }}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-xs sm:text-sm leading-relaxed">
                  I, <span className="font-semibold">{candidateName}</span>, confirm that my KYC details are accurate and I digitally accept the{' '}
                  <span className="font-semibold">Loan Agreement</span> for{' '}
                  <span className="font-semibold">{formatPaiseToINR(principalPaise)}</span> (Total Repayable:{' '}
                  <span className="font-semibold">{formatPaiseToINR(totalRepayablePaise)}</span>).
                </span>
              </label>

              {errors.agreement && (
                <p className="text-xs text-destructive flex items-center gap-1.5" role="alert">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {errors.agreement}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)} className="min-h-[44px]">
                  Back to KYC
                </Button>
                <Button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={submitMutation.isPending}
                  className="min-h-[44px]"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Submitting Application…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Submit Application
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  )
}

