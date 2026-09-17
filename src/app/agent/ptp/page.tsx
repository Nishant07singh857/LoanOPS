'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Handshake, CheckCircle2, XCircle, MessageCircle, Plus,
  Calendar, Filter, X, Clock, ChevronRight, StickyNote,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
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

interface PtpRow {
  id: string
  promisedAmount: string
  promiseDate: string
  status: string
  notes?: string | null
  fulfilledAt?: string | null
  brokenAt?: string | null
  candidate: { id: string; fullName: string; mobile: string }
  loan: { loanNumber: string }
  createdAt: string
}

interface CandidateRow {
  id: string
  fullName: string
  mobile: string
  activeLoanNumbers: string[]
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isToday(d: Date) {
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

export default function AgentPtpPage() {
  const queryClient = useQueryClient()
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [newOpen, setNewOpen] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['agent-ptp', chip],
    queryFn: () => api.get<{ items: PtpRow[]; total: number }>(
      `/api/agent/ptp?pageSize=100${chip !== 'ALL' ? `&status=${chip}` : ''}`
    ),
  })

  const all = data?.items ?? []

  const activeCount = all.filter((p) => p.status === 'ACTIVE').length
  const fulfilledCount = all.filter((p) => p.status === 'FULFILLED').length
  const brokenCount = all.filter((p) => p.status === 'BROKEN').length
  const dueTodayCount = all.filter((p) => p.status === 'ACTIVE' && isToday(new Date(p.promiseDate))).length

  const fulfillMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/agent/ptp/${id}/fulfill`),
    onSuccess: () => {
      toast.success('PTP fulfilled')
      queryClient.invalidateQueries({ queryKey: ['agent-ptp'] })
      queryClient.invalidateQueries({ queryKey: ['agent-dashboard'] })
    },
    onError: (e: Error) => toast.error('Failed', { description: e.message }),
  })

  const breakMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/agent/ptp/${id}/break`),
    onSuccess: () => {
      toast.error('PTP marked broken')
      queryClient.invalidateQueries({ queryKey: ['agent-ptp'] })
      queryClient.invalidateQueries({ queryKey: ['agent-dashboard'] })
    },
    onError: (e: Error) => toast.error('Failed', { description: e.message }),
  })

  const onReminder = (p: PtpRow) => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.PTP_REMINDER, {
      candidateName: p.candidate.fullName,
      loanNumber: p.loan.loanNumber,
      amount: (Number(p.promisedAmount) / 100).toLocaleString('en-IN'),
      dueDate: fmtDate(p.promiseDate),
    })
    openWhatsApp(p.candidate.mobile, msg)
    toast.success('WhatsApp reminder sent', { description: `Reminder sent to ${p.candidate.fullName}` })
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

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      ) : all.length === 0 ? (
        <EmptyState icon={<Handshake className="h-6 w-6" />} title="No PTPs in this view" description="Create a PTP to see it here." />
      ) : (
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {all.map((p) => (
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
                        {initials(p.candidate.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <Link href={`/agent/candidates/${p.candidate.id}`} className="text-sm font-semibold hover:text-primary">
                            {p.candidate.fullName}
                          </Link>
                          <p className="font-mono text-[11px] text-muted-foreground">{p.loan.loanNumber}</p>
                        </div>
                        <StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Promised</p>
                          <p className="text-sm font-bold tabular-nums">{formatPaiseToINR(Number(p.promisedAmount))}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Promise Date</p>
                          <p className="text-sm inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" /> {fmtDate(p.promiseDate)}
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
                          <Button size="sm" variant="outline" className="h-8" disabled={fulfillMutation.isPending} onClick={() => fulfillMutation.mutate(p.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Fulfilled
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/40 hover:bg-destructive/10" disabled={breakMutation.isPending} onClick={() => breakMutation.mutate(p.id)}>
                            <XCircle className="h-3.5 w-3.5" /> Broken
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-info border-info/40 hover:bg-info/10" onClick={() => onReminder(p)}>
                            <MessageCircle className="h-3.5 w-3.5" /> Reminder
                          </Button>
                        </div>
                      )}
                      {p.status !== 'ACTIVE' && (
                        <div className="flex justify-end mt-3">
                          <Button asChild size="sm" variant="ghost" className="h-8">
                            <Link href={`/agent/candidates/${p.candidate.id}`}>
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
          ))}
        </StaggerContainer>
      )}

      <NewPtpDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}

function NewPtpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data: candidatesData } = useQuery({
    queryKey: ['agent-candidates-for-ptp'],
    queryFn: () => api.get<{ items: CandidateRow[] }>('/api/agent/candidates?pageSize=100'),
  })
  const candidates = candidatesData?.items ?? []

  const [candidateId, setCandidateId] = React.useState('')
  const [loanNumber, setLoanNumber] = React.useState('')
  const [loanId, setLoanId] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [promiseDate, setPromiseDate] = React.useState('')
  const [notes, setNotes] = React.useState('')

  const createMutation = useMutation({
    mutationFn: () => {
      if (!loanId) throw new Error('Select a candidate with an active loan')
      return api.post('/api/agent/ptp', {
        candidateId,
        loanId,
        promisedAmount: amount,
        promiseDate,
        notes,
      })
    },
    onSuccess: () => {
      toast.success('PTP created', { description: `${candidates.find((c) => c.id === candidateId)?.fullName ?? ''} promised ${amount}` })
      queryClient.invalidateQueries({ queryKey: ['agent-ptp'] })
      queryClient.invalidateQueries({ queryKey: ['agent-dashboard'] })
      setCandidateId(''); setLoanId(''); setLoanNumber(''); setAmount(''); setPromiseDate(''); setNotes('')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error('Failed to create PTP', { description: e.message }),
  })

  const onCandidateChange = (v: string) => {
    setCandidateId(v)
    const c = candidates.find((c) => c.id === v)
    if (c) {
      setLoanNumber(c.activeLoanNumbers[0] ?? '')
      // We need the loanId — not directly returned. We'll have to fetch the candidate detail.
      // Simpler: fetch from /api/agent/candidates/[id] but that's overhead. For now, fetch loans on demand.
      // Actually the API returns activeLoanNumbers but no IDs. Let me query the candidate detail:
      api.get<any>(`/api/agent/candidates/${v}`).then((res) => {
        const loan = res.loans?.find((l: any) => l.status === 'ACTIVE')
        if (loan) setLoanId(loan.id)
      }).catch(() => {})
    }
  }

  const submit = () => {
    if (!candidateId || !amount || !promiseDate) { toast.error('Candidate, amount and date are required'); return }
    createMutation.mutate()
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
            <Label>Loan</Label>
            <Input value={loanNumber || '—'} readOnly className="bg-muted/30 font-mono text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input placeholder="e.g. 5000" value={amount} onChange={(e) => setAmount(e.target.value)} type="text" inputMode="decimal" />
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
          <Button onClick={submit} disabled={createMutation.isPending}>Create PTP</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
