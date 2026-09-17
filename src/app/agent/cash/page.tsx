'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Banknote, CheckCircle2, XCircle, Clock, Plus, ShieldCheck,
  Filter, X, Calendar, ChevronRight, AlertCircle,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
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
import { cashCollections, agentCandidates } from '@/lib/mock-data'
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

// Synthesize additional cash collections for richer UI
const extraCash = [
  { id: 'cc6', candidateName: 'Sneha Bhat', loanNumber: 'LON-2024-0915', amount: 696000, collectionDate: '12 Sep', collectionTime: '2:00 PM', status: 'VERIFIED' as const, reference: 'CASH-2024-4462', notes: 'Verified by supervisor' },
  { id: 'cc7', candidateName: 'Imran Khan', loanNumber: 'LON-2024-0884', amount: 285000, collectionDate: '10 Sep', collectionTime: '11:00 AM', status: 'ALLOCATED' as const, reference: 'CASH-2024-4459' },
  { id: 'cc8', candidateName: 'Meena Desai', loanNumber: 'LON-2024-0834', amount: 270000, collectionDate: '08 Sep', collectionTime: '5:30 PM', status: 'REJECTED' as const, reference: 'CASH-2024-4455', notes: 'Receipt unclear' },
]
const allCash = [...cashCollections, ...extraCash]

export default function AgentCashPage() {
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [newOpen, setNewOpen] = React.useState(false)

  const filtered = React.useMemo(() => {
    if (chip === 'ALL') return allCash
    return allCash.filter((c) => c.status === chip)
  }, [chip])

  const todaysCash = allCash.filter((c) => c.collectionDate === 'Today').reduce((s, c) => s + c.amount, 0)
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

      {filtered.length === 0 ? (
        <EmptyState icon={<Banknote className="h-6 w-6" />} title="No cash collections in this view" />
      ) : (
        <FadeIn>
          <Card className="shadow-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cash Collections</CardTitle>
              <CardDescription>{filtered.length} shown · all amounts in INR</CardDescription>
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
                    {filtered.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="pl-6 font-mono text-xs">{c.reference}</TableCell>
                        <TableCell className="font-medium">{c.candidateName}</TableCell>
                        <TableCell className="font-mono text-xs">{c.loanNumber}</TableCell>
                        <TableCell className="text-sm">{c.collectionDate} · {c.collectionTime}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{formatPaiseToINR(c.amount)}</TableCell>
                        <TableCell><StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <StaggerContainer className="md:hidden space-y-3">
                {filtered.map((c) => (
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
  const [candidate, setCandidate] = React.useState('')
  const [loan, setLoan] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [date, setDate] = React.useState('')
  const [time, setTime] = React.useState('')
  const [installment, setInstallment] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const ref = React.useMemo(() => `CASH-2024-${Math.floor(1000 + Math.random() * 9000)}`, [open])

  const selectedCand = agentCandidates.find((c) => c.name === candidate)

  const submit = () => {
    toast.success('Cash recorded, pending verification', {
      description: `${ref} · ${candidate || 'Candidate'} · ${amount || '—'} pending supervisor review.`,
    })
    setCandidate(''); setLoan(''); setAmount(''); setDate(''); setTime(''); setInstallment(''); setNotes('')
    onOpenChange(false)
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
            <Select
              value={candidate}
              onValueChange={(v) => { setCandidate(v); setLoan(agentCandidates.find((c) => c.name === v)?.loanNumber || '') }}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Select candidate" /></SelectTrigger>
              <SelectContent>
                {agentCandidates.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name} · {c.loanNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Loan (auto-selected)</Label>
            <Input value={loan || (selectedCand?.loanNumber || '')} readOnly className="bg-muted/30 font-mono text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input placeholder="e.g. 7,425" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Installment # (optional)</Label>
              <Input placeholder="e.g. 2" value={installment} onChange={(e) => setInstallment(e.target.value)} />
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
            <Label>Reference (auto-generated)</Label>
            <Input value={ref} readOnly className="bg-muted/30 font-mono text-xs" />
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
          <Button onClick={submit}>Record Cash</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
