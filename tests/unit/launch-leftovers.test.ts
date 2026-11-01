// Unit tests for the launch-leftovers PR:
// - Sentry scrubber edges (src/lib/sentry-scrub.ts) — lowercase PAN /
//   IFSC, malformed Aadhaar groupings, over-long digit runs and bare-91
//   mobiles redact; business IDs and ordinary prose survive untouched.
// - Cron heartbeat (src/lib/server/heartbeat.ts) — no-op when unset,
//   and a failed ping is swallowed, never thrown.
// - Web app manifest (src/app/manifest.ts) — brand fields and an icon
//   set whose files actually exist.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { scrubString } from '../../src/lib/sentry-scrub'
import { pingHeartbeat } from '../../src/lib/server/heartbeat'
import manifest from '../../src/app/manifest'

interface TestCase {
  name: string
  run: () => void | Promise<void>
}

const tests: TestCase[] = [
  {
    name: 'scrub: lowercase and mixed-case PAN are redacted',
    run: () => {
      assert.equal(scrubString('pan abcde1234f rejected'), 'pan [redacted-pan] rejected')
      assert.equal(scrubString('pan AbCdE1234F rejected'), 'pan [redacted-pan] rejected')
    },
  },
  {
    name: 'scrub: lowercase and mixed-case IFSC are redacted',
    run: () => {
      assert.equal(scrubString('ifsc sbin0123456'), 'ifsc [redacted-ifsc]')
      assert.equal(scrubString('ifsc Hdfc0001234'), 'ifsc [redacted-ifsc]')
    },
  },
  {
    name: 'scrub: malformed Aadhaar grouping (4-8) is redacted',
    run: () => {
      assert.equal(scrubString('aadhaar 1234 56789012 ok'), 'aadhaar [redacted-aadhaar] ok')
      assert.equal(scrubString('aadhaar 1234-56789012 ok'), 'aadhaar [redacted-aadhaar] ok')
    },
  },
  {
    name: 'scrub: digit runs longer than 18 are redacted',
    run: () => {
      assert.equal(scrubString('ref 12345678901234567890 end'), 'ref [redacted-number] end')
    },
  },
  {
    name: 'scrub: bare 91 country-code mobiles are labelled mobile',
    run: () => {
      assert.equal(scrubString('call 919820277789 now'), 'call [redacted-mobile] now')
      assert.equal(scrubString('call 91 9820277789 now'), 'call [redacted-mobile] now')
      assert.equal(scrubString('call 91 98202 77789 now'), 'call [redacted-mobile] now')
    },
  },
  {
    name: 'scrub: business IDs and prose survive the new patterns untouched',
    run: () => {
      assert.equal(scrubString('loan LON-2024-0892 overdue'), 'loan LON-2024-0892 overdue')
      assert.equal(scrubString('payment PAY-2024-8841 allocated'), 'payment PAY-2024-8841 allocated')
      assert.equal(scrubString('ticket SUP-MVXLTA2V1C871 open'), 'ticket SUP-MVXLTA2V1C871 open')
      assert.equal(scrubString('EMI of 743750 paise computed'), 'EMI of 743750 paise computed')
      // Canonical forms keep their established labels.
      assert.equal(scrubString('aadhaar 1234 5678 9012 ok'), 'aadhaar [redacted-aadhaar] ok')
      assert.equal(scrubString('id 698765432109 x'), 'id [redacted-aadhaar] x')
      assert.equal(scrubString('PAN ABCDE1234F rejected'), 'PAN [redacted-pan] rejected')
      assert.equal(scrubString('ifsc HDFC0001234'), 'ifsc [redacted-ifsc]')
    },
  },
  {
    name: 'heartbeat: unset URL is a no-op and never calls fetch',
    run: async () => {
      const original = globalThis.fetch
      let calls = 0
      globalThis.fetch = (async () => {
        calls++
        return new Response(null, { status: 200 })
      }) as typeof fetch
      try {
        await pingHeartbeat(undefined, 'test')
        await pingHeartbeat('', 'test')
        assert.equal(calls, 0)
      } finally {
        globalThis.fetch = original
      }
    },
  },
  {
    name: 'heartbeat: a failing ping is swallowed, a good ping goes through once',
    run: async () => {
      const original = globalThis.fetch
      const seen: string[] = []
      try {
        globalThis.fetch = (async () => {
          throw new Error('network down')
        }) as typeof fetch
        await pingHeartbeat('https://hc.example/fail', 'test')
        globalThis.fetch = (async (url: unknown) => {
          seen.push(String(url))
          return new Response(null, { status: 200 })
        }) as typeof fetch
        await pingHeartbeat('https://hc.example/ok', 'test')
        assert.deepEqual(seen, ['https://hc.example/ok'])
      } finally {
        globalThis.fetch = original
      }
    },
  },
  {
    name: 'manifest: brand fields set, icon files exist on disk',
    run: () => {
      const m = manifest()
      assert.equal(m.name, 'LoanOPS')
      assert.equal(m.short_name, 'LoanOPS')
      assert.equal(m.display, 'standalone')
      assert.equal(m.theme_color, '#0f3778')
      assert.equal(m.background_color, '#f6fdff')
      const icons = m.icons ?? []
      assert.deepEqual(
        icons.map((i) => `${i.src}|${i.sizes}|${i.purpose}`),
        [
          '/icons/icon-192.png|192x192|any',
          '/icons/icon-512.png|512x512|any',
          '/icons/icon-maskable-512.png|512x512|maskable',
        ]
      )
      for (const icon of icons) {
        assert.ok(
          existsSync(join(process.cwd(), 'public', icon.src)),
          `manifest icon missing on disk: ${icon.src}`
        )
      }
    },
  },
]

async function runTests() {
  let passed = 0
  for (const t of tests) {
    try {
      await t.run()
      passed++
      console.log(`✓ ${t.name}`)
    } catch (err) {
      console.error(`✗ ${t.name}`)
      console.error(err)
      process.exit(1)
    }
  }
  console.log(`\nAll ${passed}/${tests.length} launch-leftovers unit tests passed.`)
}
runTests()
