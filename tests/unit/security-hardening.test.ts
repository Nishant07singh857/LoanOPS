import assert from 'node:assert/strict'
import { canonicalizeMobile, foldUnicodeDigits } from '../../src/lib/mobile'
import {
  validateLoanTerms,
  MIN_PRINCIPAL_PAISE,
  MAX_PRINCIPAL_PAISE,
  MAX_INTEREST_RATE_BPS,
} from '../../src/lib/loan-terms'
import {
  candidateCarriesPii,
  candidateRequiresClaimCode,
  type CandidatePiiFields,
} from '../../src/lib/candidate-footprint'
import {
  generateTotpSecret,
  generateTotpCode,
  matchTotpStep,
  verifyTotpCode,
  isTotpStepReplay,
} from '../../src/lib/server/totp'

interface TestCase {
  name: string
  fn: () => void | Promise<void>
}

const tests: TestCase[] = []
function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

// ============================================================
// 1. Mobile canonicalization (red-team round 2, R1/R3)
// ============================================================

const KARTHIK = '9820922448'

test('canonicalizeMobile folds every digit script to ASCII', () => {
  assert.equal(foldUnicodeDigits('९८२०९२२४४८'), KARTHIK) // Devanagari
  assert.equal(foldUnicodeDigits('٩٨٢٠٩٢٢٤٤٨'), KARTHIK) // Arabic-Indic
  assert.equal(foldUnicodeDigits('۹۸۲۰۹۲۲۴۴۸'), KARTHIK) // Extended Arabic-Indic
  assert.equal(foldUnicodeDigits('９８２０９２２４４８'), KARTHIK) // Fullwidth
  assert.equal(canonicalizeMobile('९८२०९२२४४८'), KARTHIK)
  assert.equal(canonicalizeMobile('٩٨٢٠٩٢٢٤٤٨'), KARTHIK)
  assert.equal(canonicalizeMobile('۹۸۲۰۹۲۲۴۴۸'), KARTHIK)
  assert.equal(canonicalizeMobile('９８２０９２２４４８'), KARTHIK)
})

test('canonicalizeMobile strips every prefix / separator spelling', () => {
  assert.equal(canonicalizeMobile('9820922448'), KARTHIK)
  assert.equal(canonicalizeMobile('+919820922448'), KARTHIK)
  assert.equal(canonicalizeMobile('919820922448'), KARTHIK)
  assert.equal(canonicalizeMobile('09820922448'), KARTHIK)
  assert.equal(canonicalizeMobile('00919820922448'), KARTHIK)
  assert.equal(canonicalizeMobile('0919820922448'), KARTHIK)
  assert.equal(canonicalizeMobile('98 209 22448'), KARTHIK)
  assert.equal(canonicalizeMobile('+91-98209-22448'), KARTHIK)
  assert.equal(canonicalizeMobile('(0)9820922448'), KARTHIK)
  assert.equal(canonicalizeMobile(' 9820922448 '), KARTHIK)
})

test('canonicalizeMobile rejects non-mobiles', () => {
  assert.equal(canonicalizeMobile('5820922448'), null) // must start 6-9
  assert.equal(canonicalizeMobile('982092244'), null) // 9 digits
  assert.equal(canonicalizeMobile('98209224481'), null) // 11 digits, no 0 trunk
  assert.equal(canonicalizeMobile('19820922448'), null) // 11 digits, foreign trunk
  assert.equal(canonicalizeMobile('+14155552671'), null) // US number
  assert.equal(canonicalizeMobile('98209abc48'), null) // letters
  assert.equal(canonicalizeMobile(''), null)
  assert.equal(canonicalizeMobile('          '), null)
  assert.equal(canonicalizeMobile(null), null)
  assert.equal(canonicalizeMobile(undefined), null)
  assert.equal(canonicalizeMobile({}), null)
})

// ============================================================
// 2. Claim-gate footprint predicate (red-team round 2, R4)
// ============================================================

const ZERO_COUNTS = { applications: 0, loans: 0, kycDocuments: 0, payments: 0 }
const SHELL: CandidatePiiFields = {
  dob: null,
  address: null,
  bankAccount: null,
  bankIfsc: null,
  upiId: null,
  employer: null,
  monthlyIncome: null,
  aadhaarHash: null,
  aadhaarMasked: null,
  panMasked: null,
}

test('an empty shell (name + mobile only) needs no claim code', () => {
  assert.equal(candidateCarriesPii(SHELL), false)
  assert.equal(candidateRequiresClaimCode(SHELL, ZERO_COUNTS), false)
})

test('any staff-entered PII field makes the lead claim-code protected', () => {
  const piiCases: Array<[string, CandidatePiiFields]> = [
    ['dob', { ...SHELL, dob: new Date('1990-01-01') }],
    ['address', { ...SHELL, address: '12 MG Road' }],
    ['bankAccount', { ...SHELL, bankAccount: 'enc:v1:abc' }],
    ['bankIfsc', { ...SHELL, bankIfsc: 'HDFC0001234' }],
    ['upiId', { ...SHELL, upiId: 'name@okhdfc' }],
    ['employer', { ...SHELL, employer: 'Acme Pvt Ltd' }],
    ['monthlyIncome', { ...SHELL, monthlyIncome: 4_500_000 }],
    ['monthlyIncome zero', { ...SHELL, monthlyIncome: 0 }],
    ['aadhaarHash', { ...SHELL, aadhaarHash: 'deadbeef' }],
    ['aadhaarMasked', { ...SHELL, aadhaarMasked: 'XXXX-XXXX-1234' }],
    ['panMasked', { ...SHELL, panMasked: 'ABXXX1234F' }],
  ]
  for (const [label, fields] of piiCases) {
    assert.equal(candidateCarriesPii(fields), true, label)
    assert.equal(candidateRequiresClaimCode(fields, ZERO_COUNTS), true, label)
  }
})

test('whitespace-only PII strings do not count as footprint', () => {
  assert.equal(candidateCarriesPii({ ...SHELL, address: '   ' }), false)
})

test('application / loan / KYC / payment counts require a code on their own', () => {
  assert.equal(candidateRequiresClaimCode(SHELL, { ...ZERO_COUNTS, applications: 1 }), true)
  assert.equal(candidateRequiresClaimCode(SHELL, { ...ZERO_COUNTS, loans: 1 }), true)
  assert.equal(candidateRequiresClaimCode(SHELL, { ...ZERO_COUNTS, kycDocuments: 1 }), true)
  assert.equal(candidateRequiresClaimCode(SHELL, { ...ZERO_COUNTS, payments: 1 }), true)
})

// ============================================================
// 3. Shared terms validator (red-team round 2, N3/N5)
// ============================================================

test('terms validator enforces the principal floor and ceiling', () => {
  assert.equal(validateLoanTerms({ principalPaise: '0' }).ok, false)
  assert.equal(validateLoanTerms({ principalPaise: 0 }).ok, false)
  assert.equal(validateLoanTerms({ principalPaise: -100 }).ok, false)
  assert.equal(validateLoanTerms({ principalPaise: String(MIN_PRINCIPAL_PAISE - 1) }).ok, false)
  assert.equal(validateLoanTerms({ principalPaise: String(MIN_PRINCIPAL_PAISE) }).ok, true)
  assert.equal(validateLoanTerms({ principalPaise: '5000000' }).ok, true)
  assert.equal(validateLoanTerms({ principalPaise: String(MAX_PRINCIPAL_PAISE) }).ok, true)
  assert.equal(validateLoanTerms({ principalPaise: String(MAX_PRINCIPAL_PAISE + 1) }).ok, false)
  assert.equal(validateLoanTerms({ principalPaise: 'not-a-number' }).ok, false)
})

test('terms validator rejects the Int32-overflowing principal (422, never 500)', () => {
  const res = validateLoanTerms({ principalPaise: '3000000000' }) // > 2^31 - 1 paise
  assert.equal(res.ok, false)
  assert.equal(validateLoanTerms({ principalPaise: '2000000000000' }).ok, false)
})

test('terms validator caps the interest rate at 100% (10000 bps)', () => {
  assert.equal(validateLoanTerms({ interestRateBps: 1_000_000, interestType: 'PERCENTAGE' }).ok, false) // 10,000%
  assert.equal(validateLoanTerms({ interestRateBps: MAX_INTEREST_RATE_BPS + 1 }).ok, false)
  assert.equal(validateLoanTerms({ interestRateBps: MAX_INTEREST_RATE_BPS }).ok, true)
  assert.equal(validateLoanTerms({ interestRateBps: 1800, interestType: 'PERCENTAGE' }).ok, true)
  assert.equal(validateLoanTerms({ interestRateBps: -1 }).ok, false)
})

test('terms validator: zero rate only for non-percentage loans', () => {
  assert.equal(validateLoanTerms({ interestRateBps: 0, interestType: 'PERCENTAGE' }).ok, false)
  assert.equal(validateLoanTerms({ interestRateBps: 0, interestType: 'NONE' }).ok, true)
  assert.equal(validateLoanTerms({ interestRateBps: 0, interestType: 'FIXED' }).ok, true)
  assert.equal(validateLoanTerms({ interestRateBps: null, interestType: 'PERCENTAGE' }).ok, true)
})

test('terms validator enforces the installments range and ignores absent fields', () => {
  assert.equal(validateLoanTerms({ installments: 0 }).ok, false)
  assert.equal(validateLoanTerms({ installments: 361 }).ok, false)
  assert.equal(validateLoanTerms({ installments: 360 }).ok, true)
  assert.equal(validateLoanTerms({ installments: 1 }).ok, true)
  assert.equal(validateLoanTerms({}).ok, true) // partial presets validate only what they carry
  assert.equal(
    validateLoanTerms({
      principalPaise: '5000000',
      interestType: 'PERCENTAGE',
      interestRateBps: 1200,
      installments: 12,
    }).ok,
    true
  )
})

// ============================================================
// 4. TOTP step logic (red-team round 2, N1)
// ============================================================

test('matchTotpStep returns the matched step for a current code', () => {
  const secret = generateTotpSecret()
  const code = generateTotpCode(secret)
  const step = matchTotpStep(secret, code)
  assert.notEqual(step, null)
  assert.equal(verifyTotpCode(secret, code), true)
})

test('a consumed step is a replay; the next step is not', () => {
  const secret = generateTotpSecret()
  const code = generateTotpCode(secret)
  const step = matchTotpStep(secret, code) as number
  assert.equal(isTotpStepReplay(step, step), true) // same code again → replay
  assert.equal(isTotpStepReplay(step - 1, step), true) // older code → replay
  assert.equal(isTotpStepReplay(step + 1, step), false) // next window → fresh
})

test('codes outside the ±1 step window do not match', () => {
  const secret = generateTotpSecret()
  const staleStep = Math.floor(Date.now() / 30000) - 5
  const staleCode = generateTotpCode(secret, staleStep)
  assert.equal(matchTotpStep(secret, staleCode), null)
  assert.equal(matchTotpStep(secret, '12345'), null) // not 6 digits
  assert.equal(matchTotpStep(secret, ''), null)
})

// ============================================================
// RUNNER
// ============================================================

async function runTests() {
  console.log(`\nRunning ${tests.length} security-hardening unit tests...\n`)
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
  console.log(`\nAll ${passed}/${tests.length} security-hardening unit tests passed.`)
}
runTests()
