'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Banknote, Building2, Clock,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { cn } from '@/lib/utils'

interface LoanRow {
  id: string
  loanNumber: string
  candidateName: string
  principalAmount: string
  frequency: string
  totalRepayable: string
  installmentAmount: string
  status: string
  agent?: { id: string; name: string } | null
}

interface DisbursementRow {
  id: string
  loanId: string
  loanNumber: string
  loanStatus: string
  candidateName: string
  candidateMobile: string
  method: string
  amount: string
  status: string
  reference?: string | null
  notes?: string | null
  initiatedAt: string
  completedAt?: string | null
  initiatedBy: string
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DisbursementsPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [selectedLoan, setSelectedLoan] = React.useState<LoanRow | null>(null)

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['owner-loans-pending-disbursement'],
    queryFn: () => api.get<{ items: LoanRow[]; total: number }>(`/api/owner/loans?status=PENDING_DISBURSEMENT&pageSize=100`),
  })

  const { data: disbursedData } = useQuery({
    queryKey: ['owner-disbursements'],
    queryFn: () => api.get<{ items: DisbursementRow[]; total: number }>(`/api/owner/disbursements?pageSize=20`),
  })

  const pending = pendingData?.items ?? []
  const recent = disbursedData?.items ?? []

  const disburseMutation = useMutation({
    mutationFn: (input: { loanId: string; method: 'ONLINE' | 'OFFLINE'; reference?: string; notes?: string; amount: string }) =>
      api.post(`/api/owner/loans/${input.loanId}/disburse`, {
        method: input.method,
        amount: input.amount,
        reference: input.reference,
        notes: input.notes,
      }),
    onSuccess: (data: any) => {
      toast.success('Disbursement queued', { description: `${data.method} · ${formatPaiseToINR(Number(data.amount))}` })
      queryClient.invalidateQueries({ queryKey: ['owner-loans-pending-disbursement'] })
      queryClient.invalidateQueries({ queryKey: ['owner-disbursements'] })
      queryClient.invalidateQueries({ queryKey: ['owner-loans'] })
      queryClient.invalidateQueries({ queryKey: ['owner-dashboard'] })
      setOpen(false)
      setSelectedLoan(null)
    },
    onError: (err: any) => toast.error('Disbursement failed', { description: err.message }),
  })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Disbursements"
        description="Initiate and track loan disbursements — online transfers and offline cash."
        icon={<Banknote className="h-5 w-5" />}
      />

      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem>
          <KPICard label="Pending Disbursements" value={String(pending.length)} icon={<Clock className="h-5 w-5" />} variant="warning" spark={[5, 6, 7, 8, 8, 8, 8]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Total Disbursed" value={formatPaiseToINRShort(recent.reduce((s, r) => s + Number(r.amount), 0))} icon={<Banknote className="h-5 w-5" />} variant="success" spark={[400, 420, 460, 500, 540, 560, 562]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Online Share" value={`${recent.filter((r) => r.method === 'ONLINE').length}`} icon={<Building2 className="h-5 w-5" />} variant="info" spark={[60, 62, 64, 65, 66, 67, 68]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Offline Cash" value={`${recent.filter((r) => r.method === 'OFFLINE').length}`} icon={<Banknote className="h-5 w-5" />} variant="default" spark={[40, 38, 36, 35, 34, 33, 32]} />
        </StaggerItem>
      </StaggerContainer>

      <FadeIn>
        <Card className="shadow-premium border-l-4 border-l-warning">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Pending Disbursements</CardTitle>
            <CardDescription>{pending.length} loans awaiting disbursement</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : pending.length === 0 ? (
              <EmptyState icon={<Clock className="h-6 w-6" />} title="No pending disbursements" description="Approved loans awaiting disbursement will appear here." />
            ) : (
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-6">Loan No.</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Total Repayable</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="pl-6 font-mono font-semibold text-primary">{l.loanNumber}</TableCell>
                        <TableCell className="font-medium">{l.candidateName}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(l.principalAmount))}</TableCell>
                        <TableCell><span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{l.frequency}</span></TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(l.totalRepayable))}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.agent?.name ?? '—'}</TableCell>
                        <TableCell className="text-right pr-6">
                          <Button size="sm" onClick={() => { setSelectedLoan(l); setOpen(true) }}>
                            Disburse
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <StaggerContainer className="md:hidden space-y-3">
              {pending.map((l) => (
                <StaggerItem key={l.id}>
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-primary font-semibold">{l.loanNumber}</p>
                        <p className="text-sm font-medium mt-0.5">{l.candidateName}</p>
                      </div>
                      <StatusBadge variant="PENDING_DISBURSEMENT">Pending</StatusBadge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Principal</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Number(l.principalAmount))}</p></div>
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Frequency</p><p className="text-sm">{l.frequency}</p></div>
                    </div>
                    <Button size="sm" className="w-full mt-3" onClick={() => { setSelectedLoan(l); setOpen(true) }}>Disburse Now</Button>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Disbursements</CardTitle>
            <CardDescription>{recent.length} disbursements</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState icon={<Banknote className="h-6 w-6" />} title="No disbursements yet" description="Disbursements will appear here once initiated." />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="pl-6">Loan No.</TableHead>
                        <TableHead>Candidate</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Initiated By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recent.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="pl-6 font-mono font-semibold text-primary">{d.loanNumber}</TableCell>
                          <TableCell className="font-medium">{d.candidateName}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(d.amount))}</TableCell>
                          <TableCell><span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', d.method === 'OFFLINE' ? 'bg-muted' : 'bg-info/15 text-info')}>{d.method}</span></TableCell>
                          <TableCell className="font-mono text-xs">{d.reference ?? '—'}</TableCell>
                          <TableCell className="text-xs">{d.initiatedBy}</TableCell>
                          <TableCell className="text-sm">{fmtDate(d.initiatedAt)}</TableCell>
                          <TableCell><StatusBadge variant={d.status}>{formatStatus(d.status)}</StatusBadge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <StaggerContainer className="md:hidden space-y-3">
                  {recent.map((d) => (
                    <StaggerItem key={d.id}>
                      <div className="rounded-xl border border-border p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs text-primary font-semibold">{d.loanNumber}</p>
                            <p className="text-sm font-medium mt-0.5">{d.candidateName}</p>
                            <p className="text-xs text-muted-foreground">{fmtDate(d.initiatedAt)}</p>
                          </div>
                          <StatusBadge variant={d.status}>{formatStatus(d.status)}</StatusBadge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Number(d.amount))}</p></div>
                          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Method</p><p className="text-sm">{d.method === 'OFFLINE' ? 'Offline Cash' : 'Online Transfer'}</p></div>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Disburse Loan {selectedLoan?.loanNumber}</DialogTitle>
            <DialogDescription>Select channel and confirm the disbursement.</DialogDescription>
          </DialogHeader>
          {selectedLoan && (
            <DisburseForm
              loan={selectedLoan}
              submitting={disburseMutation.isPending}
              onSubmit={(input) => disburseMutation.mutate({ ...input, loanId: selectedLoan.id, amount: selectedLoan.principalAmount })}
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DisburseForm({ loan, onSubmit, onClose, submitting }: {
  loan: LoanRow
  onSubmit: (input: { method: 'ONLINE' | 'OFFLINE'; reference?: string; notes?: string }) => void
  onClose: () => void
  submitting: boolean
}) {
  const [channel, setChannel] = React.useState<'ONLINE' | 'OFFLINE'>('ONLINE')
  const [reference, setReference] = React.useState('')
  const [notes, setNotes] = React.useState('')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(['ONLINE', 'OFFLINE'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setChannel(c)}
            className={cn('rounded-xl border-2 p-4 text-left transition-all', channel === c ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}
          >
            <div className="flex items-center gap-2 mb-1">
              {c === 'ONLINE' ? <Building2 className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
              <p className="text-sm font-semibold">{c === 'ONLINE' ? 'Online Transfer' : 'Offline Cash'}</p>
            </div>
            <p className="text-xs text-muted-foreground">{c === 'ONLINE' ? 'Bank/UPI (waits for webhook)' : 'Cash handover (immediate)'}</p>
          </button>
        ))}
      </div>
      <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
        <div className="flex justify-between"><span className="text-muted-foreground">Loan</span><span className="font-mono font-semibold text-primary">{loan.loanNumber}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Candidate</span><span className="font-medium">{loan.candidateName}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Principal</span><span className="font-semibold tabular-nums">{formatPaiseToINR(Number(loan.principalAmount))}</span></div>
      </div>
      {channel === 'ONLINE' && (
        <div>
          <Label htmlFor="ref">UTR / Transaction Reference</Label>
          <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / Reference ID" />
        </div>
      )}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes" />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={() => onSubmit({ method: channel, reference, notes })} disabled={submitting}>
          {submitting ? 'Processing…' : 'Initiate Disbursement'}
        </Button>
      </DialogFooter>
    </div>
  )
}
