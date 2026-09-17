'use client'

import * as React from 'react'
import {
  LifeBuoy, Phone, MessageCircle, Plus, CheckCircle2, Clock,
  Paperclip, Send, UserCog,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Ticket {
  id: string
  ticketNumber: string
  category: string
  subject: string
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'
  createdAt: string
  resolution?: string
}

const sampleTickets: Ticket[] = [
  { id: 'st1', ticketNumber: 'SUP-2024-128', category: 'Repayment', subject: 'Need extension for 20 Sep payment for Karthik Iyer', status: 'OPEN', createdAt: '2 hours ago' },
  { id: 'st2', ticketNumber: 'SUP-2024-119', category: 'Cash Verification', subject: 'Cash record cc3 not auto-verifying', status: 'IN_REVIEW', createdAt: '1 day ago' },
  { id: 'st3', ticketNumber: 'SUP-2024-112', category: 'App Bug', subject: 'WhatsApp template previews not rendering on Android', status: 'RESOLVED', createdAt: '3 days ago', resolution: 'Bug fixed in v3.2.1 — clear cache and retry.' },
  { id: 'st4', ticketNumber: 'SUP-2024-105', category: 'Reassignment', subject: 'Reassign Sahil Khan account to senior agent', status: 'CLOSED', createdAt: '1 week ago', resolution: 'Account reassigned to Sneha Kapoor.' },
]

const CATEGORIES = [
  'App Bug', 'Repayment', 'Cash Verification', 'Reassignment', 'PTP', 'Other',
]

export default function AgentSupportPage() {
  const [tickets, setTickets] = React.useState<Ticket[]>(sampleTickets)
  const [newOpen, setNewOpen] = React.useState(false)

  const onResolve = (id: string) => toast.info('Marked resolved', { description: `Ticket ${id} resolved.` })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Support"
        description="Raise a ticket, reach your owner or senior agent."
        icon={<LifeBuoy className="h-5 w-5" />}
        action={
          <Button onClick={() => setNewOpen(true)} size="sm">
            <Plus className="h-4 w-4" /> New Ticket
          </Button>
        }
      />

      {/* Contact options */}
      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <StaggerItem>
          <Card className="shadow-premium border-info/15 bg-info/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-info/15 text-info flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">WhatsApp the Owner</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ravi Mehta · +91 98200 11223</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-info border-info/40 hover:bg-info/10"
                  onClick={() => toast.success('WhatsApp draft opened', { description: 'Owner Ravi Mehta notified.' })}
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Message
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="shadow-premium border-success/15 bg-success/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-success/15 text-success flex items-center justify-center flex-shrink-0">
                  <UserCog className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Call Senior Agent</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sneha Kapoor · +91 98204 55662</p>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="text-success border-success/40 hover:bg-success/10"
                >
                  <a href="tel:+919820455662"><Phone className="h-3.5 w-3.5" /> Call</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      {/* My tickets */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><LifeBuoy className="h-4 w-4" /> My Support Tickets</CardTitle>
            <CardDescription className="text-xs">{tickets.length} tickets · {tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_REVIEW').length} active</CardDescription>
          </CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <EmptyState icon={<LifeBuoy className="h-6 w-6" />} title="No tickets yet" />
            ) : (
              <StaggerContainer className="space-y-3">
                {tickets.map((t) => (
                  <StaggerItem key={t.id}>
                    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-premium transition-all">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-mono text-xs text-primary font-semibold">{t.ticketNumber}</p>
                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium">{t.category}</span>
                          </div>
                          <p className="text-sm font-medium mt-1.5">{t.subject}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {t.createdAt}
                          </p>
                        </div>
                        <StatusBadge variant={t.status}>{formatStatus(t.status)}</StatusBadge>
                      </div>
                      {t.resolution && (
                        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                          <span className="font-semibold text-foreground">Resolution: </span>{t.resolution}
                        </p>
                      )}
                      {(t.status === 'OPEN' || t.status === 'IN_REVIEW') && (
                        <Button size="sm" variant="outline" className="h-8 mt-3" onClick={() => onResolve(t.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark Resolved
                        </Button>
                      )}
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <NewTicketDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onSubmit={(ticket) => {
          setTickets([ticket, ...tickets])
        }}
      />
    </div>
  )
}

function NewTicketDialog({ open, onOpenChange, onSubmit }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (t: Ticket) => void
}) {
  const [category, setCategory] = React.useState('App Bug')
  const [subject, setSubject] = React.useState('')
  const [description, setDescription] = React.useState('')

  const submit = () => {
    if (!subject.trim()) {
      toast.error('Add a subject first')
      return
    }
    const t: Ticket = {
      id: `st${Math.random().toString(36).slice(2, 8)}`,
      ticketNumber: `SUP-2024-${Math.floor(120 + Math.random() * 80)}`,
      category,
      subject: subject.trim(),
      status: 'OPEN',
      createdAt: 'Just now',
    }
    onSubmit(t)
    toast.success('Ticket raised', { description: `${t.ticketNumber} · ${category}` })
    setCategory('App Bug'); setSubject(''); setDescription('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise Support Ticket</DialogTitle>
          <DialogDescription>Our team typically responds within 4 hours.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input placeholder="Brief one-line summary" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea placeholder="Describe the issue in detail..." value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[100px]" />
          </div>
          <div className="space-y-1.5">
            <Label>Attachment (placeholder)</Label>
            <div className="rounded-xl border-2 border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              <Paperclip className="h-5 w-5 mx-auto mb-1.5 opacity-50" />
              Tap to add screenshot (PNG/JPG)
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}><Send className="h-4 w-4" /> Submit Ticket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


