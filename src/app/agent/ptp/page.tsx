'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Handshake, CheckCircle2, XCircle, MessageCircle, Ban, Plus,
  Calendar, Filter, X, Clock, ChevronRight, StickyNote,
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { agentPtps, agentCandidates } from '@/lib/mock-data'
import { formatPaiseToINR } from '@/lib/money'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

type ChipKey = 'ALL' | 'ACTIVE' | 'FULFILLED' | 'BROKEN' | 'CANCELLED'

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'FULFILLED', label: 'Fulfilled' },
  { key: 'BROKEN', label: 'Broken' },
  { key: 'CANCELLED', label: 'Cancelled' },
]

const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

export default function AgentPtpPage() {
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [newOpen, setNewOpen] = React.useState(false)

  const filtered = React.useMemo(() => {
    if (chip === 'ALL') return agentPtps
    return agentPtps.filter((p) => p.status === chip)
  }, [chip])

  const activeCount = agentPtps.filter((p) => p.status === 'ACTIVE').length
  const fulfilledCount = agentPtps.filter((p) => p.status === 'FULFILLED').length
  const brokenCount = agentPtps.filter((p) => p.status === 'BROKEN').length
  const dueTodayCount = agentPtps.filter((p) => p.promiseDate === '22 Sep 2024').length

  const onFulfilled = (id: string, name: string) => toast.success('PTP fulfilled', { description: `${name}'s PTP ${id} marked FULFILLED.` })
  const onBroken = (id: string, name: string) => toast.error('PTP marked broken', { description: `${name}'s PTP ${id} marked BROKEN.` })
  const onCancel = (id: string) => toast.info('PTP cancelled', { description: `PTP ${id} has been CANCELLED.` })
  const onReminder = (p: typeof agentPtps[number]) => {
    const cand = agentCandidates.find((c) => c.name === p.candidateName)
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.PTP_REMINDER, {
      candidateName: p.candidateName,
      loanNumber: p.loanNumber,
      amount: (p.promisedAmount / 100).toLocaleString('en-IN'),
      dueDate: p.promiseDate,
    })
    openWhatsApp(cand?.mobile || '', msg)
    toast.success('WhatsApp reminder sent', { description: `Reminder sent to ${p.candidateName}` })
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Promise to Pay"
        description="Track and chase every PTP — active, fulfilled, broken."
        icon={<Handshake className="h-5 w-5" />}
        action={
          <Button onClick={() => setNewOpen(true)} size="sm">
            <Plus className="h-4 w-4" /> New PTP
          </Button>
        }
      />

      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem><KPICard label="Active PTP" value={String(activeCount)} icon={<Handshake className="h-5 w-5" />} variant="info" spark={[2, 3, 3, 3, 3, 3, 3]} /></StaggerItem>
        <StaggerItem><KPICard label="Fulfilled" value={String(fulfilledCount)} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" spark={[0, 0, 0, 0, 0, 0, 0]} /></StaggerItem>
        <StaggerItem><KPICard label="Broken" value={String(brokenCount)} icon={<XCircle className="h-5 w-5" />} variant="destructive" spark={[1, 2, 2, 2, 2, 2, 2]} /></StaggerItem>
        <StaggerItem><KPICard label="Due Today" value={String(dueTodayCount)} icon={<Clock className="h-5 w-5" />} variant="warning" spark={[0, 1, 1, 1, 1, 1, 1]} /></StaggerItem>
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
        <EmptyState icon={<Handshake className="h-6 w-6" />} title="No PTPs in this view" />
      ) : (
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {filtered.map((p) => {
            const cand = agentCandidates.find((c) => c.name === p.candidateName)
            return (
              <StaggerItem key={p.id}>
                <Card className="shadow-premium hover:border-primary/40 hover:shadow-glow transition-all h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className={cn(
                          'text-xs font-semibold',
                          p.status === 'BROKEN' ? 'bg-destructive/10 text-destructive' :
                          p.status === 'FULFILLED' ? 'bg-success/10 text-success' :
                          p.status === 'CANCELLED' ? 'bg-muted text-muted-foreground' :
                          'bg-info/10 text-info'
                        )}>
                          {initials(p.candidateName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <Link href={`/agent/candidates/${cand?.id || 'c1'}`} className="text-sm font-semibold hover:text-primary">
                              {p.candidateName}
                            </Link>
                            <p className="font-mono text-[11px] text-muted-foreground">{p.loanNumber}</p>
                          </div>
                          <StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Promised</p>
                            <p className="text-sm font-bold tabular-nums">{formatPaiseToINR(p.promisedAmount)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Promise Date</p>
                            <p className="text-sm inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" /> {p.promiseDate}
                            </p>
                          </div>
                        </div>
                        {p.notes && (
                          <p className="text-xs text-muted-foreground mt-2 inline-flex items-start gap-1.5">
                            <StickyNote className="h-3 w-3 mt-0.5 flex-shrink-0" /> {p.notes}
                          </p>
                        )}
                        {p.status === 'ACTIVE' && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Button size="sm" variant="outline" className="h-8" onClick={() => onFulfilled(p.id, p.candidateName)}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Fulfilled
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => onBroken(p.id, p.candidateName)}>
                              <XCircle className="h-3.5 w-3.5" /> Broken
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-info border-info/40 hover:bg-info/10" onClick={() => onReminder(p)}>
                              <MessageCircle className="h-3.5 w-3.5" /> Reminder
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 ml-auto" onClick={() => onCancel(p.id)}>
                              <Ban className="h-3.5 w-3.5" /> Cancel
                            </Button>
                          </div>
                        )}
                        {p.status !== 'ACTIVE' && (
                          <div className="flex justify-end mt-3">
                            <Button asChild size="sm" variant="ghost" className="h-8">
                              <Link href={`/agent/candidates/${cand?.id || 'c1'}`}>
                                Open <ChevronRight className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            )
          })}
        </StaggerContainer>
      )}

      <NewPtpDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}

function NewPtpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [candidate, setCandidate] = React.useState('')
  const [loan, setLoan] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [promiseDate, setPromiseDate] = React.useState('')
  const [notes, setNotes] = React.useState('')

  const selectedCand = agentCandidates.find((c) => c.name === candidate)

  const submit = () => {
    toast.success('PTP created', { description: `${candidate || 'Candidate'} promised ${amount || '—'} by ${promiseDate || '—'}.` })
    setCandidate(''); setLoan(''); setAmount(''); setPromiseDate(''); setNotes('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Promise to Pay</DialogTitle>
          <DialogDescription>Capture a candidate's commitment to pay.</DialogDescription>
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
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Loan</Label>
            <Input value={loan || (selectedCand?.loanNumber || '')} readOnly className="bg-muted/30 font-mono text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input placeholder="e.g. 7,425" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Promise Date</Label>
              <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="e.g. will pay after shop revenue comes in" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Create PTP</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
