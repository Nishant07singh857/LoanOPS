'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Wallet, ShieldCheck, ArrowRight, Loader2, User, Phone, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'
import { LegalFooter } from '@/components/legal/legal-footer'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = React.useState('')
  const [mobile, setMobile] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPass, setShowPass] = React.useState(false)
  const [consentDataProcessing, setConsentDataProcessing] = React.useState(false)
  const [consentTerms, setConsentTerms] = React.useState(false)
  const [consentCommunication, setConsentCommunication] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [claimCode, setClaimCode] = React.useState('')
  const [needsClaimCode, setNeedsClaimCode] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanName = fullName.trim()
    const cleanMobile = mobile.replace(/\D/g, '').replace(/^91(\d{10})$/, '$1')

    if (cleanName.length < 2 || cleanMobile.length < 10 || cleanMobile.length > 15 || password.length < 10) {
      setError('Please fill in all fields correctly (10-digit mobile and a password of at least 10 characters, with uppercase, lowercase and a digit)')
      return
    }

    if (needsClaimCode && !claimCode.trim()) {
      setError('Enter the claim code shared by your lender/agent to link this account to your existing borrower record')
      return
    }

    if (!consentDataProcessing || !consentTerms) {
      setError('Please provide explicit consent to the DPDP Act Privacy Policy and Terms of Use to proceed')
      return
    }

    const consents = [
      { consentType: 'DATA_PROCESSING', granted: consentDataProcessing, policyVersion: COMPLIANCE_CONFIG.policyVersion },
      { consentType: 'TERMS_PRIVACY', granted: consentTerms, policyVersion: COMPLIANCE_CONFIG.policyVersion },
      { consentType: 'COMMUNICATION', granted: consentCommunication, policyVersion: COMPLIANCE_CONFIG.policyVersion },
    ]

    setBusy(true)
    try {
      // Signup records the consents itself — no separate consent call.
      await api.post('/api/auth/signup', {
        fullName: cleanName,
        mobile: cleanMobile,
        password,
        consents,
        ...(needsClaimCode && claimCode.trim() ? { claimCode: claimCode.trim() } : {}),
      })
      toast.success('Account created successfully', { description: 'Please log in to continue' })
      router.push('/login?role=CANDIDATE')
    } catch (err: any) {
      const message = err?.message || 'Failed to create account'
      // An existing borrower record for this mobile must be claimed with a code
      // issued by the lender — reveal the claim-code field and let them retry.
      if (typeof message === 'string' && message.includes('Unable to complete registration')) {
        setNeedsClaimCode(true)
        setError('A borrower record already exists for this mobile number. If it is yours, enter the claim code given by your lender/agent below and submit again. If you do not have a code, contact your lender.')
      } else {
        setError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-background via-background to-muted/40">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-fintech" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="relative flex flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary-foreground/15 backdrop-blur flex items-center justify-center">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold tracking-tight text-lg">{COMPLIANCE_CONFIG.companyName}</p>
              <p className="text-xs text-primary-foreground/70 tracking-wider">Premium Loan Operations</p>
            </div>
          </div>
          <div className="max-w-md">
            <h2 className="text-3xl font-bold leading-tight">Create your account.</h2>
            <p className="mt-3 text-primary-foreground/80">
              Apply for loans, review your Key Facts Statement (KFS), view schedules, and make payments seamlessly.
            </p>
          </div>
          <div className="text-xs text-primary-foreground/60 flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>DPDP Act 2023 Compliant · Encrypted KYC</span>
          </div>
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-6 justify-center">
            <div className="h-10 w-10 rounded-xl bg-gradient-fintech flex items-center justify-center text-primary-foreground">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold leading-none">{COMPLIANCE_CONFIG.companyName}</p>
              <p className="text-[10px] text-muted-foreground tracking-wider mt-0.5">Premium Loan Operations</p>
            </div>
          </div>

          <Card className="rounded-2xl shadow-premium">
            <CardContent className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold tracking-tight">Sign up</h1>
              <p className="text-sm text-muted-foreground mt-1.5">Create your account to apply for a loan.</p>

              <form onSubmit={submit} className="mt-5 space-y-4" aria-describedby={error ? 'signup-error' : undefined} noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                      autoComplete="name"
                      required
                      aria-invalid={error ? 'true' : undefined}
                      aria-describedby={error ? 'signup-error' : undefined}
                      className="pl-9 h-11 min-h-[44px] rounded-xl text-base"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="mobile"
                      type="tel"
                      inputMode="numeric"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="9876543210"
                      autoComplete="tel"
                      required
                      minLength={10}
                      maxLength={15}
                      aria-invalid={error ? 'true' : undefined}
                      aria-describedby={error ? 'signup-error' : undefined}
                      className="pl-9 h-11 min-h-[44px] rounded-xl text-base"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      minLength={10}
                      aria-invalid={error ? 'true' : undefined}
                      aria-describedby={error ? 'signup-error' : undefined}
                      className="pl-9 pr-11 h-11 min-h-[44px] rounded-xl text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      aria-label={showPass ? 'Hide secret characters' : 'Show secret characters'}
                      className="absolute right-0 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-xl"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {needsClaimCode && (
                  <div className="space-y-1.5 rounded-xl border border-warning/40 bg-warning/10 p-3.5">
                    <Label htmlFor="claimCode">Claim Code (from your lender/agent)</Label>
                    <Input
                      id="claimCode"
                      value={claimCode}
                      onChange={(e) => setClaimCode(e.target.value)}
                      placeholder="Enter claim code"
                      autoComplete="one-time-code"
                      className="h-11 min-h-[44px] rounded-xl text-base bg-background"
                    />
                    <p className="text-xs text-muted-foreground">Required because a borrower record already exists for this mobile number. The code proves the record is yours.</p>
                  </div>
                )}

                {/* Unbundled DPDP Act 2023 Consents */}
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-2.5 text-xs">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    DPDP Act, 2023 Explicit Consents (v{COMPLIANCE_CONFIG.policyVersion})
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
                      <strong className="text-foreground">[Required]</strong> I explicitly consent to the collection and processing of my personal data for loan origination, KYC, and servicing in accordance with the{' '}
                      <Link href="/privacy" className="text-primary underline underline-offset-2">
                        Privacy Policy (v{COMPLIANCE_CONFIG.policyVersion})
                      </Link>
                      .
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={consentTerms}
                      onChange={(e) => setConsentTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
                      required
                    />
                    <span>
                      <strong className="text-foreground">[Required]</strong> I confirm I am an Indian resident aged 18+ years and agree to the{' '}
                      <Link href="/terms" className="text-primary underline underline-offset-2">
                        Terms &amp; Conditions
                      </Link>{' '}
                      and{' '}
                      <Link href="/fair-practices" className="text-primary underline underline-offset-2">
                        Fair Practices Code
                      </Link>
                      .
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
                      <strong className="text-foreground">[Optional]</strong> Send me promotional credit offers and financial updates via WhatsApp/SMS (withdrawable anytime from Profile).
                    </span>
                  </label>
                </div>

                {error && (
                  <motion.div
                    id="signup-error"
                    role="alert"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3 py-2"
                  >
                    {error}
                  </motion.div>
                )}

                <Button type="submit" disabled={busy} className="w-full h-11 min-h-[44px] rounded-xl text-base">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create Account <ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
              </form>

              <div className="mt-5 space-y-2 text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  <Link href="/" className="hover:text-foreground underline underline-offset-2">&larr; Back to home</Link>
                </p>
              </div>
            </CardContent>
          </Card>

          <LegalFooter compact className="mt-6" />
        </motion.div>
      </main>
    </div>
  )
}
