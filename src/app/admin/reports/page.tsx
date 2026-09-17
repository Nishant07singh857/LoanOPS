'use client'

import * as React from 'react'
import {
  BarChart3, FileText, Landmark, FileCheck, Wallet, AlertTriangle, ClipboardList,
  UserCog, Scale, ScrollText, Banknote, Filter, Download, Play,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { loans, applications, agentPerformance, portfolioTrend, overdueAging } from '@/lib/mock-data'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { cn } from '@/lib/utils'

const REPORT_TYPES = [
  { key: 'portfolio', label: 'Portfolio Report', desc: 'Disbursed, collected, outstanding summary', icon: BarChart3, tint: 'text-primary bg-primary/10' },
  { key: 'loans', label: 'Loans Report', desc: 'All loans with status breakdown', icon: Landmark, tint: 'text-success bg-success/10' },
  { key: 'applications', label: 'Applications Report', desc: 'Submitted, approved, rejected stats', icon: FileText, tint: 'text-info bg-info/10' },
  { key: 'payments', label: 'Payments Report', desc: 'Online vs cash, by method', icon: FileCheck, tint: 'text-success bg-success/10' },
  { key: 'collections', label: 'Collections Report', desc: 'Cash verification and PTP stats', icon: Wallet, tint: 'text-warning bg-warning/10' },
  { key: 'overdue', label: 'Overdue Report', desc: 'Aging buckets and recovery actions', icon: AlertTriangle, tint: 'text-destructive bg-destructive/10' },
  { key: 'ptp', label: 'PTP Report', desc: 'Promise-to-pay fulfillment metrics', icon: ClipboardList, tint: 'text-warning bg-warning/10' },
  { key: 'agent', label: 'Agent Performance', desc: 'Per-agent collection & success rate', icon: UserCog, tint: 'text-primary bg-primary/10' },
  { key: 'reconciliation', label: 'Reconciliation Report', desc: 'Expected vs captured variance', icon: Scale, tint: 'text-info bg-info/10' },
  { key: 'audit', label: 'Audit Report', desc: 'All actions taken by users', icon: ScrollText, tint: 'text-muted-foreground bg-muted' },
  { key: 'disbursement', label: 'Disbursement Report', desc: 'Online vs offline disbursements', icon: Banknote, tint: 'text-success bg-success/10' },
]

export default function ReportsPage() {
  const [active, setActive] = React.useState<string>('portfolio')
  const [dateRange, setDateRange] = React.useState<string>('30d')
  const [candidate, setCandidate] = React.useState('')
  const [agent, setAgent] = React.useState<string>('all')
  const [loan, setLoan] = React.useState('')
  const [status, setStatus] = React.useState<string>('all')
  const [paymentMethod, setPaymentMethod] = React.useState<string>('all')

  const generate = (k: string) => toast.success(`Generating ${k} report...`, { description: 'Your report will be available in Reports → History shortly.' })

  // Sample report table data — varies by report type
  const renderSampleTable = () => {
    if (active === 'portfolio') {
      return (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="pl-6">Month</TableHead>
              <TableHead className="text-right">Disbursed</TableHead>
              <TableHead className="text-right">Collected</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {portfolioTrend.map((p) => (
              <TableRow key={p.label}>
                <TableCell className="pl-6 font-medium">{p.label}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPaiseToINR(p.disbursed)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPaiseToINR(p.collected)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPaiseToINR(p.outstanding)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    }
    if (active === 'loans') {
      return (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="pl-6">Loan #</TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead className="text-right">Principal</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.slice(0, 6).map((l) => (
              <TableRow key={l.id}>
                <TableCell className="pl-6 font-mono text-xs text-primary font-semibold">{l.loanNumber}</TableCell>
                <TableCell>{l.candidateName}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPaiseToINR(l.principalAmount)}</TableCell>
                <TableCell className="text-xs">{l.status.replace(/_/g, ' ')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    }
    if (active === 'applications') {
      return (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="pl-6">App #</TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.slice(0, 6).map((a) => (
              <TableRow key={a.id}>
                <TableCell className="pl-6 font-mono text-xs text-primary font-semibold">{a.applicationNumber}</TableCell>
                <TableCell>{a.candidateName}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPaiseToINR(a.principalAmount)}</TableCell>
                <TableCell className="text-xs">{a.status.replace(/_/g, ' ')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    }
    if (active === 'agent') {
      return (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="pl-6">Agent</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead className="text-right">Collected</TableHead>
              <TableHead className="text-right">Success</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agentPerformance.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="pl-6 font-medium">{a.agentName}</TableCell>
                <TableCell>{a.zone}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPaiseToINR(a.collectionAmount)}</TableCell>
                <TableCell className="text-right tabular-nums">{a.successRate}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    }
    if (active === 'overdue') {
      return (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="pl-6">Bucket</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overdueAging.map((b) => (
              <TableRow key={b.bucket}>
                <TableCell className="pl-6 font-medium">{b.bucket}</TableCell>
                <TableCell className="text-right tabular-nums">{b.count}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPaiseToINR(b.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    }
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Sample preview for &ldquo;{REPORT_TYPES.find((r) => r.key === active)?.label}&rdquo; report.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Reports"
        description="Generate, schedule, and export operational and financial reports."
        icon={<BarChart3 className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filter sidebar */}
        <FadeIn className="lg:col-span-1">
          <Card className="shadow-premium lg:sticky lg:top-20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</CardTitle>
              <CardDescription>Refine report scope</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="mtd">Month to date</SelectItem>
                    <SelectItem value="ytd">Year to date</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Candidate</Label>
                <Input value={candidate} onChange={(e) => setCandidate(e.target.value)} placeholder="Name or mobile" />
              </div>
              <div>
                <Label>Agent</Label>
                <Select value={agent} onValueChange={setAgent}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="All agents" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All agents</SelectItem>
                    {agentPerformance.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.agentName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Loan Number</Label>
                <Input value={loan} onChange={(e) => setLoan(e.target.value)} placeholder="LON-2024-XXXX" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Any status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Any method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any method</SelectItem>
                    <SelectItem value="ONLINE_UPI">UPI</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => toast.info('Filters reset')}>
                Reset Filters
              </Button>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Report cards + preview */}
        <div className="lg:col-span-3 space-y-6">
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {REPORT_TYPES.map((r) => {
              const Icon = r.icon
              const isActive = active === r.key
              return (
                <StaggerItem key={r.key}>
                  <Card
                    className={cn(
                      'shadow-premium cursor-pointer transition-all hover:border-primary/40 hover:shadow-glow',
                      isActive && 'border-primary ring-2 ring-primary/20'
                    )}
                    onClick={() => setActive(r.key)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', r.tint)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{r.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.desc}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isActive ? 'default' : 'outline'}
                        className="w-full mt-3"
                        onClick={(e) => { e.stopPropagation(); generate(r.label) }}
                      >
                        <Play className="h-3.5 w-3.5" /> Generate
                      </Button>
                    </CardContent>
                  </Card>
                </StaggerItem>
              )
            })}
          </StaggerContainer>

          {/* Sample preview */}
          <FadeIn>
            <Card className="shadow-premium">
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{REPORT_TYPES.find((r) => r.key === active)?.label} — Preview</CardTitle>
                  <CardDescription>Sample data based on current filters</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.success('Exporting...')}>
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {renderSampleTable()}
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </div>
    </div>
  )
}
