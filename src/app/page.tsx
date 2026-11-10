import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { JsonLd } from '@/components/json-ld'
import { LegalFooter } from '@/components/legal/legal-footer'
import { CookieBanner } from '@/components/legal/cookie-banner'
import { EnquiryForm } from '@/components/enquiry-form'

// Public product homepage — built from the 2026-11-10 homepage design
// research (~/workspace/research_notes/top-saas-homepage-design-research-20261110-0737):
// clarity in the first screen, then product evidence a buyer can check.
// It carries exactly ONE link to the login page — the "Log in" text
// link in the header. There are no separate owner/agent/customer login
// links anywhere; one login serves everyone, and the account's role
// decides what opens.
//
// Homepage-scoped type system (research §(b)): IBM Plex Sans for
// display/body, IBM Plex Mono for every amount, date and ID. Loaded
// here and applied only inside this page's wrapper — the app layout
// and every other page keep their existing fonts.

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

const PAGE_TITLE = 'LoanOps — Loan Operations Software for NBFCs and MFIs'
const PAGE_DESCRIPTION =
  'LoanOps is the loan operations system for NBFCs and MFIs: origination, disbursal, collections, a paise-exact ledger and reports in one system, replacing Excel and disconnected tools. Book a demo.'

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

// Palette (research §(b)): ~90% neutral, one accent that owns every
// filled action. Ink is a tinted near-black, never pure black; the
// accent is the product's brand navy. Semantic colours appear only
// inside product-UI data, where they carry meaning.
//
// Contrast (phase-2 research §accessibility): every text token is
// checked against BOTH page surfaces — white and the alt tint
// #f8f9fb. INK_2 (70% ink) computes 6.58:1 / 6.43:1; INK_3 is the
// tertiary token, raised from 55% (3.97:1 / 3.91:1 — failed AA) to
// 62%, which composites to rgb(107,112,122) on white and
// rgb(104,110,120) on the alt tint: 4.99:1 and 4.90:1, both clear
// of the 4.5:1 floor for normal text at 12–15px.
const INK = 'text-[#101828]'
const INK_2 = 'text-[#101828]/70'
const INK_3 = 'text-[#101828]/62'
const HAIR = 'border-[#101828]/10'
const MONO = '[font-family:var(--font-plex-mono)] tabular-nums'
const CONTAINER = 'mx-auto w-full max-w-7xl px-6 lg:px-8'
const SECTION = 'py-24 lg:py-32'

// Type ladder (phase-2 research §tokens), as used across this page:
// display −0.025em / 1.03 → section H2 −0.02em / 1.08 → H3
// −0.015…−0.01em → body tracking 0, leading 1.6 → lead 1.55 →
// small text 1.5; eyebrow +0.08em; all data in mono, tabular.
//
// Motion tokens (phase-2 research §motion) — the only two durations
// on this page: hover/state 160ms on the standard easing
// cubic-bezier(0.3,0,0.2,1); the hero reveal is 600ms on the
// entrance easing cubic-bezier(0,0,0.2,1), fires once, and exists
// only under prefers-reduced-motion: no-preference (see the style
// block in Page).
const HOVER = 'transition-colors duration-[160ms] ease-[cubic-bezier(0.3,0,0.2,1)]'

const NAV_LINK =
  `text-[15px] text-[#101828]/70 underline-offset-4 ${HOVER} hover:text-[#101828] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3778] focus-visible:ring-offset-2 rounded-sm px-1 py-1`

const BTN_PRIMARY =
  `inline-flex h-11 items-center rounded-full bg-[#0f3778] px-5 text-[15px] font-medium text-white ${HOVER} hover:bg-[#0b2a5e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3778] focus-visible:ring-offset-2`

const BTN_GHOST =
  `inline-flex h-11 items-center rounded-full border border-[#101828]/15 px-5 text-[15px] font-medium text-[#101828] ${HOVER} hover:border-[#101828]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3778] focus-visible:ring-offset-2`

function SectionHead({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="mb-12 lg:mb-16">
      <h2 className={`max-w-[24ch] text-3xl font-medium leading-[1.08] tracking-[-0.02em] md:text-[2.5rem] ${INK}`}>
        {title}
      </h2>
      {children ? (
        <p className={`mt-5 max-w-[65ch] text-lg leading-[1.55] ${INK_2}`}>{children}</p>
      ) : null}
    </div>
  )
}

// A flat product-UI fragment: white surface, hairline border, no
// shadow except on the one hero panel. Used for every product excerpt
// on the page so the evidence reads in one consistent hand.
function Fragment({
  title,
  children,
  className = '',
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <figure className={`overflow-hidden rounded-lg border ${HAIR} bg-white ${className}`}>
      <figcaption
        className={`border-b ${HAIR} px-5 py-3 text-[13px] font-medium ${INK_2}`}
      >
        {title}
      </figcaption>
      <div className="px-5 py-4">{children}</div>
    </figure>
  )
}

// ------------------------------------------------------------------
// Hero panel: one collections day. The figures are sample data and
// they add up — paid rows total ₹20,075.00 of ₹29,705.00 due today,
// and the ageing row totals ₹87,08,212 outstanding, in the product's
// own ageing buckets (1–7 / 8–15 / 16–30 / 31–60 / 60+ days).
// ------------------------------------------------------------------

const COLLECTIONS: Array<{
  borrower: string
  detail: string
  emi: string
  mode: string
  status: 'Paid' | 'Due' | 'Overdue'
}> = [
  { borrower: 'Priya Sharma', detail: 'Personal loan · Agent: Arjun Nair', emi: '₹7,437.50', mode: 'Cash', status: 'Paid' },
  { borrower: 'Rahul Verma', detail: 'Personal loan · Agent: Arjun Nair', emi: '₹7,437.50', mode: 'Bank', status: 'Paid' },
  { borrower: 'Karthik Shetty', detail: 'Business loan · Agent: Sneha Kapoor', emi: '₹5,200.00', mode: 'Cash', status: 'Paid' },
  { borrower: 'Anitha Rao', detail: 'Personal loan · Agent: Sneha Kapoor', emi: '₹3,150.00', mode: '—', status: 'Due' },
  { borrower: 'Mohammed Faiz', detail: 'Business loan · Agent: Arjun Nair', emi: '₹6,480.00', mode: '—', status: 'Overdue' },
]

const AGEING: Array<{ bucket: string; amount: string }> = [
  { bucket: 'Current', amount: '₹86,42,750' },
  { bucket: '1–7 days', amount: '₹22,310' },
  { bucket: '8–15 days', amount: '₹9,640' },
  { bucket: '16–30 days', amount: '₹14,875' },
  { bucket: '31–60 days', amount: '₹7,437' },
  { bucket: '60+ days', amount: '₹11,200' },
]

const TRUST_FACTS = [
  'Origination · Collections · Ledger · Reports — one system',
  'Paise-exact ledger. Integer amounts, no floats',
  'DPDP consent records, itemised when a borrower applies',
  'Built and supported in India by NIRVYA PTD LTD',
]

const PROBLEMS: Array<{ title: string; cost: string }> = [
  {
    title: 'Loans tracked in Excel and notebooks',
    cost: 'The book exists in more than one copy, and no two copies agree at month-end.',
  },
  {
    title: 'The collection position is known days late',
    cost: 'You learn what the field collected when the agent returns to the office, or when the cash is counted.',
  },
  {
    title: 'Ledger and reports rebuilt by hand for audit',
    cost: 'Every audit begins with re-typing figures that were already written down once, in a register.',
  },
]

// ------------------------------------------------------------------
// The lifecycle of one loan — Priya Sharma, ₹75,000 at 18% over 12
// months, the product's audited demo loan. EMI ₹7,437.50 (principal
// ₹6,250.00 + interest ₹1,125.00 + fee ₹62.50); total repayable
// ₹89,250.00. Instalment 4 falls overdue and is collected on 9 Dec.
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

// Beside the enquiry form (phase-2 research §forms): what happens
// after a visitor sends the form, in three steps. Process only —
// no response-time promise is made, because none is guaranteed.
const NEXT_STEPS: Array<{ title: string; desc: string }> = [
  {
    title: 'You send the enquiry',
    desc: 'Your name, mobile number and a few lines about your lending business — portfolio size and branches, if you know them.',
  },
  {
    title: 'We go through your lending business details',
    desc: 'We read what you have sent before we reply, so the conversation starts from your book, not from a script.',
  },
  {
    title: 'We set up your demo on sample data and walk you through it',
    desc: 'A working session on the same screens shown on this page, with your questions on them. No commitment.',
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

const SECURITY_ROWS: Array<{ title: string; desc: string }> = [
  {
    title: 'Encryption for identity and bank data',
    desc: 'Aadhaar, PAN and bank details are encrypted with AES-256-GCM and masked on everyday screens. An owner can reveal a number only on the record, and the reveal is audit-logged.',
  },
  {
    title: 'Passwords and sign-in',
    desc: 'Passwords are hashed, never stored in readable form, and a password policy is enforced when one is set. Sign-in is rate-limited, repeated failures lock the account, and staff accounts can add TOTP two-factor codes.',
  },
  {
    title: 'Access enforced on the server',
    desc: 'Owner, agent and borrower roles are checked on the server, not just in the browser. Agents see the work assigned to them; a borrower sees only their own loans.',
  },
  {
    title: 'An audit trail that stays written',
    desc: 'Sign-ins, approvals, disbursals, collections and corrections are recorded in an append-only audit trail. Corrections are reversal entries — nothing is quietly edited after the fact.',
  },
  {
    title: 'Consent records under DPDP',
    desc: 'When a borrower applies and submits, each consent is recorded item by item — what was agreed, and what was not — against the application it belongs to.',
  },
  {
    title: 'Backups',
    desc: 'The database is backed up automatically every week, and backups are retained for 90 days.',
  },
  {
    title: 'Your data stays exportable',
    desc: 'Reports export to CSV. The figures your business runs on are never locked inside the product.',
  },
]

export default function Page() {
  return (
    <div
      className={`${plexSans.variable} ${plexMono.variable} flex min-h-screen flex-col bg-white [font-family:var(--font-plex-sans),sans-serif] ${INK}`}
    >
      {/* Homepage-only JSON-LD (Organization + SoftwareApplication). */}
      <JsonLd />

      {/* Hero reveal — the page's one entrance animation (600ms,
          entrance easing, fires once). It is defined ONLY under
          prefers-reduced-motion: no-preference, so a visitor who
          prefers reduced motion gets no transform/opacity
          animation at all: the panel is simply there. */}
      <style>{`
        @keyframes hp-hero-reveal {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .hp-hero-reveal { animation: hp-hero-reveal 600ms cubic-bezier(0, 0, 0.2, 1) both; }
        }
      `}</style>

      {/* Header — sticky, hairline-ruled. Wordmark left, section
          anchors in the centre, and on the right the page's ONLY
          login link (plain text) followed by the one filled pill. */}
      <header className={`sticky top-0 z-30 border-b ${HAIR} bg-white`}>
        <div className={`${CONTAINER} flex h-16 items-center justify-between gap-4`}>
          <a
            href="#top"
            className="flex h-11 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3778] focus-visible:ring-offset-2"
            aria-label="LoanOps — back to top"
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 bg-[#0f3778]" />
            <span className="text-[17px] font-semibold leading-none tracking-[-0.01em]">LoanOps</span>
          </a>
          <nav aria-label="Homepage sections" className="hidden items-center gap-5 lg:flex">
            <a href="#product" className={NAV_LINK}>Product</a>
            <a href="#lifecycle" className={NAV_LINK}>Lifecycle</a>
            <a href="#modules" className={NAV_LINK}>Modules</a>
            <a href="#security" className={NAV_LINK}>Security</a>
            <a href="#how" className={NAV_LINK}>How it works</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            <a
              href="/login"
              className={`inline-flex h-11 items-center rounded-sm px-2 text-[15px] font-medium text-[#101828] underline-offset-4 ${HOVER} hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3778] focus-visible:ring-offset-2`}
            >
              Log in
            </a>
            <a href="#enquire" className={BTN_PRIMARY}>
              Book a demo
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero — left-aligned type, then the product. The panel sits
            flat in a hairline frame with the page's one soft shadow,
            and bleeds off the hero's bottom edge into the trust bar. */}
        <section className={`${CONTAINER} pt-16 lg:pt-24`}>
          <p className={`text-xs font-semibold uppercase tracking-[0.08em] ${INK_2}`}>
            Loan operations software for NBFCs &amp; MFIs
          </p>
          <h1 className="mt-6 max-w-[18ch] text-5xl font-medium leading-[1.03] tracking-[-0.025em] md:text-[3.5rem]">
            The loan operations system for NBFCs and MFIs.
          </h1>
          <p className={`mt-6 max-w-[65ch] text-lg leading-[1.55] ${INK_2}`}>
            Origination, approval, disbursal, collections, the ledger and reports —
            one system for the whole life of a loan, replacing the Excel sheets and
            disconnected tools the work is spread across today.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3 sm:gap-4">
            <a href="#enquire" className={BTN_PRIMARY}>
              Book a demo
            </a>
            <a href="#lifecycle" className={BTN_GHOST}>
              See the product
            </a>
          </div>
          <p className={`mt-5 text-sm leading-[1.5] ${INK_2}`}>
            A working session on sample data, run by our team. No commitment.
          </p>

          {/* The product panel — one collections day */}
          <div className="hp-hero-reveal relative z-10 mt-14 -mb-28 lg:mt-16">
            <figure
              id="product"
              className={`scroll-mt-24 overflow-hidden rounded-lg border ${HAIR} bg-white shadow-[0_24px_64px_-16px_rgba(16,24,40,0.18)]`}
            >
              <div className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b ${HAIR} px-5 py-4 sm:px-7`}>
                <p className="text-[15px] font-semibold tracking-[-0.01em]">
                  Today’s collections
                  <span className={`ml-3 text-sm font-normal ${INK_3}`}>Tuesday, 10 Nov 2026</span>
                </p>
                <p className={`text-sm ${INK_3}`}>
                  Collected <span className={`${MONO} font-medium text-[#101828]`}>₹20,075.00</span> of{' '}
                  <span className={MONO}>₹29,705.00</span> due today
                </p>
              </div>

              <div className="table-scroll overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className={`border-b ${HAIR} text-left text-[13px] ${INK_3}`}>
                      <th scope="col" className="px-5 py-2.5 font-medium sm:px-7">Borrower</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">EMI (₹)</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Mode</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-medium sm:px-7">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COLLECTIONS.map((row) => (
                      <tr key={row.borrower} className={`border-b border-[#101828]/5 last:border-0`}>
                        <td className="px-5 py-3 sm:px-7">
                          <span className="font-medium">{row.borrower}</span>
                          <span className={`block text-[13px] ${INK_3}`}>{row.detail}</span>
                        </td>
                        <td className={`px-3 py-3 text-right ${MONO}`}>{row.emi}</td>
                        <td className={`px-3 py-3 ${INK_2}`}>{row.mode}</td>
                        <td className="px-5 py-3 text-right sm:px-7">
                          {row.status === 'Paid' ? (
                            <span className="font-medium text-[#067647]">Paid</span>
                          ) : row.status === 'Overdue' ? (
                            <span className="font-medium text-[#b42318]">Overdue · DPD 12</span>
                          ) : (
                            <span className={INK_2}>Due</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={`border-t ${HAIR} px-5 py-4 sm:px-7`}>
                <p className={`text-[13px] font-medium ${INK_2}`}>Portfolio by days past due</p>
                <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3 min-[480px]:grid-cols-3 lg:grid-cols-6">
                  {AGEING.map((cell) => (
                    <div key={cell.bucket}>
                      <dt className={`text-[12px] ${INK_3}`}>{cell.bucket}</dt>
                      <dd className={`mt-0.5 text-sm ${MONO}`}>{cell.amount}</dd>
                    </div>
                  ))}
                </dl>
                <p className={`mt-3 text-[13px] ${INK_3}`}>
                  Total outstanding <span className={`${MONO} font-medium text-[#101828]`}>₹87,08,212</span> ·
                  Ageing drawn from the same ledger as the collections above
                </p>
              </div>
            </figure>
            <p className={`mt-3 text-[13px] ${INK_3}`}>Sample data.</p>
          </div>
        </section>

        {/* Trust bar — where a logo wall would sit. Verifiable facts
            only: no logos, no counts, no claims about other people. */}
        <div className={`border-b ${HAIR} bg-white`}>
          <div className={`${CONTAINER} pb-10 pt-40`}>
            <ul className={`grid gap-x-10 gap-y-3 border-t ${HAIR} pt-6 text-sm sm:grid-cols-2 lg:grid-cols-4`}>
              {TRUST_FACTS.map((fact) => (
                <li key={fact} className="leading-[1.5]">
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* The problem, in the buyer's nouns — three ruled rows */}
        <section className={`${CONTAINER} ${SECTION}`}>
          <SectionHead title="The work is sound. The records are scattered.">
            None of this is a people problem. It is what happens when one loan book
            is kept in a register, a spreadsheet and three people’s memory at once.
          </SectionHead>
          <div className={`divide-y divide-[#101828]/10 border-y ${HAIR}`}>
            {PROBLEMS.map((row) => (
              <div key={row.title} className="grid gap-1.5 py-7 md:grid-cols-[22rem_1fr] md:gap-x-12">
                <h3 className="text-lg font-medium tracking-[-0.01em]">{row.title}</h3>
                <p className={`max-w-[65ch] leading-[1.6] ${INK_2}`}>{row.cost}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Lifecycle — the centrepiece. One loan, followed from
            application to report, each step with the screen it
            produces. Sample data throughout, and labelled as such. */}
        <section id="lifecycle" className="scroll-mt-16 bg-[#f8f9fb]">
          <div className={`${CONTAINER} ${SECTION}`}>
            <SectionHead title="One loan, followed from application to report.">
              Priya Sharma’s loan — ₹75,000 at 18% over 12 months — is the sample
              every figure on this page comes from. Follow it through the system
              and check the numbers as you go. Sample data.
            </SectionHead>

            <div className={`divide-y divide-[#101828]/10 border-y ${HAIR}`}>
              {/* Step 1 — Application & approval */}
              <div className="grid gap-8 py-12 lg:grid-cols-[18rem_1fr] lg:gap-14">
                <div>
                  <p className={`${MONO} text-sm ${INK_3}`}>Step 1</p>
                  <h3 className="mt-2 text-xl font-medium tracking-[-0.01em]">Application &amp; approval</h3>
                  <p className={`mt-3 leading-[1.6] ${INK_2}`}>
                    She applies from a QR link the agent shares. KYC and consents are
                    collected in the same sitting, and the owner approves on the record —
                    nothing travels on paper.
                  </p>
                </div>
                <Fragment title="Application — Priya Sharma" className="self-start">
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
                  <p className={`${MONO} text-sm ${INK_3}`}>Step 2</p>
                  <h3 className="mt-2 text-xl font-medium tracking-[-0.01em]">Disbursal</h3>
                  <p className={`mt-3 leading-[1.6] ${INK_2}`}>
                    On 5 Aug 2026 the loan is disbursed to her bank account, and the
                    ledger posting is written by the same action — a balanced pair,
                    or nothing posts.
                  </p>
                </div>
                <Fragment title="Ledger — disbursement posting" className="self-start">
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
                  <p className={`${MONO} text-sm ${INK_3}`}>Step 3</p>
                  <h3 className="mt-2 text-xl font-medium tracking-[-0.01em]">The EMI schedule</h3>
                  <p className={`mt-3 leading-[1.6] ${INK_2}`}>
                    Twelve instalments of ₹7,437.50 — principal ₹6,250.00, interest
                    ₹1,125.00 and a ₹62.50 share of the ₹750 processing fee in each.
                    The borrower sees this same schedule in her portal.
                  </p>
                </div>
                <Fragment title="Instalment schedule — first five of twelve" className="self-start">
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
                          className={`border-b border-[#101828]/5 last:border-0 ${
                            row.status === 'Overdue' ? 'bg-[#fef3f2]' : ''
                          }`}
                        >
                          <td className={`py-2 pr-3 ${MONO} ${INK_3}`}>{row.n}</td>
                          <td className="py-2 pr-3">{row.due}</td>
                          <td className={`py-2 pr-3 text-right ${MONO}`}>{row.emi}</td>
                          <td className="py-2 text-right">
                            {row.status === 'Paid' ? (
                              <span className="font-medium text-[#067647]">Paid</span>
                            ) : row.status === 'Overdue' ? (
                              <span className="font-medium text-[#b42318]">Overdue</span>
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
                  <p className={`${MONO} text-sm ${INK_3}`}>Step 4</p>
                  <h3 className="mt-2 text-xl font-medium tracking-[-0.01em]">A missed payment</h3>
                  <p className={`mt-3 leading-[1.6] ${INK_2}`}>
                    Instalment 4 is not paid on 5 Dec. The loan moves in the ageing
                    the same day, the reminder run has already been ahead of it, and
                    the follow-up ends in a promise to pay — recorded, not remembered.
                  </p>
                </div>
                <Fragment title="Follow-up — instalment 4" className="self-start">
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
                        Instalment overdue · <span className="font-medium text-[#b42318]">DPD 1</span> · follow-up task created
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
                  <p className={`${MONO} text-sm ${INK_3}`}>Step 5</p>
                  <h3 className="mt-2 text-xl font-medium tracking-[-0.01em]">Collection &amp; receipt</h3>
                  <p className={`mt-3 leading-[1.6] ${INK_2}`}>
                    On 9 Dec the instalment is collected in cash at her doorstep. The
                    receipt is issued on the spot, the owner verifies it, and the
                    collection posts to the ledger in its three parts.
                  </p>
                </div>
                <Fragment title="Receipt — instalment 4, collected 9 Dec 2026" className="self-start">
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
                  <p className={`${MONO} text-sm ${INK_3}`}>Step 6</p>
                  <h3 className="mt-2 text-xl font-medium tracking-[-0.01em]">The report view</h3>
                  <p className={`mt-3 leading-[1.6] ${INK_2}`}>
                    The loan now stands at four instalments paid. It appears in the
                    portfolio report, the collections report and the audit trail —
                    three views of the same entries, because there is only one ledger.
                  </p>
                </div>
                <Fragment title="Portfolio — this loan" className="self-start">
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

        {/* Module chapters — typographic, hairline rows, one small
            fragment each. Headings are outcome clauses in the
            buyer's words. */}
        <section id="modules" className={`${CONTAINER} ${SECTION} scroll-mt-16`}>
          <SectionHead title="Four modules. One ledger underneath.">
            Each module is a part of the same working day, and each writes to —
            and reads from — the same records.
          </SectionHead>
          <div className={`divide-y divide-[#101828]/10 border-y ${HAIR}`}>
            {MODULES.map((mod) => (
              <article key={mod.title} className="grid gap-8 py-12 lg:grid-cols-2 lg:gap-14">
                <div>
                  <p className={`text-sm font-medium ${INK_3}`}>{mod.title}</p>
                  <h3 className="mt-2 max-w-[26ch] text-2xl font-medium leading-[1.15] tracking-[-0.015em]">
                    {mod.heading}
                  </h3>
                  <p className={`mt-4 max-w-[65ch] leading-[1.6] ${INK_2}`}>{mod.intro}</p>
                  <div className="mt-7">{mod.fragment}</div>
                </div>
                <ul className={`divide-y divide-[#101828]/10 self-start border-y ${HAIR}`}>
                  {mod.rows.map((row) => (
                    <li key={row} className="py-3.5 leading-[1.6]">
                      {row}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* How it works — a real sequence, so it is numbered */}
        <section id="how" className={`${CONTAINER} ${SECTION} scroll-mt-16`}>
          <SectionHead title="How it works">
            Four steps between the book you keep today and the same book in
            LoanOps. The work at each step is stated plainly — who does it,
            and what you hand over.
          </SectionHead>
          <ol className={`divide-y divide-[#101828]/10 border-y ${HAIR} list-none`}>
            {ONBOARDING.map((step, i) => (
              <li key={step.title} className="grid gap-2 py-8 md:grid-cols-[4rem_18rem_1fr] md:gap-x-8">
                <span className={`${MONO} text-sm ${INK_3}`}>{String(i + 1).padStart(2, '0')}</span>
                <h3 className="text-lg font-medium tracking-[-0.01em]">{step.title}</h3>
                <p className={`max-w-[65ch] leading-[1.6] ${INK_2}`}>{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Security & data — ruled two-column fact list. Every item
            is true of this codebase today; nothing is claimed that
            the product does not do. */}
        <section id="security" className={`${CONTAINER} ${SECTION} scroll-mt-16`}>
          <SectionHead title="Security &amp; data">
            Borrowers hand you their Aadhaar, their bank details and their trust.
            These are the arrangements that guard all three — stated as facts,
            each one true of the product as it runs today.
          </SectionHead>
          <dl className={`divide-y divide-[#101828]/10 border-y ${HAIR}`}>
            {SECURITY_ROWS.map((row) => (
              <div key={row.title} className="grid gap-1.5 py-7 md:grid-cols-[22rem_1fr] md:gap-x-12">
                <dt className="text-lg font-medium tracking-[-0.01em]">{row.title}</dt>
                <dd className={`max-w-[65ch] leading-[1.6] ${INK_2}`}>{row.desc}</dd>
              </div>
            ))}
          </dl>
          <p className={`mt-8 max-w-[65ch] leading-[1.6] ${INK_2}`}>
            One boundary, stated plainly: LoanOps is software. The lending
            institution remains the regulated lender — LoanOps keeps the records
            your auditors ask for.
          </p>
        </section>

        {/* Pricing approach + the demo form. The form component is
            untouched; this section presents it as what it is. */}
        <section id="enquire" className="scroll-mt-16 bg-[#f8f9fb]">
          <div className={`${CONTAINER} ${SECTION}`}>
            <SectionHead title="Book a demo">
              Pricing depends on the size of your portfolio and the number of
              branches you run. Put both in the enquiry and we will quote plainly —
              what it costs, what is included, and what migration involves — before
              you decide anything.
            </SectionHead>
            <div className="grid gap-12 lg:grid-cols-5 lg:gap-14">
              <div className="lg:col-span-2">
                <h3 className="text-lg font-medium tracking-[-0.01em]">What happens next</h3>
                <ol className={`mt-6 list-none divide-y divide-[#101828]/10 border-y ${HAIR}`}>
                  {NEXT_STEPS.map((step, i) => (
                    <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-x-3 py-5">
                      <span className={`${MONO} text-sm ${INK_3}`}>{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <p className="font-medium leading-[1.5]">{step.title}</p>
                        <p className={`mt-1 text-[15px] leading-[1.6] ${INK_2}`}>{step.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className={`mt-6 text-sm leading-[1.5] ${INK_2}`}>
                  Your details are used only to reply to your enquiry and to prepare
                  your demo, and they are never sold — as set out in the{' '}
                  <a
                    href="/privacy"
                    className={`font-medium text-[#101828] underline underline-offset-4 ${HOVER} hover:text-[#0f3778] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3778] focus-visible:ring-offset-2 rounded-sm`}
                  >
                    Privacy Policy
                  </a>
                  .
                </p>
                <p className={`mt-4 text-sm leading-[1.5] ${INK_2}`}>
                  Already a customer? Use the Log in link at the top of this page.
                </p>
              </div>
              <div className="lg:col-span-3">
                <div className={`rounded-lg border ${HAIR} bg-white p-5 sm:p-7`}>
                  <EnquiryForm />
                </div>
                <p className={`mt-4 text-sm leading-[1.5] ${INK_2}`}>
                  A working session on sample data, run by our team. No commitment.
                </p>
              </div>
            </div>
            <p className="mt-16 max-w-[22ch] text-2xl font-medium leading-[1.15] tracking-[-0.015em] md:text-3xl">
              The loan operations system for NBFCs and MFIs.
            </p>
          </div>
        </section>
      </main>

      {/* Footer & Legal Compliance — shared components, untouched */}
      <LegalFooter />
      <CookieBanner />
    </div>
  )
}
