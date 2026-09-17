'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Plus, Filter, X, ChevronRight, MessageCircle,
  CheckCircle2, Eye, Clock, ShieldAlert,
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

type ChipKey = 'ALL' | 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_REVIEW', label: 'In Review' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
]

const reasonLabel: Record<string, string> = {
  REPEATED_MISSED_PAYMENT: 'Repeated Missed Payment',
  BROKEN_PTP: 'Broken PTP',
  LONG_OVERDUE: 'Long Overdue',
  FAILED_CONTACT: 'Failed Contact',
  HIGH_OUTSTANDING: 'High Outstanding',
  OTHER: 'Other',
}

const reasonVariant: Record<string, string> = {
  REPEATED_MISSED_PAYMENT: 'AI_HIGH',
  BROKEN_PTP: 'AI_HIGH',
  LONG_OVERDUE: 'AI_HIGH',
  FAILED_CONTACT: 'AI_MEDIUM',
  HIGH_OUTSTANDING: 'AI_MEDIUM',
  OTHER: 'AI_LOW',
}

interface EscalationRow {
  id: string
  reason: string
  description?: string | null
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'
  resolvedAt?: string | null
  resolutionNotes?: string | null
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

function fmtTimestamp(d: string) {
  const date = new Date(d)
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function AgentEscalationsPage() {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [newOpen, setNewOpen] = React.useState(false)
  const [resolveTarget, setResolveTarget] = React.useState<EscalationRow | null>(null)
  const [resolution, setResolution] = React.useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['agent-escalations', chip],
    queryFn: () => api.get<{ items: EscalationRow[]; total: number }>(
      `/api/agent/escalations?pageSize=100${chip !== 'ALL' ? `&status=${chip}` : ''}`
    ),
  })

  const allEsc = data?.items ?? []

  const openCount = allEsc.filter((e) => e.status === 'OPEN').length
  const inReviewCount = allEsc.filter((e) => e.status === 'IN_REVIEW').length
  const resolvedCount = allEsc.filter((e) => e.status === 'RESOLVED').length
  const closedCount = allEsc.filter((e) => e.status === 'CLOSED').length

  const updateMutation = useMutation({
    mutationFn: ({ id, status, resolutionNotes }: { id: string; status: string; resolutionNotes?: string }) =>
      api.patch(`/api/agent/escalations/${id}`, { status, resolutionNotes: resolutionNotes ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-escalations'] })
      queryClient.invalidateQueries({ queryKey: ['agent-dashboard'] })
    },
    onError: (e: Error) => toast.error('Failed to update', { description: e.message }),
  })

  const onInReview = (id: string) => {
    updateMutation.mutate({ id, status: 'IN_REVIEW' })
    toast.info('Marked IN_REVIEW')
  }
  const onResolve = () => {
    if (!resolveTarget) return
    updateMutation.mutate(
      { id: resolveTarget.id, status: 'RESOLVED', resolutionNotes: resolution },
      {
        onSuccess: () => {
          toast.success('Escalation resolved')
          setResolveTarget(null); setResolution('')
        },
      }
    )
  }
  const onClose = (id: string) => {
    updateMutation.mutate({ id, status: 'CLOSED' })
    toast.success('Escalation closed')
  }
  const onWhatsApp = (e: EscalationRow) => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.GENERAL_FOLLOW_UP, {
      candidateName: e.candidate.fullName,
      loanNumber: e.loan.loanNumber,
      agentName: user?.name ?? 'Agent',
    })
    openWhatsApp(e.candidate.mobile, msg)
    toast.success('WhatsApp sent')
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Escalations"
        description="Flag candidates for senior attention; track resolution."
        icon={<AlertTriangle className="h-5 w-5" />}
        action={
          <Button onClick={() => setNewOpen(true)} size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10" variant="outline">
            <Plus className="h-4 w-4" /> Escalate Candidate
          </Button>
        }
      />

      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem><KPICard label="Open" value={String(openCount)} icon={<AlertTriangle className="h-5 w-5" />} variant="destructive" spark={[1, 2, 2, 2, 3, 3, 3]} /></StaggerItem>
        <StaggerItem><KPICard label="In Review" value={String(inReviewCount)} icon={<Eye className="h-5 w-5" />} variant="warning" spark={[1, 1, 1, 1, 1, 1, 1]} /></StaggerItem>
        <StaggerItem><KPICard label="Resolved" value={String(resolvedCount)} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" spark={[0, 1, 1, 1, 1, 1, 1]} /></StaggerItem>
        <StaggerItem><KPICard label="Closed" value={String(closedCount)} icon={<ShieldAlert className="h-5 w-5" />} variant="default" spark={[0, 0, 0, 0, 0, 1, 1]} /></StaggerItem>
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
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : allEsc.length === 0 ? (
        <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="No escalations in this view" description="Escalate a candidate to see them here." />
      ) : (
        <StaggerContainer className="space-y-3">
          {allEsc.map((e) => (
            <StaggerItem key={e.id}>
              <Card className="shadow-premium hover:border-primary/40 hover:shadow-glow transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/agent/candidates/${e.candidate.id}`} className="text-sm font-semibold hover:text-primary">
                          {e.candidate.fullName}
                        </Link>
                        <span className="font-mono text-[11px] text-muted-foreground">{e.loan.loanNumber}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{e.description ?? '—'}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <StatusBadge variant={reasonVariant[e.reason] as any}>{reasonLabel[e.reason]}</StatusBadge>
                        <StatusBadge variant={e.status}>{formatStatus(e.status)}</StatusBadge>
                        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {fmtTimestamp(e.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-info border-info/40 hover:bg-info/10" onClick={() => onWhatsApp(e)}>
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                      {(e.status === 'OPEN' || e.status === 'IN_REVIEW') && (
                        <>
                          {e.status === 'OPEN' && (
                            <Button size="sm" variant="outline" className="h-8" disabled={updateMutation.isPending} onClick={() => onInReview(e.id)}>
                              <Eye className="h-3.5 w-3.5" /> In Review
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-8 text-success border-success/40 hover:bg-success/10" onClick={() => { setResolveTarget(e); setResolution(e.resolutionNotes ?? '') }}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                          </Button>
                        </>
                      )}
                      {e.status === 'RESOLVED' && (
                        <Button size="sm" variant="outline" className="h-8" disabled={updateMutation.isPending} onClick={() => onClose(e.id)}>
                          Close
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      <NewEscalationDialog open={newOpen} onOpenChange={setNewOpen} />

      <Dialog open={!!resolveTarget} onOpenChange={(v) => !v && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Escalation</DialogTitle>
            <DialogDescription>Record the resolution for {resolveTarget?.candidate.fullName ?? ''}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Resolution Notes</Label>
              <Textarea
                placeholder="e.g. Candidate paid 50% and committed to clear balance by month-end."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>Cancel</Button>
            <Button onClick={onResolve} disabled={updateMutation.isPending}>
              <CheckCircle2 className="h-4 w-4" /> Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NewEscalationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data: candidatesData } = useQuery({
    queryKey: ['agent-candidates-for-escalation'],
    queryFn: () => api.get<{ items: CandidateRow[] }>('/api/agent/candidates?pageSize=100'),
  })
  const candidates = candidatesData?.items ?? []

  const [candidateId, setCandidateId] = React.useState('')
  const [loanNumber, setLoanNumber] = React.useState('')
  const [loanId, setLoanId] = React.useState('')
  const [reason, setReason] = React.useState('LONG_OVERDUE')
  const [description, setDescription] = React.useState('')

  const createMutation = useMutation({
    mutationFn: () => {
      if (!loanId) throw new Error('Select a candidate with an active loan')
      return api.post('/api/agent/escalations', {
        candidateId,
        loanId,
        reason,
        description,
      })
    },
    onSuccess: () => {
      toast.success('Escalation created', { description: `${candidates.find((c) => c.id === candidateId)?.fullName ?? ''} · ${reasonLabel[reason]}` })
      queryClient.invalidateQueries({ queryKey: ['agent-escalations'] })
      queryClient.invalidateQueries({ queryKey: ['agent-dashboard'] })
      setCandidateId(''); setLoanId(''); setLoanNumber(''); setReason('LONG_OVERDUE'); setDescription('')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error('Failed to escalate', { description: e.message }),
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
    if (!candidateId || !description) { toast.error('Candidate and description are required'); return }
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escalate Candidate</DialogTitle>
          <DialogDescription>Flag a candidate for senior agent / owner attention.</DialogDescription>
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
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="REPEATED_MISSED_PAYMENT">Repeated Missed Payment</SelectItem>
                <SelectItem value="BROKEN_PTP">Broken PTP</SelectItem>
                <SelectItem value="LONG_OVERDUE">Long Overdue</SelectItem>
                <SelectItem value="FAILED_CONTACT">Failed Contact</SelectItem>
                <SelectItem value="HIGH_OUTSTANDING">High Outstanding</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea placeholder="e.g. 32 days overdue, no response for 5 days" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={createMutation.isPending}>Create Escalation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
