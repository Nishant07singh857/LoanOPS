import assert from 'node:assert/strict'
import { agentCandidateListWhere } from '../../src/lib/agent-candidates'

interface TestCase {
  name: string
  fn: () => void | Promise<void>
}

const tests: TestCase[] = []
function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

const ORG = 'org-1'
const ME = 'agent-profile-001'
const OTHER = 'agent-profile-002'

// ============================================================
// 1. Structure — the where clause pins org + (mine OR pool)
// ============================================================

test('where pins the organisation and the mine-or-pool scope', () => {
  const where = agentCandidateListWhere({ organizationId: ORG, agentProfileId: ME })
  assert.equal(where.organizationId, ORG)
  assert.deepEqual(where.AND, [
    { OR: [{ assignedAgentId: ME }, { assignedAgentId: null }] },
  ])
})

test('no search clause is added when search is empty or omitted', () => {
  for (const search of [undefined, '']) {
    const where = agentCandidateListWhere({ organizationId: ORG, agentProfileId: ME, search })
    assert.equal((where.AND as unknown[]).length, 1)
  }
})

test('search is ANDed after the scope, never widening it', () => {
  const where = agentCandidateListWhere({ organizationId: ORG, agentProfileId: ME, search: 'priya' })
  const and = where.AND as Record<string, unknown>[]
  assert.equal(and.length, 2)
  // Scope stays the first AND clause, byte-identical to the no-search case.
  assert.deepEqual(and[0], { OR: [{ assignedAgentId: ME }, { assignedAgentId: null }] })
  assert.deepEqual(and[1], {
    OR: [
      { fullName: { contains: 'priya', mode: 'insensitive' } },
      { mobile: { contains: 'priya' } },
    ],
  })
})

test('the scope references only the requesting agent id', () => {
  const where = agentCandidateListWhere({ organizationId: ORG, agentProfileId: ME, search: 'x' })
  assert.ok(!JSON.stringify(where).includes(OTHER))
})

// ============================================================
// 2. Semantics — evaluate the where against fixture rows
// ============================================================

interface Row {
  organizationId: string
  assignedAgentId: string | null
  fullName: string
  mobile: string
}

// Minimal evaluator for exactly the where-shape the builder emits:
// top-level equality, AND/OR arrays, assignedAgentId equality,
// fullName/mobile substring (fullName honouring mode:'insensitive').
function matches(where: Record<string, any>, row: Row): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'AND') {
      if (!(cond as any[]).every((c) => matches(c, row))) return false
    } else if (key === 'OR') {
      if (!(cond as any[]).some((c) => matches(c, row))) return false
    } else if (key === 'fullName' || key === 'mobile') {
      const value = row[key]
      const needle = cond.contains as string
      const hit =
        cond.mode === 'insensitive'
          ? value.toLowerCase().includes(needle.toLowerCase())
          : value.includes(needle)
      if (!hit) return false
    } else {
      if ((row as unknown as Record<string, unknown>)[key] !== cond) return false
    }
  }
  return true
}

const ROWS: Record<string, Row> = {
  mine: { organizationId: ORG, assignedAgentId: ME, fullName: 'Priya Sharma', mobile: '9820277789' },
  pool: { organizationId: ORG, assignedAgentId: null, fullName: 'Rahul Verma', mobile: '9820322119' },
  others: { organizationId: ORG, assignedAgentId: OTHER, fullName: 'Karthik Rao', mobile: '9820922448' },
  otherOrgMine: { organizationId: 'org-2', assignedAgentId: ME, fullName: 'Meera Iyer', mobile: '9811111111' },
  otherOrgPool: { organizationId: 'org-2', assignedAgentId: null, fullName: 'Asha Nair', mobile: '9822222222' },
}

function visible(search?: string): string[] {
  const where = agentCandidateListWhere({ organizationId: ORG, agentProfileId: ME, search }) as Record<string, any>
  return Object.entries(ROWS)
    .filter(([, row]) => matches(where, row))
    .map(([name]) => name)
    .sort()
}

test('pool visible, mine visible, other agent\u2019s absent, other org absent', () => {
  assert.deepEqual(visible(), ['mine', 'pool'])
})

test('search narrows within the scope and cannot leak across it', () => {
  // Pool candidate found by name (case-insensitive).
  assert.deepEqual(visible('rahul'), ['pool'])
  // My candidate found by mobile fragment.
  assert.deepEqual(visible('277789'), ['mine'])
  // The other agent's candidate matches the search but stays hidden.
  assert.deepEqual(visible('karthik'), [])
  assert.deepEqual(visible('9820'), ['mine', 'pool'])
})

// ============================================================
// RUNNER
// ============================================================

async function runTests() {
  console.log(`\nRunning ${tests.length} agent-candidates unit tests...\n`)
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
  console.log(`\nAll ${passed}/${tests.length} agent-candidates unit tests passed.`)
}
runTests()
