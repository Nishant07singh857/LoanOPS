// CLAIM-GATE FOOTPRINT PREDICATE
// Decides whether a pre-created candidate carries a "sensitive
// footprint" and therefore may only be claimed (linked to a new
// portal login) with an owner-issued claim code at signup.
//
// Why this exists (red-team round 2, R4): the gate used to count
// only applications / loans / KYC documents / payments. Staff
// routinely create leads first and type in the prospect's details
// (DOB, address, employer, income, bank, IFSC, UPI, masked
// Aadhaar/PAN) before any application exists — and such a lead
// could be claimed by anyone who knew the mobile number, exposing
// the full lead PII and locking the real person out. Any
// staff-entered PII beyond name + mobile is now footprint too.
// A true empty shell (name + mobile only) may still be claimed
// without a code — that is the designed flow.
//
// Round 3 (P2) completed the field list: email, occupation,
// bankName and existingObligations were the last staff-entered
// fields not counted, so a lead carrying ONLY one of them (say, a
// private email or the prospect's bank's name) was still claimable
// codeless. EVERY staff-entered field on the record now counts.

export interface CandidatePiiFields {
  dob?: Date | string | null
  email?: string | null
  address?: string | null
  occupation?: string | null
  bankName?: string | null
  bankAccount?: string | null
  bankIfsc?: string | null
  upiId?: string | null
  employer?: string | null
  monthlyIncome?: number | null
  existingObligations?: number | null
  aadhaarHash?: string | null
  aadhaarMasked?: string | null
  panMasked?: string | null
}

export interface CandidateFootprintCounts {
  applications: number
  loans: number
  kycDocuments: number
  payments: number
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/** True when the candidate record itself carries staff-entered PII. */
export function candidateCarriesPii(candidate: CandidatePiiFields): boolean {
  return (
    candidate.dob != null ||
    hasText(candidate.email) ||
    hasText(candidate.address) ||
    hasText(candidate.occupation) ||
    hasText(candidate.bankName) ||
    hasText(candidate.bankAccount) ||
    hasText(candidate.bankIfsc) ||
    hasText(candidate.upiId) ||
    hasText(candidate.employer) ||
    candidate.monthlyIncome != null ||
    candidate.existingObligations != null ||
    hasText(candidate.aadhaarHash) ||
    hasText(candidate.aadhaarMasked) ||
    hasText(candidate.panMasked)
  )
}

/** True when a claim code is required before this candidate can be claimed. */
export function candidateRequiresClaimCode(
  candidate: CandidatePiiFields,
  counts: CandidateFootprintCounts
): boolean {
  if (
    counts.applications > 0 ||
    counts.loans > 0 ||
    counts.kycDocuments > 0 ||
    counts.payments > 0
  ) {
    return true
  }
  return candidateCarriesPii(candidate)
}
