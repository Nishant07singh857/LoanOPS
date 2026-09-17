'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Landmark, Banknote, Receipt, FileText, ClipboardList, ScrollText,
  FileSignature, MessageCircle, Eye, Calendar, Phone, User, Wallet,
  TrendingUp, CreditCard, AlertCircle, ChevronRight, Building2,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, EmptyState } from '@/components/ui/motion'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { loans, candidatePayments } from '@/lib/mock-data'
import { formatPaiseToINR, formatBpsToPercent } from '@/lib/money'
import { generateSchedulePreview, type ScheduleInput } from '@/lib/financial-engine'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

const isOverdue = (next?: string) => !!next && /OVERDUE/i.test(next)

function firstDueDateFromLoan(l: typeof loans[number]): Date {
  const today = new Date()
  if (l.frequency === 'MONTHLY') today.setMonth(today.getMonth() + 1)
  else if (l.frequency === 'WEEKLY') today.setDate(today.getDate() + 7)
  else today.setDate(today.getDate() + 1)
  return today
}

export default function LoanDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const loan = loans.find((l) => l.id === params.id) || loans[0]
  const [disburseOpen, setDisburseOpen] = React.useState(false)
  const overdue = isOverdue(loan.nextDueDate)

  const scheduleInput: ScheduleInput = {
    principalPaise: BigInt(loan.principalAmount),
    interestType: loan.interestType,
    interestRateBps: BigInt(loan.interestRate || 0),
    fixedInterestPaise: BigInt(loan.fixedInterest || 0),
    frequency: loan.frequency,
    installments: loan.installments,
    firstDueDate: firstDueDateFromLoan(loan),
    processingFeePaise: BigInt(0),
    otherFeesPaise: BigInt(0),
  }
  const preview = generateSchedulePreview(scheduleInput)

  const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const onWhatsApp = () => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.PAYMENT_REMINDER, {
      candidateName: loan.candidateName,
      loanNumber: loan.loanNumber,
      amount: (loan.installmentAmount / 100).toLocaleString('en-IN'),
      dueDate: loan.nextDueDate || 'soon',
    })
    openWhatsApp(loan.mobile, msg)
    toast.success('WhatsApp draft opened', { description: `Reminder sent to ${loan.candidateName}` })
  }

  const auditLog = [
    { ts: '34m ago', actor: 'Owner', action: 'VIEWED', desc: 'Loan overview opened' },
    { ts: '2 days ago', actor: loan.agentName || 'System', action: 'PTP_CREATED', desc: 'PTP recorded for next due' },
    { ts: '12 Aug 2024', actor: 'Owner', action: 'DISBURSED', desc: `Disbursed ${formatPaiseToINR(loan.principalAmount)}` },
    { ts: '11 Aug 2024', actor: 'Owner', action: 'APPROVED', desc: 'Application approved' },
  ]

  const ptps = [
    { date: '22 Sep 2024', amount: loan.installmentAmount, status: 'ACTIVE' as const, note: 'Will pay after shop revenue' },
  ]
  const collections = [
    { date: 'Today', amount: loan.installmentAmount, method: 'CASH', status: 'PENDING_VERIFICATION', ref: 'CASH-2024-4471' },
  ]
  const documents = [
    { name: 'KYC — Aadhaar.pdf', size: '420 KB', uploaded: '11 Aug 2024', type: 'KYC' },
    { name: 'KYC — PAN.pdf', size: '180 KB', uploaded: '11 Aug 2024', type: 'KYC' },
    { name: 'Signed Agreement.pdf', size: '1.1 MB', uploaded: '12 Aug 2024', type: 'AGREEMENT' },
    { name: 'Disbursement Receipt.pdf', size: '95 KB', uploaded: '12 Aug 2024', type: 'RECEIPT' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/loans')} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Loans
        </Button>
      </div>

      <SectionHeading
        title={loan.loanNumber}
        description={`${loan.candidateName} · ${loan.frequency} · ${loan.installments} installments`}
        icon={<Landmark className="h-5 w-5" />}
        action={
          <>
            <Button variant="outline" size="sm" onClick={onWhatsApp}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.info('Opening receipts...')}>
              <Receipt className="h-4 w-4" /> View Receipts
            </Button>
            {loan.status === 'PENDING_DISBURSEMENT' && (
              <Button size="sm" onClick={() => setDisburseOpen(true)}>
                <Banknote className="h-4 w-4" /> Disburse
              </Button>
            )}
          </>
        }
      />

      <FadeIn>
        <Card className={cn('border-l-4 shadow-premium', overdue ? 'border-l-destructive' : loan.status === 'CLOSED' ? 'border-l-muted-foreground' : 'border-l-primary')}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <StatusBadge variant={overdue ? 'OVERDUE' : loan.status}>{overdue ? 'Overdue' : formatStatus(loan.status)}</StatusBadge>
                <div>
                  <p className="text-xs text-muted-foreground">Outstanding principal</p>
                  <p className="text-2xl font-bold tabular-nums">{formatPaiseToINR(loan.outstandingPrincipal)}</p>
                </div>
              </div>
              <div className="flex gap-6 sm:gap-10">
                <div><p className="text-xs text-muted-foreground">Collected</p><p className="text-base font-semibold tabular-nums">{formatPaiseToINR(loan.totalCollected)}</p></div>
                <div><p className="text-xs text-muted-foreground">Next due</p><p className={cn('text-base font-semibold', overdue ? 'text-destructive' : '')}>{loan.nextDueDate || '—'}</p></div>
                <div className="hidden sm:block"><p className="text-xs text-muted-foreground">Disbursed</p><p className="text-base font-semibold">{loan.disbursedAt || '—'}</p></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex w-full overflow-x-auto no-scrollbar h-auto">
          <TabsTrigger value="overview" className="flex-1 min-w-[80px]">Overview</TabsTrigger>
          <TabsTrigger value="schedule" className="flex-1 min-w-[80px]">Schedule</TabsTrigger>
          <TabsTrigger value="payments" className="flex-1 min-w-[80px]">Payments</TabsTrigger>
          <TabsTrigger value="collections" className="flex-1 min-w-[80px]">Collections</TabsTrigger>
          <TabsTrigger value="ptp" className="flex-1 min-w-[80px]">PTP</TabsTrigger>
          <TabsTrigger value="documents" className="flex-1 min-w-[80px]">Documents</TabsTrigger>
          <TabsTrigger value="agreement" className="flex-1 min-w-[80px]">Agreement</TabsTrigger>
          <TabsTrigger value="audit" className="flex-1 min-w-[80px]">Audit</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Candidate</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {loan.candidateName.split(' ').map(p => p[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{loan.candidateName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {loan.mobile}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border text-sm">
                  <div><p className="text-xs text-muted-foreground">Agent</p><p>{loan.agentName || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Loan type</p><p>{loan.interestType}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-premium lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Terms Snapshot</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Term label="Principal" value={formatPaiseToINR(loan.principalAmount)} />
                  <Term label="Interest" value={loan.interestType === 'PERCENTAGE' ? `${formatBpsToPercent(loan.interestRate || 0)} (flat)` : loan.interestType === 'FIXED' ? formatPaiseToINR(loan.fixedInterest || 0) : 'No interest'} />
                  <Term label="Frequency" value={loan.frequency} />
                  <Term label="Installments" value={String(loan.installments)} />
                  <Term label="Installment Amt" value={formatPaiseToINR(loan.installmentAmount)} />
                  <Term label="Total Repayable" value={formatPaiseToINR(loan.totalRepayable)} />
                  <Term label="Outstanding" value={formatPaiseToINR(loan.outstandingPrincipal)} />
                  <Term label="Collected" value={formatPaiseToINR(loan.totalCollected)} />
                  <Term label="Disbursed On" value={loan.disbursedAt || '—'} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Banknote className="h-4 w-4" /> Disbursement Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <Term label="Method" value="Bank Transfer" />
                <Term label="Reference" value="DBR-2024-0892" />
                <Term label="Disbursed At" value={loan.disbursedAt || '—'} />
                <Term label="Channel" value="Online UPI" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule */}
        <TabsContent value="schedule">
          <Card className="shadow-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Installment Schedule</CardTitle>
              <CardDescription>Live preview generated from loan terms · {preview.installments.length} installments · total {formatPaiseToINR(Number(preview.totalRepayable))}</CardDescription>
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
                      <TableHead className="text-right pr-6">Closing Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.installments.map((inst) => (
                      <TableRow key={inst.number}>
                        <TableCell className="pl-6 font-mono font-semibold">{inst.number}</TableCell>
                        <TableCell><span className="inline-flex items-center gap-1.5 text-sm"><Calendar className="h-3 w-3 text-muted-foreground" /> {fmtDate(inst.dueDate)}</span></TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(inst.principal))}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(inst.interest))}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(inst.fees))}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatPaiseToINR(Number(inst.totalDue))}</TableCell>
                        <TableCell className="text-right tabular-nums pr-6 text-muted-foreground">{formatPaiseToINR(Number(inst.closingPrincipal))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden space-y-3">
                {preview.installments.map((inst) => (
                  <div key={inst.number} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-primary text-sm">#{inst.number}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(inst.dueDate)}</span>
                    </div>
                    <p className="text-lg font-bold mt-1 tabular-nums">{formatPaiseToINR(Number(inst.totalDue))}</p>
                    <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t border-border text-xs">
                      <div><p className="text-muted-foreground">Principal</p><p className="tabular-nums">{formatPaiseToINR(Number(inst.principal))}</p></div>
                      <div><p className="text-muted-foreground">Interest</p><p className="tabular-nums">{formatPaiseToINR(Number(inst.interest))}</p></div>
                      <div><p className="text-muted-foreground">Balance</p><p className="tabular-nums">{formatPaiseToINR(Number(inst.closingPrincipal))}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base">Payments</CardTitle><CardDescription>Recorded payments against this loan</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-6">Payment #</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidatePayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-6 font-mono">{p.paymentNumber}</TableCell>
                      <TableCell><span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{p.method.replace(/_/g, ' ')}</span></TableCell>
                      <TableCell className="text-sm">{p.date}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPaiseToINR(p.amount)}</TableCell>
                      <TableCell><StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge></TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" onClick={() => toast.info(`Opening receipt ${p.receiptNumber}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Collections */}
        <TabsContent value="collections">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base">Cash Collections</CardTitle><CardDescription>Cash pickup records awaiting verification</CardDescription></CardHeader>
            <CardContent>
              {collections.length === 0 ? (
                <EmptyState icon={<Wallet className="h-6 w-6" />} title="No cash collections recorded" description="Cash collections made by agents will appear here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-6">Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collections.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-6">{c.date}</TableCell>
                        <TableCell><span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{c.method}</span></TableCell>
                        <TableCell className="font-mono text-xs">{c.ref}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(c.amount)}</TableCell>
                        <TableCell><StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PTP */}
        <TabsContent value="ptp">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base">Promise-to-Pay</CardTitle><CardDescription>Commitments from the candidate</CardDescription></CardHeader>
            <CardContent>
              {ptps.length === 0 ? (
                <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No PTPs recorded" />
              ) : (
                <div className="space-y-3">
                  {ptps.map((p, i) => (
                    <div key={i} className="rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge>
                          <span className="text-sm font-medium">Promise on {p.date}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{p.note}</p>
                      </div>
                      <p className="text-xl font-bold tabular-nums">{formatPaiseToINR(p.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base">Documents</CardTitle><CardDescription>Uploaded KYC, agreement, and receipts</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {documents.map((d, i) => (
                  <div key={i} className="rounded-xl border border-border p-4 hover:border-primary/40 hover:shadow-premium transition-all cursor-pointer" onClick={() => toast.info(`Opening ${d.name}`)}>
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{d.size} · {d.uploaded}</p>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider mt-1.5">{d.type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agreement */}
        <TabsContent value="agreement">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileSignature className="h-4 w-4" /> Agreement</CardTitle><CardDescription>Standard Personal Loan Agreement v3.1</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">
                <p className="font-semibold mb-2"># Loan Agreement</p>
                <p className="text-muted-foreground">This agreement is entered into between <strong>Sterling Lending</strong> ("Lender") and <strong>{loan.candidateName}</strong> ("Borrower"). The principal amount of <strong>{formatPaiseToINR(loan.principalAmount)}</strong> shall be repaid in <strong>{loan.installments} {loan.frequency.toLowerCase()}</strong> installments of <strong>{formatPaiseToINR(loan.installmentAmount)}</strong> each, commencing on the disbursement date.</p>
                <p className="text-muted-foreground mt-2">Interest shall be charged per the agreed terms. Late payment may attract additional charges. This agreement is governed by applicable RBI guidelines and NBFC regulations.</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <StatusBadge variant="VERIFIED">Accepted on {loan.disbursedAt || '—'}</StatusBadge>
                <Button variant="outline" size="sm" onClick={() => toast.info('Generating PDF preview...')}>View Full Agreement</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ScrollText className="h-4 w-4" /> Audit Timeline</CardTitle><CardDescription>Append-only record of changes to this loan</CardDescription></CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                <ul className="space-y-4">
                  {auditLog.map((a, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="relative z-10 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 ring-4 ring-background">
                        <AlertCircle className="h-3 w-3" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{a.action}</p>
                          <span className="text-xs text-muted-foreground">by {a.actor}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{a.ts}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={disburseOpen} onOpenChange={setDisburseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disburse Loan — {loan.loanNumber}</DialogTitle>
            <DialogDescription>Choose a channel and confirm the disbursement.</DialogDescription>
          </DialogHeader>
          <DisburseForm loan={loan} onClose={() => setDisburseOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  )
}

function DisburseForm({ loan, onClose }: { loan: typeof loans[number]; onClose: () => void }) {
  const [channel, setChannel] = React.useState<'ONLINE' | 'OFFLINE'>('ONLINE')
  const [reference, setReference] = React.useState('')
  const [notes, setNotes] = React.useState('')

  const submit = () => {
    toast.success('Disbursement initiated', {
      description: `${channel} · ${formatPaiseToINR(loan.principalAmount)} to ${loan.candidateName}`,
    })
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(['ONLINE', 'OFFLINE'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setChannel(c)}
            className={cn(
              'rounded-xl border-2 p-4 text-left transition-all',
              channel === c ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {c === 'ONLINE' ? <Building2 className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
              <p className="text-sm font-semibold">{c === 'ONLINE' ? 'Online Transfer' : 'Offline Cash'}</p>
            </div>
            <p className="text-xs text-muted-foreground">{c === 'ONLINE' ? 'Bank/UPI transfer to candidate account' : 'Cash handed to candidate'}</p>
          </button>
        ))}
      </div>
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Principal</span><span className="font-semibold tabular-nums">{formatPaiseToINR(loan.principalAmount)}</span></div>
      </div>
      {channel === 'ONLINE' && (
        <div>
          <Label htmlFor="ref">Reference / UTR</Label>
          <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / Transaction ID" />
        </div>
      )}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={3} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit}>Confirm Disbursement</Button>
      </DialogFooter>
    </div>
  )
}
