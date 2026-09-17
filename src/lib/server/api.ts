// Standard API response helpers for Next.js App Router route handlers.
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

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
export const unprocessable = (msg = 'Validation Error', details?: unknown) =>
  fail('UNPROCESSABLE', msg, 422, details)
export const tooMany = (msg = 'Too Many Requests') => fail('TOO_MANY', msg, 429)
export const serverError = (msg = 'Server Error') => fail('SERVER_ERROR', msg, 500)

// ============================================================
// ERROR HANDLING WRAPPER
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

export function apiHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  fn: T
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (err: any) {
      // AuthError
      if (err?.statusCode) {
        return fail('AUTH', err.message, err.statusCode)
      }
      // HttpError
      if (err?.status && err?.code) {
        return fail(err.code, err.message, err.status, err.details)
      }
      // Zod
      if (err instanceof ZodError) {
        return unprocessable('Validation failed', err.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })))
      }
      // Prisma known errors
      if (err?.code === 'P2002') {
        return conflict('Resource already exists')
      }
      if (err?.code === 'P2025') {
        return notFound('Record not found')
      }
      console.error('[API ERROR]', err)
      // Don't leak internal error details
      const msg = process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : (err?.message || 'Server Error')
      return serverError(msg)
    }
  }) as T
}

// ============================================================
// VALIDATION
// ============================================================

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input)
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
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  }
}

// ============================================================
// MONEY: safe paise serialization
// ============================================================

export function serializePaise(paise: number): string {
  // Always serialize as string per financial safety rule
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
  // Use Web Crypto API which works in both server and edge
  const arr = new Uint8Array(bytes)
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto) {
    ;(globalThis as any).crypto.getRandomValues(arr)
  } else {
    // Fallback
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}
