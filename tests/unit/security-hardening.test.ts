import assert from 'node:assert/strict'
import { canonicalizeMobile, foldUnicodeDigits } from '../../src/lib/mobile'
import {
  validateLoanTerms,
  MIN_PRINCIPAL_PAISE,
  MAX_PRINCIPAL_PAISE,
  MAX_INTEREST_RATE_BPS,
  MAX_FEE_PAISE,
  MAX_INT32_PAISE,
} from '../../src/lib/loan-terms'
import { validatePasswordPolicy } from '../../src/lib/server/password-policy'
import {
  isUniqueConstraintError,
  isValueRangeError,
  isConcurrencyConflictError,
} from '../../src/lib/server/prisma-errors'
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
  email: null,
  address: null,
  occupation: null,
  bankName: null,
  bankAccount: null,
  bankIfsc: null,
  upiId: null,
  employer: null,
  monthlyIncome: null,
  existingObligations: null,
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
    // Round 3 (P2): the last four staff-entered fields join the list.
    ['email', { ...SHELL, email: 'meena.private@example.com' }],
    ['occupation', { ...SHELL, occupation: 'Farmer' }],
    ['bankName', { ...SHELL, bankName: 'HDFC Bank' }],
    ['existingObligations', { ...SHELL, existingObligations: 120_000 }],
    ['existingObligations zero', { ...SHELL, existingObligations: 0 }],
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
// 5. Fee ceilings + computed-total ceiling (red-team round 3, P3)
// ============================================================

test('terms validator caps each fee figure at the single-figure ceiling', () => {
  assert.equal(validateLoanTerms({ processingFeePaise: String(MAX_FEE_PAISE) }).ok, true)
  assert.equal(validateLoanTerms({ processingFeePaise: String(MAX_FEE_PAISE + 1) }).ok, false)
  assert.equal(validateLoanTerms({ otherFeesPaise: '99999999999999999999' }).ok, false)
  assert.equal(validateLoanTerms({ fixedInterestPaise: '99999999999999999999' }).ok, false)
  assert.equal(validateLoanTerms({ processingFeePaise: '75000' }).ok, true)
  assert.equal(validateLoanTerms({ processingFeePaise: '-5' }).ok, false)
  assert.equal(validateLoanTerms({ otherFeesPaise: null }).ok, true) // absent = unchecked
})

test('terms validator rejects a computed total one paise over Int32', () => {
  assert.equal(validateLoanTerms({ totalRepayablePaise: BigInt(MAX_INT32_PAISE) }).ok, true)
  assert.equal(validateLoanTerms({ totalRepayablePaise: BigInt(MAX_INT32_PAISE) + BigInt(1) }).ok, false)
  assert.equal(validateLoanTerms({ totalRepayablePaise: BigInt(8925000) }).ok, true)
})

// ============================================================
// 6. Breached-password variants (red-team round 3, P5)
// ============================================================

test('password policy rejects mutated variants of breached bases', () => {
  const rejected = [
    'Password123!', // the round-3 case: top-corpus password, was accepted
    'password@123', // separator tail instead of digits
    'Qwerty@2026', // listed base + year tail
    'P@ssword123', // leetspeak inside the base
    'p@ssw0rd2026!', // leetspeak + digit/symbol tail
    'W3lcome@2026', // leet digit inside the base
    'Admin12345!', // listed base + symbol tail
    'xPassword99', // notorious base with a short prefix pad
  ]
  for (const pw of rejected) {
    assert.equal(validatePasswordPolicy(pw).ok, false, pw)
  }
})

test('password policy still accepts strong passphrases', () => {
  assert.equal(validatePasswordPolicy('Monsoon!Tiger7Bridge').ok, true)
  assert.equal(validatePasswordPolicy('Correct-Horse-Battery-9').ok, true)
  // Contains a common word but is not dominated by it (long passphrase).
  assert.equal(validatePasswordPolicy('PasswordHorseBattery9!Long').ok, true)
})

// ============================================================
// 7. Prisma error shapes (red-team round 3, P1/P3)
// ============================================================

test('unique-constraint recognition covers the commit-time wrapped shape', () => {
  assert.equal(isUniqueConstraintError({ code: 'P2002' }), true)
  assert.equal(
    isUniqueConstraintError({
      name: 'PrismaClientUnknownRequestError',
      message:
        'Invalid `prisma.candidate.create()` invocation: Unique constraint failed on the fields: (`organizationId`, `mobile`)',
    }),
    true
  )
  assert.equal(
    isUniqueConstraintError({
      message: 'duplicate key value violates unique constraint "User_email_key"',
    }),
    true
  )
  assert.equal(isUniqueConstraintError({ code: 'P2025', message: 'Record not found' }), false)
  assert.equal(isUniqueConstraintError(new Error('connection refused')), false)
  assert.equal(isUniqueConstraintError(null), false)
})

test('value-range recognition only matches the driver wording for un-storable values', () => {
  assert.equal(
    isValueRangeError({
      name: 'PrismaClientUnknownRequestError',
      message: 'Error in connector: integer out of range',
    }),
    true
  )
  assert.equal(isValueRangeError(new Error('connect ECONNREFUSED 127.0.0.1:5432')), false)
  assert.equal(isValueRangeError({ code: 'P2002', message: 'Unique constraint failed' }), false)
  assert.equal(isValueRangeError(null), false)
})

test('concurrency-conflict recognition covers deadlocks and write conflicts only', () => {
  // The round-3 race loser's actual shape: an unknown-request error
  // whose cause chain names the Postgres deadlock.
  assert.equal(
    isConcurrencyConflictError({
      name: 'PrismaClientUnknownRequestError',
      message: 'Error occurred during query execution: deadlock detected',
    }),
    true
  )
  assert.equal(isConcurrencyConflictError({ code: 'P2034' }), true)
  // Genuine faults and other client errors must NOT be reclassified.
  assert.equal(isConcurrencyConflictError(new Error('connect ECONNREFUSED 127.0.0.1:5432')), false)
  assert.equal(isConcurrencyConflictError({ code: 'P2025', message: 'Record not found' }), false)
  assert.equal(isConcurrencyConflictError(null), false)
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
