// ID & number generators — a leaf module (no imports) so unit tests
// and standalone scripts (the seed) can use the generators without
// loading the whole API stack (db, rate limiting, env validation).
// Re-exported from src/lib/server/api.ts, where route handlers have
// always imported them. Same leaf pattern as prisma-errors.ts and
// password-policy.ts (red-team round 3).

let counter = 0
export function genNumber(prefix: string): string {
  counter += 1
  const ts = Date.now().toString(36)
  // Random segment from the CSPRNG (via genToken), never the non-crypto built-in PRNG:
  // these numbers identify payments, applications and tickets, and a
  // predictable generator would make them enumerable in sequence.
  const rand = parseInt(genToken(2), 16).toString(36)
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
