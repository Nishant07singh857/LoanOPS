// Server-side financial engine — BigInt paise, deterministic.
// This is the authoritative financial calculation module for the backend.
// Frontend financial-engine.ts is for previews ONLY; this is the source of truth.

export type InterestType = 'PERCENTAGE' | 'FIXED' | 'NONE'
export type RepaymentFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface ScheduleInput {
  principalPaise: bigint
  interestType: InterestType
  interestRateBps: bigint // 100 = 1%
  fixedInterestPaise: bigint
  frequency: RepaymentFrequency
  installments: number
  firstDueDate: Date
  processingFeePaise: bigint
  otherFeesPaise: bigint
}

export interface InstallmentPlan {
  installmentNumber: number
  dueDate: Date
  openingPrincipal: bigint
  principalComponent: bigint
  interestComponent: bigint
  feesComponent: bigint
  totalDue: bigint
  closingPrincipal: bigint
}

export interface ScheduleResult {
  installments: InstallmentPlan[]
  totalRepayable: bigint
  totalInterest: bigint
  totalFees: bigint
  installmentAmount: bigint
  finalDueDate: Date
}

const BPS_BASE = BigInt(10_000)

// Compute total target interest (flat method — common for short-term lending)
function computeTargetTotalInterest(input: ScheduleInput): bigint {
  const { interestType, interestRateBps, fixedInterestPaise, principalPaise } = input
  if (interestType === 'NONE') return BigInt(0)
  if (interestType === 'FIXED') {
    return fixedInterestPaise > BigInt(0) ? fixedInterestPaise : BigInt(0)
  }
  // Percentage - flat on principal
  return safeDiv(principalPaise * interestRateBps, BPS_BASE)
}

// Compute interest per installment (flat method)
function computeInterestPerInstallment(input: ScheduleInput): bigint {
  const totalInterest = computeTargetTotalInterest(input)
  return safeDiv(totalInterest, BigInt(Math.max(1, input.installments)))
}

// Compute fees per installment
function computeFeesPerInstallment(input: ScheduleInput): bigint {
  const totalFees = input.processingFeePaise + input.otherFeesPaise
  return safeDiv(totalFees, BigInt(Math.max(1, input.installments)))
}

// ============================================================
// SCHEDULE GENERATION — deterministic, closes principal to 0
// ============================================================

export function generateSchedule(input: ScheduleInput): ScheduleResult {
  const principal = input.principalPaise
  const n = Math.max(1, input.installments)
  const targetInterest = computeTargetTotalInterest(input)
  const targetFees = input.processingFeePaise + input.otherFeesPaise
  const interestPer = computeInterestPerInstallment(input)
  const feesPer = computeFeesPerInstallment(input)

  // Principal per installment — rounded down (floor)
  let principalPer = principal / BigInt(n)
  // Last installment takes the residue so principal closes to 0 exactly
  const residuePrincipal = principal - principalPer * BigInt(n - 1)
  // If residue is negative (shouldn't be with floor), fallback to even split
  if (residuePrincipal < BigInt(0)) {
    principalPer = principal / BigInt(n)
  }

  const installments: InstallmentPlan[] = []
  let opening = principal
  let totalInterest = BigInt(0)
  let totalFees = BigInt(0)
  let totalDue = BigInt(0)

  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1
    const principalComponent = isLast ? (principal - principalPer * BigInt(n - 1)) : principalPer
    const interestComponent = isLast
      ? (targetInterest - interestPer * BigInt(n - 1))
      : interestPer
    const feesComponent = isLast
      ? (targetFees - feesPer * BigInt(n - 1))
      : feesPer
    const total = principalComponent + interestComponent + feesComponent
    const closing = opening - principalComponent

    installments.push({
      installmentNumber: i + 1,
      dueDate: addInterval(input.firstDueDate, input.frequency, i),
      openingPrincipal: opening,
      principalComponent,
      interestComponent,
      feesComponent,
      totalDue: total,
      closingPrincipal: closing,
    })

    opening = closing
    totalInterest += interestComponent
    totalFees += feesComponent
    totalDue += total
  }

  return {
    installments,
    totalRepayable: totalDue,
    totalInterest,
    totalFees,
    installmentAmount: installments[0]?.totalDue ?? BigInt(0),
    finalDueDate: installments[installments.length - 1]?.dueDate ?? input.firstDueDate,
  }
}

// ============================================================
// DATE ARITHMETIC — preserves anchor day semantics
// ============================================================

function addInterval(start: Date, frequency: RepaymentFrequency, n: number): Date {
  const d = new Date(start)
  switch (frequency) {
    case 'DAILY':
      d.setDate(d.getDate() + n)
      break
    case 'WEEKLY':
      d.setDate(d.getDate() + n * 7)
      break
    case 'MONTHLY': {
      // Anchor day semantics: if start is 31st, future months use 28/29/30 as applicable
      // Reset date to 1 before setMonth to avoid JS Date overflow into the following month.
      const anchorDay = d.getDate()
      d.setDate(1)
      d.setMonth(d.getMonth() + n)
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(anchorDay, daysInMonth))
      break
    }
  }
  return d
}

// ============================================================
// ALLOCATION ENGINE — FEE → INTEREST → PRINCIPAL (chronological)
// ============================================================

export interface InstallmentState {
  installmentNumber: number
  fees: bigint
  interest: bigint
  principal: bigint
  paidFees: bigint
  paidInterest: bigint
  paidPrincipal: bigint
}

export interface AllocationResult {
  allocatedFees: bigint
  allocatedInterest: bigint
  allocatedPrincipal: bigint
  unallocated: bigint
  perInstallment: Array<{
    installmentNumber: number
    fees: bigint
    interest: bigint
    principal: bigint
  }>
}

export function allocatePayment(
  installments: InstallmentState[],
  paymentAmount: bigint,
): AllocationResult {
  let remaining = paymentAmount
  let allocatedFees = BigInt(0)
  let allocatedInterest = BigInt(0)
  let allocatedPrincipal = BigInt(0)
  const perInstallment: AllocationResult['perInstallment'] = []

  for (const inst of installments) {
    if (remaining <= BigInt(0)) break

    const remainingFees = inst.fees - inst.paidFees
    const remainingInterest = inst.interest - inst.paidInterest
    const remainingPrincipal = inst.principal - inst.paidPrincipal

    const toFees = remaining > BigInt(0) ? minBig(remaining, maxBig(remainingFees, BigInt(0))) : BigInt(0)
    remaining -= toFees
    allocatedFees += toFees

    const toInterest = remaining > BigInt(0) ? minBig(remaining, maxBig(remainingInterest, BigInt(0))) : BigInt(0)
    remaining -= toInterest
    allocatedInterest += toInterest

    const toPrincipal = remaining > BigInt(0) ? minBig(remaining, maxBig(remainingPrincipal, BigInt(0))) : BigInt(0)
    remaining -= toPrincipal
    allocatedPrincipal += toPrincipal

    if (toFees > BigInt(0) || toInterest > BigInt(0) || toPrincipal > BigInt(0)) {
      perInstallment.push({
        installmentNumber: inst.installmentNumber,
        fees: toFees,
        interest: toInterest,
        principal: toPrincipal,
      })
    }
  }

  return {
    allocatedFees,
    allocatedInterest,
    allocatedPrincipal,
    unallocated: remaining > BigInt(0) ? remaining : BigInt(0),
    perInstallment,
  }
}

// ============================================================
// UTILS
// ============================================================

function safeDiv(a: bigint, b: bigint): bigint {
  if (b === BigInt(0)) return BigInt(0)
  return a / b
}

function minBig(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

function maxBig(a: bigint, b: bigint): bigint {
  return a > b ? a : b
}

// Serialize paise as string for safe JSON transport
export function serializePaise(p: bigint): string {
  return p.toString()
}

export function parsePaise(s: string | number | null | undefined): bigint {
  if (s === null || s === undefined || s === '') return BigInt(0)
  try {
    const n = Number(s)
    if (!isFinite(n)) return BigInt(0)
    return BigInt(Math.trunc(n))
  } catch {
    return BigInt(0)
  }
}

// Convert rupees (decimal string) to paise (bigint)
export function rupeesToPaise(rupees: string | number): bigint {
  const n = Number(rupees)
  if (!isFinite(n)) return BigInt(0)
  return BigInt(Math.round(n * 100))
}
