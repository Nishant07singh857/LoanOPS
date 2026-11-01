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

// src/lib/server/auth.ts transitively imports the app's DB module, which
// validates the environment and requires a database URL at import time.
// CI's unit-test step runs with a reduced env (no database variables), so
// seed obviously-fake values here and load auth lazily inside the runner —
// the same lazy-import pattern reminders.test.ts uses for its DB-touching
// server modules. Real environment values always win (??=), and the
// lockout counters under test never query the database, so the fake URL
// is never connected to. It is assembled at runtime so that no
// connection-string-shaped literal sits in the source tree.
const FAKE_DB_URL = ['postgres', '://unit-test@', 'localhost:5432/', 'unit_tests_only'].join('')
process.env.DATABASE_URL ??= FAKE_DB_URL
process.env.DATABASE_URL_TEST ??= FAKE_DB_URL
process.env.AADHAAR_HASH_PEPPER ??= 'unit-test-aadhaar-pepper-0000000000000000'

type AuthModule = typeof import('../../src/lib/server/auth')
let checkLoginRate: AuthModule['checkLoginRate']
let recordLoginFailure: AuthModule['recordLoginFailure']
let clearLoginFailures: AuthModule['clearLoginFailures']

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
  async hincrby(key: string, field: string, increment: number): Promise<number> {
    if (this.isExpired(key)) {
      this.hashes.delete(key)
      this.expiresAt.delete(key)
    }
    const h = this.hashes.get(key) ?? {}
    const next = (Number.parseInt(h[field] ?? '0', 10) || 0) + increment
    h[field] = String(next)
    this.hashes.set(key, h)
    return next
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
  async hincrby(): Promise<number> {
    throw new Error('redis down')
  }
  async del(): Promise<unknown> {
    throw new Error('redis down')
  }
}

// Simulates the pathological partial failure behind tester note N1: the
// window-arming EXPIRE (first call) is silently lost — the key is left
// without a TTL but no error surfaces — and the later re-arm EXPIRE
// throws. The block verdict reached from the count must still stand.
class RearmThrowingRedis extends FakeRedis {
  private expireCalls = 0
  async expire(_key: string, _seconds: number): Promise<unknown> {
    this.expireCalls += 1
    if (this.expireCalls === 1) return 0 // lost, silently
    throw new Error('expire re-arm failed')
  }
}

/** Reads the base URL a constructed Upstash client was configured with. */
function resolvedBaseUrl(client: RedisClientLike | null): string | null {
  if (!client) return null
  const inner = (client as unknown as { client?: { baseUrl?: string } }).client
  return inner?.baseUrl ?? null
}

const savedUrl = process.env.UPSTASH_REDIS_REST_URL
const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN
const savedKvUrl = process.env.KV_REST_API_URL
const savedKvToken = process.env.KV_REST_API_TOKEN
function clearRedisEnv() {
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
}
function restoreRedisEnv() {
  if (savedUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL
  else process.env.UPSTASH_REDIS_REST_URL = savedUrl
  if (savedToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
  else process.env.UPSTASH_REDIS_REST_TOKEN = savedToken
  if (savedKvUrl === undefined) delete process.env.KV_REST_API_URL
  else process.env.KV_REST_API_URL = savedKvUrl
  if (savedKvToken === undefined) delete process.env.KV_REST_API_TOKEN
  else process.env.KV_REST_API_TOKEN = savedKvToken
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

test('getRedis resolves the Vercel-KV alias names when UPSTASH_* are unset', () => {
  // The Vercel Marketplace Upstash integration injects the credentials
  // under the legacy Vercel KV names; production must pick them up.
  clearRedisEnv()
  process.env.KV_REST_API_URL = 'https://kv-alias.upstash.io'
  process.env.KV_REST_API_TOKEN = 'kv-token-not-a-secret'
  setRedisClientForTests(undefined)
  assert.equal(isRedisConfigured(), true)
  const client = getRedis()
  assert.notEqual(client, null)
  assert.equal(resolvedBaseUrl(client), 'https://kv-alias.upstash.io')
  restoreRedisEnv()
})

test('getRedis prefers UPSTASH_* over the KV_* aliases when both are set', () => {
  clearRedisEnv()
  process.env.UPSTASH_REDIS_REST_URL = 'https://direct.upstash.io'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'direct-token-not-a-secret'
  process.env.KV_REST_API_URL = 'https://kv-alias.upstash.io'
  process.env.KV_REST_API_TOKEN = 'kv-token-not-a-secret'
  setRedisClientForTests(undefined)
  assert.equal(isRedisConfigured(), true)
  const client = getRedis()
  assert.notEqual(client, null)
  assert.equal(resolvedBaseUrl(client), 'https://direct.upstash.io')
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

test('rate limit block stands when the expiry re-arm EXPIRE fails (N1)', async () => {
  setRedisClientForTests(new RearmThrowingRedis())
  const results = await runSequence('rearm-user@example.com')
  // The re-arm EXPIRE throws on the blocked checks, yet the verdict
  // reached from the Redis count must NOT be discarded into the lagging
  // in-memory limiter: the allow/block pattern matches a healthy Redis.
  assert.deepEqual(
    results.map((r) => r.ok),
    [true, true, true, false, false]
  )
  const blocked = results[3]
  assert.ok(blocked.retryAfterSeconds >= 1 && blocked.retryAfterSeconds <= 60)
  assert.equal(blocked.limit, 3)
  setRedisClientForTests(undefined)
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

test('login lockout (mocked Redis) counts concurrent failures atomically (N2)', async () => {
  setRedisClientForTests(new FakeRedis())
  const key = '10.0.0.4:concurrent-lock@example.com'
  // Four failures fired at once: the old read-modify-write counter
  // interleaved these and lost increments; the HINCRBY counter must
  // count every one, exactly as a sequential burst does.
  await Promise.all([
    recordLoginFailure(key),
    recordLoginFailure(key),
    recordLoginFailure(key),
    recordLoginFailure(key),
  ])
  const after4 = await checkLoginRate(key)
  assert.equal(after4.ok, true)
  assert.equal(after4.attempts, 4)
  // The fifth failure trips the lock, same as the sequential sequence.
  await recordLoginFailure(key)
  const after5 = await checkLoginRate(key)
  assert.equal(after5.ok, false)
  assert.ok(after5.retryAfterMs! > 0 && after5.retryAfterMs! <= 15 * 60 * 1000)
  setRedisClientForTests(undefined)
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
  // Load the auth module only now that the dummy env above is seeded;
  // its import chain (DB client + env validation) requires those values.
  const auth = await import('../../src/lib/server/auth')
  checkLoginRate = auth.checkLoginRate
  recordLoginFailure = auth.recordLoginFailure
  clearLoginFailures = auth.clearLoginFailures

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
