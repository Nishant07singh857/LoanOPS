// Financial engine - BigInt-based money calculations in paise
// Authoritative calculations: backend only. This module mirrors the
// schedule/allocation logic so the UI can show accurate *previews*.
// The server remains the source of truth.

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

export interface InstallmentPreview {
  number: number
  dueDate: Date
  openingPrincipal: bigint
  principal: bigint
  interest: bigint
  fees: bigint
  totalDue: bigint
  closingPrincipal: bigint
}

export interface SchedulePreview {
  installments: InstallmentPreview[]
  totalRepayable: bigint
  totalInterest: bigint
  totalFees: bigint
  installmentAmount: bigint
  finalDueDate: Date
}

const BPS_BASE = BigInt(10000)

// Compute interest per installment for flat method (simple, common for short-term lending)
function computeInterestPerInstallment(input: ScheduleInput): bigint {
  const { interestType, interestRateBps, fixedInterestPaise, principalPaise, installments } = input
  if (interestType === 'NONE') return BigInt(0)
  if (interestType === 'FIXED') {
    return fixedInterestPaise / BigInt(Math.max(1, installments))
  }
  // Percentage - flat per installment on principal
  // interest = principal * rate / 10000 / installments (flat method)
  const totalInterest = (principalPaise * interestRateBps) / BPS_BASE
  return totalInterest / BigInt(Math.max(1, installments))
}

export function generateSchedulePreview(input: ScheduleInput): SchedulePreview {
  const principal = input.principalPaise
  const installmentsCount = Math.max(1, input.installments)
  const interestPer = computeInterestPerInstallment(input)
  const feesPer = (input.processingFeePaise + input.otherFeesPaise) / BigInt(installmentsCount)

  // Principal per installment (rounded)
  let principalPer = principal / BigInt(installmentsCount)
  // Last installment takes the residue to avoid rounding drift
  const residuePrincipal = principal - principalPer * BigInt(installmentsCount - 1)

  const installments: InstallmentPreview[] = []
  let opening = principal
  let totalInterest = BigInt(0)
  let totalFees = BigInt(0)
  let totalDue = BigInt(0)

  for (let i = 0; i < installmentsCount; i++) {
    const isLast = i === installmentsCount - 1
    const principalComponent = isLast ? residuePrincipal : principalPer
    const interestComponent = interestPer
    const feesComponent = feesPer
    const totalDueInstallment = principalComponent + interestComponent + feesComponent
    const closing = opening - principalComponent

    installments.push({
      number: i + 1,
      dueDate: addInterval(input.firstDueDate, input.frequency, i),
      openingPrincipal: opening,
      principal: principalComponent,
      interest: interestComponent,
      fees: feesComponent,
      totalDue: totalDueInstallment,
      closingPrincipal: closing,
    })

    opening = closing
    totalInterest += interestComponent
    totalFees += feesComponent
    totalDue += totalDueInstallment
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

function addInterval(start: Date, frequency: RepaymentFrequency, n: number): Date {
  const d = new Date(start)
  switch (frequency) {
    case 'DAILY':
      d.setDate(d.getDate() + n)
      break
    case 'WEEKLY':
      d.setDate(d.getDate() + n * 7)
      break
    case 'MONTHLY':
      d.setMonth(d.getMonth() + n)
      break
  }
  return d
}

// Allocation engine: Payment -> Fees -> Interest -> Principal (chronological installments)
export interface AllocationResult {
  allocatedFees: bigint
  allocatedInterest: bigint
  allocatedPrincipal: bigint
  unallocated: bigint
  installmentAllocations: { installmentNumber: number; fees: bigint; interest: bigint; principal: bigint }[]
}

export function allocatePayment(
  installments: { number: number; fees: bigint; interest: bigint; principal: bigint; paidFees: bigint; paidInterest: bigint; paidPrincipal: bigint }[],
  paymentAmount: bigint,
): AllocationResult {
  let remaining = paymentAmount
  let allocatedFees = BigInt(0)
  let allocatedInterest = BigInt(0)
  let allocatedPrincipal = BigInt(0)
  const installmentAllocations: AllocationResult['installmentAllocations'] = []

  for (const inst of installments) {
    if (remaining <= 0) break
    const remainingFees = inst.fees - inst.paidFees
    const remainingInterest = inst.interest - inst.paidInterest
    const remainingPrincipal = inst.principal - inst.paidPrincipal

    const toFees = remaining > BigInt(0) ? min(remaining, remainingFees) : BigInt(0)
    remaining -= toFees
    allocatedFees += toFees

    const toInterest = remaining > BigInt(0) ? min(remaining, remainingInterest) : BigInt(0)
    remaining -= toInterest
    allocatedInterest += toInterest

    const toPrincipal = remaining > BigInt(0) ? min(remaining, remainingPrincipal) : BigInt(0)
    remaining -= toPrincipal
    allocatedPrincipal += toPrincipal

    if (toFees > BigInt(0) || toInterest > BigInt(0) || toPrincipal > BigInt(0)) {
      installmentAllocations.push({
        installmentNumber: inst.number,
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
    unallocated: remaining,
    installmentAllocations,
  }
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}
