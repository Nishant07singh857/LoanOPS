'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Undo2, Plus, CheckCircle2 } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'

interface RefundRow {
  id: string
  loanId: string
  loanNumber: string
  candidateName: string
  candidateMobile: string
  amount: string
  reason: string
  status: 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  notes?: string | null
  processedAt?: string | null
  initiatedBy: string
  createdAt: string
}

interface LoanRow {
  id: string
  loanNumber: string
  candidateName: string
}

function fmtTimestamp(d: string) {
  const date = new Date(d)
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function RefundsPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [loanId, setLoanId] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [reason, setReason] = React.useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['owner-refunds'],
    queryFn: () => api.get<{ items: RefundRow[]; total: number }>('/api/owner/refunds?pageSize=100'),
  })

  const { data: loansData } = useQuery({
    queryKey: ['owner-loans-for-refund'],
    queryFn: () => api.get<{ items: LoanRow[] }>('/api/owner/loans?pageSize=100'),
  })

  const refunds = data?.items ?? []
  const loans = loansData?.items ?? []

  const total = refunds.reduce((s, r) => s + Number(r.amount), 0)
  const pending = refunds.filter((r) => r.status === 'REQUESTED' || r.status === 'PROCESSING').length

  const createMutation = useMutation({
    mutationFn: () => api.post<{ id: string; refundNumber?: string }>('/api/owner/refunds', {
      loanId, amount, reason,
    }),
    onSuccess: (res) => {
      toast.success('Refund initiated', { description: `Created for ${loans.find((l) => l.id === loanId)?.loanNumber ?? ''}` })
      queryClient.invalidateQueries({ queryKey: ['owner-refunds'] })
      setOpen(false); setLoanId(''); setAmount(''); setReason('')
    },
    onError: (e: Error) => toast.error('Failed to create refund', { description: e.message }),
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.post<{ id: string; status: string }>(`/api/owner/refunds/${id}/complete`),
    onSuccess: () => {
      toast.success('Refund processed', { description: 'Refund marked as COMPLETED.' })
      queryClient.invalidateQueries({ queryKey: ['owner-refunds'] })
    },
    onError: (e: Error) => toast.error('Failed to complete refund', { description: e.message }),
  })

  const submit = () => {
    if (!loanId || !amount || !reason) {
      toast.error('All fields required')
      return
    }
    createMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Refunds"
        description="Process excess payment refunds, fee reversals, and foreclosure surpluses."
        icon={<Undo2 className="h-5 w-5" />}
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Initiate Refund
          </Button>
        }
      />

      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Refunds</p><p className="text-2xl font-bold tabular-nums">{refunds.length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-bold tabular-nums text-warning">{pending}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Value</p><p className="text-2xl font-bold tabular-nums">{formatPaiseToINRShort(total)}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Completed</p><p className="text-2xl font-bold tabular-nums text-success">{refunds.filter((r) => r.status === 'COMPLETED').length}</p></CardContent></Card></StaggerItem>
      </StaggerContainer>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2"><CardTitle className="text-base">Refund Requests</CardTitle><CardDescription>{refunds.length} total</CardDescription></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : refunds.length === 0 ? (
              <EmptyState icon={<Undo2 className="h-6 w-6" />} title="No refund requests" description="Initiate a refund to see it here." />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="pl-6">Loan</TableHead>
                        <TableHead>Candidate</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refunds.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="pl-6 font-mono text-xs">{r.loanNumber}</TableCell>
                          <TableCell>
                            <p className="font-medium">{r.candidateName}</p>
                            <p className="text-xs text-muted-foreground">{r.candidateMobile}</p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(r.amount))}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{r.reason}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtTimestamp(r.createdAt)}</TableCell>
                          <TableCell><StatusBadge variant={r.status}>{formatStatus(r.status)}</StatusBadge></TableCell>
                          <TableCell className="text-right pr-6">
                            {(r.status === 'REQUESTED' || r.status === 'PROCESSING') && (
                              <Button
                                size="sm"
                                disabled={completeMutation.isPending}
                                onClick={() => completeMutation.mutate(r.id)}
                              >
                                <CheckCircle2 className="h-4 w-4" /> Process
                              </Button>
                            )}
                            {(r.status === 'COMPLETED' || r.status === 'FAILED' || r.status === 'CANCELLED') && (
                              <Button variant="ghost" size="sm">View</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <StaggerContainer className="md:hidden space-y-3">
                  {refunds.map((r) => (
                    <StaggerItem key={r.id}>
                      <div className="rounded-xl border border-border p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium mt-0.5">{r.candidateName}</p>
                            <p className="font-mono text-xs text-muted-foreground">{r.loanNumber}</p>
                          </div>
                          <StatusBadge variant={r.status}>{formatStatus(r.status)}</StatusBadge>
                        </div>
                        <p className="text-lg font-bold mt-2 tabular-nums">{formatPaiseToINR(Number(r.amount))}</p>
                        <p className="text-xs text-muted-foreground mt-1">{r.reason}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{fmtTimestamp(r.createdAt)}</p>
                        {(r.status === 'REQUESTED' || r.status === 'PROCESSING') && (
                          <Button size="sm" className="w-full mt-3" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate(r.id)}>
                            <CheckCircle2 className="h-4 w-4" /> Process Refund
                          </Button>
                        )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initiate Refund</DialogTitle>
            <DialogDescription>Create a refund request for review and approval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="loan">Loan</Label>
              <Select value={loanId} onValueChange={setLoanId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select loan" /></SelectTrigger>
                <SelectContent>
                  {loans.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.loanNumber} · {l.candidateName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount">Amount (₹)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-8" type="text" inputMode="decimal" />
              </div>
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Excess payment on closed loan" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={createMutation.isPending}>Submit Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
