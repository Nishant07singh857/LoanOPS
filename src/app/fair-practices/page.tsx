// TODO: LEGAL REVIEW REQUIRED — Review Fair Practices Code and Field Agent Code of Conduct with legal counsel prior to production launch.
import * as React from 'react'
import Link from 'next/link'
import { ShieldCheck, ArrowLeft, AlertTriangle, Clock, UserCheck, Ban, Receipt, Scale } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'
import { LegalFooter } from '@/components/legal/legal-footer'

export const metadata = {
  title: `Fair Practices Code & Collection Conduct | ${COMPLIANCE_CONFIG.companyName}`,
  description: 'RBI Fair Practices Code and Field Agent Collection Code of Conduct.',
}

export default function FairPracticesPage() {
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
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/kfs" className="hover:text-foreground">KFS &amp; APR</Link>
            <Link href="/grievance" className="hover:text-foreground">Grievance</Link>
            <Link href="/fair-practices" className="text-primary font-semibold underline underline-offset-4">Fair Practices</Link>
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
              RBI Fair Practices Code &amp; Recovery Conduct Mandate
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Adopted pursuant to the Reserve Bank of India (RBI) Master Direction on Fair Practices Code and RBI Circular on Outsourcing of Financial Services — Responsibilities of Recovery Agents. Every field agent operating on {COMPLIANCE_CONFIG.companyName} is bound by this Code.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            Permitted Collection Window: {COMPLIANCE_CONFIG.collectionHours}
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
            Fair Practices Code &amp; Field Collection Code of Conduct
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Our commitment to transparent lending, non-discriminatory underwriting, dignified borrower interactions, and accountable offline cash collections.
          </p>
        </div>

        {/* Section 1: Transparent Loan Origination & Non-Discrimination */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              1. Fair Origination, Non-Discrimination &amp; KFS Transparency
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Non-Discrimination:</strong> We do not discriminate against any applicant on grounds of religion, caste, sex, marital status, or disability.
              </li>
              <li>
                <strong className="text-foreground">Language &amp; Clarity:</strong> All loan terms, Key Facts Statements (KFS), Annual Percentage Rate (APR), and installment schedules are communicated clearly prior to agreement acceptance.
              </li>
              <li>
                <strong className="text-foreground">Advisory-Only AI:</strong> Automated risk signals on our platform are strictly advisory for human underwriters; no adverse credit decision is taken without human review.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 2: Permitted Contact Hours & Dignified Treatment */}
        <Card className="rounded-2xl shadow-sm border-primary/25">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              2. Strict Contact Hours &amp; Dignified Borrower Treatment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              All telephonic reminders, WhatsApp messages, and in-person field visits by our authorized Field Agents must strictly adhere to RBI Recovery Agent rules:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Permitted Hours Only:</strong> Borrowers may be contacted or visited <strong>strictly between {COMPLIANCE_CONFIG.collectionHours}</strong>. No calls or visits are permitted before 8:00 AM or after 7:00 PM IST.
              </li>
              <li>
                <strong className="text-foreground">Agent Identification:</strong> Field Agents must display their authorized Agent Profile / Employee Code and identify {COMPLIANCE_CONFIG.companyName} clearly at the start of every visit or call.
              </li>
              <li>
                <strong className="text-foreground">Respect for Borrower Privacy:</strong> Agents must never discuss a borrower&apos;s loan or overdue status with neighbors, coworkers, relatives, or unauthorized third parties.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 3: Zero Tolerance for Harassment */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              3. Strictly Prohibited Collection Practices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
            <p>
              We enforce a zero-tolerance policy against coercive recovery. Field Agents are strictly prohibited from:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Using abusive, threatening, humiliating, or intimidating language in person, over phone, or on WhatsApp.</li>
              <li>Harassing family members, friends, or employers, or publicly shaming a borrower on social media or messaging groups.</li>
              <li>Entering a borrower&apos;s residence or workplace without permission or refusing to leave when asked.</li>
              <li>Demanding cash payments without recording the transaction on the platform or demanding personal tips/commissions.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 4: Offline Cash Collection & Digital Receipt Verification */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              4. Mandatory Digital Receipts for Field Cash Collections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
            <p>
              When making an offline cash repayment to your assigned Field Agent:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Verify that the Agent is listed as your <strong>Assigned Agent</strong> in your Candidate Portal.</li>
              <li>Ensure the Agent logs the exact cash amount in the Agent Portal in your presence.</li>
              <li>Check your <strong>Candidate Portal &rarr; Payments &amp; Receipts</strong> section to download your official, tamper-evident digital receipt (`RCP-...`) once verified.</li>
            </ol>
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 text-xs">
              <span className="flex items-center gap-1.5 text-foreground font-medium">
                <UserCheck className="h-4 w-4 text-primary" />
                Report any violation immediately to our Nodal Grievance Officer: {COMPLIANCE_CONFIG.grievanceOfficer.email}
              </span>
              <Button size="sm" variant="outline" asChild className="h-8 text-xs">
                <Link href="/grievance">Lodge a Complaint &rarr;</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <LegalFooter />
    </div>
  )
}
