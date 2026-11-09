// Unit tests for the D1 consent-evidence contract (src/lib/consents.ts):
// account-creation flows must reject any request whose mandatory
// consents are absent or not granted, and must record exactly the
// consents submitted. The gate itself is pure; the route-level
// behaviour (422 + zero rows, exact-match recording) is pinned by
// tests/consent-evidence.spec.ts.
import assert from 'node:assert/strict'
import {
  APPLY_REQUIRED_CONSENTS,
  SIGNUP_REQUIRED_CONSENTS,
  SUBMIT_REQUIRED_CONSENTS,
  missingRequiredConsents,
  type SubmittedConsent,
} from '../../src/lib/consents'

interface TestCase {
  name: string
  fn: () => void
}

const tests: TestCase[] = []
function test(name: string, fn: () => void) {
  tests.push({ name, fn })
}

const granted = (consentType: string): SubmittedConsent => ({ consentType, granted: true })
const denied = (consentType: string): SubmittedConsent => ({ consentType, granted: false })

test('signup contract: mandatory pair is DATA_PROCESSING + TERMS_PRIVACY', () => {
  assert.deepEqual([...SIGNUP_REQUIRED_CONSENTS], ['DATA_PROCESSING', 'TERMS_PRIVACY'])
})

test('apply contract: mandatory set is the four unbundled apply consents', () => {
  assert.deepEqual(
    [...APPLY_REQUIRED_CONSENTS],
    ['DATA_PROCESSING', 'KYC_AADHAAR', 'CREDIT_CHECK', 'KFS_DISCLOSURE']
  )
})

test('undefined / null / empty submissions miss every required consent', () => {
  assert.deepEqual(missingRequiredConsents(undefined, SIGNUP_REQUIRED_CONSENTS), [
    'DATA_PROCESSING',
    'TERMS_PRIVACY',
  ])
  assert.deepEqual(missingRequiredConsents(null, SIGNUP_REQUIRED_CONSENTS), [
    'DATA_PROCESSING',
    'TERMS_PRIVACY',
  ])
  assert.deepEqual(missingRequiredConsents([], SIGNUP_REQUIRED_CONSENTS), [
    'DATA_PROCESSING',
    'TERMS_PRIVACY',
  ])
})

test('the exact QA repro (consents: []) misses both signup consents', () => {
  const missing = missingRequiredConsents([], SIGNUP_REQUIRED_CONSENTS)
  assert.equal(missing.length, 2)
})

test('full grant satisfies the gate; optional extras are irrelevant', () => {
  assert.deepEqual(
    missingRequiredConsents(
      [granted('DATA_PROCESSING'), granted('TERMS_PRIVACY'), denied('COMMUNICATION')],
      SIGNUP_REQUIRED_CONSENTS
    ),
    []
  )
})

test('a required consent present but granted=false is missing', () => {
  assert.deepEqual(
    missingRequiredConsents(
      [granted('DATA_PROCESSING'), denied('TERMS_PRIVACY')],
      SIGNUP_REQUIRED_CONSENTS
    ),
    ['TERMS_PRIVACY']
  )
})

test('an unrelated consent does not substitute for a required one', () => {
  assert.deepEqual(
    missingRequiredConsents(
      [granted('DATA_PROCESSING'), granted('KFS_DISCLOSURE')],
      SIGNUP_REQUIRED_CONSENTS
    ),
    ['TERMS_PRIVACY']
  )
})

test('duplicate types: the LAST entry wins (latest-state rule)', () => {
  assert.deepEqual(
    missingRequiredConsents(
      [denied('TERMS_PRIVACY'), granted('DATA_PROCESSING'), granted('TERMS_PRIVACY')],
      SIGNUP_REQUIRED_CONSENTS
    ),
    []
  )
  assert.deepEqual(
    missingRequiredConsents(
      [granted('DATA_PROCESSING'), granted('TERMS_PRIVACY'), denied('TERMS_PRIVACY')],
      SIGNUP_REQUIRED_CONSENTS
    ),
    ['TERMS_PRIVACY']
  )
})

test('submit contract: mandatory pair is DATA_PROCESSING + TERMS_PRIVACY', () => {
  assert.deepEqual([...SUBMIT_REQUIRED_CONSENTS], ['DATA_PROCESSING', 'TERMS_PRIVACY'])
})

test('submit gate: itemised consents with the mandatory pair granted pass', () => {
  assert.deepEqual(
    missingRequiredConsents(
      [
        granted('DATA_PROCESSING'),
        granted('TERMS_PRIVACY'),
        granted('KYC_AADHAAR'),
        denied('CREDIT_CHECK'),
      ],
      SUBMIT_REQUIRED_CONSENTS
    ),
    []
  )
})

test('submit gate: the historical four (no TERMS_PRIVACY) fail the itemised gate', () => {
  // Requests that itemise must carry the mandatory pair; the legacy
  // DATA_PROCESSING/KYC_AADHAAR/CREDIT_CHECK/KFS_DISCLOSURE bundle only
  // remains valid on the consents-absent fallback path (route-level).
  assert.deepEqual(
    missingRequiredConsents(
      [
        granted('DATA_PROCESSING'),
        granted('KYC_AADHAAR'),
        granted('CREDIT_CHECK'),
        granted('KFS_DISCLOSURE'),
      ],
      SUBMIT_REQUIRED_CONSENTS
    ),
    ['TERMS_PRIVACY']
  )
})

test('submit gate: a mandatory consent denied (granted=false) fails', () => {
  assert.deepEqual(
    missingRequiredConsents(
      [denied('DATA_PROCESSING'), granted('TERMS_PRIVACY')],
      SUBMIT_REQUIRED_CONSENTS
    ),
    ['DATA_PROCESSING']
  )
})

test('apply gate: missing any one of the four fails with exactly that type', () => {
  const full = APPLY_REQUIRED_CONSENTS.map(granted)
  assert.deepEqual(missingRequiredConsents(full, APPLY_REQUIRED_CONSENTS), [])
  for (const omitted of APPLY_REQUIRED_CONSENTS) {
    const partial = full.filter((c) => c.consentType !== omitted)
    assert.deepEqual(missingRequiredConsents(partial, APPLY_REQUIRED_CONSENTS), [omitted])
  }
})

async function runTests() {
  let passed = 0
  for (const t of tests) {
    try {
      t.fn()
      console.log(`✓ ${t.name}`)
      passed++
    } catch (err) {
      console.error(`✗ ${t.name}`)
      console.error(err)
      process.exit(1)
    }
  }
  console.log(`\nAll ${passed}/${tests.length} consent-evidence unit tests passed.`)
}
runTests()
