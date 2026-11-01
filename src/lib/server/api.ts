// Standard API response helpers for Next.js App Router route handlers.
// Hardened for Phases 3, 4, 5:
// - Global rate limiting (429 + Retry-After)
// - Request body size limit (413 Payload Too Large) & JSON nesting depth limit
// - Automatic XSS & Prototype Pollution sanitization on JSON bodies and validate()
// - Mass-assignment / unknown field rejection on Zod object schemas
// - CSRF Origin/Referer validation on state-changing requests
// - Generic production error messages (never leaking Prisma internals or stack traces)

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { sanitizeText, sanitizeInput } from '@/lib/utils'
import { logger } from '@/lib/server/logger'
import { enforceRateLimit } from '@/lib/server/rate-limit'
import { sanitizeJsonPayload } from '@/lib/server/security'

export { sanitizeText, sanitizeInput }

// ============================================================
// RESPONSE TYPES
// ============================================================

export type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
export type ApiError = { error: { code: string; message: string; details?: unknown } }

export const success = <T>(data: T, status = 200, meta?: Record<string, unknown>) =>
  NextResponse.json({ data, meta } as ApiSuccess<T>, { status })

export const created = <T>(data: T) => success(data, 201)

export const fail = (code: string, message: string, status: number = 400, details?: unknown) =>
  NextResponse.json({ error: { code, message, details } } as ApiError, { status })

export const badRequest = (msg = 'Bad Request', details?: unknown) =>
  fail('BAD_REQUEST', msg, 400, details)

export const unauthorized = (msg = 'Unauthorized') => fail('UNAUTHORIZED', msg, 401)
export const forbidden = (msg = 'Forbidden') => fail('FORBIDDEN', msg, 403)
export const notFound = (msg = 'Not Found') => fail('NOT_FOUND', msg, 404)
export const conflict = (msg = 'Conflict') => fail('CONFLICT', msg, 409)
export const payloadTooLarge = (msg = 'Request payload exceeds maximum allowed size') =>
  fail('PAYLOAD_TOO_LARGE', msg, 413)
export const unprocessable = (msg = 'Validation Error', details?: unknown) =>
  fail('UNPROCESSABLE', msg, 422, details)
export const tooMany = (msg = 'Too Many Requests', retryAfterSeconds = 60) =>
  NextResponse.json(
    { error: { code: 'TOO_MANY', message: msg } },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  )
export const gone = (msg = 'Gone') => fail('GONE', msg, 410)

function isInternalDbErrorMessage(msg: string): boolean {
  return /prisma|postgres|database|sql|constraint|invocation|connect|ECONN|P\d{4}/i.test(msg)
}

export const serverError = (msg = 'Server Error') => {
  const safeMsg = isInternalDbErrorMessage(msg) ? 'An unexpected server error occurred' : msg
  return fail('SERVER_ERROR', safeMsg, 500)
}

// ============================================================
// ERROR HANDLING & SECURITY WRAPPER
// ============================================================

export class HttpError extends Error {
  status: number
  code: string
  details?: unknown
  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

const MAX_REQUEST_BODY_BYTES = 6 * 1024 * 1024 // 6 MB max (supports <= 5 MB base64 receipt upload)
const MAX_JSON_DEPTH = 12

export function apiHandler<T extends (...args: any[]) => Promise<NextResponse>>(fn: T): T {
  return (async (...args: any[]) => {
    try {
      const req = args[0] as NextRequest | undefined
      if (req && typeof req.method === 'string') {
        // 1. Global API rate limit
        if (req.headers) {
          const rlRes = await enforceRateLimit(req, 'api_global')
          if (rlRes) return rlRes
        }

        const methodUpper = req.method.toUpperCase()
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(methodUpper)) {
          // 2. Enforce request body size limit via Content-Length
          const contentLength = Number(req.headers?.get?.('content-length') || '0')
          if (contentLength > MAX_REQUEST_BODY_BYTES) {
            return payloadTooLarge('Request body exceeds maximum allowed size (6 MB)')
          }

          // 3. CSRF Origin & Referer protection on cookie-authenticated state-changing requests
          const origin = req.headers?.get?.('origin')
          const referer = req.headers?.get?.('referer')
          const host = req.headers?.get?.('x-forwarded-host') || req.headers?.get?.('host')
          const isWebhook = typeof req.url === 'string' && req.url.includes('/api/webhooks')

          if (!isWebhook && host) {
            if (origin) {
              if (origin === 'null') {
                return forbidden('Cross-origin request with null origin is forbidden')
              }
              try {
                const originHost = new URL(origin).host
                if (originHost && originHost !== host) {
                  return forbidden('Cross-origin request forbidden')
                }
              } catch {
                return forbidden('Invalid request origin')
              }
            } else if (referer) {
              try {
                const refererHost = new URL(referer).host
                if (refererHost && refererHost !== host) {
                  return forbidden('Cross-origin referer forbidden')
                }
              } catch {
                return forbidden('Invalid request referer')
              }
            }
          }

          // 4. Wrap req.json() to enforce byte length, JSON depth, and XSS/prototype-pollution sanitization
          const origText = req.text.bind(req)
          req.json = async () => {
            const raw = await origText()
            if (Buffer.byteLength(raw, 'utf8') > MAX_REQUEST_BODY_BYTES) {
              throw new HttpError('PAYLOAD_TOO_LARGE', 'Request body exceeds maximum allowed size', 413)
            }
            const parsed = JSON.parse(raw)
            try {
              return sanitizeJsonPayload(parsed, 0, MAX_JSON_DEPTH)
            } catch (e: any) {
              if (String(e?.message).includes('PAYLOAD_DEPTH_EXCEEDED')) {
                throw new HttpError('BAD_REQUEST', 'JSON nesting depth exceeds maximum allowed limit', 400)
              }
              throw e
            }
          }
        }
      }

      return await fn(...args)
    } catch (err: any) {
      if (err?.statusCode) {
        return fail('AUTH', err.message, err.statusCode)
      }
      if (err?.status && err?.code) {
        return fail(err.code, err.message, err.status, err.details)
      }
      if (err instanceof ZodError) {
        return unprocessable(
          'Validation failed',
          err.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          }))
        )
      }
      if (err?.code === 'P2002') {
        return conflict('Resource already exists')
      }
      if (err?.code === 'P2025') {
        return notFound('Record not found')
      }
      if (err?.code === 'P2003' || err?.code === 'P2014') {
        return badRequest('Invalid reference or related record not found')
      }
      if (typeof err?.code === 'string' && /^P\d{4}$/.test(err.code)) {
        logger.error('[PRISMA ERROR]', { code: err.code })
        return serverError('A database error occurred')
      }
      if (err?.name?.includes('Prisma')) {
        logger.error('[PRISMA CLIENT ERROR]', { name: err.name })
        return serverError('A database error occurred')
      }
      logger.error('[API ERROR]', err)
      return serverError('An unexpected error occurred')
    }
  }) as T
}

// ============================================================
// VALIDATION & MASS-ASSIGNMENT DEFENSE
// ============================================================

const PERMITTED_GLOBAL_META_KEYS = new Set(['consents', 'captchaToken', 'csrfToken'])

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const sanitized = sanitizeJsonPayload(sanitizeInput(input), 0, MAX_JSON_DEPTH)

  // If schema is a ZodObject, reject unknown fields to prevent mass assignment
  if (
    schema instanceof z.ZodObject &&
    sanitized &&
    typeof sanitized === 'object' &&
    !Array.isArray(sanitized)
  ) {
    const allowedKeys = new Set(Object.keys(schema.shape))
    // Pagination schemas are applied to URL searchParams which may include extra query filters
    const isPaginationQuery = allowedKeys.has('page') && allowedKeys.has('pageSize')
    if (!isPaginationQuery) {
      const unknownKeys = Object.keys(sanitized as Record<string, unknown>).filter(
        (k) => !allowedKeys.has(k) && !PERMITTED_GLOBAL_META_KEYS.has(k)
      )
      if (unknownKeys.length > 0) {
        throw new ZodError([
          {
            code: 'unrecognized_keys',
            keys: unknownKeys,
            path: [],
            message: `Unrecognized or unpermitted field(s): ${unknownKeys.join(', ')}`,
          },
        ])
      }
    }
  }

  return schema.parse(sanitized)
}

export function validateBody<T>(schema: z.ZodType<T>, body: any): T {
  return validate(schema, body)
}

// ============================================================
// PAGINATION
// ============================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationInput = z.infer<typeof paginationSchema>

export function paginate(page: number, pageSize: number) {
  const safePage = Math.max(1, Math.trunc(page))
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)))
  return {
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  }
}

// ============================================================
// MONEY: safe paise serialization
// ============================================================

export function serializePaise(paise: number): string {
  return String(Math.trunc(paise))
}

// ============================================================
// ID & NUMBER GENERATORS
// ============================================================

let counter = 0
export function genNumber(prefix: string): string {
  counter += 1
  const ts = Date.now().toString(36)
  const rand = Math.floor(Math.random() * 0xffff).toString(36)
  return `${prefix}-${ts}${rand}${counter.toString(36)}`.toUpperCase()
}

export function genToken(bytes: number = 32): string {
  const arr = new Uint8Array(bytes)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
  } else {
    throw new Error('Secure cryptographic functions are not available in this environment')
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
