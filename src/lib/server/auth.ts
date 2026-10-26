// Server-side auth helpers — password hashing, password policy, session rotation,
// idle timeout, constant-time anti-enumeration, TOTP 2FA, password reset, and RBAC.

import bcrypt from 'bcryptjs'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'
import { logger } from '@/lib/server/logger'
import { decryptPII, encryptPII } from '@/lib/server/crypto'

// ============================================================
// STARTUP ENVIRONMENT VALIDATION (Phase 2)
// ============================================================

const TOKEN_HMAC_KEY = process.env.SESSION_SECRET
if (
  process.env.NODE_ENV === 'production' &&
  (!TOKEN_HMAC_KEY ||
    TOKEN_HMAC_KEY.length < 32 ||
    TOKEN_HMAC_KEY.includes('change-me') ||
    TOKEN_HMAC_KEY.includes('dev-secret') ||
    !process.env.DATABASE_URL)
) {
  throw new Error(
    'FATAL: In production, SESSION_SECRET (min 32 chars, non-default) and DATABASE_URL must be configured.'
  )
}
if (!TOKEN_HMAC_KEY) throw new Error('SESSION_SECRET is not set in environment')

// ============================================================
// PASSWORD HASHING & PASSWORD POLICY (Phase 2)
// ============================================================

const SALT_ROUNDS = 12
// Precomputed bcrypt cost-12 hash used for constant-time dummy verification when account does not exist
const DUMMY_BCRYPT_HASH = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'

const BREACHED_OR_COMMON_PASSWORDS = new Set([
  'password123',
  'password1234',
  'password@123',
  '1234567890',
  '12345678901',
  'qwerty12345',
  'qwertyuiop',
  'admin12345',
  'admin@12345',
  'welcome123',
  'welcome@123',
  'letmein123',
  'india12345',
  'india@12345',
  'loanops123',
  'sterling123',
  'iloveyou123',
  'monkey12345',
  'abc1234567',
])

export interface PasswordPolicyResult {
  ok: boolean
  error?: string
}

export function validatePasswordPolicy(
  plain: string,
  context?: { email?: string | null; name?: string | null; mobile?: string | null }
): PasswordPolicyResult {
  if (!plain || typeof plain !== 'string') {
    return { ok: false, error: 'Password is required' }
  }
  if (plain.length < 10) {
    return { ok: false, error: 'Password must be at least 10 characters long' }
  }
  if (plain.length > 128) {
    return { ok: false, error: 'Password must not exceed 128 characters' }
  }
  const lower = plain.toLowerCase()
  if (BREACHED_OR_COMMON_PASSWORDS.has(lower)) {
    return {
      ok: false,
      error: 'This password appears in known breached/common password lists. Please choose a stronger password.',
    }
  }
  if (!/[A-Z]/.test(plain) || !/[a-z]/.test(plain) || !/[0-9]/.test(plain)) {
    return {
      ok: false,
      error: 'Password must include at least one uppercase letter, one lowercase letter, and one digit.',
    }
  }
  if (context?.email) {
    const localPart = context.email.split('@')[0]?.toLowerCase()
    if (localPart && localPart.length >= 4 && lower.includes(localPart)) {
      return { ok: false, error: 'Password must not contain your email username' }
    }
  }
  return { ok: true }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/**
 * Performs a constant-time bcrypt compare against a dummy hash when an email/mobile
 * is not found, preventing timing-based account enumeration.
 */
export async function constantTimeDummyVerify(plain: string): Promise<boolean> {
  await bcrypt.compare(plain || 'dummy-input', DUMMY_BCRYPT_HASH)
  return false
}

// ============================================================
// SESSION TOKENS & IDLE TIMEOUT (Phase 2)
// ============================================================

const SESSION_COOKIE = 'loanops_session'
const SESSION_TTL_DAYS = 1 // 24-hour absolute session lifetime
const SESSION_IDLE_TIMEOUT_MS =
  Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES || 120) * 60 * 1000 // 2h idle timeout default

export function generateSessionToken(): string {
  // 32 bytes = 256 bits of entropy
  return randomBytes(32).toString('hex')
}

function hmacToken(token: string): string {
  return createHmac('sha256', TOKEN_HMAC_KEY as string).update(token).digest('hex')
}

export async function hashToken(token: string): Promise<string> {
  return hmacToken(token)
}

export async function verifyToken(token: string, hashed: string): Promise<boolean> {
  if (!token || !hashed || typeof token !== 'string' || typeof hashed !== 'string') return false
  try {
    const expected = hmacToken(token)
    const expectedBuf = Buffer.from(expected, 'utf8')
    const hashedBuf = Buffer.from(hashed, 'utf8')
    if (expectedBuf.length !== hashedBuf.length) return false
    return timingSafeEqual(expectedBuf, hashedBuf)
  } catch {
    return false
  }
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'OWNER' | 'AGENT' | 'CANDIDATE'
  organizationId: string
  organizationName: string
  phone?: string | null
  candidateId?: string | null
  totpEnabled?: boolean
}

export async function createSession(
  user: { id: string; organizationId: string },
  opts: { ip?: string; userAgent?: string; rotateExistingToken?: string | null } = {}
): Promise<string> {
  // Session rotation on login: if caller had an existing session cookie, revoke it first
  const existingToken = opts.rotateExistingToken ?? (await getSessionCookie().catch(() => undefined))
  if (existingToken) {
    await revokeSession(existingToken).catch(() => {})
  }

  const token = generateSessionToken()
  const tokenHash = await hashToken(token)
  const tokenPrefix = token.slice(0, 16)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  await db.session.create({
    data: {
      token: tokenHash,
      tokenPrefix,
      userId: user.id,
      expiresAt,
      lastActiveAt: now,
      ipAddr: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
    },
  })

  return token
}

export async function getSession(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token || typeof token !== 'string' || token.length < 32 || token.length > 128) return null
  if (!/^[a-f0-9]+$/i.test(token)) return null

  const now = new Date()
  const tokenPrefix = token.slice(0, 16)

  const candidates = await db.session.findMany({
    where: {
      tokenPrefix,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    include: {
      user: {
        include: {
          organization: true,
        },
      },
    },
    take: 5,
  })

  for (const s of candidates) {
    if (s.revokedAt || s.expiresAt <= now) continue
    if (await verifyToken(token, s.token)) {
      const u = s.user
      if (!u || !u.isActive || !u.organization?.isActive) return null
      if (u.lockedUntil && u.lockedUntil > now) return null

      // Invalidate sessions created prior to a password change
      if (u.passwordChangedAt && s.createdAt < u.passwordChangedAt) {
        await db.session.update({ where: { id: s.id }, data: { revokedAt: now } }).catch(() => {})
        return null
      }

      // Enforce idle timeout
      const lastActive = s.lastActiveAt ?? s.createdAt
      if (now.getTime() - lastActive.getTime() > SESSION_IDLE_TIMEOUT_MS) {
        await db.session.update({ where: { id: s.id }, data: { revokedAt: now } }).catch(() => {})
        return null
      }

      // Touch lastActiveAt if older than 60s
      if (now.getTime() - lastActive.getTime() > 60_000) {
        await db.session.update({ where: { id: s.id }, data: { lastActiveAt: now } }).catch(() => {})
      }

      const candidate =
        u.role === 'CANDIDATE' ? await db.candidate.findUnique({ where: { userId: u.id } }) : null
      if (candidate && (candidate.status === 'BLACKLISTED' || candidate.deletedAt)) return null

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as AuthUser['role'],
        organizationId: u.organizationId,
        organizationName: u.organization.name,
        phone: u.phone,
        candidateId: candidate?.id ?? null,
        totpEnabled: Boolean(u.totpEnabled),
      }
    }
  }
  return null
}

export async function revokeSession(token: string): Promise<void> {
  if (!token || typeof token !== 'string' || token.length < 16) return
  const tokenPrefix = token.slice(0, 16)
  const sessions = await db.session.findMany({
    where: { tokenPrefix, revokedAt: null, expiresAt: { gt: new Date() } },
    take: 5,
  })
  for (const s of sessions) {
    if (await verifyToken(token, s.token)) {
      await db.session.update({
        where: { id: s.id },
        data: { revokedAt: new Date() },
      })
      return
    }
  }
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

// ============================================================
// COOKIE HELPERS
// ============================================================

const IS_HTTPS_COOKIE =
  process.env.COOKIE_SECURE === 'true' ||
  (process.env.NODE_ENV === 'production' && Boolean(process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://')))

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_HTTPS_COOKIE,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: IS_HTTPS_COOKIE,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export async function getSessionCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value
}

// ============================================================
// PASSWORD RESET TOKENS (Single-use, Hashed, Expiring — Phase 2)
// ============================================================

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes

export async function createPasswordResetToken(
  email: string,
  ipAddress?: string
): Promise<{ rawToken: string | null }> {
  const normalized = email.trim().toLowerCase()
  const user = await db.user.findUnique({ where: { email: normalized } })
  if (!user || !user.isActive) {
    // Perform dummy HMAC & bcrypt work so timing is indistinguishable
    await constantTimeDummyVerify(normalized)
    return { rawToken: null }
  }

  // Invalidate any prior unused reset tokens for this user
  await db.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = hmacToken(`pwd_reset:${rawToken}`)
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)

  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress: ipAddress ?? null,
    },
  })

  await auditRaw(user.organizationId, user.id, 'PASSWORD_RESET', 'User', user.id, 'Password reset token issued', {
    ipAddress,
  })

  return { rawToken }
}

export async function consumePasswordResetToken(
  rawToken: string,
  newPassword: string,
  ipAddress?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 32) {
    return { ok: false, error: 'Invalid or expired password reset token' }
  }
  const tokenHash = hmacToken(`pwd_reset:${rawToken.trim()}`)
  const now = new Date()

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!record || record.usedAt || record.expiresAt <= now || !record.user.isActive) {
    return { ok: false, error: 'Invalid or expired password reset token' }
  }

  const policy = validatePasswordPolicy(newPassword, {
    email: record.user.email,
    name: record.user.name,
  })
  if (!policy.ok) {
    return { ok: false, error: policy.error }
  }

  const passwordHash = await hashPassword(newPassword)

  await db.$transaction([
    db.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    }),
    db.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        passwordChangedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    db.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: now },
    }),
  ])

  await auditRaw(
    record.user.organizationId,
    record.userId,
    'PASSWORD_RESET',
    'User',
    record.userId,
    'Password reset completed and all prior sessions revoked',
    { ipAddress }
  )

  return { ok: true }
}

// ============================================================
// TOTP 2FA (RFC 6238 — Owner/Admin Optional 2FA — Phase 2)
// ============================================================

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

export function verifyTotpCode(secretOrEncrypted: string, code: string): boolean {
  if (!code || !/^\d{6}$/.test(code.trim())) return false
  const secret = decryptPII(secretOrEncrypted) || secretOrEncrypted
  const currentStep = Math.floor(Date.now() / 30000)
  // Allow +/- 1 time step (30s drift window)
  for (const delta of [-1, 0, 1]) {
    const expected = generateTotpCode(secret, currentStep + delta)
    if (expected === code.trim()) return true
  }
  return false
}

export function encryptTotpSecret(secretBase32: string): string {
  return encryptPII(secretBase32)
}

export function buildTotpOtpAuthUri(email: string, secretBase32: string, issuer = 'LoanOps'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

// ============================================================
// AUTH GUARD for API routes (Phase 3)
// ============================================================

export interface AuthContext {
  user: AuthUser
  db: typeof db
}

export async function requireAuth(): Promise<AuthContext> {
  const token = await getSessionCookie()
  const user = await getSession(token)
  if (!user) {
    throw new AuthError('Unauthorized', 401)
  }
  return { user, db }
}

export async function requireRole(...roles: Array<'OWNER' | 'AGENT' | 'CANDIDATE'>): Promise<AuthContext> {
  const ctx = await requireAuth()
  if (!roles.includes(ctx.user.role)) {
    throw new AuthError('Forbidden', 403)
  }
  return ctx
}

export async function requireOwner(): Promise<AuthContext> {
  return requireRole('OWNER')
}

export async function requireAgent(): Promise<AuthContext> {
  return requireRole('AGENT')
}

export async function requireCandidate(): Promise<AuthContext> {
  return requireRole('CANDIDATE')
}

export class AuthError extends Error {
  statusCode: number
  constructor(message: string, statusCode: number = 401) {
    super(message)
    this.statusCode = statusCode
  }
}

export function assertTenant(organizationId: string, user: AuthUser): void {
  if (user.organizationId !== organizationId) {
    throw new AuthError('Forbidden: tenant isolation violated', 403)
  }
}

// ============================================================
// LOGIN RATE LIMITING & PROGRESSIVE DELAY (Phase 2 & 4)
// ============================================================

const loginAttempts = new Map<string, { count: number; lockedUntil: number }>()

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

export function checkLoginRate(key: string): { ok: boolean; retryAfterMs?: number; attempts?: number } {
  const now = Date.now()
  const rec = loginAttempts.get(key)
  if (rec) {
    if (rec.lockedUntil > now) {
      return { ok: false, retryAfterMs: rec.lockedUntil - now, attempts: rec.count }
    }
    if (rec.lockedUntil > 0 && rec.lockedUntil <= now) {
      loginAttempts.delete(key)
    }
  }
  return { ok: true, attempts: rec?.count ?? 0 }
}

export function recordLoginFailure(key: string): void {
  const now = Date.now()
  if (loginAttempts.size > 5000) {
    for (const [k, v] of loginAttempts.entries()) {
      if (v.lockedUntil > 0 && v.lockedUntil <= now) loginAttempts.delete(k)
    }
  }
  const rec = loginAttempts.get(key) || { count: 0, lockedUntil: 0 }
  rec.count += 1
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOCKOUT_MS
    rec.count = 0
  }
  loginAttempts.set(key, rec)
}

export function clearLoginFailures(key: string): void {
  loginAttempts.delete(key)
}

export function getClientIp(req: NextRequest | Request): string {
  // Forwarded headers are honored ONLY under the same trust config as
  // src/lib/server/rate-limit.ts (extractClientIp): TRUST_PROXY="true" or
  // a header named via TRUSTED_PROXY_HEADER. Without a trusted proxy these
  // headers are client-controlled — trusting them would let callers spoof
  // the IP recorded in audit logs, consent records and login lockouts.
  // (extractClientIp itself is not reused here: it returns a rate-limit
  // bucket key, `direct:<ua-hash>`, not an IP address.)
  const trustedProxyHeader = process.env.TRUSTED_PROXY_HEADER?.trim()
  const trustProxy = process.env.TRUST_PROXY === 'true' || Boolean(trustedProxyHeader)

  if (trustProxy) {
    const headerName = (trustedProxyHeader || 'x-forwarded-for').toLowerCase()
    const forwarded = req.headers.get(headerName)
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim()
      if (first) return first
    }
    const realIp = req.headers.get('x-real-ip')
    if (realIp) return realIp
  }

  return '127.0.0.1'
}

// ============================================================
// APPEND-ONLY AUDIT LOG (Phase 6)
// ============================================================

export async function audit(
  ctx: AuthContext | { user: AuthUser },
  action: string,
  entityType: string,
  entityId: string | null,
  description: string,
  metadata?: any
): Promise<void> {
  const ipAddress = metadata?.ipAddress ?? metadata?.ip ?? undefined
  const userAgent = metadata?.userAgent ?? undefined
  try {
    await db.auditLog.create({
      data: {
        organizationId: ctx.user.organizationId,
        userId: ctx.user.id,
        action: action as any,
        entityType,
        entityId,
        description,
        metadata: metadata ?? undefined,
        ipAddress,
        userAgent,
      },
    })
  } catch {
    try {
      await db.auditLog.create({
        data: {
          organizationId: ctx.user.organizationId,
          userId: ctx.user.id,
          action: 'VERIFY' as any,
          entityType,
          entityId,
          description: `[${action}] ${description}`,
          metadata: { ...(metadata ?? {}), auditAction: action },
          ipAddress,
          userAgent,
        },
      })
    } catch (e) {
      logger.error('Failed to write audit log', e)
    }
  }
}

export async function auditRaw(
  organizationId: string,
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  description: string,
  metadata?: any
): Promise<void> {
  const ipAddress = metadata?.ipAddress ?? metadata?.ip ?? undefined
  const userAgent = metadata?.userAgent ?? undefined
  try {
    await db.auditLog.create({
      data: {
        organizationId,
        userId,
        action: action as any,
        entityType,
        entityId,
        description,
        metadata: metadata ?? undefined,
        ipAddress,
        userAgent,
      },
    })
  } catch (e) {
    logger.error('Failed to write audit log', e)
  }
}
