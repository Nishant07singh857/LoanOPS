'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, FileText, User, Phone, CreditCard, Banknote, CheckCircle2,
  XCircle, Info, ShieldCheck, FileSignature, History, Home, Briefcase,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, EmptyState } from '@/components/ui/motion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { applications } from '@/lib/mock-data'
import { formatPaiseToINR, formatBpsToPercent } from '@/lib/money'
import { cn } from '@/lib/utils'

type ActionKind = 'APPROVE' | 'REJECT' | 'REQUEST_INFO'

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const app = applications.find((a) => a.id === params.id) || applications[0]
  const [action, setAction] = React.useState<ActionKind | null>(null)
  const [reason, setReason] = React.useState('')

  const submit = () => {
    if (action === 'APPROVE') toast.success('Application approved', { description: `${app.applicationNumber} marked APPROVED. Loan ready for disbursement.` })
    if (action === 'REJECT') toast.error('Application rejected', { description: `${app.applicationNumber} marked REJECTED.` })
    if (action === 'REQUEST_INFO') toast.info('Information requested', { description: `WhatsApp notification sent to ${app.candidateName}.` })
    setAction(null)
    setReason('')
  }

  const auditLog = [
    { ts: 'Just now', actor: 'Owner', action: 'OPENED', desc: 'Application opened for review' },
    { ts: app.submittedAt, actor: app.candidateName, action: 'SUBMITTED', desc: 'Application submitted via QR link' },
    { ts: '1 hour ago', actor: 'System', action: 'KYC_VERIFIED', desc: 'KYC documents auto-verified' },
    { ts: '3 days ago', actor: 'Agent', action: 'QR_GENERATED', desc: 'QR link shared with candidate' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/applications')} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Applications
        </Button>
      </div>

      <SectionHeading
        title={app.applicationNumber}
        description={`${app.candidateName} · ${app.purpose}`}
        icon={<FileText className="h-5 w-5" />}
        action={
          <>
            <Button variant="outline" size="sm" onClick={() => setAction('REQUEST_INFO')}>
              <Info className="h-4 w-4" /> Request Info
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAction('REJECT')} className="text-destructive border-destructive/40 hover:bg-destructive/10">
              <XCircle className="h-4 w-4" /> Reject
            </Button>
            <Button size="sm" onClick={() => setAction('APPROVE')}>
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          </>
        }
      />

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {app.candidateName.split(' ').map(p => p[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{app.candidateName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {app.mobile}</p>
                </div>
              </div>
              <div className="flex gap-3 sm:gap-6">
                <div><p className="text-xs text-muted-foreground">Amount</p><p className="text-base font-semibold tabular-nums">{formatPaiseToINR(app.principalAmount)}</p></div>
                <div><p className="text-xs text-muted-foreground">Terms</p><p className="text-base font-semibold">{app.frequency} · {app.installments}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><StatusBadge variant={app.status}>{formatStatus(app.status)}</StatusBadge></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex w-full overflow-x-auto no-scrollbar h-auto">
          <TabsTrigger value="overview" className="flex-1 min-w-[80px]">Overview</TabsTrigger>
          <TabsTrigger value="kyc" className="flex-1 min-w-[80px]">KYC</TabsTrigger>
          <TabsTrigger value="documents" className="flex-1 min-w-[80px]">Documents</TabsTrigger>
          <TabsTrigger value="agreement" className="flex-1 min-w-[80px]">Agreement</TabsTrigger>
          <TabsTrigger value="history" className="flex-1 min-w-[80px]">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Personal Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <Term label="Full Name" value={app.candidateName} />
                <Term label="Mobile" value={app.mobile} />
                <Term label="Email" value={`${app.candidateName.toLowerCase().replace(/\s/g, '.')}@example.com`} />
                <Term label="DOB" value="14 Jun 1992" />
                <Term label="Address" value="Andheri West, Mumbai, MH 400053" />
                <Term label="Residence Type" value="Rented" />
              </CardContent>
            </Card>

            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4" /> Financial Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <Term label="Employment" value="Self-employed" />
                <Term label="Monthly Income" value="₹85,000" />
                <Term label="Existing EMIs" value="₹0" />
                <Term label="Credit Score" value="762" />
                <Term label="Loan Purpose" value={app.purpose} />
                <Term label="Tenure" value={`${app.installments} ${app.frequency.toLowerCase()}`} />
              </CardContent>
            </Card>

            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Banknote className="h-4 w-4" /> Loan Request</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <Term label="Principal" value={formatPaiseToINR(app.principalAmount)} />
                <Term label="Frequency" value={app.frequency} />
                <Term label="Installments" value={String(app.installments)} />
                <Term label="Est. Installment" value={formatPaiseToINR(Math.round(app.principalAmount * 1.24 / app.installments))} />
                <Term label="Interest Rate (est.)" value={formatBpsToPercent(1800)} />
                <Term label="Total Repayable (est.)" value={formatPaiseToINR(Math.round(app.principalAmount * 1.24))} />
              </CardContent>
            </Card>

            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Bank Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <Term label="Account Holder" value={app.candidateName} />
                <Term label="Bank" value="HDFC Bank" />
                <Term label="Account Number" value="XXXXXX1234" />
                <Term label="IFSC" value="HDFC0001234" />
                <Term label="Type" value="Savings" />
                <Term label="Verified" value="Yes (penny-drop)" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="kyc">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> KYC Verification</CardTitle><CardDescription>Aadhaar, PAN, and address verification</CardDescription></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { doc: 'Aadhaar Card', number: 'XXXX-XXXX-7892', status: 'VERIFIED', at: '1 hour ago' },
                  { doc: 'PAN Card', number: 'ABCDE1234F', status: 'VERIFIED', at: '1 hour ago' },
                  { doc: 'Address Proof', number: 'Electricity Bill', status: 'VERIFIED', at: '1 hour ago' },
                  { doc: 'Photo', number: 'Selfie', status: 'VERIFIED', at: '1 hour ago' },
                ].map((k, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-border p-4 hover:border-primary/40 transition-all">
                    <div>
                      <p className="text-sm font-medium">{k.doc}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{k.number} · verified {k.at}</p>
                    </div>
                    <StatusBadge variant={k.status}>{formatStatus(k.status)}</StatusBadge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base">Uploaded Documents</CardTitle><CardDescription>Click to preview</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { name: 'Aadhaar Front.jpg', type: 'KYC', size: '420 KB' },
                  { name: 'Aadhaar Back.jpg', type: 'KYC', size: '380 KB' },
                  { name: 'PAN Card.jpg', type: 'KYC', size: '180 KB' },
                  { name: 'Bank Statement.pdf', type: 'FINANCIAL', size: '2.4 MB' },
                  { name: 'Salary Slip.pdf', type: 'INCOME', size: '1.1 MB' },
                  { name: 'Address Proof.pdf', type: 'ADDRESS', size: '650 KB' },
                ].map((d, i) => (
                  <div key={i} className="rounded-xl border border-border p-4 hover:border-primary/40 hover:shadow-premium transition-all cursor-pointer" onClick={() => toast.info(`Opening ${d.name}`)}>
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{d.size}</p>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider mt-1.5">{d.type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agreement">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileSignature className="h-4 w-4" /> Agreement</CardTitle><CardDescription>Standard Personal Loan Agreement v3.1</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">
                <p className="font-semibold mb-2"># Loan Agreement</p>
                <p className="text-muted-foreground">This agreement is entered into between <strong>Sterling Lending</strong> ("Lender") and <strong>{app.candidateName}</strong> ("Borrower"). The principal amount of <strong>{formatPaiseToINR(app.principalAmount)}</strong> shall be repaid in <strong>{app.installments} {app.frequency.toLowerCase()}</strong> installments, commencing on disbursement.</p>
                <p className="text-muted-foreground mt-2">This agreement is governed by applicable RBI guidelines and NBFC regulations.</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <StatusBadge variant={app.status === 'APPROVED' ? 'VERIFIED' : 'PENDING'}>
                  {app.status === 'APPROVED' ? 'Accepted' : 'Pending acceptance'}
                </StatusBadge>
                <Button variant="outline" size="sm" onClick={() => toast.info('Generating PDF preview...')}>View Full Agreement</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Application History</CardTitle><CardDescription>Audit trail of all changes</CardDescription></CardHeader>
            <CardContent>
              <div className="relative">
                <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                <ul className="space-y-4">
                  {auditLog.map((a, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="relative z-10 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 ring-4 ring-background">
                        <History className="h-3 w-3" />
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

      {/* Action modal */}
      <Dialog open={action !== null} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'APPROVE' && 'Approve Application'}
              {action === 'REJECT' && 'Reject Application'}
              {action === 'REQUEST_INFO' && 'Request Information'}
            </DialogTitle>
            <DialogDescription>
              {action === 'APPROVE' && `Confirm approval of ${app.applicationNumber}. A loan will be created and queued for disbursement.`}
              {action === 'REJECT' && `Confirm rejection of ${app.applicationNumber}. The candidate will be notified via WhatsApp.`}
              {action === 'REQUEST_INFO' && `Request additional information from ${app.candidateName}. Specify what is needed.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">{action === 'REJECT' ? 'Rejection reason' : action === 'APPROVE' ? 'Approval notes (optional)' : 'Information requested'}</Label>
              <Textarea
                id="reason"
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  action === 'REJECT' ? 'e.g. Income insufficient for requested amount' :
                  action === 'REQUEST_INFO' ? 'e.g. Please upload latest 3 months bank statement' :
                  'Optional approval notes'
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button
              variant={action === 'REJECT' ? 'destructive' : 'default'}
              onClick={submit}
              disabled={action === 'REJECT' && !reason.trim()}
            >
              {action === 'APPROVE' && 'Confirm Approval'}
              {action === 'REJECT' && 'Confirm Rejection'}
              {action === 'REQUEST_INFO' && 'Send Request'}
            </Button>
          </DialogFooter>
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
