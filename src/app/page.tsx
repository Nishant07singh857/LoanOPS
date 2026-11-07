import type { Metadata } from 'next'
import {
  ShieldCheck, ArrowRight, Wallet, ClipboardList, HandCoins, BellRing,
  Users, BarChart3, LifeBuoy, Lock, Workflow, Landmark, UserCog, User,
  FileCheck2, CalendarClock, ScrollText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { JsonLd } from '@/components/json-ld'
import { LegalFooter } from '@/components/legal/legal-footer'
import { CookieBanner } from '@/components/legal/cookie-banner'
import { EnquiryForm } from '@/components/enquiry-form'

// Public product homepage. This page is the company's front door:
// what LoanOps is, who it is for, what it does — and an enquiry
// form. It deliberately carries NO portal entry points: the staff
// and borrower areas are reached by their own direct addresses,
// not from the public website.

const PAGE_TITLE = 'LoanOps — Loan Management Software for Lending Businesses'
const PAGE_DESCRIPTION =
  'LoanOps is loan operations software for NBFCs, microfinance institutions and lending businesses — applications, approval, disbursal, EMI schedules, collections, automatic reminders, reports and audit in one platform. Enquire to get started.'

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    type: 'website',
    locale: 'en_US',
    siteName: 'LoanOps',
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
}

const FEATURES = [
  {
    icon: <Workflow className="h-5 w-5" />,
    title: 'Complete loan lifecycle',
    desc: 'Applications, approval, disbursal and EMI schedules in one flow — every amount computed in integer paise on the server, never in floats.',
  },
  {
    icon: <HandCoins className="h-5 w-5" />,
    title: 'Collections with agent tasks',
    desc: 'Field agents get daily collection tasks; cash collections are recorded, verified by the owner and allocated to instalments in real time.',
  },
  {
    icon: <CalendarClock className="h-5 w-5" />,
    title: 'Promise-to-pay tracking',
    desc: 'Borrower promises, follow-ups and escalations are tracked against each loan, so no commitment made in the field slips through.',
  },
  {
    icon: <BellRing className="h-5 w-5" />,
    title: 'Automatic payment reminders',
    desc: 'Due-soon, due-today and overdue reminders are generated on a schedule and delivered in the borrower portal, with follow-up tasks for your team.',
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: 'Role-based panels',
    desc: 'Separate owner, agent and borrower panels with role-based access — owners see the whole business, agents their work, borrowers only their own loans.',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: 'Reports & reconciliation',
    desc: 'Portfolio, collections and overdue-ageing reports on top of a double-entry ledger, so the day closes reconciled, not guessed.',
  },
  {
    icon: <LifeBuoy className="h-5 w-5" />,
    title: 'Borrower support tickets',
    desc: 'Borrowers raise support tickets from their own panel; your team tracks every ticket from open to resolved.',
  },
  {
    icon: <Lock className="h-5 w-5" />,
    title: 'Security & audit',
    desc: 'KYC and personal data encrypted at rest, and an append-only audit trail records who did what, and when.',
  },
]

const PANELS = [
  {
    icon: <Landmark className="h-6 w-6" />,
    title: 'For owners',
    desc: 'Portfolio KPIs, loan origination and approvals, disbursements, reconciliation, reports and the complete audit trail — the whole business at a glance.',
    points: ['Portfolio & collections KPIs', 'Approvals & disbursement control', 'Ledger, reconciliation & reports'],
  },
  {
    icon: <UserCog className="h-6 w-6" />,
    title: 'For field agents',
    desc: 'A mobile-first working day: today\'s collection tasks, borrower follow-ups, promise-to-pay tracking and cash collection from the field.',
    points: ['Daily task list', 'Cash collection & receipts', 'Follow-ups, PTP & escalations'],
  },
  {
    icon: <User className="h-6 w-6" />,
    title: 'For borrowers',
    desc: 'A private panel for every borrower: application status, KYC and agreement, their loan schedule, payment receipts and support.',
    points: ['Application & KYC status', 'Loan schedule & receipts', 'Support tickets & reminders'],
  },
]

const STEPS = [
  {
    title: 'Enquire',
    desc: 'Tell us about your lending business using the enquiry form below — how many borrowers and agents you have, and what you want to run better.',
  },
  {
    title: 'Set up your organisation',
    desc: 'Your loan products, agreement templates and team — owners and field agents — are configured on the platform.',
  },
  {
    title: 'Onboard borrowers',
    desc: 'Share application links or QR codes. Borrowers apply, complete KYC and accept their agreement digitally; you approve and disburse.',
  },
  {
    title: 'Run daily operations',
    desc: 'Collect EMIs, track promises and automatic reminders, support borrowers, and close every day with reconciled reports.',
  },
]

const SECURITY_POINTS = [
  { title: 'Encrypted KYC & PII', desc: 'Aadhaar, PAN and bank details are encrypted at rest (AES-256-GCM) and masked in everyday views.' },
  { title: 'Role-based access', desc: 'Every panel and API enforces roles server-side; a borrower can never reach owner or agent data.' },
  { title: 'Append-only audit trail', desc: 'Sign-ins, approvals, collections and corrections are recorded in an audit log that cannot be quietly edited.' },
  { title: 'DPDP-conscious by design', desc: 'Consents are recorded at application time and borrower data requests are handled inside the platform.' },
]

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/40">
      {/* Homepage-only JSON-LD (Organization + SoftwareApplication). */}
      <JsonLd />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <a href="#top" className="flex items-center gap-2.5" aria-label="LoanOps — back to top">
            <span className="h-9 w-9 rounded-xl bg-gradient-fintech flex items-center justify-center text-primary-foreground shadow-glow">
              <Wallet className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-bold tracking-tight leading-none text-base">LoanOps</span>
              <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Loan Operations Platform</span>
            </span>
          </a>
          <nav aria-label="Homepage sections" className="flex items-center gap-1 sm:gap-2">
            <a href="#features" className="hidden sm:inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Features</a>
            <a href="#how-it-works" className="hidden md:inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">How it works</a>
            <a href="#security" className="hidden sm:inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Security</a>
            <Button asChild size="sm" className="h-9 rounded-lg shadow-glow ml-1">
              <a href="#enquire">Enquire</a>
            </Button>
          </nav>
        </div>
      </header>

      <main id="top" className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-info/10 pointer-events-none" />
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-10 sm:pb-14 relative">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium mb-5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Loan management software for lending businesses
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                Loan operations,
                <br className="hidden sm:block" />
                <span className="text-gradient-primary"> end-to-end.</span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                LoanOps is the operations platform for NBFCs, microfinance institutions and lending
                businesses — from a borrower&apos;s first application to the final EMI, with collections,
                automatic reminders, reports and a full audit trail built in.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button asChild size="lg" className="w-full sm:w-auto h-12 text-base rounded-xl shadow-glow">
                  <a href="#enquire">Enquire now <ArrowRight className="ml-2 h-4 w-4" /></a>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto h-12 text-base rounded-xl">
                  <a href="#features">Explore features</a>
                </Button>
              </div>
              <p className="mt-5 text-xs sm:text-sm text-muted-foreground">
                Built for lending teams of every size — single-branch lenders to multi-agent field operations.
              </p>
            </div>
          </div>
        </section>

        {/* Lifecycle strip */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full" aria-label="The complete loan lifecycle">
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-max sm:min-w-0 sm:justify-center">
              {[
                'Application', 'KYC', 'Agreement', 'Approval', 'Disbursement',
                'EMI Schedule', 'Collection', 'Ledger', 'Receipt', 'Closure',
              ].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-2 sm:gap-3">
                  <span className="flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-card border border-border text-xs sm:text-sm font-medium shadow-sm">
                    {step}
                  </span>
                  {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full scroll-mt-20">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold">Everything a lending business runs on</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              One platform for the full operation — origination, servicing, collections and compliance.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {FEATURES.map((f) => (
              <Card key={f.title} className="rounded-xl border bg-card hover:shadow-premium transition-shadow h-full">
                <CardContent className="p-4 sm:p-5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base mt-3">{f.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-snug">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Panels — what each role gets (descriptive only; no entry points) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold">One platform, three panels</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Owners, field agents and borrowers each get a panel shaped to their work — and fenced to their role.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {PANELS.map((p) => (
              <Card key={p.title} className="rounded-2xl border bg-card hover:shadow-premium transition-shadow h-full">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-fintech text-primary-foreground flex items-center justify-center shadow-glow">
                    {p.icon}
                  </div>
                  <h3 className="text-xl font-bold mt-4">{p.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{p.desc}</p>
                  <ul className="mt-4 space-y-1.5">
                    {p.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm">
                        <FileCheck2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full scroll-mt-20">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold">How it works</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">From first enquiry to a fully digital lending operation.</p>
          </div>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 list-none">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Card className="rounded-xl border bg-card h-full">
                  <CardContent className="p-4 sm:p-5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {i + 1}
                    </span>
                    <h3 className="font-semibold text-sm sm:text-base mt-3">{s.title}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-snug">{s.desc}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* Security strip */}
        <section id="security" className="w-full bg-card/60 border-y border-border/60 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold leading-tight">Security &amp; trust</h2>
                <p className="text-sm text-muted-foreground">Borrower data is money-grade data. LoanOps treats it that way.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              {SECURITY_POINTS.map((s) => (
                <div key={s.title} className="rounded-xl border border-border bg-background p-4 sm:p-5">
                  <h3 className="font-semibold text-sm sm:text-base">{s.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-snug">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Enquire */}
        <section id="enquire" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full scroll-mt-20">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium mb-4">
                <ClipboardList className="h-3.5 w-3.5" />
                Get started
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold leading-tight">Enquire about LoanOps</h2>
              <p className="text-muted-foreground mt-3 text-sm sm:text-base leading-relaxed">
                Tell us about your lending business and what you want to manage better. We will reach
                out on your mobile number to walk you through the platform and discuss setup for your
                organisation.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex items-start gap-2"><ScrollText className="h-4 w-4 text-success shrink-0 mt-0.5" /> No obligation — the enquiry is only a conversation.</li>
                <li className="flex items-start gap-2"><ScrollText className="h-4 w-4 text-success shrink-0 mt-0.5" /> Your details are used only to respond to this enquiry.</li>
              </ul>
            </div>
            <div className="lg:col-span-3">
              <Card className="rounded-2xl border bg-card shadow-premium">
                <CardContent className="p-5 sm:p-7">
                  <EnquiryForm />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer & Legal Compliance */}
      <LegalFooter />
      <CookieBanner />
    </div>
  )
}
