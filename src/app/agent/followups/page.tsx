'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PhoneCall, Phone, Plus, Filter, X, ChevronRight,
  Clock, CheckCircle2, Calendar, CalendarClock,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/ui/status-badge'
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
import { cn } from '@/lib/utils'

type ChipKey = 'TODAY' | 'UPCOMING' | 'OVERDUE' | 'COMPLETED' | 'ALL'
type Method = 'PHONE' | 'WHATSAPP' | 'IN_APP' | 'FIELD_VISIT'

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'TODAY', label: 'Today' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'ALL', label: 'All' },
]

const methodBadge: Record<Method, string> = {
  PHONE: 'AI_LOW',
  WHATSAPP: 'AI_LOW',
  IN_APP: 'PASSIVE',
  FIELD_VISIT: 'AI_MEDIUM',
}

const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

interface FollowUp {
  id: string
  contactDate: string
  contactMethod: Method
  outcome?: string | null
  notes?: string | null
  nextFollowUp?: string | null
  candidate: { id: string; fullName: string; mobile: string }
  loan?: { loanNumber: string } | null
  createdAt: string
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
function isFuture(d: Date) { return d > new Date() }
function isPast(d: Date) { return d < new Date() && !isToday(d) }

function fmtDateTime(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function AgentFollowupsPage() {
  const queryClient = useQueryClient()
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [newOpen, setNewOpen] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['agent-follow-ups'],
    queryFn: () => api.get<{ items: FollowUp[]; total: number }>('/api/agent/follow-ups?pageSize=100'),
  })

  const all = data?.items ?? []

  const filtered = React.useMemo(() => {
    if (chip === 'TODAY') return all.filter((f) => f.nextFollowUp && isToday(new Date(f.nextFollowUp)))
    if (chip === 'UPCOMING') return all.filter((f) => f.nextFollowUp && isFuture(new Date(f.nextFollowUp)))
    if (chip === 'OVERDUE') return all.filter((f) => f.nextFollowUp && isPast(new Date(f.nextFollowUp)) && !f.outcome)
    if (chip === 'COMPLETED') return all.filter((f) => !!f.outcome)
    return all
  }, [all, chip])

  const todaysCount = all.filter((f) => f.nextFollowUp && isToday(new Date(f.nextFollowUp)) && !f.outcome).length
  const upcomingCount = all.filter((f) => f.nextFollowUp && isFuture(new Date(f.nextFollowUp)) && !f.outcome).length
  const overdueCount = all.filter((f) => f.nextFollowUp && isPast(new Date(f.nextFollowUp)) && !f.outcome).length
  const completedCount = all.filter((f) => !!f.outcome).length

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Follow-ups"
        description="Scheduled contact calls, WhatsApps and field visits."
        icon={<PhoneCall className="h-5 w-5" />}
        action={
          <Button onClick={() => setNewOpen(true)} size="sm">
            <Plus className="h-4 w-4" /> Schedule Follow-up
          </Button>
        }
      />

      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem><KPICard label="Today" value={String(todaysCount)} icon={<PhoneCall className="h-5 w-5" />} variant="info" spark={[3, 4, 5, 4, 5, 5, 5]} /></StaggerItem>
        <StaggerItem><KPICard label="Upcoming" value={String(upcomingCount)} icon={<CalendarClock className="h-5 w-5" />} variant="default" spark={[2, 3, 3, 4, 3, 4, 4]} /></StaggerItem>
        <StaggerItem><KPICard label="Overdue" value={String(overdueCount)} icon={<Clock className="h-5 w-5" />} variant="destructive" spark={[0, 1, 1, 1, 1, 1, 1]} /></StaggerItem>
        <StaggerItem><KPICard label="Completed" value={String(completedCount)} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" spark={[2, 3, 4, 5, 6, 7, 8]} /></StaggerItem>
      </StaggerContainer>

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Filter className="h-3 w-3" /> Show:
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
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<PhoneCall className="h-6 w-6" />} title="No follow-ups in this view" description="Schedule a follow-up to see it here." />
      ) : (
        <StaggerContainer className="space-y-3">
          {filtered.map((f) => {
            const nextDate = f.nextFollowUp ? new Date(f.nextFollowUp) : null
            const overdue = nextDate ? isPast(nextDate) && !f.outcome : false
            return (
              <StaggerItem key={f.id}>
                <Card className="shadow-premium hover:border-primary/40 hover:shadow-glow transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {initials(f.candidate.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <Link href={`/agent/candidates/${f.candidate.id}`} className="text-sm font-semibold hover:text-primary">
                              {f.candidate.fullName}
                            </Link>
                            <p className="font-mono text-[11px] text-muted-foreground">{f.loan?.loanNumber ?? '—'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge variant={methodBadge[f.contactMethod] as any}>{f.contactMethod.replace(/_/g, ' ')}</StatusBadge>
                            <StatusBadge variant={overdue ? 'OVERDUE' : f.outcome ? 'RESOLVED' : 'ASSIGNED'}>
                              {overdue ? 'Overdue' : f.outcome ? 'Completed' : 'Pending'}
                            </StatusBadge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                          {nextDate && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {fmtDateTime(f.nextFollowUp)}
                            </span>
                          )}
                          {f.outcome && (
                            <>
                              <span>·</span>
                              <span>Outcome: <span className="font-medium text-foreground">{f.outcome}</span></span>
                            </>
                          )}
                        </div>
                        {f.notes && <p className="text-xs text-muted-foreground mt-1">{f.notes}</p>}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {f.contactMethod === 'PHONE' && (
                            <Button asChild size="sm" variant="outline" className="h-8">
                              <a href={`tel:${f.candidate.mobile.replace(/\s/g, '')}`}><Phone className="h-3.5 w-3.5" /> Call</a>
                            </Button>
                          )}
                          <Button asChild size="sm" variant="ghost" className="h-8">
                            <Link href={`/agent/candidates/${f.candidate.id}`}>
                              Open <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            )
          })}
        </StaggerContainer>
      )}

      <NewFollowupDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}

function NewFollowupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data: candidatesData } = useQuery({
    queryKey: ['agent-candidates-for-followup'],
    queryFn: () => api.get<{ items: CandidateRow[] }>('/api/agent/candidates?pageSize=100'),
  })
  const candidates = candidatesData?.items ?? []

  const [candidateId, setCandidateId] = React.useState('')
  const [contactMethod, setContactMethod] = React.useState<Method>('PHONE')
  const [outcome, setOutcome] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [nextFollowUp, setNextFollowUp] = React.useState('')

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/agent/follow-ups', {
      candidateId,
      contactMethod,
      outcome: outcome || null,
      notes: notes || null,
      nextFollowUp: nextFollowUp ? new Date(nextFollowUp).toISOString() : null,
    }),
    onSuccess: () => {
      toast.success('Follow-up scheduled', { description: `${contactMethod.replace(/_/g, ' ')} for ${candidates.find((c) => c.id === candidateId)?.fullName ?? ''}` })
      queryClient.invalidateQueries({ queryKey: ['agent-follow-ups'] })
      queryClient.invalidateQueries({ queryKey: ['agent-dashboard'] })
      setCandidateId(''); setContactMethod('PHONE'); setOutcome(''); setNotes(''); setNextFollowUp('')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error('Failed to schedule follow-up', { description: e.message }),
  })

  const submit = () => {
    if (!candidateId) { toast.error('Please select a candidate'); return }
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Follow-up</DialogTitle>
          <DialogDescription>Plan a contact attempt with the candidate.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Candidate</Label>
            <Select value={candidateId} onValueChange={setCandidateId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select candidate" /></SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.fullName} · {c.mobile}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={contactMethod} onValueChange={(v: string) => setContactMethod(v as Method)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PHONE">Phone</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="IN_APP">In-App Message</SelectItem>
                <SelectItem value="FIELD_VISIT">Field Visit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Next Follow-up Date & Time</Label>
            <Input type="datetime-local" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Outcome (optional)</Label>
            <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. reminder sent" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="e.g. try after 5 PM, candidate works in shop" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={createMutation.isPending}>Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
