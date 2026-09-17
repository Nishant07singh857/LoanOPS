'use client'

import * as React from 'react'
import Link from 'next/link'
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
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { candidateLoan, agreementTemplates } from '@/lib/mock-data'
import { formatPaiseToINR, formatBpsToPercent } from '@/lib/money'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

const AGENT_PHONE = '+91 98201 44556'

const DOCUMENTS = [
  { id: 'doc1', name: 'Aadhaar Card', type: 'PDF', size: '420 KB', uploadedAt: '12 Aug 2024' },
  { id: 'doc2', name: 'PAN Card', type: 'PDF', size: '180 KB', uploadedAt: '12 Aug 2024' },
  { id: 'doc3', name: 'Loan Agreement v3.1', type: 'PDF', size: '1.2 MB', uploadedAt: '12 Aug 2024' },
  { id: 'doc4', name: 'Address Proof', type: 'JPG', size: '640 KB', uploadedAt: '12 Aug 2024' },
]

const DISBURSEMENT = {
  amount: 7500000,
  method: 'ONLINE_BANK_TRANSFER',
  date: '12 Aug 2024',
  reference: 'UTR-AXIS0001245893',
  bank: 'Axis Bank · XXXX5678',
}

export default function LoanDetailPage() {
  const { user } = useSession()
  const candidateName = user?.name || 'Priya Sharma'
  const loan = candidateLoan

  const totalOutstanding = loan.outstandingPrincipal + loan.outstandingInterest + loan.outstandingFees
  const collectedPercent = Math.round((loan.totalCollected / loan.totalRepayable) * 100)

  const onWhatsAppAgent = () => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.CANDIDATE_TO_AGENT, {
      candidateName,
      loanNumber: loan.loanNumber,
    })
    openWhatsApp(AGENT_PHONE, msg)
    toast.success('WhatsApp draft opened', { description: 'Your agent will respond shortly.' })
  }

  const onDownloadDoc = (name: string) => toast.success('Download started', { description: `${name} is being prepared…` })

  const [agreementOpen, setAgreementOpen] = React.useState(false)
  const activeAgreement = agreementTemplates.find((a) => a.isActive) || agreementTemplates[0]

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

      {/* Loan Summary Hero */}
      <FadeIn>
        <Card className="shadow-premium overflow-hidden border-success/15">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-success/15 text-success flex items-center justify-center flex-shrink-0">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-sm font-semibold">{loan.loanNumber}</p>
                    <StatusBadge variant={loan.status}>Active</StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Disbursed {loan.disbursedAt} · {loan.frequency.toLowerCase()} · {loan.installments} installments
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Repayable</p>
                <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">{formatPaiseToINR(loan.totalRepayable)}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Outstanding</p>
                <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">{formatPaiseToINR(totalOutstanding)}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Collected</p>
                <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">{formatPaiseToINR(loan.totalCollected)}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Next Due</p>
                <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">{formatPaiseToINR(loan.installmentAmount)}</p>
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

      {/* Loan Terms + Disbursement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <FadeIn className="lg:col-span-2">
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><ScrollText className="h-4 w-4" /> Loan Terms</CardTitle>
              <CardDescription className="text-xs">The structure of your loan</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <TermRow label="Principal Amount" value={formatPaiseToINR(loan.principalAmount)} icon={<IndianRupee className="h-4 w-4" />} />
                <TermRow label="Interest Type" value={loan.interestType === 'PERCENTAGE' ? 'Percentage (flat)' : loan.interestType === 'FIXED' ? 'Fixed Amount' : 'No Interest'} icon={<Percent className="h-4 w-4" />} />
                {loan.interestType === 'PERCENTAGE' && (
                  <TermRow label="Interest Rate" value={`${formatBpsToPercent(loan.interestRate ?? 0)} per period`} icon={<Percent className="h-4 w-4" />} />
                )}
                {loan.interestType === 'FIXED' && (
                  <TermRow label="Fixed Interest" value={formatPaiseToINR(loan.fixedInterest ?? 0)} icon={<IndianRupee className="h-4 w-4" />} />
                )}
                <TermRow label="Frequency" value={loan.frequency.charAt(0) + loan.frequency.slice(1).toLowerCase()} icon={<CalendarClock className="h-4 w-4" />} />
                <TermRow label="Installments" value={`${loan.installments}`} icon={<Calendar className="h-4 w-4" />} />
                <TermRow label="Installment Amount" value={formatPaiseToINR(loan.installmentAmount)} icon={<Banknote className="h-4 w-4" />} />
                <TermRow label="Processing Fee" value={formatPaiseToINR(50000)} icon={<Receipt className="h-4 w-4" />} />
                <TermRow label="First Due Date" value="12 Aug 2024" icon={<Calendar className="h-4 w-4" />} />
                <TermRow label="Final Due Date" value="20 Jul 2025" icon={<Calendar className="h-4 w-4" />} />
              </dl>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Disbursement */}
        <FadeIn delay={0.05}>
          <Card className="shadow-premium h-full border-info/15">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Disbursement</CardTitle>
              <CardDescription className="text-xs">How the loan reached you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl bg-success/5 p-3 border border-success/20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Amount Disbursed</p>
                <p className="text-xl font-bold mt-1 tabular-nums">{formatPaiseToINR(DISBURSEMENT.amount)}</p>
              </div>
              <dl className="space-y-2.5">
                <TermRow label="Method" value="Bank Transfer" small />
                <TermRow label="Date" value={DISBURSEMENT.date} small />
                <TermRow label="Reference" value={DISBURSEMENT.reference} small mono />
                <TermRow label="Credited To" value={DISBURSEMENT.bank} small />
              </dl>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Documents */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Documents</CardTitle>
                  <CardDescription className="text-xs">{DOCUMENTS.length} loan-related files</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => toast.info('Download all coming soon', { description: 'A consolidated PDF will be emailed to you.' })}>
                Download all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DOCUMENTS.map((d) => (
                <StaggerItem key={d.id}>
                  <div className="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3 hover:border-primary/40 hover:shadow-premium transition-all">
                    <div className="h-10 w-10 rounded-xl bg-info/15 text-info flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{d.name}</p>
                      <p className="text-[11px] text-muted-foreground">{d.type} · {d.size} · {d.uploadedAt}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDownloadDoc(d.name)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Agreement */}
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
                  <p className="text-sm font-medium">{activeAgreement.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Version {activeAgreement.version} · Accepted 12 Aug 2024, 11:42 AM
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

      {/* Apply for new loan CTA */}
      <FadeIn>
        <Card className="border-dashed border-success/30 bg-gradient-to-br from-success/5 to-transparent">
          <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-success/15 text-success flex items-center justify-center flex-shrink-0">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Need a fresh loan?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Apply for a new loan with pre-filled details. Quick decisions, paperless process.</p>
              </div>
            </div>
            <Button asChild>
              <Link href="/apply/a3f8d2e91b7c4f0a8e2d1b6c9f4a3e8d">
                Apply for New Loan <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Agreement dialog */}
      <Dialog open={agreementOpen} onOpenChange={setAgreementOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ScrollText className="h-4 w-4" /> {activeAgreement.name}</DialogTitle>
            <DialogDescription>Version {activeAgreement.version} · Effective {activeAgreement.effectiveDate}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-muted/20 p-4">
            <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-line">
              {activeAgreement.body}
              {'\n\n'}
              <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
                This is a sample agreement body. The full agreement includes the principal amount of {formatPaiseToINR(loan.principalAmount)}, the interest rate of {formatBpsToPercent(loan.interestRate ?? 0)} per period (flat method), {loan.installments} {loan.frequency.toLowerCase()} installments of {formatPaiseToINR(loan.installmentAmount)} each, with first due on 12 Aug 2024 and final due on 20 Jul 2025. The processing fee of {formatPaiseToINR(50000)} has been collected at disbursement. By accepting this agreement, the borrower commits to timely repayment as per the schedule above. Late payments may attract penalty charges as defined in clause 7. Prepayment is allowed without penalty.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onDownloadDoc('Loan Agreement v3.1')}>
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
