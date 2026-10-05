// Structured JSON logger with automatic PII & secret redaction + Sentry/Monitoring webhook hook

const REDACTED_KEY_PATTERN = /password|token|secret|aadhaar|pan|bankaccount|totp|authorization|cookie/i
const AADHAAR_STRING_PATTERN = /\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g
const PAN_STRING_PATTERN = /\b([A-Z]{2})([A-Z]{3})([0-9]{4}[A-Z])\b/g

export function redactString(input: string): string {
  return input
    .replace(AADHAAR_STRING_PATTERN, 'XXXX-XXXX-$3')
    .replace(PAN_STRING_PATTERN, '$1XXX$3')
}

export function redactValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    return redactString(value)
  }
  if (typeof value !== 'object') {
    return value
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      ...(process.env.NODE_ENV !== 'production' && value.stack
        ? { stack: redactString(value.stack) }
        : {}),
    }
  }
  if (seen.has(value as object)) {
    return '[Circular]'
  }
  seen.add(value as object)

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen))
  }

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEY_PATTERN.test(k)) {
      out[k] = '[REDACTED]'
    } else {
      out[k] = redactValue(v, seen)
    }
  }
  return out
}

type LogLevel = 'info' | 'warn' | 'error'

function reportToErrorMonitoring(entry: Record<string, unknown>): void {
  const webhookUrl = process.env.ERROR_MONITORING_WEBHOOK_URL || process.env.SENTRY_WEBHOOK_URL
  if (!webhookUrl) return
  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {})
}

function writeLog(level: LogLevel, message: string, meta?: unknown): void {
  const entry: Record<string, unknown> = {
    level,
    timestamp: new Date().toISOString(),
    message: redactString(String(message)),
  }
  if (meta !== undefined) {
    entry.meta = redactValue(meta)
  }
  const serialized = JSON.stringify(entry)
  if (level === 'error') {
    console.error(serialized)
    reportToErrorMonitoring(entry)
  } else if (level === 'warn') {
    console.warn(serialized)
  } else {
    console.log(serialized)
  }
}

export const logger = {
  info(message: string, meta?: unknown): void {
    writeLog('info', message, meta)
  },
  warn(message: string, meta?: unknown): void {
    writeLog('warn', message, meta)
  },
  error(message: string, meta?: unknown): void {
    writeLog('error', message, meta)
  },
}
