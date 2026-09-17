'use client'

import * as React from 'react'
import {
  MessageCircle, Send, Radio, Clock, CheckCircle2, FileText,
  AlertTriangle, BellRing, Calendar, ChevronRight,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { agentCandidates } from '@/lib/mock-data'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES, type WhatsAppContext } from '@/lib/whatsapp'
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

const recentActivity = [
  { id: 'wa1', candidate: 'Karthik Iyer', template: 'PAYMENT_REMINDER', ts: '12 minutes ago', status: 'DELIVERED' },
  { id: 'wa2', candidate: 'Sahil Khan', template: 'OVERDUE', ts: '1 hour ago', status: 'DELIVERED' },
  { id: 'wa3', candidate: 'Suresh Patel', template: 'PTP_REMINDER', ts: '3 hours ago', status: 'READ' },
  { id: 'wa4', candidate: 'Rahul Verma', template: 'DUE_TODAY', ts: '5 hours ago', status: 'DELIVERED' },
  { id: 'wa5', candidate: 'Meena Desai', template: 'PAYMENT_REMINDER', ts: 'Yesterday', status: 'READ' },
  { id: 'wa6', candidate: 'Imran Khan', template: 'GENERAL_FOLLOW_UP', ts: 'Yesterday', status: 'FAILED' },
]

const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

export default function AgentWhatsAppPage() {
  const [useTemplate, setUseTemplate] = React.useState<TemplateKey | null>(null)
  const [broadcastOpen, setBroadcastOpen] = React.useState(false)

  const onUse = (key: TemplateKey) => setUseTemplate(key)

  const onBroadcast = () => {
    setBroadcastOpen(false)
    toast.success('Broadcast queued', { description: 'WhatsApp broadcast added to queue.' })
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="WhatsApp Templates"
        description="Pre-approved messaging templates with auto-fill placeholders."
        icon={<MessageCircle className="h-5 w-5" />}
        action={
          <Button onClick={() => setBroadcastOpen(true)} size="sm">
            <Radio className="h-4 w-4" /> Broadcast
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
                <p className="text-xs text-muted-foreground mt-3 line-clamp-3 bg-muted/30 rounded-lg p-2.5">
                  {WHATSAPP_TEMPLATES[t.key].replace(/\{candidateName\}/g, 'Rahul').replace(/\{loanNumber\}/g, 'LON-2024-0892').replace(/\{amount\}/g, '7,425').replace(/\{dueDate\}/g, '20 Sep 2024').replace(/\{orgName\}/g, 'Sterling Lending').replace(/\{agentName\}/g, 'Arjun Nair')}
                </p>
                <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => onUse(t.key)}>
                  <Send className="h-3.5 w-3.5" /> Use Template
                </Button>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* Recent activity */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Recent WhatsApp Activity</CardTitle>
            <CardDescription className="text-xs">{recentActivity.length} recent sends</CardDescription>
          </CardHeader>
          <CardContent>
            <StaggerContainer className="space-y-2.5">
              {recentActivity.map((a) => {
                const cand = agentCandidates.find((c) => c.name === a.candidate)
                return (
                  <StaggerItem key={a.id}>
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:shadow-premium transition-all">
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarFallback className="bg-info/10 text-info text-xs font-semibold">
                          {initials(a.candidate)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{a.candidate}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {a.template.replace(/_/g, ' ')} · {a.ts}
                        </p>
                      </div>
                      <StatusBadge variant={
                        a.status === 'DELIVERED' ? 'VERIFIED' :
                        a.status === 'READ' ? 'ALLOCATED' :
                        a.status === 'FAILED' ? 'REJECTED' : 'PASSIVE'
                      }>
                        {a.status === 'DELIVERED' && 'Delivered'}
                        {a.status === 'READ' && 'Read'}
                        {a.status === 'FAILED' && 'Failed'}
                      </StatusBadge>
                    </div>
                  </StaggerItem>
                )
              })}
            </StaggerContainer>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Use Template Dialog */}
      <UseTemplateDialog template={useTemplate} onClose={() => setUseTemplate(null)} />

      {/* Broadcast Dialog */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Broadcast WhatsApp</DialogTitle>
            <DialogDescription>Send the same template to multiple candidates at once.</DialogDescription>
          </DialogHeader>
          <BroadcastForm onSubmit={onBroadcast} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UseTemplateDialog({ template, onClose }: { template: TemplateKey | null; onClose: () => void }) {
  const [selected, setSelected] = React.useState('')

  React.useEffect(() => {
    if (template) setSelected('')
  }, [template])

  if (!template) return null

  const submit = () => {
    const cand = agentCandidates.find((c) => c.name === selected)
    if (!cand) {
      toast.error('Please pick a candidate')
      return
    }
    const ctx: WhatsAppContext = {
      candidateName: cand.name,
      loanNumber: cand.loanNumber,
      amount: (cand.outstanding / 100).toLocaleString('en-IN'),
      dueDate: cand.nextPayment,
      agentName: 'Arjun Nair',
    }
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES[template], ctx)
    openWhatsApp(cand.mobile, msg)
    toast.success('WhatsApp draft opened', { description: `${template.replace(/_/g, ' ')} → ${cand.name}` })
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
          <div className="space-y-2 max-h-[260px] overflow-y-auto no-scrollbar">
            {agentCandidates.map((c) => (
              <label
                key={c.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all',
                  selected === c.name ? 'border-primary bg-primary/5 shadow-glow' : 'border-border hover:bg-muted/50'
                )}
              >
                <Checkbox checked={selected === c.name} onCheckedChange={() => setSelected(c.name)} />
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{initials(c.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.loanNumber} · {c.mobile}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}><Send className="h-4 w-4" /> Send WhatsApp</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BroadcastForm({ onSubmit }: { onSubmit: () => void }) {
  const [template, setTemplate] = React.useState<TemplateKey>('PAYMENT_REMINDER')
  const [selected, setSelected] = React.useState<string[]>([])

  const toggle = (name: string) => {
    setSelected((s) => s.includes(name) ? s.filter((n) => n !== name) : [...s, name])
  }

  const handleBroadcast = () => {
    if (selected.length === 0) {
      toast.error('Pick at least one candidate')
      return
    }
    // Simulate: open WhatsApp for first recipient (real broadcast is server-side)
    onSubmit()
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Template</Label>
        <select
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
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
            {agentCandidates.map((c) => (
              <label
                key={c.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer transition-all',
                  selected.includes(c.name) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                )}
              >
                <Checkbox checked={selected.includes(c.name)} onCheckedChange={() => toggle(c.name)} />
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{initials(c.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.loanNumber}</p>
                </div>
              </label>
            ))}
          </div>
        </ScrollArea>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setSelected([])}>Clear</Button>
        <Button onClick={handleBroadcast}><Radio className="h-4 w-4" /> Queue Broadcast</Button>
      </DialogFooter>
    </div>
  )
}
