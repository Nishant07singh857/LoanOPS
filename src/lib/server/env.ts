// Server-side startup environment validation (Task 1.1)
// In production, the process crashes immediately if any critical variable is missing or weak.
// In development, warnings are printed but defaults are tolerated.

import { z } from 'zod'

const isProduction = process.env.NODE_ENV === 'production'

const baseEnvSchema = z.object({
  // --- Database ---
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL cannot be empty')
    .refine((v) => v.startsWith('postgres'), 'DATABASE_URL must be a postgresql:// URL'),

  // --- Cryptographic secrets ---
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters'),

  PII_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'PII_ENCRYPTION_KEY must be exactly 64 hex characters'),

  AADHAAR_HASH_PEPPER: z
    .string()
    .min(32, 'AADHAAR_HASH_PEPPER must be at least 32 characters'),

  // --- Application URL ---
  NEXT_PUBLIC_APP_URL: isProduction
    ? z
        .string()
        .url('NEXT_PUBLIC_APP_URL must be a valid URL')
        .refine((v) => v.startsWith('https://'), 'NEXT_PUBLIC_APP_URL must use https:// in production')
    : z.string().optional(),

  // --- Payments / cookies (conditionally required in production, see below) ---
  ENABLE_ONLINE_PAYMENTS: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  COOKIE_SECURE: z.string().optional(),

  // --- Optional Redis (Upstash REST) ---
  // Accelerator only (rate-limit counters + dashboard cache). Both vars
  // are OPTIONAL: absence is valid and the app fails open to in-memory /
  // direct-DB behavior. No format is enforced here on purpose — a
  // malformed value must not crash boot; src/lib/server/redis.ts treats
  // an unusable client as "no Redis".
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
})

const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  if (!isProduction) return

  // Secure cookies are mandatory behind production HTTPS; without this a
  // deployment can silently serve session cookies over plain HTTP.
  if (env.COOKIE_SECURE !== 'true') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['COOKIE_SECURE'],
      message: 'COOKIE_SECURE must be "true" in production',
    })
  }

  // Online payments cannot be enabled without a webhook secret to verify
  // provider callbacks against — otherwise payment events are unauthenticated.
  if (env.ENABLE_ONLINE_PAYMENTS === 'true' && !env.PAYMENT_WEBHOOK_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['PAYMENT_WEBHOOK_SECRET'],
      message:
        'PAYMENT_WEBHOOK_SECRET is required in production when ENABLE_ONLINE_PAYMENTS is "true"',
    })
  }
})

export type ValidatedEnv = z.infer<typeof envSchema>

let _validated: ValidatedEnv | null = null

/**
 * Validates critical environment variables.
 * - Production: throws on any failure (crashes the process).
 * - Development: logs warnings and returns partial results (allows defaults).
 */
export function validateEnv(): ValidatedEnv {
  if (_validated) return _validated

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const lines = Object.entries(errors).map(
      ([key, msgs]) => `  ❌ ${key}: ${(msgs ?? []).join('; ')}`
    )
    const message = `\nEnvironment validation failed:\n${lines.join('\n')}\n`

    const isBuildPhase = process.env.npm_lifecycle_event === 'build' || process.env.NEXT_PHASE === 'phase-production-build'

    if (isProduction && !isBuildPhase) {
      console.error(message)
      process.exit(1)
    } else {
      console.warn(`⚠️  [dev/build mode] ${message}Continuing with defaults…\n`)
    }
  }

  _validated = (result.success ? result.data : process.env) as ValidatedEnv
  return _validated
}

// Auto-validate on import in production
if (isProduction) {
  validateEnv()
}
