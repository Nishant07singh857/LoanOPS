'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, User, Phone, Mail, Briefcase, CreditCard, ShieldCheck,
  Eye, EyeOff, FileText, Banknote, Receipt, Handshake, LifeBuoy, Bell, Pencil,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, pluralize } from '@/lib/money'

interface CandidateDetail {
  id: string
  fullName: string
  mobile: string
  email?: string | null
  dob?: string | null
  address?: string | null
  occupation?: string | null
  employer?: string | null
  monthlyIncome?: number | null
  existingObligations?: number | null
  bankName?: string | null
  bankAccount?: string | null
  bankIfsc?: string | null
  upiId?: string | null
  aadhaarMasked?: string | null
  panMasked?: string | null
  status: string
  kycStatus?: string | null
  assignedAgent: { id: string; name: string; phone?: string | null } | null
  kyc: { status: string; aadhaarNumber?: string | null; panNumber?: string | null; verifiedAt?: string | null } | null
  loans: Array<{
    id: string
    loanNumber: string
    principalAmount: string
    installmentAmount: string
    totalRepayable: string
    outstandingPrincipal: string
    outstandingInterest: string
    outstandingFees: string
    totalCollected: string
    status: string
    frequency: string
    installments: number
    firstDueDate: string
    disbursedAt?: string | null
    scheduleSummary: { total: number; paid: number; overdue: number; nextDueDate?: string | null }
  }>
  applications: Array<{
    id: string
    applicationNumber: string
    principalAmount: string
    purpose: string
    status: string
    submittedAt?: string | null
    createdAt: string
  }>
  recentPayments: Array<{
    id: string
    paymentNumber: string
    loanNumber: string
    method: string
    amount: string
    status: string
    receiptNumber?: string | null
    createdAt: string
  }>
  ptps: Array<{
    id: string
    loanNumber: string
    promisedAmount: string
    promiseDate: string
    status: string
    notes?: string | null
    createdAt: string
  }>
  supportTickets: Array<{
    id: string
    ticketNumber: string
    category: string
    subject: string
    description: string
    status: string
    resolution?: string | null
    createdAt: string
  }>
  reminders: Array<{
    id: string
    loanNumber: string
    stage: string
    channel: string
    status: string
    createdAt: string
  }>
  counts: { loans: number; applications: number; payments: number; ptps: number; supportTickets: number; reminderLogs: number }
  createdAt: string
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const { data: c, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-candidate', params.id],
    queryFn: () => api.get<CandidateDetail>(`/api/owner/candidates/${params.id}`),
    enabled: !!params.id,
  })

  const [showPii, setShowPii] = React.useState(false)
  const [revealedPii, setRevealedPii] = React.useState<{
    aadhaar?: string | null
    pan?: string | null
    bankAccount?: string | null
  } | null>(null)
  const [revealingPii, setRevealingPii] = React.useState(false)

  const handleTogglePii = async () => {
    if (showPii) {
      setShowPii(false)
      return
    }
    if (revealedPii) {
      setShowPii(true)
      return
    }
    setRevealingPii(true)
    try {
      const data = await api.post<{ aadhaar: string | null; pan: string | null; bankAccount: string | null }>(
        '/api/owner/pii/reveal',
        { entityType: 'CANDIDATE', entityId: params.id }
      )
      setRevealedPii(data)
      setShowPii(true)
      toast.success('PII revealed (audit logged)')
    } catch (err: any) {
      toast.error('Failed to reveal PII', { description: err.message })
    } finally {
      setRevealingPii(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading candidate details">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/candidates')} className="gap-1 min-h-[44px] sm:min-h-8">
          <ArrowLeft className="h-4 w-4" /> Back to Candidates
        </Button>
        <Card className="shadow-premium"><CardContent className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </CardContent></Card>
      </div>
    )
  }

  if (isError || !c) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/candidates')} className="gap-1 min-h-[44px] sm:min-h-8">
          <ArrowLeft className="h-4 w-4" /> Back to Candidates
        </Button>
        <Card className="border-destructive/40 bg-destructive/5 shadow-premium">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-destructive">Failed to load candidate details</p>
              <p className="text-xs text-muted-foreground mt-0.5">The candidate could not be found or there was a network error.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="min-h-[44px] sm:min-h-8">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasPii = !!(c.aadhaarMasked || c.panMasked || c.bankAccount || c.kyc?.aadhaarNumber || c.kyc?.panNumber)
  const outstanding = (l: CandidateDetail['loans'][number]) =>
    Number(l.outstandingPrincipal) + Number(l.outstandingInterest) + Number(l.outstandingFees)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/candidates')} className="gap-1 min-h-[44px] sm:min-h-8">
          <ArrowLeft className="h-4 w-4" /> Back to Candidates
        </Button>
      </div>

      <SectionHeading
        title={c.fullName}
        description={`Candidate since ${fmtDate(c.createdAt)}`}
        icon={<User className="h-5 w-5" />}
        action={
          <div className="flex items-center gap-2">
            <EditRecordDialog candidate={c} onSaved={refetch} />
            <StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge>
          </div>
        }
      />

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {c.fullName.split(' ').map(p => p[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.fullName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {c.mobile}</p>
                  {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><Mail className="h-3 w-3" /> <span className="truncate">{c.email}</span></p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 sm:gap-6">
                <div><p className="text-xs text-muted-foreground">KYC</p><StatusBadge variant={c.kycStatus ?? 'PENDING'}>{formatStatus(c.kycStatus ?? 'PENDING')}</StatusBadge></div>
                <div><p className="text-xs text-muted-foreground">Assigned Agent</p><p className="text-base font-semibold">{c.assignedAgent?.name ?? 'Unassigned'}</p></div>
                <div><p className="text-xs text-muted-foreground">Loans</p><p className="text-base font-semibold tabular-nums">{c.counts.loans}</p></div>
                <div><p className="text-xs text-muted-foreground">Applications</p><p className="text-base font-semibold tabular-nums">{c.counts.applications}</p></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex w-full overflow-x-auto no-scrollbar h-auto">
          <TabsTrigger value="overview" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">Overview</TabsTrigger>
          <TabsTrigger value="applications" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">Applications</TabsTrigger>
          <TabsTrigger value="loans" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">Loans</TabsTrigger>
          <TabsTrigger value="payments" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">Payments</TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-9">Support &amp; Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Personal Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Term label="Full Name" value={c.fullName} />
                <Term label="Mobile" value={c.mobile} />
                <Term label="Email" value={c.email ?? '—'} />
                <Term label="DOB" value={fmtDate(c.dob)} />
                <Term label="Address" value={c.address ?? '—'} />
                <Term label="Status" value={formatStatus(c.status)} />
              </CardContent>
            </Card>

            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4" /> Financial Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Term label="Occupation" value={c.occupation ?? '—'} />
                <Term label="Employer" value={c.employer ?? '—'} />
                <Term label="Monthly Income" value={c.monthlyIncome ? formatPaiseToINR(c.monthlyIncome) : '—'} />
                <Term label="Existing Obligations" value={c.existingObligations ? formatPaiseToINR(c.existingObligations) : '—'} />
              </CardContent>
            </Card>

            <Card className="shadow-premium">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Bank Details</CardTitle>
                {hasPii && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={revealingPii}
                    onClick={handleTogglePii}
                    aria-label={showPii ? 'Mask sensitive identifiers' : 'Reveal sensitive identifiers'}
                    className="h-8 px-2 text-xs text-muted-foreground"
                  >
                    {showPii ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                    {showPii ? 'Mask' : 'Reveal'}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Term label="Bank" value={c.bankName ?? '—'} />
                <Term label="Account Number" value={showPii ? (revealedPii?.bankAccount ?? c.bankAccount ?? '—') : (c.bankAccount ?? '—')} />
                <Term label="IFSC" value={c.bankIfsc ?? '—'} />
                <Term label="UPI ID" value={c.upiId ?? '—'} />
              </CardContent>
            </Card>

            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> KYC Verification</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Aadhaar Card</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{showPii ? (revealedPii?.aadhaar ?? c.aadhaarMasked ?? '—') : (c.aadhaarMasked ?? '—')}</p>
                  </div>
                  <StatusBadge variant={c.kycStatus ?? 'PENDING'}>{formatStatus(c.kycStatus ?? 'PENDING')}</StatusBadge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">PAN Card</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{showPii ? (revealedPii?.pan ?? c.panMasked ?? '—') : (c.panMasked ?? '—')}</p>
                  </div>
                  <StatusBadge variant={c.kycStatus ?? 'PENDING'}>{formatStatus(c.kycStatus ?? 'PENDING')}</StatusBadge>
                </div>
                {c.kyc?.verifiedAt && <p className="text-xs text-muted-foreground">Verified on {fmtDate(c.kyc.verifiedAt)}</p>}
                <p className="text-xs text-muted-foreground">Aadhaar is always shown masked. Revealing PAN or bank account is audit-logged.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="applications">
          {c.applications.length === 0 ? (
            <EmptyState icon={<FileText className="h-6 w-6" />} title="No applications yet" description="This candidate has not submitted any loan applications." />
          ) : (
            <Card className="shadow-premium">
              <CardContent className="p-0">
                <div className="table-scroll overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Application</TableHead><TableHead>Purpose</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Submitted</TableHead><TableHead className="text-right">Action</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {c.applications.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs">{a.applicationNumber}</TableCell>
                          <TableCell>{a.purpose}</TableCell>
                          <TableCell className="tabular-nums">{formatPaiseToINR(a.principalAmount)}</TableCell>
                          <TableCell><StatusBadge variant={a.status}>{formatStatus(a.status)}</StatusBadge></TableCell>
                          <TableCell>{fmtDate(a.submittedAt ?? a.createdAt)}</TableCell>
                          <TableCell className="text-right"><Link href={`/admin/applications/${a.id}`} className="text-primary text-xs font-medium underline">View</Link></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="loans" className="space-y-4">
          {c.loans.length === 0 ? (
            <EmptyState icon={<Banknote className="h-6 w-6" />} title="No loans yet" description="This candidate has no loans on record." />
          ) : c.loans.map((l) => (
            <Card key={l.id} className="shadow-premium">
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base font-mono">{l.loanNumber}</CardTitle>
                  <CardDescription>{l.frequency} · {pluralize(l.installments, 'installment')} · First due {fmtDate(l.firstDueDate)}{l.disbursedAt ? ` · Disbursed ${fmtDate(l.disbursedAt)}` : ''}</CardDescription>
                </div>
                <StatusBadge variant={l.status}>{formatStatus(l.status)}</StatusBadge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <Term label="Principal" value={formatPaiseToINR(l.principalAmount)} />
                  <Term label="Installment" value={formatPaiseToINR(l.installmentAmount)} />
                  <Term label="Total Repayable" value={formatPaiseToINR(l.totalRepayable)} />
                  <Term label="Outstanding" value={formatPaiseToINR(outstanding(l))} />
                  <Term label="Collected" value={formatPaiseToINR(l.totalCollected)} />
                  <Term label="Schedule" value={`${l.scheduleSummary.paid} of ${l.scheduleSummary.total} paid`} />
                  <Term label="Overdue Installments" value={String(l.scheduleSummary.overdue)} />
                  <Term label="Next Due" value={fmtDate(l.scheduleSummary.nextDueDate)} />
                </div>
                <div className="pt-1">
                  <Link href={`/admin/loans/${l.id}`} className="text-primary text-xs font-medium underline">View loan details →</Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="payments">
          {c.recentPayments.length === 0 ? (
            <EmptyState icon={<Receipt className="h-6 w-6" />} title="No payments yet" description="No payments have been recorded for this candidate." />
          ) : (
            <Card className="shadow-premium">
              <CardContent className="p-0">
                <div className="table-scroll overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Payment</TableHead><TableHead>Loan</TableHead><TableHead>Method</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {c.recentPayments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.paymentNumber}</TableCell>
                          <TableCell className="font-mono text-xs">{p.loanNumber}</TableCell>
                          <TableCell>{formatStatus(p.method)}</TableCell>
                          <TableCell className="tabular-nums">{formatPaiseToINR(p.amount)}</TableCell>
                          <TableCell><StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge></TableCell>
                          <TableCell>{fmtDate(p.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Handshake className="h-4 w-4" /> Promises to Pay</CardTitle></CardHeader>
            <CardContent>
              {c.ptps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No promises to pay recorded for this candidate.</p>
              ) : (
                <ul className="space-y-3">
                  {c.ptps.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium tabular-nums">{formatPaiseToINR(p.promisedAmount)} <span className="text-muted-foreground font-normal">by {fmtDate(p.promiseDate)}</span></p>
                        <p className="text-xs text-muted-foreground mt-0.5">Loan {p.loanNumber}{p.notes ? ` · ${p.notes}` : ''}</p>
                      </div>
                      <StatusBadge variant={p.status}>{formatStatus(p.status)}</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><LifeBuoy className="h-4 w-4" /> Support Tickets</CardTitle></CardHeader>
            <CardContent>
              {c.supportTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No support tickets raised by this candidate.</p>
              ) : (
                <ul className="space-y-3">
                  {c.supportTickets.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5"><span className="font-mono">{t.ticketNumber}</span> · {t.category} · {fmtDate(t.createdAt)}</p>
                      </div>
                      <StatusBadge variant={t.status}>{formatStatus(t.status)}</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Reminder History</CardTitle></CardHeader>
            <CardContent>
              {c.reminders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reminders have been sent to this candidate yet.</p>
              ) : (
                <ul className="space-y-3">
                  {c.reminders.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">{formatStatus(r.stage)} <span className="text-muted-foreground font-normal">via {formatStatus(r.channel)}</span></p>
                        <p className="text-xs text-muted-foreground mt-0.5">Loan {r.loanNumber} · {fmtDate(r.createdAt)}</p>
                      </div>
                      <StatusBadge variant={r.status}>{formatStatus(r.status)}</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5 break-words">{value}</p>
    </div>
  )
}

// Edit the candidate's ordinary record fields (name, contact, address,
// employment, income, bank details). Mobile, Aadhaar/PAN and agent
// assignment are intentionally absent: mobile is the borrower's
// portal-login identity, identity documents belong to the KYC flow,
// and assignment has its own control. Every save is audit-logged
// server-side with the changed field names.
function EditRecordDialog({ candidate: c, onSaved }: { candidate: CandidateDetail; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [fullName, setFullName] = React.useState(c.fullName)
  const [email, setEmail] = React.useState(c.email ?? '')
  const [dob, setDob] = React.useState(c.dob ? c.dob.slice(0, 10) : '')
  const [address, setAddress] = React.useState(c.address ?? '')
  const [occupation, setOccupation] = React.useState(c.occupation ?? '')
  const [employer, setEmployer] = React.useState(c.employer ?? '')
  const [monthlyIncomeRupees, setMonthlyIncomeRupees] = React.useState(
    c.monthlyIncome != null ? String(c.monthlyIncome / 100) : ''
  )
  const [bankName, setBankName] = React.useState(c.bankName ?? '')
  const [bankIfsc, setBankIfsc] = React.useState(c.bankIfsc ?? '')
  const [upiId, setUpiId] = React.useState(c.upiId ?? '')
  const [bankAccount, setBankAccount] = React.useState('')

  // Re-seed the form from the freshly fetched record each time it opens.
  const handleOpen = () => {
    setFullName(c.fullName)
    setEmail(c.email ?? '')
    setDob(c.dob ? c.dob.slice(0, 10) : '')
    setAddress(c.address ?? '')
    setOccupation(c.occupation ?? '')
    setEmployer(c.employer ?? '')
    setMonthlyIncomeRupees(c.monthlyIncome != null ? String(c.monthlyIncome / 100) : '')
    setBankName(c.bankName ?? '')
    setBankIfsc(c.bankIfsc ?? '')
    setUpiId(c.upiId ?? '')
    setBankAccount('')
    setOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const income = monthlyIncomeRupees.trim()
    let monthlyIncome: number | null = null
    if (income) {
      const rupees = Number(income)
      if (!Number.isFinite(rupees) || rupees < 0) {
        toast.error('Monthly income must be a valid amount')
        return
      }
      monthlyIncome = Math.round(rupees * 100)
    }
    setSaving(true)
    try {
      const res = await api.patch<{ id: string; changedFields: string[] }>(`/api/owner/candidates/${c.id}`, {
        fullName: fullName.trim(),
        email: email.trim() || null,
        dob: dob || null,
        address: address.trim() || null,
        occupation: occupation.trim() || null,
        employer: employer.trim() || null,
        monthlyIncome,
        bankName: bankName.trim() || null,
        bankIfsc: bankIfsc.trim().toUpperCase() || null,
        upiId: upiId.trim() || null,
        // Blank means "keep the current account" — the stored value is
        // encrypted and only ever shown masked, so it is never prefilled.
        ...(bankAccount.trim() ? { bankAccount: bankAccount.trim().replace(/\s+/g, '') } : {}),
      })
      toast.success('Candidate record updated', {
        description: res.changedFields.length
          ? `Changed: ${res.changedFields.join(', ')}`
          : 'No changes were needed.',
      })
      setOpen(false)
      onSaved()
    } catch (err: any) {
      toast.error('Could not update the record', { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  const fieldCls = 'min-h-[44px] sm:min-h-9'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={handleOpen} className="min-h-[44px] sm:min-h-8">
        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Record
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Candidate Record</DialogTitle>
          <DialogDescription>
            Update the borrower&apos;s ordinary record details. Mobile number, Aadhaar/PAN and agent
            assignment cannot be changed here — they are managed through their own verified flows.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="edit-fullName">Full Name</Label>
            <Input id="edit-fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={100} className={fieldCls} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <Label htmlFor="edit-dob">Date of Birth</Label>
              <Input id="edit-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={fieldCls} />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-address">Address</Label>
            <Input id="edit-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} className={fieldCls} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-occupation">Occupation</Label>
              <Input id="edit-occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} maxLength={100} className={fieldCls} />
            </div>
            <div>
              <Label htmlFor="edit-employer">Employer</Label>
              <Input id="edit-employer" value={employer} onChange={(e) => setEmployer(e.target.value)} maxLength={100} className={fieldCls} />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-income">Monthly Income (₹)</Label>
            <Input id="edit-income" type="number" min="0" step="any" value={monthlyIncomeRupees} onChange={(e) => setMonthlyIncomeRupees(e.target.value)} className={fieldCls} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-bankName">Bank Name</Label>
              <Input id="edit-bankName" value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={100} className={fieldCls} />
            </div>
            <div>
              <Label htmlFor="edit-bankIfsc">Bank IFSC</Label>
              <Input id="edit-bankIfsc" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value.toUpperCase())} maxLength={11} className={`${fieldCls} uppercase font-mono`} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-bankAccount">Bank Account Number</Label>
              <Input
                id="edit-bankAccount"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder={c.bankAccount ?? 'Leave blank to keep current'}
                autoComplete="off"
                className={fieldCls}
              />
              <p className="text-xs text-muted-foreground mt-1">Leave blank to keep the current account ({c.bankAccount ?? 'none on record'}).</p>
            </div>
            <div>
              <Label htmlFor="edit-upiId">UPI ID</Label>
              <Input id="edit-upiId" value={upiId} onChange={(e) => setUpiId(e.target.value)} maxLength={100} className={fieldCls} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving} className="min-h-[44px] sm:min-h-9">Cancel</Button>
            <Button type="submit" disabled={saving} className="min-h-[44px] sm:min-h-9">{saving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
