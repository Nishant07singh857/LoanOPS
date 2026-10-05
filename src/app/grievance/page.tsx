// TODO: LEGAL REVIEW REQUIRED — Ensure Nodal Grievance Officer name, phone, and address are configured via environment variables before production launch.
import * as React from 'react'
import Link from 'next/link'
import { Headphones, ArrowLeft, AlertTriangle, Mail, Phone, MapPin, ExternalLink, ShieldCheck, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'
import { LegalFooter } from '@/components/legal/legal-footer'

export const metadata = {
  title: `Grievance Redressal Mechanism | ${COMPLIANCE_CONFIG.companyName}`,
  description: 'Multi-tier Grievance Redressal Mechanism, Nodal Officer Contact, and RBI Ombudsman Escalation.',
}

export default function GrievancePage() {
  const { grievanceOfficer } = COMPLIANCE_CONFIG

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
            <Link href="/grievance" className="text-primary font-semibold underline underline-offset-4">Grievance</Link>
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
              RBI Digital Lending &amp; DPDP Act Grievance Redressal Disclosure
            </p>
            <p className="text-muted-foreground leading-relaxed">
              In compliance with the Reserve Bank of India (RBI) Digital Lending Guidelines and Section 13 of the Digital Personal Data Protection (DPDP) Act, 2023, {COMPLIANCE_CONFIG.companyName} maintains a time-bound, 3-tier Grievance Redressal Mechanism with a designated Nodal Grievance Redressal &amp; Data Protection Officer.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
            <Headphones className="h-3.5 w-3.5" />
            Resolution SLA: {grievanceOfficer.responseTimelineDays} Days Initial · {grievanceOfficer.resolutionTimelineDays} Days Maximum
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
            Grievance Redressal Mechanism
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            We are committed to resolving borrower complaints regarding loan terms, disbursements, payment allocation, field agent conduct, and personal data privacy fairly and promptly.
          </p>
        </div>

        {/* Designated Nodal Grievance Officer Card */}
        <Card className="rounded-2xl border-primary/30 shadow-sm">
          <CardHeader className="bg-primary/5 border-b border-border/60 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Designated Nodal Grievance Redressal &amp; Data Protection Officer
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Officer Name</p>
              <p className="font-semibold text-foreground mt-0.5">{grievanceOfficer.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{grievanceOfficer.designation}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Direct Contact</p>
              <p className="flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <a href={`mailto:${grievanceOfficer.email}`} className="text-primary underline font-medium">
                  {grievanceOfficer.email}
                </a>
              </p>
              <p className="flex items-center gap-2 mt-1">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium">{grievanceOfficer.phone}</span>
              </p>
            </div>
            <div className="sm:col-span-2 pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Office Address</p>
              <p className="flex items-start gap-2 mt-1 text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{grievanceOfficer.address}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 3-Tier Escalation Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Tier 1 · Customer Support</span>
              <CardTitle className="text-base mt-1">In-App Support Desk</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              <p>
                Raise a ticket directly from your <strong>Candidate Portal &rarr; Support</strong> or contact our support desk:
              </p>
              <p className="text-foreground font-medium">Email: {COMPLIANCE_CONFIG.supportEmail}</p>
              <p className="text-foreground font-medium">Phone: {COMPLIANCE_CONFIG.supportPhone}</p>
              <div className="pt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                <Clock className="h-3.5 w-3.5" /> Acknowledgement: 48 hrs · Resolution: 7 business days
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Tier 2 · Nodal Officer</span>
              <CardTitle className="text-base mt-1">Grievance &amp; DPO Escalation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              <p>
                If you are not satisfied with Tier 1 resolution within 7 days, escalate with your Ticket Number to the Nodal Officer:
              </p>
              <p className="text-foreground font-medium">Email: {grievanceOfficer.email}</p>
              <p className="text-foreground font-medium">Phone: {grievanceOfficer.phone}</p>
              <div className="pt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                <Clock className="h-3.5 w-3.5" /> Resolution SLA: Within 15 business days
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Tier 3 · Regulatory</span>
              <CardTitle className="text-base mt-1">RBI Ombudsman &amp; DPB</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              <p>
                If your complaint remains unresolved after <strong>30 calendar days</strong>, you may escalate to the Reserve Bank — Integrated Ombudsman Scheme (RB-IOS):
              </p>
              <p>
                <a
                  href={COMPLIANCE_CONFIG.rbiOmbudsmanPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline font-medium"
                >
                  RBI CMS Portal (cms.rbi.org.in) <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              <p className="text-xs">
                Toll-Free RBI CRPC: <strong>14448</strong> · For personal data breaches/rights under DPDP Act 2023, you may also escalate to the <strong>Data Protection Board of India</strong>.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <LegalFooter />
    </div>
  )
}
