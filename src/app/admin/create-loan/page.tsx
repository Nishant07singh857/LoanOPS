'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  UserPlus, User, IndianRupee, Percent, Banknote, Calendar, Coins, FileText,
  ArrowRight, ArrowLeft, CheckCircle2, Link2, Search, Calculator,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { loans } from '@/lib/mock-data'
import { generateSchedulePreview, type ScheduleInput, type InterestType, type RepaymentFrequency } from '@/lib/financial-engine'
import { formatPaiseToINR, formatBpsToPercent, parseDisplayPaise } from '@/lib/money'
import { cn } from '@/lib/utils'

type StepKey = 'candidate' | 'loan' | 'interest' | 'frequency' | 'tenure' | 'fees' | 'preview'

const STEPS: { key: StepKey; label: string; icon: React.ReactNode }[] = [
  { key: 'candidate', label: 'Candidate', icon: <User className="h-4 w-4" /> },
  { key: 'loan', label: 'Loan Amount', icon: <IndianRupee className="h-4 w-4" /> },
  { key: 'interest', label: 'Interest', icon: <Percent className="h-4 w-4" /> },
  { key: 'frequency', label: 'Frequency', icon: <Calendar className="h-4 w-4" /> },
  { key: 'tenure', label: 'Tenure', icon: <Coins className="h-4 w-4" /> },
  { key: 'fees', label: 'Fees', icon: <FileText className="h-4 w-4" /> },
  { key: 'preview', label: 'Preview', icon: <Calculator className="h-4 w-4" /> },
]

export default function CreateLoanPage() {
  const router = useRouter()
  // Step state
  const [step, setStep] = React.useState<number>(0)
  // Form state
  const [candidateMode, setCandidateMode] = React.useState<'EXISTING' | 'NEW'>('EXISTING')
  const [existingCandidate, setExistingCandidate] = React.useState('')
  const [newName, setNewName] = React.useState('')
  const [newMobile, setNewMobile] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [purpose, setPurpose] = React.useState('')
  const [interestType, setInterestType] = React.useState<InterestType>('PERCENTAGE')
  const [rateBps, setRateBps] = React.useState('') // input in percent, stored as bps
  const [fixedInterest, setFixedInterest] = React.useState('') // input in rupees
  const [frequency, setFrequency] = React.useState<RepaymentFrequency>('WEEKLY')
  const [installments, setInstallments] = React.useState('12')
  const [firstDueDate, setFirstDueDate] = React.useState('')
  const [processingFee, setProcessingFee] = React.useState('')
  const [otherFees, setOtherFees] = React.useState('')

  // Build ScheduleInput for preview
  const principalPaise = parseDisplayPaise(amount || '0')
  const interestRateBps = BigInt(Math.round((Number(rateBps) || 0) * 100)) // percent input → bps
  const fixedInterestPaise = parseDisplayPaise(fixedInterest || '0')
  const processingFeePaise = parseDisplayPaise(processingFee || '0')
  const otherFeesPaise = parseDisplayPaise(otherFees || '0')
  const installmentsNum = Math.max(1, parseInt(installments || '12', 10) || 1)
  const firstDue = firstDueDate ? new Date(firstDueDate) : (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d })()

  const scheduleInput: ScheduleInput = {
    principalPaise: BigInt(principalPaise),
    interestType,
    interestRateBps,
    fixedInterestPaise: BigInt(fixedInterestPaise),
    frequency,
    installments: installmentsNum,
    firstDueDate: firstDue,
    processingFeePaise: BigInt(processingFeePaise),
    otherFeesPaise: BigInt(otherFeesPaise),
  }
  const preview = React.useMemo(() => {
    if (principalPaise <= 0) return null
    try { return generateSchedulePreview(scheduleInput) } catch { return null }
  }, [principalPaise, interestType, interestRateBps, fixedInterestPaise, frequency, installmentsNum, firstDue, processingFeePaise, otherFeesPaise])

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))

  const canProceed = () => {
    if (step === 0) {
      if (candidateMode === 'EXISTING') return !!existingCandidate
      return !!newName && !!newMobile
    }
    if (step === 1) return principalPaise > 0 && !!purpose
    if (step === 2) {
      if (interestType === 'PERCENTAGE') return Number(rateBps) > 0
      if (interestType === 'FIXED') return fixedInterestPaise > 0
      return true
    }
    if (step === 3) return !!frequency
    if (step === 4) return installmentsNum > 0
    if (step === 5) return true
    if (step === 6) return true
    return true
  }

  const submit = () => {
    const candidateName = candidateMode === 'EXISTING' ? existingCandidate : newName
    toast.success('Application link generated!', {
      description: `QR link created for ${candidateName} · ${formatPaiseToINR(principalPaise)} ${frequency.toLowerCase()} × ${installmentsNum}.`,
    })
    router.push('/admin/qr-links')
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Create Loan"
        description="Build a loan with live schedule preview. Submit to generate an application QR link."
        icon={<UserPlus className="h-5 w-5" />}
      />

      {/* Stepper */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4">
            <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
              {STEPS.map((s, i) => {
                const done = i < step
                const active = i === step
                return (
                  <React.Fragment key={s.key}>
                    <li className="flex-shrink-0">
                      <button
                        onClick={() => i <= step && setStep(i)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                          active ? 'bg-primary text-primary-foreground shadow-glow' :
                          done ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <span className={cn('h-6 w-6 rounded-lg flex items-center justify-center', active ? 'bg-primary-foreground/15' : done ? 'bg-success/15' : 'bg-background')}>
                          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.icon}
                        </span>
                        <span className="hidden sm:inline">{s.label}</span>
                      </button>
                    </li>
                    {i < STEPS.length - 1 && (
                      <li className={cn('h-px flex-1 min-w-4 transition-colors', i < step ? 'bg-success' : 'bg-border')} />
                    )}
                  </React.Fragment>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Candidate */}
          {step === 0 && (
            <FadeIn>
              <Card className="shadow-premium">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Candidate</CardTitle>
                  <CardDescription>Select an existing candidate or onboard a new one.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={candidateMode} onValueChange={(v) => setCandidateMode(v as any)} className="grid grid-cols-2 gap-3">
                    <label className={cn('rounded-xl border-2 p-4 cursor-pointer transition-all flex items-start gap-3', candidateMode === 'EXISTING' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                      <RadioGroupItem value="EXISTING" className="mt-1" />
                      <div>
                        <p className="text-sm font-semibold">Existing Candidate</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Pick from current candidates</p>
                      </div>
                    </label>
                    <label className={cn('rounded-xl border-2 p-4 cursor-pointer transition-all flex items-start gap-3', candidateMode === 'NEW' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                      <RadioGroupItem value="NEW" className="mt-1" />
                      <div>
                        <p className="text-sm font-semibold">New Candidate</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Onboard a new borrower</p>
                      </div>
                    </label>
                  </RadioGroup>

                  {candidateMode === 'EXISTING' ? (
                    <div>
                      <Label htmlFor="existing">Select Candidate</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="existing"
                          list="candidates-list"
                          value={existingCandidate}
                          onChange={(e) => setExistingCandidate(e.target.value)}
                          placeholder="Search name or mobile..."
                          className="pl-9"
                        />
                        <datalist id="candidates-list">
                          {Array.from(new Set(loans.map((l) => l.candidateName))).map((n) => (
                            <option key={n} value={n} />
                          ))}
                        </datalist>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {Array.from(new Set(loans.map((l) => l.candidateName))).slice(0, 6).map((n) => (
                          <button key={n} onClick={() => setExistingCandidate(n)} className={cn('text-xs px-2.5 py-1 rounded-full border transition-all', existingCandidate === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/60')}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="newName">Full Name</Label>
                        <Input id="newName" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Priya Sharma" />
                      </div>
                      <div>
                        <Label htmlFor="newMobile">Mobile Number</Label>
                        <Input id="newMobile" value={newMobile} onChange={(e) => setNewMobile(e.target.value)} placeholder="+91 98200 12345" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Step 2: Loan Amount */}
          {step === 1 && (
            <FadeIn>
              <Card className="shadow-premium">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Loan Amount</CardTitle><CardDescription>Specify principal, currency, and purpose.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <Label htmlFor="amount">Principal Amount (₹)</Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-9" type="text" inputMode="decimal" />
                      </div>
                      {principalPaise > 0 && <p className="text-xs text-muted-foreground mt-1">= {formatPaiseToINR(principalPaise)}</p>}
                    </div>
                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Input id="currency" value="INR" readOnly className="bg-muted/50" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="purpose">Purpose of Loan</Label>
                    <Textarea id="purpose" rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Home renovation, working capital, two-wheeler purchase..." />
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Step 3: Interest */}
          {step === 2 && (
            <FadeIn>
              <Card className="shadow-premium">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Percent className="h-4 w-4" /> Interest Type</CardTitle><CardDescription>Choose how interest is charged.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={interestType} onValueChange={(v) => setInterestType(v as InterestType)} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className={cn('rounded-xl border-2 p-4 cursor-pointer transition-all', interestType === 'PERCENTAGE' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                      <RadioGroupItem value="PERCENTAGE" className="mb-2" />
                      <p className="text-sm font-semibold">Percentage</p>
                      <p className="text-xs text-muted-foreground mt-0.5">% per period (flat)</p>
                    </label>
                    <label className={cn('rounded-xl border-2 p-4 cursor-pointer transition-all', interestType === 'FIXED' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                      <RadioGroupItem value="FIXED" className="mb-2" />
                      <p className="text-sm font-semibold">Fixed Amount</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Total interest in ₹</p>
                    </label>
                    <label className={cn('rounded-xl border-2 p-4 cursor-pointer transition-all', interestType === 'NONE' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                      <RadioGroupItem value="NONE" className="mb-2" />
                      <p className="text-sm font-semibold">No Interest</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Principal-only loan</p>
                    </label>
                  </RadioGroup>

                  {interestType === 'PERCENTAGE' && (
                    <div>
                      <Label htmlFor="rate">Interest Rate (% per period)</Label>
                      <div className="relative">
                        <Input id="rate" value={rateBps} onChange={(e) => setRateBps(e.target.value)} placeholder="18" type="text" inputMode="decimal" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                      {Number(rateBps) > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          = {formatBpsToPercent(Math.round(Number(rateBps) * 100))} bps · Est. interest: {preview ? formatPaiseToINR(Number(preview.totalInterest)) : '—'}
                        </p>
                      )}
                    </div>
                  )}
                  {interestType === 'FIXED' && (
                    <div>
                      <Label htmlFor="fixed">Total Fixed Interest (₹)</Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="fixed" value={fixedInterest} onChange={(e) => setFixedInterest(e.target.value)} placeholder="0.00" className="pl-9" type="text" inputMode="decimal" />
                      </div>
                      {fixedInterestPaise > 0 && <p className="text-xs text-muted-foreground mt-1">= {formatPaiseToINR(fixedInterestPaise)} over {installmentsNum} installments</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Step 4: Frequency */}
          {step === 3 && (
            <FadeIn>
              <Card className="shadow-premium">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Repayment Frequency</CardTitle><CardDescription>Choose how often installments are due.</CardDescription></CardHeader>
                <CardContent>
                  <RadioGroup value={frequency} onValueChange={(v) => setFrequency(v as RepaymentFrequency)} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className={cn('rounded-xl border-2 p-4 cursor-pointer transition-all', frequency === 'DAILY' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                      <RadioGroupItem value="DAILY" className="mb-2" />
                      <p className="text-sm font-semibold">Daily</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Best for short-term small loans</p>
                    </label>
                    <label className={cn('rounded-xl border-2 p-4 cursor-pointer transition-all', frequency === 'WEEKLY' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                      <RadioGroupItem value="WEEKLY" className="mb-2" />
                      <p className="text-sm font-semibold">Weekly</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Popular for vendor loans</p>
                    </label>
                    <label className={cn('rounded-xl border-2 p-4 cursor-pointer transition-all', frequency === 'MONTHLY' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                      <RadioGroupItem value="MONTHLY" className="mb-2" />
                      <p className="text-sm font-semibold">Monthly</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Best for larger loans</p>
                    </label>
                  </RadioGroup>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Step 5: Tenure */}
          {step === 4 && (
            <FadeIn>
              <Card className="shadow-premium">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Coins className="h-4 w-4" /> Tenure & First Due</CardTitle><CardDescription>Number of installments and the first due date.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="installments">Number of Installments</Label>
                      <Input id="installments" value={installments} onChange={(e) => setInstallments(e.target.value)} type="number" min={1} />
                      <p className="text-xs text-muted-foreground mt-1">{frequency.toLowerCase()} schedule</p>
                    </div>
                    <div>
                      <Label htmlFor="firstDue">First Due Date</Label>
                      <Input id="firstDue" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} type="date" />
                      <p className="text-xs text-muted-foreground mt-1">Defaults to {firstDue.toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Step 6: Fees */}
          {step === 5 && (
            <FadeIn>
              <Card className="shadow-premium">
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Fees</CardTitle><CardDescription>Optional processing and other fees — amortized across installments.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="procFee">Processing Fee (₹)</Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="procFee" value={processingFee} onChange={(e) => setProcessingFee(e.target.value)} placeholder="0.00" className="pl-9" type="text" inputMode="decimal" />
                      </div>
                      {processingFeePaise > 0 && <p className="text-xs text-muted-foreground mt-1">= {formatPaiseToINR(processingFeePaise)}</p>}
                    </div>
                    <div>
                      <Label htmlFor="otherFee">Other Fees (₹)</Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="otherFee" value={otherFees} onChange={(e) => setOtherFees(e.target.value)} placeholder="0.00" className="pl-9" type="text" inputMode="decimal" />
                      </div>
                      {otherFeesPaise > 0 && <p className="text-xs text-muted-foreground mt-1">= {formatPaiseToINR(otherFeesPaise)}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Step 7: Preview & Submit */}
          {step === 6 && (
            <FadeIn>
              <Card className="shadow-premium">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" /> Live Schedule Preview</CardTitle>
                  <CardDescription>Generated from BigInt paise using the financial engine. Submit to create an application QR link.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!preview ? (
                    <div className="rounded-xl bg-warning/5 border border-warning/30 p-4 text-sm text-warning">
                      Enter a principal amount in Step 2 to generate the schedule preview.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Stat label="Principal" value={formatPaiseToINR(principalPaise)} />
                        <Stat label="Total Interest" value={formatPaiseToINR(Number(preview.totalInterest))} tint="text-warning" />
                        <Stat label="Total Fees" value={formatPaiseToINR(Number(preview.totalFees))} />
                        <Stat label="Total Repayable" value={formatPaiseToINR(Number(preview.totalRepayable))} tint="text-primary" />
                        <Stat label="Installments" value={String(installmentsNum)} />
                        <Stat label="Installment Amt" value={formatPaiseToINR(Number(preview.installmentAmount))} tint="text-success" />
                        <Stat label="First Due" value={firstDue.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                        <Stat label="Final Due" value={preview.finalDueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">First 3 Installments</p>
                        <div className="rounded-xl border border-border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40">
                                <TableHead className="pl-4">#</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead className="text-right">Principal</TableHead>
                                <TableHead className="text-right">Interest</TableHead>
                                <TableHead className="text-right">Fees</TableHead>
                                <TableHead className="text-right pr-4">Total Due</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {preview.installments.slice(0, 3).map((inst) => (
                                <TableRow key={inst.number}>
                                  <TableCell className="pl-4 font-mono font-semibold">{inst.number}</TableCell>
                                  <TableCell>{inst.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(inst.principal))}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(inst.interest))}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(inst.fees))}</TableCell>
                                  <TableCell className="text-right tabular-nums font-medium pr-4">{formatPaiseToINR(Number(inst.totalDue))}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {preview.installments.length > 3 && (
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            ...and {preview.installments.length - 3} more {preview.installments.length - 3 === 1 ? 'installment' : 'installments'}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={back} disabled={step === 0} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} disabled={!canProceed()} className="gap-1">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={!preview} className="gap-1">
                <Link2 className="h-4 w-4" /> Generate Application Link
              </Button>
            )}
          </div>
        </div>

        {/* Live preview sidebar — always visible */}
        <div className="lg:col-span-1">
          <Card className="shadow-premium lg:sticky lg:top-20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4" /> Live Preview</CardTitle>
              <CardDescription>Updates as you fill the form</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl bg-gradient-fintech text-primary-foreground p-4">
                <p className="text-xs opacity-90">Installment Amount</p>
                <p className="text-2xl font-bold tabular-nums mt-1">
                  {preview ? formatPaiseToINR(Number(preview.installmentAmount)) : '—'}
                </p>
                <p className="text-xs opacity-90 mt-1">
                  {installmentsNum} {frequency.toLowerCase()} installments
                </p>
              </div>
              <div className="space-y-2">
                <Row label="Principal" value={principalPaise > 0 ? formatPaiseToINR(principalPaise) : '—'} />
                <Row label="Interest Type" value={interestType === 'PERCENTAGE' ? 'Percentage' : interestType === 'FIXED' ? 'Fixed' : 'None'} />
                {interestType === 'PERCENTAGE' && Number(rateBps) > 0 && (
                  <Row label="Rate" value={`${rateBps}% (${formatBpsToPercent(Math.round(Number(rateBps) * 100))} bps)`} />
                )}
                {interestType === 'FIXED' && fixedInterestPaise > 0 && (
                  <Row label="Fixed Interest" value={formatPaiseToINR(fixedInterestPaise)} />
                )}
                <Row label="Frequency" value={frequency.charAt(0) + frequency.slice(1).toLowerCase()} />
                <Row label="Installments" value={String(installmentsNum)} />
                {processingFeePaise > 0 && <Row label="Processing Fee" value={formatPaiseToINR(processingFeePaise)} />}
                {otherFeesPaise > 0 && <Row label="Other Fees" value={formatPaiseToINR(otherFeesPaise)} />}
              </div>
              {preview && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <Row label="Total Interest" value={formatPaiseToINR(Number(preview.totalInterest))} bold />
                  <Row label="Total Fees" value={formatPaiseToINR(Number(preview.totalFees))} bold />
                  <Row label="Total Repayable" value={formatPaiseToINR(Number(preview.totalRepayable))} bold tint="text-primary" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-sm font-bold tabular-nums mt-1', tint)}>{value}</p>
    </div>
  )
}

function Row({ label, value, bold, tint }: { label: string; value: string; bold?: boolean; tint?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums', bold ? 'font-semibold' : '', tint)}>{value}</span>
    </div>
  )
}
