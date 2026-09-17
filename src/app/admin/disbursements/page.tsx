'use client'

import * as React from 'react'
import {
  Banknote, Building2, Plus, Receipt, Upload, CheckCircle2, Clock,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { loans } from '@/lib/mock-data'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { cn } from '@/lib/utils'

export default function DisbursementsPage() {
  const [open, setOpen] = React.useState(false)

  const pending = loans.filter((l) => l.status === 'PENDING_DISBURSEMENT')
  const recent = loans.filter((l) => l.disbursedAt && (l.status === 'ACTIVE' || l.status === 'CLOSED')).slice(0, 6)

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Disbursements"
        description="Initiate and track loan disbursements — online transfers and offline cash."
        icon={<Banknote className="h-5 w-5" />}
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Initiate Disbursement
          </Button>
        }
      />

      {/* KPI strip */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem>
          <KPICard label="Pending Disbursements" value={String(pending.length)} icon={<Clock className="h-5 w-5" />} variant="warning" spark={[5, 6, 7, 8, 8, 8, 8]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Disbursed This Month" value={formatPaiseToINRShort(562000000)} icon={<Banknote className="h-5 w-5" />} variant="success" spark={[400, 420, 460, 500, 540, 560, 562]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Online Share" value="68%" icon={<Building2 className="h-5 w-5" />} variant="info" spark={[60, 62, 64, 65, 66, 67, 68]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Offline Cash" value="32%" icon={<Banknote className="h-5 w-5" />} variant="default" spark={[40, 38, 36, 35, 34, 33, 32]} />
        </StaggerItem>
      </StaggerContainer>

      {/* Pending disbursements */}
      <FadeIn>
        <Card className="shadow-premium border-l-4 border-l-warning">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Pending Disbursements</CardTitle>
            <CardDescription>{pending.length} loans awaiting disbursement</CardDescription>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No pending disbursements.</p>
            ) : (
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-6">Loan No.</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Total Repayable</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="pl-6 font-mono font-semibold text-primary">{l.loanNumber}</TableCell>
                        <TableCell className="font-medium">{l.candidateName}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(l.principalAmount)}</TableCell>
                        <TableCell><span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{l.frequency}</span></TableCell>
                        <TableCell className="text-right tabular-nums">{formatPaiseToINR(l.totalRepayable)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.agentName || '—'}</TableCell>
                        <TableCell className="text-right pr-6">
                          <Button size="sm" onClick={() => { toast.success('Disbursement modal opened', { description: `Disbursing ${formatPaiseToINR(l.principalAmount)} to ${l.candidateName}` }); setOpen(true) }}>
                            Disburse
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <StaggerContainer className="md:hidden space-y-3">
              {pending.map((l) => (
                <StaggerItem key={l.id}>
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-primary font-semibold">{l.loanNumber}</p>
                        <p className="text-sm font-medium mt-0.5">{l.candidateName}</p>
                      </div>
                      <StatusBadge variant="PENDING_DISBURSEMENT">Pending</StatusBadge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Principal</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(l.principalAmount)}</p></div>
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Frequency</p><p className="text-sm">{l.frequency}</p></div>
                    </div>
                    <Button size="sm" className="w-full mt-3" onClick={() => { toast.success('Disbursement initiated'); setOpen(true) }}>Disburse Now</Button>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Recent disbursements */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Disbursements</CardTitle>
            <CardDescription>Last 6 completed disbursements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-6">Loan No.</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Disbursed At</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((l, i) => (
                    <TableRow key={l.id}>
                      <TableCell className="pl-6 font-mono font-semibold text-primary">{l.loanNumber}</TableCell>
                      <TableCell className="font-medium">{l.candidateName}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPaiseToINR(l.principalAmount)}</TableCell>
                      <TableCell><span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', i % 3 === 0 ? 'bg-muted' : 'bg-info/15 text-info')}>{i % 3 === 0 ? 'OFFLINE' : 'ONLINE'}</span></TableCell>
                      <TableCell className="font-mono text-xs">DBR-2024-{1000 + i}</TableCell>
                      <TableCell className="text-sm">{l.disbursedAt}</TableCell>
                      <TableCell><StatusBadge variant="COMPLETED">Completed</StatusBadge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <StaggerContainer className="md:hidden space-y-3">
              {recent.map((l, i) => (
                <StaggerItem key={l.id}>
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-primary font-semibold">{l.loanNumber}</p>
                        <p className="text-sm font-medium mt-0.5">{l.candidateName}</p>
                        <p className="text-xs text-muted-foreground">{l.disbursedAt}</p>
                      </div>
                      <StatusBadge variant="COMPLETED">Completed</StatusBadge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(l.principalAmount)}</p></div>
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Channel</p><p className="text-sm">{i % 3 === 0 ? 'Offline Cash' : 'Online Transfer'}</p></div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Initiate Disbursement modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Initiate Disbursement</DialogTitle>
            <DialogDescription>Select channel, amount, and upload proof if needed.</DialogDescription>
          </DialogHeader>
          <DisburseForm onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DisburseForm({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = React.useState<'ONLINE' | 'OFFLINE'>('ONLINE')
  const [loan, setLoan] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [reference, setReference] = React.useState('')
  const [notes, setNotes] = React.useState('')

  const submit = () => {
    toast.success('Disbursement queued', { description: `${channel} · ${amount || '₹—'} via ${channel === 'ONLINE' ? reference || 'pending UTR' : 'cash handover'}` })
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(['ONLINE', 'OFFLINE'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setChannel(c)}
            className={cn('rounded-xl border-2 p-4 text-left transition-all', channel === c ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}
          >
            <div className="flex items-center gap-2 mb-1">
              {c === 'ONLINE' ? <Building2 className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
              <p className="text-sm font-semibold">{c === 'ONLINE' ? 'Online Transfer' : 'Offline Cash'}</p>
            </div>
            <p className="text-xs text-muted-foreground">{c === 'ONLINE' ? 'Bank/UPI/Netbanking' : 'Cash handover with receipt'}</p>
          </button>
        ))}
      </div>
      <div>
        <Label htmlFor="loan">Loan Number</Label>
        <Input id="loan" value={loan} onChange={(e) => setLoan(e.target.value)} placeholder="LON-2024-XXXX" />
      </div>
      <div>
        <Label htmlFor="amount">Amount (₹)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
          <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-8" type="text" inputMode="decimal" />
        </div>
      </div>
      {channel === 'ONLINE' && (
        <div>
          <Label htmlFor="ref">UTR / Transaction Reference</Label>
          <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / Reference ID" />
        </div>
      )}
      <div>
        <Label>Proof Upload</Label>
        <div className="rounded-xl border-2 border-dashed border-border p-5 text-center hover:border-primary/40 transition-all cursor-pointer" onClick={() => toast.info('Proof upload coming soon')}>
          <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Click to upload receipt/bank confirmation</p>
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes" />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit}>Initiate Disbursement</Button>
      </DialogFooter>
    </div>
  )
}
