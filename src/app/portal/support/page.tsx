'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LifeBuoy, MessageCircle, Plus, Paperclip, Send, Clock,
  HelpCircle, UserCog, ShieldCheck,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { useSession } from '@/lib/session'

const AGENT_PHONE = '+91 98201 44556'
const OWNER_PHONE = '+91 98200 11223'

const CATEGORIES = ['Repayment', 'Receipt', 'KYC', 'Agreement', 'Disbursement', 'Other']

const FAQS = [
  {
    q: 'How do I pay my next installment?',
    a: 'Head to the Payments page, tap "Pay Now", choose your preferred method (UPI, Netbanking, or Card) and complete the transaction. You\'ll get a confirmation in seconds and a receipt within minutes.',
  },
  {
    q: 'Can I extend my due date?',
    a: 'Yes — you can request an extension by raising a support ticket with the "Repayment" category. Your agent will review and respond within 4 hours. Extensions are granted case-by-case.',
  },
  {
    q: 'How do I download a payment receipt?',
    a: 'Visit the Receipts page, find the payment you want, and tap the Download icon. You can also email the receipt to your registered email address.',
  },
  {
    q: 'Is my data safe?',
    a: 'Absolutely. Sterling Lending is RBI-compliant, ISO 27001 certified, and uses 256-bit bank-grade encryption. Your KYC documents and bank details are never shared with third parties.',
  },
  {
    q: 'How is interest calculated?',
    a: 'Interest is charged using the flat method — the rate is applied on the principal for the full tenure, then divided equally across all installments. You can view the full breakdown on your Loan page.',
  },
  {
    q: 'What happens if I miss a payment?',
    a: 'A reminder is sent on the due date. If unpaid within 3 days, late charges may apply as per your agreement. Reach out to your agent via WhatsApp to discuss a payment plan.',
  },
]

interface Ticket {
  id: string
  ticketNumber: string
  category: string
  subject: string
  description?: string
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'
  resolution?: string | null
  createdAt: string
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

export default function SupportPage() {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const candidateName = user?.name || 'Candidate'
  const [newOpen, setNewOpen] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['candidate-support'],
    queryFn: () => api.get<{ items: Ticket[] }>('/api/candidate/support'),
  })
  const tickets = data?.items ?? []

  const onWhatsAppAgent = () => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.CANDIDATE_TO_AGENT, {
      candidateName,
      loanNumber: '',
    })
    openWhatsApp(AGENT_PHONE, msg)
    toast.success('WhatsApp draft opened', { description: 'Your agent Arjun will respond shortly.' })
  }
  const onWhatsAppOwner = () => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.CANDIDATE_TO_OWNER, {
      candidateName,
      loanNumber: '',
    })
    openWhatsApp(OWNER_PHONE, msg)
    toast.success('WhatsApp draft opened', { description: 'Owner notified.' })
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Support"
        description="We're here for you — reach us via WhatsApp, raise a ticket, or browse FAQs."
        icon={<LifeBuoy className="h-5 w-5" />}
        action={
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New Request
          </Button>
        }
      />

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <StaggerItem>
          <Card className="shadow-premium border-info/15 bg-info/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-info/15 text-info flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">WhatsApp Your Agent</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Arjun Nair · {AGENT_PHONE}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Fastest response · avg 5 min</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-info border-info/40 hover:bg-info/10"
                  onClick={onWhatsAppAgent}
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
                <div className="h-12 w-12 rounded-xl bg-success/15 text-success flex items-center justify-center flex-shrink-0">
                  <UserCog className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">WhatsApp the Owner</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ravi Mehta · {OWNER_PHONE}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">For escalations only</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-success border-success/40 hover:bg-success/10"
                  onClick={onWhatsAppOwner}
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Message
                </Button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">My Support Requests</CardTitle>
                  <CardDescription className="text-xs">{tickets.length} tickets · {tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_REVIEW').length} active</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setNewOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : tickets.length === 0 ? (
              <EmptyState icon={<LifeBuoy className="h-6 w-6" />} title="No support requests" description="Raise a ticket and our team will respond within 4 hours." />
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
                            <Clock className="h-3 w-3" /> {fmtTimestamp(t.createdAt)}
                          </p>
                        </div>
                        <StatusBadge variant={t.status}>{formatStatus(t.status)}</StatusBadge>
                      </div>
                      {t.resolution && (
                        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                          <span className="font-semibold text-foreground">Resolution: </span>{t.resolution}
                        </p>
                      )}
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-info/15 text-info flex items-center justify-center">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Frequently Asked Questions</CardTitle>
                <CardDescription className="text-xs">Quick answers to common queries</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible>
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <div className="rounded-xl bg-success/5 border border-success/15 p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-success">Our promise</p>
            <p className="text-xs text-muted-foreground mt-1">Every support ticket gets a response within 4 hours. Every WhatsApp message gets a reply within 15 minutes during business hours (9 AM - 8 PM IST).</p>
          </div>
        </div>
      </FadeIn>

      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} onCreated={() => {
        queryClient.invalidateQueries({ queryKey: ['candidate-support'] })
      }} />
    </div>
  )
}

function NewTicketDialog({ open, onOpenChange, onCreated }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [category, setCategory] = React.useState('Repayment')
  const [subject, setSubject] = React.useState('')
  const [description, setDescription] = React.useState('')

  const mutation = useMutation({
    mutationFn: () => api.post<{ id: string; ticketNumber: string }>('/api/candidate/support', {
      category,
      subject,
      description,
    }),
    onSuccess: (res) => {
      toast.success('Support request created', { description: `${res.ticketNumber} · ${category}` })
      onCreated()
      setCategory('Repayment'); setSubject(''); setDescription('')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error('Failed to create ticket', { description: e.message }),
  })

  const submit = () => {
    if (!subject.trim()) { toast.error('Add a subject first'); return }
    if (!description.trim()) { toast.error('Add a description so we can help you better'); return }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Support Request</DialogTitle>
          <DialogDescription>Tell us what you need — we'll get back within 4 hours.</DialogDescription>
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
            <Textarea placeholder="Describe your issue in detail..." value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[110px]" />
          </div>
          <div className="space-y-1.5">
            <Label>Attachment (optional)</Label>
            <div className="rounded-xl border-2 border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              <Paperclip className="h-5 w-5 mx-auto mb-1.5 opacity-50" />
              Tap to add screenshot (PNG/JPG, max 5 MB)
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}><Send className="h-4 w-4" /> Submit Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
