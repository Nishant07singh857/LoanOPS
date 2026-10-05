'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Printer, Download, Receipt, CheckCircle2, Clock,
  Wallet, User, Phone, Banknote, ShieldCheck, AlertTriangle, FileText,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR } from '@/lib/money'

interface ReceiptDetail {
  id: string
  receiptNumber: string
  paymentNumber: string
  status: string
  verificationStatus: 'VERIFIED' | 'PENDING_VERIFICATION' | 'REJECTED' | string
  method: string
  amount: string
  allocatedFees: string
  allocatedInterest: string
  allocatedPrincipal: string
  unallocated?: string
  reference?: string | null
  notes?: string | null
  proofUrl?: string | null
  rejectionReason?: string | null
  createdAt: string
  allocatedAt?: string | null
  verifiedAt?: string | null
  recordedBy?: { id: string; name: string; email?: string | null; phone?: string | null } | null
  recordedByName?: string | null
  verifiedBy?: { id: string; name: string; email?: string | null } | null
  verifiedByName?: string | null
  organization?: { id: string; name: string; logoUrl?: string | null } | null
  candidate: {
    id: string
    fullName: string
    mobile: string
    email?: string | null
    address?: string | null
  }
  loan: {
    id: string
    loanNumber: string
    principalAmount: string
    totalRepayable: string
    outstandingPrincipal: string
    outstandingInterest: string
    outstandingFees: string
    totalOutstanding: string
    totalCollected: string
    status: string
  }
}

function fmtDateTime(d?: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return String(d)
  const dStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const tStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  return `${dStr} · ${tStr}`
}

export default function PrintableReceiptPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const { data: r, isLoading, isError, refetch } = useQuery({
    queryKey: ['receipt', id],
    queryFn: () => api.get<ReceiptDetail>(`/api/receipts/${id}`),
    enabled: Boolean(id),
  })

  const orgName = r?.organization?.name || 'Sterling Lending'
  const receiptNumber = r?.receiptNumber || r?.paymentNumber || '—'
  const paymentNumber = r?.paymentNumber || '—'
  const verificationStatus = r?.verificationStatus || (r?.verifiedAt ? 'VERIFIED' : 'PENDING_VERIFICATION')
  const collectedByName = r?.recordedByName || r?.recordedBy?.name || 'Field Agent'
  const verifiedByName = r?.verifiedByName || r?.verifiedBy?.name || null
  const amountPaise = Number(r?.amount || 0)
  const principalPaise = Number(r?.allocatedPrincipal || 0)
  const interestPaise = Number(r?.allocatedInterest || 0)
  const feesPaise = Number(r?.allocatedFees || 0)
  const remainingOutstandingPaise = Number(
    r?.loan?.totalOutstanding ??
      Number(r?.loan?.outstandingPrincipal || 0) +
        Number(r?.loan?.outstandingInterest || 0) +
        Number(r?.loan?.outstandingFees || 0)
  )

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    if (!r) return
    try {
      const lines = [
        `${orgName.toUpperCase()} — LOANOPS CASH PAYMENT RECEIPT`,
        '====================================================',
        `Receipt Number      : ${receiptNumber}`,
        `Payment Number      : ${paymentNumber}`,
        `Date & Time         : ${fmtDateTime(r.allocatedAt || r.createdAt)}`,
        `Verification Status : ${verificationStatus}`,
        '----------------------------------------------------',
        `Borrower Name       : ${r.candidate.fullName}`,
        `Borrower Mobile     : ${r.candidate.mobile}`,
        `Loan Number         : ${r.loan.loanNumber}`,
        `Collected By (Agent): ${collectedByName}`,
        ...(verifiedByName ? [`Verified By (Owner) : ${verifiedByName}`] : []),
        '----------------------------------------------------',
        'ITEMIZED ALLOCATION:',
        `  Principal Allocated : ${formatPaiseToINR(principalPaise)}`,
        `  Interest Allocated  : ${formatPaiseToINR(interestPaise)}`,
        `  Fees Allocated      : ${formatPaiseToINR(feesPaise)}`,
        '----------------------------------------------------',
        `TOTAL AMOUNT PAID   : ${formatPaiseToINR(amountPaise)}`,
        `REMAINING BALANCE   : ${formatPaiseToINR(remainingOutstandingPaise)}`,
        '====================================================',
      ].join('\n')
      const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${receiptNumber}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Receipt downloaded', { description: `${receiptNumber}.txt saved to your device.` })
    } catch {
      toast.error('Unable to download receipt file')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Top Action Bar (hidden when printing) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="h-10"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!r}
            className="h-10"
          >
            <Download className="h-4 w-4" /> Download Receipt
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            disabled={!r}
            className="h-10"
          >
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="shadow-premium">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      ) : isError || !r ? (
        <Card className="shadow-premium">
          <CardContent className="p-8 text-center space-y-4">
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="Receipt not found"
              description="This payment receipt could not be loaded or you do not have permission to view it."
            />
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
              <Button asChild size="sm">
                <Link href="/portal/receipts">All Receipts</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <FadeIn>
          <Card className="shadow-premium overflow-hidden border-border print:shadow-none print:border-slate-300">
            {/* Official Header Banner */}
            <div className="bg-gradient-to-r from-success/15 via-primary/10 to-transparent p-6 border-b border-border print:bg-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-success text-success-foreground flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {orgName}
                    </p>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5">
                      LoanOps Cash Payment Receipt
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Official Digital Repayment Acknowledgement
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:items-end gap-1.5">
                  <StatusBadge variant={verificationStatus}>
                    {verificationStatus === 'VERIFIED' ? 'VERIFIED' : formatStatus(verificationStatus)}
                  </StatusBadge>
                  <p className="font-mono text-xs text-muted-foreground">
                    Receipt #{receiptNumber}
                  </p>
                </div>
              </div>
            </div>

            <CardContent className="p-6 space-y-6">
              {/* Total Amount Highlight Box */}
              <div className="rounded-2xl border border-success/25 bg-success/5 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Total Amount Paid (INR)
                  </p>
                  <p className="text-3xl sm:text-4xl font-extrabold tabular-nums text-success mt-1">
                    {formatPaiseToINR(amountPaise)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5" /> Payment Method: {r.method.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="sm:text-right space-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Receipt Number: </span>
                    <span className="font-mono font-semibold text-foreground">{receiptNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payment Number: </span>
                    <span className="font-mono font-semibold text-foreground">{paymentNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date &amp; Time: </span>
                    <span className="font-medium text-foreground">{fmtDateTime(r.allocatedAt || r.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Borrower, Loan & Collection Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border p-4 space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Borrower &amp; Loan Details
                  </p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Borrower Name</span>
                      <span className="font-semibold text-right">{r.candidate.fullName}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Mobile Number</span>
                      <span className="font-mono text-xs text-right">{r.candidate.mobile}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Loan Number</span>
                      <span className="font-mono font-semibold text-primary text-right">{r.loan.loanNumber}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Loan Status</span>
                      <span className="font-medium text-right">{formatStatus(r.loan.status)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4 space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" /> Collection &amp; Verification
                  </p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Collected By (Agent)</span>
                      <span className="font-semibold text-right">{collectedByName}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Verification Status</span>
                      <span className="font-semibold text-right">
                        {verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING_VERIFICATION'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Verified By (Owner)</span>
                      <span className="font-medium text-right">
                        {verifiedByName ? verifiedByName : 'Pending Owner Deposit Verification'}
                      </span>
                    </div>
                    {r.verifiedAt && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Verified At</span>
                        <span className="text-xs text-right">{fmtDateTime(r.verifiedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Itemized Allocation Table */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Itemized Payment Allocation &amp; Loan Balance
                </p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="pl-4">Component</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right pr-4">Amount (INR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="pl-4 font-medium">Principal Allocated</TableCell>
                        <TableCell className="text-xs text-muted-foreground">Applied towards loan principal</TableCell>
                        <TableCell className="text-right pr-4 tabular-nums font-semibold">
                          {formatPaiseToINR(principalPaise)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-4 font-medium">Interest Allocated</TableCell>
                        <TableCell className="text-xs text-muted-foreground">Applied towards accrued interest</TableCell>
                        <TableCell className="text-right pr-4 tabular-nums font-semibold">
                          {formatPaiseToINR(interestPaise)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-4 font-medium">Fees Allocated</TableCell>
                        <TableCell className="text-xs text-muted-foreground">Applied towards processing / late fees</TableCell>
                        <TableCell className="text-right pr-4 tabular-nums font-semibold">
                          {formatPaiseToINR(feesPaise)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-success/5 font-bold">
                        <TableCell className="pl-4">Total Amount Paid</TableCell>
                        <TableCell className="text-xs text-muted-foreground">Total cash received for this receipt</TableCell>
                        <TableCell className="text-right pr-4 tabular-nums text-success text-base">
                          {formatPaiseToINR(amountPaise)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableCell className="pl-4 font-semibold">Remaining Loan Outstanding</TableCell>
                        <TableCell className="text-xs text-muted-foreground">Total balance remaining after this payment</TableCell>
                        <TableCell className="text-right pr-4 tabular-nums font-bold text-primary">
                          {formatPaiseToINR(remainingOutstandingPaise)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {r.notes && (
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Collection Note</p>
                  <p className="mt-1 text-foreground">{r.notes}</p>
                </div>
              )}

              {/* Footer Disclaimer */}
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-muted-foreground">
                <p>
                  System-generated official receipt from <span className="font-semibold text-foreground">{orgName}</span>.
                </p>
                <p className="font-mono">
                  ID: {r.id}
                </p>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  )
}
