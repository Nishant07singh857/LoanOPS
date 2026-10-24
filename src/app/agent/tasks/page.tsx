'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ListTodo, PhoneCall, MessageCircle, CheckCircle2, Search, Filter,
  X, ArrowUpDown, Clock, Calendar, ChevronRight, Plus, Banknote, Upload, ShieldCheck,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
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
import { api, ApiRequestError } from '@/lib/api-client'
import { formatPaiseToINR } from '@/lib/money'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

function generateCashIdempotencyKey() {
  return `cash_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

async function postCashCollectionWithIdempotency(payload: Record<string, any>, idempotencyKey: string) {
  const r = await fetch('/api/agent/cash-collections', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ ...payload, idempotencyKey }),
  })
  const text = await r.text()
  let json: any = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      // ignore non-JSON
    }
  }
  if (!r.ok) {
    const rawErr = json?.error
    const message =
      rawErr && typeof rawErr === 'object'
        ? String(rawErr.message || r.statusText || 'Request failed')
        : typeof rawErr === 'string'
          ? rawErr
          : r.statusText || 'Request failed'
    throw new ApiRequestError(
      String(rawErr?.code || 'UNKNOWN'),
      message,
      r.status,
      rawErr?.details
    )
  }
  return json && typeof json === 'object' && 'data' in json ? json.data : json
}

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
  const [collectTask, setCollectTask] = React.useState<TaskRow | null>(null)

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

  const onCall = (n: string) => toast.info(`Calling ${n}…`, { description: 'Opening your phone dialer — the call is placed by your device.' })
  const onWhatsApp = (t: TaskRow) => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.PAYMENT_REMINDER, {
      candidateName: t.candidate.fullName,
      loanNumber: t.loan?.loanNumber ?? '',
      amount: t.amount ? (Number(t.amount) / 100).toLocaleString('en-IN') : '0',
      dueDate: new Date(t.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    })
    openWhatsApp(t.candidate.mobile, msg)
    toast.success('WhatsApp draft opened', { description: `Press Send in WhatsApp to deliver the reminder to ${t.candidate.fullName}.` })
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
                          {t.loan && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-success border-success/40 hover:bg-success/10"
                              onClick={() => setCollectTask(t)}
                            >
                              <Banknote className="h-3.5 w-3.5" /> Collect Cash
                            </Button>
                          )}
                          <Button asChild size="sm" variant="outline" className="h-8">
                            <a href={`tel:${t.candidate.mobile.replace(/\s/g, '')}`} onClick={() => onCall(t.candidate.fullName)}>
                              <PhoneCall className="h-3.5 w-3.5" /> Call
                            </a>
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
      {collectTask && <TaskCollectCashDialog key={collectTask.id} task={collectTask} onClose={() => setCollectTask(null)} />}
    </div>
  )
}

function TaskCollectCashDialog({ task, onClose }: { task: TaskRow | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [amountRupees, setAmountRupees] = React.useState(() =>
    task?.amount && Number(task.amount) > 0 ? String(Number(task.amount) / 100) : ''
  )
  const [collectionDate, setCollectionDate] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [installmentNumber, setInstallmentNumber] = React.useState<number | null>(null)
  const [notes, setNotes] = React.useState('')
  const [proofBase64, setProofBase64] = React.useState<string | null>(null)
  const [proofFileName, setProofFileName] = React.useState('')
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => generateCashIdempotencyKey())

  const { data: candidateDetail, isLoading } = useQuery({
    queryKey: ['agent-candidate', task?.candidate.id],
    queryFn: () => api.get<any>(`/api/agent/candidates/${task!.candidate.id}`),
    enabled: Boolean(task?.candidate.id),
  })

  const loan = React.useMemo(() => {
    if (!candidateDetail?.loans) return null
    if (task?.loan?.id) {
      const matched = candidateDetail.loans.find((l: any) => l.id === task.loan?.id)
      if (matched) return matched
    }
    return candidateDetail.loans.find((l: any) => l.status === 'ACTIVE') ?? candidateDetail.loans[0] ?? null
  }, [candidateDetail, task])

  const totalOutstandingPaise = React.useMemo(() => {
    if (!loan) return 0
    const schedRem = (loan.schedule ?? []).reduce(
      (sum: number, s: any) => sum + Math.max(0, Number(s.totalDue || 0) - Number(s.paidAmount || 0)),
      0
    )
    const raw =
      loan.totalOutstanding !== undefined
        ? Number(loan.totalOutstanding)
        : Number(loan.outstandingPrincipal || 0) +
          Number(loan.outstandingInterest || 0) +
          Number(loan.outstandingFees || 0)
    return raw > 0 ? raw : schedRem
  }, [loan])

  const nextInstallmentRow = React.useMemo(() => {
    if (!loan?.schedule) return null
    return (
      loan.schedule.find((s: any) => s.status === 'OVERDUE' || s.status === 'DUE' || s.status === 'PARTIALLY_PAID') ??
      loan.schedule.find((s: any) => s.status !== 'PAID') ??
      null
    )
  }, [loan])

  const nextInstallmentDuePaise = React.useMemo(() => {
    if (nextInstallmentRow) {
      return Math.max(0, Number(nextInstallmentRow.totalDue || 0) - Number(nextInstallmentRow.paidAmount || 0))
    }
    return Number(loan?.installmentAmount || task?.amount || 0)
  }, [nextInstallmentRow, loan, task])

  const handleAmountChange = (val: string) => {
    setAmountRupees(val)
    setIdempotencyKey(generateCashIdempotencyKey())
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validMimeTypes.includes(file.type)) {
      toast.error('Invalid file format', { description: 'Receipt photo must be JPEG, PNG, or WEBP.' })
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large', { description: 'Receipt photo must be 5 MB or smaller.' })
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProofBase64(reader.result)
        setProofFileName(file.name)
      }
    }
    reader.readAsDataURL(file)
  }

  const parsedRupees = Number(amountRupees)
  const amountPaise = !Number.isNaN(parsedRupees) && parsedRupees > 0 ? Math.round(parsedRupees * 100) : 0
  const isAmountValid =
    amountPaise > 0 && (totalOutstandingPaise === 0 || amountPaise <= totalOutstandingPaise)

  const collectMutation = useMutation({
    mutationFn: () => {
      const targetLoanId = loan?.id ?? task?.loan?.id
      if (!task || !targetLoanId) throw new Error('No active loan found for this candidate')
      if (!isAmountValid) {
        throw new Error(`Amount must be between ₹1 and ${formatPaiseToINR(totalOutstandingPaise)}`)
      }
      return postCashCollectionWithIdempotency(
        {
          loanId: targetLoanId,
          candidateId: task.candidate.id,
          amount: String(amountPaise),
          collectionDate,
          installmentNumber,
          notes: notes.trim() || null,
          proofUrl: proofBase64 || null,
        },
        idempotencyKey
      )
    },
    onSuccess: (res: any) => {
      const receiptLabel = res?.receiptNumber || res?.paymentNumber || 'Issued'
      toast.success('Cash collected & receipt issued', {
        description: `Receipt ${receiptLabel} · ${formatPaiseToINR(amountPaise)} for ${task?.candidate.fullName}`,
      })
      const keysToInvalidate = [
        ['agent-candidate', task?.candidate.id],
        ['agent-candidates'],
        ['agent-cash'],
        ['agent-cash-collections'],
        ['agent-dashboard'],
        ['agent-tasks'],
        ['owner-dashboard'],
        ['owner-loans'],
        ['owner-payments'],
        ['owner-cash-collections'],
        ['owner-ledger'],
        ['candidate-loan'],
        ['candidate-payments'],
        ['candidate-receipts'],
        ['candidate-schedule'],
      ]
      for (const key of keysToInvalidate) {
        queryClient.invalidateQueries({ queryKey: key })
      }
      onClose()
    },
    onError: (e: Error) => toast.error('Failed to record cash', { description: e.message }),
  })

  return (
    <Dialog open={Boolean(task)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-success" /> Collect Cash
          </DialogTitle>
          <DialogDescription>
            Record cash repayment from borrower. Schedule updates immediately and a digital receipt is issued.
          </DialogDescription>
        </DialogHeader>

        {task && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Candidate</span>
                <span className="font-semibold">{task.candidate.fullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Loan Number</span>
                <span className="font-mono text-xs font-semibold">{loan?.loanNumber ?? task.loan?.loanNumber ?? '—'}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Outstanding</p>
                  <p className="text-sm font-bold tabular-nums">
                    {isLoading ? 'Loading…' : formatPaiseToINR(totalOutstandingPaise)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next Installment Due</p>
                  <p className="text-sm font-bold tabular-nums text-primary">
                    {isLoading ? 'Loading…' : formatPaiseToINR(nextInstallmentDuePaise)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Quick-fill:</span>
              {nextInstallmentDuePaise > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    const fillPaise = totalOutstandingPaise > 0 ? Math.min(nextInstallmentDuePaise, totalOutstandingPaise) : nextInstallmentDuePaise
                    handleAmountChange(String(fillPaise / 100))
                    if (nextInstallmentRow?.installmentNumber) setInstallmentNumber(nextInstallmentRow.installmentNumber)
                  }}
                >
                  Next Installment ({formatPaiseToINR(totalOutstandingPaise > 0 ? Math.min(nextInstallmentDuePaise, totalOutstandingPaise) : nextInstallmentDuePaise)})
                </Button>
              )}
              {totalOutstandingPaise > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    handleAmountChange(String(totalOutstandingPaise / 100))
                    setInstallmentNumber(null)
                  }}
                >
                  Full Outstanding ({formatPaiseToINR(totalOutstandingPaise)})
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount Collected (₹)</Label>
                <Input
                  type="number"
                  min="1"
                  max={totalOutstandingPaise > 0 ? totalOutstandingPaise / 100 : undefined}
                  step="any"
                  value={amountRupees}
                  onChange={(e) => handleAmountChange(e.target.value)}
                />
                {amountRupees && !isAmountValid && totalOutstandingPaise > 0 && (
                  <p className="text-[11px] text-destructive">
                    Must be between ₹1 and {formatPaiseToINR(totalOutstandingPaise)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Collection Date</Label>
                <Input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Collected cash during follow-up visit" />
            </div>

            <div className="space-y-1.5">
              <Label>Receipt Photo Upload (optional · JPEG/PNG/WEBP ≤ 5 MB)</Label>
              <label className="block rounded-xl border-2 border-dashed border-border hover:border-primary/40 p-3 text-center text-xs text-muted-foreground cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handlePhotoUpload}
                />
                <Upload className="h-5 w-5 mx-auto mb-1 opacity-60" />
                {proofFileName ? (
                  <span className="font-medium text-foreground">{proofFileName}</span>
                ) : (
                  'Tap to upload receipt photo (JPEG, PNG, WEBP up to 5 MB)'
                )}
              </label>
            </div>

            <div className="rounded-lg bg-info/10 border border-info/20 p-2.5 text-[11px] text-info flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              <span>Idempotency-protected · Schedule updates immediately &amp; issues a digital receipt.</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => collectMutation.mutate()}
            disabled={collectMutation.isPending || isLoading || !isAmountValid || !collectionDate}
          >
            <Banknote className="h-4 w-4" />
            {collectMutation.isPending ? 'Recording…' : 'Confirm Cash Collection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data: candidatesData } = useQuery({
    queryKey: ['agent-candidates-for-task'],
    queryFn: () => api.get<{ items: CandidateRow[] }>('/api/agent/candidates?pageSize=100'),
  })
  const candidates = candidatesData?.items ?? []

  const [candidateId, setCandidateId] = React.useState('')
  const [loanId, setLoanId] = React.useState('')
  const [loadingLoan, setLoadingLoan] = React.useState(false)
  const activeFetchCandidateRef = React.useRef<string>('')
  const [title, setTitle] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [dueDate, setDueDate] = React.useState('')
  const [priority, setPriority] = React.useState('MEDIUM')

  const onCandidateChange = (v: string) => {
    setCandidateId(v)
    setLoanId('')
    activeFetchCandidateRef.current = v
    if (v) {
      setLoadingLoan(true)
      api.get<{ loans?: Array<{ id: string; status: string }> }>(`/api/agent/candidates/${v}`)
        .then((res) => {
          if (activeFetchCandidateRef.current !== v) return
          const loan = res.loans?.find((l) => l.status === 'ACTIVE') ?? res.loans?.[0]
          if (loan) setLoanId(loan.id)
        })
        .catch(() => {})
        .finally(() => {
          if (activeFetchCandidateRef.current === v) setLoadingLoan(false)
        })
    } else {
      setLoadingLoan(false)
    }
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const cand = candidates.find((c) => c.id === candidateId)
      if (!cand) throw new Error('Select a candidate')
      if (!loanId) throw new Error('Selected candidate does not have an active loan')
      const cleanedAmount = amount.replace(/,/g, '').trim()
      const amountPaise = cleanedAmount && !isNaN(Number(cleanedAmount)) && Number(cleanedAmount) > 0
        ? String(Math.round(Number(cleanedAmount) * 100))
        : null
      return api.post('/api/agent/tasks', {
        candidateId,
        loanId,
        title: title.trim() || 'Installment follow-up call',
        amount: amountPaise,
        dueDate: new Date(dueDate).toISOString(),
        priority,
      })
    },
    onSuccess: () => {
      toast.success('Task created', {
        description: `New ${priority} task for ${candidates.find((c) => c.id === candidateId)?.fullName ?? ''} due ${dueDate || '—'}.`,
      })
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['agent-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['agent-dashboard-badges'] })
      setCandidateId(''); setLoanId(''); setLoadingLoan(false); setTitle(''); setAmount(''); setDueDate(''); setPriority('MEDIUM')
      activeFetchCandidateRef.current = ''
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error('Failed to create task', { description: e.message }),
  })

  const submit = () => {
    if (!candidateId || !dueDate) { toast.error('Candidate and due date are required'); return }
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) activeFetchCandidateRef.current = ''; onOpenChange(isOpen) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Collection Task</DialogTitle>
          <DialogDescription>Create a follow-up task assigned to yourself.</DialogDescription>
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
            <Label>Task Title</Label>
            <Input placeholder="e.g. Installment reminder call" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input placeholder="e.g. 7,425" value={amount} onChange={(e) => setAmount(e.target.value)} type="text" inputMode="decimal" />
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
          <Button onClick={submit} disabled={createMutation.isPending || loadingLoan || (Boolean(candidateId) && !loanId)}>
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
