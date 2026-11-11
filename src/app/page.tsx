import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Image from 'next/image'
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { JsonLd } from '@/components/json-ld'
import { LegalFooter } from '@/components/legal/legal-footer'
import { CookieBanner } from '@/components/legal/cookie-banner'
import { EnquiryForm } from '@/components/enquiry-form'

// Public product homepage — the concept redesign (2026-11-11).
//
// Concept: "The world your borrowers live in — the calm your office
// runs on." A dawn painting of fields, a lotus pond and a small town
// fills the hero; floating on it, one glass loan card carries the
// product. Below the hero the page settles onto warm ivory, with one
// deep-green section (the lifecycle) and the market-street painting
// as a full-bleed band. The structure, facts and figures are the
// previous homepage's, unchanged — only the design language is new.
//
// It carries exactly ONE link to the login page — the "Log in" pill
// in the floating nav. There are no separate owner/agent/customer
// login links anywhere; one login serves everyone, and the account's
// role decides what opens.
//
// Type system (homepage scope only, applied inside this page's
// wrapper): Fraunces for display headlines, IBM Plex Sans for body,
// IBM Plex Mono for every amount, date and ID.

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

// Palette: deep forest green is the brand and the one accent family
// (emerald shades only — gold exists only inside the paintings).
// Sections below the hero sit on warm ivory #FAF7F0; text ink is a
// green-tinted near-black #14231C.
//
// Contrast (WCAG, computed 2026-11-11 — see homepage-concept-report):
// on ivory, ink 15.25:1, ink/70 5.83:1, ink/64 4.85:1 — every text
// token clears 4.5:1 on ivory, white and the deeper alt ivory
// #F3EEE2 (worst case ink/64 on alt ivory: 4.69:1). On the green
// #0A3D2C, ivory 11.43:1, ivory/75 7.11:1, ivory/65 5.77:1,
// emerald #34D399 6.36:1. Over the hero painting, the deep-green
// scrim (alpha 0.55 → 0.90) brings even the 99th-percentile-bright
// pixel band to 5.12:1 for white text; the headline band computes
// 9.92:1 or better.
const INK = 'text-[#14231C]'
const INK_2 = 'text-[#14231C]/70'
const INK_3 = 'text-[#14231C]/64'
const IVORY_T = 'text-[#FAF7F0]'
const IVORY_2 = 'text-[#FAF7F0]/75'
const IVORY_3 = 'text-[#FAF7F0]/65'
const HAIR = 'border-[#14231C]/10'
const HAIR_L = 'border-white/15'
const MONO = '[font-family:var(--font-plex-mono)] tabular-nums'
const SERIF = '[font-family:var(--font-fraunces),Georgia,serif]'
const CONTAINER = 'mx-auto w-full max-w-7xl px-6 lg:px-8'
const SECTION = 'py-24 lg:py-32'

// Motion tokens — the only two durations on this page: hover/state
// 160ms on the standard easing cubic-bezier(0.3,0,0.2,1); the hero
// reveal is 600ms on the entrance easing cubic-bezier(0,0,0.2,1),
// fires once, transform/opacity only, and exists only under
// prefers-reduced-motion: no-preference (see the style block in Page).
const HOVER = 'transition-colors duration-[160ms] ease-[cubic-bezier(0.3,0,0.2,1)]'

const NAV_LINK =
  `inline-flex h-11 items-center px-2 text-[15px] text-[#FAF7F0]/85 underline-offset-4 ${HOVER} hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-full`

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

// The EM-chip glyph on the loan card — drawn, not an icon font.
function CardChip() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 44 32"
      className="h-8 w-11 text-[#FAF7F0]/85"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="1.5" y="1.5" width="41" height="29" rx="6" />
      <path d="M1.5 11h13M1.5 21h13M44 11H31M44 21H31M14.5 11v10M29.5 11v10" transform="translate(-1 0)" />
      <rect x="15" y="11" width="14" height="10" rx="2" />
    </svg>
  )
}

// ------------------------------------------------------------------
// Page data — the established sample loan and product facts, carried
// over unchanged from the previous homepage. Priya Sharma's loan:
// ₹75,000 at 18% over 12 months. EMI ₹7,437.50 (principal ₹6,250.00
// + interest ₹1,125.00 + fee ₹62.50); total repayable ₹89,250.00.
// Collections day: ₹20,075.00 collected of ₹29,705.00 due; portfolio
// ageing totals ₹87,08,212 across the product's six DPD buckets.
// ------------------------------------------------------------------

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

// Beside the enquiry form: what happens after a visitor sends the
// form, in three steps. Process only — no response-time promise is
// made, because none is guaranteed.
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
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} flex min-h-screen flex-col bg-[#FAF7F0] [font-family:var(--font-plex-sans),sans-serif] ${INK}`}
    >
      {/* Homepage-only JSON-LD (Organization + SoftwareApplication). */}
      <JsonLd />

      {/* Entrance reveal — the page's one animation (600ms, entrance
          easing, fires once, transform/opacity only). It is defined
          ONLY under prefers-reduced-motion: no-preference, so a
          visitor who prefers reduced motion gets no animation at
          all: the card and headline are simply there. */}
      <style>{`
        @keyframes hp-reveal {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .hp-reveal { animation: hp-reveal 600ms cubic-bezier(0, 0, 0.2, 1) both; }
        }
      `}</style>

      <main className="flex-1">
      {/* ============ HERO — the borrower's world, the product on it ============ */}
      <section className="relative overflow-hidden bg-[#06231A]">
        <Image
          src="/landing/hero-landscape.jpg"
          alt=""
          fill
          preload
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Deep-green scrim: a legibility gradient over the painting
            (linear alpha 0.55 → 0.90, measured — see palette note),
            deepened at the centre where the card and headline sit. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(6,35,26,0.55),rgba(6,35,26,0.72)_45%,rgba(6,35,26,0.90))]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_62%_52%_at_50%_58%,rgba(6,35,26,0.38),transparent_72%)]"
        />

        {/* Floating glass pill nav. On the right: a Book a demo text
            link and the page's ONLY login link — Log in, the white
            filled pill. One login serves every role. */}
        <header className="relative z-20">
          <div className={`${CONTAINER} pt-4 sm:pt-6`}>
            <div className="flex h-16 items-center justify-between gap-3 rounded-full border border-white/20 bg-[#04150E]/45 py-2 pl-5 pr-2 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.55)] backdrop-blur-md sm:pl-6">
              <a
                href="#top"
                className="flex h-11 items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="LoanOps — back to top"
              >
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-[#34D399]" />
                <span className="text-[17px] font-semibold leading-none tracking-[-0.01em] text-white">LoanOps</span>
              </a>
              <nav aria-label="Homepage sections" className="hidden items-center gap-4 lg:flex">
                <a href="#lifecycle" className={NAV_LINK}>Lifecycle</a>
                <a href="#modules" className={NAV_LINK}>Modules</a>
                <a href="#security" className={NAV_LINK}>Security</a>
              </nav>
              <div className="flex items-center gap-1.5 sm:gap-3">
                <a href="#enquire" className={`hidden h-11 items-center px-2 text-[15px] font-medium text-[#FAF7F0] underline-offset-4 ${HOVER} hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-full sm:inline-flex`}>
                  Book a demo
                </a>
                <a
                  href="/login"
                  className={`inline-flex h-11 items-center rounded-full bg-white px-5 text-[15px] font-semibold text-[#0A3D2C] ${HOVER} hover:bg-[#FAF7F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A3D2C]`}
                >
                  Log in
                </a>
              </div>
            </div>
          </div>
        </header>

        <div id="top" className={`relative z-10 ${CONTAINER} flex flex-col items-center pb-24 pt-12 text-center lg:pb-32 lg:pt-16`}>
          <p className="inline-flex h-9 items-center rounded-full border border-white/25 bg-[#04150E]/40 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FAF7F0] backdrop-blur-md">
            For NBFCs &amp; Microfinance Teams
          </p>

          {/* The loan card group — the product, floating on the
              painting. The two glass chips sit beside the card on
              wide screens and stack beneath it on smaller ones. All
              three carry sample figures; the caption is attached to
              the group as its figcaption. */}
          <figure id="product" className="hp-reveal relative mt-10 w-full max-w-[35rem] scroll-mt-24">
            <div className="relative overflow-hidden rounded-[24px] border border-white/25 bg-[linear-gradient(135deg,rgba(12,68,48,0.88),rgba(5,30,20,0.94))] p-6 text-left shadow-[0_40px_90px_-30px_rgba(0,0,0,0.65)] backdrop-blur-md sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/30" />
              <div className="flex items-start justify-between gap-6">
                <span className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-[#34D399]" />
                  <span className="text-[17px] font-semibold leading-none tracking-[-0.01em] text-white">LoanOps</span>
                </span>
                <CardChip />
              </div>
              <div className={`mt-7 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t ${HAIR_L} pt-6`}>
                <p className="text-lg font-medium text-white">Priya Sharma</p>
                <p className={`${MONO} text-[13px] ${IVORY_2}`}>LOAN-001 · Personal loan</p>
              </div>
              <div className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                <div>
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${IVORY_3}`}>Monthly EMI</p>
                  <p className={`${MONO} mt-1.5 text-[2.5rem] font-medium leading-none text-white sm:text-[2.75rem]`}>₹7,437.50</p>
                </div>
                <div className="min-w-[9.5rem]">
                  <p className="text-sm text-[#FAF7F0]">
                    <span className="font-semibold">3 of 12</span> <span className={IVORY_2}>EMIs paid</span>
                  </p>
                  <div aria-hidden="true" className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                    <div className="h-full w-1/4 rounded-full bg-[#34D399]" />
                  </div>
                </div>
              </div>
              <div className={`mt-7 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t ${HAIR_L} pt-5 ${MONO} text-[13px] ${IVORY_2}`}>
                <p>Next EMI · 5 Dec 2026</p>
                <p>₹75,000 · 18% · 12 months</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center xl:contents">
              <div className="rounded-[20px] border border-white/20 bg-[#04150E]/55 px-5 py-4 text-left shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] backdrop-blur-md sm:w-64 xl:absolute xl:-left-[17.5rem] xl:top-14 xl:mt-0">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${IVORY_3}`}>Today’s collections</p>
                <p className="mt-1.5 text-[15px] text-[#FAF7F0]">
                  <span className={`${MONO} text-xl font-medium text-white`}>₹20,075</span> collected
                </p>
                <p className={`mt-1 text-[13px] ${IVORY_2}`}>of ₹29,705.00 due today</p>
              </div>
              <div className="rounded-[20px] border border-white/20 bg-[#04150E]/55 px-5 py-4 text-left shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] backdrop-blur-md sm:w-64 xl:absolute xl:-right-[17.5rem] xl:top-32 xl:mt-0">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${IVORY_3}`}>Portfolio ageing</p>
                <p className="mt-1.5 text-[15px] text-[#FAF7F0]">
                  <span className={`${MONO} text-xl font-medium text-white`}>₹87,08,212</span> outstanding
                </p>
                <p className={`mt-1 text-[13px] ${IVORY_2}`}>across 6 DPD buckets</p>
              </div>
            </div>

            <figcaption className="mt-5 text-sm text-[#FAF7F0]/85">Sample data</figcaption>
          </figure>

          <div className="hp-reveal flex flex-col items-center">
            <h1 className={`mt-12 max-w-[17ch] ${SERIF} text-[2.65rem] font-medium leading-[1.06] text-white sm:text-6xl lg:text-[4.3rem]`}>
              Run your entire lending business in one <em className="italic text-[#A7E8C9]">calm</em> platform.
            </h1>
            <p className="mt-6 max-w-[62ch] text-lg leading-[1.6] text-[#FAF7F0]/95">
              Origination, approval, disbursal, collections, the ledger and reports —
              the whole life of a loan in one system, replacing the Excel sheets and
              disconnected tools the work is spread across today.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <a
                href="#enquire"
                className={`inline-flex h-12 items-center rounded-full bg-white px-7 text-base font-semibold text-[#0A3D2C] ${HOVER} hover:bg-[#FAF7F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`}
              >
                Book a demo
              </a>
              <a
                href="#lifecycle"
                className={`inline-flex h-12 items-center rounded-full border border-white/35 bg-white/5 px-7 text-base font-medium text-white backdrop-blur-md ${HOVER} hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white`}
              >
                See how it works
              </a>
            </div>
            <p className="mt-5 text-sm leading-[1.5] text-[#FAF7F0]/80">
              A working session on sample data, run by our team. No commitment.
            </p>
          </div>
        </div>
      </section>

      {/* Trust strip — where a logo wall would sit. Verifiable facts
          only: no logos, no counts, no claims about other people. */}
      <div className={`border-b ${HAIR}`}>
        <div className={`${CONTAINER} py-12`}>
          <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_FACTS.map((fact) => (
              <li key={fact}>
                <span aria-hidden="true" className="block h-px w-8 bg-[#047857]" />
                <p className="mt-3 text-[15px] font-medium leading-[1.5]">{fact}</p>
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
        <div className={`divide-y divide-[#14231C]/10 border-y ${HAIR}`}>
          {PROBLEMS.map((row) => (
            <div key={row.title} className="grid gap-1.5 py-7 md:grid-cols-[22rem_1fr] md:gap-x-12">
              <h3 className={`${SERIF} text-[1.35rem] font-medium leading-snug`}>{row.title}</h3>
              <p className={`max-w-[65ch] leading-[1.6] ${INK_2}`}>{row.cost}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Market band — the high street the borrowers live on. A
          positioning line, not a factual claim. */}
      <section className="relative overflow-hidden bg-[#06231A]">
        <Image
          src="/landing/market-street.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(6,35,26,0.66),rgba(6,35,26,0.78))]"
        />
        <div className={`relative ${CONTAINER} py-28 text-center lg:py-36`}>
          <p className={`mx-auto max-w-[27ch] ${SERIF} text-3xl font-medium leading-[1.2] text-white md:text-[2.6rem]`}>
            Built for the high streets and small towns where your borrowers actually live.
          </p>
        </div>
      </section>

      {/* Lifecycle — the centrepiece, on deep green. One loan,
          followed from application to report, each step with the
          ledger page it produces. Sample data throughout, and
          labelled as such. */}
      <section id="lifecycle" className="scroll-mt-16 bg-[#0A3D2C]">
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
      <section id="modules" className={`${CONTAINER} ${SECTION} scroll-mt-16`}>
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

      {/* How it works — a real sequence, so it is numbered */}
      <section id="how" className="scroll-mt-16 bg-[#F3EEE2]">
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

      {/* Security & data — ruled two-column fact list. Every item
          is true of this codebase today; nothing is claimed that
          the product does not do. */}
      <section id="security" className={`${CONTAINER} ${SECTION} scroll-mt-16`}>
        <SectionHead title="Security &amp; data">
          Borrowers hand you their Aadhaar, their bank details and their trust.
          These are the arrangements that guard all three — stated as facts,
          each one true of the product as it runs today.
        </SectionHead>
        <dl className={`divide-y divide-[#14231C]/10 border-y ${HAIR}`}>
          {SECURITY_ROWS.map((row) => (
            <div key={row.title} className="grid gap-1.5 py-7 md:grid-cols-[22rem_1fr] md:gap-x-12">
              <dt className={`${SERIF} text-[1.3rem] font-medium leading-snug`}>{row.title}</dt>
              <dd className={`max-w-[65ch] leading-[1.6] ${INK_2}`}>{row.desc}</dd>
            </div>
          ))}
        </dl>
        <p className={`mt-10 max-w-[58ch] ${SERIF} text-[1.35rem] font-medium leading-[1.35]`}>
          One boundary, stated plainly: LoanOps is software. The lending
          institution remains the regulated lender — LoanOps keeps the records
          your auditors ask for.
        </p>
      </section>

      {/* Enquire — on deep green, to close the page where it began.
          The form component is untouched; this section presents it
          as what it is. */}
      <section id="enquire" className="scroll-mt-16 bg-[#0A3D2C]">
        <div className={`${CONTAINER} ${SECTION}`}>
          <SectionHead tone="ivory" title="Book a demo">
            Pricing depends on the size of your portfolio and the number of
            branches you run. Put both in the enquiry and we will quote plainly —
            what it costs, what is included, and what migration involves — before
            you decide anything.
          </SectionHead>
          <div className="grid gap-12 lg:grid-cols-5 lg:gap-14">
            <div className="lg:col-span-2">
              <h3 className={`${SERIF} text-[1.35rem] font-medium ${IVORY_T}`}>What happens next</h3>
              <ol className="mt-6 list-none divide-y divide-white/10 border-y border-white/10">
                {NEXT_STEPS.map((step, i) => (
                  <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-x-3 py-5">
                    <span className={`${MONO} text-sm text-[#34D399]`}>{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <p className={`font-medium leading-[1.5] ${IVORY_T}`}>{step.title}</p>
                      <p className={`mt-1 text-[15px] leading-[1.6] ${IVORY_2}`}>{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className={`mt-6 text-sm leading-[1.5] ${IVORY_2}`}>
                Your details are used only to reply to your enquiry and to prepare
                your demo, and they are never sold — as set out in the{' '}
                <a
                  href="/privacy"
                  className={`font-medium text-[#6EE7B7] underline underline-offset-4 ${HOVER} hover:text-[#A7E8C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-sm`}
                >
                  Privacy Policy
                </a>
                .
              </p>
              <p className={`mt-4 text-sm leading-[1.5] ${IVORY_2}`}>
                Already a customer? Use the Log in link at the top of this page.
              </p>
            </div>
            <div className="lg:col-span-3">
              <div className="rounded-[24px] bg-white p-5 shadow-[0_32px_80px_-32px_rgba(0,0,0,0.5)] sm:p-7">
                <EnquiryForm />
              </div>
              <p className={`mt-4 text-sm leading-[1.5] ${IVORY_2}`}>
                A working session on sample data, run by our team. No commitment.
              </p>
            </div>
          </div>
          <p className={`mt-16 max-w-[24ch] ${SERIF} text-2xl font-medium leading-[1.18] ${IVORY_T} md:text-3xl`}>
            Run your entire lending business in one calm platform.
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
