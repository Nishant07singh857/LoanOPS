'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  CreditCard, Banknote, Smartphone, Wallet, CheckCircle2,
  Clock, ChevronRight, Receipt, AlertCircle, PiggyBank, Building,
  ShieldCheck, MessageCircle, UserCheck, Phone,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR } from '@/lib/money'
import { openWhatsApp } from '@/lib/whatsapp'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

const DEFAULT_AGENT_PHONE = '+91 98201 44556'
const DEFAULT_AGENT_NAME = 'Arjun Nair'

const METHOD_BADGE_VARIANT: Record<string, string> = {
  ONLINE_UPI: 'info',
  ONLINE_NETBANKING: 'info',
  ONLINE_CARD: 'info',
  CASH: 'warning',
  BANK_TRANSFER: 'info',
}

const METHOD_LABEL: Record<string, string> = {
  ONLINE_UPI: 'UPI',
  ONLINE_NETBANKING: 'Netbanking',
  ONLINE_CARD: 'Card',
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  ONLINE_UPI: <Smartphone className="h-3 w-3" />,
  ONLINE_NETBANKING: <Building className="h-3 w-3" />,
  ONLINE_CARD: <CreditCard className="h-3 w-3" />,
  CASH: <Banknote className="h-3 w-3" />,
  BANK_TRANSFER: <Building className="h-3 w-3" />,
}

interface CandidateLoan {
  id: string
  loanNumber?: string
  installmentAmount: string
  outstandingPrincipal?: string
  outstandingInterest?: string
  outstandingFees?: string
  status: string
  assignedAgent?: { id?: string; name?: string; phone?: string | null } | null
  nextDue?: { installmentNumber: number; dueDate: string; totalDue: string } | null
}

interface PaymentRow {
  id: string
  paymentNumber: string
  loanNumber: string
  amount: string
  method: string
  status: string
  verificationStatus?: string
  reference?: string | null
  receiptNumber?: string | null
  allocatedFees: string
  allocatedInterest: string
  allocatedPrincipal: string
  createdAt: string
  allocatedAt?: string | null
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PaymentsPage() {
  const { user } = useSession()
  const candidateName = user?.name || 'Candidate'
  const [payOpen, setPayOpen] = React.useState(false)

  const { data: loan } = useQuery({
    queryKey: ['candidate-loan'],
    queryFn: () => api.get<CandidateLoan>('/api/candidate/loan'),
    retry: false,
  })

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['candidate-payments'],
    queryFn: () => api.get<{ items: PaymentRow[]; total: number }>('/api/candidate/payments?pageSize=100'),
  })
  const payments = paymentsData?.items ?? []
  const lastPayment = payments.find((p) => p.status === 'ALLOCATED' || p.status === 'VERIFIED')
  const nextInstallmentAmount = loan?.nextDue?.totalDue ?? loan?.installmentAmount ?? '0'
  const nextDue = loan?.nextDue

  const agentName = loan?.assignedAgent?.name || DEFAULT_AGENT_NAME
  const agentPhone = loan?.assignedAgent?.phone || DEFAULT_AGENT_PHONE

  const handleWhatsAppPickup = () => {
    const amountFormatted = (Number(nextInstallmentAmount) / 100).toLocaleString('en-IN')
    const msg = `Hello ${agentName}, I would like to schedule a cash pickup of ₹${amountFormatted} for my loan ${loan?.loanNumber ?? ''} (Installment #${nextDue?.installmentNumber ?? '—'}). - ${candidateName}`
    openWhatsApp(agentPhone, msg)
    toast.success('WhatsApp opened', { description: `Pickup request drafted for ${agentName}.` })
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Payments"
        description="Coordinate offline cash repayments with your assigned field agent and view every digital receipt."
        icon={<Banknote className="h-5 w-5" />}
      />

      {loan && loan.loanNumber ? (
        <FadeIn>
          <Card className="shadow-premium overflow-hidden border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-card to-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-gold text-slate-950 flex items-center justify-center flex-shrink-0 shadow-gold">
                    <Banknote className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Next Installment Due (Cash Collection)</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-0.5 tabular-nums">{formatPaiseToINR(Number(nextInstallmentAmount))}</p>
                    <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Due {fmtDate(nextDue?.dueDate)} · Installment #{nextDue?.installmentNumber ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleWhatsAppPickup}
                    className="min-h-[44px] text-info border-info/40 hover:bg-info/10"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp Agent
                  </Button>
                  <Button
                    size="lg"
                    variant="gold"
                    onClick={() => setPayOpen(true)}
                    className="min-h-[44px] shadow-gold"
                  >
                    <Banknote className="h-4 w-4" /> Request Agent Collection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <FadeIn>
          <Card className="shadow-premium h-full border-info/15">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Last Payment Allocation</CardTitle>
              <CardDescription className="text-xs">
                {lastPayment ? `${lastPayment.paymentNumber} · ${fmtDate(lastPayment.allocatedAt ?? lastPayment.createdAt)}` : '—'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {lastPayment ? (
                <>
                  <AllocRow label="Total Paid" amount={Number(lastPayment.amount)} highlight />
                  <AllocRow label="Towards Principal" amount={Number(lastPayment.allocatedPrincipal)} icon={<Wallet className="h-4 w-4" />} tint="text-primary" />
                  <AllocRow label="Towards Interest" amount={Number(lastPayment.allocatedInterest)} icon={<Banknote className="h-4 w-4" />} tint="text-info" />
                  <AllocRow label="Towards Fees" amount={Number(lastPayment.allocatedFees)} icon={<Receipt className="h-4 w-4" />} tint="text-warning" />
                  <div className="pt-2 mt-2 border-t border-border flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">Allocation: Fees → Interest → Principal</p>
                    <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                      <Link href={`/portal/receipts/${lastPayment.id}`}>
                        Receipt <ChevronRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <EmptyState icon={<PiggyBank className="h-6 w-6" />} title="No allocations yet" description="Your last payment will appear here." />
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05} className="lg:col-span-2">
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Payment History</CardTitle>
                    <CardDescription className="text-xs">{payments.length} payments</CardDescription>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/portal/receipts">All Receipts <ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : payments.length === 0 ? (
                <EmptyState icon={<Receipt className="h-6 w-6" />} title="No payments yet" description="Your payment history will appear here once cash is collected by your agent." />
              ) : (
                <StaggerContainer className="space-y-3">
                  {payments.map((p) => {
                    const verStatus = p.verificationStatus ?? (p.status === 'PENDING_VERIFICATION' ? 'PENDING_VERIFICATION' : 'VERIFIED')
                    return (
                      <StaggerItem key={p.id}>
                        <div className="rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-premium transition-all">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-xl bg-success/10 text-success flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                  <p className="font-mono text-xs text-muted-foreground font-semibold">
                                    {p.receiptNumber ? `${p.receiptNumber} · ${p.paymentNumber}` : p.paymentNumber}
                                  </p>
                                  <p className="text-sm font-bold mt-0.5 tabular-nums">{formatPaiseToINR(Number(p.amount))}</p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge>
                                  {p.verificationStatus && p.verificationStatus !== p.status && (
                                    <StatusBadge variant={p.verificationStatus}>
                                      {formatStatus(p.verificationStatus)}
                                    </StatusBadge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Clock className="h-3 w-3" /> {fmtDate(p.allocatedAt ?? p.createdAt)}
                                </span>
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
                                    METHOD_BADGE_VARIANT[p.method] === 'warning' ? 'bg-warning/15 text-warning' : 'bg-info/15 text-info'
                                  )}
                                >
                                  {METHOD_ICON[p.method]} {METHOD_LABEL[p.method] ?? p.method}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-border/60 flex-wrap">
                                <div className="text-[11px] text-muted-foreground">
                                  {verStatus === 'PENDING_VERIFICATION' ? (
                                    <span className="text-warning inline-flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" /> Cash deposit pending Owner verification
                                    </span>
                                  ) : (
                                    <span className="text-success inline-flex items-center gap-1">
                                      <ShieldCheck className="h-3 w-3" /> Verified payment
                                    </span>
                                  )}
                                </div>
                                <Button asChild size="sm" variant="outline" className="h-8">
                                  <Link href={`/portal/receipts/${p.id}`}>
                                    <Receipt className="h-3.5 w-3.5" /> View Receipt
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </StaggerItem>
                    )
                  })}
                </StaggerContainer>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <OfflineCashCollectionDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        amount={nextInstallmentAmount}
        loanNumber={loan?.loanNumber}
        dueDate={nextDue?.dueDate}
        installmentNumber={nextDue?.installmentNumber}
        agentName={agentName}
        agentPhone={agentPhone}
        onWhatsAppPickup={handleWhatsAppPickup}
      />
    </div>
  )
}

function AllocRow({ label, amount, icon, tint, highlight }: { label: string; amount: number; icon?: React.ReactNode; tint?: string; highlight?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-2', highlight && 'pb-2 border-b border-border')}>
      <span className={cn('flex items-center gap-2 text-xs', highlight ? 'font-medium text-foreground' : 'text-muted-foreground')}>
        {icon && <span className={tint || 'text-muted-foreground'}>{icon}</span>}
        {label}
      </span>
      <span className={cn('font-semibold tabular-nums', highlight ? 'text-base' : 'text-sm')}>{formatPaiseToINR(amount)}</span>
    </div>
  )
}

function OfflineCashCollectionDialog({
  open,
  onOpenChange,
  amount,
  loanNumber,
  dueDate,
  installmentNumber,
  agentName,
  agentPhone,
  onWhatsAppPickup,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  amount: string
  loanNumber?: string
  dueDate?: string
  installmentNumber?: number
  agentName: string
  agentPhone: string
  onWhatsAppPickup: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-success" /> Offline Cash Payment / Request Agent Collection
          </DialogTitle>
          <DialogDescription>
            {loanNumber ? `${loanNumber} · ` : ''}Installment #{installmentNumber ?? '—'} due {dueDate ? fmtDate(dueDate) : '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-muted/40 border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Installment Amount Due</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{formatPaiseToINR(Number(amount))}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Allocated automatically upon collection: Fees → Interest → Principal
            </p>
          </div>

          <div className="rounded-xl border border-info/30 bg-info/10 p-3.5 text-xs text-foreground space-y-1.5">
            <p className="font-semibold text-info flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 flex-shrink-0" /> How Offline Cash Collection Works
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Repayments are collected in cash by your assigned field agent. Upon collection, your schedule updates immediately and a digital receipt is issued.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Assigned Field Agent</p>
                  <p className="text-sm font-semibold">{agentName}</p>
                  <p className="text-xs font-mono text-muted-foreground">{agentPhone}</p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="h-9">
                <a href={`tel:${agentPhone.replace(/\s/g, '')}`}>
                  <Phone className="h-3.5 w-3.5" /> Call
                </a>
              </Button>
            </div>

            <Button
              type="button"
              onClick={onWhatsAppPickup}
              className="w-full h-11 bg-success text-success-foreground hover:bg-success/90"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp Assigned Agent for Pickup
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
