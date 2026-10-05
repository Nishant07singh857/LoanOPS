// TODO: LEGAL REVIEW REQUIRED — Must be reviewed by qualified Indian legal counsel before commercial launch.
import * as React from 'react'
import Link from 'next/link'
import { Scale, ArrowLeft, AlertTriangle, Banknote, ShieldAlert, CheckCircle2, FileCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'
import { LegalFooter } from '@/components/legal/legal-footer'

export const metadata = {
  title: `Terms & Conditions | ${COMPLIANCE_CONFIG.companyName}`,
  description: 'Terms of Use, Borrower Obligations, and Offline Cash Collection Rules.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/30">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild className="h-9">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Home
            </Link>
          </Button>
          <nav aria-label="Legal pages" className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="text-primary font-semibold underline underline-offset-4">Terms</Link>
            <Link href="/kfs" className="hover:text-foreground">KFS &amp; APR</Link>
            <Link href="/grievance" className="hover:text-foreground">Grievance</Link>
            <Link href="/fair-practices" className="hover:text-foreground">Fair Practices</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:py-12 space-y-6">
        <div
          role="note"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 text-xs sm:text-sm"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Legal Review &amp; Regulatory Partnership Notice
            </p>
            <p className="text-muted-foreground leading-relaxed">
              These Terms &amp; Conditions govern the use of the {COMPLIANCE_CONFIG.companyName} platform and offline/online repayment workflows. All credit facilities are subject to a signed Loan Agreement and Key Facts Statement (KFS) issued in compliance with RBI norms ({COMPLIANCE_CONFIG.rbiRegistration}).
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
            <Scale className="h-3.5 w-3.5" />
            Version {COMPLIANCE_CONFIG.policyVersion} · Effective: {COMPLIANCE_CONFIG.lastUpdated}
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
            Terms &amp; Conditions of Use
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Please read these Terms &amp; Conditions carefully before registering an account, submitting a loan application, or making repayments on <strong>{COMPLIANCE_CONFIG.companyName}</strong>.
          </p>
        </div>

        {/* Section 1: Eligibility & Account Registration */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              1. Borrower Eligibility &amp; Account Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Eligibility:</strong> You must be a citizen and resident of India, at least <strong>18 years of age</strong>, and competent to contract under the Indian Contract Act, 1872.
              </li>
              <li>
                <strong className="text-foreground">True &amp; Accurate Information:</strong> You undertake that all personal, employment, income, bank account, PAN, and KYC details submitted by you are true, accurate, and belong exclusively to you. Submitting forged or third-party KYC documents is a punishable offence.
              </li>
              <li>
                <strong className="text-foreground">Account Credentials:</strong> You are responsible for maintaining the confidentiality of your login password and mobile access. Notify customer support immediately if you suspect unauthorized access.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 2: Loan Sanction, KFS & Cooling-Off */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              2. Loan Sanction, Key Facts Statement (KFS) &amp; Disbursement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Submitting an application does not guarantee loan approval. Every approved loan is governed by a facility-specific <strong>Key Facts Statement (KFS)</strong> and <strong>Loan Agreement</strong> accepted by the Borrower prior to disbursement:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Direct Bank Disbursement:</strong> Loan proceeds are disbursed directly into the Borrower&apos;s verified bank account (or documented with verifiable disbursement proof) without routing through unauthorized third-party pool accounts.
              </li>
              <li>
                <strong className="text-foreground">3-Day Cooling-Off / Look-Up Period:</strong> Within {COMPLIANCE_CONFIG.coolingOffDays} calendar days of disbursement, the Borrower may exit the loan by repaying the principal amount plus proportionate Annual Percentage Rate (APR) for the days elapsed, without any foreclosure or prepayment penalty.
              </li>
              <li>
                <strong className="text-foreground">Allocation Order:</strong> Unless otherwise mandated by regulatory directions, repayments are allocated chronologically across installments in the order of: <em>Fees &rarr; Interest &rarr; Principal</em>.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 3: Offline Cash Repayments & Mandatory Digital Receipts */}
        <Card className="rounded-2xl shadow-sm border-primary/25">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              3. Offline Cash Repayments &amp; Mandatory Digital Receipt Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Because our operations support field-assisted collections alongside digital repayments, the following strict safeguards protect both Borrowers and the Platform:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Authorized Field Agents Only:</strong> Offline cash repayments may only be handed over to the authorized Field Agent assigned to your account in your Candidate Portal, and strictly within permitted collection hours (<strong>{COMPLIANCE_CONFIG.collectionHours}</strong>).
              </li>
              <li>
                <strong className="text-foreground">Mandatory Digital Recording &amp; Receipt:</strong> Every cash payment collected by an Agent is recorded in the platform (`PENDING_VERIFICATION`) and generates an official numbered digital receipt (`RCP-...`) upon verification. Borrowers must always verify that the payment appears in their <strong>Candidate Portal &rarr; Payments / Receipts</strong> tab.
              </li>
              <li>
                <strong className="text-foreground">Prohibition on Unofficial Transfers:</strong> Borrowers must <strong>never</strong> transfer money to the personal UPI ID or personal bank account of any employee or field agent, nor pay any undisclosed &ldquo;commission&rdquo; or &ldquo;visit fee.&rdquo;
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 4: Default, Ethical Recovery & Governing Law */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              4. Default, Ethical Recovery, Liability &amp; Governing Law
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Ethical Collections &amp; Recovery:</strong> In the event of overdue installments, reminders and field follow-ups will be conducted strictly in accordance with our <Link href="/fair-practices" className="text-primary underline">Fair Practices Code</Link> and RBI guidelines. We prohibit harassment, intimidation, abusive language, or contacting borrowers outside {COMPLIANCE_CONFIG.collectionHours}.
            </p>
            <p>
              <strong className="text-foreground">Credit Bureau Reporting &amp; Legal Remedies:</strong> Continued default may be reported to registered Credit Information Companies (CICs), which may impact your credit score, and may result in lawful recovery proceedings under applicable Indian laws.
            </p>
            <p>
              <strong className="text-foreground">Limitation of Liability:</strong> To the maximum extent permitted by law, the platform shall not be liable for indirect or consequential damages arising from network outages or third-party banking delays.
            </p>
            <p>
              <strong className="text-foreground">Governing Law &amp; Jurisdiction:</strong> These Terms and all loan transactions shall be governed by the laws of the Republic of India. Subject to statutory arbitration or Ombudsman rights, courts in <strong>{COMPLIANCE_CONFIG.jurisdiction}</strong> shall have exclusive jurisdiction.
            </p>
          </CardContent>
        </Card>
      </main>

      <LegalFooter />
    </div>
  )
}
