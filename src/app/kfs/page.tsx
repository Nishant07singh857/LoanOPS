'use client'

// TODO: LEGAL REVIEW REQUIRED — Key Facts Statement (KFS) format & APR calculation disclosures must be verified with the Regulated Entity (RE) partner and legal counsel before live lending.
import * as React from 'react'
import Link from 'next/link'
import { FileText, ArrowLeft, AlertTriangle, Calculator, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'
import { KfsDisclosure } from '@/components/legal/kfs-disclosure'
import { LegalFooter } from '@/components/legal/legal-footer'

export default function KfsPage() {
  const [principalRupees, setPrincipalRupees] = React.useState('50000')
  const [interestPct, setInterestPct] = React.useState('12')
  const [processingFeeRupees, setProcessingFeeRupees] = React.useState('500')
  const [installments, setInstallments] = React.useState('10')
  const [frequency, setFrequency] = React.useState<'MONTHLY' | 'WEEKLY' | 'DAILY'>('MONTHLY')

  const principalPaise = Math.max(0, Math.round((Number(principalRupees) || 0) * 100))
  const interestRateBps = Math.max(0, Math.round((Number(interestPct) || 0) * 100))
  const processingFeePaise = Math.max(0, Math.round((Number(processingFeeRupees) || 0) * 100))
  const instCount = Math.max(1, Math.min(120, Math.round(Number(installments) || 1)))

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
            <Link href="/kfs" className="text-primary font-semibold underline underline-offset-4">KFS &amp; APR</Link>
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
              RBI Key Facts Statement (KFS) &amp; APR Transparency Notice
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Under the Reserve Bank of India (RBI) Guidelines on Digital Lending and Key Facts Statement (KFS) for Loans &amp; Advances, every borrower must receive a standardized KFS before executing a loan contract. Any fee or charge not explicitly mentioned in the KFS cannot be charged to the borrower at any stage during the loan term without explicit consent.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
            <FileText className="h-3.5 w-3.5" />
            Standardized RBI KFS Format · {COMPLIANCE_CONFIG.coolingOffDays}-Day Cooling-Off Period
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
            Key Facts Statement (KFS) &amp; Loan Disclosures
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Transparent disclosure of Annual Percentage Rate (APR), processing fees, net disbursed amount, repayment schedule, cooling-off period, and penal charge policies.
          </p>
        </div>

        {/* Interactive KFS Simulator */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Interactive KFS &amp; APR Calculator (Illustrative Preview)
            </CardTitle>
            <CardDescription className="text-xs">
              Adjust the loan parameters below to inspect how the standardized Key Facts Statement and all-inclusive APR are computed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label htmlFor="kfs-principal" className="text-xs">Principal (₹)</Label>
                <Input
                  id="kfs-principal"
                  type="number"
                  min={1000}
                  value={principalRupees}
                  onChange={(e) => setPrincipalRupees(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="kfs-interest" className="text-xs">Nominal Interest (%)</Label>
                <Input
                  id="kfs-interest"
                  type="number"
                  min={0}
                  step="0.5"
                  value={interestPct}
                  onChange={(e) => setInterestPct(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="kfs-fee" className="text-xs">Processing Fee (₹)</Label>
                <Input
                  id="kfs-fee"
                  type="number"
                  min={0}
                  value={processingFeeRupees}
                  onChange={(e) => setProcessingFeeRupees(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="kfs-installments" className="text-xs">Installments</Label>
                <Input
                  id="kfs-installments"
                  type="number"
                  min={1}
                  max={120}
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="kfs-freq" className="text-xs">Frequency</Label>
                <select
                  id="kfs-freq"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as 'MONTHLY' | 'WEEKLY' | 'DAILY')}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="DAILY">Daily</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live KFS Disclosure Component */}
        <KfsDisclosure
          principalPaise={principalPaise}
          interestType="PERCENTAGE"
          interestRateBps={interestRateBps}
          processingFeePaise={processingFeePaise}
          otherFeesPaise={0}
          installments={instCount}
          frequency={frequency}
          borrowerName="Sample Borrower (Illustrative KFS)"
        />

        {/* Key Borrower Protections */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Mandatory RBI Digital Lending &amp; KFS Borrower Protections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">No Unlisted Charges:</strong> Any fee, charge, or expense not explicitly mentioned in your KFS cannot be recovered from you at any point during the loan tenure.
              </li>
              <li>
                <strong className="text-foreground">Non-Compounding Penal Charges:</strong> In accordance with RBI&apos;s Fair Lending Practice — Penal Charges in Loan Accounts circular, any late payment charge is levied strictly as a transparent, non-compounding penal charge and is never capitalized into principal to compound further interest.
              </li>
              <li>
                <strong className="text-foreground">3-Day Cooling-Off / Look-Up Period:</strong> After loan disbursement, you have {COMPLIANCE_CONFIG.coolingOffDays} calendar days to cancel and exit the loan without any penalty by paying back the principal and the proportionate APR for those days.
              </li>
              <li>
                <strong className="text-foreground">Immutable Snapshot in Candidate Portal:</strong> Once you accept your KFS and Loan Agreement, an immutable snapshot of your KFS terms and installment schedule is permanently accessible in your Candidate Portal under <em>Agreements &amp; Documents</em>.
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>

      <LegalFooter />
    </div>
  )
}
