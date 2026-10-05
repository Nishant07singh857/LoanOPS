'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Wallet, Calendar, IndianRupee, Percent, Banknote, FileText,
  Download, MessageCircle, ScrollText, CheckCircle2, Plus,
  Building2, ChevronRight, CalendarClock, Receipt, ShieldCheck,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatBpsToPercent } from '@/lib/money'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

const AGENT_PHONE = '+91 98201 44556'

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
  interestType: string
  interestRate?: number | null
  fixedInterest?: string | null
  frequency: string
  installments: number
  paidInstallments: number
  overdueInstallments: number
  status: string
  firstDueDate: string
  finalDueDate: string
  processingFee?: string | null
  otherFees?: string | null
  disbursedAt?: string | null
  application?: {
    applicationNumber: string
    agreementVersion?: string | null
    agreementAcceptedAt?: string | null
    purpose: string
  } | null
  disbursement?: {
    method: string
    amount: string
    status: string
    reference?: string | null
    initiatedAt: string
    completedAt?: string | null
  } | null
  agreement?: {
    id: string
    name: string
    version: string
    body: string
    isActive: boolean
  } | null
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function LoanDetailPage() {
  const { user } = useSession()
  const candidateName = user?.name || 'Candidate'

  const { data: loan, isLoading } = useQuery({
    queryKey: ['candidate-loan'],
    queryFn: () => api.get<CandidateLoan>('/api/candidate/loan'),
    retry: false,
  })

  const activeAgreement = loan?.agreement ?? null

  const onWhatsAppAgent = () => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.CANDIDATE_TO_AGENT, {
      candidateName,
      loanNumber: loan?.loanNumber ?? '',
    })
    openWhatsApp(AGENT_PHONE, msg)
    toast.success('WhatsApp draft opened', { description: 'Your agent will respond shortly.' })
  }

  const onDownloadDoc = (name: string) => toast.success('Download started', { description: `${name} is being prepared…` })

  const [agreementOpen, setAgreementOpen] = React.useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!loan || !loan.loanNumber) {
    const hasDraft = Boolean((loan as any)?.draftApplication)
    return (
      <div className="space-y-6">
        <SectionHeading
          title="My Loan"
          description="Full details of your active loan with Sterling Lending."
          icon={<Wallet className="h-5 w-5" />}
          action={
            <Button variant="outline" size="sm" onClick={onWhatsAppAgent} className="text-info border-info/40 hover:bg-info/10">
              <MessageCircle className="h-4 w-4" /> WhatsApp Agent
            </Button>
          }
        />
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title={hasDraft ? 'Application in progress' : 'No active loan'}
          description={
            hasDraft
              ? 'You have a pending loan application. Complete your KYC and agreement on the Home dashboard.'
              : 'Your loan will appear here once an application is approved and disbursed.'
          }
          action={
            hasDraft ? (
              <Button asChild size="sm">
                <Link href="/portal">Go to Application <ChevronRight className="h-4 w-4" /></Link>
              </Button>
            ) : undefined
          }
        />
      </div>
    )
  }

  const totalOutstanding = Number(loan.outstandingPrincipal) + Number(loan.outstandingInterest) + Number(loan.outstandingFees)
  const collectedPercent = Number(loan.totalRepayable) > 0 ? Math.round((Number(loan.totalCollected) / Number(loan.totalRepayable)) * 100) : 0
  const totalInterest = Math.max(
    0,
    Number(loan.totalRepayable) -
      Number(loan.principalAmount) -
      Number(loan.processingFee || 0) -
      Number(loan.otherFees || 0)
  )

  return (
    <div className="space-y-6">
      <SectionHeading
        title="My Loan"
        description="Full details of your active loan with Sterling Lending."
        icon={<Wallet className="h-5 w-5" />}
        action={
          <Button variant="outline" size="sm" onClick={onWhatsAppAgent} className="text-info border-info/40 hover:bg-info/10">
            <MessageCircle className="h-4 w-4" /> WhatsApp Agent
          </Button>
        }
      />

      <FadeIn>
        <Card className="shadow-premium overflow-hidden border-amber-400/30 bg-gradient-to-br from-purple-950/20 via-card to-card">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-gradient-gold text-slate-950 flex items-center justify-center flex-shrink-0 shadow-gold">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-sm font-semibold">{loan.loanNumber}</p>
                    <StatusBadge variant={loan.status}>Active</StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Disbursed {fmtDate(loan.disbursedAt)} · {loan.frequency.toLowerCase()} · {loan.installments} installments
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Repayable</p>
                <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">{formatPaiseToINR(Number(loan.totalRepayable))}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Outstanding</p>
                <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">{formatPaiseToINR(totalOutstanding)}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Collected</p>
                <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">{formatPaiseToINR(Number(loan.totalCollected))}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Next Due</p>
                <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">{formatPaiseToINR(Number(loan.installmentAmount))}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Collection progress</span>
                <span className="font-medium">{collectedPercent}% repaid</span>
              </div>
              <Progress value={collectedPercent} className="h-2.5" />
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <FadeIn className="lg:col-span-2">
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><ScrollText className="h-4 w-4" /> Loan Terms & EMI Breakdown</CardTitle>
                <CardDescription className="text-xs">The complete principal, interest, and fee structure of your loan</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.CANDIDATE_TO_AGENT, {
                  candidateName,
                  loanNumber: loan?.loanNumber ?? '',
                }) + '\n\nI would like to request an EMI restructure (e.g. switch to Monthly).'
                openWhatsApp(AGENT_PHONE, msg)
                toast.success('Restructure request opened in WhatsApp')
              }}>Request Restructure</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <TermRow label="Principal Amount" value={formatPaiseToINR(Number(loan.principalAmount))} icon={<IndianRupee className="h-4 w-4" />} />
                <TermRow label="Interest Type" value={loan.interestType === 'PERCENTAGE' ? 'Percentage (flat)' : loan.interestType === 'FIXED' ? 'Fixed Amount' : 'No Interest'} icon={<Percent className="h-4 w-4" />} />
                {loan.interestType === 'PERCENTAGE' && loan.interestRate != null && (
                  <TermRow label="Interest Rate" value={`${formatBpsToPercent(loan.interestRate)} per period`} icon={<Percent className="h-4 w-4" />} />
                )}
                {loan.interestType === 'FIXED' && loan.fixedInterest && (
                  <TermRow label="Fixed Interest" value={formatPaiseToINR(Number(loan.fixedInterest))} icon={<IndianRupee className="h-4 w-4" />} />
                )}
                <TermRow label="Total Interest" value={formatPaiseToINR(totalInterest)} icon={<IndianRupee className="h-4 w-4" />} />
                <TermRow label="Frequency" value={loan.frequency.charAt(0) + loan.frequency.slice(1).toLowerCase()} icon={<CalendarClock className="h-4 w-4" />} />
                <TermRow label="Installments" value={`${loan.installments}`} icon={<Calendar className="h-4 w-4" />} />
                <TermRow label="Installment Amount (EMI)" value={formatPaiseToINR(Number(loan.installmentAmount))} icon={<Banknote className="h-4 w-4" />} />
                {loan.processingFee && Number(loan.processingFee) > 0 && (
                  <TermRow label="Processing Fee" value={formatPaiseToINR(Number(loan.processingFee))} icon={<Receipt className="h-4 w-4" />} />
                )}
                {loan.otherFees && Number(loan.otherFees) > 0 && (
                  <TermRow label="Other Fees" value={formatPaiseToINR(Number(loan.otherFees))} icon={<Receipt className="h-4 w-4" />} />
                )}
                <TermRow label="Total Repayable" value={formatPaiseToINR(Number(loan.totalRepayable))} icon={<Wallet className="h-4 w-4" />} />
                <TermRow label="First Due Date" value={fmtDate(loan.firstDueDate)} icon={<Calendar className="h-4 w-4" />} />
                <TermRow label="Final Due Date" value={fmtDate(loan.finalDueDate)} icon={<Calendar className="h-4 w-4" />} />
              </dl>

              <div className="rounded-xl border border-border bg-muted/20 p-3.5 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance Principal</p>
                  <p className="text-xs sm:text-sm font-semibold tabular-nums mt-0.5">{formatPaiseToINR(Number(loan.outstandingPrincipal))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance Interest</p>
                  <p className="text-xs sm:text-sm font-semibold tabular-nums mt-0.5">{formatPaiseToINR(Number(loan.outstandingInterest))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance Fees</p>
                  <p className="text-xs sm:text-sm font-semibold tabular-nums mt-0.5">{formatPaiseToINR(Number(loan.outstandingFees))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card className="shadow-premium h-full border-info/15">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Disbursement</CardTitle>
              <CardDescription className="text-xs">How the loan reached you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl bg-success/5 p-3 border border-success/20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Amount Disbursed</p>
                <p className="text-xl font-bold mt-1 tabular-nums">{loan.disbursement ? formatPaiseToINR(Number(loan.disbursement.amount)) : formatPaiseToINR(Number(loan.principalAmount))}</p>
              </div>
              <dl className="space-y-2.5">
                <TermRow label="Method" value={loan.disbursement?.method ?? 'Bank Transfer'} small />
                <TermRow label="Date" value={fmtDate(loan.disbursement?.completedAt ?? loan.disbursedAt)} small />
                <TermRow label="Reference" value={loan.disbursement?.reference ?? '—'} small mono />
                <TermRow label="Status" value={loan.disbursement?.status ?? 'COMPLETED'} small />
              </dl>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn>
        <Card className="shadow-premium border-success/15">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-success/15 text-success flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Loan Agreement</CardTitle>
                <CardDescription className="text-xs">Digitally signed & legally binding</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-success/15 text-success flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{activeAgreement?.name ?? 'Standard Personal Loan Agreement'}</p>
                  <p className="text-xs text-muted-foreground">
                    Version {activeAgreement?.version ?? loan.application?.agreementVersion ?? '3.1'} · Accepted {fmtDate(loan.application?.agreementAcceptedAt)}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setAgreementOpen(true)}>
                <ScrollText className="h-4 w-4" /> View Agreement
              </Button>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="border-dashed border-success/30 bg-gradient-to-br from-success/5 to-transparent">
          <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-success/15 text-success flex items-center justify-center flex-shrink-0">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Need a fresh loan?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Contact support or your loan officer to request a new loan application link. Quick decisions, paperless process.</p>
              </div>
            </div>
            <Button asChild>
              <Link href="/portal/support">
                Request Fresh Loan <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>

        </Card>
      </FadeIn>

      <Dialog open={agreementOpen} onOpenChange={setAgreementOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ScrollText className="h-4 w-4" /> {activeAgreement?.name ?? 'Loan Agreement'}</DialogTitle>
            <DialogDescription>Version {activeAgreement?.version ?? '3.1'}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-muted/20 p-4">
            <pre className="text-xs whitespace-pre-wrap font-mono">{activeAgreement?.body ?? 'Agreement body unavailable.'}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onDownloadDoc('Loan Agreement')}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button onClick={() => setAgreementOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TermRow({ label, value, icon, small, mono }: { label: string; value: string; icon?: React.ReactNode; small?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={cn('flex items-center gap-2 text-muted-foreground', small ? 'text-xs' : 'text-sm')}>
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
        {label}
      </dt>
      <dd className={cn('font-medium text-right', small ? 'text-xs' : 'text-sm', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}
