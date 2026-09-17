'use client'

import * as React from 'react'
import {
  Banknote, CheckCircle2, XCircle, Clock, Plus, ShieldCheck,
  Filter, X, AlertCircle,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { cn } from '@/lib/utils'

type ChipKey = 'ALL' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'ALLOCATED'

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING_VERIFICATION', label: 'Pending Verification' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'ALLOCATED', label: 'Allocated' },
  { key: 'REJECTED', label: 'Rejected' },
]

interface CashRow {
  id: string
  amount: string
  collectionDate: string
  collectionTime: string
  installmentNumber?: number | null
  reference?: string | null
  notes?: string | null
  status: 'RECORDED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'ALLOCATED' | 'REJECTED'
  rejectionReason?: string | null
  recordedBy: string
  verifiedBy?: string | null
  candidate: { fullName: string; mobile: string }
  loan: { loanNumber: string }
  createdAt: string
  verifiedAt?: string | null
}

interface CandidateRow {
  id: string
  fullName: string
  mobile: string
  activeLoanNumbers: string[]
}

function isToday(d: Date) {
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function AgentCashPage() {
  const queryClient = useQueryClient()
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [newOpen, setNewOpen] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['agent-cash-collections', chip],
    queryFn: () => api.get<{ items: CashRow[]; total: number }>(
      `/api/agent/cash-collections?pageSize=100${chip !== 'ALL' ? `&status=${chip}` : ''}`
    ),
  })

  const allCash = data?.items ?? []

  const todaysCash = allCash
    .filter((c) => isToday(new Date(c.collectionDate)))
    .reduce((s, c) => s + Number(c.amount), 0)
  const pendingCount = allCash.filter((c) => c.status === 'PENDING_VERIFICATION').length
  const verifiedToday = allCash.filter((c) => c.status === 'VERIFIED' || c.status === 'ALLOCATED').length
  const rejectedCount = allCash.filter((c) => c.status === 'REJECTED').length

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Cash Collection"
        description="Record cash pickups from candidates — supervisor verification required."
        icon={<Banknote className="h-5 w-5" />}
        action={
          <Button onClick={() => setNewOpen(true)} size="sm">
            <Plus className="h-4 w-4" /> Record Cash
          </Button>
        }
      />

      {/* Notice */}
      <FadeIn>
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-warning">
                <span className="font-semibold">Note:</span> Agent cannot directly alter the ledger. All cash collections require supervisor verification before allocation.
              </p>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem><KPICard label="Today's Cash" value={formatPaiseToINRShort(todaysCash)} icon={<Banknote className="h-5 w-5" />} variant="success" spark={[120, 180, 220, 280, 320, 380, 420]} /></StaggerItem>
        <StaggerItem><KPICard label="Pending Verification" value={String(pendingCount)} icon={<Clock className="h-5 w-5" />} variant="warning" spark={[1, 2, 2, 2, 2, 2, 2]} /></StaggerItem>
        <StaggerItem><KPICard label="Verified Today" value={String(verifiedToday)} icon={<CheckCircle2 className="h-5 w-5" />} variant="info" spark={[1, 2, 3, 3, 4, 4, 5]} /></StaggerItem>
        <StaggerItem><KPICard label="Rejected" value={String(rejectedCount)} icon={<XCircle className="h-5 w-5" />} variant="destructive" spark={[0, 1, 1, 1, 1, 1, 2]} /></StaggerItem>
      </StaggerContainer>

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filter:
              </span>
              {CHIPS.map((c) => {
                const active = chip === c.key
                return (
                  <button
                    key={c.key}
                    onClick={() => setChip(c.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-medium border transition-all',
                      active ? 'bg-primary text-primary-foreground border-primary shadow-glow' : 'bg-card hover:bg-muted border-border text-muted-foreground'
                    )}
                  >
                    {active && <X className="h-3 w-3" />}
                    {c.label}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {isLoading ? (
        <Card className="shadow-premium"><CardContent className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent></Card>
      ) : allCash.length === 0 ? (
        <EmptyState icon={<Banknote className="h-6 w-6" />} title="No cash collections" description="Record your first cash pickup." />
      ) : (
        <FadeIn>
          <Card className="shadow-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cash Collections</CardTitle>
              <CardDescription>{allCash.length} shown · all amounts in INR</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-6">Reference</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Loan</TableHead>
                      <TableHead>Date · Time</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allCash.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="pl-6 font-mono text-xs">{c.reference ?? '—'}</TableCell>
                        <TableCell className="font-medium">{c.candidate.fullName}</TableCell>
                        <TableCell className="font-mono text-xs">{c.loan.loanNumber}</TableCell>
                        <TableCell className="text-sm">{fmtDate(c.collectionDate)} · {c.collectionTime}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{formatPaiseToINR(Number(c.amount))}</TableCell>
                        <TableCell><StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <StaggerContainer className="md:hidden space-y-3">
                {allCash.map((c) => (
                  <StaggerItem key={c.id}>
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">{c.reference ?? '—'}</p>
                          <p className="text-sm font-medium mt-0.5">{c.candidate.fullName}</p>
                          <p className="text-xs text-muted-foreground">{c.loan.loanNumber}</p>
                        </div>
                        <StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Number(c.amount))}</p></div>
                        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Collected</p><p className="text-sm">{fmtDate(c.collectionDate)} · {c.collectionTime}</p></div>
                      </div>
                      {c.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{c.notes}</p>}
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <NewCashDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}

function NewCashDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data: candidatesData } = useQuery({
    queryKey: ['agent-candidates-for-cash'],
    queryFn: () => api.get<{ items: CandidateRow[] }>('/api/agent/candidates?pageSize=100'),
  })
  const candidates = candidatesData?.items ?? []

  const [candidateId, setCandidateId] = React.useState('')
  const [loanNumber, setLoanNumber] = React.useState('')
  const [loanId, setLoanId] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [date, setDate] = React.useState('')
  const [time, setTime] = React.useState('')
  const [installment, setInstallment] = React.useState('')
  const [notes, setNotes] = React.useState('')

  const createMutation = useMutation({
    mutationFn: () => {
      if (!loanId) throw new Error('Select a candidate with an active loan')
      return api.post('/api/agent/cash-collections', {
        loanId,
        candidateId,
        amount,
        collectionDate: date,
        collectionTime: time,
        installmentNumber: installment ? Number(installment) : null,
        notes: notes || null,
      })
    },
    onSuccess: (res: any) => {
      toast.success('Cash recorded, pending verification', {
        description: `${res.loanNumber} · ${candidates.find((c) => c.id === candidateId)?.fullName ?? ''} · ${amount}`,
      })
      queryClient.invalidateQueries({ queryKey: ['agent-cash-collections'] })
      queryClient.invalidateQueries({ queryKey: ['agent-dashboard'] })
      setCandidateId(''); setLoanId(''); setLoanNumber(''); setAmount(''); setDate(''); setTime(''); setInstallment(''); setNotes('')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error('Failed to record cash', { description: e.message }),
  })

  const onCandidateChange = (v: string) => {
    setCandidateId(v)
    const c = candidates.find((c) => c.id === v)
    if (c) {
      setLoanNumber(c.activeLoanNumbers[0] ?? '')
      api.get<any>(`/api/agent/candidates/${v}`).then((res) => {
        const loan = res.loans?.find((l: any) => l.status === 'ACTIVE')
        if (loan) setLoanId(loan.id)
      }).catch(() => {})
    }
  }

  const submit = () => {
    if (!candidateId || !amount || !date || !time) { toast.error('Candidate, amount, date and time are required'); return }
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Cash Collection</DialogTitle>
          <DialogDescription>Capture a cash pickup from a candidate. Supervisor verification is required to allocate.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Candidate</Label>
            <Select value={candidateId} onValueChange={onCandidateChange}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select candidate" /></SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.fullName} · {c.mobile}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Loan (auto-selected)</Label>
            <Input value={loanNumber || '—'} readOnly className="bg-muted/30 font-mono text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input placeholder="e.g. 5000" value={amount} onChange={(e) => setAmount(e.target.value)} type="text" inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label>Installment # (optional)</Label>
              <Input placeholder="e.g. 2" value={installment} onChange={(e) => setInstallment(e.target.value)} type="number" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Collection Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Collection Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Proof Upload (placeholder)</Label>
            <div className="rounded-xl border-2 border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              <Banknote className="h-6 w-6 mx-auto mb-2 opacity-50" />
              Tap to upload receipt photo (JPG/PDF)
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="e.g. collected from shop" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="rounded-lg bg-warning/5 border border-warning/20 p-2.5 text-[11px] text-warning inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Pending supervisor verification — will not affect ledger yet.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={createMutation.isPending}>Record Cash</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
