import type { Metadata } from 'next'
import {
  ShieldCheck, ArrowRight, Wallet, HandCoins, BellRing, Users, BarChart3,
  LifeBuoy, Lock, Workflow, Landmark, UserCog, User, FileCheck2,
  CalendarClock, ScrollText, Sunrise, MapPin, MoonStar, HeartHandshake,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { JsonLd } from '@/components/json-ld'
import { LegalFooter } from '@/components/legal/legal-footer'
import { CookieBanner } from '@/components/legal/cookie-banner'
import { EnquiryForm } from '@/components/enquiry-form'
import { FadeIn } from '@/components/ui/motion'

// Public product homepage — the company's front door, written for the
// people who actually lend: owners of small NBFCs, MFIs and lending
// businesses, their field agents, and their borrowers. It carries
// exactly ONE entry point: the universal "Login" button in the header.
// There are deliberately no separate owner/agent/customer login links —
// one login serves everyone, and the account's role decides what opens.

const PAGE_TITLE = 'LoanOps — Loan Management Software for Lending Businesses'
const PAGE_DESCRIPTION =
  'LoanOps helps NBFCs, microfinance institutions and lending businesses run the daily work of lending with less paper and more clarity — applications, approval, disbursal, EMI schedules, field collections, automatic reminders, honest reports and a full audit trail. Enquire to get started.'

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

const EYEBROW = 'text-xs font-semibold uppercase tracking-[0.16em] text-primary'

const FEATURES = [
  {
    icon: <Workflow className="h-5 w-5" />,
    title: 'Every loan, start to finish',
    desc: 'From a borrower\'s first application to the final EMI — approval, disbursal and the schedule in between, with every amount computed exactly, in paise, on the server. Never in floats, never by hand.',
  },
  {
    icon: <HandCoins className="h-5 w-5" />,
    title: 'Collections your agents can follow',
    desc: 'Each morning, agents get a clear list of visits and dues. Cash collected in the field is recorded on the spot and verified by you — no notebook arithmetic late at night.',
  },
  {
    icon: <CalendarClock className="h-5 w-5" />,
    title: 'Promises, kept in sight',
    desc: 'When a borrower promises to pay on Friday, that promise is written down where the whole team can see it — and followed up in time, instead of slipping away quietly.',
  },
  {
    icon: <BellRing className="h-5 w-5" />,
    title: 'Gentle reminders, sent on time',
    desc: 'Due-soon, due-today and overdue reminders reach borrowers in their own portal, on schedule — a polite nudge before a problem, not a surprise after one. Your team gets follow-up tasks alongside.',
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: 'Everyone sees their own work',
    desc: 'You see the whole business. Agents see their day. Borrowers see only their own loans. Nobody sees what isn\'t theirs to see.',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: 'Month-end without the panic',
    desc: 'Portfolio, collections and overdue-ageing reports sit on a proper double-entry ledger — so when the month ends or the auditor asks, the answers are already ready.',
  },
  {
    icon: <LifeBuoy className="h-5 w-5" />,
    title: 'Borrowers can reach you, properly',
    desc: 'Questions and problems arrive as support tickets from the borrower\'s own panel, tracked from open to resolved — not buried in a chat thread nobody can find later.',
  },
  {
    icon: <Lock className="h-5 w-5" />,
    title: 'A record you can stand behind',
    desc: 'KYC and personal details stay encrypted, and every approval, collection and correction is written into an audit trail that cannot be quietly changed after the fact.',
  },
]

const DAY_MOMENTS = [
  {
    icon: <Sunrise className="h-6 w-6" />,
    time: 'The morning',
    title: 'The day starts clear',
    desc: 'Before the first visit, your agents open one simple list: who to meet today, what is due, which promises fall due. You see yesterday\'s collections already tallied — no register to reconcile over morning tea.',
  },
  {
    icon: <MapPin className="h-6 w-6" />,
    time: 'Out in the field',
    title: 'The field stays in step',
    desc: 'A collection at a borrower\'s doorstep is recorded then and there, and the receipt is shared on the spot. A promise made in the village is visible at the office in the same minute — nobody has to phone it in at night.',
  },
  {
    icon: <MoonStar className="h-6 w-6" />,
    time: 'The evening',
    title: 'The tally matches',
    desc: 'The day closes against the ledger, reconciled — not guessed. Borrowers can check their own schedule and receipts whenever they like, and you go home knowing exactly where the business stands.',
  },
]

const PANELS = [
  {
    icon: <Landmark className="h-6 w-6" />,
    title: 'For the owner',
    desc: 'You built this business to lend well, not to drown in registers. LoanOps gives you the whole picture, honestly — approve with confidence, disburse when you are satisfied, and know on any evening exactly where things stand.',
    points: ['Portfolio & collections at a glance', 'Approvals & disbursement in your hands', 'Ledger, reconciliation & reports that add up'],
  },
  {
    icon: <UserCog className="h-6 w-6" />,
    title: 'For the agent in the field',
    desc: 'Your agents are the face of your business on every street they walk. They get a clear, mobile-first day: visits planned, collections recorded on the spot, and follow-ups that never depend on one person\'s memory.',
    points: ['Today\'s visits & dues, listed clearly', 'Cash collection & receipts from the field', 'Follow-ups, promises & escalations, tracked'],
  },
  {
    icon: <User className="h-6 w-6" />,
    title: 'For the borrower',
    desc: 'A borrower who can see their own loan — what is paid, what is due, every receipt — is a borrower who trusts you. And in lending, that trust is the business.',
    points: ['Their schedule & receipts, always visible', 'Application & KYC status — no need to call and ask', 'Reminders & support in one private place'],
  },
]

const STEPS = [
  {
    title: 'Say hello',
    desc: 'Tell us about your lending business in the enquiry form below — how many borrowers and agents you have, and what eats up your day. No obligation; it is just a conversation.',
  },
  {
    title: 'We set up your corner',
    desc: 'Your loan products, agreement templates and your team — owners and field agents — are set up on the platform, shaped around how you already work.',
  },
  {
    title: 'Borrowers come on board',
    desc: 'Share an application link or a QR code. Borrowers apply, complete KYC and accept their agreement digitally; you approve and disburse when you are satisfied.',
  },
  {
    title: 'Then, just run the day',
    desc: 'Collect EMIs, follow up promises, let reminders go out on time, support your borrowers — and close every day with reports that already reconcile.',
  },
]

const SECURITY_POINTS = [
  { title: 'Encrypted, always', desc: 'Aadhaar, PAN and bank details are encrypted at rest (AES-256-GCM) and masked in everyday screens.' },
  { title: 'Only the right eyes', desc: 'Every panel and API enforces roles on the server — a borrower can never reach owner or agent data.' },
  { title: 'Nothing quietly changed', desc: 'Sign-ins, approvals, collections and corrections are recorded in an append-only audit trail.' },
  { title: 'Consent, recorded', desc: 'Built with the DPDP Act in mind — consents are recorded at application time, and borrower data requests are handled inside the platform.' },
]

const NAV_LINK =
  'h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/40">
      {/* Homepage-only JSON-LD (Organization + SoftwareApplication). */}
      <JsonLd />

      {/* Header — one brand, a few section anchors, Enquire, and the
          single universal Login button. */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <a href="#top" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="LoanOps — back to top">
            <span className="h-9 w-9 rounded-xl bg-gradient-fintech flex items-center justify-center text-primary-foreground shadow-glow">
              <Wallet className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-bold tracking-tight leading-none text-base">LoanOps</span>
              <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Loan Operations Platform</span>
            </span>
          </a>
          <nav aria-label="Homepage sections" className="flex items-center gap-1 sm:gap-2">
            <a href="#features" className={`${NAV_LINK} hidden sm:inline-flex`}>Features</a>
            <a href="#day" className={`${NAV_LINK} hidden lg:inline-flex`}>A day with LoanOps</a>
            <a href="#how-it-works" className={`${NAV_LINK} hidden md:inline-flex`}>How it works</a>
            <a href="#security" className={`${NAV_LINK} hidden sm:inline-flex`}>Security</a>
            <a href="#enquire" className={`${NAV_LINK} hidden md:inline-flex`}>Enquire</a>
            <Button asChild size="sm" className="h-9 rounded-lg shadow-glow ml-1 px-4">
              <a href="/login">Login</a>
            </Button>
          </nav>
        </div>
      </header>

      <main id="top" className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-warning/10 via-transparent to-info/10 pointer-events-none" />
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-warning/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-24 pb-12 sm:pb-16 relative">
            <div className="text-center max-w-3xl mx-auto">
              <FadeIn>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium mb-6">
                  <HeartHandshake className="h-3.5 w-3.5" />
                  For NBFCs, MFIs and lending businesses across India
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08]">
                  The daily work of lending,
                  <br className="hidden sm:block" />
                  <span className="text-gradient-primary"> finally calm.</span>
                </h1>
                <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Registers that don&apos;t tally. Collections scattered across notebooks and WhatsApp
                  threads. A borrower asking a simple question that nobody can answer quickly. If that
                  sounds familiar, LoanOps was built for your day — applications, disbursal, collections,
                  reminders and reports in one place, so your team can get back to the people they lend to.
                </p>
              </FadeIn>
              <FadeIn delay={0.12}>
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button asChild size="lg" className="w-full sm:w-auto h-12 text-base rounded-xl shadow-glow">
                    <a href="#enquire">Tell us about your business <ArrowRight className="ml-2 h-4 w-4" /></a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="w-full sm:w-auto h-12 text-base rounded-xl">
                    <a href="#day">See a day with LoanOps</a>
                  </Button>
                </div>
                <p className="mt-6 text-xs sm:text-sm text-muted-foreground">
                  For single-branch lenders and multi-agent field teams alike — if you lend, LoanOps speaks your language.
                </p>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Lifecycle strip — every loan, followed through its whole life */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full" aria-label="The complete loan lifecycle">
          <p className="text-center text-xs sm:text-sm text-muted-foreground mb-4">
            Every loan, followed from the first application to the final EMI:
          </p>
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

        {/* A day with LoanOps — the human story of the product */}
        <section id="day" className="w-full bg-accent/40 border-y border-border/50 mt-10 sm:mt-14 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <div className="text-center mb-10 sm:mb-12">
              <p className={EYEBROW}>A day with LoanOps</p>
              <h2 className="text-2xl sm:text-3xl font-bold mt-3">One ordinary day, minus the chaos</h2>
              <p className="text-muted-foreground mt-3 max-w-2xl mx-auto leading-relaxed">
                Lending is not done at a desk. It happens on morning rounds, at doorsteps, and in the
                evening tally. Here is how the day feels when the paperwork keeps up on its own.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
              {DAY_MOMENTS.map((m) => (
                <Card key={m.title} className="rounded-2xl border bg-card hover:shadow-premium transition-shadow h-full">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <span className="h-12 w-12 rounded-2xl bg-warning/15 text-warning-foreground dark:text-warning flex items-center justify-center shrink-0">
                        {m.icon}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{m.time}</span>
                    </div>
                    <h3 className="text-lg font-bold mt-4">{m.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{m.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 w-full scroll-mt-20">
          <div className="text-center mb-10 sm:mb-12">
            <p className={EYEBROW}>Features</p>
            <h2 className="text-2xl sm:text-3xl font-bold mt-3">Everything your lending day runs on</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto leading-relaxed">
              Not another register to maintain — the register, the rounds, the reminders and the
              reports, finally keeping themselves.
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

        {/* Panels — described in human terms; entry is only via the header Login */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20 w-full">
          <div className="text-center mb-10 sm:mb-12">
            <p className={EYEBROW}>Who it is for</p>
            <h2 className="text-2xl sm:text-3xl font-bold mt-3">One platform, three people it serves</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto leading-relaxed">
              The owner, the agent in the field and the borrower each get a panel shaped to their
              work — and fenced to their role. One login at the top of this page opens the right one.
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
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{p.desc}</p>
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
        <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20 w-full scroll-mt-20">
          <div className="text-center mb-10 sm:mb-12">
            <p className={EYEBROW}>How it works</p>
            <h2 className="text-2xl sm:text-3xl font-bold mt-3">Getting started is a conversation</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto leading-relaxed">
              From a first hello to a lending operation that runs its day digitally — at your pace, with your people.
            </p>
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

        {/* Security — borrowers' data, treated with respect */}
        <section id="security" className="w-full bg-card/60 border-y border-border/60 scroll-mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <div className="flex items-center gap-3 mb-8">
              <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold leading-tight">Your borrowers&apos; data, treated with respect</h2>
                <p className="text-sm text-muted-foreground mt-0.5">People hand you their Aadhaar, their bank details and their trust. LoanOps guards all three.</p>
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
        <section id="enquire" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 w-full scroll-mt-20">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-2">
              <p className={EYEBROW}>Let&apos;s talk</p>
              <h2 className="text-2xl sm:text-3xl font-bold leading-tight mt-3">Tell us about your lending business</h2>
              <p className="text-muted-foreground mt-3 text-sm sm:text-base leading-relaxed">
                How many borrowers do you serve? How many agents walk the field for you? Which part of
                the day still runs on paper? Tell us in a few lines — we will call you back on your
                mobile, walk you through the platform, and talk honestly about whether LoanOps fits
                your business.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex items-start gap-2"><ScrollText className="h-4 w-4 text-success shrink-0 mt-0.5" /> No obligation — an enquiry is only a conversation.</li>
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
