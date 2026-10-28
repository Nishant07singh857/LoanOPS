// ============================================================
// SHARED LOAN-TERMS VALIDATION
// ============================================================
// One validator for every path that writes loan terms: the public
// apply endpoint, owner/agent application creation, application
// approval (final terms re-checked before a loan exists), and QR
// link presets on both mint routes (a preset smuggling uncapped
// terms is re-checked again at apply time).
//
// Why this exists (red-team round 2, N3/N5): terms were bounded
// only by per-route Zod schemas with gaps — there was no interest
// ceiling on apply / owner create / agent QR presets (a 10,000%
// application could be created three ways), principal "0" was
// accepted and approved into a real zero-value loan, and a
// principal beyond the Int32 paise column overflowed Prisma into
// a 500 instead of a clean 422.

// Money is Int paise end-to-end. The ceiling mirrors the existing
// candidate-submit cap (MAX_LOAN_PAISE in the candidate application
// submit route): ₹1 crore.
export const MIN_PRINCIPAL_PAISE = 100 // ₹1
export const MAX_PRINCIPAL_PAISE = 1_000_000_000 // ₹1 crore in paise
// Rates are stored in basis points (100 bps = 1%; see the financial
// engine). 100% = 10,000 bps — the ceiling the owner QR-mint schema
// already used; the agent mint had none.
export const MAX_INTEREST_RATE_BPS = 10_000
// Existing schema convention across apply / create / mint routes.
export const MAX_INSTALLMENTS = 360

const INT32_MAX = BigInt(2_147_483_647)

export interface LoanTermsInput {
  /** Paise, as a digit string (API payloads), number, or bigint. */
  principalPaise?: string | number | bigint | null
  interestType?: string | null
  /** Basis points (100 = 1%). */
  interestRateBps?: number | null
  installments?: number | null
}

export type LoanTermsCheck = { ok: true } | { ok: false; error: string }

function parsePrincipal(value: string | number | bigint): bigint | null {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    return Number.isInteger(value) ? BigInt(value) : null
  }
  if (!/^\d+$/.test(value.trim())) return null
  try {
    return BigInt(value.trim())
  } catch {
    return null
  }
}

/**
 * Validate whichever term fields are present (QR presets are
 * partial by design — only the fields a preset actually carries are
 * checked; the resolved full terms are checked again at apply /
 * create / approve time). Returns the first violation found.
 */
export function validateLoanTerms(terms: LoanTermsInput): LoanTermsCheck {
  if (terms.principalPaise !== undefined && terms.principalPaise !== null) {
    const principal = parsePrincipal(terms.principalPaise)
    if (principal === null || principal < BigInt(0)) {
      return { ok: false, error: 'Principal amount must be a valid non-negative amount' }
    }
    // Guard the Int32 paise column explicitly, BEFORE any insert:
    // an overflowing principal must be a 422, never a Prisma 500.
    if (principal > INT32_MAX) {
      return { ok: false, error: 'Principal amount exceeds the maximum supported amount' }
    }
    if (principal > BigInt(MAX_PRINCIPAL_PAISE)) {
      return { ok: false, error: 'Principal amount must not exceed ₹1 crore' }
    }
    if (principal < BigInt(MIN_PRINCIPAL_PAISE)) {
      return { ok: false, error: 'Principal amount must be at least ₹1' }
    }
  }

  if (terms.interestRateBps !== undefined && terms.interestRateBps !== null) {
    const rate = terms.interestRateBps
    if (!Number.isInteger(rate) || rate < 0) {
      return { ok: false, error: 'Interest rate must be a valid non-negative value' }
    }
    if (rate > MAX_INTEREST_RATE_BPS) {
      return { ok: false, error: 'Interest rate must not exceed 100%' }
    }
    if (rate === 0 && terms.interestType === 'PERCENTAGE') {
      return { ok: false, error: 'Interest rate must be greater than zero for percentage loans' }
    }
  }

  if (terms.installments !== undefined && terms.installments !== null) {
    const n = terms.installments
    if (!Number.isInteger(n) || n < 1 || n > MAX_INSTALLMENTS) {
      return { ok: false, error: `Installments must be between 1 and ${MAX_INSTALLMENTS}` }
    }
  }

  return { ok: true }
}
