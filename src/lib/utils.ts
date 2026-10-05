import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================
// KYC & BANK MASKING HELPERS
// ============================================================

export function maskAadhaar(aadhaar: string | null | undefined): string {
  if (!aadhaar) return '—'
  const trimmed = String(aadhaar).trim()
  if (!trimmed) return '—'
  if (/^X{4}-X{4}-\d{4}$/i.test(trimmed)) return trimmed.toUpperCase()
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length >= 4) {
    return `XXXX-XXXX-${digits.slice(-4)}`
  }
  return 'XXXX-XXXX-XXXX'
}

export function maskPan(pan: string | null | undefined): string {
  if (!pan) return '—'
  const cleaned = String(pan).trim().toUpperCase().replace(/\s+/g, '')
  if (!cleaned) return '—'
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 2)}XXX${cleaned.slice(5)}`
  }
  if (cleaned.length > 4) {
    return `${'X'.repeat(cleaned.length - 4)}${cleaned.slice(-4)}`
  }
  return cleaned
}

export function maskBankAccount(account: string | null | undefined): string {
  if (!account) return '—'
  const cleaned = String(account).trim().replace(/\s+/g, '')
  if (!cleaned) return '—'
  if (cleaned.length <= 4) return cleaned
  return `XXXX-XXXX-${cleaned.slice(-4)}`
}

// ============================================================
// INPUT VALIDATION PATTERNS (INDIAN KYC & BANKING)
// ============================================================

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
export const AADHAAR_REGEX = /^\d{12}$/
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/
export const BANK_ACCOUNT_REGEX = /^[A-Z0-9]{8,20}$/i
export const MOBILE_REGEX = /^[6-9]\d{9}$/

// ============================================================
// XSS / INJECTION SANITIZATION HELPERS
// ============================================================

export function sanitizeText(input: string | null | undefined): string {
  if (input === null || input === undefined) return ''
  return String(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|applet|meta|link|style|form|input|button)\b[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
}

export function sanitizeInput<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizeText(value) as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeInput(item)) as unknown as T
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
      out[k] = sanitizeInput(v)
    }
    return out as T
  }
  return value
}

