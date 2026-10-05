import assert from 'node:assert/strict'
import {
  generateSchedule,
  allocatePayment,
  rupeesToPaise,
  parsePaise,
  serializePaise,
  type InstallmentState,
} from '../../src/lib/server/financial'
import {
  generateSchedulePreview,
  calculateInstallmentsFromTenure,
} from '../../src/lib/financial-engine'
import {
  encryptPII,
  decryptPII,
  rotateEncryptedPII,
  hashPII,
} from '../../src/lib/server/crypto'
import {
  maskAadhaar,
  maskPan,
  maskBankAccount,
} from '../../src/lib/utils'
import {
  sanitizeText,
  sanitizeJsonPayload,
  validateSafeRedirect,
  detectMagicBytesMime,
  stripImageMetadata,
} from '../../src/lib/server/security'

interface TestCase {
  name: string
  fn: () => void | Promise<void>
}

const tests: TestCase[] = []
function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

// 1. Paise Conversion & Floating-Point Immunity
test('rupeesToPaise converts decimal rupee inputs without float drift', () => {
  assert.equal(rupeesToPaise('19.99'), BigInt(1999))
  assert.equal(rupeesToPaise(19.99), BigInt(1999))
  assert.equal(rupeesToPaise('50000'), BigInt(5_000_000))
  assert.equal(rupeesToPaise('1234.56'), BigInt(123456))
  assert.equal(rupeesToPaise(0.1 + 0.2), BigInt(30))
  assert.equal(rupeesToPaise('invalid'), BigInt(0))
})

test('parsePaise and serializePaise round-trip cleanly', () => {
  const amount = BigInt(7_500_025)
  const serialized = serializePaise(amount)
  assert.equal(serialized, '7500025')
  assert.equal(parsePaise(serialized), amount)
  assert.equal(parsePaise(null), BigInt(0))
  assert.equal(parsePaise(undefined), BigInt(0))
  assert.equal(parsePaise(''), BigInt(0))
})

// 2. Schedule Generation: Flat Percentage Interest
test('generateSchedule computes flat percentage interest and closes principal to 0', () => {
  const result = generateSchedule({
    principalPaise: BigInt(1_200_000), // ₹12,000
    interestType: 'PERCENTAGE',
    interestRateBps: BigInt(1200), // 12%
    fixedInterestPaise: BigInt(0),
    frequency: 'MONTHLY',
    installments: 12,
    firstDueDate: new Date('2026-01-15T00:00:00.000Z'),
    processingFeePaise: BigInt(24_000), // ₹240
    otherFeesPaise: BigInt(0),
  })

  assert.equal(result.installments.length, 12)
  assert.equal(result.totalInterest, BigInt(144_000)) // ₹1,440
  assert.equal(result.totalFees, BigInt(24_000)) // ₹240
  assert.equal(result.totalRepayable, BigInt(1_368_000)) // ₹13,680
  assert.equal(result.installmentAmount, BigInt(114_000)) // ₹1,140/month
  assert.equal(result.installments[11].closingPrincipal, BigInt(0))
})

// 3. Schedule Generation: Odd Division Remainder Absorption on Final Installment
test('generateSchedule absorbs principal, interest, and fee remainders on the final installment', () => {
  const result = generateSchedule({
    principalPaise: BigInt(1_000_000), // ₹10,000 over 3 months -> 333333, 333333, 333334
    interestType: 'FIXED',
    interestRateBps: BigInt(0),
    fixedInterestPaise: BigInt(10_000), // ₹100 over 3 months -> 3333, 3333, 3334
    frequency: 'MONTHLY',
    installments: 3,
    firstDueDate: new Date('2026-01-10T00:00:00.000Z'),
    processingFeePaise: BigInt(5_000), // ₹50 over 3 months -> 1666, 1666, 1668
    otherFeesPaise: BigInt(0),
  })

  assert.equal(result.installments.length, 3)
  assert.equal(result.installments[0].principalComponent, BigInt(333_333))
  assert.equal(result.installments[1].principalComponent, BigInt(333_333))
  assert.equal(result.installments[2].principalComponent, BigInt(333_334))

  assert.equal(result.installments[0].interestComponent, BigInt(3_333))
  assert.equal(result.installments[2].interestComponent, BigInt(3_334))

  assert.equal(result.installments[0].feesComponent, BigInt(1_666))
  assert.equal(result.installments[2].feesComponent, BigInt(1_668))

  const sumPrincipal = result.installments.reduce((acc, i) => acc + i.principalComponent, BigInt(0))
  const sumInterest = result.installments.reduce((acc, i) => acc + i.interestComponent, BigInt(0))
  const sumFees = result.installments.reduce((acc, i) => acc + i.feesComponent, BigInt(0))

  assert.equal(sumPrincipal, BigInt(1_000_000))
  assert.equal(sumInterest, BigInt(10_000))
  assert.equal(sumFees, BigInt(5_000))
  assert.equal(result.totalRepayable, BigInt(1_015_000))
  assert.equal(result.installments[2].closingPrincipal, BigInt(0))
})

// 4. Schedule Generation: Zero Interest Loan
test('generateSchedule handles 0% NONE interest loans accurately', () => {
  const result = generateSchedule({
    principalPaise: BigInt(500_000), // ₹5,000
    interestType: 'NONE',
    interestRateBps: BigInt(0),
    fixedInterestPaise: BigInt(0),
    frequency: 'WEEKLY',
    installments: 5,
    firstDueDate: new Date('2026-03-01T00:00:00.000Z'),
    processingFeePaise: BigInt(0),
    otherFeesPaise: BigInt(0),
  })

  assert.equal(result.totalInterest, BigInt(0))
  assert.equal(result.totalFees, BigInt(0))
  assert.equal(result.totalRepayable, BigInt(500_000))
  for (const inst of result.installments) {
    assert.equal(inst.interestComponent, BigInt(0))
    assert.equal(inst.principalComponent, BigInt(100_000))
  }
})

// 5. Anchor-Day Date Arithmetic (Month-End 29/30/31 & Leap Year)
test('generateSchedule preserves anchor day across February and 30-day months without date overflow', () => {
  const nonLeap = generateSchedule({
    principalPaise: BigInt(400_000),
    interestType: 'NONE',
    interestRateBps: BigInt(0),
    fixedInterestPaise: BigInt(0),
    frequency: 'MONTHLY',
    installments: 4,
    firstDueDate: new Date(2026, 0, 31, 12, 0, 0),
    processingFeePaise: BigInt(0),
    otherFeesPaise: BigInt(0),
  })

  assert.equal(nonLeap.installments[0].dueDate.getMonth(), 0)
  assert.equal(nonLeap.installments[0].dueDate.getDate(), 31)
  assert.equal(nonLeap.installments[1].dueDate.getMonth(), 1)
  assert.equal(nonLeap.installments[1].dueDate.getDate(), 28)
  assert.equal(nonLeap.installments[2].dueDate.getMonth(), 2)
  assert.equal(nonLeap.installments[2].dueDate.getDate(), 31)
  assert.equal(nonLeap.installments[3].dueDate.getMonth(), 3)
  assert.equal(nonLeap.installments[3].dueDate.getDate(), 30)

  const leap = generateSchedule({
    principalPaise: BigInt(200_000),
    interestType: 'NONE',
    interestRateBps: BigInt(0),
    fixedInterestPaise: BigInt(0),
    frequency: 'MONTHLY',
    installments: 2,
    firstDueDate: new Date(2028, 0, 31, 12, 0, 0),
    processingFeePaise: BigInt(0),
    otherFeesPaise: BigInt(0),
  })
  assert.equal(leap.installments[1].dueDate.getMonth(), 1)
  assert.equal(leap.installments[1].dueDate.getDate(), 29)
})

// 6. Payment Allocation Waterfall (Fees -> Interest -> Principal)
test('allocatePayment enforces strict Fees -> Interest -> Principal waterfall across installments', () => {
  const schedule: InstallmentState[] = [
    {
      installmentNumber: 1,
      fees: BigInt(10_000),
      interest: BigInt(20_000),
      principal: BigInt(100_000),
      paidFees: BigInt(0),
      paidInterest: BigInt(0),
      paidPrincipal: BigInt(0),
    },
    {
      installmentNumber: 2,
      fees: BigInt(10_000),
      interest: BigInt(20_000),
      principal: BigInt(100_000),
      paidFees: BigInt(0),
      paidInterest: BigInt(0),
      paidPrincipal: BigInt(0),
    },
  ]

  const partial1 = allocatePayment(schedule, BigInt(25_000))
  assert.equal(partial1.allocatedFees, BigInt(10_000))
  assert.equal(partial1.allocatedInterest, BigInt(15_000))
  assert.equal(partial1.allocatedPrincipal, BigInt(0))
  assert.equal(partial1.unallocated, BigInt(0))
  assert.equal(partial1.perInstallment.length, 1)

  schedule[0].paidFees += partial1.allocatedFees
  schedule[0].paidInterest += partial1.allocatedInterest
  schedule[0].paidPrincipal += partial1.allocatedPrincipal

  const partial2 = allocatePayment(schedule, BigInt(120_000))
  assert.equal(partial2.allocatedFees, BigInt(10_000))
  assert.equal(partial2.allocatedInterest, BigInt(10_000))
  assert.equal(partial2.allocatedPrincipal, BigInt(100_000))
  assert.equal(partial2.unallocated, BigInt(0))
  assert.equal(partial2.perInstallment.length, 2)
})

// 7. Overpayment Clamping
test('allocatePayment reports excess amount as unallocated when payment exceeds total outstanding', () => {
  const schedule: InstallmentState[] = [
    {
      installmentNumber: 1,
      fees: BigInt(0),
      interest: BigInt(10_000),
      principal: BigInt(90_000),
      paidFees: BigInt(0),
      paidInterest: BigInt(0),
      paidPrincipal: BigInt(0),
    },
  ]

  const res = allocatePayment(schedule, BigInt(115_000))
  assert.equal(res.allocatedInterest, BigInt(10_000))
  assert.equal(res.allocatedPrincipal, BigInt(90_000))
  assert.equal(res.unallocated, BigInt(15_000))
})

// 8. Frontend Preview Parity with Server Engine
test('frontend generateSchedulePreview matches backend generateSchedule', () => {
  const input = {
    principalPaise: BigInt(750_000),
    interestType: 'PERCENTAGE' as const,
    interestRateBps: BigInt(350),
    fixedInterestPaise: BigInt(0),
    frequency: 'MONTHLY' as const,
    installments: calculateInstallmentsFromTenure(7, 'MONTHLY'),
    firstDueDate: new Date('2026-04-01T00:00:00.000Z'),
    processingFeePaise: BigInt(15_000),
    otherFeesPaise: BigInt(2_500),
  }

  const serverSchedule = generateSchedule(input)
  const clientPreview = generateSchedulePreview(input)

  assert.equal(clientPreview.totalRepayable, serverSchedule.totalRepayable)
  assert.equal(clientPreview.totalInterest, serverSchedule.totalInterest)
  assert.equal(clientPreview.totalFees, serverSchedule.totalFees)
  assert.equal(clientPreview.installmentAmount, serverSchedule.installmentAmount)
  assert.equal(clientPreview.installments.length, serverSchedule.installments.length)
})

// 9. AES-256-GCM PII Encryption, Decryption, SHA-256 Hashing & Key Rotation
test('AES-256-GCM encryptPII, decryptPII, hashPII, and dual-key rotation work accurately', () => {
  const rawAadhaar = '987654321098'
  const cipher = encryptPII(rawAadhaar)
  assert.ok(cipher.startsWith('enc:v1:'))
  assert.notEqual(cipher, rawAadhaar)
  // Idempotent on already-encrypted strings
  assert.equal(encryptPII(cipher), cipher)
  assert.equal(decryptPII(cipher), rawAadhaar)

  // Key rotation test with PII_ENCRYPTION_KEY_PREVIOUS
  const oldKey = process.env.PII_ENCRYPTION_KEY || 'old-key-secret-value-for-unit-test'
  process.env.PII_ENCRYPTION_KEY = oldKey
  const cipherWithOld = encryptPII('ABCDE1234F')
  process.env.PII_ENCRYPTION_KEY_PREVIOUS = oldKey
  process.env.PII_ENCRYPTION_KEY = 'new-rotated-primary-encryption-key-2026'
  assert.equal(decryptPII(cipherWithOld), 'ABCDE1234F')
  const reEncrypted = rotateEncryptedPII(cipherWithOld)
  assert.equal(decryptPII(reEncrypted), 'ABCDE1234F')

  // Keyed HMAC-SHA256 hash
  process.env.AADHAAR_HASH_PEPPER = 'test-pepper-32-chars-long-or-more-for-testing'
  const hash1 = hashPII(rawAadhaar)
  assert.equal(hash1.length, 64)
  assert.equal(hash1, hashPII(rawAadhaar)) // Deterministic
  process.env.AADHAAR_HASH_PEPPER = 'different-pepper-32-chars-long-or-more-for-testing'
  const hash2 = hashPII(rawAadhaar)
  assert.notEqual(hash1, hash2) // Changes when pepper changes
})

// 10. Server-Side PII Masking Helpers
test('maskAadhaar, maskPan, and maskBankAccount never leak raw identifiers', () => {
  assert.equal(maskAadhaar('654321098765'), 'XXXX-XXXX-8765')
  assert.equal(maskPan('KLMNO5678P'), 'KLXXX5678P')
  assert.equal(maskBankAccount('309988776655'), 'XXXX-XXXX-6655')
})

// 11. OWASP XSS Sanitization, Prototype Pollution & Depth Guard
test('sanitizeText and sanitizeJsonPayload neutralize XSS and prototype pollution', () => {
  const malicious = `<script>alert(1)</script><img src=x onerror="fetch('https://evil.com')">Hello <b>Vikram</b> javascript:alert(2)`
  const cleaned = sanitizeText(malicious)
  assert.ok(!cleaned.includes('<script'))
  assert.ok(!cleaned.includes('onerror'))
  assert.ok(!cleaned.includes('javascript:'))
  assert.ok(cleaned.includes('Vikram'))

  const polluted = JSON.parse('{"name":"Test","__proto":{"polluted":true},"constructor":{"prototype":{"isAdmin":true}}}')
  const sanitizedObj = sanitizeJsonPayload(polluted) as Record<string, unknown>
  assert.equal(sanitizedObj.name, 'Test')
  assert.equal(Object.prototype.hasOwnProperty.call(sanitizedObj, 'constructor'), false)
})

// 12. Open Redirect & Magic-Byte File Validation / EXIF Stripping
test('validateSafeRedirect blocks external URLs and detectMagicBytesMime + stripImageMetadata work', () => {
  assert.equal(validateSafeRedirect('/portal/loans'), '/portal/loans')
  assert.equal(validateSafeRedirect('//evil.com/phish'), '/')
  assert.equal(validateSafeRedirect('https://evil.com'), '/')
  assert.equal(validateSafeRedirect('javascript:alert(1)'), '/')

  // Minimal JPEG header with APP1 (EXIF) segment (FF E1 00 08 45 78 69 66 00 00) followed by SOS (FF DA) and EOI (FF D9)
  const jpegWithExif = Buffer.from([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, // APP0
    0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1 EXIF segment
    0xff, 0xda, 0x01, 0x02, 0xff, 0xd9, // SOS + image bytes + EOI
  ])
  assert.equal(detectMagicBytesMime(jpegWithExif), 'image/jpeg')
  const stripped = stripImageMetadata(jpegWithExif, 'image/jpeg')
  assert.ok(stripped.length < jpegWithExif.length)
  assert.ok(!stripped.includes(Buffer.from('Exif')))

  const fakeExe = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff')
  assert.equal(detectMagicBytesMime(fakeExe), null)
})

let passed = 0
async function runTests() {
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
  console.log(`\nAll ${passed}/${tests.length} financial & security unit tests passed.`)
}
runTests()

// 13. Logger Redaction
test('logger redaction prevents sensitive data leakage to stdout', async () => {
  const { logger } = await import('../../src/lib/server/logger')
  
  // Intercept stdout
  const originalStdoutWrite = process.stdout.write.bind(process.stdout)
  let captured = ''
  process.stdout.write = (chunk: any) => {
    captured += chunk.toString()
    return true
  }

  try {
    logger.info('Test sensitive log', {
      aadhaar: '123456789012',
      pan: 'ABCDE1234F',
      bankAccount: '999988887777',
      password: 'my-super-secret',
    })
  } finally {
    process.stdout.write = originalStdoutWrite
  }

  assert.ok(!captured.includes('123456789012'), 'Aadhaar leaked!')
  assert.ok(!captured.includes('ABCDE1234F'), 'PAN leaked!')
  assert.ok(!captured.includes('999988887777'), 'Bank leaked!')
  assert.ok(!captured.includes('my-super-secret'), 'Password leaked!')
  assert.ok(captured.includes('[REDACTED]'), 'Should contain [REDACTED]')
})
