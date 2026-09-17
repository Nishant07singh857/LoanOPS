'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ListTodo, PhoneCall, MessageCircle, CheckCircle2, Search, Filter,
  X, Plus, ArrowUpDown, Clock, Calendar, ArrowLeft, ChevronRight,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
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
import { agentTasks, agentCandidates, type CollectionTaskRow } from '@/lib/mock-data'
import { formatPaiseToINR } from '@/lib/money'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

type ChipKey = 'ALL' | 'TODAY' | 'TOMORROW' | 'OVERDUE' | 'URGENT' | 'HIGH' | 'MEDIUM'
type StatusKey = 'ALL' | 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'CLOSED'
type SortKey = 'PRIORITY' | 'DUE'

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'TODAY', label: 'Today' },
  { key: 'TOMORROW', label: 'Tomorrow' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'URGENT', label: 'Urgent' },
  { key: 'HIGH', label: 'High' },
  { key: 'MEDIUM', label: 'Medium' },
]
const STATUSES: { key: StatusKey; label: string }[] = [
  { key: 'ALL', label: 'All Status' },
  { key: 'OPEN', label: 'Open' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
]

const priorityRank: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const dueRank = (s: string) => {
  if (s === 'Today') return 0
  if (s === 'Tomorrow') return 1
  if (/OVERDUE/i.test(s)) return -1
  return 5
}

const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

// Synthesize additional tasks for richer UI
const extraTasks: CollectionTaskRow[] = [
  { id: 't6', candidateName: 'Imran Khan', loanNumber: 'LON-2024-0884', amount: 285000, dueDate: '19 Sep', priority: 'MEDIUM', status: 'OPEN', assignedTo: 'You', lastContact: '4 days ago', nextFollowUp: '19 Sep 10:00 AM' },
  { id: 't7', candidateName: 'Sahil Khan', loanNumber: 'LON-2024-0712', amount: 1220000, dueDate: 'OVERDUE 32 days', priority: 'URGENT', status: 'OPEN', assignedTo: 'You', lastContact: '5 days ago', nextFollowUp: 'Today 5:30 PM' },
  { id: 't8', candidateName: 'Karthik Iyer', loanNumber: 'LON-2024-0812', amount: 1430000, dueDate: 'Tomorrow', priority: 'HIGH', status: 'ASSIGNED', assignedTo: 'You', lastContact: '2 days ago', nextFollowUp: 'Tomorrow 11:00 AM' },
  { id: 't9', candidateName: 'Suresh Patel', loanNumber: 'LON-2024-0698', amount: 369000, dueDate: 'OVERDUE 18 days', priority: 'URGENT', status: 'ASSIGNED', assignedTo: 'You', lastContact: '1 week ago', nextFollowUp: 'Tomorrow 10:00 AM' },
  { id: 't10', candidateName: 'Meena Desai', loanNumber: 'LON-2024-0834', amount: 270000, dueDate: 'Today', priority: 'LOW', status: 'RESOLVED', assignedTo: 'You', lastContact: 'Yesterday', nextFollowUp: 'Today 6:00 PM' },
  { id: 't11', candidateName: 'Rahul Verma', loanNumber: 'LON-2024-0892', amount: 742500, dueDate: '20 Sep', priority: 'MEDIUM', status: 'CLOSED', assignedTo: 'You', lastContact: '3 days ago' },
]
const allTasks = [...agentTasks, ...extraTasks]

export default function AgentTasksPage() {
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [status, setStatus] = React.useState<StatusKey>('ALL')
  const [sort, setSort] = React.useState<SortKey>('PRIORITY')
  const [search, setSearch] = React.useState('')
  const [newOpen, setNewOpen] = React.useState(false)

  const filtered = React.useMemo(() => {
    let rows = [...allTasks]
    if (chip === 'OVERDUE') rows = rows.filter((t) => /OVERDUE/i.test(t.dueDate))
    else if (chip === 'TODAY') rows = rows.filter((t) => t.dueDate === 'Today')
    else if (chip === 'TOMORROW') rows = rows.filter((t) => t.dueDate === 'Tomorrow')
    else if (chip === 'URGENT' || chip === 'HIGH' || chip === 'MEDIUM') rows = rows.filter((t) => t.priority === chip)
    if (status !== 'ALL') rows = rows.filter((t) => t.status === status)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((t) => t.candidateName.toLowerCase().includes(q) || t.loanNumber.toLowerCase().includes(q))
    }
    rows.sort((a, b) => {
      if (sort === 'PRIORITY') return priorityRank[a.priority] - priorityRank[b.priority]
      return dueRank(a.dueDate) - dueRank(b.dueDate)
    })
    return rows
  }, [chip, status, sort, search])

  const onCall = (n: string) => toast.info(`Calling ${n}…`, { description: 'Connecting via IVR.' })
  const onWhatsApp = (t: CollectionTaskRow) => {
    const cand = agentCandidates.find((c) => c.name === t.candidateName)
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.PAYMENT_REMINDER, {
      candidateName: t.candidateName,
      loanNumber: t.loanNumber,
      amount: (t.amount / 100).toLocaleString('en-IN'),
      dueDate: t.dueDate,
    })
    openWhatsApp(cand?.mobile || '', msg)
    toast.success('WhatsApp draft opened', { description: `Reminder sent to ${t.candidateName}` })
  }
  const onComplete = (id: string) => toast.success('Task completed', { description: `Task ${id} marked RESOLVED.` })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Collection Tasks"
        description="Your assigned collection follow-ups — call, WhatsApp, complete."
        icon={<ListTodo className="h-5 w-5" />}
        action={
          <Button onClick={() => setNewOpen(true)} size="sm">
            <Plus className="h-4 w-4" /> New Task
          </Button>
        }
      />

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search candidate or loan number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={status} onValueChange={(v: string) => setStatus(v as StatusKey)}>
                <SelectTrigger className="md:w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSort(sort === 'PRIORITY' ? 'DUE' : 'PRIORITY')}
                className="h-9"
              >
                <ArrowUpDown className="h-3.5 w-3.5" /> Sort: {sort === 'PRIORITY' ? 'Priority' : 'Due Date'}
              </Button>
            </div>
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
        <EmptyState icon={<ListTodo className="h-6 w-6" />} title="No tasks match these filters" />
      ) : (
        <StaggerContainer className="space-y-3">
          {filtered.map((t) => {
            const cand = agentCandidates.find((c) => c.name === t.candidateName)
            return (
              <StaggerItem key={t.id}>
                <Card className="shadow-premium hover:border-primary/40 hover:shadow-glow transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Link href={`/agent/candidates/${cand?.id || 'c1'}`} className="flex-shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {initials(t.candidateName)}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <Link href={`/agent/candidates/${cand?.id || 'c1'}`} className="text-sm font-semibold hover:text-primary">
                              {t.candidateName}
                            </Link>
                            <p className="font-mono text-[11px] text-muted-foreground">{t.loanNumber}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge variant={t.priority}>{t.priority}</StatusBadge>
                            <StatusBadge variant={t.status}>{formatStatus(t.status)}</StatusBadge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p>
                            <p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(t.amount)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Due</p>
                            <p className="text-sm inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" /> {t.dueDate}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Contact</p>
                            <p className="text-sm">{t.lastContact || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next Follow-up</p>
                            <p className="text-sm inline-flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" /> {t.nextFollowUp || '—'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button size="sm" variant="outline" className="h-8" onClick={() => onCall(t.candidateName)}>
                            <PhoneCall className="h-3.5 w-3.5" /> Call
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-info border-info/40 hover:bg-info/10"
                            onClick={() => onWhatsApp(t)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </Button>
                          <Button asChild size="sm" variant="ghost" className="h-8">
                            <Link href={`/agent/candidates/${cand?.id || 'c1'}`}>
                              Open <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          {(t.status === 'OPEN' || t.status === 'ASSIGNED') && (
                            <Button size="sm" className="h-8 ml-auto" onClick={() => onComplete(t.id)}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                            </Button>
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

      <NewTaskDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}

function NewTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [candidate, setCandidate] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [dueDate, setDueDate] = React.useState('')
  const [priority, setPriority] = React.useState('MEDIUM')

  const submit = () => {
    toast.success('Task created', {
      description: `New ${priority} task for ${candidate || 'candidate'} due ${dueDate || '—'}.`,
    })
    setCandidate(''); setAmount(''); setDueDate(''); setPriority('MEDIUM')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Collection Task</DialogTitle>
          <DialogDescription>Create a follow-up task assigned to yourself.</DialogDescription>
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
              <Label>Amount (₹)</Label>
              <Input placeholder="e.g. 7,425" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
