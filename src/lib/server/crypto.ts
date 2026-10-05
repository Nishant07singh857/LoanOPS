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
  const secret =
    process.env.PII_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    DEFAULT_DEV_SECRET

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
 * Decrypts an `enc:v1:`-prefixed ciphertext back to UTF-8 plaintext.
 * Automatically falls back to `PII_ENCRYPTION_KEY_PREVIOUS` during key rotation.
 */
export function decryptPII(value?: string | null): string {
  if (!value) return ''
  const str = String(value)
  if (!str.startsWith(PREFIX)) return str

  const parts = str.slice(PREFIX.length).split(':')
  if (parts.length !== 3) return str
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
