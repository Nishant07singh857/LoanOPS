// Shared DPDP consent-contract helpers (pure — no DB, no framework).
//
// The rule (A-to-Z pre-launch QA, defect D1): a ConsentRecord may only
// ever be written for a consent the requester actually submitted, with
// the granted value they submitted. Account-creation flows additionally
// require their mandatory consents to be present in the request with
// granted === true; anything else is rejected with a clean 422 BEFORE
// any account or record is created — a grant is never invented to fill
// a gap in the request.

export interface SubmittedConsent {
  consentType: string
  granted: boolean
  policyVersion?: string
}

/**
 * Mandatory consents for POST /api/auth/signup. The signup UI collects
 * exactly these two as blocking checkboxes (plus an optional
 * COMMUNICATION preference) and always submits them granted — verified
 * against src/app/signup/page.tsx, so enforcing the pair server-side
 * cannot break the product flow.
 */
export const SIGNUP_REQUIRED_CONSENTS = ['DATA_PROCESSING', 'TERMS_PRIVACY'] as const

/**
 * Mandatory consents for POST /api/apply/[token] (public QR apply). The
 * apply UI gates submission on all four checkboxes and always submits
 * them granted (plus an optional COMMUNICATION preference) — verified
 * against src/app/apply/[token]/page.tsx.
 */
export const APPLY_REQUIRED_CONSENTS = [
  'DATA_PROCESSING',
  'KYC_AADHAAR',
  'CREDIT_CHECK',
  'KFS_DISCLOSURE',
] as const

/**
 * Mandatory consents for POST /api/candidate/application/submit WHEN the
 * request carries an itemised `consents` array. The portal submit UI
 * collects exactly these two as required acknowledgements (alongside the
 * agreement acceptance) plus KYC_AADHAAR / CREDIT_CHECK as separate,
 * genuinely optional toggles, and always submits the mandatory pair
 * granted — so enforcing the pair server-side cannot break the product
 * flow. When `consents` is absent entirely, the endpoint keeps its
 * historical behaviour (four records derived from agreementAccepted);
 * the gate only governs requests that DO itemise, and for those it
 * applies the same D1 rule as signup/apply: mandatory pair present +
 * granted, else 422 before any write, and exactly the submitted entries
 * are recorded (including granted=false optionals).
 */
export const SUBMIT_REQUIRED_CONSENTS = ['DATA_PROCESSING', 'TERMS_PRIVACY'] as const

/**
 * Returns the subset of `required` consent types NOT satisfied by the
 * submitted list — absent entirely, or present with granted !== true.
 * When a type is submitted more than once, the LAST entry wins (the
 * same latest-state-per-type rule the consent history read path uses).
 */
export function missingRequiredConsents(
  submitted: readonly SubmittedConsent[] | undefined | null,
  required: readonly string[]
): string[] {
  const latest = new Map<string, boolean>()
  for (const c of submitted ?? []) {
    latest.set(c.consentType, c.granted)
  }
  return required.filter((t) => latest.get(t) !== true)
}
