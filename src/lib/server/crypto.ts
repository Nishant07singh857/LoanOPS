// Server-side AES-256-GCM encryption & hashing helpers for PII (Aadhaar, PAN, Bank Account)
// Supports dual-key rotation via PII_ENCRYPTION_KEY (primary) and PII_ENCRYPTION_KEY_PREVIOUS (fallback).
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync } from 'crypto'

const PREFIX = 'enc:v1:'
const SALT = 'loanops-pii-salt'
const DEFAULT_DEV_SECRET = 'loanops-dev-key-must-be-32-bytes!'

let cachedSecret: string | null = null
let cachedKey: Buffer | null = null

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SALT, 32)
}

function getEncryptionKey(): Buffer {
  const configuredSecret =
    process.env.PII_ENCRYPTION_KEY || process.env.SESSION_SECRET

  if (!configuredSecret && process.env.NODE_ENV === 'production') {
    // Never fall back to a publicly-known secret in production: anything
    // encrypted with it would be decryptable by anyone who can read the
    // source code. Fail closed instead.
    throw new Error(
      'PII_ENCRYPTION_KEY (or SESSION_SECRET) must be set in production — refusing to use the development fallback secret'
    )
  }

  // Development/test only: deterministic fallback so local tooling works
  // without configured secrets. Never reached in production (see above).
  const secret = configuredSecret || DEFAULT_DEV_SECRET

  if (cachedKey && cachedSecret === secret) {
    return cachedKey
  }

  cachedSecret = secret
  cachedKey = deriveKey(secret)
  return cachedKey
}

/**
 * Encrypts plaintext PII using AES-256-GCM with a 12-byte random IV and 16-byte auth tag.
 * Returns `enc:v1:${ivHex}:${tagHex}:${cipherHex}`.
 * Idempotent if value is already prefixed with `enc:v1:`.
 */
export function encryptPII(plaintext: string): string {
  if (!plaintext) return ''
  const str = String(plaintext)
  if (str.startsWith(PREFIX)) return str

  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
  const encrypted = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

function tryDecryptWithKey(key: Buffer, iv: Buffer, tag: Buffer, encrypted: Buffer): string | null {
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    return null
  }
}

/**
 * Masking-only decrypt: resolves a stored PII value to the string a
 * masker (maskAadhaar / maskPan / maskBankAccount) should consume.
 *
 * Stored values are heterogeneous by era: `enc:v1:` ciphertext (current),
 * legacy plaintext written before encryption-at-rest, and already-masked
 * display strings (e.g. Candidate.aadhaarMasked holds "XXXX-XXXX-1234").
 * decryptPII() deliberately fails closed on non-ciphertext in production —
 * correct for full-value reads, but list/detail endpoints that only ever
 * return a MASKED value must not 500 on legacy rows. The maskers expose at
 * most the last 4 characters, so passing a legacy value through here never
 * widens exposure beyond what the mask itself reveals.
 *
 * Use ONLY where the result is immediately masked. Full-value paths
 * (audited PII reveal) must keep using decryptPII().
 */
export function decryptPIIForMask(value?: string | null): string {
  if (!value) return ''
  const str = String(value)
  if (str.startsWith(PREFIX)) return decryptPII(str)
  return str
}

/**
 * Decrypts an `enc:v1:`-prefixed ciphertext back to UTF-8 plaintext.
 * Automatically falls back to `PII_ENCRYPTION_KEY_PREVIOUS` during key rotation.
 */
export function decryptPII(value?: string | null): string {
  if (!value) return ''
  const str = String(value)
  if (!str.startsWith(PREFIX)) {
    if (process.env.NODE_ENV === 'production') {
      // In production a non-prefixed value is either plaintext PII that was
      // stored incorrectly or corrupt data. Returning it silently would
      // propagate unencrypted PII; fail closed instead. Development stays
      // lenient for legacy/seed data.
      throw new Error('decryptPII: value is not in enc:v1: format (refusing to return it as plaintext in production)')
    }
    return str
  }

  const parts = str.slice(PREFIX.length).split(':')
  if (parts.length !== 3) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('decryptPII: malformed enc:v1: value (expected iv:tag:ciphertext)')
    }
    return str
  }
  const [ivHex, tagHex, cipherHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(cipherHex, 'hex')

  const primaryPlain = tryDecryptWithKey(getEncryptionKey(), iv, tag, encrypted)
  if (primaryPlain !== null) return primaryPlain

  if (process.env.PII_ENCRYPTION_KEY_PREVIOUS) {
    const prevKey = deriveKey(process.env.PII_ENCRYPTION_KEY_PREVIOUS)
    const fallbackPlain = tryDecryptWithKey(prevKey, iv, tag, encrypted)
    if (fallbackPlain !== null) return fallbackPlain
  }

  if (process.env.NODE_ENV === 'production') {
    // Undecryptable ciphertext in production means a wrong/rotated-away key
    // or data corruption. Returning the ciphertext as if it were plaintext
    // silently corrupts downstream PII handling; fail closed instead.
    throw new Error('decryptPII: unable to decrypt value with the configured PII keys')
  }

  return str
}

/**
 * Re-encrypts a ciphertext with the current primary `PII_ENCRYPTION_KEY`.
 */
export function rotateEncryptedPII(ciphertext?: string | null): string {
  if (!ciphertext) return ''
  const plain = decryptPII(ciphertext)
  return encryptPII(plain)
}

/**
 * Computes a keyed HMAC-SHA256 hex digest of plaintext PII (e.g. Aadhaar number).
 * Uses AADHAAR_HASH_PEPPER as the secret key to prevent rainbow-table reversals.
 * In development, falls back to plain SHA-256 with a warning if pepper is missing.
 */
export function hashPII(plaintext: string): string {
  const pepper = process.env.AADHAAR_HASH_PEPPER
  if (pepper && pepper.length >= 32) {
    return createHmac('sha256', pepper).update(String(plaintext ?? ''), 'utf8').digest('hex')
  }
  // Development fallback — never allow in production (env.ts validates this)
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  AADHAAR_HASH_PEPPER not set or too short — using plain SHA-256 (dev only)')
    return createHash('sha256').update(String(plaintext ?? ''), 'utf8').digest('hex')
  }
  throw new Error('AADHAAR_HASH_PEPPER must be set and >= 32 chars in production')
}
