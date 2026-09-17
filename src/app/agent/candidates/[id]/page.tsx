'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, User, Phone, Mail, MapPin, Building2, MessageCircle,
  Banknote, Handshake, AlertTriangle, Calendar, Clock, ClipboardList,
  ScrollText, FileText, ChevronRight, Send, Plus, CheckCircle2,
  StickyNote, History,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  agentCandidates, agentPtps, candidateInstallments, candidatePayments,
  candidateLoan, loans, escalations,
} from '@/lib/mock-data'
import { formatPaiseToINR, formatPaiseToINRShort, formatBpsToPercent } from '@/lib/money'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES, type WhatsAppContext } from '@/lib/whatsapp'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

const collectionHistory = [
  { date: '15 Sep 2024 · 4:00 PM', method: 'PHONE', outcome: 'PTP created', next: '22 Sep', note: 'Candidate promised to pay after shop revenue comes in' },
  { date: '10 Sep 2024 · 11:30 AM', method: 'FIELD_VISIT', outcome: 'No payment', next: '15 Sep', note: 'Met at shop; asked for extension' },
  { date: '02 Sep 2024 · 6:00 PM', method: 'WHATSAPP', outcome: 'Reminder sent', next: '10 Sep', note: 'No reply yet' },
  { date: '28 Aug 2024 · 5:00 PM', method: 'PHONE', outcome: 'No answer', next: '02 Sep', note: 'Will retry tomorrow' },
  { date: '20 Aug 2024 · 12:00 PM', method: 'IN_APP', outcome: 'Payment partial', next: '28 Aug', note: 'Paid ₹3,000 of ₹7,425' },
]

const sampleNotes = [
  { id: 'n1', ts: '2 hours ago', text: 'Spoke to candidate. Will pay after shop closes today.', tag: 'PTP' },
  { id: 'n2', ts: '1 day ago', text: 'Visited shop — shut. Asked neighbor, will return tomorrow.', tag: 'Field' },
  { id: 'n3', ts: '3 days ago', text: 'Wife said candidate out of town. Will return 20 Sep.', tag: 'Follow-up' },
]

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>()
  const { user } = useSession()
  const cand = agentCandidates.find((c) => c.id === params.id) || agentCandidates[0]
  // Find matching loan from loans (by loanNumber)
  const loan = loans.find((l) => l.loanNumber === cand.loanNumber) || loans[0]
  // Use shared candidateLoan detail for the schedule/payments, paired with this candidate's loan number
  const loanDetail = { ...candidateLoan, loanNumber: cand.loanNumber }
  const ptps = agentPtps.filter((p) => p.loanNumber === cand.loanNumber)
  const escs = escalations.filter((e) => e.loanNumber === cand.loanNumber)
  const [notes, setNotes] = React.useState(sampleNotes)
  const [newNote, setNewNote] = React.useState('')
  const [templateKey, setTemplateKey] = React.useState<keyof typeof WHATSAPP_TEMPLATES>('PAYMENT_REMINDER')
  const [ptpOpen, setPtpOpen] = React.useState(false)
  const [cashOpen, setCashOpen] = React.useState(false)
  const [escOpen, setEscOpen] = React.useState(false)

  const onWhatsApp = (template: keyof typeof WHATSAPP_TEMPLATES) => {
    const ctx: WhatsAppContext = {
      candidateName: cand.name,
      loanNumber: cand.loanNumber,
      amount: (cand.outstanding / 100).toLocaleString('en-IN'),
      dueDate: cand.nextPayment,
      agentName: user?.name || 'Arjun Nair',
    }
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES[template], ctx)
    openWhatsApp(cand.mobile, msg)
    toast.success('WhatsApp draft opened', { description: `${template.replace(/_/g, ' ')} → ${cand.name}` })
  }

  const onAddNote = () => {
    if (!newNote.trim()) return
    setNotes([{ id: `n${notes.length + 1}`, ts: 'Just now', text: newNote.trim(), tag: 'Note' }, ...notes])
    setNewNote('')
    toast.success('Note saved (private to you)')
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      {/* Back link */}
      <Link href="/agent/candidates" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to candidates
      </Link>

      {/* Header */}
      <FadeIn>
        <Card className="shadow-premium overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                  {initials(cand.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{cand.name}</h1>
                  {cand.daysOverdue > 0 ? (
                    <StatusBadge variant="OVERDUE">{cand.daysOverdue}d overdue</StatusBadge>
                  ) : (
                    <StatusBadge variant="ACTIVE">Current</StatusBadge>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs text-muted-foreground">
                  <p className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {cand.mobile}</p>
                  <p className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Mumbai South, Maharashtra</p>
                  <p className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Self-employed (Shop owner)</p>
                  <p className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {cand.name.toLowerCase().replace(' ', '.')}@email.com</p>
                </div>
              </div>
              <div className="flex sm:flex-col gap-2 sm:items-end">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</p>
                  <p className="text-lg font-bold tabular-nums">{formatPaiseToINR(cand.outstanding)}</p>
                </div>
                {cand.overdue > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Overdue</p>
                    <p className="text-sm font-semibold tabular-nums text-destructive">{formatPaiseToINR(cand.overdue)}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <TabsList className="w-auto inline-flex">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="loan">Loan</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="ptp">PTP</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="comm">Communication</TabsTrigger>
          </TabsList>
        </div>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-lg font-bold tabular-nums mt-1">{formatPaiseToINRShort(cand.outstanding)}</p></CardContent></Card>
            <Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Overdue</p><p className="text-lg font-bold tabular-nums mt-1 text-destructive">{formatPaiseToINRShort(cand.overdue)}</p></CardContent></Card>
            <Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Next Payment</p><p className="text-sm font-semibold mt-1 inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {cand.nextPayment}</p></CardContent></Card>
            <Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">PTP Status</p><p className="text-sm font-semibold mt-1">{cand.ptp || 'None'}</p></CardContent></Card>
          </div>
          <Card className="shadow-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Assigned Loan</CardTitle>
              <CardDescription className="text-xs">Primary loan for this candidate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Loan Number</p>
                  <p className="font-mono text-sm font-semibold text-primary">{cand.loanNumber}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Principal</p>
                  <p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(loan.principalAmount)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Frequency</p>
                  <p className="text-sm">{loan.frequency}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Installments</p>
                  <p className="text-sm">{loan.installments}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Installment Amt</p>
                  <p className="text-sm tabular-nums">{formatPaiseToINR(loan.installmentAmount)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next Due</p>
                  <p className="text-sm">{loan.nextDueDate || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loan */}
        <TabsContent value="loan" className="space-y-4">
          <Card className="shadow-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Loan Terms</CardTitle>
              <CardDescription className="text-xs">{loanDetail.loanNumber}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Principal</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(loanDetail.principalAmount)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Interest Type</p><p className="text-sm">{loanDetail.interestType}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Interest Rate</p><p className="text-sm">{loanDetail.interestType === 'PERCENTAGE' ? formatBpsToPercent(loanDetail.interestRate || 0) : loanDetail.interestType === 'FIXED' ? formatPaiseToINR(loanDetail.fixedInterest || 0) : 'None'}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Frequency</p><p className="text-sm">{loanDetail.frequency}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Installments</p><p className="text-sm">{loanDetail.installments}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Installment Amt</p><p className="text-sm tabular-nums">{formatPaiseToINR(loanDetail.installmentAmount)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Repayable</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(loanDetail.totalRepayable)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding Principal</p><p className="text-sm tabular-nums">{formatPaiseToINR(loanDetail.outstandingPrincipal)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding Interest</p><p className="text-sm tabular-nums">{formatPaiseToINR(loanDetail.outstandingInterest)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Collected</p><p className="text-sm tabular-nums">{formatPaiseToINR(loanDetail.totalCollected)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next Due</p><p className="text-sm">{loanDetail.nextDueDate}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Disbursed At</p><p className="text-sm">{loanDetail.disbursedAt}</p></div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <StatusBadge variant={loanDetail.status}>{formatStatus(loanDetail.status)}</StatusBadge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule */}
        <TabsContent value="schedule" className="space-y-4">
          <Card className="shadow-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Installment Schedule</CardTitle>
              <CardDescription className="text-xs">{candidateInstallments.length} installments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-6">#</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead className="text-right">Interest</TableHead>
                      <TableHead className="text-right">Fees</TableHead>
                      <TableHead className="text-right">Total Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidateInstallments.map((i) => (
                      <TableRow key={i.number}>
                        <TableCell className="pl-6 font-mono">{i.number}</TableCell>
                        <TableCell>{i.dueDate}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(i.principal)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(i.interest)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(i.fees)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{formatPaiseToINR(i.totalDue)}</TableCell>
                        <TableCell><StatusBadge variant={i.status}>{formatStatus(i.status)}</StatusBadge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{i.paidAt || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <StaggerContainer className="md:hidden space-y-3">
                {candidateInstallments.map((i) => (
                  <StaggerItem key={i.number}>
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">Installment #{i.number}</p>
                          <p className="text-xs text-muted-foreground">{i.dueDate}</p>
                        </div>
                        <StatusBadge variant={i.status}>{formatStatus(i.status)}</StatusBadge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border text-xs">
                        <div><p className="text-[10px] uppercase text-muted-foreground">Total Due</p><p className="font-semibold tabular-nums">{formatPaiseToINR(i.totalDue)}</p></div>
                        <div><p className="text-[10px] uppercase text-muted-foreground">Paid At</p><p>{i.paidAt || '—'}</p></div>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments" className="space-y-4">
          <Card className="shadow-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4" /> Payment History</CardTitle>
              <CardDescription className="text-xs">{candidatePayments.length} payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-6">Payment #</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidatePayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="pl-6 font-mono text-xs">{p.paymentNumber}</TableCell>
                        <TableCell>{p.method.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-sm">{p.date}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{formatPaiseToINR(p.amount)}</TableCell>
                        <TableCell><StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge></TableCell>
                        <TableCell className="font-mono text-xs">{p.receiptNumber || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <StaggerContainer className="md:hidden space-y-3">
                {candidatePayments.map((p) => (
                  <StaggerItem key={p.id}>
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs text-primary">{p.paymentNumber}</p>
                          <p className="text-sm font-medium mt-1">{p.method.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-muted-foreground">{p.date}</p>
                        </div>
                        <StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge>
                      </div>
                      <p className="text-sm font-bold tabular-nums mt-3 pt-3 border-t border-border">{formatPaiseToINR(p.amount)}</p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Collection History */}
        <TabsContent value="history" className="space-y-4">
          <Card className="shadow-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Collection History</CardTitle>
              <CardDescription className="text-xs">{collectionHistory.length} past follow-ups</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6">
                <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
                <ul className="space-y-4">
                  {collectionHistory.map((h, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[18px] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                      <div className="rounded-xl border border-border bg-card p-3.5">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-medium">{h.outcome}</p>
                            <p className="text-[11px] text-muted-foreground">{h.date}</p>
                          </div>
                          <StatusBadge variant={h.method === 'FIELD_VISIT' ? 'AI_MEDIUM' : 'AI_LOW'}>{h.method.replace(/_/g, ' ')}</StatusBadge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{h.note}</p>
                        <p className="text-[11px] text-muted-foreground mt-1.5 inline-flex items-center gap-1">
                          <ChevronRight className="h-3 w-3" /> Next: {h.next}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PTP */}
        <TabsContent value="ptp" className="space-y-4">
          <Card className="shadow-premium">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><Handshake className="h-4 w-4" /> Promise to Pay</CardTitle>
                  <CardDescription className="text-xs">{ptps.length} PTPs for this candidate</CardDescription>
                </div>
                <Button size="sm" onClick={() => setPtpOpen(true)}><Plus className="h-3.5 w-3.5" /> New PTP</Button>
              </div>
            </CardHeader>
            <CardContent>
              {ptps.length === 0 ? (
                <EmptyState icon={<Handshake className="h-6 w-6" />} title="No PTPs yet" description="Create a promise to pay record for this candidate." />
              ) : (
                <StaggerContainer className="space-y-3">
                  {ptps.map((p) => (
                    <StaggerItem key={p.id}>
                      <div className="rounded-xl border border-border p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(p.promisedAmount)}</p>
                            <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
                              <Calendar className="h-3 w-3" /> {p.promiseDate}
                            </p>
                          </div>
                          <StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge>
                        </div>
                        {p.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{p.notes}</p>}
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="space-y-4">
          <Card className="shadow-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><StickyNote className="h-4 w-4" /> Agent Notes</CardTitle>
              <CardDescription className="text-xs">Private to you — not visible to the candidate or owner.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-border p-3 bg-muted/30">
                <Textarea
                  placeholder="Add a private note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="bg-background min-h-[80px]"
                />
                <div className="flex justify-end mt-2">
                  <Button size="sm" onClick={onAddNote} disabled={!newNote.trim()}>
                    <StickyNote className="h-3.5 w-3.5" /> Save Note
                  </Button>
                </div>
              </div>
              <StaggerContainer className="space-y-2.5">
                {notes.map((n) => (
                  <StaggerItem key={n.id}>
                    <div className="rounded-xl border border-border bg-card p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm">{n.text}</p>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium">{n.tag}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">{n.ts}</p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communication */}
        <TabsContent value="comm" className="space-y-4">
          <Card className="shadow-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Communication</CardTitle>
              <CardDescription className="text-xs">Send WhatsApp with pre-approved templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Template</Label>
                <Select value={templateKey} onValueChange={(v: string) => setTemplateKey(v as keyof typeof WHATSAPP_TEMPLATES)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(WHATSAPP_TEMPLATES).filter((k) => !k.startsWith('CANDIDATE_')).map((k) => (
                      <SelectItem key={k} value={k}>{k.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                {WHATSAPP_TEMPLATES[templateKey].replace(/\{candidateName\}/g, cand.name).replace(/\{loanNumber\}/g, cand.loanNumber).replace(/\{amount\}/g, (cand.outstanding / 100).toLocaleString('en-IN')).replace(/\{dueDate\}/g, cand.nextPayment)}
              </div>
              <Button onClick={() => onWhatsApp(templateKey)} className="w-full">
                <Send className="h-4 w-4" /> Send WhatsApp to {cand.name.split(' ')[0]}
              </Button>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                <Button asChild variant="outline">
                  <a href={`tel:${cand.mobile.replace(/\s/g, '')}`}><Phone className="h-4 w-4" /> Call</a>
                </Button>
                <Button variant="outline" onClick={() => toast.info('Email composer opened')}>
                  <Mail className="h-4 w-4" /> Email
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sticky action bar (mobile) */}
      <div className="fixed bottom-0 inset-x-0 z-20 sm:hidden bg-background/95 backdrop-blur-xl border-t border-border pb-safe">
        <div className="grid grid-cols-6 gap-1 px-2 py-2">
          <Button size="sm" variant="ghost" className="h-11 flex-col gap-0.5 text-info" onClick={() => onWhatsApp(templateKey)}>
            <MessageCircle className="h-4 w-4" /><span className="text-[9px]">WhatsApp</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-11 flex-col gap-0.5" asChild>
            <a href={`tel:${cand.mobile.replace(/\s/g, '')}`}><Phone className="h-4 w-4" /><span className="text-[9px]">Call</span></a>
          </Button>
          <Button size="sm" variant="ghost" className="h-11 flex-col gap-0.5" onClick={() => toast.info('Email composer opened')}>
            <Mail className="h-4 w-4" /><span className="text-[9px]">Email</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-11 flex-col gap-0.5 text-warning" onClick={() => setPtpOpen(true)}>
            <Handshake className="h-4 w-4" /><span className="text-[9px]">PTP</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-11 flex-col gap-0.5 text-success" onClick={() => setCashOpen(true)}>
            <Banknote className="h-4 w-4" /><span className="text-[9px]">Cash</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-11 flex-col gap-0.5 text-destructive" onClick={() => setEscOpen(true)}>
            <AlertTriangle className="h-4 w-4" /><span className="text-[9px]">Escalate</span>
          </Button>
        </div>
      </div>

      {/* Desktop action bar (below tabs) */}
      <div className="hidden sm:block">
        <Card className="shadow-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" onClick={() => onWhatsApp(templateKey)} className="text-info border-info/40 hover:bg-info/10">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
              <Button asChild variant="outline">
                <a href={`tel:${cand.mobile.replace(/\s/g, '')}`}><Phone className="h-4 w-4" /> Call</a>
              </Button>
              <Button variant="outline" onClick={() => toast.info('Email composer opened')}>
                <Mail className="h-4 w-4" /> Email
              </Button>
              <Button variant="outline" onClick={() => setPtpOpen(true)}>
                <Handshake className="h-4 w-4" /> New PTP
              </Button>
              <Button variant="outline" onClick={() => setCashOpen(true)}>
                <Banknote className="h-4 w-4" /> Record Cash
              </Button>
              <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setEscOpen(true)}>
                <AlertTriangle className="h-4 w-4" /> Escalate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New PTP Dialog */}
      <NewPtpDialog open={ptpOpen} onOpenChange={setPtpOpen} candidateName={cand.name} loanNumber={cand.loanNumber} />

      {/* Record Cash Dialog */}
      <RecordCashDialog open={cashOpen} onOpenChange={setCashOpen} candidateName={cand.name} loanNumber={cand.loanNumber} mobile={cand.mobile} />

      {/* Escalate Dialog */}
      <EscalateDialog open={escOpen} onOpenChange={setEscOpen} candidateName={cand.name} loanNumber={cand.loanNumber} />
    </div>
  )
}

export function NewPtpDialog({ open, onOpenChange, candidateName, loanNumber }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  candidateName: string
  loanNumber: string
}) {
  const [amount, setAmount] = React.useState('')
  const [promiseDate, setPromiseDate] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const submit = () => {
    toast.success('PTP created', { description: `${candidateName} promised ${amount || '—'} by ${promiseDate || '—'}.` })
    setAmount(''); setPromiseDate(''); setNotes('')
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Promise to Pay</DialogTitle>
          <DialogDescription>{candidateName} · {loanNumber}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Loan</Label>
            <Input value={loanNumber} readOnly className="bg-muted/30 font-mono text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input placeholder="e.g. 14,300" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Promise Date</Label>
              <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="e.g. will pay after shop revenue comes in" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Create PTP</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RecordCashDialog({ open, onOpenChange, candidateName, loanNumber, mobile }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  candidateName: string
  loanNumber: string
  mobile: string
}) {
  const [amount, setAmount] = React.useState('')
  const [date, setDate] = React.useState('')
  const [time, setTime] = React.useState('')
  const [installment, setInstallment] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const ref = React.useMemo(() => `CASH-2024-${Math.floor(1000 + Math.random() * 9000)}`, [open])
  const submit = () => {
    toast.success('Cash recorded, pending verification', { description: `${ref} · ${candidateName} · ${amount || '—'}` })
    setAmount(''); setDate(''); setTime(''); setInstallment(''); setNotes('')
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Cash Collection</DialogTitle>
          <DialogDescription>{candidateName} · {loanNumber}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Loan</Label>
            <Input value={loanNumber} readOnly className="bg-muted/30 font-mono text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input placeholder="e.g. 7,425" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Installment #</Label>
              <Input placeholder="e.g. 2 (optional)" value={installment} onChange={(e) => setInstallment(e.target.value)} />
            </div>
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
            <Label>Reference</Label>
            <Input value={ref} readOnly className="bg-muted/30 font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label>Proof Upload (placeholder)</Label>
            <div className="rounded-xl border-2 border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              <Banknote className="h-6 w-6 mx-auto mb-2 opacity-50" />
              Tap to upload receipt photo (JPG/PDF)
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="e.g. collected from shop" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="rounded-lg bg-warning/5 border border-warning/20 p-2.5 text-[11px] text-warning">
            All cash collections require supervisor verification before ledger allocation.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Record Cash</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EscalateDialog({ open, onOpenChange, candidateName, loanNumber }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  candidateName: string
  loanNumber: string
}) {
  const [reason, setReason] = React.useState('LONG_OVERDUE')
  const [description, setDescription] = React.useState('')
  const submit = () => {
    toast.success('Escalation created', { description: `${candidateName} · ${reason.replace(/_/g, ' ')}` })
    setDescription('')
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escalate Candidate</DialogTitle>
          <DialogDescription>{candidateName} · {loanNumber}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
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
