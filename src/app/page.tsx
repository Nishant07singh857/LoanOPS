import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { JsonLd } from '@/components/json-ld'
import { LegalFooter } from '@/components/legal/legal-footer'
import { CookieBanner } from '@/components/legal/cookie-banner'
import { EnquiryForm } from '@/components/enquiry-form'
import { HeroTilt } from '@/components/hero-tilt'
import { MobileMenu } from '@/components/mobile-menu'

// Public product homepage — the concept redesign (2026-11-11),
// its background system replaced the same day on the owner's word,
// and its content dose trimmed the same day on the owner's word
// again: "homepage pe utna hi dikhe jitna hona chahiye" — a
// homepage shows only what a homepage should.
//
// Concept: "The world your borrowers live in — the calm your office
// runs on." The hero sits on a DESIGNED fintech surface — a deep
// forest-green base with one soft light from the top, survey-style
// contour lines (an abstract, engineered nod to the borrowers'
// terraced land) and a whisper of grain, all built in CSS/SVG.
// Floating on it, one glass loan card carries the product. Below
// the hero the page settles onto warm ivory and deep green.
//
// The dose (research: the best B2B homepages run 4–10 sections,
// median ≈9, at ~9–11 viewport heights; lifecycle walkthroughs,
// onboarding steps and multi-row security sections appear on none
// of them — detail sits one click away, under specific links).
// This page is SEVEN blocks: hero → trust strip → statement band
// (carrying the problem in one line) → module overview (name +
// one-line outcome each) → lifecycle strip (one line + the sample
// story) → security strip (3 assurances) → enquiry. The full
// 6-step lifecycle walkthrough, the module chapters and the
// 4-step onboarding live on /product; all seven security rows
// live on /security. Nothing was deleted — it moved, and each
// strip links to it with a specific label.
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
// (emerald shades only). Sections below the hero sit on warm ivory
// #FAF7F0; text ink is a green-tinted near-black #14231C.
//
// Contrast (WCAG, computed 2026-11-11 — see homepage-fintech-bg-report):
// on ivory, ink 15.25:1, ink/70 5.83:1, ink/64 4.85:1 — every text
// token clears 4.5:1 on ivory, white and the deeper alt ivory
// #F3EEE2 (worst case ink/64 on alt ivory: 4.69:1). On the green
// #0A3D2C, ivory 11.43:1, ivory/75 7.11:1, ivory/65 5.77:1,
// emerald #34D399 6.36:1. Over the hero's designed background the
// surface is deterministic, so the check is exact, not sampled:
// against a worst-case bound (the lightest base stop #0A3D2C with
// the full top light and a contour allowance composited over it),
// white text computes 8.70:1, the ivory/95 sub 7.52:1, the ivory/85
// figcaption 6.40:1, the ivory/80 note under the CTAs 5.88:1, and
// the tightest text on the page — the card's ivory/65 labels on
// their glass — 5.26:1. Every body text clears 4.5:1 and every
// large text 3:1, at the bound; real placements are darker.
const INK = 'text-[#14231C]'
const INK_2 = 'text-[#14231C]/70'
const IVORY_T = 'text-[#FAF7F0]'
const IVORY_2 = 'text-[#FAF7F0]/75'
const IVORY_3 = 'text-[#FAF7F0]/65'
const HAIR = 'border-[#14231C]/10'
const HAIR_L = 'border-white/15'
const MONO = '[font-family:var(--font-plex-mono)] tabular-nums'
const SERIF = '[font-family:var(--font-fraunces),Georgia,serif]'
const CONTAINER = 'mx-auto w-full max-w-7xl px-6 lg:px-8'
// Mobile section padding is 64px (the research rhythm: one value
// for every section on phones); desktop keeps its taller spacing.
const SECTION = 'py-16 lg:py-32'
// The compressed strips (modules, lifecycle, security) run tighter
// than a full section — one idea each, at band height.
const STRIP = 'py-16 lg:py-20'

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

// ------------------------------------------------------------------
// The designed background system — no imagery anywhere on this page.
//
// ContourField draws survey-style contour lines: closed, concentric
// rings around a rise, generated from a smooth harmonic function so
// they read as engineered — a terraced-field / topographic survey
// abstraction of the borrowers' land, not a picture of it. Every
// fifth ring is an "index contour", slightly stronger, the way real
// survey maps mark them. The rings are deterministic (same input,
// same path), decorative only, and sit under everything.
// ------------------------------------------------------------------

function contourRing(
  cx: number,
  cy: number,
  r: number,
  phase: number,
  stretchX: number,
  stretchY: number,
): string {
  const steps = 90
  const pts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const w =
      1 +
      0.055 * Math.sin(3 * t + phase) +
      0.038 * Math.sin(5 * t + phase * 1.7) +
      0.026 * Math.sin(2 * t + phase * 0.6)
    const x = cx + r * w * Math.cos(t) * stretchX
    const y = cy + r * w * Math.sin(t) * stretchY
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return `${pts.join(' ')} Z`
}

function ContourField({ variant }: { variant: 'hero' | 'band' }) {
  const clusters =
    variant === 'hero'
      ? [
          // The main rise, high right — its outer rings drift off
          // the top and right edges of the hero.
          { cx: 1170, cy: 110, rings: 15, step: 34, phase: 0.8, base: 0.07 },
          // A smaller rise, low left, mostly off-canvas.
          { cx: 60, cy: 850, rings: 8, step: 30, phase: 2.4, base: 0.05 },
        ]
      : [
          // The band is short and wide: denser rings, one rise
          // left of centre and a quieter echo to the right.
          { cx: 330, cy: 250, rings: 12, step: 26, phase: 1.9, base: 0.08 },
          { cx: 1260, cy: 90, rings: 9, step: 26, phase: 0.3, base: 0.05 },
        ]
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={variant === 'hero' ? '0 0 1440 900' : '0 0 1440 480'}
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      {clusters.map((c) =>
        Array.from({ length: c.rings }, (_, i) => {
          const index = i % 5 === 4
          return (
            <path
              key={`${c.cx}-${i}`}
              d={contourRing(c.cx, c.cy, 36 + i * c.step, c.phase + i * 0.12, 1.45, 0.82)}
              stroke="#FAF7F0"
              strokeOpacity={index ? Math.min(1, c.base + 0.045) : c.base}
              strokeWidth={index ? 1.3 : 1}
            />
          )
        }),
      )}
    </svg>
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
// Page data — the established sample loan and product facts. Priya
// Sharma's loan: ₹75,000 at 18% over 12 months. EMI ₹7,437.50
// (principal ₹6,250.00 + interest ₹1,125.00 + fee ₹62.50); total
// repayable ₹89,250.00. Collections day: ₹20,075.00 collected of
// ₹29,705.00 due; portfolio ageing totals ₹87,08,212 across the
// product's six DPD buckets. The detail behind the strips below —
// the walkthrough, the module chapters, the full security rows —
// lives on /product and /security, in the same words.
// ------------------------------------------------------------------

const TRUST_FACTS = [
  'Origination · Collections · Ledger · Reports — one system',
  'Paise-exact ledger. Integer amounts, no floats',
  'DPDP consent records, itemised when a borrower applies',
  'Built and supported in India by NIRVYA PTD LTD',
]

// The module overview: each module's name and the outcome clause
// its chapter on /product carries — one line each, nothing more.
const MODULE_OUTCOMES: Array<{ title: string; outcome: string }> = [
  { title: 'Origination', outcome: 'Applications arrive complete, or not at all.' },
  { title: 'Collections', outcome: 'Know today’s collection position before the day starts.' },
  { title: 'Ledger & accounting', outcome: 'Every rupee posted twice, or not at all.' },
  { title: 'Reports & audit', outcome: 'Month-end is a report, not a reconstruction.' },
]

// The lifecycle in one line — every stage the walkthrough on
// /product follows, named once.
const LIFECYCLE_STAGES = ['Application', 'Approval', 'Disbursal', 'Collections', 'Ledger', 'Reports']

// The security strip: the three assurances an evaluator checks
// first, in the words of the full rows on /security (the first
// sentence of each). All seven rows live there.
const SECURITY_STRIP: Array<{ title: string; desc: string }> = [
  {
    title: 'Encryption for identity and bank data',
    desc: 'Aadhaar, PAN and bank details are encrypted with AES-256-GCM and masked on everyday screens.',
  },
  {
    title: 'Access enforced on the server',
    desc: 'Owner, agent and borrower roles are checked on the server, not just in the browser.',
  },
  {
    title: 'An audit trail that stays written',
    desc: 'Sign-ins, approvals, disbursals, collections and corrections are recorded in an append-only audit trail.',
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
        /* Grain — an SVG feTurbulence tile at a whisper (the rect
           renders at 0.55 inside the tile and the layer itself is
           set to 0.05 opacity, so the effective noise is under 3%):
           enough texture that the green surface never reads flat. */
        .hp-grain {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
        }
      `}</style>

      <main className="flex-1">
      {/* ============ HERO — the designed surface, the product on it ============ */}
      <section className="relative overflow-hidden bg-[#06231A]">
        {/* The designed background system: a single soft diagonal
            surface shade across the forest-green base (surface
            shading, not decoration), one soft light from the top
            centre, the survey contours, and the grain over all of
            it. No imagery — the surface is built, like a finance
            app's. All four layers are decorative and aria-hidden. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(155deg,#06231A_0%,#082A1F_55%,#0A3D2C_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-5%,rgba(250,247,240,0.08),transparent_65%)]"
        />
        <ContourField variant="hero" />
        <div aria-hidden="true" className="hp-grain pointer-events-none absolute inset-0 opacity-[0.05]" />

        {/* Floating glass pill nav. On the right: a Book a demo text
            link and the page's ONLY login link — Log in, the white
            filled pill. One login serves every role. On phones the
            link run collapses behind the menu button (the sheet it
            opens carries the anchors and Book a demo — never a
            second login link). */}
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
                <MobileMenu />
              </div>
            </div>
          </div>
        </header>

        <div id="top" className={`relative z-10 ${CONTAINER} flex flex-col items-center pb-24 pt-8 text-center lg:pb-32 lg:pt-16`}>
          {/* On phones the hero re-composes (mobile-layout research
              §8.1): eyebrow → headline → support → CTA → the card
              peeking into the first viewport. The desktop order —
              eyebrow, card, headline — is restored at lg by the
              order classes on the figure and the headline block;
              nothing about the desktop composition changes. The
              eyebrow's blur also drops on phones: the mobile glass
              budget is the pill and the card only. */}
          <p className="order-1 inline-flex h-9 items-center rounded-full border border-white/25 bg-[#04150E]/40 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FAF7F0] backdrop-blur-md max-lg:backdrop-blur-none">
            For NBFCs &amp; Microfinance Teams
          </p>

          {/* The loan card group — the product, floating on the
              contoured surface. The two glass chips sit beside the
              card on wide screens and stack beneath it on smaller
              ones. All three carry sample figures; the caption is
              attached to the group as its figcaption. HeroTilt adds
              the research-spec subtle 3D (tilt ≤5°/4°, chip
              parallax ±8px, gated on fine pointer + no-preference
              motion); without JS — or on touch, or under reduced
              motion — the group is exactly this static composition.
              The card's shadow alpha rides on --hp-shadow, which
              HeroTilt deepens slightly as the tilt grows. */}
          <figure id="product" className="hp-reveal relative order-3 mt-8 w-full max-w-[35rem] scroll-mt-24 lg:order-2 lg:mt-10">
            <HeroTilt>
            <div data-tilt-card className="relative overflow-hidden rounded-[24px] border border-white/25 bg-[linear-gradient(135deg,rgba(12,68,48,0.88),rgba(5,30,20,0.94))] p-5 text-left shadow-[0_40px_90px_-30px_rgba(0,0,0,var(--hp-shadow,0.65))] backdrop-blur-md [transform-style:preserve-3d] sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/30" />
              <div className="flex items-start justify-between gap-6">
                <span className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-[#34D399]" />
                  <span className="text-[17px] font-semibold leading-none tracking-[-0.01em] text-white">LoanOps</span>
                </span>
                <CardChip />
              </div>
              <div className={`mt-7 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t ${HAIR_L} pt-6 [transform:translateZ(20px)]`}>
                <p className="text-lg font-medium text-white">Priya Sharma</p>
                <p className={`${MONO} text-[13px] ${IVORY_2}`}>LOAN-001 · Personal loan</p>
              </div>
              <div className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 max-sm:flex-col max-sm:items-stretch max-sm:gap-y-5">
                <div className="[transform:translateZ(20px)]">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${IVORY_3}`}>Monthly EMI</p>
                  <p className={`${MONO} mt-1.5 whitespace-nowrap text-[2rem] font-medium leading-none text-white sm:text-[2.75rem]`}>₹7,437.50</p>
                </div>
                <div className="min-w-[9.5rem] [transform:translateZ(12px)] max-sm:w-full max-sm:min-w-0">
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

            {/* Chips on phones (research §8.2): no longer floating
                glass — a 2-up row directly below the card, solid
                fill, no backdrop-blur, figure first and the label
                under it in sentence case (the caps label cannot fit
                one line at 154px). The suffix word and the third
                line wait for the wider layouts, where the chips
                float beside the card as before. */}
            <div className="mt-4 grid grid-cols-2 items-stretch gap-3 lg:flex lg:flex-row lg:justify-center xl:contents">
              <div data-tilt-chip className="rounded-[20px] border border-white/20 bg-[#04150E]/55 px-5 py-4 text-left shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] backdrop-blur-md max-lg:flex max-lg:flex-col max-lg:bg-[#04150E]/85 max-lg:px-3 max-lg:py-2.5 max-lg:backdrop-blur-none lg:w-64 xl:absolute xl:-left-[17.5rem] xl:top-14 xl:mt-0">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${IVORY_3} max-lg:order-2 max-lg:mt-1 max-lg:text-[13px] max-lg:font-medium max-lg:normal-case max-lg:tracking-normal`}>Today’s collections</p>
                <p className="mt-1.5 text-[15px] text-[#FAF7F0] max-lg:order-1 max-lg:mt-0">
                  <span className={`${MONO} text-xl font-medium text-white`}>₹20,075</span><span className="max-lg:hidden"> collected</span>
                </p>
                <p className={`mt-1 text-[13px] ${IVORY_2} max-lg:hidden`}>of ₹29,705.00 due today</p>
              </div>
              <div data-tilt-chip className="rounded-[20px] border border-white/20 bg-[#04150E]/55 px-5 py-4 text-left shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] backdrop-blur-md max-lg:flex max-lg:flex-col max-lg:bg-[#04150E]/85 max-lg:px-3 max-lg:py-2.5 max-lg:backdrop-blur-none lg:w-64 xl:absolute xl:-right-[17.5rem] xl:top-32 xl:mt-0">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${IVORY_3} max-lg:order-2 max-lg:mt-1 max-lg:text-[13px] max-lg:font-medium max-lg:normal-case max-lg:tracking-normal`}>Portfolio ageing</p>
                <p className="mt-1.5 text-[15px] text-[#FAF7F0] max-lg:order-1 max-lg:mt-0">
                  <span className={`${MONO} text-xl font-medium text-white`}>₹87,08,212</span><span className="max-lg:hidden"> outstanding</span>
                </p>
                <p className={`mt-1 text-[13px] ${IVORY_2} max-lg:hidden`}>across 6 DPD buckets</p>
              </div>
            </div>
            </HeroTilt>

            <figcaption className="mt-5 text-sm text-[#FAF7F0]/85">Sample data</figcaption>
          </figure>

          <div className="hp-reveal order-2 flex flex-col items-center max-lg:w-full lg:order-3">
            <h1 className={`mt-6 max-w-[17ch] ${SERIF} text-[2.125rem] font-medium leading-[1.1] text-white sm:text-6xl lg:mt-12 lg:text-[4.3rem]`}>
              Run your entire lending business in one <em className="italic text-[#A7E8C9]">calm</em> platform.
            </h1>
            {/* Mobile support line: the desktop line's first
                sentence, verbatim — the full line runs to four
                lines at 360px and pushes the card out of the first
                viewport (research §8.1 budgets the support line at
                ≤2 lines). The desktop line below is untouched. */}
            <p className="mt-4 max-w-[62ch] text-base leading-[1.55] text-[#FAF7F0]/95 lg:hidden">
              Origination, approval, disbursal, collections, the ledger and
              reports — the whole life of a loan in one system.
            </p>
            <p className="mt-6 max-w-[62ch] text-lg leading-[1.6] text-[#FAF7F0]/95 max-lg:hidden">
              Origination, approval, disbursal, collections, the ledger and reports —
              the whole life of a loan in one system, replacing the Excel sheets and
              disconnected tools the work is spread across today.
            </p>
            <div className="mt-6 flex w-full flex-col items-center gap-2 sm:gap-4 lg:mt-9 lg:w-auto lg:flex-row lg:flex-wrap lg:justify-center">
              <a
                href="#enquire"
                className={`inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-base font-semibold text-[#0A3D2C] ${HOVER} hover:bg-[#FAF7F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white max-lg:h-[52px] max-lg:w-full`}
              >
                Book a demo
              </a>
              <a
                href="#lifecycle"
                className={`inline-flex h-12 items-center rounded-full border border-white/35 bg-white/5 px-7 text-base font-medium text-white backdrop-blur-md ${HOVER} hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white max-lg:h-11 max-lg:border-transparent max-lg:bg-transparent max-lg:px-2 max-lg:underline max-lg:underline-offset-4 max-lg:backdrop-blur-none`}
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

      {/* Statement band — the high street the borrowers live on,
          carried by the same designed surface as the hero (denser
          contours, no imagery). A positioning line, not a factual
          claim — and beneath it, the problem in one line: where the
          three ruled problem rows used to stand, the whole of their
          substance in a single sentence. */}
      <section className="relative overflow-hidden bg-[#06231A]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,#06231A_0%,#082A1F_100%)]"
        />
        <ContourField variant="band" />
        <div aria-hidden="true" className="hp-grain pointer-events-none absolute inset-0 opacity-[0.05]" />
        <div className={`relative ${CONTAINER} py-12 text-center md:py-28 lg:py-36`}>
          <p className={`${MONO} text-[11px] font-medium uppercase tracking-[0.22em] text-[#34D399]`}>
            Where your borrowers live
          </p>
          <p className={`mx-auto mt-6 max-w-[27ch] ${SERIF} text-[1.625rem] font-medium leading-[1.25] text-white md:text-[2.6rem] md:leading-[1.2]`}>
            Built for the high streets and small towns where your borrowers actually live.
          </p>
          <p className={`mx-auto mt-7 max-w-[62ch] leading-[1.6] ${IVORY_2}`}>
            None of this is a people problem. It is what happens when one loan book
            is kept in a register, a spreadsheet and three people’s memory at once.
          </p>
        </div>
      </section>

      {/* Module overview — the whole scope in four lines: each
          module's name and its outcome. The chapters (intro, rows,
          ledger fragment) live on /product. */}
      <section id="modules" className={`${CONTAINER} ${STRIP} scroll-mt-16`}>
        <div className="mb-10">
          <h2 className={`max-w-[26ch] ${SERIF} text-[2rem] font-medium leading-[1.08] tracking-[-0.01em] md:text-[2.4rem]`}>
            Four modules. One ledger underneath.
          </h2>
          <p className={`mt-4 max-w-[65ch] text-lg leading-[1.55] ${INK_2}`}>
            Each module is a part of the same working day, and each writes to —
            and reads from — the same records.
          </p>
        </div>
        <div className={`divide-y divide-[#14231C]/10 border-y ${HAIR}`}>
          {MODULE_OUTCOMES.map((mod) => (
            <div key={mod.title} className="grid items-baseline gap-1.5 py-6 md:grid-cols-[20rem_1fr] md:gap-x-12">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#047857]">{mod.title}</h3>
              <p className={`${SERIF} text-[1.4rem] font-medium leading-snug`}>{mod.outcome}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Lifecycle strip — the whole life of a loan in one line,
          over the sample story in one sentence. The full six-step
          walkthrough, with every ledger fragment, is on /product. */}
      <section id="lifecycle" className="scroll-mt-16 bg-[#0A3D2C]">
        <div className={`${CONTAINER} ${STRIP}`}>
          <p className={`${MONO} text-[11px] font-medium uppercase tracking-[0.22em] text-[#34D399]`}>
            The loan lifecycle
          </p>
          {/* On phones the chain rotates 90° (research §8.4): a
              vertical numbered timeline, rail on the left — the
              sequence reads in the scroll direction and no stage
              hides off the right edge. The rail exists only below
              lg; the desktop chain is untouched. */}
          <ol className="mt-7 flex list-none flex-wrap items-baseline gap-x-3 gap-y-2 max-lg:flex-col max-lg:flex-nowrap max-lg:items-stretch max-lg:gap-x-0 max-lg:gap-y-0">
            {LIFECYCLE_STAGES.map((stage, i) => (
              <li key={stage} className="flex items-baseline gap-3 max-lg:items-start max-lg:gap-4">
                <span aria-hidden="true" className="hidden w-7 shrink-0 flex-col items-center max-lg:flex">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full border border-[#34D399]/50 ${MONO} text-[13px] text-[#34D399]`}>
                    {i + 1}
                  </span>
                  {i < LIFECYCLE_STAGES.length - 1 ? (
                    <span className="mt-1 h-6 w-px bg-white/15" />
                  ) : null}
                </span>
                <span className={`${SERIF} text-[1.45rem] font-medium leading-none ${IVORY_T} max-lg:pt-1 max-lg:text-[1.25rem] lg:text-[1.7rem]`}>{stage}</span>
                {i < LIFECYCLE_STAGES.length - 1 ? (
                  <span aria-hidden="true" className="text-lg leading-none text-[#34D399] max-lg:hidden">→</span>
                ) : null}
              </li>
            ))}
          </ol>
          <p className={`mt-7 max-w-[65ch] leading-[1.6] ${IVORY_2}`}>
            Priya Sharma’s loan — ₹75,000 at 18% over 12 months, EMI ₹7,437.50 — is
            followed through every stage, from her application to the report view.
          </p>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <p className={`text-sm ${IVORY_3}`}>Sample data</p>
            <a
              href="/product"
              className={`inline-flex h-11 items-center font-medium text-[#6EE7B7] underline underline-offset-4 ${HOVER} hover:text-[#A7E8C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-sm`}
            >
              See the full walkthrough →
            </a>
          </div>
        </div>
      </section>

      {/* Security strip — the three assurances an evaluator checks
          first, each in the first sentence of its full row. All
          seven rows, stated as facts true of the product as it runs
          today, are on /security. */}
      <section id="security" className={`${CONTAINER} ${STRIP} scroll-mt-16`}>
        <div className="mb-10">
          <h2 className={`max-w-[26ch] ${SERIF} text-[2rem] font-medium leading-[1.08] tracking-[-0.01em] md:text-[2.4rem]`}>
            Security &amp; data
          </h2>
        </div>
        <div className="grid gap-x-10 gap-y-10 md:grid-cols-3">
          {SECURITY_STRIP.map((row) => (
            <div key={row.title} className={`border-t ${HAIR} pt-6`}>
              <h3 className={`${SERIF} text-[1.3rem] font-medium leading-snug`}>{row.title}</h3>
              <p className={`mt-2.5 text-[15px] leading-[1.6] ${INK_2}`}>{row.desc}</p>
            </div>
          ))}
        </div>
        <p className={`mt-12 max-w-[65ch] text-[15px] leading-[1.6] ${INK_2}`}>
          One boundary, stated plainly: LoanOps is software. The lending
          institution remains the regulated lender — LoanOps keeps the records
          your auditors ask for.
        </p>
        <p className="mt-4">
          <a
            href="/security"
            className={`inline-flex h-11 items-center font-medium text-[#047857] underline underline-offset-4 ${HOVER} hover:text-[#0A3D2C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A3D2C] rounded-sm`}
          >
            See the full security detail →
          </a>
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
          <p className={`-mt-4 mb-12 max-w-[65ch] text-[15px] leading-[1.6] lg:mb-14 ${IVORY_2}`}>
            Going live includes migration of your existing book and training for
            your team, on your own data.{' '}
            <a
              href="/product#onboarding"
              className={`font-medium text-[#6EE7B7] underline underline-offset-4 ${HOVER} hover:text-[#A7E8C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-sm`}
            >
              How going live works →
            </a>
          </p>
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
