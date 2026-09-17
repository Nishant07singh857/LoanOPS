'use client'

import * as React from 'react'
import { Undo2, Plus, Search, CheckCircle2, XCircle, Clock } from 'lucide-react'
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
import { loans } from '@/lib/mock-data'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'

interface RefundRow {
  id: string
  refundNumber: string
  loan: string
  candidate: string
  amount: number
  reason: string
  status: 'OPEN' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
  createdAt: string
}

const seedRefunds: RefundRow[] = [
  { id: 'r1', refundNumber: 'RFD-2024-014', loan: 'LON-2024-0521', candidate: 'Anita Pawar', amount: 35000, reason: 'Excess payment on closed loan', status: 'OPEN', createdAt: '2 hours ago' },
  { id: 'r2', refundNumber: 'RFD-2024-013', loan: 'LON-2024-0892', candidate: 'Rahul Verma', amount: 5000, reason: 'Double charge reversal', status: 'IN_REVIEW', createdAt: '1 day ago' },
  { id: 'r3', refundNumber: 'RFD-2024-012', loan: 'LON-2024-0712', candidate: 'Sahil Khan', amount: 125000, reason: 'Foreclosure surplus', status: 'APPROVED', createdAt: '2 days ago' },
  { id: 'r4', refundNumber: 'RFD-2024-011', loan: 'LON-2024-0884', candidate: 'Imran Khan', amount: 2500, reason: 'Fee overcharge', status: 'COMPLETED', createdAt: '5 days ago' },
  { id: 'r5', refundNumber: 'RFD-2024-010', loan: 'LON-2024-0698', candidate: 'Suresh Patel', amount: 18000, reason: 'Wrong account debit', status: 'REJECTED', createdAt: '1 week ago' },
]

export default function RefundsPage() {
  const [open, setOpen] = React.useState(false)
  const [refunds, setRefunds] = React.useState<RefundRow[]>(seedRefunds)
  const [loan, setLoan] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [reason, setReason] = React.useState('')

  const total = refunds.reduce((s, r) => s + r.amount, 0)
  const pending = refunds.filter((r) => r.status === 'OPEN' || r.status === 'IN_REVIEW').length

  const submit = () => {
    if (!loan || !amount || !reason) {
      toast.error('All fields required')
      return
    }
    const candidateName = loans.find((l) => l.loanNumber === loan)?.candidateName || '—'
    const newRefund: RefundRow = {
      id: `r${refunds.length + 1}`,
      refundNumber: `RFD-2024-${String(15 + refunds.length).padStart(3, '0')}`,
      loan, candidate: candidateName,
      amount: Number(amount) * 100,
      reason, status: 'OPEN', createdAt: 'Just now',
    }
    setRefunds([newRefund, ...refunds])
    toast.success('Refund initiated', { description: `${newRefund.refundNumber} created for ${loan}` })
    setOpen(false); setLoan(''); setAmount(''); setReason('')
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
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-6">Refund #</TableHead>
                    <TableHead>Loan</TableHead>
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
                      <TableCell className="pl-6 font-mono text-xs font-semibold text-primary">{r.refundNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{r.loan}</TableCell>
                      <TableCell className="font-medium">{r.candidate}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPaiseToINR(r.amount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{r.reason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.createdAt}</TableCell>
                      <TableCell><StatusBadge variant={r.status}>{formatStatus(r.status)}</StatusBadge></TableCell>
                      <TableCell className="text-right pr-6">
                        {(r.status === 'OPEN' || r.status === 'IN_REVIEW') && (
                          <Button size="sm" onClick={() => toast.success('Refund approved', { description: `${r.refundNumber} marked APPROVED.` })}>Approve</Button>
                        )}
                        {r.status === 'APPROVED' && (
                          <Button size="sm" onClick={() => toast.success('Refund processed', { description: `${r.refundNumber} marked COMPLETED.` })}>Process</Button>
                        )}
                        {(r.status === 'COMPLETED' || r.status === 'REJECTED') && (
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
                        <p className="font-mono text-xs text-primary font-semibold">{r.refundNumber}</p>
                        <p className="text-sm font-medium mt-0.5">{r.candidate}</p>
                        <p className="font-mono text-xs text-muted-foreground">{r.loan}</p>
                      </div>
                      <StatusBadge variant={r.status}>{formatStatus(r.status)}</StatusBadge>
                    </div>
                    <p className="text-lg font-bold mt-2 tabular-nums">{formatPaiseToINR(r.amount)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{r.reason}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{r.createdAt}</p>
                    {(r.status === 'OPEN' || r.status === 'IN_REVIEW') && (
                      <Button size="sm" className="w-full mt-3" onClick={() => toast.success('Refund approved')}>Approve</Button>
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
            <DialogTitle>Initiate Refund</DialogTitle>
            <DialogDescription>Create a refund request for review and approval.</DialogDescription>
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
            <Button onClick={submit}>Submit Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
