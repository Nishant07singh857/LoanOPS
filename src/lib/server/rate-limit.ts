// Central Rate Limiter & Abuse Protection (Phase 4)
//
// BACKENDS: when Upstash Redis is configured (see src/lib/server/redis.ts),
// counters live in Redis (INCR + EXPIRE fixed window) and are shared across
// instances. When Redis is absent OR any Redis command fails, the limiter
// fails open to the original in-memory sliding-window buckets.
//
// HONEST LIMITATION of the fallback: in-memory buckets are PER-INSTANCE
// only — on multi-instance or serverless deployments each instance keeps
// its own buckets, so effective limits multiply by the instance count and
// reset on cold start / restart. The Redis path has no such limitation.
// Policies (limits + windows) are identical on both paths; only the
// window bookkeeping differs (fixed window on Redis, sliding window in
// memory).
//
// Client IP handling: forwarded headers (x-forwarded-for etc.) are only
// trusted when the deployment explicitly opts in via TRUST_PROXY="true" or
// by naming a header in TRUSTED_PROXY_HEADER — otherwise any client could
// spoof its IP and reset every limit at will.

import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/server/logger'
import { getRedis, type RedisClientLike } from '@/lib/server/redis'

export type RateLimitScope =
  | 'auth_login'
  | 'auth_signup'
  | 'auth_forgot_password'
  | 'auth_otp'
  | 'apply_submit'
  | 'file_upload'
  | 'file_access'
  | 'pii_reveal'
  | 'cash_collection'
  | 'data_request'
  | 'public_api'
  | 'api_global'

export interface RateLimitPolicy {
  maxRequests: number
  windowMs: number
}

export const RATE_LIMIT_POLICIES: Record<RateLimitScope, RateLimitPolicy> = {
  auth_login: { maxRequests: 8, windowMs: 15 * 60 * 1000 }, // 8 attempts per 15m per IP+account
  auth_signup: { maxRequests: 6, windowMs: 15 * 60 * 1000 }, // 6 signups per 15m
  auth_forgot_password: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 resets per 15m
  auth_otp: { maxRequests: 5, windowMs: 10 * 60 * 1000 }, // 5 OTP attempts per 10m
  apply_submit: { maxRequests: 10, windowMs: 15 * 60 * 1000 }, // 10 submissions per 15m
  file_upload: { maxRequests: 20, windowMs: 10 * 60 * 1000 }, // 20 uploads per 10m
  file_access: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 file downloads per minute per IP
  pii_reveal: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 PII reveals per minute
  cash_collection: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 cash collections per minute
  data_request: { maxRequests: 5, windowMs: 60 * 60 * 1000 }, // 5 DSR requests per hour
  api_global: { maxRequests: 300, windowMs: 60 * 1000 }, // 300 API calls per minute per IP
  public_api: { maxRequests: 50, windowMs: 15 * 60 * 1000 }, // 50 requests per 15 min
}

interface BucketRecord {
  timestamps: number[]
  blockedUntil: number
}

const memoryBuckets = new Map<string, BucketRecord>()
const MAX_BUCKETS = 10000

function cleanupBuckets(now: number) {
  if (memoryBuckets.size <= MAX_BUCKETS) return
  for (const [key, rec] of memoryBuckets.entries()) {
    if (rec.blockedUntil <= now && rec.timestamps.length === 0) {
      memoryBuckets.delete(key)
    }
    if (memoryBuckets.size <= MAX_BUCKETS * 0.8) break
  }
}

export function extractClientIp(req?: NextRequest | null): string {
  if (!req) return 'unknown'

  const trustedProxyHeader = process.env.TRUSTED_PROXY_HEADER?.trim()
  const trustProxy = process.env.TRUST_PROXY === 'true' || Boolean(trustedProxyHeader)

  if (trustProxy) {
    // A trusted proxy (e.g. Caddy) is in front of the app and overwrites /
    // appends the forwarding header, so its value can be believed.
    const headerName = (trustedProxyHeader || 'x-forwarded-for').toLowerCase()
    const forwarded = req.headers.get(headerName)
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim()
      if (first) return first
    }
    const realIp = req.headers.get('x-real-ip')
    if (realIp) return realIp
  }

  // No trusted proxy: forwarding headers are client-controlled and MUST NOT
  // be used as a rate-limit key (rotating them would reset every limit).
  // Bucket all direct callers together, differentiated only by a hash of
  // their User-Agent, and rely on per-account identifiers (passed by
  // callers as additional key parts) for finer-grained limits.
  const userAgent = req.headers.get('user-agent') || ''
  const uaHash = createHash('sha256').update(userAgent).digest('hex').slice(0, 12)
  return `direct:${uaHash}`
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSeconds: number
  limit: number
}

function normalizeRateLimitKey(
  scope: RateLimitScope,
  keyParts: Array<string | undefined | null>
): string {
  return `${scope}:${keyParts
    .map((p) => (p ? String(p).trim().toLowerCase() : 'anon'))
    .join(':')}`
}

/**
 * Redis-backed fixed-window counter (INCR + EXPIRE). Returns null when the
 * caller must fall back to the in-memory limiter (Redis error mid-flight).
 * The first request in a window creates the key and arms its expiry; a
 * blocked request never extends the window, mirroring the in-memory
 * semantics where blocked attempts do not push timestamps.
 */
async function checkRateLimitRedis(
  redis: RedisClientLike,
  scope: RateLimitScope,
  normalizedKey: string,
  policy: RateLimitPolicy
): Promise<RateLimitResult | null> {
  const redisKey = `ratelimit:${normalizedKey}`
  const windowSeconds = Math.max(1, Math.ceil(policy.windowMs / 1000))

  const count = await redis.incr(redisKey)
  if (count === 1) {
    await redis.expire(redisKey, windowSeconds)
  }

  if (count > policy.maxRequests) {
    let ttl = await redis.ttl(redisKey)
    if (ttl < 0) {
      // Key exists without an expiry (e.g. the EXPIRE above raced a
      // failure): re-arm it so the block is bounded by the window.
      await redis.expire(redisKey, windowSeconds)
      ttl = windowSeconds
    }
    const retryAfterSeconds = Math.max(1, ttl)
    logger.warn('Rate limit exceeded', {
      scope,
      bucket: normalizedKey,
      limit: policy.maxRequests,
      retryAfterSeconds,
      backend: 'redis',
    })
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds,
      limit: policy.maxRequests,
    }
  }

  return {
    ok: true,
    remaining: Math.max(0, policy.maxRequests - count),
    retryAfterSeconds: 0,
    limit: policy.maxRequests,
  }
}

/** Original in-memory sliding-window limiter; also the fail-open fallback. */
function checkRateLimitMemory(
  scope: RateLimitScope,
  normalizedKey: string,
  policy: RateLimitPolicy
): RateLimitResult {
  const now = Date.now()
  cleanupBuckets(now)

  const existing = memoryBuckets.get(normalizedKey) ?? { timestamps: [], blockedUntil: 0 }

  if (existing.blockedUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.blockedUntil - now) / 1000))
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds,
      limit: policy.maxRequests,
    }
  }

  const windowStart = now - policy.windowMs
  const activeTimestamps = existing.timestamps.filter((ts) => ts > windowStart)

  if (activeTimestamps.length >= policy.maxRequests) {
    const oldest = activeTimestamps[0] ?? now
    const blockedUntil = oldest + policy.windowMs
    existing.timestamps = activeTimestamps
    existing.blockedUntil = blockedUntil
    memoryBuckets.set(normalizedKey, existing)

    const retryAfterSeconds = Math.max(1, Math.ceil((blockedUntil - now) / 1000))
    logger.warn('Rate limit exceeded', {
      scope,
      bucket: normalizedKey,
      limit: policy.maxRequests,
      retryAfterSeconds,
    })

    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds,
      limit: policy.maxRequests,
    }
  }

  activeTimestamps.push(now)
  existing.timestamps = activeTimestamps
  existing.blockedUntil = 0
  memoryBuckets.set(normalizedKey, existing)

  return {
    ok: true,
    remaining: Math.max(0, policy.maxRequests - activeTimestamps.length),
    retryAfterSeconds: 0,
    limit: policy.maxRequests,
  }
}

/**
 * Rate-limit check. Uses Redis when configured; any Redis failure fails
 * open to the in-memory limiter for that request (availability of the
 * auth surface beats strictness of the counter, and the in-memory path
 * still enforces the same policy per instance).
 */
export async function checkRateLimit(
  scope: RateLimitScope,
  keyParts: Array<string | undefined | null>,
  customPolicy?: RateLimitPolicy
): Promise<RateLimitResult> {
  const policy = customPolicy ?? RATE_LIMIT_POLICIES[scope]
  const normalizedKey = normalizeRateLimitKey(scope, keyParts)

  const redis = getRedis()
  if (redis) {
    try {
      const result = await checkRateLimitRedis(redis, scope, normalizedKey, policy)
      if (result) return result
    } catch (err) {
      logger.warn('Redis rate limit check failed; falling back to in-memory limiter', {
        scope,
        error: err,
      })
    }
  }

  return checkRateLimitMemory(scope, normalizedKey, policy)
}

export async function enforceRateLimit(
  req: NextRequest,
  scope: RateLimitScope,
  identifier?: string | null,
  customPolicy?: RateLimitPolicy
): Promise<NextResponse | null> {
  const ip = extractClientIp(req)
  // Support isolated test bucket key in non-production so parallel security tests can trigger 429 deterministically
  const testBucket =
    process.env.NODE_ENV !== 'production' ? req.headers.get('x-ratelimit-test-key') : null
  const effectiveIp = testBucket ? `${ip}:${testBucket}` : ip

  const res = await checkRateLimit(scope, [effectiveIp, identifier], customPolicy)
  if (!res.ok) {
    return NextResponse.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests. Please try again in ${res.retryAfterSeconds} seconds.`,
        },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(res.retryAfterSeconds),
          'X-RateLimit-Limit': String(res.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }
  return null
}

/**
 * Optional CAPTCHA (Cloudflare Turnstile / hCaptcha) verification hook.
 * Enforced when TURNSTILE_SECRET_KEY or HCAPTCHA_SECRET_KEY is configured in env.
 */
export async function verifyCaptchaToken(
  token: string | undefined | null,
  ip?: string
): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY || process.env.HCAPTCHA_SECRET_KEY
  if (!secret) {
    // CAPTCHA not configured in environment — pass through
    return { ok: true }
  }
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'CAPTCHA verification token is required' }
  }
  try {
    const verifyUrl = process.env.TURNSTILE_SECRET_KEY
      ? 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
      : 'https://hcaptcha.com/siteverify'
    const form = new URLSearchParams()
    form.set('secret', secret)
    form.set('response', token)
    if (ip) form.set('remoteip', ip)

    const resp = await fetch(verifyUrl, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(5000),
    })
    const json = (await resp.json()) as { success?: boolean }
    return { ok: Boolean(json?.success), reason: json?.success ? undefined : 'CAPTCHA challenge failed' }
  } catch (err) {
    logger.error('CAPTCHA verification request failed', { error: err })
    return { ok: false, reason: 'Unable to verify CAPTCHA token' }
  }
}
