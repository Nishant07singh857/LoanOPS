# LoanOPS — Launch steps (owner's side)

Everything the **code** can do for launch is already built and dormant:
it switches on when the values below exist. This file is only the
steps that need **your accounts, your taps, your decisions**. Do them
in order. Nothing here requires sharing a password or key with anyone
— every value is pasted by you into Vercel or GitHub yourself.

Live site: https://loanops.vercel.app

---

## 1. Error tracking (Sentry) — know about crashes before borrowers do

1. Sign up at sentry.io (free Developer plan: 5,000 errors/month,
   email alerts) and create a **Next.js** project.
2. In the project: **Settings → Client Keys (DSN)** — copy the DSN.
3. In Vercel → project `loanops` → **Settings → Environment Variables**
   (Production), add:
   - `SENTRY_DSN` = the DSN
   - `NEXT_PUBLIC_SENTRY_DSN` = the same DSN
4. Redeploy (Vercel → Deployments → ⋯ → Redeploy). Done — the app now
   reports crashes with borrower PII scrubbed out before sending.

## 2. Google Search Console — Google's view of the site

1. Open search.google.com/search-console, add a **URL-prefix**
   property: `https://loanops.vercel.app/`
   (A Domain property is impossible — `vercel.app` is Vercel's
   domain, not yours.)
2. Choose the **HTML tag** verification method and copy the token
   (only the `content="…"` value).
3. In Vercel env (Production) add `GOOGLE_SITE_VERIFICATION` = token.
4. Redeploy, then click **Verify** in Search Console.
5. In Search Console → **Sitemaps**, submit `sitemap.xml`
   (the site already generates it at `/sitemap.xml`).

**Also do Bing Webmaster Tools** (bing.com/webmasters): ChatGPT's
answers draw largely on Bing's index, so being in Bing is part of
being findable in AI answers. Same flow — add the site, verify with
the meta-tag token (or import the verified property from Search
Console), submit `sitemap.xml`. Your robots rules already let AI
search crawlers (ChatGPT, Claude, Perplexity) read the public pages;
do not block them, or the product disappears from AI answers.

## 3. Vercel Analytics — visitor numbers for the public pages

1. Vercel → project `loanops` → **Analytics** tab → **Enable**.
   (Cookieless; already wired into the site. Nothing else to do.)

## 4. Uptime monitoring — someone watches the site 24×7

Pick **one**: UptimeRobot (free, 50 monitors) or Better Stack (free,
includes a public status page).

1. Create the account and add two monitors (5-minute checks):
   - `https://loanops.vercel.app/`
   - `https://loanops.vercel.app/api/health`
2. Set your email (and phone, if the plan allows) as the alert contact.
3. **Heartbeat monitors for the cron jobs** (same tool, or
   healthchecks.io): create one heartbeat for `send-reminders` and
   one for `mark-overdue`. A heartbeat alerts you when a job *fails
   to run at all* — the failure nobody notices for weeks. (The jobs
   must also be scheduled — see the deployment checklist.)

## 5. Database backups

- Weekly `pg_dump` backups are already automated
  (`.github/workflows/backup-database.yml`, Mondays 02:30 UTC,
  90-day artifact retention).
- To switch them on: GitHub → repo → **Settings → Secrets and
  variables → Actions** → add `BACKUP_DATABASE_URL` = the production
  database connection string. Until then the workflow skips itself
  with a notice.
- Reminder: Neon's free point-in-time window is only ~6 hours. When
  real borrower money lands, move Neon to the Launch plan and set a
  7-day history window (Neon console → Settings).

---

## Decisions only you can make

- **Vercel Pro (~$20/mo/seat)** — the Hobby plan is licensed for
  **non-commercial use only**. A real commercial launch needs Pro.
- **Custom domain** — `loanops.vercel.app` is Vercel's subdomain. A
  lending product asking for bank details needs its own domain
  (~₹1,000/yr). After adding it in Vercel → Domains, update
  `NEXT_PUBLIC_APP_URL`, redeploy, and re-verify Search Console
  under the new domain (a Domain property then becomes possible).
- **Production re-seed** — the live database still holds the old
  incoherent demo seed (2024 dates, empty ledger). Approving a
  re-seed (the `seed-production.yml` workflow, reset mode) replaces
  it with the current, coherent demo data.
- **Real legal values** — company name, registered address, CIN,
  NBFC/Regulated-Entity identity + licence number, grievance officer
  name/email/phone, support contacts, LSP list. These go into the
  `NEXT_PUBLIC_*` Vercel env vars; until then the public pages show
  the neutral "LoanOps" fallback and omit unset lines.
- **Real secrets rotation** — replace the demo env secrets and seed
  passwords with real production values, and confirm the Neon
  password rotation. Also run
  `scripts/encrypt-plaintext-bank-accounts.ts` (`--dry-run` first)
  once against production.
- **India data-residency** — the digital-lending framework expects
  borrower data stored on servers in India; Neon has no India region
  (nearest Singapore). Decide with your lender/counsel before real
  borrower data — this can mean a different database host for
  production.
