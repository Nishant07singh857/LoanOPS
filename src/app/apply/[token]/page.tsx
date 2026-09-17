'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet, ArrowRight, ArrowLeft, CheckCircle2, User, Mail, Phone,
  MapPin, IdCard, FileText, Briefcase, Building2, Banknote,
  ShieldCheck, PenLine, Upload, Sparkles, Star, Lock,
  IndianRupee, CalendarClock, Eraser, PartyPopper, Home, CreditCard,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { api, ApiRequestError } from '@/lib/api-client'
import { generateSchedulePreview, type InterestType, type RepaymentFrequency } from '@/lib/financial-engine'
import { formatPaiseToINR, parseDisplayPaise } from '@/lib/money'
import { cn } from '@/lib/utils'

interface ApplyPreConfig {
  principalAmount: string
  interestType: InterestType
  interestRate: number | null
  fixedInterest: string | null
  frequency: RepaymentFrequency
  installments: number
  purpose?: string | null
}

interface ApplyData {
  organizationName: string
  preConfig: ApplyPreConfig | null
  agreement: {
    id: string
    name: string
    version: string
    body: string
  } | null
}

const VALUE_PROPS = [
  { icon: <ShieldCheck className="h-5 w-5" />, title: 'Bank-grade security', desc: '256-bit encryption · ISO 27001' },
  { icon: <Sparkles className="h-5 w-5" />, title: 'Quick decisions', desc: 'Approval in under 24 hours' },
  { icon: <Lock className="h-5 w-5" />, title: 'Paperless', desc: 'Aadhaar-based e-KYC · No physical docs' },
  { icon: <Star className="h-5 w-5" />, title: 'Trusted by 1L+ Indians', desc: '4.8★ rating on Play Store' },
]

const TESTIMONIAL = {
  quote: 'I got my loan in 18 hours — completely paperless. The team was kind and patient throughout.',
  author: 'Rahul Verma',
  location: 'Mumbai · ₹75,000 loan',
}

type StepKey = 'welcome' | 'loan' | 'personal' | 'kyc' | 'financial' | 'bank' | 'documents' | 'agreement' | 'review' | 'success'

const STEPS: { key: StepKey; label: string; icon: React.ReactNode }[] = [
  { key: 'welcome', label: 'Welcome', icon: <Sparkles className="h-4 w-4" /> },
  { key: 'loan', label: 'Loan', icon: <IndianRupee className="h-4 w-4" /> },
  { key: 'personal', label: 'Personal', icon: <User className="h-4 w-4" /> },
  { key: 'kyc', label: 'KYC', icon: <IdCard className="h-4 w-4" /> },
  { key: 'financial', label: 'Financial', icon: <Briefcase className="h-4 w-4" /> },
  { key: 'bank', label: 'Bank', icon: <Building2 className="h-4 w-4" /> },
  { key: 'documents', label: 'Documents', icon: <FileText className="h-4 w-4" /> },
  { key: 'agreement', label: 'Agreement', icon: <PenLine className="h-4 w-4" /> },
  { key: 'review', label: 'Review', icon: <CheckCircle2 className="h-4 w-4" /> },
]

interface FormState {
  principal: string
  frequency: RepaymentFrequency
  installments: string
  interestType: InterestType
  rateBps: string
  fixedInterest: string
  firstDueDate: string
  processingFee: string
  fullName: string
  mobile: string
  email: string
  dob: string
  address: string
  aadhaar: string
  pan: string
  occupation: string
  employer: string
  monthlyIncome: string
  existingObligations: string
  bankName: string
  accountNumber: string
  ifsc: string
  upiId: string
  agreedToTerms: boolean
  signature: string | null
}

const INITIAL_FORM: FormState = {
  principal: '',
  frequency: 'WEEKLY',
  installments: '12',
  interestType: 'PERCENTAGE',
  rateBps: '18',
  fixedInterest: '',
  firstDueDate: '',
  processingFee: '500',
  fullName: '',
  mobile: '',
  email: '',
  dob: '',
  address: '',
  aadhaar: '',
  pan: '',
  occupation: 'Salaried',
  employer: '',
  monthlyIncome: '',
  existingObligations: '0',
  bankName: '',
  accountNumber: '',
  ifsc: '',
  upiId: '',
  agreedToTerms: false,
  signature: null,
}

const DOCUMENT_LIST = [
  { key: 'aadhaar', label: 'Aadhaar Card', icon: <IdCard className="h-5 w-5" />, required: true },
  { key: 'pan', label: 'PAN Card', icon: <FileText className="h-5 w-5" />, required: true },
  { key: 'address', label: 'Address Proof', icon: <MapPin className="h-5 w-5" />, required: true },
  { key: 'income', label: 'Income Proof', icon: <Banknote className="h-5 w-5" />, required: true },
  { key: 'bank', label: 'Bank Proof', icon: <Building2 className="h-5 w-5" />, required: false },
  { key: 'business', label: 'Business Proof', icon: <Briefcase className="h-5 w-5" />, required: false },
]

export default function ApplyPage() {
  const params = useParams<{ token: string }>()
  const token = params.token as string
  const router = useRouter()

  // Fetch the apply link config + agreement from the public API
  const { data: applyData, isLoading: applyLoading, error: applyError } = useQuery<ApplyData>({
    queryKey: ['apply', token],
    queryFn: () => api.get<ApplyData>(`/api/apply/${token}`),
    retry: false,
  })

  const preConfig = applyData?.preConfig ?? null
  const activeAgreement = applyData?.agreement ?? null

  const [step, setStep] = React.useState<number>(0)
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM)
  const [appNumber, setAppNumber] = React.useState<string>('')

  // Once preConfig is loaded, pre-fill the loan form
  React.useEffect(() => {
    if (preConfig) {
      setForm((prev) => ({
        ...prev,
        principal: String(Number(preConfig.principalAmount) / 100),
        frequency: preConfig.frequency,
        installments: String(preConfig.installments),
        interestType: preConfig.interestType,
        rateBps: preConfig.interestRate ? String(preConfig.interestRate / 100) : prev.rateBps,
        fixedInterest: preConfig.fixedInterest ? String(Number(preConfig.fixedInterest) / 100) : prev.fixedInterest,
      }))
    }
  }, [preConfig])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const preview = React.useMemo(() => {
    const principalPaise = parseDisplayPaise(form.principal || '0')
    if (principalPaise <= 0) return null
    const interestRateBps = BigInt(Math.round((Number(form.rateBps) || 0) * 100))
    const fixedInterestPaise = parseDisplayPaise(form.fixedInterest || '0')
    const processingFeePaise = parseDisplayPaise(form.processingFee || '0')
    const installmentsNum = Math.max(1, parseInt(form.installments || '12', 10) || 1)
    const firstDue = form.firstDueDate ? new Date(form.firstDueDate) : (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d })()
    try {
      return generateSchedulePreview({
        principalPaise: BigInt(principalPaise),
        interestType: form.interestType,
        interestRateBps,
        fixedInterestPaise: BigInt(fixedInterestPaise),
        frequency: form.frequency,
        installments: installmentsNum,
        firstDueDate: firstDue,
        processingFeePaise: BigInt(processingFeePaise),
        otherFeesPaise: BigInt(0),
      })
    } catch {
      return null
    }
  }, [form.principal, form.interestType, form.rateBps, form.fixedInterest, form.frequency, form.installments, form.firstDueDate, form.processingFee])

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))

  const validateStep = (s: number): boolean => {
    if (s === 1) {
      if (parseDisplayPaise(form.principal || '0') <= 0) {
        toast.error('Enter a valid loan amount')
        return false
      }
      return true
    }
    if (s === 2) {
      if (!form.fullName.trim()) { toast.error('Enter your full name'); return false }
      if (!form.mobile.trim() || form.mobile.replace(/\D/g, '').length < 10) { toast.error('Enter a valid mobile number'); return false }
      if (!form.email.trim() || !form.email.includes('@')) { toast.error('Enter a valid email'); return false }
      if (!form.dob.trim()) { toast.error('Enter your date of birth'); return false }
      if (!form.address.trim()) { toast.error('Enter your address'); return false }
      return true
    }
    if (s === 3) {
      if (form.aadhaar.replace(/\s/g, '').length < 12) { toast.error('Enter a valid 12-digit Aadhaar'); return false }
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan.toUpperCase())) { toast.error('Enter a valid PAN (format AAAAA9999A)'); return false }
      return true
    }
    if (s === 4) {
      if (!form.occupation.trim()) { toast.error('Select your occupation'); return false }
      if (!form.employer.trim()) { toast.error('Enter your employer'); return false }
      if (parseDisplayPaise(form.monthlyIncome || '0') <= 0) { toast.error('Enter your monthly income'); return false }
      return true
    }
    if (s === 5) {
      if (!form.bankName.trim()) { toast.error('Enter your bank name'); return false }
      if (!form.accountNumber.trim()) { toast.error('Enter your account number'); return false }
      if (!form.ifsc.trim() || form.ifsc.length < 8) { toast.error('Enter a valid IFSC code'); return false }
      return true
    }
    if (s === 7) {
      if (!form.agreedToTerms) { toast.error('Please accept the agreement to continue'); return false }
      if (!form.signature) { toast.error('Please sign to complete the agreement'); return false }
      return true
    }
    return true
  }

  const tryNext = () => {
    if (validateStep(step)) next()
  }

  const submitMutation = useMutation({
    mutationFn: () => {
      const principalPaise = String(parseDisplayPaise(form.principal || '0'))
      const firstDue = form.firstDueDate
        ? new Date(form.firstDueDate)
        : (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d })()
      const payload: Record<string, unknown> = {
        // Personal
        fullName: form.fullName.trim(),
        mobile: form.mobile.replace(/\D/g, ''),
        email: form.email.trim() || undefined,
        dob: form.dob ? new Date(form.dob).toISOString() : undefined,
        address: form.address.trim() || undefined,
        // KYC
        aadhaarMasked: form.aadhaar.replace(/\s/g, '') || undefined,
        panMasked: form.pan.toUpperCase() || undefined,
        // Financial
        occupation: form.occupation || undefined,
        employer: form.employer.trim() || undefined,
        monthlyIncome: String(parseDisplayPaise(form.monthlyIncome || '0')) || undefined,
        existingObligations: String(parseDisplayPaise(form.existingObligations || '0')) || undefined,
        // Bank
        bankName: form.bankName.trim() || undefined,
        bankAccount: form.accountNumber.trim() || undefined,
        bankIfsc: form.ifsc.trim() || undefined,
        upiId: form.upiId.trim() || undefined,
        // Loan
        principalAmount: principalPaise,
        purpose: preConfig?.purpose || 'Personal loan application',
        interestType: form.interestType,
        interestRate: form.interestType === 'PERCENTAGE' ? Math.round((Number(form.rateBps) || 0) * 100) : undefined,
        fixedInterest: form.interestType === 'FIXED' ? String(parseDisplayPaise(form.fixedInterest || '0')) : undefined,
        frequency: form.frequency,
        installments: parseInt(form.installments || '12', 10) || 12,
        firstDueDate: firstDue.toISOString(),
        processingFee: String(parseDisplayPaise(form.processingFee || '0')),
        otherFees: '0',
        // Agreement
        agreementTemplateId: activeAgreement?.id,
        agreementVersion: activeAgreement?.version,
        agreementAccepted: form.agreedToTerms,
      }
      return api.post<{ applicationNumber: string }>(`/api/apply/${token}`, payload)
    },
    onSuccess: (data) => {
      setAppNumber(data.applicationNumber)
      toast.success('Application submitted successfully', { description: 'We\'ll review and respond within 24 hours.' })
      setStep(9)
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.message : 'Submission failed'
      toast.error('Submission failed', { description: message })
    },
  })

  const submit = () => {
    if (!validateStep(8)) return
    submitMutation.mutate()
  }

  if (step === 9) {
    return <SuccessView appNumber={appNumber || 'APP-'} onHome={() => router.push('/portal')} />
  }

  // Loading state: fetch apply link
  if (applyLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="h-12 w-12 rounded-2xl bg-success/15 text-success flex items-center justify-center mx-auto mb-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <p className="text-sm font-medium">Loading your application…</p>
          <p className="text-xs text-muted-foreground mt-1">Verifying your secure link</p>
          <Skeleton className="h-2 w-48 mx-auto mt-6 rounded-full" />
        </div>
      </div>
    )
  }

  // Error state: invalid/expired/used link
  if (applyError || (!applyData && !applyLoading)) {
    const err = applyError instanceof ApiRequestError ? applyError.message : 'This application link is no longer valid.'
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="h-14 w-14 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center mx-auto mb-4">
            <Wallet className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold mb-2">Application link unavailable</h1>
          <p className="text-sm text-muted-foreground mb-6">{err}</p>
          <Button asChild variant="outline">
            <Link href="/"><Home className="h-4 w-4" /> Return Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  const currentStepKey = STEPS[step]?.key
  const showProgressBar = step > 0 && step < STEPS.length

  return (
    <div className="min-h-screen bg-background">
      <div className="grid lg:grid-cols-[1fr_1.2fr] min-h-screen">
        {/* Left hero panel (lg+ only) */}
        <aside className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-success/15 via-primary/5 to-info/10 p-8 sticky top-0 h-screen overflow-y-auto">
          <div>
            <div className="flex items-center gap-2.5 mb-12">
              <div className="h-11 w-11 rounded-2xl bg-success text-success-foreground flex items-center justify-center shadow-glow">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold tracking-tight leading-none text-lg">Sterling Lending</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Premium Lending · RBI Registered</p>
              </div>
            </div>
            <h1 className="text-3xl xl:text-4xl font-bold tracking-tight leading-tight">
              Your loan journey<br />
              starts <span className="text-success">here.</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-4 max-w-md">
              Apply in minutes, get approved in hours. Completely paperless, completely safe.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-8">
              {VALUE_PROPS.map((v) => (
                <div key={v.title} className="rounded-2xl bg-card/80 backdrop-blur border border-border p-3">
                  <div className="h-9 w-9 rounded-xl bg-success/15 text-success flex items-center justify-center mb-2.5">
                    {v.icon}
                  </div>
                  <p className="text-sm font-medium">{v.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-card/80 backdrop-blur border border-border p-4 mt-8">
            <div className="flex items-start gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-warning/15 text-warning flex items-center justify-center flex-shrink-0">
                <Star className="h-4 w-4 fill-current" />
              </div>
              <div>
                <p className="text-sm italic text-muted-foreground leading-relaxed">"{TESTIMONIAL.quote}"</p>
                <p className="text-xs font-medium mt-2">— {TESTIMONIAL.author}, {TESTIMONIAL.location}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Right form panel */}
        <main className="flex flex-col min-h-screen">
          {/* Mobile header */}
          <header className="lg:hidden sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border">
            <div className="flex items-center justify-between gap-2 h-14 px-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-success text-success-foreground flex items-center justify-center">
                  <Wallet className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm">Sterling Lending</span>
              </div>
              {step > 0 && step < 9 && (
                <span className="text-xs text-muted-foreground">Step {step} of {STEPS.length - 1}</span>
              )}
            </div>
            {showProgressBar && (
              <div className="h-1 bg-muted">
                <motion.div
                  className="h-full bg-success"
                  initial={{ width: 0 }}
                  animate={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            )}
          </header>

          {/* Desktop progress bar */}
          {showProgressBar && (
            <div className="hidden lg:block sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border px-8 py-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Step {step} of {STEPS.length - 1}</p>
                <p className="text-xs text-muted-foreground">{STEPS[step]?.label}</p>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-success rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
              <ol className="flex items-center gap-1 mt-3 overflow-x-auto no-scrollbar">
                {STEPS.slice(1).map((s, i) => {
                  const realIdx = i + 1
                  const done = realIdx < step
                  const active = realIdx === step
                  return (
                    <li key={s.key} className="flex-shrink-0">
                      <button
                        onClick={() => realIdx <= step && setStep(realIdx)}
                        disabled={realIdx > step}
                        className={cn(
                          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                          active ? 'bg-success text-success-foreground shadow-glow' :
                          done ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground cursor-not-allowed'
                        )}
                      >
                        <span className={cn('h-5 w-5 rounded-md flex items-center justify-center', active ? 'bg-success-foreground/15' : done ? 'bg-success/15' : 'bg-background')}>
                          {done ? <CheckCircle2 className="h-3 w-3" /> : s.icon}
                        </span>
                        <span className="hidden xl:inline">{s.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          {/* Step content */}
          <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
            <div className="flex-1 max-w-2xl mx-auto w-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStepKey}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  {step === 0 && <WelcomeStep preConfig={preConfig} />}
                  {step === 1 && <LoanInfoStep form={form} update={update} preview={preview} preConfig={preConfig} />}
                  {step === 2 && <PersonalStep form={form} update={update} />}
                  {step === 3 && <KycStep form={form} update={update} />}
                  {step === 4 && <FinancialStep form={form} update={update} />}
                  {step === 5 && <BankStep form={form} update={update} />}
                  {step === 6 && <DocumentsStep />}
                  {step === 7 && (
                    <AgreementStep
                      form={form}
                      update={update}
                      agreementBody={activeAgreement?.body ?? ''}
                      agreementName={activeAgreement?.name ?? 'Loan Agreement'}
                      agreementVersion={activeAgreement?.version ?? '1.0'}
                    />
                  )}
                  {step === 8 && (
                    <ReviewStep form={form} preview={preview} submitLoading={submitMutation.isPending} onSubmit={submit} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom navigation */}
            {step > 0 && step < 9 && (
              <div className="sticky bottom-0 left-0 right-0 bg-background/85 backdrop-blur-xl border-t border-border px-4 sm:px-6 lg:px-8 py-3 lg:py-4 mt-6">
                <div className="max-w-2xl mx-auto w-full flex items-center gap-3">
                  <Button variant="outline" onClick={back} className="min-h-[44px]" disabled={submitMutation.isPending}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <div className="flex-1" />
                  {step < 8 ? (
                    <Button onClick={tryNext} className="min-h-[44px] min-w-[120px]">
                      Next <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={submit} className="min-h-[44px] min-w-[160px] bg-success hover:bg-success/90" disabled={submitMutation.isPending}>
                      {submitMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><CheckCircle2 className="h-4 w-4" /> Submit Application</>}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {step === 0 && (
              <div className="sticky bottom-0 left-0 right-0 bg-background/85 backdrop-blur-xl border-t border-border px-4 sm:px-6 lg:px-8 py-3 lg:py-4 mt-6">
                <div className="max-w-2xl mx-auto w-full">
                  <Button onClick={next} size="lg" className="w-full min-h-[48px] bg-success hover:bg-success/90">
                    Begin Application <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function StepHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <div className="h-11 w-11 rounded-2xl bg-success/15 text-success flex items-center justify-center mb-4">
        {icon}
      </div>
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
    </div>
  )
}

function WelcomeStep({ preConfig }: { preConfig: ApplyPreConfig | null }) {
  return (
    <div>
      <StepHeader
        icon={<Sparkles className="h-5 w-5" />}
        title="Welcome to Sterling Lending"
        subtitle="You're a few steps away from your loan. Let's get started."
      />

      {preConfig && (
        <div className="rounded-2xl border border-success/30 bg-success/5 p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-success/15 text-success flex items-center justify-center">
              <IndianRupee className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold text-success">Your Pre-Approved Offer</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Principal</p>
              <p className="text-lg font-bold mt-1 tabular-nums">{formatPaiseToINR(Number(preConfig.principalAmount))}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Frequency</p>
              <p className="text-lg font-bold mt-1">{preConfig.frequency.charAt(0) + preConfig.frequency.slice(1).toLowerCase()}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Installments</p>
              <p className="text-lg font-bold mt-1">{preConfig.installments}</p>
            </div>
          </div>
        </div>
      )}

      <div className="lg:hidden grid grid-cols-2 gap-3 mb-5">
        {VALUE_PROPS.map((v) => (
          <div key={v.title} className="rounded-xl bg-muted/40 border border-border p-3">
            <div className="h-8 w-8 rounded-lg bg-success/15 text-success flex items-center justify-center mb-2">
              {v.icon}
            </div>
            <p className="text-xs font-medium">{v.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{v.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-info/5 border border-info/15 p-4 flex items-start gap-3 mb-4">
        <ShieldCheck className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-info">Safe & secure</p>
          <p className="text-xs text-muted-foreground mt-1">Your data is encrypted with bank-grade security. We never share your information with third parties.</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        By continuing, you agree to receive loan-related communications from Sterling Lending. You can opt out any time.
      </p>
    </div>
  )
}

function LoanInfoStep({ form, update, preview, preConfig }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void; preview: any; preConfig: ApplyPreConfig | null }) {
  return (
    <div>
      <StepHeader
        icon={<IndianRupee className="h-5 w-5" />}
        title="Loan Information"
        subtitle={preConfig ? "Review your pre-configured loan terms. Tap to adjust if needed." : "Tell us how much you need and how you'd like to repay."}
      />

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Label htmlFor="principal">Principal Amount (₹)</Label>
            <div className="relative mt-1.5">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="principal"
                value={form.principal}
                onChange={(e) => update('principal', e.target.value)}
                placeholder="0.00"
                className="pl-9"
                inputMode="decimal"
              />
            </div>
            {parseDisplayPaise(form.principal) > 0 && <p className="text-xs text-muted-foreground mt-1">= {formatPaiseToINR(parseDisplayPaise(form.principal))}</p>}
          </div>
          <div>
            <Label htmlFor="installments">Installments</Label>
            <Input
              id="installments"
              value={form.installments}
              onChange={(e) => update('installments', e.target.value)}
              placeholder="12"
              className="mt-1.5"
              inputMode="numeric"
            />
          </div>
        </div>

        <div>
          <Label>Frequency</Label>
          <RadioGroup
            value={form.frequency}
            onValueChange={(v) => update('frequency', v as RepaymentFrequency)}
            className="grid grid-cols-3 gap-2 mt-1.5"
          >
            {[
              { key: 'DAILY' as const, label: 'Daily', icon: <CalendarClock className="h-4 w-4" /> },
              { key: 'WEEKLY' as const, label: 'Weekly', icon: <CalendarClock className="h-4 w-4" /> },
              { key: 'MONTHLY' as const, label: 'Monthly', icon: <CalendarClock className="h-4 w-4" /> },
            ].map((f) => (
              <label
                key={f.key}
                className={cn(
                  'rounded-xl border-2 p-3 cursor-pointer transition-all flex flex-col items-center gap-1.5 text-center',
                  form.frequency === f.key ? 'border-success bg-success/5' : 'border-border hover:border-success/40'
                )}
              >
                <RadioGroupItem value={f.key} className="sr-only" />
                <span className={cn('h-8 w-8 rounded-lg flex items-center justify-center', form.frequency === f.key ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                  {f.icon}
                </span>
                <span className="text-sm font-medium">{f.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div>
          <Label>Interest Type</Label>
          <RadioGroup
            value={form.interestType}
            onValueChange={(v) => update('interestType', v as InterestType)}
            className="grid grid-cols-3 gap-2 mt-1.5"
          >
            {[
              { key: 'PERCENTAGE' as const, label: 'Percentage' },
              { key: 'FIXED' as const, label: 'Fixed ₹' },
              { key: 'NONE' as const, label: 'None' },
            ].map((t) => (
              <label
                key={t.key}
                className={cn(
                  'rounded-xl border-2 p-3 cursor-pointer transition-all text-center',
                  form.interestType === t.key ? 'border-success bg-success/5' : 'border-border hover:border-success/40'
                )}
              >
                <RadioGroupItem value={t.key} className="sr-only" />
                <span className="text-sm font-medium">{t.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        {form.interestType === 'PERCENTAGE' && (
          <div>
            <Label htmlFor="rate">Interest Rate (% per period)</Label>
            <div className="relative mt-1.5">
              <Input id="rate" value={form.rateBps} onChange={(e) => update('rateBps', e.target.value)} placeholder="18" inputMode="decimal" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </div>
          </div>
        )}
        {form.interestType === 'FIXED' && (
          <div>
            <Label htmlFor="fixed">Total Fixed Interest (₹)</Label>
            <div className="relative mt-1.5">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="fixed" value={form.fixedInterest} onChange={(e) => update('fixedInterest', e.target.value)} placeholder="0.00" className="pl-9" inputMode="decimal" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstDue">First Due Date</Label>
            <Input id="firstDue" type="date" value={form.firstDueDate} onChange={(e) => update('firstDueDate', e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="processingFee">Processing Fee (₹, optional)</Label>
            <div className="relative mt-1.5">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="processingFee" value={form.processingFee} onChange={(e) => update('processingFee', e.target.value)} placeholder="500" className="pl-9" inputMode="decimal" />
            </div>
          </div>
        </div>

        {preview && (
          <div className="rounded-2xl border border-success/30 bg-success/5 p-4 mt-3">
            <p className="text-sm font-semibold text-success mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Live Schedule Preview
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Stat label="Installment Amt" value={formatPaiseToINR(Number(preview.installmentAmount))} />
              <Stat label="Total Repayable" value={formatPaiseToINR(Number(preview.totalRepayable))} />
              <Stat label="Total Interest" value={formatPaiseToINR(Number(preview.totalInterest))} />
              <Stat label="Final Due" value={preview.finalDueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
            </div>
            <div className="rounded-xl bg-card border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                First 3 installments
              </div>
              <div className="divide-y divide-border">
                {preview.installments.slice(0, 3).map((inst: any) => (
                  <div key={inst.number} className="px-3 py-2 flex items-center justify-between text-xs">
                    <span className="font-mono text-muted-foreground">#{inst.number} · {inst.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    <span className="font-semibold tabular-nums">{formatPaiseToINR(Number(inst.totalDue))}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card border border-border p-2.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold mt-1 tabular-nums">{value}</p>
    </div>
  )
}

function PersonalStep({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div>
      <StepHeader
        icon={<User className="h-5 w-5" />}
        title="Personal Details"
        subtitle="Tell us about yourself. We'll use this to verify your identity."
      />
      <div className="space-y-4">
        <div>
          <Label htmlFor="fullName">Full Name (as per Aadhaar)</Label>
          <Input id="fullName" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="Priya Sharma" className="mt-1.5" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="mobile">Mobile Number</Label>
            <div className="relative mt-1.5">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="mobile" value={form.mobile} onChange={(e) => update('mobile', e.target.value)} placeholder="+91 98200 12345" className="pl-9" inputMode="tel" />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email Address</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="priya@example.com" className="pl-9" inputMode="email" />
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="dob">Date of Birth</Label>
          <Input id="dob" type="date" value={form.dob} onChange={(e) => update('dob', e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="address">Residential Address</Label>
          <Textarea id="address" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Flat / House no, Street, Area, City, PIN" rows={3} className="mt-1.5" />
        </div>
      </div>
    </div>
  )
}

function KycStep({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  const onAadhaarChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 12)
    const masked = digits.replace(/(\d{4})(?=\d)/g, '$1 ')
    update('aadhaar', masked)
  }
  const onPanChange = (raw: string) => {
    const upper = raw.toUpperCase().slice(0, 10)
    update('pan', upper)
  }

  return (
    <div>
      <StepHeader
        icon={<IdCard className="h-5 w-5" />}
        title="KYC Verification"
        subtitle="Aadhaar-based e-KYC. Your data is encrypted and never shared."
      />
      <div className="space-y-4">
        <div>
          <Label htmlFor="aadhaar">Aadhaar Number</Label>
          <div className="relative mt-1.5">
            <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="aadhaar" value={form.aadhaar} onChange={(e) => onAadhaarChange(e.target.value)} placeholder="XXXX XXXX XXXX" className="pl-9 font-mono" inputMode="numeric" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Format: 12 digits · auto-formatted with spaces</p>
        </div>
        <div>
          <Label htmlFor="pan">PAN Number</Label>
          <div className="relative mt-1.5">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="pan" value={form.pan} onChange={(e) => onPanChange(e.target.value)} placeholder="AAAAA9999A" className="pl-9 font-mono uppercase" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Format: 5 letters · 4 digits · 1 letter</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <UploadBox label="Aadhaar Front" hint="JPG / PNG · max 5 MB" required />
          <UploadBox label="Aadhaar Back" hint="JPG / PNG · max 5 MB" required />
          <UploadBox label="PAN Card" hint="JPG / PNG · max 5 MB" required />
        </div>

        <div className="rounded-xl bg-info/5 border border-info/15 p-3 flex items-start gap-2.5">
          <Lock className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">Your Aadhaar is processed via UIDAI's secure e-KYC API. We only receive a "Yes/No" verification response — your full Aadhaar details never leave the secure vault.</p>
        </div>
      </div>
    </div>
  )
}

function FinancialStep({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div>
      <StepHeader
        icon={<Briefcase className="h-5 w-5" />}
        title="Financial Details"
        subtitle="Help us understand your income to assess eligibility."
      />
      <div className="space-y-4">
        <div>
          <Label>Occupation</Label>
          <Select value={form.occupation} onValueChange={(v) => update('occupation', v)}>
            <SelectTrigger className="w-full mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Salaried', 'Self-employed', 'Business Owner', 'Freelancer', 'Student', 'Other'].map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="employer">Employer / Business Name</Label>
          <Input id="employer" value={form.employer} onChange={(e) => update('employer', e.target.value)} placeholder="e.g. Tata Consultancy Services" className="mt-1.5" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="income">Monthly Income (₹)</Label>
            <div className="relative mt-1.5">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="income" value={form.monthlyIncome} onChange={(e) => update('monthlyIncome', e.target.value)} placeholder="0.00" className="pl-9" inputMode="decimal" />
            </div>
          </div>
          <div>
            <Label htmlFor="obligations">Existing EMIs (₹/month)</Label>
            <div className="relative mt-1.5">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="obligations" value={form.existingObligations} onChange={(e) => update('existingObligations', e.target.value)} placeholder="0" className="pl-9" inputMode="decimal" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BankStep({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div>
      <StepHeader
        icon={<Building2 className="h-5 w-5" />}
        title="Bank Details"
        subtitle="Where should we disburse your loan? And where will EMIs be debited?"
      />
      <div className="space-y-4">
        <div>
          <Label htmlFor="bankName">Bank Name</Label>
          <Input id="bankName" value={form.bankName} onChange={(e) => update('bankName', e.target.value)} placeholder="e.g. Axis Bank" className="mt-1.5" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="account">Account Number</Label>
            <Input id="account" value={form.accountNumber} onChange={(e) => update('accountNumber', e.target.value)} placeholder="XXXXXXXXXX" className="mt-1.5 font-mono" inputMode="numeric" />
          </div>
          <div>
            <Label htmlFor="ifsc">IFSC Code</Label>
            <Input id="ifsc" value={form.ifsc} onChange={(e) => update('ifsc', e.target.value.toUpperCase())} placeholder="AXIS0001234" className="mt-1.5 font-mono uppercase" />
          </div>
        </div>
        <div>
          <Label htmlFor="upi">UPI ID (optional)</Label>
          <div className="relative mt-1.5">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="upi" value={form.upiId} onChange={(e) => update('upiId', e.target.value)} placeholder="yourname@okhdfcbank" className="pl-9" />
          </div>
        </div>
        <div className="rounded-xl bg-success/5 border border-success/15 p-3 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">Your bank details are stored encrypted with AES-256. We'll send ₹1 to verify the account before disbursement.</p>
        </div>
      </div>
    </div>
  )
}

function DocumentsStep() {
  return (
    <div>
      <StepHeader
        icon={<FileText className="h-5 w-5" />}
        title="Upload Documents"
        subtitle="Upload clear, color scans. All formats accepted (PDF/JPG/PNG)."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DOCUMENT_LIST.map((d) => (
          <UploadBox
            key={d.key}
            label={d.label}
            hint={d.required ? 'Required · PDF/JPG/PNG · max 5 MB' : 'Optional · PDF/JPG/PNG · max 5 MB'}
            required={d.required}
            icon={d.icon}
            large
          />
        ))}
      </div>
      <div className="rounded-xl bg-info/5 border border-info/15 p-3 flex items-start gap-2.5 mt-4">
        <Lock className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground">All uploads are encrypted in transit and at rest. Only our verification team can access them.</p>
      </div>
    </div>
  )
}

function UploadBox({ label, hint, required, icon, large }: { label: string; hint: string; required?: boolean; icon?: React.ReactNode; large?: boolean }) {
  const [fileName, setFileName] = React.useState<string | null>(null)

  return (
    <label
      className={cn(
        'group rounded-2xl border-2 border-dashed p-4 cursor-pointer transition-all block',
        large ? 'min-h-[120px]' : 'min-h-[88px]',
        fileName ? 'border-success bg-success/5' : 'border-border hover:border-success/40 hover:bg-muted/20'
      )}
    >
      <input
        type="file"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setFileName(f.name)
            toast.success(`${label} uploaded`, { description: `${f.name} · ${(f.size / 1024).toFixed(0)} KB` })
          }
        }}
      />
      <div className="flex items-start gap-3">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', fileName ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
          {fileName ? <CheckCircle2 className="h-5 w-5" /> : (icon || <Upload className="h-5 w-5" />)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">{label}</p>
            {required && <span className="text-[10px] font-semibold text-destructive uppercase">Required</span>}
          </div>
          {fileName ? (
            <p className="text-[11px] text-success mt-0.5 truncate font-mono">{fileName} · Tap to replace</p>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
          )}
        </div>
      </div>
    </label>
  )
}

function AgreementStep({ form, update, agreementBody, agreementName, agreementVersion }: {
  form: FormState
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  agreementBody: string
  agreementName: string
  agreementVersion: string
}) {
  return (
    <div>
      <StepHeader
        icon={<PenLine className="h-5 w-5" />}
        title="Sign the Agreement"
        subtitle="Read the loan agreement carefully. Sign at the bottom to accept."
      />
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/20 p-4 max-h-[260px] overflow-y-auto">
          <p className="text-sm font-semibold mb-2">{agreementName} · v{agreementVersion}</p>
          <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-line">
            {agreementBody}
            {'\n\n'}
            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
              By signing this agreement, you agree to repay the loan as per the schedule, authorize Sterling Lending to debit your registered bank account on each due date, and acknowledge that late payments may attract penalty charges as defined in clause 7 of this agreement.
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Sign here</p>
          <SignaturePad
            value={form.signature}
            onChange={(dataUrl) => update('signature', dataUrl)}
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border p-3.5 hover:bg-muted/30 transition-colors">
          <Checkbox
            checked={form.agreedToTerms}
            onCheckedChange={(v) => update('agreedToTerms', v === true)}
            className="mt-0.5"
          />
          <div>
            <p className="text-sm font-medium">I have read and agree to the loan agreement</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">My signature above is the legal equivalent of my written signature.</p>
          </div>
        </label>
      </div>
    </div>
  )
}

function SignaturePad({ value, onChange }: { value: string | null; onChange: (dataUrl: string | null) => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const isDrawing = React.useRef(false)
  const lastPoint = React.useRef<{ x: number; y: number } | null>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 2.5
      ctx.strokeStyle = '#0f172a'
    }
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    isDrawing.current = true
    lastPoint.current = getPos(e)
  }
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    const pos = getPos(e)
    if (ctx && lastPoint.current) {
      ctx.beginPath()
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    }
    lastPoint.current = pos
  }
  const end = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    isDrawing.current = false
    lastPoint.current = null
    const canvas = canvasRef.current
    if (canvas) {
      onChange(canvas.toDataURL('image/png'))
    }
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      onChange(null)
    }
  }

  return (
    <div>
      <div className="rounded-xl border-2 border-dashed border-border bg-card p-1">
        <canvas
          ref={canvasRef}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          className="w-full h-44 rounded-lg cursor-crosshair touch-none"
          style={{ background: 'linear-gradient(to bottom, transparent 49%, hsl(var(--border) / 0.4) 49%, hsl(var(--border) / 0.4) 51%, transparent 51%)' }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-[11px] text-muted-foreground">Draw your signature with mouse or finger</p>
        <Button size="sm" variant="ghost" onClick={clear} className="h-7">
          <Eraser className="h-3.5 w-3.5" /> Clear
        </Button>
      </div>
    </div>
  )
}

function ReviewStep({ form, preview }: { form: FormState; preview: any; submitLoading?: boolean; onSubmit?: () => void }) {
  return (
    <div>
      <StepHeader
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="Review & Submit"
        subtitle="Please review all details before submitting your application."
      />

      <div className="space-y-3">
        <ReviewSection title="Loan" icon={<IndianRupee className="h-4 w-4" />}>
          <ReviewRow label="Principal" value={formatPaiseToINR(parseDisplayPaise(form.principal))} />
          <ReviewRow label="Frequency" value={form.frequency.charAt(0) + form.frequency.slice(1).toLowerCase()} />
          <ReviewRow label="Installments" value={form.installments} />
          <ReviewRow label="Interest" value={form.interestType === 'PERCENTAGE' ? `${form.rateBps}% per period` : form.interestType === 'FIXED' ? formatPaiseToINR(parseDisplayPaise(form.fixedInterest)) : 'No interest'} />
          {preview && (
            <>
              <ReviewRow label="Installment Amount" value={formatPaiseToINR(Number(preview.installmentAmount))} highlight />
              <ReviewRow label="Total Repayable" value={formatPaiseToINR(Number(preview.totalRepayable))} highlight />
            </>
          )}
        </ReviewSection>

        <ReviewSection title="Personal" icon={<User className="h-4 w-4" />}>
          <ReviewRow label="Full Name" value={form.fullName || '—'} />
          <ReviewRow label="Mobile" value={form.mobile || '—'} />
          <ReviewRow label="Email" value={form.email || '—'} />
          <ReviewRow label="DOB" value={form.dob || '—'} />
          <ReviewRow label="Address" value={form.address || '—'} />
        </ReviewSection>

        <ReviewSection title="KYC" icon={<IdCard className="h-4 w-4" />}>
          <ReviewRow label="Aadhaar" value={form.aadhaar || '—'} mono />
          <ReviewRow label="PAN" value={form.pan || '—'} mono />
        </ReviewSection>

        <ReviewSection title="Financial" icon={<Briefcase className="h-4 w-4" />}>
          <ReviewRow label="Occupation" value={form.occupation || '—'} />
          <ReviewRow label="Employer" value={form.employer || '—'} />
          <ReviewRow label="Monthly Income" value={form.monthlyIncome ? formatPaiseToINR(parseDisplayPaise(form.monthlyIncome)) : '—'} />
          <ReviewRow label="Existing EMIs" value={form.existingObligations ? formatPaiseToINR(parseDisplayPaise(form.existingObligations)) : '₹0'} />
        </ReviewSection>

        <ReviewSection title="Bank" icon={<Building2 className="h-4 w-4" />}>
          <ReviewRow label="Bank" value={form.bankName || '—'} />
          <ReviewRow label="Account" value={form.accountNumber ? `XXXX${form.accountNumber.slice(-4)}` : '—'} mono />
          <ReviewRow label="IFSC" value={form.ifsc || '—'} mono />
          {form.upiId && <ReviewRow label="UPI" value={form.upiId} mono />}
        </ReviewSection>

        <ReviewSection title="Agreement" icon={<PenLine className="h-4 w-4" />}>
          <ReviewRow label="Accepted" value={form.agreedToTerms ? 'Yes' : 'No'} />
          <ReviewRow label="Signed" value={form.signature ? 'Yes' : 'No'} />
        </ReviewSection>
      </div>

      <div className="rounded-xl bg-success/5 border border-success/15 p-4 mt-4 flex items-start gap-2.5">
        <ShieldCheck className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">By submitting, you confirm all details are accurate to the best of your knowledge. We'll review your application within 24 hours and notify you on WhatsApp.</p>
      </div>
    </div>
  )
}

function ReviewSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold flex items-center gap-2 mb-3 text-success">
        {icon} {title}
      </p>
      <dl className="space-y-2">{children}</dl>
    </div>
  )
}

function ReviewRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('text-sm font-medium text-right', mono && 'font-mono', highlight && 'text-success font-bold')}>{value}</dd>
    </div>
  )
}

function SuccessView({ appNumber, onHome }: { appNumber: string; onHome: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-success/10 via-background to-info/10 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-lg w-full text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="h-20 w-20 rounded-3xl bg-success text-success-foreground flex items-center justify-center mx-auto mb-6 shadow-glow"
        >
          <PartyPopper className="h-10 w-10" />
        </motion.div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Application Submitted!</h1>
        <p className="text-sm text-muted-foreground mt-2">We've received your loan application. Here's what happens next.</p>

        <div className="rounded-2xl border border-success/30 bg-card p-5 mt-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Your Application Number</p>
          <p className="text-2xl font-bold font-mono mt-1 text-success">{appNumber}</p>
          <p className="text-[11px] text-muted-foreground mt-2">Save this for future reference</p>
        </div>

        <div className="rounded-2xl bg-muted/30 border border-border p-4 mt-4 text-left">
          <p className="text-sm font-semibold mb-3">What's next?</p>
          <ol className="space-y-2.5">
            {[
              { icon: <ShieldCheck className="h-4 w-4" />, text: 'Our team reviews your application (within 24 hours)' },
              { icon: <IdCard className="h-4 w-4" />, text: 'We verify your KYC via Aadhaar e-KYC' },
              { icon: <CreditCard className="h-4 w-4" />, text: 'Loan disbursed to your bank account' },
              { icon: <CheckCircle2 className="h-4 w-4" />, text: 'You receive a confirmation on WhatsApp' },
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg bg-success/15 text-success flex items-center justify-center flex-shrink-0">
                  {s.icon}
                </div>
                <p className="text-sm text-muted-foreground pt-0.5">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>

        <Button onClick={onHome} size="lg" className="w-full mt-6 bg-success hover:bg-success/90 min-h-[48px]">
          <Home className="h-4 w-4" /> Return Home
        </Button>

        <Link href="/" className="inline-block text-xs text-muted-foreground hover:text-foreground mt-4 transition-colors">
          Apply for another loan
        </Link>
      </motion.div>
    </div>
  )
}
