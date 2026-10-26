'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  MessageCircle, Send, Radio, Clock, CheckCircle2, FileText,
  AlertTriangle, BellRing, Calendar,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES, type WhatsAppContext } from '@/lib/whatsapp'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

type TemplateKey = keyof typeof WHATSAPP_TEMPLATES

const TEMPLATES: { key: TemplateKey; label: string; description: string; icon: React.ReactNode; tint: string }[] = [
  { key: 'PAYMENT_REMINDER', label: 'Payment Reminder', description: 'Standard installment reminder', icon: <BellRing className="h-5 w-5" />, tint: 'bg-info/15 text-info' },
  { key: 'DUE_TODAY', label: 'Due Today', description: 'Payment due today alert', icon: <Clock className="h-5 w-5" />, tint: 'bg-warning/15 text-warning' },
  { key: 'OVERDUE', label: 'Overdue', description: 'Overdue payment alert', icon: <AlertTriangle className="h-5 w-5" />, tint: 'bg-destructive/15 text-destructive' },
  { key: 'PTP_REMINDER', label: 'PTP Reminder', description: 'Promise to pay due tomorrow', icon: <Calendar className="h-5 w-5" />, tint: 'bg-success/15 text-success' },
  { key: 'DOCUMENT_REQUEST', label: 'Document Request', description: 'Request missing documents', icon: <FileText className="h-5 w-5" />, tint: 'bg-primary/15 text-primary' },
  { key: 'APPLICATION_REMINDER', label: 'Application Reminder', description: 'Pending application nudge', icon: <MessageCircle className="h-5 w-5" />, tint: 'bg-info/15 text-info' },
  { key: 'GENERAL_FOLLOW_UP', label: 'General Follow-up', description: 'Agent calling card', icon: <MessageCircle className="h-5 w-5" />, tint: 'bg-muted text-muted-foreground' },
]

const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

interface CandidateRow {
  id: string
  fullName: string
  mobile: string
  activeLoanNumbers: string[]
  outstanding: string
}

export default function AgentWhatsAppPage() {
  const { user } = useSession()
  const [useTemplate, setUseTemplate] = React.useState<TemplateKey | null>(null)
  const [broadcastOpen, setBroadcastOpen] = React.useState(false)

  return (
    <div className="space-y-6">
      <SectionHeading
        title="WhatsApp Templates"
        description="Pre-approved messaging templates with auto-fill placeholders."
        icon={<MessageCircle className="h-5 w-5" />}
        action={
          <Button onClick={() => setBroadcastOpen(true)} size="sm">
            <Radio className="h-4 w-4" /> Send to Many
          </Button>
        }
      />

      <FadeIn>
        <Card className="border-info/20 bg-info/5">
          <CardContent className="p-3.5">
            <p className="text-xs text-info inline-flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp messages open in wa.me with pre-filled body. Recipient must have WhatsApp installed.
            </p>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Template gallery */}
      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {TEMPLATES.map((t) => (
          <StaggerItem key={t.key}>
            <Card className="shadow-premium hover:border-primary/40 hover:shadow-glow transition-all h-full">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', t.tint)}>
                    {t.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                </div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-3">Example preview</p>
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3 bg-muted/30 rounded-lg p-2.5">
                  {WHATSAPP_TEMPLATES[t.key].replace(/\{candidateName\}/g, 'Rahul').replace(/\{loanNumber\}/g, 'LON-2024-0892').replace(/\{amount\}/g, '7,425').replace(/\{dueDate\}/g, '20 Sep 2024').replace(/\{orgName\}/g, 'Sterling Lending').replace(/\{agentName\}/g, user?.name ?? 'Agent')}
                </p>
                <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setUseTemplate(t.key)}>
                  <Send className="h-3.5 w-3.5" /> Use Template
                </Button>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>

      <UseTemplateDialog template={useTemplate} onClose={() => setUseTemplate(null)} />

      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send to Multiple Borrowers</DialogTitle>
            <DialogDescription>WhatsApp does not allow automated bulk sending here. Pick borrowers and a template, then send one by one — each tap opens WhatsApp with the message ready, and you press send there.</DialogDescription>
          </DialogHeader>
          <BroadcastForm />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UseTemplateDialog({ template, onClose }: { template: TemplateKey | null; onClose: () => void }) {
  const { user } = useSession()
  const [selected, setSelected] = React.useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['agent-candidates-for-whatsapp'],
    queryFn: () => api.get<{ items: CandidateRow[] }>('/api/agent/candidates?pageSize=100'),
    enabled: !!template,
  })
  const candidates = data?.items ?? []

  const [prevTemplate, setPrevTemplate] = React.useState(template)
  if (template !== prevTemplate) {
    setPrevTemplate(template)
    setSelected('')
  }

  if (!template) return null

  const submit = () => {
    const cand = candidates.find((c) => c.id === selected)
    if (!cand) {
      toast.error('Please pick a candidate')
      return
    }
    const ctx: WhatsAppContext = {
      candidateName: cand.fullName,
      loanNumber: cand.activeLoanNumbers[0] ?? '',
      amount: (Number(cand.outstanding) / 100).toLocaleString('en-IN'),
      dueDate: 'soon',
      agentName: user?.name ?? 'Agent',
    }
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES[template], ctx)
    openWhatsApp(cand.mobile, msg)
    toast.success('WhatsApp draft opened', { description: `${template.replace(/_/g, ' ')} → ${cand.fullName}` })
    onClose()
  }

  return (
    <Dialog open={!!template} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Use {template.replace(/_/g, ' ')}</DialogTitle>
          <DialogDescription>Pick a candidate — placeholders will auto-fill.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : candidates.length === 0 ? (
            <EmptyState icon={<MessageCircle className="h-6 w-6" />} title="No candidates available" />
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto no-scrollbar">
              {candidates.map((c) => (
                <label
                  key={c.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all',
                    selected === c.id ? 'border-primary bg-primary/5 shadow-glow' : 'border-border hover:bg-muted/50'
                  )}
                >
                  <Checkbox checked={selected === c.id} onCheckedChange={() => setSelected(c.id)} />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{initials(c.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.fullName}</p>
                    <p className="text-[11px] text-muted-foreground">{c.activeLoanNumbers[0] ?? '—'} · {c.mobile}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}><Send className="h-4 w-4" /> Send WhatsApp</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BroadcastForm() {
  const { user } = useSession()
  const [template, setTemplate] = React.useState<TemplateKey>('PAYMENT_REMINDER')
  const [selected, setSelected] = React.useState<string[]>([])
  // Step-through sending state: the queue is worked through manually, one
  // wa.me open at a time. Nothing is queued or sent on any server.
  const [queue, setQueue] = React.useState<CandidateRow[] | null>(null)
  const [currentIdx, setCurrentIdx] = React.useState(0)
  const [openedIds, setOpenedIds] = React.useState<string[]>([])
  const [skippedIds, setSkippedIds] = React.useState<string[]>([])

  const { data } = useQuery({
    queryKey: ['agent-candidates-for-broadcast'],
    queryFn: () => api.get<{ items: CandidateRow[] }>('/api/agent/candidates?pageSize=100'),
  })
  const candidates = data?.items ?? []

  const toggle = (id: string) => {
    setSelected((s) => s.includes(id) ? s.filter((n) => n !== id) : [...s, id])
  }

  const startSending = () => {
    const picked = candidates.filter((c) => selected.includes(c.id))
    if (picked.length === 0) {
      toast.error('Pick at least one candidate')
      return
    }
    setQueue(picked)
    setCurrentIdx(0)
    setOpenedIds([])
    setSkippedIds([])
  }

  const current = queue?.[currentIdx] ?? null
  const finished = queue !== null && currentIdx >= queue.length

  const sendToCurrent = () => {
    if (!current) return
    const ctx: WhatsAppContext = {
      candidateName: current.fullName,
      loanNumber: current.activeLoanNumbers[0] ?? '',
      amount: (Number(current.outstanding) / 100).toLocaleString('en-IN'),
      dueDate: 'soon',
      agentName: user?.name ?? 'Agent',
    }
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES[template], ctx)
    openWhatsApp(current.mobile, msg)
    setOpenedIds((ids) => [...ids, current.id])
    setCurrentIdx((i) => i + 1)
  }

  const skipCurrent = () => {
    if (!current) return
    setSkippedIds((ids) => [...ids, current.id])
    setCurrentIdx((i) => i + 1)
  }

  const reset = () => {
    setQueue(null)
    setCurrentIdx(0)
    setOpenedIds([])
    setSkippedIds([])
    setSelected([])
  }

  if (queue !== null) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/30 p-3.5">
          <p className="text-sm font-medium">
            {finished
              ? `Done — you opened WhatsApp for ${openedIds.length} of ${queue.length} selected borrower(s)${skippedIds.length ? `, skipped ${skippedIds.length}` : ''}.`
              : `Sending ${template.replace(/_/g, ' ')} — ${openedIds.length + skippedIds.length} of ${queue.length} done`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Each message opens in WhatsApp with the text pre-filled; you still press Send inside WhatsApp. Nothing is sent automatically.
          </p>
        </div>
        {!finished && current && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials(current.fullName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">Next: {current.fullName}</p>
                <p className="text-[11px] text-muted-foreground">{current.activeLoanNumbers[0] ?? '—'} · {current.mobile}</p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{currentIdx + 1} / {queue.length}</span>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={sendToCurrent}>
                <Send className="h-4 w-4" /> Send to {current.fullName.split(' ')[0]}
              </Button>
              <Button variant="outline" onClick={skipCurrent}>Skip</Button>
            </div>
          </div>
        )}
        {queue.length > 0 && (
          <div className="space-y-1.5">
            {queue.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                {openedIds.includes(c.id) ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                ) : skippedIds.includes(c.id) ? (
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border inline-block" />
                )}
                <span className={cn(i === currentIdx && !finished && 'font-semibold')}>
                  {c.fullName} — {openedIds.includes(c.id) ? 'opened in WhatsApp' : skippedIds.includes(c.id) ? 'skipped' : i === currentIdx && !finished ? 'up next' : 'waiting'}
                </span>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={reset}>{finished ? 'Start a new list' : 'Cancel and start over'}</Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="broadcast-template">Template</Label>
        <select
          id="broadcast-template"
          aria-label="Select WhatsApp template"
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-base md:text-sm"
          value={template}
          onChange={(e) => setTemplate(e.target.value as TemplateKey)}
        >
          {TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Candidates ({selected.length} selected)</Label>
        <ScrollArea className="h-[220px] rounded-xl border border-border p-2">
          <div className="space-y-1.5 pr-2">
            {candidates.map((c) => (
              <label
                key={c.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer transition-all',
                  selected.includes(c.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                )}
              >
                <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{initials(c.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">{c.activeLoanNumbers[0] ?? '—'}</p>
                </div>
              </label>
            ))}
          </div>
        </ScrollArea>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setSelected([])}>Clear</Button>
        <Button onClick={startSending}><Send className="h-4 w-4" /> Start Sending One-by-One</Button>
      </DialogFooter>
    </div>
  )
}
