// Unit tests for the launch package:
// - Sentry PII scrubber (src/lib/sentry-scrub.ts) — borrower PII must
//   never survive into an error event; non-PII identifiers must pass.
// - Sitemap / robots (src/app/sitemap.ts, src/app/robots.ts) — public
//   routes only; app areas disallowed.
// - Cash idempotency keys (src/lib/idempotency.ts) — crypto-grade
//   format, unique per call.
import assert from 'node:assert/strict'
import { scrubString, scrubSentryEvent, type ScrubbableEvent } from '../../src/lib/sentry-scrub'
import sitemap from '../../src/app/sitemap'
import robots from '../../src/app/robots'
import { generateCashIdempotencyKey } from '../../src/lib/idempotency'
import { buildStructuredData } from '../../src/lib/structured-data'

interface TestCase {
  name: string
  run: () => void
}

const expectedBase = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
).replace(/\/+$/, '')

const tests: TestCase[] = [
  {
    name: 'scrub: email addresses are redacted',
    run: () => {
      assert.equal(
        scrubString('borrower priya.sharma@example.com failed'),
        'borrower [redacted-email] failed'
      )
    },
  },
  {
    name: 'scrub: PAN is redacted',
    run: () => {
      assert.equal(scrubString('PAN ABCDE1234F rejected'), 'PAN [redacted-pan] rejected')
    },
  },
  {
    name: 'scrub: Aadhaar (grouped and bare) is redacted',
    run: () => {
      assert.equal(scrubString('aadhaar 1234 5678 9012 ok'), 'aadhaar [redacted-aadhaar] ok')
      assert.equal(scrubString('aadhaar 123456789012 ok'), 'aadhaar [redacted-aadhaar] ok')
    },
  },
  {
    name: 'scrub: mobiles (+91 and bare) are redacted',
    run: () => {
      assert.equal(scrubString('call +919820277789 now'), 'call [redacted-mobile] now')
      assert.equal(scrubString('call +91 98202 77889 now'), 'call [redacted-mobile] now')
      assert.equal(scrubString('call 9820277789 now'), 'call [redacted-mobile] now')
    },
  },
  {
    name: 'scrub: IFSC and bank-account-length digit runs are redacted',
    run: () => {
      assert.equal(scrubString('ifsc HDFC0001234'), 'ifsc [redacted-ifsc]')
      assert.equal(scrubString('acct 50100234567890'), 'acct [redacted-number]')
    },
  },
  {
    name: 'scrub: non-PII identifiers and prose pass through untouched',
    run: () => {
      assert.equal(scrubString('loan LON-2024-0892 overdue'), 'loan LON-2024-0892 overdue')
      assert.equal(scrubString('payment PAY-2024-8841 allocated'), 'payment PAY-2024-8841 allocated')
      assert.equal(scrubString('EMI of 743750 paise computed'), 'EMI of 743750 paise computed')
    },
  },
  {
    name: 'scrub event: request body dropped, auth headers dropped, user dropped',
    run: () => {
      const event: ScrubbableEvent = {
        message: 'login failed for 9820277789',
        user: { id: 'user-1', email: 'priya@example.com' },
        request: {
          url: 'https://loanops.vercel.app/api/auth/login?mobile=9820277789',
          data: { fullName: 'Priya Sharma', mobile: '9820277789', password: 'x' },
          headers: { authorization: 'Bearer abc', cookie: 'session=xyz', 'x-trace': 't-1' },
        },
      }
      scrubSentryEvent(event)
      assert.equal(event.request?.data, undefined)
      assert.equal(event.user, undefined)
      assert.equal(event.message, 'login failed for [redacted-mobile]')
      assert.equal(event.request?.url?.includes('9820277789'), false)
      const headers = event.request?.headers ?? {}
      assert.equal('authorization' in headers, false)
      assert.equal('cookie' in headers, false)
      assert.equal(headers['x-trace'], 't-1')
    },
  },
  {
    name: 'scrub event: extra/breadcrumbs/exception/frame vars are scrubbed, sensitive keys redacted',
    run: () => {
      const event: ScrubbableEvent = {
        extra: {
          note: 'PAN ABCDE1234F on file',
          password: 'hunter2',
          nested: { contact: 'reach 9820277789', accountNumber: '50100234567890' },
        },
        breadcrumbs: [{ message: 'sent OTP to +919820277789', data: { otp: '123456' } }],
        exception: {
          values: [
            {
              value: 'KYC failed for aadhaar 1234 5678 9012',
              stacktrace: { frames: [{ vars: { mobile: '9820277789', loanId: 'loan-1' } }] },
            },
          ],
        },
      }
      scrubSentryEvent(event)
      assert.equal(event.extra?.note, 'PAN [redacted-pan] on file')
      assert.equal(event.extra?.password, '[redacted]')
      const nested = event.extra?.nested as Record<string, unknown>
      assert.equal(nested.contact, 'reach [redacted-mobile]')
      assert.equal(nested.accountNumber, '[redacted]')
      assert.equal(event.breadcrumbs?.[0]?.message, 'sent OTP to [redacted-mobile]')
      assert.equal((event.breadcrumbs?.[0]?.data as Record<string, unknown>)?.otp, '[redacted]')
      assert.equal(
        event.exception?.values?.[0]?.value,
        'KYC failed for aadhaar [redacted-aadhaar]'
      )
      const vars = event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.vars ?? {}
      assert.equal(vars.mobile, '[redacted]')
      assert.equal(vars.loanId, 'loan-1')
    },
  },
  {
    name: 'sitemap: exactly the public routes, on the configured base URL',
    run: () => {
      const entries = sitemap()
      const paths = entries.map((e) => e.url.replace(expectedBase, ''))
      assert.deepEqual(paths, [
        '/',
        // Dose trim (2026-11-11): the homepage's detail moved to two
        // new public pages — both belong in the sitemap.
        '/product',
        '/security',
        '/privacy',
        '/terms',
        '/grievance',
        '/fair-practices',
        '/kfs',
        '/login',
        '/signup',
      ])
      for (const e of entries) {
        assert.ok(e.url.startsWith(`${expectedBase}/`))
        assert.ok(!/\/(admin|agent|portal|api)\b/.test(e.url))
      }
    },
  },
  {
    name: 'robots: app areas disallowed, sitemap referenced',
    run: () => {
      const r = robots()
      const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules
      assert.equal(rules?.allow, '/')
      assert.deepEqual(rules?.disallow, ['/admin', '/agent', '/portal', '/api'])
      assert.equal(r.sitemap, `${expectedBase}/sitemap.xml`)
    },
  },
  {
    name: 'structured data: parses as JSON, has Organization + SoftwareApplication, no rating/review/offers',
    run: () => {
      const parsed = JSON.parse(JSON.stringify(buildStructuredData('https://example.test/')))
      assert.equal(parsed['@context'], 'https://schema.org')
      const types = parsed['@graph'].map((n: Record<string, unknown>) => n['@type'])
      assert.deepEqual(types, ['Organization', 'SoftwareApplication'])
      const org = parsed['@graph'][0]
      assert.equal(org.name, 'LoanOPS')
      assert.equal(org.url, 'https://example.test')
      assert.equal('sameAs' in org, false)
      const app = parsed['@graph'][1]
      assert.equal(app.applicationCategory, 'BusinessApplication')
      assert.equal(app.operatingSystem, 'Web')
      const serialised = JSON.stringify(parsed)
      assert.equal(serialised.includes('aggregateRating'), false)
      assert.equal(serialised.includes('"review"'), false)
      assert.equal(serialised.includes('"offers"'), false)
    },
  },
  {
    name: 'idempotency keys: cash_ prefix, timestamp, 24 hex CSPRNG chars, unique',
    run: () => {
      const a = generateCashIdempotencyKey()
      const b = generateCashIdempotencyKey()
      assert.match(a, /^cash_\d+_[0-9a-f]{24}$/)
      assert.match(b, /^cash_\d+_[0-9a-f]{24}$/)
      assert.notEqual(a, b)
    },
  },
]

async function runTests() {
  let passed = 0
  for (const t of tests) {
    try {
      t.run()
      passed++
      console.log(`✓ ${t.name}`)
    } catch (err) {
      console.error(`✗ ${t.name}`)
      console.error(err)
      process.exit(1)
    }
  }
  console.log(`\nAll ${passed}/${tests.length} launch-package unit tests passed.`)
}
runTests()
