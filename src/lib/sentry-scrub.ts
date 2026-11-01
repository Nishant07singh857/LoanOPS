// PII scrubbing for Sentry error events.
//
// Error payloads from a lending app can carry borrower PII — names,
// mobiles, emails, Aadhaar/PAN numbers, bank account numbers, request
// bodies — in exception messages, breadcrumbs, `extra` data and frame
// variables. This module is the single scrubber every Sentry config
// (client / server / edge) wires into `beforeSend`, alongside
// locked-down `dataCollection` settings:
//
// - request bodies are dropped outright (never scrubbed-and-kept),
// - Authorization / Cookie headers are dropped,
// - the `user` object is dropped (internal ids are not needed to
//   triage an error, and the SDK may attach email/IP when present),
// - every remaining string is pattern-scrubbed for Indian PII shapes
//   (email, PAN, Aadhaar, mobile, IFSC, long digit runs), and object
//   values under PII-shaped keys are redacted wholesale.
//
// Pure and dependency-free (no SDK imports) so it is unit-testable and
// safe to load in any runtime. It mutates the event in place; the
// configs return the same event object afterwards.

/** Structural view of the event fields this scrubber touches. */
export interface ScrubbableEvent {
  message?: string
  user?: unknown
  request?: {
    data?: unknown
    headers?: Record<string, unknown>
    url?: string
    query_string?: unknown
  }
  extra?: Record<string, unknown>
  contexts?: Record<string, unknown>
  tags?: Record<string, unknown>
  breadcrumbs?: Array<{
    message?: string
    data?: Record<string, unknown>
  }>
  exception?: {
    values?: Array<{
      value?: string
      stacktrace?: { frames?: Array<{ vars?: Record<string, unknown> }> }
    }>
  }
}

const REDACTED = '[redacted]'

// Order matters: specific shapes first, generic digit runs last so the
// specific redaction labels survive. The +91 mobile shapes run BEFORE
// the bare 12-digit pattern on purpose: a mobile with country code is
// also exactly 12 digits, and the phone label is the accurate one.
// Conversely a bare 10-digit mobile cannot match inside a longer
// digit run (no word boundary), so a 12-digit Aadhaar is never sliced.
// PAN and IFSC match case-insensitively: both are frequently typed in
// lowercase even though the issued forms are uppercase. The bare-91
// mobile shapes sit with the +91 ones for the same labelling reason.
// The final digit-run rule has no upper bound: no app identifier is a
// bare digit run (business IDs are prefixed and hyphenated), and a
// 19+ digit run is at least as likely to be an account number as a
// 9–18 digit one.
const PII_PATTERNS: Array<[RegExp, string]> = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]'],
  [/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, '[redacted-pan]'],
  [/\b\d{4}[\s-]\d{4}[\s-]\d{4}\b/g, '[redacted-aadhaar]'],
  // Malformed Aadhaar grouping (4-8 instead of 4-4-4) — still 12
  // digits with the separator after the first group.
  [/\b\d{4}[\s-]\d{8}\b/g, '[redacted-aadhaar]'],
  [/\+91[\s-]?\d{5}[\s-]?\d{5}\b/g, '[redacted-mobile]'],
  [/\+91[\s-]?\d{10}\b/g, '[redacted-mobile]'],
  [/\b91[\s-]?\d{5}[\s-]?\d{5}\b/g, '[redacted-mobile]'],
  [/\b91[\s-]?\d{10}\b/g, '[redacted-mobile]'],
  [/\b[6-9]\d{9}\b/g, '[redacted-mobile]'],
  [/\b\d{12}\b/g, '[redacted-aadhaar]'],
  [/\b[A-Z]{4}0[A-Z0-9]{6}\b/gi, '[redacted-ifsc]'],
  [/\b\d{9,}\b/g, '[redacted-number]'],
]

/** Pattern-scrub a single string. Exported for unit tests. */
export function scrubString(value: string): string {
  let out = value
  for (const [pattern, replacement] of PII_PATTERNS) {
    out = out.replace(pattern, replacement)
  }
  return out
}

// Keys whose values are redacted wholesale, whatever they contain.
const SENSITIVE_KEY =
  /pass(word|wd)|secret|token|authorization|cookie|aadhaar|pan\b|bank|account|mobile|phone|email|otp|cvv|\bpin\b/i

function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return scrubString(value)
  if (Array.isArray(value)) {
    return depth > 0 ? value.map((v) => scrubValue(v, depth - 1)) : REDACTED
  }
  if (value && typeof value === 'object') {
    if (depth <= 0) return REDACTED
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : scrubValue(v, depth - 1)
    }
    return out
  }
  return value
}

/**
 * Scrub a Sentry event in place (the configs return the event
 * themselves). Depth-bounded so a pathological payload cannot
 * recurse forever.
 */
export function scrubSentryEvent(event: ScrubbableEvent): void {
  if (typeof event.message === 'string') {
    event.message = scrubString(event.message)
  }

  // The SDK may attach email / username / IP when present in scope.
  if (event.user !== undefined) {
    event.user = undefined
  }

  if (event.request) {
    // Request bodies are where borrower PII concentrates — drop, never keep.
    event.request.data = undefined
    if (typeof event.request.url === 'string') {
      event.request.url = scrubString(event.request.url)
    }
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = scrubString(event.request.query_string)
    }
    if (event.request.headers) {
      const headers: Record<string, unknown> = {}
      for (const [key, v] of Object.entries(event.request.headers)) {
        if (/authorization|cookie/i.test(key)) continue
        headers[key] = typeof v === 'string' ? scrubString(v) : v
      }
      event.request.headers = headers
    }
  }

  if (event.extra) event.extra = scrubValue(event.extra, 5) as Record<string, unknown>
  if (event.contexts) event.contexts = scrubValue(event.contexts, 5) as Record<string, unknown>
  if (event.tags) event.tags = scrubValue(event.tags, 2) as Record<string, unknown>

  if (Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) {
      if (typeof crumb.message === 'string') crumb.message = scrubString(crumb.message)
      if (crumb.data) crumb.data = scrubValue(crumb.data, 4) as Record<string, unknown>
    }
  }

  if (event.exception?.values) {
    for (const exc of event.exception.values) {
      if (typeof exc.value === 'string') exc.value = scrubString(exc.value)
      if (exc.stacktrace?.frames) {
        for (const frame of exc.stacktrace.frames) {
          if (frame.vars) frame.vars = scrubValue(frame.vars, 3) as Record<string, unknown>
        }
      }
    }
  }
}
