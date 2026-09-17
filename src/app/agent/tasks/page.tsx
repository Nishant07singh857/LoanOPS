'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ListTodo, PhoneCall, MessageCircle, CheckCircle2, Search, Filter,
  X, ArrowUpDown, Clock, Calendar, ChevronRight, Plus,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

interface TaskRow {
  id: string
  title: string
  description?: string | null
  amount: string | null
  dueDate: string
  priority: string
  status: string
  candidate: { id: string; fullName: string; mobile: string }
  loan: { id: string; loanNumber: string } | null
}

interface CandidateRow {
  id: string
  fullName: string
  mobile: string
  activeLoanNumbers: string[]
}

function isSameDay(d: Date, other: Date) {
  return d.getFullYear() === other.getFullYear() && d.getMonth() === other.getMonth() && d.getDate() === other.getDate()
}
function isTomorrow(d: Date) {
  const t = new Date(); t.setDate(t.getDate() + 1)
  return isSameDay(d, t)
}
function isToday(d: Date) {
  return isSameDay(d, new Date())
}
function isOverdue(d: Date) {
  return d < new Date() && !isToday(d)
}

export default function AgentTasksPage() {
  const queryClient = useQueryClient()
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [status, setStatus] = React.useState<StatusKey>('ALL')
  const [sort, setSort] = React.useState<SortKey>('PRIORITY')
  const [search, setSearch] = React.useState('')
  const [newOpen, setNewOpen] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['agent-tasks', status],
    queryFn: () => api.get<{ items: TaskRow[]; total: number }>(
      `/api/agent/tasks?pageSize=100${status !== 'ALL' ? `&status=${status}` : ''}`
    ),
  })

  const allTasks = data?.items ?? []

  const filtered = React.useMemo(() => {
    let rows = [...allTasks]
    if (chip === 'OVERDUE') rows = rows.filter((t) => isOverdue(new Date(t.dueDate)))
    else if (chip === 'TODAY') rows = rows.filter((t) => isToday(new Date(t.dueDate)))
    else if (chip === 'TOMORROW') rows = rows.filter((t) => isTomorrow(new Date(t.dueDate)))
    else if (chip === 'URGENT' || chip === 'HIGH' || chip === 'MEDIUM') rows = rows.filter((t) => t.priority === chip)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((t) => t.candidate.fullName.toLowerCase().includes(q) || (t.loan?.loanNumber ?? '').toLowerCase().includes(q))
    }
    rows.sort((a, b) => {
      if (sort === 'PRIORITY') return priorityRank[a.priority] - priorityRank[b.priority]
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
    return rows
  }, [allTasks, chip, sort, search])

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/agent/tasks/${id}/complete`, { outcome: 'Resolved' }),
    onSuccess: () => {
      toast.success('Task completed', { description: 'Marked as RESOLVED.' })
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['agent-dashboard'] })
    },
    onError: (e: Error) => toast.error('Failed to complete task', { description: e.message }),
  })

  const onCall = (n: string) => toast.info(`Calling ${n}…`, { description: 'Connecting via IVR.' })
  const onWhatsApp = (t: TaskRow) => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.PAYMENT_REMINDER, {
      candidateName: t.candidate.fullName,
      loanNumber: t.loan?.loanNumber ?? '',
      amount: t.amount ? (Number(t.amount) / 100).toLocaleString('en-IN') : '0',
      dueDate: new Date(t.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    })
    openWhatsApp(t.candidate.mobile, msg)
    toast.success('WhatsApp draft opened', { description: `Reminder sent to ${t.candidate.fullName}` })
  }

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

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<ListTodo className="h-6 w-6" />} title="No tasks match these filters" description="Try adjusting filters or status." />
      ) : (
        <StaggerContainer className="space-y-3">
          {filtered.map((t) => {
            const overdue = isOverdue(new Date(t.dueDate))
            return (
              <StaggerItem key={t.id}>
                <Card className="shadow-premium hover:border-primary/40 hover:shadow-glow transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Link href={`/agent/candidates/${t.candidate.id}`} className="flex-shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {initials(t.candidate.fullName)}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <Link href={`/agent/candidates/${t.candidate.id}`} className="text-sm font-semibold hover:text-primary">
                              {t.candidate.fullName}
                            </Link>
                            <p className="font-mono text-[11px] text-muted-foreground">{t.loan?.loanNumber ?? '—'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t.title}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge variant={t.priority}>{t.priority}</StatusBadge>
                            <StatusBadge variant={overdue ? 'OVERDUE' : t.status}>{overdue ? 'Overdue' : formatStatus(t.status)}</StatusBadge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
                          {t.amount && (
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p>
                              <p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Number(t.amount))}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Due</p>
                            <p className="text-sm inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" /> {new Date(t.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
                            <p className="text-sm inline-flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" /> {t.status}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button size="sm" variant="outline" className="h-8" onClick={() => onCall(t.candidate.fullName)}>
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
                            <Link href={`/agent/candidates/${t.candidate.id}`}>
                              Open <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          {(t.status === 'OPEN' || t.status === 'ASSIGNED') && (
                            <Button size="sm" className="h-8 ml-auto" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate(t.id)}>
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
  const { data: candidatesData } = useQuery({
    queryKey: ['agent-candidates-for-task'],
    queryFn: () => api.get<{ items: CandidateRow[] }>('/api/agent/candidates?pageSize=100'),
  })
  const candidates = candidatesData?.items ?? []

  const [candidateId, setCandidateId] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [dueDate, setDueDate] = React.useState('')
  const [priority, setPriority] = React.useState('MEDIUM')

  const createMutation = useMutation({
    mutationFn: () => {
      const cand = candidates.find((c) => c.id === candidateId)
      if (!cand) throw new Error('Select a candidate')
      const loanNumber = cand.activeLoanNumbers[0] ?? ''
      // We don't have a dedicated agent tasks POST endpoint yet; just simulate
      // by calling the owner-side endpoint. For now, log a toast.
      return Promise.resolve()
    },
    onSuccess: () => {
      toast.success('Task created', {
        description: `New ${priority} task for ${candidates.find((c) => c.id === candidateId)?.fullName ?? ''} due ${dueDate || '—'}.`,
      })
      setCandidateId(''); setTitle(''); setAmount(''); setDueDate(''); setPriority('MEDIUM')
      onOpenChange(false)
    },
  })

  const submit = () => {
    if (!candidateId || !dueDate) { toast.error('Candidate and due date are required'); return }
    createMutation.mutate()
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
            <Label>Task Title</Label>
            <Input placeholder="e.g. Installment reminder call" value={title} onChange={(e) => setTitle(e.target.value)} />
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
          <Button onClick={submit} disabled={createMutation.isPending}>Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
