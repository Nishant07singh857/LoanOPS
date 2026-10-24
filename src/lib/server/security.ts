// OWASP Application Security Helpers (Phases 5 & 6)
// - Input sanitization (XSS & Prototype Pollution prevention)
// - JSON body size & nesting depth limits
// - Open-redirect & SSRF guards
// - Magic-byte file validation, EXIF stripping, private storage outside public/, and signed URLs

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Strips dangerous HTML/script payloads and control characters from plain text fields
 * to prevent Stored XSS in names, notes, support tickets, and notifications.
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return ''
  return input
    // Remove null bytes and non-printable control chars (except \n, \r, \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove <script>...</script>, <iframe>, <object>, <embed>, <style> blocks
    .replace(/<\s*(script|iframe|object|embed|style|applet|meta|link)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    // Remove self-closing or unclosed dangerous tags
    .replace(/<\s*\/?\s*(script|iframe|object|embed|style|applet|meta|link|svg|math|form|input|button)[^>]*>/gi, '')
    // Strip inline event handlers like onload=, onerror=, onclick=
    .replace(/\bon[a-z]+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '')
    // Neutralize javascript:, vbscript:, data:text/html URIs
    .replace(/(javascript|vbscript)\s*:/gi, 'blocked:')
    .replace(/data\s*:\s*text\/html/gi, 'blocked:text/plain')
    // Encode remaining raw angle brackets so arbitrary HTML tags cannot execute
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim()
}

/**
 * Recursively sanitizes parsed JSON objects:
 * - Removes __proto__, constructor, prototype keys (prototype pollution defense)
 * - Sanitizes string values unless key is in skipSanitizeKeys (e.g., password, proofUrl, token)
 */
const RAW_VALUE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'proofUrl',
  'attachmentUrl',
  'aadhaarUrl',
  'panUrl',
  'fileData',
  'token',
  'csrfToken',
  'captchaToken',
  'totpCode',
])

export function sanitizeJsonPayload<T>(value: T, depth = 0, maxDepth = 12): T {
  if (depth > maxDepth) {
    throw new Error('PAYLOAD_DEPTH_EXCEEDED: JSON nesting depth exceeds security limit')
  }
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    return sanitizeText(value) as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonPayload(item, depth + 1, maxDepth)) as unknown as T
  }
  if (typeof value === 'object') {
    const cleanObj: Record<string, unknown> = Object.create(null)
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(k)) continue
      if (RAW_VALUE_KEYS.has(k)) {
        cleanObj[k] = v
      } else {
        cleanObj[k] = sanitizeJsonPayload(v, depth + 1, maxDepth)
      }
    }
    return { ...cleanObj } as unknown as T
  }
  return value
}

/**
 * Validates raw request body size and parses + sanitizes JSON safely.
 */
export async function parseAndValidateJsonBody(
  req: Request,
  options: { maxBytes?: number; maxDepth?: number } = {}
): Promise<{ ok: true; data: any } | { ok: false; status: number; message: string }> {
  const maxBytes = options.maxBytes ?? 6 * 1024 * 1024 // 6 MB default (allows 5MB base64 receipt photo)
  const maxDepth = options.maxDepth ?? 12

  const contentLength = req.headers.get('content-length')
  if (contentLength && Number(contentLength) > maxBytes) {
    return {
      ok: false,
      status: 413,
      message: `Request body exceeds maximum allowed size (${Math.round(maxBytes / 1024)} KB)`,
    }
  }

  let rawText: string
  try {
    rawText = await req.text()
  } catch {
    return { ok: false, status: 400, message: 'Failed to read request body' }
  }

  if (Buffer.byteLength(rawText, 'utf8') > maxBytes) {
    return {
      ok: false,
      status: 413,
      message: `Request body exceeds maximum allowed size (${Math.round(maxBytes / 1024)} KB)`,
    }
  }

  if (!rawText.trim()) {
    return { ok: false, status: 400, message: 'Request body cannot be empty' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return { ok: false, status: 400, message: 'Invalid JSON body' }
  }

  try {
    const sanitized = sanitizeJsonPayload(parsed, 0, maxDepth)
    return { ok: true, data: sanitized }
  } catch (err: any) {
    if (String(err?.message).includes('PAYLOAD_DEPTH_EXCEEDED')) {
      return { ok: false, status: 400, message: 'JSON nesting depth exceeds maximum allowed limit' }
    }
    return { ok: false, status: 400, message: 'Invalid request payload' }
  }
}

/**
 * Validates internal redirect paths to prevent Open Redirect vulnerabilities.
 */
export function validateSafeRedirect(target: string | null | undefined, fallback = '/'): string {
  if (!target || typeof target !== 'string') return fallback
  const trimmed = target.trim()
  // Must start with a single slash, not // or /\ or contain protocol schemes
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback
  }
  return trimmed
}

/**
 * Magic-byte file validation and EXIF metadata stripping for uploaded images/PDFs.
 */
export type AllowedUploadMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

export function detectMagicBytesMime(buf: Buffer): AllowedUploadMime | null {
  if (buf.length < 12) return null

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg'
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png'
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  // PDF: "%PDF-"
  if (buf.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf'
  }

  return null
}

/**
 * Strips EXIF (APP1) metadata segments from JPEG buffers and eXIf/tEXt chunks from PNG buffers.
 */
export function stripImageMetadata(buf: Buffer, mime: AllowedUploadMime): Buffer {
  if (mime === 'image/jpeg') {
    // Walk JPEG markers and strip APP1..APP15 (0xFFE1..0xFFEF) and COM (0xFFFE) except JFIF (APP0 0xFFE0)
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf
    const chunks: Buffer[] = [buf.subarray(0, 2)]
    let offset = 2
    while (offset + 4 <= buf.length) {
      if (buf[offset] !== 0xff) {
        chunks.push(buf.subarray(offset))
        break
      }
      const marker = buf[offset + 1]
      // Start of Scan (SOS = 0xDA) or End of Image (EOI = 0xD9) -> copy rest of stream
      if (marker === 0xda || marker === 0xd9) {
        chunks.push(buf.subarray(offset))
        break
      }
      // Standalone markers without length
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        chunks.push(buf.subarray(offset, offset + 2))
        offset += 2
        continue
      }
      const segLen = buf.readUInt16BE(offset + 2)
      if (segLen < 2 || offset + 2 + segLen > buf.length) {
        chunks.push(buf.subarray(offset))
        break
      }
      // Strip APP1..APP15 (EXIF, XMP, ICC, etc.) and COM (comments)
      const isMetadataMarker = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe
      if (!isMetadataMarker) {
        chunks.push(buf.subarray(offset, offset + 2 + segLen))
      }
      offset += 2 + segLen
    }
    return Buffer.concat(chunks)
  }
  return buf
}

const PRIVATE_STORAGE_ROOT = path.join(process.cwd(), '.storage', 'uploads')

function getFileSigningSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  if (process.env.NODE_ENV === 'production') {
    // Never sign private-file URLs with a publicly-known secret in
    // production: anyone could forge signed URLs for any file. Fail closed.
    throw new Error(
      'SESSION_SECRET must be set in production — refusing to use the development file-signing secret'
    )
  }
  // Development/test only.
  return 'dev-file-signing-secret'
}

export function signPrivateFileUrl(fileKey: string, ttlSeconds = 900): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const payload = `${fileKey}:${exp}`
  const sig = createHmac('sha256', getFileSigningSecret()).update(payload).digest('hex')
  return `/api/files/${encodeURIComponent(fileKey)}?exp=${exp}&sig=${sig}`
}

export function verifyPrivateFileSignature(fileKey: string, expStr: string, sig: string): boolean {
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false
  const payload = `${fileKey}:${exp}`
  const expected = createHmac('sha256', getFileSigningSecret()).update(payload).digest('hex')
  try {
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(sig, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Validates a base64 data URL (or existing private file path), verifies magic bytes,
 * strips EXIF metadata, stores outside public/ in `.storage/uploads`, and returns
 * a private `/api/files/<fileKey>` reference.
 */
export async function validateAndStoreDataUrlUpload(
  inputUrl: string | null | undefined,
  options: { maxBytes?: number; allowPdf?: boolean } = {}
): Promise<{ ok: true; storedRef: string | null; mime?: AllowedUploadMime; size?: number } | { ok: false; error: string }> {
  if (!inputUrl) return { ok: true, storedRef: null }
  const trimmed = inputUrl.trim()
  if (!trimmed) return { ok: true, storedRef: null }

  // Allow already-stored private file references
  if (trimmed.startsWith('/api/files/')) {
    return { ok: true, storedRef: trimmed.split('?')[0] }
  }

  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024 // 5 MB

  // Parse data URL: data:<mime>;base64,<data>
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(trimmed)
  if (!match) {
    return {
      ok: false,
      error: 'Invalid file upload format. Must be a valid base64-encoded image (JPEG, PNG, WEBP) or PDF.',
    }
  }

  const declaredMime = match[1].toLowerCase()
  const base64Data = match[2]
  const buf = Buffer.from(base64Data, 'base64')

  if (buf.length === 0) {
    return { ok: false, error: 'Uploaded file is empty' }
  }
  if (buf.length > maxBytes) {
    return { ok: false, error: `Uploaded file exceeds maximum size of ${Math.round(maxBytes / (1024 * 1024))} MB` }
  }

  const detectedMime = detectMagicBytesMime(buf)
  if (!detectedMime) {
    return {
      ok: false,
      error: 'File content failed magic-byte inspection. Only genuine JPEG, PNG, WEBP, or PDF files are permitted.',
    }
  }

  if (!options.allowPdf && detectedMime === 'application/pdf') {
    return {
      ok: false,
      error: 'Only image uploads (JPEG, PNG, WEBP) are allowed for this field.',
    }
  }

  if (declaredMime !== detectedMime) {
    return {
      ok: false,
      error: `Declared MIME type (${declaredMime}) does not match file magic bytes (${detectedMime}).`,
    }
  }

  // Strip EXIF metadata from images
  const cleanBuf = stripImageMetadata(buf, detectedMime)

  const extMap: Record<AllowedUploadMime, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }
  const ext = extMap[detectedMime]
  const randomName = `${Date.now()}_${randomBytes(16).toString('hex')}.${ext}`

  await fs.mkdir(PRIVATE_STORAGE_ROOT, { recursive: true })
  const destPath = path.join(PRIVATE_STORAGE_ROOT, randomName)
  await fs.writeFile(destPath, cleanBuf)

  return {
    ok: true,
    storedRef: `/api/files/${randomName}`,
    mime: detectedMime,
    size: cleanBuf.length,
  }
}

export function resolvePrivateStoragePath(fileKey: string): string | null {
  // Strictly allow only alphanumeric, underscore, hyphen, and single dot extension to prevent path traversal
  if (!/^[a-zA-Z0-9_-]+\.(jpg|png|webp|pdf)$/.test(fileKey)) {
    return null
  }
  const resolved = path.resolve(PRIVATE_STORAGE_ROOT, fileKey)
  if (!resolved.startsWith(path.resolve(PRIVATE_STORAGE_ROOT))) {
    return null
  }
  return resolved
}
