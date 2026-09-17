'use client'

import * as React from 'react'
import {
  Scale, CheckCircle2, XCircle, AlertTriangle, Search, Building2, Banknote, CreditCard,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { cn } from '@/lib/utils'

interface ExpectedMethod {
  method: string
  expected: number
  captured: number
  diff: number
}

const expectedData: ExpectedMethod[] = [
  { method: 'ONLINE_UPI', expected: 1840000, captured: 1820000, diff: -20000 },
  { method: 'ONLINE_NETBANKING', expected: 540000, captured: 540000, diff: 0 },
  { method: 'ONLINE_CARD', expected: 220000, captured: 215000, diff: -5000 },
  { method: 'CASH', expected: 1620000, captured: 1580000, diff: -40000 },
  { method: 'BANK_TRANSFER', expected: 480000, captured: 480000, diff: 0 },
]

interface ExceptionRow {
  id: string
  type: 'DUPLICATE' | 'UNMATCHED' | 'MISSING_LEDGER' | 'AMOUNT_MISMATCH'
  payment: string
  description: string
  amount: number
  status: 'OPEN' | 'RESOLVED' | 'IN_REVIEW'
}

const exceptions: ExceptionRow[] = [
  { id: 'x1', type: 'DUPLICATE', payment: 'PAY-2024-9132', description: 'Same UTR recorded twice', amount: 742500, status: 'OPEN' },
  { id: 'x2', type: 'UNMATCHED', payment: 'PAY-2024-9127', description: 'UPI payment received with no matching loan', amount: 500000, status: 'IN_REVIEW' },
  { id: 'x3', type: 'MISSING_LEDGER', payment: 'PAY-2024-9098', description: 'Cash verified but ledger entry not posted', amount: 285000, status: 'OPEN' },
  { id: 'x4', type: 'AMOUNT_MISMATCH', payment: 'PAY-2024-9118', description: 'Receipt ₹4,500 vs ledger ₹4,250', amount: 25000, status: 'RESOLVED' },
  { id: 'x5', type: 'UNMATCHED', payment: 'PAY-2024-9145', description: 'Bank transfer with stale loan reference', amount: 150000, status: 'IN_REVIEW' },
]

const typeTint: Record<string, string> = {
  DUPLICATE: 'bg-warning/15 text-warning',
  UNMATCHED: 'bg-info/15 text-info',
  MISSING_LEDGER: 'bg-destructive/15 text-destructive',
  AMOUNT_MISMATCH: 'bg-warning/15 text-warning',
}

const methodIcon: Record<string, React.ReactNode> = {
  ONLINE_UPI: <Building2 className="h-3.5 w-3.5" />,
  ONLINE_NETBANKING: <Building2 className="h-3.5 w-3.5" />,
  ONLINE_CARD: <CreditCard className="h-3.5 w-3.5" />,
  CASH: <Banknote className="h-3.5 w-3.5" />,
  BANK_TRANSFER: <Building2 className="h-3.5 w-3.5" />,
}

export default function ReconciliationPage() {
  const [search, setSearch] = React.useState('')

  const totalExpected = expectedData.reduce((s, m) => s + m.expected, 0)
  const totalCaptured = expectedData.reduce((s, m) => s + m.captured, 0)
  const totalDiff = totalExpected - totalCaptured
  const openExceptions = exceptions.filter((e) => e.status === 'OPEN').length

  const filteredExceptions = exceptions.filter((e) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return e.payment.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.type.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Reconciliation"
        description="Reconcile expected inflows with captured payments and surface exceptions."
        icon={<Scale className="h-5 w-5" />}
        action={
          <Button variant="outline" size="sm" onClick={() => toast.success('Reconciliation started', { description: 'Daily reconciliation job queued.' })}>
            Run Recon Now
          </Button>
        }
      />

      {/* Three column summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <FadeIn>
          <Card className="shadow-premium border-l-4 border-l-info h-full">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4" /> Expected</CardTitle><CardDescription>Per method, scheduled inflow</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {expectedData.map((m) => (
                <div key={m.method} className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-6 w-6 rounded-md bg-muted flex items-center justify-center">{methodIcon[m.method]}</span>
                    {m.method.replace(/_/g, ' ')}
                  </span>
                  <span className="font-medium tabular-nums">{formatPaiseToINR(m.expected)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-border font-semibold">
                <span>Total</span><span className="tabular-nums">{formatPaiseToINR(totalExpected)}</span>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card className="shadow-premium border-l-4 border-l-success h-full">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Captured</CardTitle><CardDescription>Payments actually recorded</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {expectedData.map((m) => (
                <div key={m.method} className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-6 w-6 rounded-md bg-muted flex items-center justify-center">{methodIcon[m.method]}</span>
                    {m.method.replace(/_/g, ' ')}
                  </span>
                  <span className="font-medium tabular-nums">{formatPaiseToINR(m.captured)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-border font-semibold">
                <span>Total</span><span className="tabular-nums">{formatPaiseToINR(totalCaptured)}</span>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card className={cn('shadow-premium border-l-4 h-full', totalDiff > 0 ? 'border-l-warning' : 'border-l-destructive')}>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Exceptions</CardTitle><CardDescription>Variance & pending items</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Variance</span>
                  <span className={cn('font-semibold tabular-nums', totalDiff > 0 ? 'text-warning' : 'text-success')}>{formatPaiseToINR(totalDiff)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-destructive/5 p-3">
                  <p className="text-xs text-muted-foreground">Open exceptions</p>
                  <p className="text-xl font-bold text-destructive">{openExceptions}</p>
                </div>
                <div className="rounded-xl bg-success/5 p-3">
                  <p className="text-xs text-muted-foreground">Resolved today</p>
                  <p className="text-xl font-bold text-success">2</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                {openExceptions} items need attention
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Exceptions list */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Exceptions</CardTitle>
                <CardDescription>{filteredExceptions.length} reconciliation exceptions</CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search payment, description..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 sm:w-64" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-6">Type</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExceptions.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-6">
                        <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', typeTint[e.type])}>{e.type.replace(/_/g, ' ')}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.payment}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[320px] truncate">{e.description}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPaiseToINR(e.amount)}</TableCell>
                      <TableCell><StatusBadge variant={e.status}>{formatStatus(e.status)}</StatusBadge></TableCell>
                      <TableCell className="text-right pr-6">
                        {e.status === 'OPEN' || e.status === 'IN_REVIEW' ? (
                          <Button size="sm" onClick={() => toast.success('Exception resolved', { description: `${e.payment} marked RESOLVED.` })}>Resolve</Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Resolved</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <StaggerContainer className="md:hidden space-y-3">
              {filteredExceptions.map((e) => (
                <StaggerItem key={e.id}>
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', typeTint[e.type])}>{e.type.replace(/_/g, ' ')}</span>
                      <StatusBadge variant={e.status}>{formatStatus(e.status)}</StatusBadge>
                    </div>
                    <p className="font-mono text-xs mt-2">{e.payment}</p>
                    <p className="text-sm mt-1">{e.description}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                      <span className="text-sm font-semibold tabular-nums">{formatPaiseToINR(e.amount)}</span>
                      {(e.status === 'OPEN' || e.status === 'IN_REVIEW') && (
                        <Button size="sm" onClick={() => toast.success('Exception resolved')}>Resolve</Button>
                      )}
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
