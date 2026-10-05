// Server-side startup environment validation (Task 1.1)
// In production, the process crashes immediately if any critical variable is missing or weak.
// In development, warnings are printed but defaults are tolerated.

import { z } from 'zod'

const isProduction = process.env.NODE_ENV === 'production'

const envSchema = z.object({
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
