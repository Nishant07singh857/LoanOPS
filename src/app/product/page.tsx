import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { LegalFooter } from '@/components/legal/legal-footer'
import { CookieBanner } from '@/components/legal/cookie-banner'

// Product detail page — the depth behind the homepage strips.
//
// The homepage carries the dose a homepage should: the lifecycle in
// one line, the modules as name + outcome, security as three
// assurances. This page carries the rest, in the same words the
// homepage used before the trim: the full six-step walkthrough of
// one sample loan with every ledger fragment, the four module
// chapters, and the four steps of going live (id="onboarding").
// Nothing here is new copy — it moved, it was not rewritten.
//
// Type system matches the homepage: Fraunces for display, IBM Plex
// Sans for body, IBM Plex Mono for every amount, date and ID.

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
})

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

const PAGE_TITLE = 'LoanOps — Product: Lifecycle, Modules & Going Live'
const PAGE_DESCRIPTION =
  'The full LoanOps walkthrough: one sample loan followed from application to report with its ledger fragments, the four modules in detail, and the four steps of going live.'

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

// Palette and tokens match the homepage (see src/app/page.tsx for
// the contrast computations — the same tokens on the same surfaces).
const INK = 'text-[#14231C]'
const INK_2 = 'text-[#14231C]/70'
const INK_3 = 'text-[#14231C]/64'
const IVORY_T = 'text-[#FAF7F0]'
const IVORY_2 = 'text-[#FAF7F0]/75'
const HAIR = 'border-[#14231C]/10'
const MONO = '[font-family:var(--font-plex-mono)] tabular-nums'
const SERIF = '[font-family:var(--font-fraunces),Georgia,serif]'
const CONTAINER = 'mx-auto w-full max-w-7xl px-6 lg:px-8'
const SECTION = 'py-24 lg:py-32'
const HOVER = 'transition-colors duration-[160ms] ease-[cubic-bezier(0.3,0,0.2,1)]'

function SectionHead({
  tone = 'ink',
  title,
  children,
}: {
  tone?: 'ink' | 'ivory'
  title: string
  children?: ReactNode
}) {
  const titleCls = tone === 'ivory' ? IVORY_T : INK
  const leadCls = tone === 'ivory' ? IVORY_2 : INK_2
  return (
    <div className="mb-12 lg:mb-16">
      <h2 className={`max-w-[26ch] ${SERIF} text-[2rem] font-medium leading-[1.08] tracking-[-0.01em] md:text-[2.6rem] ${titleCls}`}>
        {title}
      </h2>
      {children ? (
        <p className={`mt-5 max-w-[65ch] text-lg leading-[1.55] ${leadCls}`}>{children}</p>
      ) : null}
    </div>
  )
}

// A product excerpt, set like a page from a paper ledger: warm card,
// hairline rule under its title, generous radius. `surface` is the
// card colour — ivory on the green lifecycle section, white on the
// ivory module chapters.
function Fragment({
  title,
  children,
  className = '',
  surface = 'bg-white',
}: {
  title: string
  children: ReactNode
  className?: string
  surface?: string
}) {
  return (
    <figure className={`overflow-hidden rounded-[20px] border ${HAIR} ${surface} ${INK} ${className}`}>
      <figcaption
        className={`border-b ${HAIR} px-5 py-3 text-[13px] font-medium ${INK_2}`}
      >
        {title}
      </figcaption>
      <div className="px-5 py-4">{children}</div>
    </figure>
  )
}

// The simple top bar for detail pages: the wordmark home, and the
// one Log in pill.
function TopBar() {
  return (
    <header className={`border-b ${HAIR}`}>
      <div className={`${CONTAINER} flex h-16 items-center justify-between gap-3`}>
        <a
          href="/"
          className="flex h-11 items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A3D2C]"
          aria-label="LoanOps — home"
        >
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-[#047857]" />
          <span className="text-[17px] font-semibold leading-none tracking-[-0.01em]">LoanOps</span>
        </a>
        <a
          href="/login"
          className={`inline-flex h-11 items-center rounded-full bg-[#0A3D2C] px-5 text-[15px] font-semibold text-white ${HOVER} hover:bg-[#06231A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A3D2C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF7F0]`}
        >
          Log in
        </a>
      </div>
    </header>
  )
}

// The closing mini-CTA: back to the homepage's enquiry section.
function MiniCta() {
  return (
    <section className="bg-[#0A3D2C]">
      <div className={`${CONTAINER} flex flex-col items-start gap-8 py-16 lg:flex-row lg:items-center lg:justify-between lg:py-20`}>
        <p className={`max-w-[24ch] ${SERIF} text-2xl font-medium leading-[1.18] ${IVORY_T} md:text-3xl`}>
          Run your entire lending business in one calm platform.
        </p>
        <a
          href="/#enquire"
          className={`inline-flex h-12 shrink-0 items-center rounded-full bg-white px-7 text-base font-semibold text-[#0A3D2C] ${HOVER} hover:bg-[#FAF7F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`}
        >
          Book a demo
        </a>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------
// Page data — verbatim from the homepage the detail lived on before
// the trim. Priya Sharma's loan: ₹75,000 at 18% over 12 months.
// EMI ₹7,437.50 (principal ₹6,250.00 + interest ₹1,125.00 + fee
// ₹62.50); total repayable ₹89,250.00.
// ------------------------------------------------------------------

const LIFECYCLE_SCHEDULE: Array<{
  n: number
  due: string
  emi: string
  status: 'Paid' | 'Overdue' | 'Upcoming'
}> = [
  { n: 1, due: '5 Sep 2026', emi: '7,437.50', status: 'Paid' },
  { n: 2, due: '5 Oct 2026', emi: '7,437.50', status: 'Paid' },
  { n: 3, due: '5 Nov 2026', emi: '7,437.50', status: 'Paid' },
  { n: 4, due: '5 Dec 2026', emi: '7,437.50', status: 'Overdue' },
  { n: 5, due: '5 Jan 2027', emi: '7,437.50', status: 'Upcoming' },
]

const MODULES: Array<{
  title: string
  heading: string
  intro: string
  rows: string[]
  fragment: ReactNode
}> = [
  {
    title: 'Origination',
    heading: 'Applications arrive complete, or not at all.',
    intro:
      'A borrower applies from a link or QR code you share. KYC, consents and the agreement are collected in that one sitting, and the application reaches you ready to decide on.',
    rows: [
      'Applications by link and QR code, with KYC in the same sitting',
      'Aadhaar and PAN collected encrypted; itemised DPDP consents recorded',
      'Agreement and Key Facts Statement accepted digitally',
      'Approval by the owner, on the record',
    ],
    fragment: (
      <dl className="space-y-2 text-sm">
        {[
          ['Applicant', 'Priya Sharma'],
          ['Applied', '28 Jul 2026 · QR link'],
          ['KYC', 'Aadhaar · PAN · bank details'],
          ['Consents', '4 recorded, itemised'],
          ['Decision', 'Approved · 1 Aug 2026'],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-6">
            <dt className={INK_3}>{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    ),
  },
  {
    title: 'Collections',
    heading: 'Know today’s collection position before the day starts.',
    intro:
      'Each agent opens the day with a list: who to visit, what is due, what was promised. Collections are recorded at the doorstep and reach the office the moment they are posted.',
    rows: [
      'A morning list of visits, dues and promises-to-pay for every agent',
      'Cash and bank collections recorded in the field, receipt issued on the spot',
      'Reminders run at 09:15 — due soon, due today, overdue',
      'Overdue ageing by days past due, always current',
    ],
    fragment: (
      <ul className="space-y-2 text-sm">
        {[
          ['09:15', 'Reminder run — 3 due today, 1 overdue'],
          ['Visit 1', 'Anitha Rao · ₹3,150.00 due'],
          ['Visit 2', 'Mohammed Faiz · promised 9 Dec'],
        ].map(([k, v]) => (
          <li key={k} className="flex items-baseline gap-4">
            <span className={`${MONO} text-[13px] ${INK_3}`}>{k}</span>
            <span>{v}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    title: 'Ledger & accounting',
    heading: 'Every rupee posted twice, or not at all.',
    intro:
      'The ledger is double-entry and append-only. Disbursal, collections and corrections post themselves from the work that caused them; a mistake is reversed, never deleted.',
    rows: [
      'Double-entry postings for disbursal, collections, fees and refunds',
      'Amounts held in paise, as integers — no float rounding, anywhere',
      'Corrections by reversal entry; the original stays on the record',
      'Reconciliation view for cash and bank, day by day',
    ],
    fragment: (
      <div className={`space-y-1.5 text-[13px] ${MONO}`}>
        <p>Dr Loans Receivable ····· ₹75,000.00</p>
        <p>Cr Bank Account ········· ₹75,000.00</p>
        <p className={`pt-1 font-sans text-[13px] ${INK_3}`}>
          Disbursement posting — the pair balances, or it does not post.
        </p>
      </div>
    ),
  },
  {
    title: 'Reports & audit',
    heading: 'Month-end is a report, not a reconstruction.',
    intro:
      'Portfolio, collections and overdue-ageing reports are drawn from the same ledger the day ran on. Every figure in them traces back to an entry, and every entry to the person who made it.',
    rows: [
      'Portfolio, collections and overdue-ageing reports, drawn from the ledger',
      'Reports export to CSV for your auditors and your board',
      'Append-only audit trail: sign-ins, approvals, collections, corrections',
      'Separate panels for owner, agent and borrower, fenced by role',
    ],
    fragment: (
      <div className="space-y-2 text-sm">
        {[
          ['Active loans', '124'],
          ['Outstanding', '₹87,08,212'],
          ['Overdue (60+)', '₹11,200'],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-6">
            <span className={INK_3}>{k}</span>
            <span className={`${MONO} font-medium`}>{v}</span>
          </div>
        ))}
      </div>
    ),
  },
]

const ONBOARDING: Array<{ title: string; desc: string }> = [
  {
    title: 'Share your current data',
    desc: 'You send the Excel sheets or legacy export your book currently lives in. We read it with you and agree what carries over — loans, borrowers, schedules, balances.',
  },
  {
    title: 'We migrate and configure',
    desc: 'Your data is loaded, and your branches, loan products, agreement and Key Facts Statement templates, and team accounts are set up the way you already lend.',
  },
  {
    title: 'Train the team',
    desc: 'Owner and agents learn on your own data: approving, disbursing, collecting, following up. Borrowers receive their portal access and claim codes.',
  },
  {
    title: 'Go live',
    desc: 'The day runs in LoanOps from the next morning list onward. Questions go to the in-app support desk, where the borrower’s tickets already live.',
  },
]

export default function ProductPage() {
  return (
    <div
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} flex min-h-screen flex-col bg-[#FAF7F0] [font-family:var(--font-plex-sans),sans-serif] ${INK}`}
    >
      <TopBar />

      <main className="flex-1">
        {/* Page head — what this page is: the homepage's detail,
            one click deep. */}
        <div className={`${CONTAINER} pb-4 pt-16 lg:pt-20`}>
          <p className={`${MONO} text-[11px] font-medium uppercase tracking-[0.22em] text-[#047857]`}>
            The product
          </p>
          <h1 className={`mt-5 max-w-[22ch] ${SERIF} text-[2.4rem] font-medium leading-[1.06] tracking-[-0.01em] md:text-[3rem]`}>
            How LoanOps works
          </h1>
          <p className={`mt-5 max-w-[65ch] text-lg leading-[1.55] ${INK_2}`}>
            One sample loan followed through the system — every stage, every
            ledger fragment — the four modules in full, and the four steps that
            take your book live.
          </p>
        </div>

        {/* Lifecycle — the centrepiece, on deep green. One loan,
            followed from application to report, each step with the
            ledger page it produces. Sample data throughout, and
            labelled as such. */}
        <section className="bg-[#0A3D2C]">
          <div className={`${CONTAINER} ${SECTION}`}>
            <SectionHead tone="ivory" title="One loan, followed from application to report.">
              Priya Sharma’s loan — ₹75,000 at 18% over 12 months — is the sample
              every figure on this page comes from. Follow it through the system
              and check the numbers as you go. Sample data.
            </SectionHead>

            <div className="divide-y divide-white/10 border-y border-white/10">
              {/* Step 1 — Application & approval */}
              <div className="grid gap-8 py-12 lg:grid-cols-[18rem_1fr] lg:gap-14">
                <div>
                  <p className={`${MONO} text-sm text-[#34D399]`}>Step 1</p>
                  <h3 className={`mt-2 ${SERIF} text-[1.45rem] font-medium leading-snug ${IVORY_T}`}>Application &amp; approval</h3>
                  <p className={`mt-3 leading-[1.6] ${IVORY_2}`}>
                    She applies from a QR link the agent shares. KYC and consents are
                    collected in the same sitting, and the owner approves on the record —
                    nothing travels on paper.
                  </p>
                </div>
                <Fragment title="Application — Priya Sharma" className="self-start" surface="bg-[#FAF7F0]">
                  <dl className="space-y-2 text-sm">
                    {[
                      ['Applied', '28 Jul 2026 · QR link'],
                      ['KYC', 'Aadhaar · PAN · bank details, encrypted'],
                      ['Consents', '4 recorded, itemised'],
                      ['Agreement & KFS', 'Accepted digitally'],
                      ['Decision', 'Approved · 1 Aug 2026'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-6">
                        <dt className={INK_3}>{k}</dt>
                        <dd className="text-right font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Fragment>
              </div>

              {/* Step 2 — Disbursal */}
              <div className="grid gap-8 py-12 lg:grid-cols-[18rem_1fr] lg:gap-14">
                <div>
                  <p className={`${MONO} text-sm text-[#34D399]`}>Step 2</p>
                  <h3 className={`mt-2 ${SERIF} text-[1.45rem] font-medium leading-snug ${IVORY_T}`}>Disbursal</h3>
                  <p className={`mt-3 leading-[1.6] ${IVORY_2}`}>
                    On 5 Aug 2026 the loan is disbursed to her bank account, and the
                    ledger posting is written by the same action — a balanced pair,
                    or nothing posts.
                  </p>
                </div>
                <Fragment title="Ledger — disbursement posting" className="self-start" surface="bg-[#FAF7F0]">
                  <div className={`space-y-1.5 text-sm ${MONO}`}>
                    <p className="flex items-baseline justify-between gap-6">
                      <span>Dr Loans Receivable</span>
                      <span>₹75,000.00</span>
                    </p>
                    <p className="flex items-baseline justify-between gap-6">
                      <span>Cr Bank Account</span>
                      <span>₹75,000.00</span>
                    </p>
                    <p className={`border-t ${HAIR} pt-2 font-sans text-[13px] ${INK_3}`}>
                      5 Aug 2026 · Type: Disbursement · Reference: the loan number
                    </p>
                  </div>
                </Fragment>
              </div>

              {/* Step 3 — EMI schedule */}
              <div className="grid gap-8 py-12 lg:grid-cols-[18rem_1fr] lg:gap-14">
                <div>
                  <p className={`${MONO} text-sm text-[#34D399]`}>Step 3</p>
                  <h3 className={`mt-2 ${SERIF} text-[1.45rem] font-medium leading-snug ${IVORY_T}`}>The EMI schedule</h3>
                  <p className={`mt-3 leading-[1.6] ${IVORY_2}`}>
                    Twelve instalments of ₹7,437.50 — principal ₹6,250.00, interest
                    ₹1,125.00 and a ₹62.50 share of the ₹750 processing fee in each.
                    The borrower sees this same schedule in her portal.
                  </p>
                </div>
                <Fragment title="Instalment schedule — first five of twelve" className="self-start" surface="bg-[#FAF7F0]">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className={`border-b ${HAIR} text-left text-[13px] ${INK_3}`}>
                        <th scope="col" className="py-2 pr-3 font-medium">No.</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Due date</th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">EMI (₹)</th>
                        <th scope="col" className="py-2 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {LIFECYCLE_SCHEDULE.map((row) => (
                        <tr
                          key={row.n}
                          className={`border-b border-[#14231C]/5 last:border-0 ${
                            row.status === 'Overdue' ? 'bg-[#FEF3F2]' : ''
                          }`}
                        >
                          <td className={`py-2 pr-3 ${MONO} ${INK_3}`}>{row.n}</td>
                          <td className="py-2 pr-3">{row.due}</td>
                          <td className={`py-2 pr-3 text-right ${MONO}`}>{row.emi}</td>
                          <td className="py-2 text-right">
                            {row.status === 'Paid' ? (
                              <span className="font-medium text-[#067647]">Paid</span>
                            ) : row.status === 'Overdue' ? (
                              <span className="font-medium text-[#B42318]">Overdue</span>
                            ) : (
                              <span className={INK_2}>Upcoming</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className={`border-t ${HAIR} font-medium`}>
                        <td colSpan={2} className="py-2 pr-3">Total repayable</td>
                        <td className={`py-2 pr-3 text-right ${MONO}`}>89,250.00</td>
                        <td className="py-2" />
                      </tr>
                    </tbody>
                  </table>
                </Fragment>
              </div>

              {/* Step 4 — A missed payment */}
              <div className="grid gap-8 py-12 lg:grid-cols-[18rem_1fr] lg:gap-14">
                <div>
                  <p className={`${MONO} text-sm text-[#34D399]`}>Step 4</p>
                  <h3 className={`mt-2 ${SERIF} text-[1.45rem] font-medium leading-snug ${IVORY_T}`}>A missed payment</h3>
                  <p className={`mt-3 leading-[1.6] ${IVORY_2}`}>
                    Instalment 4 is not paid on 5 Dec. The loan moves in the ageing
                    the same day, the reminder run has already been ahead of it, and
                    the follow-up ends in a promise to pay — recorded, not remembered.
                  </p>
                </div>
                <Fragment title="Follow-up — instalment 4" className="self-start" surface="bg-[#FAF7F0]">
                  <ul className="space-y-2.5 text-sm">
                    <li className="flex items-baseline justify-between gap-6">
                      <span className={INK_3}>2 Dec · 09:15</span>
                      <span className="text-right">Reminder sent — due in three days</span>
                    </li>
                    <li className="flex items-baseline justify-between gap-6">
                      <span className={INK_3}>5 Dec · 09:15</span>
                      <span className="text-right">Reminder sent — due today</span>
                    </li>
                    <li className="flex items-baseline justify-between gap-6">
                      <span className={INK_3}>6 Dec</span>
                      <span className="text-right">
                        Instalment overdue · <span className="font-medium text-[#B42318]">DPD 1</span> · follow-up task created
                      </span>
                    </li>
                    <li className="flex items-baseline justify-between gap-6">
                      <span className={INK_3}>7 Dec</span>
                      <span className="text-right">Promise to pay recorded — 9 Dec, by Arjun Nair</span>
                    </li>
                  </ul>
                </Fragment>
              </div>

              {/* Step 5 — Collection & receipt */}
              <div className="grid gap-8 py-12 lg:grid-cols-[18rem_1fr] lg:gap-14">
                <div>
                  <p className={`${MONO} text-sm text-[#34D399]`}>Step 5</p>
                  <h3 className={`mt-2 ${SERIF} text-[1.45rem] font-medium leading-snug ${IVORY_T}`}>Collection &amp; receipt</h3>
                  <p className={`mt-3 leading-[1.6] ${IVORY_2}`}>
                    On 9 Dec the instalment is collected in cash at her doorstep. The
                    receipt is issued on the spot, the owner verifies it, and the
                    collection posts to the ledger in its three parts.
                  </p>
                </div>
                <Fragment title="Receipt — instalment 4, collected 9 Dec 2026" className="self-start" surface="bg-[#FAF7F0]">
                  <div className="space-y-2 text-sm">
                    <p className="flex items-baseline justify-between gap-6">
                      <span className={INK_3}>Amount · Cash · Arjun Nair</span>
                      <span className={`${MONO} font-medium`}>₹7,437.50</span>
                    </p>
                    <p className="flex items-baseline justify-between gap-6">
                      <span className={INK_3}>Status</span>
                      <span>Verified by owner</span>
                    </p>
                    <div className={`space-y-1.5 border-t ${HAIR} pt-2.5 ${MONO} text-[13px]`}>
                      <p className="flex items-baseline justify-between gap-6">
                        <span>Dr Cash in Hand</span>
                        <span>₹7,437.50</span>
                      </p>
                      <p className="flex items-baseline justify-between gap-6">
                        <span>Cr Loans Receivable</span>
                        <span>₹6,250.00</span>
                      </p>
                      <p className="flex items-baseline justify-between gap-6">
                        <span>Cr Interest Income</span>
                        <span>₹1,125.00</span>
                      </p>
                      <p className="flex items-baseline justify-between gap-6">
                        <span>Cr Fee Income</span>
                        <span>₹62.50</span>
                      </p>
                    </div>
                  </div>
                </Fragment>
              </div>

              {/* Step 6 — Portfolio & report view */}
              <div className="grid gap-8 py-12 lg:grid-cols-[18rem_1fr] lg:gap-14">
                <div>
                  <p className={`${MONO} text-sm text-[#34D399]`}>Step 6</p>
                  <h3 className={`mt-2 ${SERIF} text-[1.45rem] font-medium leading-snug ${IVORY_T}`}>The report view</h3>
                  <p className={`mt-3 leading-[1.6] ${IVORY_2}`}>
                    The loan now stands at four instalments paid. It appears in the
                    portfolio report, the collections report and the audit trail —
                    three views of the same entries, because there is only one ledger.
                  </p>
                </div>
                <Fragment title="Portfolio — this loan" className="self-start" surface="bg-[#FAF7F0]">
                  <dl className="space-y-2 text-sm">
                    {[
                      ['Status', 'Active'],
                      ['Instalments paid', '4 of 12'],
                      ['Outstanding principal', '₹50,000.00'],
                      ['Next EMI due', '5 Jan 2027'],
                      ['Audit trail', 'Application → disbursal → 4 collections'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-6">
                        <dt className={INK_3}>{k}</dt>
                        <dd className="text-right font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Fragment>
              </div>
            </div>
          </div>
        </section>

        {/* Module chapters — serif outcome headings, hairline rows,
            one ledger fragment each. */}
        <section className={`${CONTAINER} ${SECTION}`}>
          <SectionHead title="Four modules. One ledger underneath.">
            Each module is a part of the same working day, and each writes to —
            and reads from — the same records.
          </SectionHead>
          <div className={`divide-y divide-[#14231C]/10 border-y ${HAIR}`}>
            {MODULES.map((mod) => (
              <article key={mod.title} className="grid gap-8 py-12 lg:grid-cols-2 lg:gap-14">
                <div>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#047857]">{mod.title}</p>
                  <h3 className={`mt-2.5 max-w-[26ch] ${SERIF} text-[1.7rem] font-medium leading-[1.15]`}>
                    {mod.heading}
                  </h3>
                  <p className={`mt-4 max-w-[65ch] leading-[1.6] ${INK_2}`}>{mod.intro}</p>
                  <div className="mt-7">
                    <Fragment title={mod.title} surface="bg-white" className="shadow-[0_16px_44px_-24px_rgba(20,35,28,0.25)]">
                      {mod.fragment}
                    </Fragment>
                  </div>
                </div>
                <ul className={`divide-y divide-[#14231C]/10 self-start border-y ${HAIR}`}>
                  {mod.rows.map((row) => (
                    <li key={row} className="py-3.5 leading-[1.6]">
                      {row}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className={`mt-8 text-sm leading-[1.5] ${INK_3}`}>
            The figures in these fragments are sample data, from the same sample loan as the lifecycle above.
          </p>
        </section>

        {/* How going live works — a real sequence, so it is numbered */}
        <section id="onboarding" className="scroll-mt-16 bg-[#F3EEE2]">
          <div className={`${CONTAINER} ${SECTION}`}>
            <SectionHead title="How it works">
              Four steps between the book you keep today and the same book in
              LoanOps. The work at each step is stated plainly — who does it,
              and what you hand over.
            </SectionHead>
            <ol className={`divide-y divide-[#14231C]/10 border-y ${HAIR} list-none`}>
              {ONBOARDING.map((step, i) => (
                <li key={step.title} className="grid gap-2 py-8 md:grid-cols-[4rem_18rem_1fr] md:gap-x-8">
                  <span className={`${MONO} text-sm font-medium text-[#047857]`}>{String(i + 1).padStart(2, '0')}</span>
                  <h3 className={`${SERIF} text-[1.3rem] font-medium leading-snug`}>{step.title}</h3>
                  <p className={`max-w-[65ch] leading-[1.6] ${INK_2}`}>{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <MiniCta />
      </main>

      {/* Footer & Legal Compliance — shared components, untouched */}
      <LegalFooter />
      <CookieBanner />
    </div>
  )
}
