// ============================================================
// INDIAN MOBILE CANONICALIZATION
// ============================================================
// Single source of truth for turning any user-typed mobile spelling
// into the canonical 10-digit Indian mobile (^[6-9]\d{9}$) that is
// stored on Candidate.mobile and used for every lookup.
//
// Why this exists (red-team round 2, R1/R3): the apply/signup
// matchers used to strip only ASCII non-digits and a leading "91".
// Spellings like "09820922448", "0091…", or the same digits typed in
// Devanagari / Arabic-Indic / fullwidth glyphs slipped past the
// existing-mobile check and minted shadow candidate records for an
// already-registered number. Canonicalizing at every write/match
// path makes matching plain equality on the canonical form.

// Unicode decimal-digit blocks folded to ASCII 0-9. JS \d / \D are
// ASCII-only, so these glyphs must be mapped per code point.
const DIGIT_BLOCKS: ReadonlyArray<readonly [number, number]> = [
  [0x0030, 0x0039], // ASCII
  [0x0660, 0x0669], // Arabic-Indic
  [0x06f0, 0x06f9], // Extended Arabic-Indic
  [0x0966, 0x096f], // Devanagari
  [0xff10, 0xff19], // Fullwidth
]

export function foldUnicodeDigits(input: string): string {
  let out = ''
  for (const ch of input) {
    const cp = ch.codePointAt(0) as number
    let mapped = ch
    for (const [lo, hi] of DIGIT_BLOCKS) {
      if (cp >= lo && cp <= hi) {
        mapped = String(cp - lo)
        break
      }
    }
    out += mapped
  }
  return out
}

export const CANONICAL_MOBILE_REGEX = /^[6-9]\d{9}$/

/**
 * Canonicalize a user-supplied mobile to the stored 10-digit form.
 * Returns null when the input cannot be a valid Indian mobile:
 * wrong length after prefix stripping, starts outside [6-9], or
 * contains characters that are not digits / separators.
 *
 * Accepted spellings: the bare 10 digits; a leading 0 (11 digits);
 * country code 91 (12 digits, with or without "+"); the 00-prefixed
 * international form 0091 (14 digits); a trunk 0 before the country
 * code (13 digits, 091…). Spaces, dashes and parentheses anywhere
 * are ignored, and digits may be typed in any supported script.
 */
export function canonicalizeMobile(input: unknown): string | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null
  let digits = foldUnicodeDigits(String(input)).replace(/[\s\-()]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  if (!/^\d+$/.test(digits)) return null

  if (digits.length === 14 && digits.startsWith('0091')) {
    digits = digits.slice(4)
  } else if (digits.length === 13 && digits.startsWith('091')) {
    digits = digits.slice(3)
  } else if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2)
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  return CANONICAL_MOBILE_REGEX.test(digits) ? digits : null
}

export function isCanonicalMobile(value: string): boolean {
  return CANONICAL_MOBILE_REGEX.test(value)
}
