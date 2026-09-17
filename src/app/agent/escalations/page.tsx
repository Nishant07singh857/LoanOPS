'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle, Plus, Filter, X, ChevronRight, MessageCircle,
  CheckCircle2, Eye, Clock, ShieldAlert,
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
import { toast } from 'sonner'
import { escalations, agentCandidates, type EscalationRow } from '@/lib/mock-data'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
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

// Synthesize extra escalations
const extraEsc: EscalationRow[] = [
  { id: 'e4', candidateName: 'Sahil Khan', loanNumber: 'LON-2024-0712', reason: 'FAILED_CONTACT', description: 'No response on WhatsApp or call for 5 days', status: 'IN_REVIEW', createdAt: '6 hours ago' },
  { id: 'e5', candidateName: 'Karthik Iyer', loanNumber: 'LON-2024-0812', reason: 'HIGH_OUTSTANDING', description: 'Outstanding > ₹2,80,000 — risk threshold exceeded', status: 'RESOLVED', createdAt: '1 week ago' },
  { id: 'e6', candidateName: 'Suresh Patel', loanNumber: 'LON-2024-0698', reason: 'LONG_OVERDUE', description: 'Resolved after field visit & payment plan', status: 'CLOSED', createdAt: '2 weeks ago' },
]
const allEsc = [...escalations, ...extraEsc]

export default function AgentEscalationsPage() {
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [newOpen, setNewOpen] = React.useState(false)
  const [resolveOpen, setResolveOpen] = React.useState<string | null>(null)
  const [resolution, setResolution] = React.useState('')

  const filtered = React.useMemo(() => {
    if (chip === 'ALL') return allEsc
    return allEsc.filter((e) => e.status === chip)
  }, [chip])

  const openCount = allEsc.filter((e) => e.status === 'OPEN').length
  const inReviewCount = allEsc.filter((e) => e.status === 'IN_REVIEW').length
  const resolvedCount = allEsc.filter((e) => e.status === 'RESOLVED').length
  const closedCount = allEsc.filter((e) => e.status === 'CLOSED').length

  const onInReview = (id: string) => toast.info('Marked IN_REVIEW', { description: `Escalation ${id} is now under review.` })
  const onResolve = () => {
    if (!resolveOpen) return
    toast.success('Escalation resolved', { description: `Resolution recorded for ${resolveOpen}.` })
    setResolveOpen(null); setResolution('')
  }
  const onClose = (id: string) => toast.success('Escalation closed', { description: `${id} has been closed.` })
  const onWhatsApp = (e: typeof allEsc[number]) => {
    const cand = agentCandidates.find((c) => c.name === e.candidateName)
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.GENERAL_FOLLOW_UP, {
      candidateName: e.candidateName,
      loanNumber: e.loanNumber,
      agentName: 'Arjun Nair',
    })
    openWhatsApp(cand?.mobile || '', msg)
    toast.success('WhatsApp sent', { description: `Follow-up sent to ${e.candidateName}` })
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

      {filtered.length === 0 ? (
        <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="No escalations in this view" />
      ) : (
        <StaggerContainer className="space-y-3">
          {filtered.map((e) => {
            const cand = agentCandidates.find((c) => c.name === e.candidateName)
            return (
              <StaggerItem key={e.id}>
                <Card className="shadow-premium hover:border-primary/40 hover:shadow-glow transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/agent/candidates/${cand?.id || 'c1'}`} className="text-sm font-semibold hover:text-primary">
                            {e.candidateName}
                          </Link>
                          <span className="font-mono text-[11px] text-muted-foreground">{e.loanNumber}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{e.description}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <StatusBadge variant={reasonVariant[e.reason]}>{reasonLabel[e.reason]}</StatusBadge>
                          <StatusBadge variant={e.status}>{formatStatus(e.status)}</StatusBadge>
                          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {e.createdAt}
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
                              <Button size="sm" variant="outline" className="h-8" onClick={() => onInReview(e.id)}>
                                <Eye className="h-3.5 w-3.5" /> In Review
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-8 text-success border-success/40 hover:bg-success/10" onClick={() => setResolveOpen(e.id)}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                            </Button>
                          </>
                        )}
                        {e.status === 'RESOLVED' && (
                          <Button size="sm" variant="outline" className="h-8" onClick={() => onClose(e.id)}>
                            Close
                          </Button>
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

      <NewEscalationDialog open={newOpen} onOpenChange={setNewOpen} />

      {/* Resolve dialog */}
      <Dialog open={!!resolveOpen} onOpenChange={(v) => !v && setResolveOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Escalation</DialogTitle>
            <DialogDescription>Record the resolution for {resolveOpen}.</DialogDescription>
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
            <Button variant="outline" onClick={() => setResolveOpen(null)}>Cancel</Button>
            <Button onClick={onResolve}><CheckCircle2 className="h-4 w-4" /> Resolve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NewEscalationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [candidate, setCandidate] = React.useState('')
  const [loan, setLoan] = React.useState('')
  const [reason, setReason] = React.useState('LONG_OVERDUE')
  const [description, setDescription] = React.useState('')

  const selectedCand = agentCandidates.find((c) => c.name === candidate)

  const submit = () => {
    toast.success('Escalation created', { description: `${candidate || 'Candidate'} · ${reasonLabel[reason]}` })
    setCandidate(''); setLoan(''); setReason('LONG_OVERDUE'); setDescription('')
    onOpenChange(false)
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
            <Label>Loan</Label>
            <Input value={loan || (selectedCand?.loanNumber || '')} readOnly className="bg-muted/30 font-mono text-xs" />
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
          <Button variant="destructive" onClick={submit}>Create Escalation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
