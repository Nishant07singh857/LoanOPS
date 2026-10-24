'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Receipt, Printer, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'
import { formatPaiseToINR } from '@/lib/money'
import { formatStatus } from '@/components/ui/status-badge'

interface ReceiptData {
  id: string
  receiptNumber: string
  paymentNumber: string
  status: string
  method: string
  amount: string
  allocatedFees: string
  allocatedInterest: string
  allocatedPrincipal: string
  unallocated: string
  reference?: string | null
  createdAt: string
  allocatedAt: string
  verifiedAt?: string | null
  recordedByName?: string | null
  organization?: { name: string } | null
  candidate: { fullName: string; mobile: string }
  loan: { loanNumber: string }
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={strong ? 'text-base font-bold tabular-nums' : 'text-sm font-medium tabular-nums'}>{value}</span>
    </div>
  )
}

export default function AgentReceiptPage() {
  const params = useParams<{ id: string }>()
  const id = params.id as string

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['receipt', id],
    queryFn: () => api.get<ReceiptData>(`/api/receipts/${id}`),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <Receipt className="h-10 w-10 mx-auto text-destructive mb-4" />
        <h1 className="text-xl font-bold">Receipt not available</h1>
        <p className="text-sm text-muted-foreground mt-2">This receipt was not found, or you do not have permission to view it.</p>
        <div className="mt-6 flex gap-2 justify-center">
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          <Button asChild><Link href="/agent/cash">Back to Cash Collections</Link></Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/agent/cash"><ArrowLeft className="h-4 w-4" /> Back to Cash Collections</Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print Receipt
        </Button>
      </div>

      <Card className="shadow-premium">
        <CardContent className="p-6 space-y-4">
          <div className="text-center border-b border-border pb-4">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
              <Receipt className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-bold">{data.organization?.name ?? 'Payment Receipt'}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Payment Receipt · {data.receiptNumber}</p>
          </div>

          <div className="divide-y divide-border/60">
            <Row label="Receipt Number" value={data.receiptNumber} />
            <Row label="Payment Number" value={data.paymentNumber} />
            <Row label="Borrower" value={data.candidate.fullName} />
            <Row label="Borrower Mobile" value={data.candidate.mobile} />
            <Row label="Loan Number" value={data.loan.loanNumber} />
            <Row label="Payment Method" value={data.method.replace(/_/g, ' ')} />
            <Row label="Status" value={formatStatus(data.status)} />
            <Row label="Payment Date" value={fmtDate(data.allocatedAt ?? data.createdAt)} />
            {data.reference && <Row label="Reference" value={data.reference} />}
            <Row label="Recorded By" value={data.recordedByName ?? '—'} />
          </div>

          <div className="rounded-xl bg-muted/40 border border-border p-4 divide-y divide-border/60">
            <Row label="Towards Fees" value={formatPaiseToINR(Number(data.allocatedFees))} />
            <Row label="Towards Interest" value={formatPaiseToINR(Number(data.allocatedInterest))} />
            <Row label="Towards Principal" value={formatPaiseToINR(Number(data.allocatedPrincipal))} />
            {Number(data.unallocated) > 0 && <Row label="Unallocated (excess)" value={formatPaiseToINR(Number(data.unallocated))} />}
            <Row label="Total Amount" value={formatPaiseToINR(Number(data.amount))} strong />
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            This is a computer-generated receipt. Allocation order: Fees → Interest → Principal.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
