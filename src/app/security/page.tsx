import type { Metadata } from 'next'
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { LegalFooter } from '@/components/legal/legal-footer'
import { CookieBanner } from '@/components/legal/cookie-banner'

// Security detail page — the depth behind the homepage strip.
//
// The homepage carries three assurances; this page carries all
// seven arrangements, in the same words the homepage used before
// the trim. Every item is true of this codebase today; nothing is
// claimed that the product does not do.
//
// Type system matches the homepage: Fraunces for display, IBM Plex
// Sans for body, IBM Plex Mono for figures and IDs.

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

const PAGE_TITLE = 'LoanOps — Security & Data'
const PAGE_DESCRIPTION =
  'How LoanOps guards borrower data: encryption for identity and bank data, server-enforced access, an append-only audit trail, DPDP consent records, backups and exportability — stated as facts.'

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
const IVORY_T = 'text-[#FAF7F0]'
const HAIR = 'border-[#14231C]/10'
const MONO = '[font-family:var(--font-plex-mono)] tabular-nums'
const SERIF = '[font-family:var(--font-fraunces),Georgia,serif]'
const CONTAINER = 'mx-auto w-full max-w-7xl px-6 lg:px-8'
const HOVER = 'transition-colors duration-[160ms] ease-[cubic-bezier(0.3,0,0.2,1)]'

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

// All seven security rows — verbatim from the homepage section this
// page replaces. The homepage strip carries the first sentence of
// rows one, three and four.
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

export default function SecurityPage() {
  return (
    <div
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} flex min-h-screen flex-col bg-[#FAF7F0] [font-family:var(--font-plex-sans),sans-serif] ${INK}`}
    >
      <TopBar />

      <main className="flex-1">
        <div className={`${CONTAINER} py-16 lg:py-20`}>
          <p className={`${MONO} text-[11px] font-medium uppercase tracking-[0.22em] text-[#047857]`}>
            Security &amp; data
          </p>
          <h1 className={`mt-5 max-w-[22ch] ${SERIF} text-[2.4rem] font-medium leading-[1.06] tracking-[-0.01em] md:text-[3rem]`}>
            Security &amp; data
          </h1>
          <p className={`mt-5 max-w-[65ch] text-lg leading-[1.55] ${INK_2}`}>
            Borrowers hand you their Aadhaar, their bank details and their trust.
            These are the arrangements that guard all three — stated as facts,
            each one true of the product as it runs today.
          </p>

          {/* Security & data — ruled two-column fact list. Every item
              is true of this codebase today; nothing is claimed that
              the product does not do. */}
          <dl className={`mt-14 divide-y divide-[#14231C]/10 border-y ${HAIR}`}>
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
        </div>

        <MiniCta />
      </main>

      {/* Footer & Legal Compliance — shared components, untouched */}
      <LegalFooter />
      <CookieBanner />
    </div>
  )
}
