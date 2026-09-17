'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Receipt, Building2, Banknote, CreditCard, Search, Eye, XCircle, Clock,
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

  const { data, isLoading } = useQuery({
    queryKey: ['owner-payments', method, status, search],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '100' })
      if (method !== 'all') params.set('method', method)
      if (status !== 'all') params.set('status', status)
      if (search) params.set('search', search)
      return api.get<{ items: PaymentRow[]; total: number }>(`/api/owner/payments?${params.toString()}`)
    },
  })

  const rows = data?.items ?? []
  const totalToday = rows.reduce((s, r) => s + Number(r.amount), 0)
  const onlineTotal = rows.filter((r) => r.method !== 'CASH').reduce((s, r) => s + Number(r.amount), 0)
  const cashTotal = rows.filter((r) => r.method === 'CASH').reduce((s, r) => s + Number(r.amount), 0)
  const pendingVerify = rows.filter((r) => r.status === 'PENDING_VERIFICATION').length
  const failed = rows.filter((r) => r.status === 'FAILED' || r.status === 'REJECTED').length

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Payments"
        description="All payments across online and cash channels with verification status."
        icon={<Receipt className="h-5 w-5" />}
      />

      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem>
          <KPICard label="Total Collected" value={formatPaiseToINRShort(totalToday)} icon={<Receipt className="h-5 w-5" />} variant="success" spark={[200, 240, 280, 300, 320, 360, 380]} />
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
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search payment #, candidate, loan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="md:w-[180px]"><SelectValue placeholder="Method" /></SelectTrigger>
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
                <SelectTrigger className="md:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
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
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Payments</CardTitle>
            <CardDescription>{rows.length} payments</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : rows.length === 0 ? (
              <EmptyState icon={<Receipt className="h-6 w-6" />} title="No payments found" description="Payments will appear here once candidates pay or agents record cash." />
            ) : (
              <>
                <div className="hidden md:block">
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
                              <Button variant="ghost" size="sm" onClick={() => toast.info(`Opening receipt ${r.receiptNumber}`)}>
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
                          <div>
                            <p className="font-mono text-xs text-primary font-semibold">{r.paymentNumber}</p>
                            <p className="text-sm font-medium mt-0.5">{r.candidateName}</p>
                            <p className="font-mono text-xs text-muted-foreground">{r.loanNumber}</p>
                          </div>
                          <StatusBadge variant={r.status}>{formatStatus(r.status)}</StatusBadge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Number(r.amount))}</p></div>
                          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Method</p><p className="text-sm inline-flex items-center gap-1.5">{methodIcon[r.method]}{r.method.replace(/_/g, ' ')}</p></div>
                          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</p><p className="text-sm">{fmtDate(r.createdAt)}</p></div>
                          {r.receiptNumber && <Button variant="outline" size="sm" className="h-7 mt-3" onClick={() => toast.info(`Opening receipt ${r.receiptNumber}`)}><Eye className="h-3.5 w-3.5" /> Receipt</Button>}
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
    </div>
  )
}
