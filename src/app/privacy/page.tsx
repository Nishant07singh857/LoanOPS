// TODO: LEGAL REVIEW REQUIRED — Must be reviewed by qualified Indian legal counsel before commercial launch.
import * as React from 'react'
import Link from 'next/link'
import { ShieldCheck, Lock, FileText, ArrowLeft, AlertTriangle, CheckCircle2, UserCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'
import { LegalFooter } from '@/components/legal/legal-footer'

export const metadata = {
  title: `Privacy Policy (DPDP Act 2023) | ${COMPLIANCE_CONFIG.companyName}`,
  description: 'Digital Personal Data Protection Act, 2023 (India) & RBI Digital Lending Privacy Policy.',
}

export default function PrivacyPolicyPage() {
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
            <Link href="/privacy" className="text-primary font-semibold underline underline-offset-4">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/kfs" className="hover:text-foreground">KFS &amp; APR</Link>
            <Link href="/grievance" className="hover:text-foreground">Grievance</Link>
            <Link href="/fair-practices" className="hover:text-foreground">Fair Practices</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:py-12 space-y-6">
        {/* Legal Counsel Review Notice Banner */}
        <div
          role="note"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 text-xs sm:text-sm"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Regulatory &amp; Legal Review Notice (DPDP Act 2023 &amp; RBI Digital Lending)
            </p>
            <p className="text-muted-foreground leading-relaxed">
              This Privacy Policy template is structured for compliance with India&apos;s Digital Personal Data Protection (DPDP) Act, 2023 and RBI Digital Lending Guidelines. Before commercial launch, ensure your company CIN ({COMPLIANCE_CONFIG.cinNumber}), Regulated Entity / NBFC registration ({COMPLIANCE_CONFIG.rbiRegistration}), and Nodal Officer details are configured in environment variables and vetted by qualified Indian legal counsel.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            Policy Version {COMPLIANCE_CONFIG.policyVersion} · Last Updated: {COMPLIANCE_CONFIG.lastUpdated}
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
            Privacy Policy &amp; Data Protection Notice
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Issued by <strong>{COMPLIANCE_CONFIG.companyName}</strong> (&ldquo;Data Fiduciary&rdquo;) in accordance with the Digital Personal Data Protection Act, 2023 (DPDP Act), the Information Technology Act, 2000, and applicable Reserve Bank of India (RBI) directions.
          </p>
        </div>

        {/* Section 1: Categories of Personal Data Collected */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              1. Categories of Personal Data We Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              We collect only the minimum personal data strictly required to onboard borrowers, verify identity (KYC), underwrite and disburse loans, process repayments (including authorized offline cash collections), and fulfill statutory obligations:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Identity &amp; Contact Data:</strong> Full name, mobile number, secondary contact number, email address, date of birth, and residential/business address.
              </li>
              <li>
                <strong className="text-foreground">KYC &amp; Statutory Identifiers:</strong> Permanent Account Number (PAN), masked Aadhaar number (only the last 4 digits and a cryptographic SHA-256 hash are stored for deduplication; full Aadhaar is never stored in plaintext), and uploaded KYC document proofs.
              </li>
              <li>
                <strong className="text-foreground">Financial &amp; Bank Account Data:</strong> Bank name, bank account number (encrypted at rest using AES-256-GCM), IFSC code, UPI ID, declared monthly income, occupation, employer, and existing credit obligations.
              </li>
              <li>
                <strong className="text-foreground">Transaction &amp; Servicing Records:</strong> Loan applications, Key Facts Statements (KFS), signed agreements, repayment schedules, online/offline payment records, official digital receipts, and field agent follow-up logs.
              </li>
              <li>
                <strong className="text-foreground">Technical &amp; Security Audit Data:</strong> IP address, browser user-agent, session identifiers, and timestamped consent/audit records required for cybersecurity and regulatory audits.
              </li>
            </ul>
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-foreground">
              <strong>Strict Mobile Privacy Guarantee (RBI Digital Lending Compliance):</strong> We <strong>never</strong> access your mobile phone contact list, call logs, SMS inbox, photo gallery, or background location. Document uploads are one-time, user-initiated file selections only.
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Purpose & Lawful Basis */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              2. Purpose &amp; Lawful Basis of Processing (DPDP Act, 2023)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Under Sections 4 and 6 of the DPDP Act, 2023, we process your personal data based on your <strong>free, specific, informed, unconditional, and unambiguous consent</strong> (captured via unbundled checkboxes) and for legitimate statutory uses:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Verifying your identity and eligibility under RBI Know Your Customer (KYC) and Prevention of Money Laundering Act (PMLA) norms.</li>
              <li>Generating your Key Facts Statement (KFS), executing your loan agreement, and disbursing funds directly to your verified bank account.</li>
              <li>Processing installment repayments, issuing verifiable digital receipts for field cash collections, and maintaining accurate double-entry financial ledgers.</li>
              <li>Communicating transactional reminders, payment confirmations, and grievance updates. Optional promotional communications are sent only if you grant separate optional consent.</li>
              <li>Complying with statutory reporting to Credit Information Companies (CICs), tax authorities, law enforcement, and the Reserve Bank of India.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 3: Data Storage Localization, Encryption & Security */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              3. Technical Security Safeguards &amp; Data Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              In accordance with Section 8(5) of the DPDP Act, 2023, we implement reasonable security safeguards to prevent personal data breaches:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Field-Level Encryption at Rest:</strong> Sensitive KYC identifiers (PAN, Bank Account Numbers) are encrypted at the application layer using <strong>AES-256-GCM</strong> with authenticated encryption tags before database persistence.
              </li>
              <li>
                <strong className="text-foreground">Aadhaar Minimization:</strong> Full 12-digit Aadhaar numbers are never stored in plaintext; only the last 4 digits (`XXXX-XXXX-1234`) and a salted/keyed hash are retained.
              </li>
              <li>
                <strong className="text-foreground">Role-Based Access Control (RBAC):</strong> Strict tenant isolation and role-based permissions ensure that Owners, Field Agents, and Candidates can only access authorized records. Every unmasking of PII is recorded in an append-only <code className="font-mono text-xs">AuditLog</code>.
              </li>
              <li>
                <strong className="text-foreground">Transport &amp; Session Security:</strong> All data in transit is protected via TLS/HTTPS, and sessions use <code className="font-mono text-xs">httpOnly</code>, <code className="font-mono text-xs">SameSite=Lax</code> cookies backed by HMAC-SHA256 server-side tokens.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 4: Data Principal Rights */}
        <Card className="rounded-2xl shadow-sm border-primary/25">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              4. Your Rights as a Data Principal (Sections 11–14, DPDP Act 2023)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              You may exercise the following rights directly from your <strong>Candidate Portal &rarr; My Profile &rarr; Privacy &amp; Data Rights</strong> section or by contacting our Nodal Grievance &amp; Data Protection Officer:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Right to Access &amp; Data Portability (Section 11):</strong> Obtain a complete summary and machine-readable JSON export of your personal data, active consents, applications, loans, and payment receipts.
              </li>
              <li>
                <strong className="text-foreground">Right to Correction &amp; Updating (Section 12):</strong> Request correction of inaccurate or misleading personal data or completion of incomplete profile records.
              </li>
              <li>
                <strong className="text-foreground">Right to Erasure / Deletion (Section 12(3)):</strong> Request erasure of your personal data once your loan is closed and no active repayment obligations remain, subject to statutory retention mandates under RBI/PMLA laws.
              </li>
              <li>
                <strong className="text-foreground">Right to Withdraw Consent (Section 6(4)):</strong> Withdraw optional communication consents at any time with a single click. Withdrawing core processing consent prior to loan disbursement will cancel pending applications; after disbursement, core loan servicing continues until repayment closure as required by contract and law.
              </li>
              <li>
                <strong className="text-foreground">Right of Grievance Redressal (Section 13) &amp; Nomination (Section 14):</strong> Lodge a privacy complaint with our Grievance Officer and nominate an individual to exercise your rights in the event of death or incapacity.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 5: Data Retention, Third-Party Sharing, Children & Cookies */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              5. Data Retention, Statutory Preservation &amp; Disclosures
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Statutory Retention (RBI &amp; PMLA):</strong> While non-essential personal data is erased or anonymized upon a valid deletion request after loan closure, financial ledger entries, loan agreements, KYC audit trails, and repayment receipts must be retained for the statutory period mandated under the Prevention of Money Laundering Act (PMLA), 2002 (minimum 5 to 8 years from cessation of business relationship) and Income Tax Act, 1961.
            </p>
            <p>
              <strong className="text-foreground">Third-Party Sharing:</strong> We do not sell or rent your personal data. Data is shared only with regulated lending partners, Credit Information Companies (CICs), authorized payment/SMS gateways, and statutory/regulatory authorities strictly on a need-to-know basis.
            </p>
            <p>
              <strong className="text-foreground">Prohibition on Children&apos;s Data (Section 9):</strong> Our services are strictly restricted to Indian residents aged 18 years or older. We do not knowingly collect or process personal data of individuals under 18 years of age.
            </p>
            <p>
              <strong className="text-foreground">Cookie Policy:</strong> We use only strictly necessary <code className="font-mono text-xs">httpOnly</code> session cookies to maintain your authenticated session. No third-party behavioral advertising cookies are deployed.
            </p>
          </CardContent>
        </Card>

        {/* Section 6: Data Protection & Grievance Officer */}
        <Card className="rounded-2xl bg-muted/40 border-border">
          <CardContent className="p-5 sm:p-6 space-y-2 text-xs sm:text-sm">
            <h2 className="font-bold text-base text-foreground">
              6. Contact Our Data Protection &amp; Nodal Grievance Officer
            </h2>
            <p className="text-muted-foreground">
              For any privacy inquiries, consent withdrawal, or DPDP Act rights requests, contact:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-muted-foreground">
              <p><strong className="text-foreground">Name:</strong> {COMPLIANCE_CONFIG.grievanceOfficer.name}</p>
              <p><strong className="text-foreground">Designation:</strong> {COMPLIANCE_CONFIG.grievanceOfficer.designation}</p>
              <p><strong className="text-foreground">Email:</strong> {COMPLIANCE_CONFIG.grievanceOfficer.email}</p>
              <p><strong className="text-foreground">Phone:</strong> {COMPLIANCE_CONFIG.grievanceOfficer.phone}</p>
              <p className="sm:col-span-2"><strong className="text-foreground">Address:</strong> {COMPLIANCE_CONFIG.grievanceOfficer.address}</p>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              If your privacy grievance is not resolved within {COMPLIANCE_CONFIG.grievanceOfficer.resolutionTimelineDays} days, you have the right to approach the <strong>Data Protection Board of India</strong> established under the DPDP Act, 2023.
            </p>
          </CardContent>
        </Card>
      </main>

      <LegalFooter />
    </div>
  )
}
