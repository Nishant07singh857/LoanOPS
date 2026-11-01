// PASSWORD POLICY (extracted from auth.ts so unit tests can import
// it without loading the db-backed auth stack — the CI unit step
// runs with no database environment configured).

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

// BREACHED-PASSWORD VARIANTS (red-team round 3, P5)
//
// The exact-match set above is finite by construction: `Password123!`
// — a top-10 entry in every public breach corpus — is not a member
// and was accepted on every creation path. Attackers mutate listed
// passwords in predictable ways (case, decorative digit/symbol
// tails, leetspeak), so the policy also rejects passwords whose
// NORMALIZED BASE is a listed password, under this exact rule:
//
//   base(pw) = leetDecode(stripTrailingNonLetters(lowercase(pw)))
//
// - The tail strip runs BEFORE decoding, so a separator tail like
//   the "@123" in "password@123" is stripped as decoration instead
//   of being decoded into the base as a letter.
// - leetDecode is deliberately light: 0→o, 1→i, 3→e, 4→a, 5→s,
//   7→t, @→a, $→s (applied to what remains after the tail strip, so
//   "p@ssw0rd" still normalizes to "password").
// - REJECT when base(pw) exactly equals base(listed) for any listed
//   password (bases shorter than 3 chars are ignored).
// - REJECT when base(pw) CONTAINS one of the notorious bases
//   {password, qwerty, letmein, welcome, admin} and the characters
//   outside that base total at most 4 — the password is then the
//   base wearing a thin disguise ("xpassword99", "qwerty!!" after
//   normalization), not a passphrase. A strong passphrase that merely
//   contains a common word amid substantially more material (e.g.
//   "Monsoon!Tiger7Bridge") has far more than 4 characters outside
//   any notorious base and is NOT rejected by this rule.
const LEET_DECODE_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
}

function leetDecode(value: string): string {
  return value.replace(/[013457@$]/g, (ch) => LEET_DECODE_MAP[ch] ?? ch)
}

function breachedBaseForm(password: string): string {
  const lowered = password.toLowerCase()
  const tailStripped = lowered.replace(/[^a-z]+$/, '')
  return leetDecode(tailStripped)
}

const BREACHED_BASES = new Set(
  [...BREACHED_OR_COMMON_PASSWORDS]
    .map((listed) => breachedBaseForm(listed))
    .filter((base) => base.length >= 3)
)

const NOTORIOUS_BASES = ['password', 'qwerty', 'letmein', 'welcome', 'admin'] as const
const MAX_NOTORIOUS_PADDING = 4

function isBreachedPasswordVariant(plain: string): boolean {
  const base = breachedBaseForm(plain)
  if (base.length >= 3 && BREACHED_BASES.has(base)) return true
  for (const notorious of NOTORIOUS_BASES) {
    if (base.includes(notorious) && base.length - notorious.length <= MAX_NOTORIOUS_PADDING) {
      return true
    }
  }
  return false
}

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
  if (BREACHED_OR_COMMON_PASSWORDS.has(lower) || isBreachedPasswordVariant(plain)) {
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
