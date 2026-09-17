'use client'

import * as React from 'react'
import { FilePen, Plus, Upload, Search, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
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
import { loans, candidatePayments } from '@/lib/mock-data'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'

interface CorrectionRow {
  id: string
  correctionNumber: string
  loan: string
  payment: string
  type: 'AMOUNT' | 'ALLOCATION' | 'DATE' | 'ACCOUNT'
  description: string
  amount: number
  status: 'OPEN' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
  createdAt: string
}

const seedCorrections: CorrectionRow[] = [
  { id: 'c1', correctionNumber: 'COR-2024-008', loan: 'LON-2024-0892', payment: 'PAY-2024-8841', type: 'ALLOCATION', description: 'Principal vs interest split incorrect on installment #1', amount: 742500, status: 'OPEN', createdAt: '3 hours ago' },
  { id: 'c2', correctionNumber: 'COR-2024-007', loan: 'LON-2024-0812', payment: 'PAY-2024-9138', type: 'DATE', description: 'Payment date recorded as 12 Sep, actual receipt dated 10 Sep', amount: 1430000, status: 'IN_REVIEW', createdAt: '1 day ago' },
  { id: 'c3', correctionNumber: 'COR-2024-006', loan: 'LON-2024-0698', payment: 'PAY-2024-9125', type: 'AMOUNT', description: 'Cash receipt ₹4,500 entered as ₹4,250 — needs upward correction', amount: 25000, status: 'APPROVED', createdAt: '2 days ago' },
  { id: 'c4', correctionNumber: 'COR-2024-005', loan: 'LON-2024-0884', payment: 'PAY-2024-9098', type: 'ACCOUNT', description: 'Wrong ledger account (Bank Account vs Cash in Hand)', amount: 285000, status: 'COMPLETED', createdAt: '4 days ago' },
  { id: 'c5', correctionNumber: 'COR-2024-004', loan: 'LON-2024-0712', payment: 'PAY-2024-9090', type: 'ALLOCATION', description: 'Fees allocation skipped — payment fully allocated to principal', amount: 1220000, status: 'REJECTED', createdAt: '1 week ago' },
]

const typeTint: Record<string, string> = {
  AMOUNT: 'bg-warning/15 text-warning',
  ALLOCATION: 'bg-info/15 text-info',
  DATE: 'bg-muted text-muted-foreground',
  ACCOUNT: 'bg-destructive/15 text-destructive',
}

export default function CorrectionsPage() {
  const [open, setOpen] = React.useState(false)
  const [corrections, setCorrections] = React.useState<CorrectionRow[]>(seedCorrections)
  const [loan, setLoan] = React.useState('')
  const [payment, setPayment] = React.useState('')
  const [type, setType] = React.useState<CorrectionRow['type'] | ''>('')
  const [reason, setReason] = React.useState('')

  const total = corrections.reduce((s, c) => s + c.amount, 0)
  const pending = corrections.filter((c) => c.status === 'OPEN' || c.status === 'IN_REVIEW').length

  const submit = () => {
    if (!loan || !payment || !type || !reason) { toast.error('All fields required'); return }
    const newC: CorrectionRow = {
      id: `c${corrections.length + 1}`,
      correctionNumber: `COR-2024-${String(9 + corrections.length).padStart(3, '0')}`,
      loan, payment, type: type as CorrectionRow['type'],
      description: reason, amount: 0, status: 'OPEN', createdAt: 'Just now',
    }
    setCorrections([newC, ...corrections])
    toast.success('Correction requested', { description: `${newC.correctionNumber} created for ${loan}` })
    setOpen(false); setLoan(''); setPayment(''); setType(''); setReason('')
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
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Affected Value</p><p className="text-2xl font-bold tabular-nums">{formatPaiseToINRShort(total)}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Completed</p><p className="text-2xl font-bold tabular-nums text-success">{corrections.filter((c) => c.status === 'COMPLETED').length}</p></CardContent></Card></StaggerItem>
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
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-6">Correction #</TableHead>
                    <TableHead>Loan</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corrections.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="pl-6 font-mono text-xs font-semibold text-primary">{c.correctionNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{c.loan}</TableCell>
                      <TableCell className="font-mono text-xs">{c.payment}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${typeTint[c.type]}`}>{c.type}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">{c.description}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.amount ? formatPaiseToINR(c.amount) : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.createdAt}</TableCell>
                      <TableCell><StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge></TableCell>
                      <TableCell className="text-right pr-6">
                        {(c.status === 'OPEN' || c.status === 'IN_REVIEW') && (
                          <Button size="sm" onClick={() => toast.success('Correction approved', { description: `${c.correctionNumber} approved. Reversal entry queued.` })}>Approve</Button>
                        )}
                        {(c.status === 'APPROVED') && (
                          <Button size="sm" onClick={() => toast.success('Correction processed', { description: `${c.correctionNumber} marked COMPLETED.` })}>Process</Button>
                        )}
                        {(c.status === 'COMPLETED' || c.status === 'REJECTED') && (
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
                        <p className="font-mono text-xs text-primary font-semibold">{c.correctionNumber}</p>
                        <p className="font-mono text-xs text-muted-foreground">{c.loan}</p>
                      </div>
                      <StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge>
                    </div>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium mt-2 ${typeTint[c.type]}`}>{c.type}</span>
                    <p className="text-sm mt-2">{c.description}</p>
                    {c.amount > 0 && <p className="text-sm font-semibold tabular-nums mt-1">{formatPaiseToINR(c.amount)}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">{c.createdAt} · {c.payment}</p>
                    {(c.status === 'OPEN' || c.status === 'IN_REVIEW') && (
                      <Button size="sm" className="w-full mt-3" onClick={() => toast.success('Correction approved')}>Approve</Button>
                    )}
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
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
              <Label htmlFor="loan">Loan Number</Label>
              <Select value={loan} onValueChange={setLoan}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select loan" /></SelectTrigger>
                <SelectContent>
                  {loans.map((l) => (
                    <SelectItem key={l.id} value={l.loanNumber}>{l.loanNumber} · {l.candidateName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payment">Payment Reference</Label>
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select payment" /></SelectTrigger>
                <SelectContent>
                  {candidatePayments.map((p) => (
                    <SelectItem key={p.id} value={p.paymentNumber}>{p.paymentNumber} · {p.date}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Correction Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as CorrectionRow['type'])}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AMOUNT">Amount</SelectItem>
                  <SelectItem value="ALLOCATION">Allocation</SelectItem>
                  <SelectItem value="DATE">Date</SelectItem>
                  <SelectItem value="ACCOUNT">Account</SelectItem>
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
            <Button onClick={submit}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
