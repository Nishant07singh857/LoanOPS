# Task 5 — Candidate Portal Build

## Summary

Built the complete **CANDIDATE PORTAL** for the Loan Ops Platform — 8 pages under `/portal/*` (all wrapped by `src/app/portal/layout.tsx` with `PortalLayout` in `topbottom` nav mode, `SessionProvider`, and `PageTransition`) plus a standalone **9-step premium onboarding flow** at `/apply/[token]`. Lint passes with **zero errors and zero warnings**, all 9 routes return HTTP 200 with no compile errors in `dev.log`. Money is in paise and formatted via the shared `formatPaiseToINR` helpers. All WhatsApp buttons call `openWhatsApp` with `buildWhatsAppMessage` using real phone numbers from `DEMO_ACCOUNTS`. The candidate portal uses `bg-success` (emerald) as its brand accent — NO indigo/blue colors anywhere.

## Work Log

- Task ID: 5
- Agent: full-stack-developer
- Task: Candidate Portal build (mobile-first consumer fintech experience)

### Files Created

#### Shared
- `src/components/portal/candidate-nav.tsx` — `CANDIDATE_NAV` (2 groups: Main / More) with the 5 most-used items in the "Main" group so the bottom nav (which shows only 5 items) renders Home / Loan / Payments / Schedule / Receipts. Notifications badge=1. `CANDIDATE_BRAND` = { name: 'Sterling Lending', subtitle: 'My Loan', accentClass: 'bg-success' }. All icons (Home, Wallet, CreditCard, CalendarClock, FileText, Bell, LifeBuoy, UserCircle) verified to exist in lucide-react.
- `src/app/portal/layout.tsx` — wraps every portal page with `SessionProvider` → `PortalLayout` (role=CANDIDATE, navMode=topbottom, notifications={count:1}) → `PageTransition`. Each page file is content-only.
- `src/agent-ctx/5-candidate-portal-build.md` — this work record.

#### Pages (under `src/app/portal/`)
1. `page.tsx` — **Candidate Home**: greeting hero ("Hello, Priya 👋") with today's date and on-track summary, active loan card (loan number, outstanding, next due, installment amount, repayment progress bar with paid/total ratio, Active status badge), highlighted "Next Payment Due" card with countdown to 20 Sep 2024, Quick Actions grid (Pay Now / View Schedule / Download Receipt / WhatsApp Support) with the WhatsApp button wired to `openWhatsApp` with `CANDIDATE_TO_AGENT` template, Recent Notifications preview (top 3 from `candidateNotifications`), Need Help section with WhatsApp Agent + WhatsApp Owner cards, Trust strip (Bank-grade security / RBI compliant / 256-bit encrypted / ISO 27001).
2. `loan/page.tsx` — **Loan Detail**: hero summary (loan number, Active badge, disbursed date, frequency, installments, 4 stat tiles: Total Repayable / Outstanding / Collected / Next Due, collection progress bar), Loan Terms section (10-row grid: principal, interest type, rate, frequency, installments, installment amount, processing fee, first due, final due — uses `formatBpsToPercent` for rate), Disbursement card (amount, method, date, UTR reference, credited-to bank), Documents list (4 cards with type/size/upload date + download buttons that toast), Agreement section with version + accepted timestamp + View Agreement button → Dialog with full agreement body, "Apply for New Loan" CTA linking to `/apply/...`. WhatsApp Agent button wired to `CANDIDATE_TO_AGENT` template.
3. `payments/page.tsx` — **Payments**: "Pay Next Installment" hero (amount, due date, installment #, big Pay Now button → Dialog), payment history list (`candidatePayments`): payment number, amount, date, method badge (UPI/Netbanking/Card = info tint, Cash = warning tint), status badge (ALLOCATED=success, PENDING_VERIFICATION=warning, FAILED=destructive), View Receipt link (allocated/verified only), pending-verification notice for awaiting rows, allocation breakdown card showing last payment's principal + interest + fees split with allocation order note. Pay Now modal: read-only amount, UPI/Netbanking/Card radio cards with icons, UPI ID input (required when UPI selected), security footer, "Pay Securely" button → toast "Payment initiated, you'll receive a confirmation shortly".
4. `schedule/page.tsx` — **Repayment Schedule**: 4 KPI cards (Total / Paid / Due+Upcoming / Overdue), progress card with both a Progress bar and a 12-segment visual timeline (each installment colored by status), "Next Due" highlight card with Pay Now button, full installment list (extended from `candidateInstallments` to 12 entries): number badge (or check icon when PAID), due date, principal+interest+fees breakdown, total due (prominent), status badge (PAID=success, DUE=info, UPCOMING=muted, OVERDUE=destructive, PARTIALLY_PAID=warning), paid date when PAID, Pay Now button when DUE/OVERDUE, Pay Balance when PARTIALLY_PAID.
5. `receipts/page.tsx` — **Receipts**: derived from `candidatePayments` where status is ALLOCATED or VERIFIED, plus 1 synthesized historical row. Each receipt: receipt number, payment number, amount, method badge, date, View + Download buttons. Receipt Dialog with printable receipt body: logo header with Active badge, receipt number + date + payment number + method, candidate details, loan details, payment breakdown (Principal + Interest + Fees), Total Paid (prominent), Remaining Balance footer, Download PDF + Email buttons (toast feedback).
6. `notifications/page.tsx` — **Notifications**: filter chips (All / Unread / Reminders / Confirmations / Disbursements), Mark All Read button (disabled when no unread), notification cards with icon (Clock/CheckCircle2/IndianRupee based on type), title, message, timestamp, Read/New badge. Tap any unread notification → marks as read + toast. Info strip about reminder cadence.
7. `support/page.tsx` — **Support**: 2 contact cards (WhatsApp Agent with CANDIDATE_TO_AGENT template + WhatsApp Owner with CANDIDATE_TO_OWNER template, both calling `openWhatsApp` with real phone numbers), My Support Requests list (`supportTickets`), Create Support Request Dialog (category dropdown Repayment/Receipt/KYC/Agreement/Disbursement/Other, subject, description, attachment placeholder, validation), FAQ Accordion (6 expandable questions), trust strip with response-time promise.
8. `profile/page.tsx` — **Profile**: gradient hero with avatar + name + mobile + email + KYC Verified badge + Active Loan badge, Personal Details (full name, mobile, email, DOB, address), KYC Details (masked Aadhaar `XXXX-XXXX-4521`, PAN, KYC status, verification date, info note about encrypted storage), Bank Details (bank name, masked account, IFSC, UPI), Employment Details (occupation, employer, monthly income formatted in INR, existing obligations), Edit Profile button (Dialog with "contact agent" copy), Logout buttons in profile card AND at the bottom of the page (both call `useSession().logout()` with toast confirmation).

#### Standalone onboarding flow
9. `apply/[token]/page.tsx` — **9-step premium onboarding journey** (NOT wrapped in PortalLayout — standalone full-screen). Layout: lg+ has 2-column grid with a gradient hero panel on the left (brand, "Your loan journey starts here.", 4 value props, testimonial card) and the form on the right. Mobile: stacked with a small brand header + progress bar. Top of form: animated progress bar (Framer Motion width animation) + desktop stepper with clickable back navigation. Steps with `AnimatePresence` slide+fade transitions:
   - Step 1 Welcome: brand intro, pre-configured loan offer card (if token has a known prefix), mobile value-props grid, safe-and-secure info box.
   - Step 2 Loan Info: principal (₹), installments, frequency radio cards (Daily/Weekly/Monthly), interest type radio cards (Percentage/Fixed/None), conditional rate or fixed amount input, first due date, processing fee, **live schedule preview** using `generateSchedulePreview` (BigInt paise) with 4 stat tiles + first 3 installments table.
   - Step 3 Personal: full name, mobile, email, DOB (date picker), address textarea — all required.
   - Step 4 KYC: Aadhaar input with `XXXX XXXX XXXX` auto-format mask, PAN input with `AAAAA9999A` uppercase mask + regex validation, 3 upload placeholders (Aadhaar front/back, PAN), secure e-KYC info box.
   - Step 5 Financial: occupation select, employer input, monthly income, existing EMIs.
   - Step 6 Bank: bank name, account number, IFSC (uppercased), UPI ID (optional), encryption info box.
   - Step 7 Documents: 6 card-style upload boxes (Aadhaar / PAN / Address / Income / Bank / Business) with required/optional flags and file-name preview after upload.
   - Step 8 Agreement: scrollable agreement body (from `agreementTemplates.active`), **canvas-based signature pad** with mouse/touch support and Clear button, "I have read and agree" checkbox.
   - Step 9 Review: organized summary by section (Loan / Personal / KYC / Financial / Bank / Agreement) with masked account number, then Submit Application button → toast + success view.
   - Success view: PartyPopper animation, "Application Submitted!" headline, application number (`APP-2024-XXXX`), 4-step "What's next" list, Return Home button (router.push('/portal')).
   - Each step has Back/Next buttons. Validation per step with toast feedback on missing required fields. Token pre-config map mirrors owner QR link data (3 known tokens: a3f8/b7e3/d2e5).

### Design Standards Met
- ✅ All `/portal/*` pages use the shared `PortalLayout` via `src/app/portal/layout.tsx` (no repetition)
- ✅ `/apply/[token]` is standalone (no PortalLayout) — premium consumer-onboarding feel
- ✅ All KPI displays use `KPICard` with proper variants
- ✅ All statuses use `StatusBadge` with raw status strings (PAID/DUE/UPCOMING/OVERDUE/PARTIALLY_PAID/ALLOCATED/PENDING_VERIFICATION/VERIFIED/ACTIVE etc.)
- ✅ Money formatted with `formatPaiseToINR` (full); rates with `formatBpsToPercent`
- ✅ BigInt paise used for schedule preview via `generateSchedulePreview` in the apply flow
- ✅ All dialogs use shadcn `Dialog` component
- ✅ `toast` from sonner used everywhere for action feedback
- ✅ Framer Motion entrance animations (`FadeIn`, `StaggerContainer`+`StaggerItem`) and `AnimatePresence` for step transitions
- ✅ Each portal page top-level wrapped in `PageTransition` (via portal layout)
- ✅ NO indigo/blue colors — only `bg-success` (emerald), `bg-info` (teal), warning, destructive variants
- ✅ Premium fintech aesthetic — `rounded-2xl`, `shadow-premium`, `shadow-glow`, soft gradients, plenty of whitespace
- ✅ Mobile-first — `topbottom` nav mode (top bar + bottom nav, no sidebar), `min-h-[44px]` touch targets on buttons, sticky bottom action bars in the apply flow
- ✅ WhatsApp buttons actually call `openWhatsApp(phone, msg)` with `buildWhatsAppMessage(template, ctx)` using real candidate/agent/owner phone numbers
- ✅ `SectionHeading` used on every portal page (smaller, less dense than owner)
- ✅ Signature pad uses HTML5 Canvas with DPR-aware rendering, mouse + touch events, and Clear button
- ✅ Aadhaar/PAN inputs have live format masking
- ✅ Pre-configured loan offers detected by token prefix

### Verification
- `bun run lint` → **0 errors, 0 warnings** (exit code 0)
- All 9 candidate routes return HTTP 200 (verified via curl loop):
  - `/portal` 200 ✓
  - `/portal/loan` 200 ✓
  - `/portal/payments` 200 ✓
  - `/portal/schedule` 200 ✓
  - `/portal/receipts` 200 ✓
  - `/portal/notifications` 200 ✓
  - `/portal/support` 200 ✓
  - `/portal/profile` 200 ✓
  - `/apply/a3f8d2e91b7c4f0a8e2d1b6c9f4a3e8d` 200 ✓
- `dev.log` shows successful `✓ Compiled` / `GET /portal/... 200` and `GET /apply/... 200` entries for every page (no compile errors, no warnings)
- Content sanity check:
  - `/portal` renders "Hello,", "Pay Now", "Quick Actions", "WhatsApp"
  - `/portal/loan` renders "My Loan", "Loan Terms", "Disbursement", "Documents", "Agreement", "Apply for New"
  - `/portal/schedule` renders "Repayment", "Total Installments", "Paid", "Overdue", "All Installments"
  - `/portal/support` renders "WhatsApp Your Agent", "WhatsApp the Owner", "My Support", "Frequently Asked"
  - `/apply/...` renders "Sterling Lending", "Welcome", "Pre-Approved", "Begin Application"

## Stage Summary

The Candidate Portal is complete and production-ready. The shared `portal/layout.tsx` mirrors the agent layout pattern so individual page files are content-only. Mobile-first `topbottom` navigation matches the consumer-fintech use case (candidates use their phones), with the 5 most-used items (Home / Loan / Payments / Schedule / Receipts) shown in the bottom nav. All WhatsApp actions are wired to the shared helper using real phone numbers (agent Arjun Nair +91 98201 44556, owner Ravi Mehta +91 98200 11223) and the right template per context (CANDIDATE_TO_AGENT for general queries, CANDIDATE_TO_OWNER for escalations). All money math uses paise integers from mock data — no `Number/parseInt/parseFloat` for authoritative money (only for rate input → bps conversion in the apply flow preview, which mirrors the owner create-loan pattern).

The `/apply/[token]` flow is the make-or-break onboarding UX, designed to feel like Cred / Jupiter / Fi: two-column layout with hero panel on desktop, stacked on mobile, animated progress bar, Framer Motion slide transitions between steps, big touch targets, masked Aadhaar/PAN inputs, real canvas signature pad, live schedule preview using the BigInt-based `generateSchedulePreview`, and a celebratory success state with application number and "What's next" steps.

## Constraints Honored
- ❌ Did NOT modify `prisma/schema.prisma`, `src/app/globals.css`, `src/app/layout.tsx`, or `src/app/page.tsx`
- ❌ Did NOT modify any Owner Portal files in `src/app/admin/`
- ❌ Did NOT modify any Agent Portal files in `src/app/agent/`
- ❌ Did NOT modify any existing shared components in `src/components/ui/` or `src/components/portal/layout.tsx` (only ADDED `src/components/portal/candidate-nav.tsx`)
- ❌ Did NOT use indigo/blue colors anywhere
- ❌ Did NOT create any API routes — used mock data directly from `src/lib/mock-data.ts`
- ❌ Did NOT use `Number()` / `parseInt()` / `parseFloat()` for authoritative money math
- ✅ All money in PAISE (1 INR = 100 paise), formatted via the shared helpers
- ✅ All WhatsApp actions use `openWhatsApp(phone, message)` with `buildWhatsAppMessage(template, ctx)` from `src/lib/whatsapp.ts`
- ✅ Candidate portal uses `navMode: 'topbottom'` (per spec — consumer-first), with `CANDIDATE_BRAND.accentClass = 'bg-success'` and `notifications: { count: 1 }`
- ✅ `/apply/[token]` is standalone — does NOT use PortalLayout (per spec)
