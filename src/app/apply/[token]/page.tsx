'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Wallet, ShieldCheck, User, Phone, Lock, Sparkles, Loader2, ArrowRight } from 'lucide-react'
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
  const router = useRouter()

  const { data: applyData, isLoading: applyLoading, error: applyError } = useQuery({
    queryKey: ['apply', token],
    queryFn: () => api.get<any>(`/api/apply/${token}`),
    retry: false,
  })

  const preConfig = applyData?.preConfig ?? null

  const [fullName, setFullName] = React.useState('')
  const [mobile, setMobile] = React.useState('')
  const [password, setPassword] = React.useState('')

  // Unbundled DPDP Act 2023 & RBI Digital Lending consents
  const [consentDataProcessing, setConsentDataProcessing] = React.useState(false)
  const [consentKycAadhaar, setConsentKycAadhaar] = React.useState(false)
  const [consentKfs, setConsentKfs] = React.useState(false)
  const [consentCreditCheck, setConsentCreditCheck] = React.useState(false)
  const [consentCommunication, setConsentCommunication] = React.useState(false)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (preConfig?.fullName) setFullName(preConfig.fullName)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (preConfig?.mobile) setMobile(preConfig.mobile)
  }, [preConfig])

  const submitMutation = useMutation({
    mutationFn: async () => {
      const consents = [
        { consentType: 'DATA_PROCESSING', granted: consentDataProcessing },
        { consentType: 'KYC_AADHAAR', granted: consentKycAadhaar },
        { consentType: 'KFS_DISCLOSURE', granted: consentKfs },
        { consentType: 'CREDIT_CHECK', granted: consentCreditCheck },
        { consentType: 'COMMUNICATION', granted: consentCommunication },
      ]

      const res = await api.post<{
        applicationId: string
        applicationNumber: string
        candidateId: string
      }>(`/api/apply/${token}`, {
        fullName: fullName.trim(),
        mobile: mobile.replace(/\D/g, ''),
        password,
      })

      await api
        .post('/api/consents', {
          applicationId: res.applicationId,
          candidateId: res.candidateId,
          policyVersion: COMPLIANCE_CONFIG.policyVersion,
          consents,
        })
        .catch(() => {})

      return res
    },
    onSuccess: () => {
      toast.success('Registration & KFS acceptance recorded! Please login to complete your application.')
      router.push('/login')
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.message : 'Registration failed'
      toast.error('Registration failed', { description: message })
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) return toast.error('Enter your full name')
    if (mobile.replace(/\D/g, '').length < 10) return toast.error('Enter a valid 10-digit mobile number')
    if (password.length < 6) return toast.error('Password must be at least 6 characters')
    if (!consentDataProcessing || !consentKycAadhaar || !consentKfs || !consentCreditCheck) {
      return toast.error('Please accept all required DPDP Act, KYC, and Key Facts Statement (KFS) disclosures')
    }
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
          <h1 className="text-2xl font-bold tracking-tight">Register &amp; Review Key Facts Statement</h1>
          <p className="text-sm text-muted-foreground mt-2">
            You&apos;ve been invited by {applyData.organizationName}. Review your standardized RBI Key Facts Statement (KFS) and create your account to proceed.
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
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 h-11"
                autoComplete="new-password"
                minLength={6}
                aria-required="true"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Minimum 6 characters.</p>
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

          <Button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full mt-6 h-12 text-base"
            aria-busy={submitMutation.isPending}
          >
            {submitMutation.isPending
              ? <><Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" /><span>Registering…</span></>
              : <>Register &amp; Continue <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" /></>
            }
          </Button>
        </form>

        <LegalFooter compact className="mt-8" />
      </div>
    </div>
  )
}
