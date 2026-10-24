'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Wallet, ShieldCheck, User, Phone, Sparkles, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { api, ApiRequestError } from '@/lib/api-client'
import { formatPaiseToINR } from '@/lib/money'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'
import { KfsDisclosure } from '@/components/legal/kfs-disclosure'
import { LegalFooter } from '@/components/legal/legal-footer'

export default function ApplyPage() {
  const params = useParams<{ token: string }>()
  const token = params.token as string

  const { data: applyData, isLoading: applyLoading, error: applyError } = useQuery({
    queryKey: ['apply', token],
    queryFn: () => api.get<any>(`/api/apply/${token}`),
    retry: false,
  })

  const preConfig = applyData?.preConfig ?? null
  const agreement = applyData?.agreement ?? null

  const [fullName, setFullName] = React.useState('')
  const [mobile, setMobile] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [purpose, setPurpose] = React.useState('')
  const [agreementAccepted, setAgreementAccepted] = React.useState(false)
  const [submitted, setSubmitted] = React.useState<{ applicationNumber: string; totalRepayable: string } | null>(null)

  // Loan terms — prefilled from the link's pre-config; editable when the link carries none.
  const defaultFirstDue = React.useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  }, [])
  const [firstDueDate, setFirstDueDate] = React.useState(defaultFirstDue)
  const [principalRupees, setPrincipalRupees] = React.useState('')
  const [interestType, setInterestType] = React.useState<'PERCENTAGE' | 'FIXED' | 'NONE'>('PERCENTAGE')
  const [interestRatePct, setInterestRatePct] = React.useState('')
  const [fixedInterestRupees, setFixedInterestRupees] = React.useState('')
  const [frequency, setFrequency] = React.useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('MONTHLY')
  const [installments, setInstallments] = React.useState('')

  // Unbundled DPDP Act 2023 & RBI Digital Lending consents
  const [consentDataProcessing, setConsentDataProcessing] = React.useState(false)
  const [consentKycAadhaar, setConsentKycAadhaar] = React.useState(false)
  const [consentKfs, setConsentKfs] = React.useState(false)
  const [consentCreditCheck, setConsentCreditCheck] = React.useState(false)
  const [consentCommunication, setConsentCommunication] = React.useState(false)

  React.useEffect(() => {
    if (!preConfig) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (preConfig.purpose) setPurpose(preConfig.purpose)
  }, [preConfig])

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Full payload per POST /api/apply/[token] submitSchema. Loan terms come
      // from the link's pre-config when present, else from the form inputs.
      const payload: Record<string, unknown> = {
        fullName: fullName.trim(),
        mobile: mobile.replace(/\D/g, ''),
        purpose: purpose.trim(),
        principalAmount: preConfig
          ? String(preConfig.principalAmount)
          : String(Math.round(Number(principalRupees) * 100)),
        interestType: preConfig ? preConfig.interestType : interestType,
        frequency: preConfig ? preConfig.frequency : frequency,
        installments: preConfig ? Number(preConfig.installments) : Number(installments),
        firstDueDate: new Date(firstDueDate).toISOString(),
        agreementAccepted: true,
        // Recorded by the route inside its own transaction — no separate
        // unauthenticated /api/consents call from the browser.
        consents: [
          { consentType: 'DATA_PROCESSING', granted: consentDataProcessing, policyVersion: COMPLIANCE_CONFIG.policyVersion },
          { consentType: 'KYC_AADHAAR', granted: consentKycAadhaar, policyVersion: COMPLIANCE_CONFIG.policyVersion },
          { consentType: 'KFS_DISCLOSURE', granted: consentKfs, policyVersion: COMPLIANCE_CONFIG.policyVersion },
          { consentType: 'CREDIT_CHECK', granted: consentCreditCheck, policyVersion: COMPLIANCE_CONFIG.policyVersion },
          { consentType: 'COMMUNICATION', granted: consentCommunication, policyVersion: COMPLIANCE_CONFIG.policyVersion },
        ],
      }
      if (email.trim()) payload.email = email.trim()
      if (agreement?.id) payload.agreementTemplateId = agreement.id
      if (agreement?.version) payload.agreementVersion = agreement.version
      if (payload.interestType === 'PERCENTAGE') {
        payload.interestRate = preConfig
          ? Number(preConfig.interestRate ?? 0)
          : Math.round(Number(interestRatePct || 0) * 100)
      }
      if (payload.interestType === 'FIXED') {
        payload.fixedInterest = preConfig
          ? String(preConfig.fixedInterest ?? 0)
          : String(Math.round(Number(fixedInterestRupees || 0) * 100))
      }
      // The route records the applicant's consents/agreement acceptance itself —
      // there is no separate consent call, and success is only reported on success.
      return api.post<{
        applicationNumber: string
        candidateId: string
        totalRepayable: string
        installmentAmount: string
        finalDueDate: string
      }>(`/api/apply/${token}`, payload)
    },
    onSuccess: (res) => {
      setSubmitted({ applicationNumber: res.applicationNumber, totalRepayable: res.totalRepayable })
      toast.success('Application submitted', { description: `Application ${res.applicationNumber} received.` })
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.message : 'Application submission failed'
      toast.error('Application failed', { description: message })
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) return toast.error('Enter your full name')
    if (mobile.replace(/\D/g, '').length < 10) return toast.error('Enter a valid 10-digit mobile number')
    if (purpose.trim().length < 3) return toast.error('Please describe the loan purpose (at least 3 characters)')
    if (!preConfig) {
      if (!principalRupees || Number(principalRupees) <= 0) return toast.error('Enter the loan amount')
      const n = Number(installments)
      if (!Number.isInteger(n) || n < 1 || n > 360) return toast.error('Installments must be between 1 and 360')
    }
    if (!firstDueDate) return toast.error('Choose the first due date')
    if (!consentDataProcessing || !consentKycAadhaar || !consentKfs || !consentCreditCheck) {
      return toast.error('Please accept all required DPDP Act, KYC, and Key Facts Statement (KFS) disclosures')
    }
    if (!agreementAccepted) return toast.error('Please accept the loan agreement to submit your application')
    submitMutation.mutate()
  }

  if (applyLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" aria-hidden="true" />
          <p className="mt-4 text-sm font-medium">Verifying your secure link…</p>
        </div>
      </div>
    )
  }

  if (applyError || !applyData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <Wallet className="h-10 w-10 mx-auto text-destructive mb-4" aria-hidden="true" />
          <h1 className="text-xl font-bold mb-2">Link unavailable</h1>
          <p className="text-sm text-muted-foreground mb-6">This link is invalid, expired, or already used.</p>
          <Button asChild><Link href="/">Return Home</Link></Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-10 max-w-2xl mx-auto w-full">
        <div className="mb-6 text-center">
          <div className="h-12 w-12 rounded-2xl bg-gradient-gold text-slate-950 flex items-center justify-center mx-auto mb-4 shadow-gold" aria-hidden="true">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Apply &amp; Review Key Facts Statement</h1>
          <p className="text-sm text-muted-foreground mt-2">
            You&apos;ve been invited by {applyData.organizationName}. Review your standardized RBI Key Facts Statement (KFS) and submit your application to proceed.
          </p>
        </div>

        {preConfig && (
          <>
            <div className="rounded-2xl border border-border bg-card p-4 mb-4 text-center" role="region" aria-label="Pre-approved offer">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Pre-Approved Offer</p>
              <p className="text-3xl font-bold text-primary">{formatPaiseToINR(Number(preConfig.principalAmount))}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {preConfig.installments} {preConfig.frequency.toLowerCase()} installments
              </p>
            </div>

            <KfsDisclosure
              principalPaise={preConfig.principalAmount}
              interestType={preConfig.interestType}
              interestRateBps={preConfig.interestRate}
              fixedInterestPaise={preConfig.fixedInterest}
              installments={Number(preConfig.installments) || 1}
              frequency={preConfig.frequency}
              borrowerName={fullName || preConfig.fullName || 'Applicant'}
              lenderName={applyData.organizationName}
              compact
              className="mb-6"
            />
          </>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <div className="relative mt-1.5">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="pl-9 h-11"
                autoComplete="name"
                aria-required="true"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="mobile">Mobile Number</Label>
            <div className="relative mt-1.5">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
              <Input
                id="mobile"
                type="tel"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => !preConfig?.mobile && setMobile(e.target.value)}
                placeholder="9876543210"
                className="pl-9 h-11"
                autoComplete="tel"
                readOnly={!!preConfig?.mobile}
                aria-required="true"
                maxLength={10}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">This will be your login ID.</p>
          </div>
          <div>
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 h-11"
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="purpose">Loan Purpose</Label>
            <Input
              id="purpose"
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Shop inventory, medical expense, education"
              className="mt-1.5 h-11"
              aria-required="true"
              required
            />
          </div>

          {!preConfig && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
              <p className="text-sm font-semibold">Loan Details</p>
              <div>
                <Label htmlFor="principal">Loan Amount (₹)</Label>
                <Input
                  id="principal"
                  type="number"
                  min={1}
                  value={principalRupees}
                  onChange={(e) => setPrincipalRupees(e.target.value)}
                  placeholder="50000"
                  className="mt-1.5 h-11"
                  aria-required="true"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="interestType">Interest Type</Label>
                  <select
                    id="interestType"
                    value={interestType}
                    onChange={(e) => setInterestType(e.target.value as 'PERCENTAGE' | 'FIXED' | 'NONE')}
                    className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed amount</option>
                    <option value="NONE">No interest</option>
                  </select>
                </div>
                {interestType === 'PERCENTAGE' && (
                  <div>
                    <Label htmlFor="interestRate">Interest Rate (% for full term)</Label>
                    <Input
                      id="interestRate"
                      type="number"
                      min={0}
                      step="0.5"
                      value={interestRatePct}
                      onChange={(e) => setInterestRatePct(e.target.value)}
                      placeholder="10"
                      className="mt-1.5 h-11"
                    />
                  </div>
                )}
                {interestType === 'FIXED' && (
                  <div>
                    <Label htmlFor="fixedInterest">Total Interest (₹)</Label>
                    <Input
                      id="fixedInterest"
                      type="number"
                      min={0}
                      value={fixedInterestRupees}
                      onChange={(e) => setFixedInterestRupees(e.target.value)}
                      placeholder="5000"
                      className="mt-1.5 h-11"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="frequency">Repayment Frequency</Label>
                  <select
                    id="frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as 'DAILY' | 'WEEKLY' | 'MONTHLY')}
                    className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="DAILY">Daily</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="installments">Installments</Label>
                  <Input
                    id="installments"
                    type="number"
                    min={1}
                    max={360}
                    value={installments}
                    onChange={(e) => setInstallments(e.target.value)}
                    placeholder="12"
                    className="mt-1.5 h-11"
                    aria-required="true"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="firstDueDate">First Due Date</Label>
            <Input
              id="firstDueDate"
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              className="mt-1.5 h-11"
              aria-required="true"
              required
            />
          </div>

          {/* Unbundled DPDP Act 2023 & RBI KFS Consents */}
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 space-y-3 text-xs">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              Mandatory Regulatory &amp; DPDP Act, 2023 Consents (v{COMPLIANCE_CONFIG.policyVersion})
            </p>

            <label className="flex items-start gap-2.5 cursor-pointer text-muted-foreground">
              <input
                type="checkbox"
                checked={consentDataProcessing}
                onChange={(e) => setConsentDataProcessing(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
                required
              />
              <span>
                <strong className="text-foreground">1. DPDP Act Data Processing &amp; Privacy Policy:</strong> I explicitly consent to the processing of my personal data for loan origination, servicing, and statutory compliance under the{' '}
                <Link href="/privacy" className="text-primary underline underline-offset-2">
                  Privacy Policy (v{COMPLIANCE_CONFIG.policyVersion})
                </Link>{' '}
                and{' '}
                <Link href="/terms" className="text-primary underline underline-offset-2">
                  Terms of Use
                </Link>
                .
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-muted-foreground">
              <input
                type="checkbox"
                checked={consentKycAadhaar}
                onChange={(e) => setConsentKycAadhaar(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
                required
              />
              <span>
                <strong className="text-foreground">2. KYC / Aadhaar Last-4 &amp; PAN Verification Consent:</strong> I voluntarily consent to submit my PAN and masked Aadhaar (last 4 digits only) for KYC verification under RBI KYC &amp; PMLA rules.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-muted-foreground">
              <input
                type="checkbox"
                checked={consentKfs}
                onChange={(e) => setConsentKfs(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
                required
              />
              <span>
                <strong className="text-foreground">3. Key Facts Statement (KFS) &amp; Cooling-Off Period Acceptance:</strong> I have reviewed the Key Facts Statement (KFS) above, including the APR, fees, installment schedule, offline cash receipt policy, and my {COMPLIANCE_CONFIG.coolingOffDays}-day cooling-off right.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-muted-foreground">
              <input
                type="checkbox"
                checked={consentCreditCheck}
                onChange={(e) => setConsentCreditCheck(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
                required
              />
              <span>
                <strong className="text-foreground">4. Credit / Obligation Assessment Consent:</strong> I authorize assessment of my income, bank account, and repayment obligations, and reporting to Credit Information Companies (CICs).
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-muted-foreground">
              <input
                type="checkbox"
                checked={consentCommunication}
                onChange={(e) => setConsentCommunication(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
              />
              <span>
                <strong className="text-foreground">5. Promotional Communications (Optional):</strong> I agree to receive optional promotional offers on WhatsApp/SMS (withdrawable anytime).
              </span>
            </label>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={agreementAccepted}
              onChange={(e) => setAgreementAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
              required
            />
            <span>
              <strong className="text-foreground">Agreement Acceptance:</strong> I accept the loan agreement{agreement ? <> — <strong className="text-foreground">{agreement.name} (v{agreement.version})</strong></> : ''} and the Key Facts Statement shown above, and I confirm the details in this application are correct.
            </span>
          </label>

          {submitted ? (
            <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-center" role="status">
              <p className="text-sm font-semibold text-foreground">Application submitted successfully</p>
              <p className="text-sm text-muted-foreground mt-1">
                Application number: <strong className="text-foreground">{submitted.applicationNumber}</strong>
                {' '}· Total repayable: <strong className="text-foreground">{formatPaiseToINR(Number(submitted.totalRepayable))}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-2">The lender will review your application. Keep your application number for reference. To access your borrower portal, sign up with the same mobile number.</p>
              <Button asChild className="mt-4"><Link href="/signup">Create borrower account</Link></Button>
            </div>
          ) : (
          <Button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full mt-6 h-12 text-base"
            aria-busy={submitMutation.isPending}
          >
            {submitMutation.isPending
              ? <><Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" /><span>Submitting…</span></>
              : <>Submit Application <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" /></>
            }
          </Button>
          )}
        </form>

        <LegalFooter compact className="mt-8" />
      </div>
    </div>
  )
}
