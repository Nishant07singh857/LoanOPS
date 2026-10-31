// Optional Upstash Redis client — single shared access point.
//
// Redis is an ACCELERATOR, never a dependency:
// - The client is created lazily on first use and is `null` unless BOTH
//   UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
// - Every call site must fail open: when Redis is absent or any command
//   errors, callers fall back to the non-Redis behavior (in-memory rate
//   limiting, direct DB queries). Local dev and CI run with no Redis
//   configured and behave identically to a Redis-less production deploy.
//
// This module replaces the old eager client in src/lib/redis.ts, which
// constructed a client with placeholder values at import time and logged
// a warning on every cold start / build when Redis was not configured.

import { Redis } from '@upstash/redis'
import { logger } from '@/lib/server/logger'

/**
 * Minimal command surface the app relies on. Declared as an interface so
 * unit tests can inject an in-memory fake without a live Redis.
 */
export interface RedisClientLike {
  get<T = unknown>(key: string): Promise<T | null>
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<unknown>
  ttl(key: string): Promise<number>
  hgetall(key: string): Promise<Record<string, string> | null>
  hset(key: string, values: Record<string, string | number>): Promise<unknown>
  del(key: string): Promise<unknown>
}

// `undefined` = not resolved yet, `null` = resolved to "no Redis".
let resolvedClient: RedisClientLike | null | undefined

/** True when both Upstash env vars are present (does not construct a client). */
export function isRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * Lazily creates (once) and returns the shared Redis client, or `null`
 * when Redis is not configured / cannot be constructed. Never throws.
 */
export function getRedis(): RedisClientLike | null {
  if (resolvedClient !== undefined) return resolvedClient

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    resolvedClient = null
    return resolvedClient
  }

  try {
    resolvedClient = new Redis({ url, token }) as unknown as RedisClientLike
  } catch (err) {
    logger.warn('Redis client construction failed; continuing without Redis', { error: err })
    resolvedClient = null
  }
  return resolvedClient
}

/**
 * Test hook: inject a fake client (or `null` to force the no-Redis path,
 * or `undefined` to re-resolve from env). Not used by application code.
 */
export function setRedisClientForTests(client: RedisClientLike | null | undefined): void {
  resolvedClient = client
}

/**
 * Read-through cache helper. Fail-open in both directions:
 * - no Redis / read error / miss -> runs `fetcher()`
 * - write error -> the fetched value is still returned
 * A throwing `fetcher()` propagates (same contract as the previous helper).
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const redis = getRedis()
  if (!redis) return fetcher()

  try {
    const cached = await redis.get<T>(key)
    if (cached !== null && cached !== undefined) {
      return cached
    }
  } catch (err) {
    logger.warn('Redis cache read failed; falling back to direct fetch', { key, error: err })
  }

  const data = await fetcher()

  if (ttlSeconds > 0) {
    try {
      await redis.set(key, data, { ex: ttlSeconds })
    } catch (err) {
      logger.warn('Redis cache write failed; returning uncached value', { key, error: err })
    }
  }

  return data
}
