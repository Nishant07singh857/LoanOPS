'use client'

import * as React from 'react'
import {
  FileText, Download, Eye, Mail, Wallet, Banknote, Receipt,
  CheckCircle2, Smartphone, Building, CreditCard, IndianRupee,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { candidatePayments, candidateLoan } from '@/lib/mock-data'
import { formatPaiseToINR } from '@/lib/money'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

const METHOD_LABEL: Record<string, string> = {
  ONLINE_UPI: 'UPI',
  ONLINE_NETBANKING: 'Netbanking',
  ONLINE_CARD: 'Card',
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  ONLINE_UPI: <Smartphone className="h-4 w-4" />,
  ONLINE_NETBANKING: <Building className="h-4 w-4" />,
  ONLINE_CARD: <CreditCard className="h-4 w-4" />,
  CASH: <Banknote className="h-4 w-4" />,
  BANK_TRANSFER: <Building className="h-4 w-4" />,
}

interface ReceiptRow {
  id: string
  receiptNumber: string
  paymentNumber: string
  amount: number
  method: string
  date: string
  status: string
  allocatedPrincipal?: number
  allocatedInterest?: number
}

export default function ReceiptsPage() {
  const { user } = useSession()
  const candidateName = user?.name || 'Priya Sharma'
  const candidateMobile = user?.phone || '+91 98202 77889'

  // Derive receipts from candidatePayments where status is ALLOCATED or VERIFIED
  const receipts: ReceiptRow[] = candidatePayments
    .filter((p) => p.status === 'ALLOCATED' || p.status === 'VERIFIED')
    .map((p) => ({
      id: p.id,
      receiptNumber: p.receiptNumber || `RCP-${p.id.toUpperCase()}`,
      paymentNumber: p.paymentNumber,
      amount: p.amount,
      method: p.method,
      date: p.date,
      status: p.status,
      allocatedPrincipal: p.allocatedPrincipal,
      allocatedInterest: p.allocatedInterest,
    }))

  // Synthesize 2 more historical receipts for a fuller page
  const extraReceipts: ReceiptRow[] = [
    { id: 'r3', receiptNumber: 'RCP-2024-8832', paymentNumber: 'PAY-2024-8810', amount: 742500, method: 'ONLINE_UPI', date: '12 Jul 2024', status: 'ALLOCATED', allocatedPrincipal: 500000, allocatedInterest: 242500 },
  ]

  const allReceipts = [...receipts, ...extraReceipts]

  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState<ReceiptRow | null>(null)

  const onView = (r: ReceiptRow) => {
    setActive(r)
    setOpen(true)
  }
  const onDownload = (r: ReceiptRow) => toast.success('Generating PDF…', { description: `${r.receiptNumber} will be saved to your device.` })
  const onEmail = (r: ReceiptRow) => toast.success('Emailing receipt…', { description: `${r.receiptNumber} sent to your registered email.` })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Receipts"
        description="Download or email official receipts for every successful payment."
        icon={<FileText className="h-5 w-5" />}
      />

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-info/15 text-info flex items-center justify-center">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">All Receipts</CardTitle>
                <CardDescription className="text-xs">{allReceipts.length} official receipts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {allReceipts.length === 0 ? (
              <EmptyState icon={<FileText className="h-6 w-6" />} title="No receipts yet" description="Your receipts will appear here after your first successful payment." />
            ) : (
              <StaggerContainer className="space-y-3">
                {allReceipts.map((r) => (
                  <StaggerItem key={r.id}>
                    <div className="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3 hover:border-primary/40 hover:shadow-premium transition-all">
                      <div className="h-10 w-10 rounded-xl bg-success/10 text-success flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-mono text-xs font-semibold">{r.receiptNumber}</p>
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {METHOD_ICON[r.method]} {METHOD_LABEL[r.method]}
                          </span>
                        </div>
                        <p className="text-sm font-bold mt-1 tabular-nums">{formatPaiseToINR(r.amount)}</p>
                        <p className="text-[11px] text-muted-foreground">{r.paymentNumber} · {r.date}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-1.5">
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onView(r)}>
                          <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">View</span>
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onDownload(r)}>
                          <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Download</span>
                        </Button>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Receipt dialog */}
      <ReceiptDialog
        open={open}
        onOpenChange={setOpen}
        receipt={active}
        candidateName={candidateName}
        candidateMobile={candidateMobile}
        onDownload={onDownload}
        onEmail={onEmail}
      />
    </div>
  )
}

function ReceiptDialog({
  open, onOpenChange, receipt, candidateName, candidateMobile, onDownload, onEmail,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  receipt: ReceiptRow | null
  candidateName: string
  candidateMobile: string
  onDownload: (r: ReceiptRow) => void
  onEmail: (r: ReceiptRow) => void
}) {
  if (!receipt) return null
  const principal = receipt.allocatedPrincipal ?? 0
  const interest = receipt.allocatedInterest ?? 0
  const fees = 0
  const totalPaid = receipt.amount
  const remaining = candidateLoan.outstandingPrincipal + candidateLoan.outstandingInterest - principal

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" /> Payment Receipt</DialogTitle>
          <DialogDescription>Official receipt for your payment</DialogDescription>
        </DialogHeader>

        {/* Receipt body */}
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="bg-success/10 p-4 border-b border-success/20">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-success text-success-foreground flex items-center justify-center">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">Sterling Lending</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Official Payment Receipt</p>
                </div>
              </div>
              <StatusBadge variant={receipt.status}>{formatStatus(receipt.status)}</StatusBadge>
            </div>
          </div>

          {/* Receipt details */}
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Receipt Number" value={receipt.receiptNumber} mono />
              <DetailRow label="Date" value={receipt.date} />
              <DetailRow label="Payment Number" value={receipt.paymentNumber} mono />
              <DetailRow label="Method" value={METHOD_LABEL[receipt.method]} />
            </div>

            <div className="pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Candidate</p>
              <p className="text-sm font-medium">{candidateName}</p>
              <p className="text-[11px] text-muted-foreground">{candidateMobile}</p>
            </div>

            <div className="pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Loan</p>
              <p className="text-sm font-medium font-mono">{candidateLoan.loanNumber}</p>
              <p className="text-[11px] text-muted-foreground">{candidateLoan.frequency.charAt(0) + candidateLoan.frequency.slice(1).toLowerCase()} · Installment #1</p>
            </div>

            {/* Payment breakdown */}
            <div className="pt-3 border-t border-border space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Payment Breakdown</p>
              <BreakRow icon={<IndianRupee className="h-3.5 w-3.5" />} label="Principal" amount={principal} tint="text-primary" />
              <BreakRow icon={<Banknote className="h-3.5 w-3.5" />} label="Interest" amount={interest} tint="text-info" />
              {fees > 0 && <BreakRow icon={<Receipt className="h-3.5 w-3.5" />} label="Fees" amount={fees} tint="text-warning" />}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-border">
                <span className="text-sm font-semibold">Total Paid</span>
                <span className="text-base font-bold tabular-nums">{formatPaiseToINR(totalPaid)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border bg-muted/20 -mx-4 -mb-4 px-4 py-3">
              <span className="text-xs text-muted-foreground">Remaining Balance</span>
              <span className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Math.max(0, remaining))}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onEmail(receipt)}>
            <Mail className="h-4 w-4" /> Email
          </Button>
          <Button onClick={() => onDownload(receipt)}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm font-medium mt-0.5', mono && 'font-mono')}>{value}</p>
    </div>
  )
}

function BreakRow({ icon, label, amount, tint }: { icon: React.ReactNode; label: string; amount: number; tint: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={tint}>{icon}</span>
        {label}
      </span>
      <span className="text-sm font-medium tabular-nums">{formatPaiseToINR(amount)}</span>
    </div>
  )
}
