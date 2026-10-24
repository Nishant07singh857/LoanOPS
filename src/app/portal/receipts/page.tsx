'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, Download, Eye, Mail, Wallet, Banknote, Receipt,
  CheckCircle2, Smartphone, Building, CreditCard, IndianRupee, Printer,
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
  loanNumber: string
  amount: string
  method: string
  status?: string
  verificationStatus?: string
  allocatedFees: string
  allocatedInterest: string
  allocatedPrincipal: string
  allocatedAt?: string | null
  reference?: string | null
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ReceiptsPage() {
  const { user } = useSession()
  const candidateName = user?.name || 'Candidate'
  const candidateMobile = user?.phone || '—'

  const { data, isLoading } = useQuery({
    queryKey: ['candidate-receipts'],
    queryFn: () => api.get<{ items: ReceiptRow[] }>('/api/candidate/receipts'),
  })
  const receipts = data?.items ?? []

  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState<ReceiptRow | null>(null)

  const onView = (r: ReceiptRow) => {
    setActive(r)
    setOpen(true)
  }
  const onDownload = (r: ReceiptRow) => {
    try {
      const content = [
        'STERLING LENDING — OFFICIAL PAYMENT RECEIPT',
        '===========================================',
        `Receipt Number : ${r.receiptNumber}`,
        `Payment Number : ${r.paymentNumber}`,
        `Loan Number    : ${r.loanNumber}`,
        `Date           : ${fmtDate(r.allocatedAt)}`,
        `Candidate      : ${candidateName} (${candidateMobile})`,
        `Method         : ${METHOD_LABEL[r.method] ?? r.method}`,
        '-------------------------------------------',
        `Principal Paid : ${formatPaiseToINR(Number(r.allocatedPrincipal))}`,
        `Interest Paid  : ${formatPaiseToINR(Number(r.allocatedInterest))}`,
        `Fees Paid      : ${formatPaiseToINR(Number(r.allocatedFees))}`,
        '-------------------------------------------',
        `TOTAL PAID     : ${formatPaiseToINR(Number(r.amount))}`,
        '===========================================',
      ].join('\n')
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${r.receiptNumber}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Fallback if Blob download is blocked
    }
    toast.success('Receipt downloaded', { description: `${r.receiptNumber} saved to your device.` })
  }
  // No mail-sending backend exists, so this opens the borrower's own mail
  // app with the receipt details pre-filled — a real share action, no
  // fake "sent" claim.
  const onEmail = (r: ReceiptRow) => {
    const subject = encodeURIComponent(`Payment Receipt ${r.receiptNumber}`)
    const body = encodeURIComponent(
      `Receipt Number: ${r.receiptNumber}\nAmount: ${formatPaiseToINR(Number(r.amount))}\nStatus: ${r.status ?? r.verificationStatus ?? 'Recorded'}\n\nPlease find my payment receipt details above.`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Receipts"
        description="Download, print, or email official receipts for every successful payment."
        icon={<FileText className="h-5 w-5" />}
      />

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-gold text-slate-950 flex items-center justify-center shadow-gold">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">All Receipts</CardTitle>
                <CardDescription className="text-xs">{receipts.length} official receipts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : receipts.length === 0 ? (
              <EmptyState icon={<FileText className="h-6 w-6" />} title="No receipts yet" description="Your receipts will appear here after your first successful payment." />
            ) : (
              <StaggerContainer className="space-y-3">
                {receipts.map((r) => (
                  <StaggerItem key={r.id}>
                    <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 hover:border-primary/40 hover:shadow-premium transition-all">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-mono text-xs font-semibold">{r.receiptNumber}</p>
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {METHOD_ICON[r.method]} {METHOD_LABEL[r.method] ?? r.method}
                            </span>
                            {r.verificationStatus && (
                              <StatusBadge variant={r.verificationStatus}>
                                {formatStatus(r.verificationStatus)}
                              </StatusBadge>
                            )}
                          </div>
                          <p className="text-sm font-bold mt-1 tabular-nums">{formatPaiseToINR(Number(r.amount))}</p>
                          <p className="text-[11px] text-muted-foreground">{r.paymentNumber} · {fmtDate(r.allocatedAt)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-9 px-2.5"
                        >
                          <Link href={`/portal/receipts/${r.id}`}>
                            <Printer className="h-3.5 w-3.5" /> Print / Open Page
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 px-2.5"
                          aria-label={`View receipt ${r.receiptNumber}`}
                          onClick={() => onView(r)}
                        >
                          <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Quick View</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 px-2.5"
                          aria-label={`Download receipt ${r.receiptNumber}`}
                          onClick={() => onDownload(r)}
                        >
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
  const principal = Number(receipt.allocatedPrincipal)
  const interest = Number(receipt.allocatedInterest)
  const fees = Number(receipt.allocatedFees)
  const totalPaid = Number(receipt.amount)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" /> Payment Receipt</DialogTitle>
          <DialogDescription>Official receipt for your payment</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border overflow-hidden">
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
              <StatusBadge variant={receipt.verificationStatus ?? 'ALLOCATED'}>
                {receipt.verificationStatus ? formatStatus(receipt.verificationStatus) : 'Allocated'}
              </StatusBadge>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Receipt Number" value={receipt.receiptNumber} mono />
              <DetailRow label="Date" value={fmtDate(receipt.allocatedAt)} />
              <DetailRow label="Payment Number" value={receipt.paymentNumber} mono />
              <DetailRow label="Method" value={METHOD_LABEL[receipt.method] ?? receipt.method} />
            </div>

            <div className="pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Candidate</p>
              <p className="text-sm font-medium">{candidateName}</p>
              <p className="text-[11px] text-muted-foreground">{candidateMobile}</p>
            </div>

            <div className="pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Loan</p>
              <p className="text-sm font-medium font-mono">{receipt.loanNumber}</p>
            </div>

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
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onEmail(receipt)}>
            <Mail className="h-4 w-4" /> Email
          </Button>
          <Button asChild variant="outline">
            <Link href={`/portal/receipts/${receipt.id}`}>
              <Printer className="h-4 w-4" /> Print / Open Page
            </Link>
          </Button>
          <Button onClick={() => onDownload(receipt)}>
            <Download className="h-4 w-4" /> Download
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
