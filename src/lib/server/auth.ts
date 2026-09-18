// Server-side auth helpers — password hashing, session tokens, RBAC
// All functions server-only. Mark with 'server-only' to prevent bundling in client.

import bcrypt from 'bcryptjs'
import { randomBytes, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

// ============================================================
// PASSWORD HASHING
// ============================================================

const SALT_ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // bcryptjs handles timing-attack safe comparison internally
  return bcrypt.compare(plain, hash)
}

// ============================================================
// SESSION TOKENS
// ============================================================

const SESSION_COOKIE = 'loanops_session'
const SESSION_TTL_DAYS = 7

export function generateSessionToken(): string {
  // 32 bytes = 256 bits of entropy
  return randomBytes(32).toString('hex')
}

// Use HMAC-SHA256 for fast, constant-time token verification.
// This is much faster than bcrypt and appropriate for session tokens
// (which are high-entropy and short-lived — not user passwords).
import { createHmac } from 'crypto'

const TOKEN_HMAC_KEY = process.env.SESSION_SECRET || 'dev-session-secret-change-in-production-please-32chars'

function hmacToken(token: string): string {
  return createHmac('sha256', TOKEN_HMAC_KEY).update(token).digest('hex')
}

export async function hashToken(token: string): Promise<string> {
  // Synchronous HMAC, but keep the Promise for API compatibility
  return hmacToken(token)
}

export async function verifyToken(token: string, hashed: string): Promise<boolean> {
  if (!hashed) return false
  try {
    const expected = hmacToken(token)
    // Timing-safe comparison
    if (expected.length !== hashed.length) return false
    return timingSafeEqual(Buffer.from(expected), Buffer.from(hashed))
  } catch {
    return false
  }
}

// ============================================================
// SESSION MANAGEMENT (DB-backed, HTTP-only cookie)
// ============================================================

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'OWNER' | 'AGENT' | 'CANDIDATE'
  organizationId: string
  organizationName: string
  phone?: string | null
  candidateId?: string | null  // linked candidate record (only for CANDIDATE role)
}

export async function createSession(user: {
  id: string
  organizationId: string
}, opts: { ip?: string; userAgent?: string } = {}): Promise<string> {
  const token = generateSessionToken()
  const tokenHash = await hashToken(token)
  const tokenPrefix = token.slice(0, 16)
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  await db.session.create({
    data: {
      token: tokenHash,
      tokenPrefix,
      userId: user.id,
      expiresAt,
      ipAddr: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
    },
  })

  return token
}

export async function getSession(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token) return null

  // Fast indexed lookup by tokenPrefix (first 16 chars).
  // The full token is still bcrypt-hashed in DB and verified here.
  const tokenPrefix = token.slice(0, 16)

  const candidates = await db.session.findMany({
    where: {
      tokenPrefix,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        include: {
          organization: true,
        },
      },
    },
    take: 5, // typically 1 — same prefix collision is extremely rare
  })

  for (const s of candidates) {
    if (await verifyToken(token, s.token)) {
      const u = s.user
      const candidate = u.role === 'CANDIDATE'
        ? await db.candidate.findUnique({ where: { userId: u.id } })
        : null
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as AuthUser['role'],
        organizationId: u.organizationId,
        organizationName: u.organization.name,
        phone: u.phone,
        candidateId: candidate?.id ?? null,
      }
    }
  }
  return null
}

export async function revokeSession(token: string): Promise<void> {
  // Fast lookup by prefix, then verify hash and mark revoked
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

// ============================================================
// COOKIE HELPERS
// ============================================================

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function getSessionCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value
}

// ============================================================
// AUTH GUARD for API routes
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

// ============================================================
// ERROR
// ============================================================

export class AuthError extends Error {
  statusCode: number
  constructor(message: string, statusCode: number = 401) {
    super(message)
    this.statusCode = statusCode
  }
}

// ============================================================
// TENANT GUARD
// ============================================================

export function assertTenant(organizationId: string, user: AuthUser): void {
  if (user.organizationId !== organizationId) {
    throw new AuthError('Forbidden: tenant isolation violated', 403)
  }
}

// ============================================================
// LOGIN RATE LIMITING (in-memory per IP)
// ============================================================

const loginAttempts = new Map<string, { count: number; lockedUntil: number }>()

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

export function checkLoginRate(ip: string): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now()
  const rec = loginAttempts.get(ip)
  if (rec && rec.lockedUntil > now) {
    return { ok: false, retryAfterMs: rec.lockedUntil - now }
  }
  return { ok: true }
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now()
  const rec = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 }
  rec.count += 1
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOCKOUT_MS
    rec.count = 0
  }
  loginAttempts.set(ip, rec)
}

export function clearLoginFailures(ip: string): void {
  loginAttempts.delete(ip)
}

export function getClientIp(req: NextRequest | Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

// ============================================================
// AUDIT LOG
// ============================================================

export async function audit(
  ctx: AuthContext | { user: AuthUser },
  action: string,
  entityType: string,
  entityId: string | null,
  description: string,
  metadata?: any
): Promise<void> {
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
      },
    })
  } catch (e) {
    console.error('Failed to write audit log:', e)
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
      },
    })
  } catch (e) {
    console.error('Failed to write audit log:', e)
  }
}
