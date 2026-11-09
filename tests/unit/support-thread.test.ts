import assert from 'node:assert/strict'
import {
  SUPPORT_STATUSES,
  SUPPORT_TRANSITIONS,
  SUPPORT_STATUS_BORROWER_LABELS,
  canTransitionSupportStatus,
  nextSupportStatuses,
  supportStatusBorrowerLabel,
  supportReplySchema,
  supportStatusChangeSchema,
  type SupportStatusValue,
} from '../../src/lib/support'

interface TestCase {
  name: string
  fn: () => void | Promise<void>
}

const tests: TestCase[] = []
function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

// ============================================================
// 1. Transition map — the complete 4×4 matrix, pinned exactly
// ============================================================

// The contract from the D3 brief: OPEN → IN_REVIEW, OPEN →
// RESOLVED, IN_REVIEW → RESOLVED, RESOLVED → CLOSED, RESOLVED →
// IN_REVIEW (reopen), CLOSED → terminal. Everything else is illegal.
const EXPECTED: Record<SupportStatusValue, SupportStatusValue[]> = {
  OPEN: ['IN_REVIEW', 'RESOLVED'],
  IN_REVIEW: ['RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_REVIEW'],
  CLOSED: [],
}

test('transition map matches the specified walk exactly', () => {
  for (const from of SUPPORT_STATUSES) {
    assert.deepEqual(
      [...SUPPORT_TRANSITIONS[from]].sort(),
      [...EXPECTED[from]].sort(),
      `transitions from ${from}`,
    )
    assert.deepEqual(
      [...nextSupportStatuses(from)].sort(),
      [...EXPECTED[from]].sort(),
      `nextSupportStatuses(${from})`,
    )
  }
})

test('canTransitionSupportStatus agrees on all 16 status pairs', () => {
  for (const from of SUPPORT_STATUSES) {
    for (const to of SUPPORT_STATUSES) {
      assert.equal(
        canTransitionSupportStatus(from, to),
        EXPECTED[from].includes(to),
        `${from} → ${to}`,
      )
    }
  }
})

test('CLOSED is terminal — no exits at all', () => {
  for (const to of SUPPORT_STATUSES) {
    assert.equal(canTransitionSupportStatus('CLOSED', to), false, `CLOSED → ${to}`)
  }
  assert.equal(nextSupportStatuses('CLOSED').length, 0)
})

test('no status transitions to itself', () => {
  for (const s of SUPPORT_STATUSES) {
    assert.equal(canTransitionSupportStatus(s, s), false, `${s} → ${s}`)
  }
})

test('RESOLVED can be reopened to IN_REVIEW and later closed', () => {
  assert.equal(canTransitionSupportStatus('RESOLVED', 'IN_REVIEW'), true)
  assert.equal(canTransitionSupportStatus('RESOLVED', 'CLOSED'), true)
  assert.equal(canTransitionSupportStatus('RESOLVED', 'OPEN'), false)
})

// ============================================================
// 2. Borrower-facing labels — every status has friendly wording
// ============================================================

test('every status has a borrower-friendly label', () => {
  for (const s of SUPPORT_STATUSES) {
    const label = supportStatusBorrowerLabel(s)
    assert.equal(label, SUPPORT_STATUS_BORROWER_LABELS[s])
    assert.ok(label.length > 0, `label for ${s}`)
  }
  assert.match(supportStatusBorrowerLabel('OPEN'), /waiting/i)
  assert.match(supportStatusBorrowerLabel('IN_REVIEW'), /review/i)
})

// ============================================================
// 3. Reply schema — body required, bounded, unknown keys refused
// ============================================================

test('reply schema accepts a normal reply', () => {
  const parsed = supportReplySchema.parse({ body: '  Any update on this?  ' })
  assert.equal(parsed.body, 'Any update on this?')
})

test('reply schema rejects empty and oversized bodies', () => {
  assert.throws(() => supportReplySchema.parse({ body: '' }))
  assert.throws(() => supportReplySchema.parse({ body: '   ' }))
  assert.throws(() => supportReplySchema.parse({ body: 'x'.repeat(5001) }))
  assert.throws(() => supportReplySchema.parse({}))
})

test('reply schema rejects unknown fields', () => {
  assert.throws(() => supportReplySchema.parse({ body: 'hi', status: 'CLOSED' }))
})

// ============================================================
// 4. Status-change schema — enum-bounded, resolution optional
// ============================================================

test('status-change schema accepts a move with a resolution note', () => {
  const parsed = supportStatusChangeSchema.parse({ status: 'RESOLVED', resolution: 'Refund issued' })
  assert.equal(parsed.status, 'RESOLVED')
  assert.equal(parsed.resolution, 'Refund issued')
})

test('status-change schema accepts a move without a note', () => {
  const parsed = supportStatusChangeSchema.parse({ status: 'IN_REVIEW' })
  assert.equal(parsed.resolution, undefined)
})

test('status-change schema rejects unknown statuses and fields', () => {
  assert.throws(() => supportStatusChangeSchema.parse({ status: 'PENDING' }))
  assert.throws(() => supportStatusChangeSchema.parse({ status: 'CLOSED', extra: 1 }))
  assert.throws(() => supportStatusChangeSchema.parse({ status: 'RESOLVED', resolution: 'x'.repeat(2001) }))
})

// ============================================================
// RUNNER
// ============================================================

async function runTests() {
  console.log(`\nRunning ${tests.length} support-thread unit tests...\n`)
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
  console.log(`\nAll ${passed}/${tests.length} support-thread unit tests passed.`)
}
runTests()
