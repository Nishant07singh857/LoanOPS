'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Receipt, Building2, Banknote, CreditCard, Search, Eye, XCircle, Clock, AlertTriangle, Printer,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'

interface PaymentRow {
  id: string
  paymentNumber: string
  loanNumber: string
  candidateName: string
  candidateMobile: string
  amount: string
  method: string
  status: string
  receiptNumber?: string | null
  reference?: string | null
  allocatedFees?: string
  allocatedInterest?: string
  allocatedPrincipal?: string
  createdAt: string
  allocatedAt?: string | null
}

const methodIcon: Record<string, React.ReactNode> = {
  ONLINE_UPI: <Building2 className="h-3.5 w-3.5" />,
  ONLINE_NETBANKING: <Building2 className="h-3.5 w-3.5" />,
  ONLINE_CARD: <CreditCard className="h-3.5 w-3.5" />,
  CASH: <Banknote className="h-3.5 w-3.5" />,
  BANK_TRANSFER: <Building2 className="h-3.5 w-3.5" />,
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PaymentsPage() {
  const [method, setMethod] = React.useState<string>('all')
  const [status, setStatus] = React.useState<string>('all')
  const [search, setSearch] = React.useState('')
  const [selectedReceipt, setSelectedReceipt] = React.useState<PaymentRow | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-payments', method, status, search],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '100' })
      if (method !== 'all') params.set('method', method)
      if (status !== 'all') params.set('status', status)
      if (search) params.set('search', search)
      return api.get<{ items: PaymentRow[]; total: number }>(`/api/owner/payments?${params.toString()}`)
    },
  })

  const { data: dashboard } = useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: () => api.get<{ totalDisbursed?: string }>('/api/owner/dashboard'),
  })

  const rows = data?.items ?? []
  const totalToday = rows.reduce((s, r) => s + Number(r.amount), 0)
  const onlineTotal = rows.filter((r) => r.method !== 'CASH').reduce((s, r) => s + Number(r.amount), 0)
  const cashTotal = rows.filter((r) => r.method === 'CASH').reduce((s, r) => s + Number(r.amount), 0)
  const pendingVerify = rows.filter((r) => r.status === 'PENDING_VERIFICATION').length
  const failed = rows.filter((r) => r.status === 'FAILED' || r.status === 'REJECTED').length
  const totalDisbursedVal = dashboard?.totalDisbursed ? formatPaiseToINRShort(Number(dashboard.totalDisbursed)) : '—'

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Payments"
        description="All payments across online and cash channels with verification status."
        icon={<Receipt className="h-5 w-5" />}
      />

      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StaggerItem>
          <KPICard label="Total Collected" value={formatPaiseToINRShort(totalToday)} icon={<Receipt className="h-5 w-5" />} variant="success" spark={[200, 240, 280, 300, 320, 360, 380]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Total Disbursed" value={totalDisbursedVal} icon={<Banknote className="h-5 w-5" />} variant="default" />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Online vs Cash" value={onlineTotal + cashTotal > 0 ? `${Math.round(onlineTotal / (onlineTotal + cashTotal) * 100)}% / ${Math.round(cashTotal / (onlineTotal + cashTotal) * 100)}%` : '—'} icon={<Building2 className="h-5 w-5" />} variant="info" />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Pending Verification" value={String(pendingVerify)} icon={<Clock className="h-5 w-5" />} variant="warning" spark={[3, 4, 5, 6, 7, 8, 9]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Failed / Rejected" value={String(failed)} icon={<XCircle className="h-5 w-5" />} variant="destructive" spark={[1, 1, 2, 2, 1, 1, 1]} />
        </StaggerItem>
      </StaggerContainer>

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col md:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  aria-label="Search payments by payment number, candidate, or loan"
                  placeholder="Search payment #, candidate, loan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-11"
                />
              </div>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="w-full md:w-[190px] h-11" aria-label="Filter by payment method">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  <SelectItem value="ONLINE_UPI">Online UPI</SelectItem>
                  <SelectItem value="ONLINE_NETBANKING">Online Netbanking</SelectItem>
                  <SelectItem value="ONLINE_CARD">Online Card</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full md:w-[190px] h-11" aria-label="Filter by payment status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="INITIATED">Initiated</SelectItem>
                  <SelectItem value="PENDING_VERIFICATION">Pending Verification</SelectItem>
                  <SelectItem value="VERIFIED">Verified</SelectItem>
                  <SelectItem value="ALLOCATED">Allocated</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3 space-y-1">
            <CardTitle className="text-base">All Payments</CardTitle>
            <CardDescription className="mt-1">{rows.length} payments</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2" role="status" aria-label="Loading payments">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : isError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3" role="alert">
                <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
                <p className="text-sm font-medium text-destructive">Failed to load payments</p>
                <Button variant="outline" size="sm" className="h-11 px-4" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <EmptyState icon={<Receipt className="h-6 w-6" />} title="No payments found" description="Payments will appear here once candidates pay or agents record cash." />
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="pl-6">Payment #</TableHead>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Loan</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right pr-6">Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="pl-6 font-mono text-xs font-semibold text-primary">{r.paymentNumber}</TableCell>
                          <TableCell className="font-medium">{r.candidateName}</TableCell>
                          <TableCell className="font-mono text-xs">{r.loanNumber}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                              {methodIcon[r.method]}{r.method.replace(/_/g, ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{fmtDate(r.createdAt)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatPaiseToINR(Number(r.amount))}</TableCell>
                          <TableCell><StatusBadge variant={r.status}>{formatStatus(r.status)}</StatusBadge></TableCell>
                          <TableCell className="text-right pr-6">
                            {r.receiptNumber ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0"
                                aria-label={`View receipt ${r.receiptNumber}`}
                                onClick={() => setSelectedReceipt(r)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <StaggerContainer className="md:hidden space-y-3">
                  {rows.map((r) => (
                    <StaggerItem key={r.id}>
                      <div className="rounded-xl border border-border p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-primary font-semibold truncate">{r.paymentNumber}</p>
                            <p className="text-sm font-medium mt-0.5 truncate">{r.candidateName}</p>
                            <p className="font-mono text-xs text-muted-foreground truncate">{r.loanNumber}</p>
                          </div>
                          <StatusBadge variant={r.status}>{formatStatus(r.status)}</StatusBadge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Number(r.amount))}</p></div>
                          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Method</p><p className="text-xs sm:text-sm inline-flex items-center gap-1.5">{methodIcon[r.method]}{r.method.replace(/_/g, ' ')}</p></div>
                          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</p><p className="text-sm">{fmtDate(r.createdAt)}</p></div>
                          {r.receiptNumber && (
                            <div className="flex items-end">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-11 w-full"
                                aria-label={`View receipt ${r.receiptNumber}`}
                                onClick={() => setSelectedReceipt(r)}
                              >
                                <Eye className="h-3.5 w-3.5" /> Receipt
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <Dialog open={!!selectedReceipt} onOpenChange={(o) => !o && setSelectedReceipt(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Payment Receipt
            </DialogTitle>
            <DialogDescription>
              {selectedReceipt?.receiptNumber ?? selectedReceipt?.paymentNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl bg-muted/40 p-4 space-y-2 border border-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment #</span>
                  <span className="font-mono font-semibold">{selectedReceipt.paymentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt #</span>
                  <span className="font-mono">{selectedReceipt.receiptNumber ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Candidate</span>
                  <span className="font-medium">{selectedReceipt.candidateName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loan #</span>
                  <span className="font-mono">{selectedReceipt.loanNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span>{selectedReceipt.method.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span>{fmtDate(selectedReceipt.allocatedAt || selectedReceipt.createdAt)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border font-semibold text-base">
                  <span>Amount Paid</span>
                  <span className="tabular-nums text-primary">{formatPaiseToINR(Number(selectedReceipt.amount))}</span>
                </div>
              </div>

              {(selectedReceipt.allocatedPrincipal || selectedReceipt.allocatedInterest || selectedReceipt.allocatedFees) && (
                <div className="rounded-xl border border-border p-3 space-y-1.5 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Allocation Breakdown</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Principal Component</span>
                    <span className="tabular-nums font-medium">{formatPaiseToINR(Number(selectedReceipt.allocatedPrincipal ?? 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interest Component</span>
                    <span className="tabular-nums font-medium">{formatPaiseToINR(Number(selectedReceipt.allocatedInterest ?? 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fees Component</span>
                    <span className="tabular-nums font-medium">{formatPaiseToINR(Number(selectedReceipt.allocatedFees ?? 0))}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" className="h-11" onClick={() => setSelectedReceipt(null)}>Close</Button>
            {selectedReceipt && (
              <Button asChild variant="outline" className="h-11">
                <Link href={`/portal/receipts/${selectedReceipt.id}`}>
                  <Receipt className="h-4 w-4" /> Open Printable Receipt Page
                </Link>
              </Button>
            )}
            <Button
              className="h-11"
              onClick={() => {
                window.print()
                toast.success(`Printing receipt ${selectedReceipt?.receiptNumber}`)
              }}
            >
              <Printer className="h-4 w-4" /> Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
