import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ArrowRight, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { JsonLd } from '@/components/json-ld'
import { LegalFooter } from '@/components/legal/legal-footer'
import { CookieBanner } from '@/components/legal/cookie-banner'
import { EnquiryForm } from '@/components/enquiry-form'
import { FadeIn } from '@/components/ui/motion'

// Public product homepage — written and set like a document, not a
// template: the product is shown (a real loan ledger, with figures
// that add up) before it is described. It carries exactly ONE entry
// point — the universal "Login" button in the header. There are no
// separate owner/agent/customer login links anywhere on this page;
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

const NAV_LINK =
  'inline-flex h-9 items-center px-2 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm'

// Section heading: a mono section number, a hairline, then the title.
// Used by every numbered section so the page reads as one document.
function SectionHead({
  no,
  title,
  children,
}: {
  no: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="mb-10 sm:mb-12">
      <div className="flex items-baseline gap-4 border-t-2 border-foreground pt-4">
        <span className="font-mono text-xs font-medium text-muted-foreground">{no}</span>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      </div>
      {children ? (
        <p className="mt-4 max-w-[62ch] leading-relaxed text-muted-foreground">{children}</p>
      ) : null}
    </div>
  )
}

// The demo loan, exactly as the product computes it: ₹75,000 at 18%
// p.a. flat over 12 months, plus a ₹750 processing fee spread across
// the instalments. Every EMI is ₹7,437.50 (principal ₹6,250.00 +
// interest ₹1,125.00 + fee ₹62.50), and the columns total to the
// principal, the interest, the fee and the ₹89,250.00 repayable.
const SCHEDULE: Array<{
  n: number
  due: string
  principal: string
  interest: string
  fee: string
  emi: string
  status: 'Paid' | 'Due' | 'Upcoming'
}> = [
  { n: 1, due: '5 Sep 2026', principal: '6,250.00', interest: '1,125.00', fee: '62.50', emi: '7,437.50', status: 'Paid' },
  { n: 2, due: '5 Oct 2026', principal: '6,250.00', interest: '1,125.00', fee: '62.50', emi: '7,437.50', status: 'Paid' },
  { n: 3, due: '5 Nov 2026', principal: '6,250.00', interest: '1,125.00', fee: '62.50', emi: '7,437.50', status: 'Paid' },
  { n: 4, due: '5 Dec 2026', principal: '6,250.00', interest: '1,125.00', fee: '62.50', emi: '7,437.50', status: 'Due' },
  { n: 5, due: '5 Jan 2027', principal: '6,250.00', interest: '1,125.00', fee: '62.50', emi: '7,437.50', status: 'Upcoming' },
]

const LEDGER_NOTES = [
  {
    title: 'In paise, never in floats',
    desc: 'Amounts are computed on the server as integers. An EMI of ₹7,437.50 is ₹7,437.50 in the schedule, on the receipt and in the month-end report — the same figure in all three places.',
  },
  {
    title: 'Corrections leave a trail',
    desc: 'A wrong collection is not deleted. It is reversed, and the original entry stays in the audit trail, with who recorded it and who verified it.',
  },
  {
    title: 'Reminders read the same schedule',
    desc: 'The 09:15 reminder run works off this schedule — due in three days, due today, overdue — and writes to the borrower\'s portal, so a nudge lands before a missed EMI, not after.',
  },
]

const CHANGES: Array<{ paper: string; loanops: string }> = [
  {
    paper: 'Collections written in a notebook, tallied late at night',
    loanops: 'Posted to the ledger as they are recorded. The day closes itself.',
  },
  {
    paper: 'Dues and promises carried in the agent\'s memory',
    loanops: 'A morning list of today\'s visits, dues and promises-to-pay.',
  },
  {
    paper: 'Reminders sent if someone finds the time',
    loanops: 'Sent at 09:15 — three days before the due date, on the day, and when overdue.',
  },
  {
    paper: '“How much is left on my loan?” means a phone call to the office',
    loanops: 'The borrower opens their portal: the schedule, the balance, every receipt.',
  },
  {
    paper: 'Month-end rebuilt in a spreadsheet, from memory',
    loanops: 'Portfolio, collections and overdue-ageing reports, drawn from the same ledger.',
  },
  {
    paper: 'A mistake crossed out in ink, initialled if you are lucky',
    loanops: 'A reversal entry. The original stays, and the audit trail says why.',
  },
]

const PEOPLE = [
  {
    role: 'The owner',
    line: 'Approves, disburses, and answers for the book.',
    points: [
      'Portfolio, collections and overdue ageing on one screen.',
      'No figure reaches a report without a ledger entry behind it.',
    ],
  },
  {
    role: 'The field agent',
    line: 'The face of the business, out on the street.',
    points: [
      'Today\'s visits and dues, in order, on the phone.',
      'Cash recorded at the doorstep; the receipt is issued on the spot.',
    ],
  },
  {
    role: 'The borrower',
    line: 'Owes the money — and can see exactly where it stands.',
    points: [
      'Schedule, balance and every receipt, in a private portal.',
      'A reminder before the due date, and a support ticket when something is wrong.',
    ],
  },
]

const STEPS = [
  {
    title: 'Tell us about your business',
    desc: 'Use the enquiry form below: how many borrowers you serve, how many agents walk for you, and which part of the day still runs on paper. A few lines is enough. No obligation — it is a conversation, not a contract.',
  },
  {
    title: 'We set up your organisation',
    desc: 'Your loan products, your agreement and Key Facts Statement templates, and your team — owners and field agents — set up around how you already lend.',
  },
  {
    title: 'Borrowers come on board',
    desc: 'Share an application link or a QR code. Borrowers apply, complete KYC and accept their agreement digitally. You approve, and disburse when you are satisfied.',
  },
  {
    title: 'Then, run the day',
    desc: 'Collect EMIs, follow up promises-to-pay, let the 09:15 reminders go out, and close the day against reports that have already reconciled.',
  },
]

const SECURITY_ROWS = [
  {
    title: 'Encrypted at rest',
    desc: 'Aadhaar, PAN and bank details are encrypted (AES-256-GCM) and masked on everyday screens.',
  },
  {
    title: 'Roles, enforced on the server',
    desc: 'Owner, agent and borrower panels check permissions on the server, not just in the browser. A borrower cannot reach another borrower\'s loan — or your side of the business.',
  },
  {
    title: 'An audit trail that stays written',
    desc: 'Sign-ins, approvals, collections and corrections are recorded in an append-only audit trail. Nothing is quietly edited after the fact.',
  },
  {
    title: 'DPDP, KFS and grievance, in the product',
    desc: 'Borrower consents are recorded when they apply. The Key Facts Statement, fair-practices and grievance pages ship with the platform, because the RBI expects them on a lender\'s website.',
  },
]

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Homepage-only JSON-LD (Organization + SoftwareApplication). */}
      <JsonLd />

      {/* Header — wordmark, section anchors, and the single universal
          Login button. Plain, ruled, no glass and no glow. */}
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="flex items-baseline gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="LoanOps — back to top"
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 translate-y-[-1px] bg-primary" />
            <span className="text-lg font-semibold leading-none tracking-tight">LoanOps</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">Loan operations, kept in one ledger</span>
          </a>
          <nav aria-label="Homepage sections" className="flex items-center gap-0.5 sm:gap-1.5">
            <a href="#ledger" className={`${NAV_LINK} hidden md:inline-flex`}>The ledger</a>
            <a href="#what-changes" className={`${NAV_LINK} hidden lg:inline-flex`}>What changes</a>
            <a href="#how-it-works" className={`${NAV_LINK} hidden md:inline-flex`}>How it works</a>
            <a href="#security" className={`${NAV_LINK} hidden sm:inline-flex`}>Security</a>
            <a href="#enquire" className={`${NAV_LINK} hidden sm:inline-flex`}>Enquire</a>
            <Button asChild size="sm" className="ml-2 h-9 rounded-md px-4">
              <a href="/login">Login</a>
            </Button>
          </nav>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero — left-aligned, set in type. The product itself follows
            immediately below; nothing here glows or floats. */}
        <section className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20 lg:px-8">
          <FadeIn>
            <p className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <span aria-hidden="true" className="h-px w-10 bg-foreground" />
              For NBFCs, MFIs and lending businesses in India
            </p>
            <h1 className="mt-7 max-w-[16ch] text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-6xl lg:text-7xl">
              The daily work of lending, kept in one ledger.
            </h1>
            <p className="mt-7 max-w-[62ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
              LoanOps is the register, the rounds list and the receipt book of a lending
              business, kept digitally — applications, disbursement, EMI schedules, field
              collections and reports, recorded once and exact to the paise. Your agents
              work from one list. Your borrowers can see their own loans. You close the
              day against a ledger that balances.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Button asChild size="lg" className="h-12 rounded-md px-6 text-base">
                <a href="#enquire">
                  Tell us about your business <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <a
                href="#ledger"
                className="inline-flex items-center gap-1.5 rounded-sm text-base font-medium underline decoration-foreground/30 underline-offset-[6px] transition-colors hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                See the loan ledger <ArrowDown className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              For single-branch lenders and multi-agent field teams alike.
            </p>
          </FadeIn>
        </section>

        {/* 01 — The ledger: the product, shown rather than described.
            The figures are the product's own demo loan and they add up. */}
        <section id="ledger" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <SectionHead no="01" title="Start with the loan itself">
            This is the loan detail screen — the page your team works from. One borrower,
            one schedule, and a collection recorded against it. Nothing here is a mock-up
            of numbers: the schedule below is worked out the way the product works it out.
          </SectionHead>

          <figure>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {/* Loan header */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border px-5 py-4 sm:px-7">
                <p className="text-base font-semibold tracking-tight">
                  Priya Sharma
                  <span className="ml-3 text-sm font-normal text-muted-foreground">Personal loan</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Disbursed 5 Aug 2026 · Agent: Arjun Nair · Monthly
                </p>
              </div>

              {/* Terms — the figures the schedule is built from */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-5 sm:px-7">
                {[
                  ['Principal', '₹75,000.00'],
                  ['Interest', '18% p.a.'],
                  ['Tenure', '12 months'],
                  ['EMI', '₹7,437.50'],
                  ['Total repayable', '₹89,250.00'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-base font-semibold tabular-nums tracking-tight">{value}</dd>
                  </div>
                ))}
              </dl>

              {/* Installment schedule */}
              <div className="table-scroll overflow-x-auto border-t border-border">
                <table className="w-full min-w-[430px] border-collapse text-sm">
                  <caption className="px-5 pt-4 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:px-7">
                    Installment Schedule
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th scope="col" className="px-5 py-2.5 font-medium sm:px-7">No.</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Due date</th>
                      <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Principal</th>
                      <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Interest</th>
                      <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Fee</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">EMI (₹)</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-medium sm:px-7">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCHEDULE.map((row) => (
                      <tr key={row.n} className="border-b border-border/70 last:border-0">
                        <td className="px-5 py-2.5 tabular-nums text-muted-foreground sm:px-7">{row.n}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">{row.due}</td>
                        <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">{row.principal}</td>
                        <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">{row.interest}</td>
                        <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">{row.fee}</td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums">{row.emi}</td>
                        <td className="px-5 py-2.5 text-right sm:px-7">
                          {row.status === 'Paid' ? (
                            <span className="font-medium text-success">Paid</span>
                          ) : row.status === 'Due' ? (
                            <span className="font-medium">Due</span>
                          ) : (
                            <span className="text-muted-foreground">Upcoming</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={7} className="px-5 py-2.5 text-sm text-muted-foreground sm:px-7">
                        …and 7 more instalments, to 5 Aug 2027.
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-foreground font-semibold">
                      <td colSpan={2} className="px-5 py-3 sm:px-7">Total</td>
                      <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">75,000.00</td>
                      <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">13,500.00</td>
                      <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">750.00</td>
                      <td className="px-3 py-3 text-right tabular-nums">89,250.00</td>
                      <td className="px-5 py-3 sm:px-7" />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Latest collection + balance, in the product's own words */}
              <div className="border-t border-border px-5 py-4 sm:px-7">
                <p className="text-sm leading-relaxed">
                  <span className="font-medium">Latest collection</span>
                  <span className="text-muted-foreground">
                    {' '}— 5 Nov 2026 · Instalment 3 · Cash, collected by Arjun Nair ·{' '}
                  </span>
                  <span className="font-medium tabular-nums">₹7,437.50</span>
                  <span className="text-muted-foreground"> · Receipt issued · Verified by owner</span>
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Outstanding principal{' '}
                  <span className="font-medium tabular-nums text-foreground">₹56,250.00</span>
                  {' '}· Next EMI due 5 Dec 2026
                </p>
              </div>
            </div>
            <figcaption className="mt-3 text-sm text-muted-foreground">
              Fig. 01 — The loan detail screen. Demo figures: ₹75,000 at 18% over 12 months,
              with the processing fee spread across the instalments. The schedule the
              borrower sees in their portal is this same schedule.
            </figcaption>
          </figure>

          {/* Three notes under the figure — ruled, not boxed */}
          <div className="mt-12 grid gap-8 sm:mt-14 md:grid-cols-3 md:gap-10">
            {LEDGER_NOTES.map((note) => (
              <div key={note.title} className="border-t border-border pt-4">
                <h3 className="font-semibold tracking-tight">{note.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{note.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Lifecycle — one ruled line, start to finish */}
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8" aria-label="The complete loan lifecycle">
          <p className="border-y border-border py-4 text-sm leading-loose text-muted-foreground">
            <span className="font-medium text-foreground">Every loan, followed through its whole life:</span>{' '}
            Application · KYC · Agreement · Approval · Disbursement · EMI schedule ·
            Collection · Ledger · Receipt · Closure
          </p>
        </div>

        {/* 02 — What changes: paper on the left, LoanOps on the right */}
        <section id="what-changes" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <SectionHead no="02" title="What changes when the register closes">
            LoanOps does not ask a lending business to work differently. It takes the work
            that already happens — on paper, in notebooks, over WhatsApp — and keeps it in
            one place instead.
          </SectionHead>
          <div>
            <div className="hidden grid-cols-2 gap-x-10 pb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:grid">
              <span>On paper</span>
              <span>In LoanOps</span>
            </div>
            {CHANGES.map((row) => (
              <div
                key={row.paper}
                className="grid gap-1 border-t border-border py-4 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-0"
              >
                <p className="leading-relaxed text-muted-foreground">{row.paper}</p>
                <p className="leading-relaxed">{row.loanops}</p>
              </div>
            ))}
            <p className="border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
              The rest of the working day is covered too: applications by QR link, KYC and
              digital agreements, disbursement, support tickets from the borrower&apos;s
              portal, reconciliation and refunds.
            </p>
          </div>
        </section>

        {/* 03 — Who it serves: three people, ruled columns, no cards */}
        <section id="who" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <SectionHead no="03" title="Three people, one set of figures">
            The owner, the agent in the field and the borrower each get a panel shaped to
            their work and fenced to their role. One login, at the top of this page, opens
            the right one.
          </SectionHead>
          <div className="grid gap-10 md:grid-cols-3 md:gap-0">
            {PEOPLE.map((person, i) => (
              <div
                key={person.role}
                className={`border-t-2 border-t-foreground pt-5 ${
                  i === 0 ? 'md:pr-10' : 'md:border-l md:border-l-border md:pl-10'
                } ${i === 1 ? 'md:pr-10' : ''}`}
              >
                <h3 className="text-lg font-semibold tracking-tight">{person.role}</h3>
                <p className="mt-1.5 text-sm italic leading-relaxed text-muted-foreground">{person.line}</p>
                <ul className="mt-4 space-y-2.5">
                  {person.points.map((point) => (
                    <li key={point} className="text-sm leading-relaxed">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 04 — Getting started: a numbered, ruled list */}
        <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <SectionHead no="04" title="Getting started is a conversation" />
          <ol className="list-none">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="grid gap-2 border-t border-border py-6 sm:grid-cols-[3.5rem_16rem_1fr] sm:gap-x-6"
              >
                <span className="font-mono text-sm text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-semibold tracking-tight">{step.title}</h3>
                <p className="max-w-[62ch] leading-relaxed text-muted-foreground">{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 05 — Security: definition rows, claims unchanged and specific */}
        <section id="security" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <SectionHead no="05" title="Your borrowers' data, treated with respect">
            People hand you their Aadhaar, their bank details and their trust. These are
            the arrangements that guard all three.
          </SectionHead>
          <dl>
            {SECURITY_ROWS.map((row) => (
              <div
                key={row.title}
                className="grid gap-1 border-t border-border py-5 sm:grid-cols-[16rem_1fr] sm:gap-x-6"
              >
                <dt className="font-semibold tracking-tight">{row.title}</dt>
                <dd className="max-w-[62ch] leading-relaxed text-muted-foreground">{row.desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 06 — Enquire: the form itself is untouched */}
        <section id="enquire" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <SectionHead no="06" title="Tell us about your lending business">
            How many borrowers do you serve? How many agents walk the field for you? Which
            part of the day still runs on paper? A few lines is enough — we will call you
            back on your mobile, walk you through the platform, and talk honestly about
            whether LoanOps fits your business.
          </SectionHead>
          <div className="grid gap-10 lg:grid-cols-5 lg:gap-14">
            <div className="lg:col-span-2">
              <ul className="space-y-3 text-sm leading-relaxed">
                <li className="border-t border-border pt-3">
                  No obligation. An enquiry is only a conversation.
                </li>
                <li className="border-t border-border pt-3">
                  Your details are used only to respond to this enquiry.
                </li>
                <li className="border-t border-border pt-3">
                  Already a customer? Use the Login button at the top of this page.
                </li>
              </ul>
            </div>
            <div className="lg:col-span-3">
              <div className="rounded-lg border border-border bg-card p-5 sm:p-7">
                <EnquiryForm />
              </div>
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
