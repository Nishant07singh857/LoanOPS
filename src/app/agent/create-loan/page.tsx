'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  UserPlus, User, IndianRupee, Percent, Calendar, Coins, FileText,
  CheckCircle2, Link2, Calculator, QrCode
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FadeIn } from '@/components/ui/motion'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { generateSchedulePreview, calculateInstallmentsFromTenure, type ScheduleInput, type InterestType, type RepaymentFrequency } from '@/lib/financial-engine'
import { QRCodeSVG } from 'qrcode.react'
import { formatPaiseToINR, formatBpsToPercent, parseDisplayPaise } from '@/lib/money'
import { cn } from '@/lib/utils'

interface CandidateRow {
  id: string
  fullName: string
  mobile: string
}

export default function CreateLoanPage() {
  const router = useRouter()
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
  const [tenureMonths, setTenureMonths] = React.useState('12')
  const [firstDueDate, setFirstDueDate] = React.useState('')
  const [processingFee, setProcessingFee] = React.useState('')
  const [otherFees, setOtherFees] = React.useState('')

  const [generatedLink, setGeneratedLink] = React.useState<{ publicUrl: string; token: string } | null>(null)

  // Calculate installments based on tenure in months and frequency
  const getCalculatedInstallments = () => {
    const months = parseInt(tenureMonths, 10) || 0
    if (months <= 0) return 0
    return calculateInstallmentsFromTenure(months, frequency)
  }

  const installmentsNum = getCalculatedInstallments()

  // Build ScheduleInput for preview
  const principalPaise = parseDisplayPaise(amount || '0')
  const interestRateBps = BigInt(Math.round((Number(rateBps) || 0) * 100))
  const fixedInterestPaise = parseDisplayPaise(fixedInterest || '0')
  const processingFeePaise = parseDisplayPaise(processingFee || '0')
  const otherFeesPaise = parseDisplayPaise(otherFees || '0')
  const firstDue = firstDueDate ? new Date(firstDueDate) : (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d })()

  const scheduleInput: ScheduleInput = {
    principalPaise: BigInt(principalPaise),
    interestType,
    interestRateBps,
    fixedInterestPaise: BigInt(fixedInterestPaise),
    frequency,
    installments: Math.max(1, installmentsNum),
    firstDueDate: firstDue,
    processingFeePaise: BigInt(processingFeePaise),
    otherFeesPaise: BigInt(otherFeesPaise),
  }

  const preview = React.useMemo(() => {
    if (principalPaise <= 0 || installmentsNum <= 0) return null
    try { return generateSchedulePreview(scheduleInput) } catch { return null }
  }, [principalPaise, interestType, interestRateBps, fixedInterestPaise, frequency, installmentsNum, firstDue, processingFeePaise, otherFeesPaise])

  const { data: candidatesData, isLoading: candidatesLoading, isError: candidatesError, refetch: refetchCandidates } = useQuery({
    queryKey: ['agent-candidates-create-loan'],
    queryFn: () => api.get<{ items: CandidateRow[] }>('/api/agent/candidates?pageSize=100'),
  })
  const candidates = candidatesData?.items ?? []

  const createMutation = useMutation({
    mutationFn: () => {
      if (candidateMode === 'EXISTING') {
        const c = candidates.find((c) => c.id === existingCandidate)
        if (!c) throw new Error('Candidate not found')
        
        return api.post<{ id: string; applicationNumber: string }>('/api/agent/applications', {
          candidateId: c.id,
          principalAmount: String(principalPaise),
          purpose: purpose,
          interestType: interestType,
          interestRate: interestType === 'PERCENTAGE' ? Number(interestRateBps) : undefined,
          fixedInterest: interestType === 'FIXED' ? String(fixedInterestPaise) : undefined,
          frequency: frequency,
          tenureCount: parseInt(tenureMonths, 10) || 1,
          installments: Math.max(1, installmentsNum),
          firstDueDate: firstDue.toISOString(),
          processingFee: processingFeePaise > 0 ? String(processingFeePaise) : undefined,
          otherFees: otherFeesPaise > 0 ? String(otherFeesPaise) : undefined,
        })
      } else {
        return api.post<{ id: string; token: string; publicUrl: string }>('/api/agent/qr-links', {
          preFullName: newName,
          preMobile: newMobile,
          prePrincipal: String(principalPaise),
          prePurpose: purpose,
          preInterestType: interestType,
          preInterestRate: interestType === 'PERCENTAGE' ? Number(interestRateBps) : undefined,
          preFixedInterest: interestType === 'FIXED' ? String(fixedInterestPaise) : undefined,
          preFrequency: frequency,
          preTenureMonths: parseInt(tenureMonths, 10) || undefined,
          preInstallments: Math.max(1, installmentsNum),
          processingFee: processingFeePaise > 0 ? String(processingFeePaise) : undefined,
          otherFees: otherFeesPaise > 0 ? String(otherFeesPaise) : undefined,
        })
      }
    },
    onSuccess: (res: any) => {
      if (candidateMode === 'EXISTING') {
        toast.success('Application offer created — the borrower can view it in their portal.')
        setCandidateMode('NEW')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setGeneratedLink(res)
        toast.success('QR Link Generated!')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    onError: (e: Error) => toast.error('Failed to create application', { description: e.message }),
  })

  const canSubmit = () => {
    if (candidateMode === 'EXISTING' && !existingCandidate) return false
    if (candidateMode === 'NEW' && (!newName || !newMobile)) return false
    if (principalPaise <= 0 || !purpose) return false
    if (interestType === 'PERCENTAGE' && Number(rateBps) < 0) return false
    if (interestType === 'FIXED' && fixedInterestPaise < 0) return false
    if (!frequency || installmentsNum <= 0) return false
    return true
  }

  const submit = () => {
    if (!canSubmit()) {
      toast.error('Please fill in all required fields.')
      return
    }
    createMutation.mutate()
  }

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        title="Create Loan Application"
        description="Fill the form to generate an application QR link for a borrower."
        icon={<UserPlus className="h-5 w-5" />}
      />

      {generatedLink && (
        <FadeIn>
          <Card className="shadow-premium border-success/50 bg-success/5">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-xl flex justify-center items-center gap-2 text-success">
                <CheckCircle2 className="h-6 w-6" /> Success! Link Generated
              </CardTitle>
              <CardDescription>Share this QR code or link with the borrower to proceed.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <div className="bg-white p-4 rounded-xl shadow-sm inline-block">
                <QRCodeSVG value={window.location.origin + generatedLink.publicUrl} size={192} />
              </div>
              <div className="flex items-center gap-2 max-w-md w-full bg-background p-2 rounded-lg border">
                <Input readOnly value={window.location.origin + generatedLink.publicUrl} className="flex-1 bg-transparent border-none" />
                <Button variant="secondary" onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + generatedLink.publicUrl)
                  toast.success('Link copied to clipboard')
                }}>Copy</Button>
              </div>
              <div className="flex flex-wrap gap-3 pt-4">
                <Button variant="outline" onClick={() => setGeneratedLink(null)}>Create Another</Button>
                <Button onClick={() => router.push('/agent/candidates')}>Go to Candidates</Button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Candidate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={candidateMode} onValueChange={(v) => setCandidateMode(v as any)} className="grid grid-cols-2 gap-2 sm:gap-3">
                <label className={cn('rounded-xl border-2 px-2 py-3 sm:p-4 cursor-pointer transition-all flex items-center sm:items-start gap-1.5 sm:gap-3 overflow-hidden', candidateMode === 'EXISTING' ? 'border-primary bg-primary/5' : 'border-border')}>
                  <RadioGroupItem value="EXISTING" className="shrink-0 mt-0 sm:mt-1 scale-90 sm:scale-100" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold truncate">Existing Candidate</p>
                  </div>
                </label>
                <label className={cn('rounded-xl border-2 px-2 py-3 sm:p-4 cursor-pointer transition-all flex items-center sm:items-start gap-1.5 sm:gap-3 overflow-hidden', candidateMode === 'NEW' ? 'border-primary bg-primary/5' : 'border-border')}>
                  <RadioGroupItem value="NEW" className="shrink-0 mt-0 sm:mt-1 scale-90 sm:scale-100" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold truncate">New Candidate</p>
                  </div>
                </label>
              </RadioGroup>

              {candidateMode === 'EXISTING' ? (
                <div>
                  <Label htmlFor="existing" className="relative z-10 bg-card px-1 -ml-1 w-fit">Select Candidate</Label>
                  <Select value={existingCandidate} onValueChange={setExistingCandidate}>
                    <SelectTrigger id="existing" className="w-full">
                      <SelectValue placeholder="Select candidate by name or mobile..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {candidates.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.fullName} ({c.mobile})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {candidatesError ? (
                    <div className="mt-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-destructive">Could not load candidates. The list below may be empty because the request failed — not because no candidates exist.</p>
                      <Button type="button" size="sm" variant="outline" onClick={() => refetchCandidates()}>Retry</Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      {candidatesLoading ? 'Loading candidates…' : `Matching from ${candidates.length} registered candidates`}
                    </p>
                  )}
                </div>
              ) : (

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label htmlFor="newName">Full Name</Label><Input id="newName" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
                  <div><Label htmlFor="newMobile">Mobile Number</Label><Input id="newMobile" value={newMobile} onChange={(e) => setNewMobile(e.target.value)} /></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Loan Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="amount">Principal Amount (₹)</Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-9" type="text" inputMode="decimal" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="purpose">Purpose</Label>
                  <Input id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Home renovation" />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-border">
                <Label>Interest Type</Label>
                <RadioGroup value={interestType} onValueChange={(v) => setInterestType(v as InterestType)} className="grid grid-cols-3 gap-1.5 sm:gap-3">
                  <label className={cn('rounded-xl border-2 px-1 py-2 sm:p-3 cursor-pointer transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3', interestType === 'PERCENTAGE' ? 'border-primary bg-primary/5' : 'border-border')}>
                    <RadioGroupItem value="PERCENTAGE" className="shrink-0 scale-75 sm:scale-100" />
                    <span className="text-[10px] sm:text-sm font-semibold truncate">Percentage</span>
                  </label>
                  <label className={cn('rounded-xl border-2 px-1 py-2 sm:p-3 cursor-pointer transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3', interestType === 'FIXED' ? 'border-primary bg-primary/5' : 'border-border')}>
                    <RadioGroupItem value="FIXED" className="shrink-0 scale-75 sm:scale-100" />
                    <span className="text-[10px] sm:text-sm font-semibold truncate">Fixed</span>
                  </label>
                  <label className={cn('rounded-xl border-2 px-1 py-2 sm:p-3 cursor-pointer transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3', interestType === 'NONE' ? 'border-primary bg-primary/5' : 'border-border')}>
                    <RadioGroupItem value="NONE" className="shrink-0 scale-75 sm:scale-100" />
                    <span className="text-[10px] sm:text-sm font-semibold truncate">None</span>
                  </label>
                </RadioGroup>

                {interestType === 'PERCENTAGE' && (
                  <div className="mt-2">
                    <Label htmlFor="rate">Interest Rate (% per period)</Label>
                    <div className="relative mt-1.5">
                      <Input id="rate" value={rateBps} onChange={(e) => setRateBps(e.target.value)} placeholder="18" type="text" inputMode="decimal" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </div>
                )}
                {interestType === 'FIXED' && (
                  <div className="mt-2">
                    <Label htmlFor="fixed">Total Fixed Interest (₹)</Label>
                    <div className="relative mt-1.5">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="fixed" value={fixedInterest} onChange={(e) => setFixedInterest(e.target.value)} placeholder="0.00" className="pl-9" type="text" inputMode="decimal" />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t border-border">
                <Label>Repayment Frequency</Label>
                <RadioGroup value={frequency} onValueChange={(v) => setFrequency(v as RepaymentFrequency)} className="grid grid-cols-3 gap-1.5 sm:gap-3">
                  <label className={cn('rounded-xl border-2 px-1 py-2 sm:p-3 cursor-pointer transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3', frequency === 'DAILY' ? 'border-primary bg-primary/5' : 'border-border')}>
                    <RadioGroupItem value="DAILY" className="shrink-0 scale-75 sm:scale-100" />
                    <span className="text-[10px] sm:text-sm font-semibold truncate">Daily</span>
                  </label>
                  <label className={cn('rounded-xl border-2 px-1 py-2 sm:p-3 cursor-pointer transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3', frequency === 'WEEKLY' ? 'border-primary bg-primary/5' : 'border-border')}>
                    <RadioGroupItem value="WEEKLY" className="shrink-0 scale-75 sm:scale-100" />
                    <span className="text-[10px] sm:text-sm font-semibold truncate">Weekly</span>
                  </label>
                  <label className={cn('rounded-xl border-2 px-1 py-2 sm:p-3 cursor-pointer transition-all flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3', frequency === 'MONTHLY' ? 'border-primary bg-primary/5' : 'border-border')}>
                    <RadioGroupItem value="MONTHLY" className="shrink-0 scale-75 sm:scale-100" />
                    <span className="text-[10px] sm:text-sm font-semibold truncate">Monthly</span>
                  </label>
                </RadioGroup>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label htmlFor="tenure">Tenure in Months</Label>
                    <Input id="tenure" value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} type="number" min={1} />
                    <p className="text-xs text-muted-foreground mt-1">Calculates to {installmentsNum} {frequency.toLowerCase()} installments</p>
                  </div>
                  <div>
                    <Label htmlFor="firstDue">First Due Date</Label>
                    <Input id="firstDue" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} type="date" />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-border">
                <Label>Fees</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="procFee">Processing Fee (₹)</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="procFee" value={processingFee} onChange={(e) => setProcessingFee(e.target.value)} placeholder="0.00" className="pl-9" type="text" inputMode="decimal" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="otherFee">Other Fees (₹)</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="otherFee" value={otherFees} onChange={(e) => setOtherFees(e.target.value)} placeholder="0.00" className="pl-9" type="text" inputMode="decimal" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          <div className="p-6 pt-0">
            <Button onClick={submit} disabled={!preview || createMutation.isPending} className="w-full h-12 text-lg gap-2 bg-gradient-fintech text-primary-foreground shadow-glow border-none hover:opacity-90 transition-opacity">
              {createMutation.isPending ? (
                <><span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> {candidateMode === 'EXISTING' ? 'Sending Offer...' : 'Generating...'}</>
              ) : candidateMode === 'EXISTING' ? (
                <><UserPlus className="h-5 w-5" /> Send Offer to Borrower</>
              ) : (
                <><QrCode className="h-5 w-5" /> Generate QR Link</>
              )}
            </Button>
          </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="shadow-premium lg:sticky lg:top-20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4" /> Live Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={cn("rounded-xl p-4 transition-all duration-300", preview ? "bg-gradient-fintech text-primary-foreground shadow-glow" : "bg-muted border border-border text-muted-foreground")}>
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
                <Row label="Frequency" value={frequency.charAt(0) + frequency.slice(1).toLowerCase()} />
                <Row label="Installments" value={String(installmentsNum)} />
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

function Row({ label, value, bold, tint }: { label: string; value: string; bold?: boolean; tint?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums', bold ? 'font-semibold' : '', tint)}>{value}</span>
    </div>
  )
}
