// Shared application money summary.
//
// An Application row's stored installmentAmount / totalRepayable are
// nullable previews — rows created before approval (e.g. a SUBMITTED
// application that has not been through the approval flow yet) often carry
// NULL there even though every term needed to compute them is present.
// Views used to fall back to principal/installments, which silently drops
// interest and fees (borrower portal showed EMI ₹6,250 / repayable ₹75,000
// for a ₹75,000 @ 18% × 12 application whose real schedule is
// ₹7,437.50 / ₹89,250), or rendered "—" (owner application detail).
//
// This helper is the single source for "what are this application's EMI and
// total repayable": stored values win when present; otherwise the figures
// are derived from the application's own terms with the same schedule
// engine the rest of the app uses (generateSchedulePreview), so every panel
// shows identical numbers for the same application.

import { generateSchedulePreview, type InterestType, type RepaymentFrequency } from './financial-engine'

export interface ApplicationTermsLike {
  principalAmount: number | string | bigint
  interestType?: string | null
  interestRate?: number | string | null // basis points (1% = 100)
  fixedInterest?: number | string | bigint | null // paise
  frequency?: string | null
  installments?: number | null
  processingFee?: number | string | bigint | null // paise
  otherFees?: number | string | bigint | null // paise
  firstDueDate?: string | Date | null
  installmentAmount?: number | string | bigint | null // paise (stored preview)
  totalRepayable?: number | string | bigint | null // paise (stored preview)
}

export interface ApplicationSummary {
  /** Per-installment amount in paise. */
  installmentAmount: number
  /** Total repayable in paise (principal + interest + fees). */
  totalRepayable: number
  /** Total interest in paise. */
  totalInterest: number
  /** Total fees in paise (processing + other). */
  totalFees: number
  /** True when the figures were derived from terms via the schedule engine
   *  (stored preview columns were null); false when stored values were used. */
  computed: boolean
}

function toIntPaise(v: number | string | bigint | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'bigint' ? Number(v) : Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export function summarizeApplication(app: ApplicationTermsLike): ApplicationSummary {
  const principal = toIntPaise(app.principalAmount) ?? 0
  const totalFees = (toIntPaise(app.processingFee) ?? 0) + (toIntPaise(app.otherFees) ?? 0)

  const storedInstallment = toIntPaise(app.installmentAmount)
  const storedTotal = toIntPaise(app.totalRepayable)
  if (storedInstallment !== null && storedTotal !== null) {
    return {
      installmentAmount: storedInstallment,
      totalRepayable: storedTotal,
      totalInterest: Math.max(0, storedTotal - principal - totalFees),
      totalFees,
      computed: false,
    }
  }

  const installments = Math.max(1, Math.trunc(Number(app.installments ?? 1)) || 1)
  const interestType = (app.interestType ?? 'PERCENTAGE') as InterestType
  const frequency = (app.frequency ?? 'MONTHLY') as RepaymentFrequency
  const parsedFirstDue = app.firstDueDate ? new Date(app.firstDueDate) : new Date()
  const firstDueDate = Number.isNaN(parsedFirstDue.getTime()) ? new Date() : parsedFirstDue

  try {
    const preview = generateSchedulePreview({
      principalPaise: BigInt(principal),
      interestType,
      interestRateBps: BigInt(toIntPaise(app.interestRate) ?? 0),
      fixedInterestPaise: BigInt(toIntPaise(app.fixedInterest) ?? 0),
      frequency,
      installments,
      firstDueDate,
      processingFeePaise: BigInt(toIntPaise(app.processingFee) ?? 0),
      otherFeesPaise: BigInt(toIntPaise(app.otherFees) ?? 0),
    })
    return {
      installmentAmount: Number(preview.installmentAmount),
      totalRepayable: Number(preview.totalRepayable),
      totalInterest: Number(preview.totalInterest),
      totalFees: Number(preview.totalFees),
      computed: true,
    }
  } catch {
    // Degenerate terms (e.g. zero principal) — fall back to whatever is
    // stored, else principal-only, rather than throwing in a view.
    const total = storedTotal ?? principal
    return {
      installmentAmount: storedInstallment ?? Math.round(total / installments),
      totalRepayable: total,
      totalInterest: Math.max(0, total - principal - totalFees),
      totalFees,
      computed: true,
    }
  }
}
