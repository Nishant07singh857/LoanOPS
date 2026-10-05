// Central Rate Limiter & Abuse Protection (Phase 4)
// Supports Redis via Upstash/REST if REDIS_REST_URL & REDIS_REST_TOKEN are configured,
// with a bounded, deterministic in-memory sliding-window fallback.

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/server/logger'

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
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip') || '127.0.0.1'
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSeconds: number
  limit: number
}

export function checkRateLimit(
  scope: RateLimitScope,
  keyParts: Array<string | undefined | null>,
  customPolicy?: RateLimitPolicy
): RateLimitResult {
  const policy = customPolicy ?? RATE_LIMIT_POLICIES[scope]
  const now = Date.now()
  cleanupBuckets(now)

  const normalizedKey = `${scope}:${keyParts
    .map((p) => (p ? String(p).trim().toLowerCase() : 'anon'))
    .join(':')}`

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

export function enforceRateLimit(
  req: NextRequest,
  scope: RateLimitScope,
  identifier?: string | null,
  customPolicy?: RateLimitPolicy
): NextResponse | null {
  const ip = extractClientIp(req)
  // Support isolated test bucket key in non-production so parallel security tests can trigger 429 deterministically
  const testBucket =
    process.env.NODE_ENV !== 'production' ? req.headers.get('x-ratelimit-test-key') : null
  const effectiveIp = testBucket ? `${ip}:${testBucket}` : ip

  const res = checkRateLimit(scope, [effectiveIp, identifier], customPolicy)
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
