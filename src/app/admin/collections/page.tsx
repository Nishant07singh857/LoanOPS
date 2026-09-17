'use client'

import * as React from 'react'
import {
  Wallet, Banknote, AlertTriangle, Clock, CheckCircle2, XCircle, Eye, ShieldCheck,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { cashCollections, escalations, ownerKPIs } from '@/lib/mock-data'
import { formatPaiseToINR } from '@/lib/money'
import { cn } from '@/lib/utils'

const reasonLabel: Record<string, string> = {
  REPEATED_MISSED_PAYMENT: 'Repeated Missed Payment',
  BROKEN_PTP: 'Broken PTP',
  LONG_OVERDUE: 'Long Overdue',
  FAILED_CONTACT: 'Failed Contact',
  HIGH_OUTSTANDING: 'High Outstanding',
  OTHER: 'Other',
}

export default function CollectionsPage() {
  const onVerify = (id: string, who: string) => toast.success(`${who} verified`, { description: `Cash collection ${id} verified and allocated to loan.` })
  const onReject = (id: string) => toast.error('Cash rejected', { description: `Cash collection ${id} rejected. Agent notified.` })

  const todaysCollections = cashCollections.filter((c) => c.collectionDate === 'Today').reduce((s, c) => s + c.amount, 0)
  const pendingCash = cashCollections.filter((c) => c.status === 'PENDING_VERIFICATION')

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Collections"
        description="Track cash pickups, escalations, broken PTPs and overdue loans in one place."
        icon={<Wallet className="h-5 w-5" />}
      />

      {/* KPI strip */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StaggerItem>
          <KPICard label="Today's Collections" value={formatPaiseToINR(todaysCollections)} icon={<Banknote className="h-5 w-5" />} variant="success" spark={[100, 120, 140, 130, 160, 180, 200]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Pending Cash Verify" value={String(ownerKPIs.pendingCashVerification)} icon={<Clock className="h-5 w-5" />} variant="warning" spark={[5, 6, 7, 8, 9, 9, 9]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Broken PTP" value={String(ownerKPIs.brokenPtp)} icon={<XCircle className="h-5 w-5" />} variant="destructive" spark={[2, 3, 4, 5, 6, 6, 6]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="PTP Due Today" value={String(ownerKPIs.ptpDueToday)} icon={<Clock className="h-5 w-5" />} variant="info" spark={[10, 12, 13, 14, 14, 14, 14]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Overdue Loans" value={String(ownerKPIs.overdueLoans)} icon={<AlertTriangle className="h-5 w-5" />} variant="destructive" spark={[28, 32, 35, 38, 38, 38, 38]} />
        </StaggerItem>
      </StaggerContainer>

      {/* Cash collections */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4" /> Cash Collections</CardTitle>
                <CardDescription>{pendingCash.length} pending verification · {cashCollections.length} total</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-6">Reference</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashCollections.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="pl-6 font-mono text-xs">{c.reference}</TableCell>
                      <TableCell className="font-medium">{c.candidateName}</TableCell>
                      <TableCell className="font-mono text-xs">{c.loanNumber}</TableCell>
                      <TableCell className="text-sm">{c.collectionDate} · {c.collectionTime}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatPaiseToINR(c.amount)}</TableCell>
                      <TableCell><StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.notes || '—'}</TableCell>
                      <TableCell className="text-right pr-6">
                        {c.status === 'PENDING_VERIFICATION' ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => onReject(c.reference)} className="h-7 px-2 text-destructive border-destructive/40 hover:bg-destructive/10"><XCircle className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" onClick={() => onVerify(c.reference, c.candidateName)} className="h-7 px-2"><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <StaggerContainer className="md:hidden space-y-3">
              {cashCollections.map((c) => (
                <StaggerItem key={c.id}>
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{c.reference}</p>
                        <p className="text-sm font-medium mt-0.5">{c.candidateName}</p>
                        <p className="text-xs text-muted-foreground">{c.loanNumber}</p>
                      </div>
                      <StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(c.amount)}</p></div>
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Collected</p><p className="text-sm">{c.collectionDate} · {c.collectionTime}</p></div>
                    </div>
                    {c.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{c.notes}</p>}
                    {c.status === 'PENDING_VERIFICATION' && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => onReject(c.reference)}>Reject</Button>
                        <Button size="sm" className="flex-1" onClick={() => onVerify(c.reference, c.candidateName)}>Verify</Button>
                      </div>
                    )}
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Escalations */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Escalations</CardTitle>
            <CardDescription>{escalations.filter((e) => e.status === 'OPEN').length} open · {escalations.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-6">Candidate</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {escalations.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-6 font-medium">{e.candidateName}</TableCell>
                      <TableCell className="font-mono text-xs">{e.loanNumber}</TableCell>
                      <TableCell><StatusBadge variant={e.reason === 'LONG_OVERDUE' || e.reason === 'BROKEN_PTP' ? 'AI_HIGH' : 'AI_MEDIUM'}>{reasonLabel[e.reason] || e.reason}</StatusBadge></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{e.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.createdAt}</TableCell>
                      <TableCell><StatusBadge variant={e.status}>{formatStatus(e.status)}</StatusBadge></TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" onClick={() => toast.info('Opening escalation details')}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <StaggerContainer className="md:hidden space-y-3">
              {escalations.map((e) => (
                <StaggerItem key={e.id}>
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{e.candidateName}</p>
                        <p className="font-mono text-xs text-muted-foreground">{e.loanNumber}</p>
                      </div>
                      <StatusBadge variant={e.status}>{formatStatus(e.status)}</StatusBadge>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border">
                      <StatusBadge variant={e.reason === 'LONG_OVERDUE' || e.reason === 'BROKEN_PTP' ? 'AI_HIGH' : 'AI_MEDIUM'}>{reasonLabel[e.reason] || e.reason}</StatusBadge>
                      <p className="text-xs text-muted-foreground mt-2">{e.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-2">Created {e.createdAt}</p>
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
