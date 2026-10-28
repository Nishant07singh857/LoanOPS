// ============================================================
// TOTP 2FA (RFC 6238 — Owner/Admin Optional 2FA)
// ============================================================
// Code generation/verification plus replay protection. Verification
// returns the matched time-step so callers can persist the last
// accepted step on the user (User.totpLastStep) and reject any code
// at or before it — a captured code must never log in twice
// (red-team round 2, N1).

import { createHmac, randomBytes } from 'crypto'
import { decryptPII, encryptPII } from '@/lib/server/crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateTotpSecret(): string {
  const bytes = randomBytes(20)
  let secret = ''
  for (let i = 0; i < bytes.length; i++) {
    secret += BASE32_ALPHABET[bytes[i] % 32]
  }
  return secret
}

function base32ToBuffer(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = ''
  for (const ch of cleaned) {
    const val = BASE32_ALPHABET.indexOf(ch)
    if (val >= 0) bits += val.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

export function generateTotpCode(secretBase32: string, counterStep = Math.floor(Date.now() / 30000)): string {
  const key = base32ToBuffer(secretBase32)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counterStep))
  const hmac = createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(binary % 1_000_000).padStart(6, '0')
}

/**
 * Verify a code and return the time-step it matched (current step
 * ± 1, the usual 30 s drift window), or null when it matches none.
 * Callers that authenticate with the code MUST persist the returned
 * step as the user's last accepted step and reject later codes
 * whose step is at or before it (see isTotpStepReplay).
 */
export function matchTotpStep(secretOrEncrypted: string, code: string): number | null {
  if (!code || !/^\d{6}$/.test(code.trim())) return null
  const secret = decryptPII(secretOrEncrypted) || secretOrEncrypted
  const currentStep = Math.floor(Date.now() / 30000)
  // Allow +/- 1 time step (30s drift window)
  for (const delta of [-1, 0, 1]) {
    const expected = generateTotpCode(secret, currentStep + delta)
    if (expected === code.trim()) return currentStep + delta
  }
  return null
}

export function verifyTotpCode(secretOrEncrypted: string, code: string): boolean {
  return matchTotpStep(secretOrEncrypted, code) !== null
}

/** A code is a replay when its step was already accepted before. */
export function isTotpStepReplay(step: number, lastAcceptedStep: number): boolean {
  return step <= lastAcceptedStep
}

export function encryptTotpSecret(secretBase32: string): string {
  return encryptPII(secretBase32)
}

export function buildTotpOtpAuthUri(email: string, secretBase32: string, issuer = 'LoanOps'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}
