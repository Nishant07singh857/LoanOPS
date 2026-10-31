import assert from 'node:assert/strict'
import {
  getRedis,
  isRedisConfigured,
  setRedisClientForTests,
  withCache,
  type RedisClientLike,
} from '../../src/lib/server/redis'
import {
  checkRateLimit,
  type RateLimitPolicy,
  type RateLimitResult,
} from '../../src/lib/server/rate-limit'
import {
  checkLoginRate,
  recordLoginFailure,
  clearLoginFailures,
} from '../../src/lib/server/auth'

interface TestCase {
  name: string
  fn: () => void | Promise<void>
}

const tests: TestCase[] = []
function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

// In-memory fake implementing the Redis command surface the app uses,
// with real TTL bookkeeping so window semantics can be asserted.
class FakeRedis implements RedisClientLike {
  private values = new Map<string, unknown>()
  private counters = new Map<string, number>()
  private expiresAt = new Map<string, number>()

  async get<T = unknown>(key: string): Promise<T | null> {
    if (this.isExpired(key)) return null
    return (this.values.get(key) as T) ?? null
  }
  async set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown> {
    this.values.set(key, value)
    if (opts?.ex) this.expiresAt.set(key, Date.now() + opts.ex * 1000)
    return 'OK'
  }
  async incr(key: string): Promise<number> {
    if (this.isExpired(key)) {
      this.counters.delete(key)
      this.expiresAt.delete(key)
    }
    const next = (this.counters.get(key) ?? 0) + 1
    this.counters.set(key, next)
    return next
  }
  async expire(key: string, seconds: number): Promise<unknown> {
    this.expiresAt.set(key, Date.now() + seconds * 1000)
    return 1
  }
  async ttl(key: string): Promise<number> {
    const at = this.expiresAt.get(key)
    if (at === undefined) return -1
    return Math.max(0, Math.ceil((at - Date.now()) / 1000))
  }
  private hashes = new Map<string, Record<string, string>>()
  async hgetall(key: string): Promise<Record<string, string> | null> {
    if (this.isExpired(key)) {
      this.hashes.delete(key)
      return null
    }
    const h = this.hashes.get(key)
    return h ? { ...h } : null
  }
  async hset(key: string, values: Record<string, string | number>): Promise<unknown> {
    const h = this.hashes.get(key) ?? {}
    for (const [f, v] of Object.entries(values)) h[f] = String(v)
    this.hashes.set(key, h)
    return Object.keys(values).length
  }
  async del(key: string): Promise<unknown> {
    this.values.delete(key)
    this.counters.delete(key)
    this.hashes.delete(key)
    this.expiresAt.delete(key)
    return 1
  }
  private isExpired(key: string): boolean {
    const at = this.expiresAt.get(key)
    return at !== undefined && at <= Date.now()
  }
}

class ThrowingRedis implements RedisClientLike {
  async get<T = unknown>(): Promise<T | null> {
    throw new Error('redis down')
  }
  async set(): Promise<unknown> {
    throw new Error('redis down')
  }
  async incr(): Promise<number> {
    throw new Error('redis down')
  }
  async expire(): Promise<unknown> {
    throw new Error('redis down')
  }
  async ttl(): Promise<number> {
    throw new Error('redis down')
  }
  async hgetall(): Promise<Record<string, string> | null> {
    throw new Error('redis down')
  }
  async hset(): Promise<unknown> {
    throw new Error('redis down')
  }
  async del(): Promise<unknown> {
    throw new Error('redis down')
  }
}

const savedUrl = process.env.UPSTASH_REDIS_REST_URL
const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN
function clearRedisEnv() {
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
}
function restoreRedisEnv() {
  if (savedUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL
  else process.env.UPSTASH_REDIS_REST_URL = savedUrl
  if (savedToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
  else process.env.UPSTASH_REDIS_REST_TOKEN = savedToken
  setRedisClientForTests(undefined)
}

// ============================================================
// 1. Redis client resolution — lazy, null without env
// ============================================================

test('getRedis returns null when Upstash env vars are not set', () => {
  clearRedisEnv()
  setRedisClientForTests(undefined)
  assert.equal(isRedisConfigured(), false)
  assert.equal(getRedis(), null)
  restoreRedisEnv()
})

test('getRedis constructs a client when both env vars are set', () => {
  clearRedisEnv()
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token-not-a-secret'
  setRedisClientForTests(undefined)
  assert.equal(isRedisConfigured(), true)
  const client = getRedis()
  assert.notEqual(client, null)
  // Lazily created once: the same instance is returned on repeat calls.
  assert.equal(getRedis(), client)
  restoreRedisEnv()
})

// ============================================================
// 2. withCache — dashboard cache behavior, fail-open
// ============================================================

test('withCache runs the fetcher on every call when Redis is absent', async () => {
  setRedisClientForTests(null)
  let calls = 0
  const fetcher = async () => ({ n: ++calls })
  assert.deepEqual(await withCache('k', 30, fetcher), { n: 1 })
  assert.deepEqual(await withCache('k', 30, fetcher), { n: 2 })
})

test('withCache serves the second call from cache and keys are isolated per org', async () => {
  setRedisClientForTests(new FakeRedis())
  let calls = 0
  const fetcher = async () => ({ n: ++calls })
  // Mirrors the dashboard route: key embeds the org id, TTL 30s.
  assert.deepEqual(await withCache('dashboard-kpis:org-a', 30, fetcher), { n: 1 })
  assert.deepEqual(await withCache('dashboard-kpis:org-a', 30, fetcher), { n: 1 })
  assert.equal(calls, 1)
  // A different org must never be served org-a's cached payload.
  assert.deepEqual(await withCache('dashboard-kpis:org-b', 30, fetcher), { n: 2 })
})

test('withCache fails open when Redis errors on read', async () => {
  setRedisClientForTests(new ThrowingRedis())
  let calls = 0
  const fetcher = async () => ({ n: ++calls })
  assert.deepEqual(await withCache('k', 30, fetcher), { n: 1 })
  // Read throws and write throws are both swallowed; the value still returns.
  assert.deepEqual(await withCache('k', 30, fetcher), { n: 2 })
})

// ============================================================
// 3. Rate limiting — identical allow/block pattern on both backends
// ============================================================

const POLICY: RateLimitPolicy = { maxRequests: 3, windowMs: 60_000 }

async function runSequence(key: string): Promise<RateLimitResult[]> {
  const results: RateLimitResult[] = []
  for (let i = 0; i < 5; i++) {
    results.push(await checkRateLimit('auth_login', [key], POLICY))
  }
  return results
}

test('rate limit (in-memory fallback) allows maxRequests then blocks', async () => {
  setRedisClientForTests(null)
  const results = await runSequence('memory-user@example.com')
  assert.deepEqual(
    results.map((r) => r.ok),
    [true, true, true, false, false]
  )
  assert.deepEqual(
    results.map((r) => r.remaining),
    [2, 1, 0, 0, 0]
  )
  const blocked = results[3]
  assert.ok(blocked.retryAfterSeconds >= 1 && blocked.retryAfterSeconds <= 60)
  assert.equal(blocked.limit, 3)
})

test('rate limit (mocked Redis) enforces the identical pattern', async () => {
  setRedisClientForTests(new FakeRedis())
  const results = await runSequence('redis-user@example.com')
  assert.deepEqual(
    results.map((r) => r.ok),
    [true, true, true, false, false]
  )
  assert.deepEqual(
    results.map((r) => r.remaining),
    [2, 1, 0, 0, 0]
  )
  const blocked = results[3]
  assert.ok(blocked.retryAfterSeconds >= 1 && blocked.retryAfterSeconds <= 60)
  assert.equal(blocked.limit, 3)
  // Buckets are per key: a different account on the same backend is unaffected.
  const other = await checkRateLimit('auth_login', ['someone-else@example.com'], POLICY)
  assert.equal(other.ok, true)
})

test('rate limit fails open to in-memory enforcement when Redis throws', async () => {
  setRedisClientForTests(new ThrowingRedis())
  const results = await runSequence('failopen-user@example.com')
  // Redis errored on every call, yet the policy is still fully enforced
  // by the in-memory fallback (limits never weaken on the fail-open path).
  assert.deepEqual(
    results.map((r) => r.ok),
    [true, true, true, false, false]
  )
  setRedisClientForTests(undefined)
})

// ============================================================
// 4. Login lockout counters — identical behavior on both backends
// ============================================================

type LoginRateState = { ok: boolean; retryAfterMs?: number; attempts?: number }

async function runLockoutSequence(key: string): Promise<LoginRateState[]> {
  const states: LoginRateState[] = []
  for (let i = 0; i < 5; i++) {
    await recordLoginFailure(key)
    states.push(await checkLoginRate(key))
  }
  return states
}

test('login lockout (in-memory fallback) locks after 5 failures for 15 minutes', async () => {
  setRedisClientForTests(null)
  const key = '10.0.0.1:memory-lock@example.com'
  const states = await runLockoutSequence(key)
  // First 4 failures: still allowed, attempts count up.
  assert.deepEqual(
    states.slice(0, 4).map((s) => s.ok),
    [true, true, true, true]
  )
  assert.deepEqual(
    states.slice(0, 4).map((s) => s.attempts),
    [1, 2, 3, 4]
  )
  // 5th failure trips the lockout.
  assert.equal(states[4].ok, false)
  assert.ok(states[4].retryAfterMs! > 0 && states[4].retryAfterMs! <= 15 * 60 * 1000)
  // A success clears the counter entirely.
  await clearLoginFailures(key)
  const after = await checkLoginRate(key)
  assert.equal(after.ok, true)
  assert.equal(after.attempts, 0)
})

test('login lockout (mocked Redis) locks after 5 failures for 15 minutes', async () => {
  setRedisClientForTests(new FakeRedis())
  const key = '10.0.0.2:redis-lock@example.com'
  const states = await runLockoutSequence(key)
  assert.deepEqual(
    states.slice(0, 4).map((s) => s.ok),
    [true, true, true, true]
  )
  assert.deepEqual(
    states.slice(0, 4).map((s) => s.attempts),
    [1, 2, 3, 4]
  )
  assert.equal(states[4].ok, false)
  assert.ok(states[4].retryAfterMs! > 0 && states[4].retryAfterMs! <= 15 * 60 * 1000)
  await clearLoginFailures(key)
  const after = await checkLoginRate(key)
  assert.equal(after.ok, true)
  assert.equal(after.attempts, 0)
  // Counters are per key: another account from the same IP is unaffected.
  const other = await checkLoginRate('10.0.0.2:someone-else@example.com')
  assert.equal(other.ok, true)
})

test('login lockout fails open to in-memory enforcement when Redis throws', async () => {
  setRedisClientForTests(new ThrowingRedis())
  const key = '10.0.0.3:failopen-lock@example.com'
  const states = await runLockoutSequence(key)
  assert.equal(states[4].ok, false)
  assert.ok(states[4].retryAfterMs! > 0 && states[4].retryAfterMs! <= 15 * 60 * 1000)
  setRedisClientForTests(undefined)
})

// ============================================================
// RUNNER
// ============================================================

async function runTests() {
  console.log(`\nRunning ${tests.length} redis/rate-limit unit tests...\n`)
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
  console.log(`\nAll ${passed}/${tests.length} redis/rate-limit unit tests passed.`)
}
runTests()
