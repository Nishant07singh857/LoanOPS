'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CreditCard, Banknote, Smartphone, Wallet, Lock, CheckCircle2,
  Clock, ChevronRight, Receipt, AlertCircle, PiggyBank, Building,
  ShieldCheck,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR } from '@/lib/money'
import { cn } from '@/lib/utils'

type Method = 'ONLINE_UPI' | 'ONLINE_NETBANKING' | 'ONLINE_CARD'

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
  status: string
  nextDue?: { installmentNumber: number; dueDate: string; totalDue: string } | null
}

interface PaymentRow {
  id: string
  paymentNumber: string
  loanNumber: string
  amount: string
  method: string
  status: string
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
  const queryClient = useQueryClient()
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
  const lastPayment = payments.find((p) => p.status === 'ALLOCATED')
  const nextInstallmentAmount = loan?.nextDue?.totalDue ?? loan?.installmentAmount ?? '0'
  const nextDue = loan?.nextDue

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Payments"
        description="Pay your next installment and track every payment you've made."
        icon={<CreditCard className="h-5 w-5" />}
      />

      {loan && loan.loanNumber ? (
        <FadeIn>
          <Card className="shadow-premium overflow-hidden border-success/15 bg-gradient-to-br from-success/10 via-card to-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-success/15 text-success flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Pay Next Installment</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-0.5 tabular-nums">{formatPaiseToINR(Number(nextInstallmentAmount))}</p>
                    <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Due {fmtDate(nextDue?.dueDate)} · Installment #{nextDue?.installmentNumber ?? '—'}
                    </p>
                  </div>
                </div>
                <Button size="lg" onClick={() => setPayOpen(true)} className="min-h-[44px]">
                  <CreditCard className="h-4 w-4" /> Pay Now
                </Button>
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
                  <div className="pt-2 mt-2 border-t border-border">
                    <p className="text-[11px] text-muted-foreground">Allocation order: Fees → Interest → Principal</p>
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
                  <Link href="/portal/receipts">Receipts <ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : payments.length === 0 ? (
                <EmptyState icon={<Receipt className="h-6 w-6" />} title="No payments yet" description="Your payment history will appear here." />
              ) : (
                <StaggerContainer className="space-y-3">
                  {payments.map((p) => (
                    <StaggerItem key={p.id}>
                      <div className="rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-premium transition-all">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-xl bg-success/10 text-success flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div>
                                <p className="font-mono text-xs text-muted-foreground font-semibold">{p.paymentNumber}</p>
                                <p className="text-sm font-bold mt-0.5 tabular-nums">{formatPaiseToINR(Number(p.amount))}</p>
                              </div>
                              <StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge>
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
                            {(p.status === 'ALLOCATED' || p.status === 'VERIFIED') && p.receiptNumber && (
                              <Button asChild size="sm" variant="outline" className="h-7 mt-3">
                                <Link href="/portal/receipts">
                                  <Receipt className="h-3.5 w-3.5" /> View Receipt
                                </Link>
                              </Button>
                            )}
                            {p.status === 'PENDING_VERIFICATION' && (
                              <p className="text-[11px] text-warning mt-2 inline-flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Awaiting verification by supervisor
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <PayNowDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        amount={nextInstallmentAmount}
        loanId={loan?.id}
        dueDate={nextDue?.dueDate}
        installmentNumber={nextDue?.installmentNumber}
        onPaid={() => {
          queryClient.invalidateQueries({ queryKey: ['candidate-payments'] })
          queryClient.invalidateQueries({ queryKey: ['candidate-loan'] })
        }}
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

function PayNowDialog({ open, onOpenChange, amount, loanId, dueDate, installmentNumber, onPaid }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  amount: string
  loanId?: string
  dueDate?: string
  installmentNumber?: number
  onPaid?: () => void
}) {
  const [method, setMethod] = React.useState<Method>('ONLINE_UPI')
  const [upiId, setUpiId] = React.useState('')

  const mutation = useMutation({
    mutationFn: () => {
      if (!loanId) throw new Error('No active loan')
      return api.post<{ id: string; paymentNumber: string; status: string }>('/api/candidate/payments', {
        loanId,
        amount,
        method,
        reference: method === 'ONLINE_UPI' && upiId ? `UPI-${upiId}` : null,
      })
    },
    onSuccess: (res) => {
      toast.success('Payment initiated', {
        description: `${formatPaiseToINR(Number(amount))} via ${METHOD_LABEL[method]} · ${res.paymentNumber}. You'll receive a confirmation shortly.`,
      })
      onPaid?.()
      setUpiId(''); setMethod('ONLINE_UPI')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error('Failed to initiate payment', { description: e.message }),
  })

  const submit = () => {
    if (method === 'ONLINE_UPI' && !upiId.trim()) {
      toast.error('Enter your UPI ID')
      return
    }
    mutation.mutate()
  }

  const METHODS: { key: Method; label: string; desc: string; icon: React.ReactNode }[] = [
    { key: 'ONLINE_UPI', label: 'UPI', desc: 'Google Pay · PhonePe · Paytm', icon: <Smartphone className="h-5 w-5" /> },
    { key: 'ONLINE_NETBANKING', label: 'Netbanking', desc: 'Direct bank transfer', icon: <Building className="h-5 w-5" /> },
    { key: 'ONLINE_CARD', label: 'Card', desc: 'Debit / Credit card', icon: <CreditCard className="h-5 w-5" /> },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Pay Installment</DialogTitle>
          <DialogDescription>Installment #{installmentNumber ?? '—'} due {dueDate ? new Date(dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Amount Payable</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{formatPaiseToINR(Number(amount))}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Read-only · This is your scheduled installment amount</p>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as Method)} className="grid grid-cols-1 gap-2">
              {METHODS.map((m) => (
                <label key={m.key} className={cn('rounded-xl border-2 p-3 cursor-pointer transition-all flex items-center gap-3', method === m.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                  <RadioGroupItem value={m.key} className="flex-shrink-0" />
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0', method === m.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                    {m.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-[11px] text-muted-foreground">{m.desc}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {method === 'ONLINE_UPI' && (
            <div className="space-y-1.5">
              <Label htmlFor="upi">UPI ID</Label>
              <Input id="upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@bank" />
              <p className="text-[11px] text-muted-foreground">e.g. priya@okhdfcbank, 9876543210@paytm</p>
            </div>
          )}

          <div className="rounded-lg bg-success/5 border border-success/15 p-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground">256-bit encrypted · PCI DSS compliant · Powered by Razorpay</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            <Lock className="h-4 w-4" /> Pay Securely
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
