'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FilePen, Plus, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
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

interface CorrectionRow {
  id: string
  loanId: string
  loanNumber: string
  candidateName: string
  candidateMobile: string
  paymentId?: string | null
  reason: string
  evidenceUrl?: string | null
  status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'APPLIED'
  reviewNotes?: string | null
  appliedAt?: string | null
  requestedBy: string
  createdAt: string
}

interface LoanRow {
  id: string
  loanNumber: string
  candidateName: string
}

interface PaymentRow {
  id: string
  paymentNumber: string
  loanNumber: string
  createdAt: string
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

export default function CorrectionsPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [loanId, setLoanId] = React.useState('')
  const [paymentId, setPaymentId] = React.useState('')
  const [reason, setReason] = React.useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['owner-corrections'],
    queryFn: () => api.get<{ items: CorrectionRow[]; total: number }>('/api/owner/corrections?pageSize=100'),
  })

  const { data: loansData } = useQuery({
    queryKey: ['owner-loans-for-correction'],
    queryFn: () => api.get<{ items: LoanRow[] }>('/api/owner/loans?pageSize=100'),
  })

  const { data: paymentsData } = useQuery({
    queryKey: ['owner-payments-for-correction'],
    queryFn: () => api.get<{ items: PaymentRow[] }>('/api/owner/payments?pageSize=100'),
  })

  const corrections = data?.items ?? []
  const loans = loansData?.items ?? []
  const payments = paymentsData?.items ?? []

  const pending = corrections.filter((c) => c.status === 'REQUESTED' || c.status === 'UNDER_REVIEW').length

  const createMutation = useMutation({
    mutationFn: () => api.post<{ id: string }>('/api/owner/corrections', {
      loanId, paymentId: paymentId || null, reason,
    }),
    onSuccess: () => {
      toast.success('Correction requested', { description: `Created for ${loans.find((l) => l.id === loanId)?.loanNumber ?? ''}` })
      queryClient.invalidateQueries({ queryKey: ['owner-corrections'] })
      setOpen(false); setLoanId(''); setPaymentId(''); setReason('')
    },
    onError: (e: Error) => toast.error('Failed to create correction', { description: e.message }),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post<{ id: string; status: string }>(`/api/owner/corrections/${id}/approve`),
    onSuccess: () => {
      toast.success('Correction applied', { description: 'Reversal entry posted.' })
      queryClient.invalidateQueries({ queryKey: ['owner-corrections'] })
    },
    onError: (e: Error) => toast.error('Failed to apply correction', { description: e.message }),
  })

  const submit = () => {
    if (!loanId || !reason) {
      toast.error('Loan and reason are required')
      return
    }
    createMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Corrections"
        description="Request ledger corrections for amount, allocation, date, or account errors. All corrections are append-only."
        icon={<FilePen className="h-5 w-5" />}
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Request Correction
          </Button>
        }
      />

      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Corrections</p><p className="text-2xl font-bold tabular-nums">{corrections.length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-bold tabular-nums text-warning">{pending}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Applied</p><p className="text-2xl font-bold tabular-nums text-success">{corrections.filter((c) => c.status === 'APPLIED').length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Rejected</p><p className="text-2xl font-bold tabular-nums text-destructive">{corrections.filter((c) => c.status === 'REJECTED').length}</p></CardContent></Card></StaggerItem>
      </StaggerContainer>

      <FadeIn>
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 flex items-start gap-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-warning">Corrections are append-only</p>
            <p className="text-muted-foreground text-xs mt-0.5">Each correction creates a new ledger entry with a reversal reference. Original entries are never edited.</p>
          </div>
        </div>
      </FadeIn>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2"><CardTitle className="text-base">Correction Requests</CardTitle><CardDescription>{corrections.length} total</CardDescription></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : corrections.length === 0 ? (
              <EmptyState icon={<FilePen className="h-6 w-6" />} title="No correction requests" description="Request a correction to see it here." />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="pl-6">Loan</TableHead>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {corrections.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="pl-6 font-mono text-xs">{c.loanNumber}</TableCell>
                          <TableCell>
                            <p className="font-medium">{c.candidateName}</p>
                            <p className="text-xs text-muted-foreground">{c.candidateMobile}</p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">{c.reason}</TableCell>
                          <TableCell className="text-xs">{c.requestedBy}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtTimestamp(c.createdAt)}</TableCell>
                          <TableCell><StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge></TableCell>
                          <TableCell className="text-right pr-6">
                            {(c.status === 'REQUESTED' || c.status === 'UNDER_REVIEW') && (
                              <Button
                                size="sm"
                                disabled={approveMutation.isPending}
                                onClick={() => approveMutation.mutate(c.id)}
                              >
                                <CheckCircle2 className="h-4 w-4" /> Apply
                              </Button>
                            )}
                            {(c.status === 'APPLIED' || c.status === 'REJECTED') && (
                              <Button variant="ghost" size="sm">View</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <StaggerContainer className="md:hidden space-y-3">
                  {corrections.map((c) => (
                    <StaggerItem key={c.id}>
                      <div className="rounded-xl border border-border p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs text-muted-foreground">{c.loanNumber}</p>
                            <p className="text-sm font-medium mt-0.5">{c.candidateName}</p>
                          </div>
                          <StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge>
                        </div>
                        <p className="text-sm mt-2">{c.reason}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{fmtTimestamp(c.createdAt)} · {c.requestedBy}</p>
                        {(c.status === 'REQUESTED' || c.status === 'UNDER_REVIEW') && (
                          <Button size="sm" className="w-full mt-3" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(c.id)}>
                            <CheckCircle2 className="h-4 w-4" /> Apply Correction
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
            <DialogTitle>Request Correction</DialogTitle>
            <DialogDescription>Submit a correction request for review. All corrections create reversal entries.</DialogDescription>
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
              <Label htmlFor="payment">Payment (optional)</Label>
              <Select value={paymentId} onValueChange={setPaymentId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select payment (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {payments.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.paymentNumber} · {p.loanNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe the error and required correction" />
            </div>
            <div>
              <Label>Evidence</Label>
              <div className="rounded-xl border-2 border-dashed border-border p-5 text-center hover:border-primary/40 transition-all cursor-pointer" onClick={() => toast.info('Evidence upload coming soon')}>
                <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Click to upload receipt, screenshot, or supporting doc</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={createMutation.isPending}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
