import assert from 'node:assert/strict'
import {
  ENQUIRY_HONEYPOT_FIELD,
  enquirySubmitSchema,
  parseEnquirySubmission,
  type EnquirySubmitInput,
} from '../../src/lib/enquiries'

interface TestCase {
  name: string
  fn: () => void | Promise<void>
}

const tests: TestCase[] = []
function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

const VALID: EnquirySubmitInput = {
  name: 'Priya Sharma',
  mobile: '9820277789',
  email: 'priya@example.com',
  businessName: 'Sharma Micro Finance',
  message: 'We run a small lending business and want to manage collections better.',
}

// ============================================================
// 1. Schema contract — required fields, bounds, unknown keys
// ============================================================

test('schema accepts a fully valid enquiry payload', () => {
  const parsed = enquirySubmitSchema.parse(VALID)
  assert.equal(parsed.name, 'Priya Sharma')
  assert.equal(parsed.businessName, 'Sharma Micro Finance')
})

test('schema accepts the payload without the optional email', () => {
  const { email: _email, ...noEmail } = VALID
  const parsed = enquirySubmitSchema.parse(noEmail)
  assert.equal(parsed.email, undefined)
})

test('schema accepts an empty-string email (form submits it when left blank)', () => {
  const parsed = enquirySubmitSchema.parse({ ...VALID, email: '' })
  assert.equal(parsed.email, '')
})

test('schema rejects a malformed email', () => {
  assert.throws(() => enquirySubmitSchema.parse({ ...VALID, email: 'not-an-email' }))
})

test('schema rejects missing required fields', () => {
  for (const key of ['name', 'mobile', 'businessName', 'message'] as const) {
    const broken: Record<string, unknown> = { ...VALID }
    delete broken[key]
    assert.throws(() => enquirySubmitSchema.parse(broken), `expected rejection without ${key}`)
  }
})

test('schema rejects a too-short message and a too-short name', () => {
  assert.throws(() => enquirySubmitSchema.parse({ ...VALID, message: 'short' }))
  assert.throws(() => enquirySubmitSchema.parse({ ...VALID, name: 'P' }))
})

test('schema is strict — unknown fields are rejected (mass-assignment defence)', () => {
  assert.throws(() => enquirySubmitSchema.parse({ ...VALID, status: 'CLOSED' }))
  assert.throws(() => enquirySubmitSchema.parse({ ...VALID, organizationId: 'demo-org-001' }))
})

// ============================================================
// 2. parseEnquirySubmission — honeypot, mobile, storage shape
// ============================================================

test('a valid submission parses to the storage shape with email kept', () => {
  const result = parseEnquirySubmission(enquirySubmitSchema.parse(VALID))
  assert.equal(result.kind, 'ok')
  if (result.kind === 'ok') {
    assert.deepEqual(result.data, {
      name: 'Priya Sharma',
      mobile: '9820277789',
      email: 'priya@example.com',
      businessName: 'Sharma Micro Finance',
      message: VALID.message,
    })
  }
})

test('mobile spellings canonicalize to the stored 10-digit form', () => {
  for (const spelling of ['+91 98202 77789', '09820277789', '919820277789', '00919820277789']) {
    const result = parseEnquirySubmission(enquirySubmitSchema.parse({ ...VALID, mobile: spelling }))
    assert.equal(result.kind, 'ok', spelling)
    if (result.kind === 'ok') assert.equal(result.data.mobile, '9820277789', spelling)
  }
})

test('a non-mobile number is rejected as invalid-mobile (route maps it to 422)', () => {
  for (const bad of ['1234567890', '98202', 'abcdefghij']) {
    const parsed = enquirySubmitSchema.safeParse({ ...VALID, mobile: bad })
    if (parsed.success) {
      const result = parseEnquirySubmission(parsed.data)
      assert.equal(result.kind, 'invalid-mobile', bad)
    }
    // If the schema itself rejects the length first, that is also a
    // 422 at the route — either way the value can never be stored.
  }
  const result = parseEnquirySubmission(enquirySubmitSchema.parse({ ...VALID, mobile: '1234567890' }))
  assert.equal(result.kind, 'invalid-mobile')
})

test('an omitted or blank email stores as null, never an empty string', () => {
  const blank = parseEnquirySubmission(enquirySubmitSchema.parse({ ...VALID, email: '' }))
  assert.equal(blank.kind, 'ok')
  if (blank.kind === 'ok') assert.equal(blank.data.email, null)

  const { email: _email, ...noEmail } = VALID
  const omitted = parseEnquirySubmission(enquirySubmitSchema.parse(noEmail))
  assert.equal(omitted.kind, 'ok')
  if (omitted.kind === 'ok') assert.equal(omitted.data.email, null)
})

test('a filled honeypot marks the submission as a bot discard', () => {
  const result = parseEnquirySubmission(
    enquirySubmitSchema.parse({ ...VALID, [ENQUIRY_HONEYPOT_FIELD]: 'http://spam.example' })
  )
  assert.equal(result.kind, 'honeypot')
})

test('the honeypot wins over other validation — a bot payload is discarded before mobile checks', () => {
  const result = parseEnquirySubmission(
    enquirySubmitSchema.parse({ ...VALID, mobile: '1234567890', website: 'spam' })
  )
  assert.equal(result.kind, 'honeypot')
})

test('an empty or whitespace-only honeypot is a human submission', () => {
  for (const website of ['', '   ', undefined]) {
    const result = parseEnquirySubmission(enquirySubmitSchema.parse({ ...VALID, website }))
    assert.equal(result.kind, 'ok', JSON.stringify(website))
  }
})

// ============================================================
// RUNNER
// ============================================================

async function runTests() {
  console.log(`\nRunning ${tests.length} enquiries unit tests...\n`)
  let passed = 0
  for (const t of tests) {
    try {
      await t.fn()
      console.log(`✓ ${t.name}`)
      passed++
    } catch (err) {
      console.error(`✗ ${t.name}`)
      console.error(err)
      process.exit(1)
    }
  }
  console.log(`\nAll ${passed}/${tests.length} enquiries unit tests passed.`)
}
runTests()
