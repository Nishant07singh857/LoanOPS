'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  PhoneCall, Phone, MessageCircle, MapPin, Calendar, CheckCircle2,
  Clock, Plus, Filter, X, ChevronRight, PhoneForwarded, User,
  CalendarClock,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { agentCandidates } from '@/lib/mock-data'
import { formatPaiseToINR } from '@/lib/money'
import { cn } from '@/lib/utils'

type ChipKey = 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'OVERDUE' | 'COMPLETED'
type Method = 'PHONE' | 'WHATSAPP' | 'IN_APP' | 'FIELD_VISIT'

interface FollowUp {
  id: string
  candidateName: string
  loanNumber: string
  scheduledAt: string
  method: Method
  outcome: string
  nextFollowUp?: string
  status: 'PENDING' | 'COMPLETED' | 'OVERDUE'
}

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'TODAY', label: 'Today' },
  { key: 'TOMORROW', label: 'Tomorrow' },
  { key: 'THIS_WEEK', label: 'This Week' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'COMPLETED', label: 'Completed' },
]

const methodBadge: Record<Method, string> = {
  PHONE: 'AI_LOW',
  WHATSAPP: 'AI_LOW',
  IN_APP: 'PASSIVE',
  'FIELD_VISIT': 'AI_MEDIUM',
}

const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

// Synthesize follow-ups using agentCandidates
const followUps: FollowUp[] = [
  { id: 'f1', candidateName: 'Karthik Iyer', loanNumber: 'LON-2024-0812', scheduledAt: 'Today 4:00 PM', method: 'PHONE', outcome: 'Pending', nextFollowUp: 'Today 4:00 PM', status: 'PENDING' },
  { id: 'f2', candidateName: 'Sahil Khan', loanNumber: 'LON-2024-0712', scheduledAt: 'Today 5:30 PM', method: 'FIELD_VISIT', outcome: 'Pending', nextFollowUp: 'Today 5:30 PM', status: 'PENDING' },
  { id: 'f3', candidateName: 'Meena Desai', loanNumber: 'LON-2024-0834', scheduledAt: 'Today 6:00 PM', method: 'WHATSAPP', outcome: 'Pending', nextFollowUp: 'Today 6:00 PM', status: 'PENDING' },
  { id: 'f4', candidateName: 'Suresh Patel', loanNumber: 'LON-2024-0698', scheduledAt: 'Yesterday 4:00 PM', method: 'PHONE', outcome: 'No answer — retry tomorrow', nextFollowUp: 'Tomorrow 10:00 AM', status: 'OVERDUE' },
  { id: 'f5', candidateName: 'Rahul Verma', loanNumber: 'LON-2024-0892', scheduledAt: 'Tomorrow 11:00 AM', method: 'PHONE', outcome: 'Pending', nextFollowUp: '20 Sep 11:00 AM', status: 'PENDING' },
  { id: 'f6', candidateName: 'Imran Khan', loanNumber: 'LON-2024-0884', scheduledAt: '19 Sep 10:00 AM', method: 'IN_APP', outcome: 'Pending', nextFollowUp: '19 Sep 10:00 AM', status: 'PENDING' },
  { id: 'f7', candidateName: 'Meena Desai', loanNumber: 'LON-2024-0834', scheduledAt: 'Yesterday 1:00 PM', method: 'WHATSAPP', outcome: 'Reminder sent', nextFollowUp: 'Today 6:00 PM', status: 'COMPLETED' },
  { id: 'f8', candidateName: 'Karthik Iyer', loanNumber: 'LON-2024-0812', scheduledAt: '2 days ago', method: 'PHONE', outcome: 'PTP created for 22 Sep', status: 'COMPLETED' },
  { id: 'f9', candidateName: 'Sahil Khan', loanNumber: 'LON-2024-0712', scheduledAt: '5 days ago', method: 'PHONE', outcome: 'No answer for 3 days', status: 'COMPLETED' },
  { id: 'f10', candidateName: 'Suresh Patel', loanNumber: 'LON-2024-0698', scheduledAt: '1 week ago', method: 'FIELD_VISIT', outcome: 'Visited shop — shut', status: 'COMPLETED' },
]

export default function AgentFollowupsPage() {
  const [chip, setChip] = React.useState<ChipKey>('TODAY')
  const [newOpen, setNewOpen] = React.useState(false)

  const filtered = React.useMemo(() => {
    if (chip === 'TODAY') return followUps.filter((f) => f.scheduledAt.includes('Today'))
    if (chip === 'TOMORROW') return followUps.filter((f) => f.scheduledAt.includes('Tomorrow'))
    if (chip === 'OVERDUE') return followUps.filter((f) => f.status === 'OVERDUE')
    if (chip === 'COMPLETED') return followUps.filter((f) => f.status === 'COMPLETED')
    if (chip === 'THIS_WEEK') return followUps.filter((f) => !f.scheduledAt.includes('ago'))
    return followUps
  }, [chip])

  const todaysCount = followUps.filter((f) => f.scheduledAt.includes('Today') && f.status !== 'COMPLETED').length
  const upcomingCount = followUps.filter((f) => !f.scheduledAt.includes('Today') && !f.scheduledAt.includes('ago') && f.status !== 'COMPLETED').length
  const overdueCount = followUps.filter((f) => f.status === 'OVERDUE').length
  const completedCount = followUps.filter((f) => f.status === 'COMPLETED').length

  const onComplete = (id: string) => toast.success('Follow-up completed', { description: `Follow-up ${id} marked COMPLETED.` })
  const onReschedule = (id: string) => toast.info('Reschedule dialog', { description: `Pick a new time for ${id}.` })

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

      {filtered.length === 0 ? (
        <EmptyState icon={<PhoneCall className="h-6 w-6" />} title="No follow-ups in this view" />
      ) : (
        <StaggerContainer className="space-y-3">
          {filtered.map((f) => {
            const cand = agentCandidates.find((c) => c.name === f.candidateName)
            return (
              <StaggerItem key={f.id}>
                <Card className="shadow-premium hover:border-primary/40 hover:shadow-glow transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {initials(f.candidateName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <Link href={`/agent/candidates/${cand?.id || 'c1'}`} className="text-sm font-semibold hover:text-primary">
                              {f.candidateName}
                            </Link>
                            <p className="font-mono text-[11px] text-muted-foreground">{f.loanNumber}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge variant={methodBadge[f.method]}>{f.method.replace(/_/g, ' ')}</StatusBadge>
                            <StatusBadge variant={f.status === 'COMPLETED' ? 'RESOLVED' : f.status === 'OVERDUE' ? 'OVERDUE' : 'ASSIGNED'}>
                              {f.status === 'COMPLETED' ? 'Completed' : f.status === 'OVERDUE' ? 'Overdue' : 'Pending'}
                            </StatusBadge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {f.scheduledAt}
                          </span>
                          <span>·</span>
                          <span>Outcome: <span className="font-medium text-foreground">{f.outcome}</span></span>
                          {f.nextFollowUp && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 text-info">
                                <Calendar className="h-3 w-3" /> Next: {f.nextFollowUp}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {f.method === 'PHONE' && (
                            <Button asChild size="sm" variant="outline" className="h-8">
                              <a href={`tel:${cand?.mobile.replace(/\s/g, '') || ''}`}><Phone className="h-3.5 w-3.5" /> Call</a>
                            </Button>
                          )}
                          <Button asChild size="sm" variant="ghost" className="h-8">
                            <Link href={`/agent/candidates/${cand?.id || 'c1'}`}>
                              Open <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          {f.status !== 'COMPLETED' && (
                            <>
                              <Button size="sm" variant="outline" className="h-8 ml-auto" onClick={() => onReschedule(f.id)}>
                                <Calendar className="h-3.5 w-3.5" /> Reschedule
                              </Button>
                              <Button size="sm" className="h-8" onClick={() => onComplete(f.id)}>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                              </Button>
                            </>
                          )}
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
  const [candidate, setCandidate] = React.useState('')
  const [date, setDate] = React.useState('')
  const [time, setTime] = React.useState('')
  const [method, setMethod] = React.useState<Method>('PHONE')
  const [notes, setNotes] = React.useState('')

  const submit = () => {
    toast.success('Follow-up scheduled', { description: `${candidate || 'Candidate'} · ${method.replace(/_/g, ' ')} · ${date} ${time}` })
    setCandidate(''); setDate(''); setTime(''); setMethod('PHONE'); setNotes('')
    onOpenChange(false)
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
            <Select value={candidate} onValueChange={setCandidate}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select candidate" /></SelectTrigger>
              <SelectContent>
                {agentCandidates.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name} · {c.loanNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v: string) => setMethod(v as Method)}>
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
            <Label>Notes</Label>
            <Textarea placeholder="e.g. try after 5 PM, candidate works in shop" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
