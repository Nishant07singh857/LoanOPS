// Auto-reminder engine — pure core (no DB, no env, unit-testable).
//
// Stage selection, PTP suppression and message building live here; the
// DB runner that acts on these decisions is src/lib/server/reminders.ts
// (invoked by scripts/send-reminders.ts and by the payment-verify path).
//
// Calendar math is done in the org timezone (Asia/Kolkata — the app's
// lending market) so a "due tomorrow" reminder means the borrower's
// tomorrow, regardless of the server's own timezone.

import { buildWhatsAppMessage, WHATSAPP_TEMPLATES } from './whatsapp'
import { formatPaiseToINR } from './money'

export const REMINDER_TIMEZONE = 'Asia/Kolkata'

export type ReminderStageCode =
  | 'DUE_SOON_3'
  | 'DUE_SOON_1'
  | 'DUE_TODAY'
  | 'OVERDUE_1'
  | 'OVERDUE_3'
  | 'OVERDUE_7'
  | 'OVERDUE_15'
  | 'OVERDUE_30'
  | 'RECEIPT'

export type ReminderChannelCode = 'PORTAL' | 'WHATSAPP'

/** Stages in firing order (RECEIPT is event-driven, not date-driven). */
export const REMINDER_STAGES: ReminderStageCode[] = [
  'DUE_SOON_3',
  'DUE_SOON_1',
  'DUE_TODAY',
  'OVERDUE_1',
  'OVERDUE_3',
  'OVERDUE_7',
  'OVERDUE_15',
  'OVERDUE_30',
]

const OVERDUE_THRESHOLDS: Array<{ days: number; stage: ReminderStageCode }> = [
  { days: 30, stage: 'OVERDUE_30' },
  { days: 15, stage: 'OVERDUE_15' },
  { days: 7, stage: 'OVERDUE_7' },
  { days: 3, stage: 'OVERDUE_3' },
  { days: 1, stage: 'OVERDUE_1' },
]

// ---------------------------------------------------------------
// Calendar-day math in a timezone
// ---------------------------------------------------------------

const dayParts = new Intl.DateTimeFormat('en-US', {
  timeZone: REMINDER_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The calendar day (YYYY-MM-DD parts) of `date` in the reminder timezone. */
export function calendarDay(date: Date): { y: number; m: number; d: number } {
  const parts = dayParts.formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0')
  return { y: get('year'), m: get('month'), d: get('day') }
}

function dayNumber(date: Date): number {
  const { y, m, d } = calendarDay(date)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/**
 * Whole calendar days from `now`'s day to the due day, in the reminder
 * timezone: +1 = due tomorrow, 0 = due today, -7 = seven days past due.
 */
export function daysUntilDue(dueDate: Date, now: Date): number {
  return dayNumber(dueDate) - dayNumber(now)
}

/**
 * Stage for a day difference, or null when no reminder fires.
 * Due-soon stages fire on their exact day (the runner runs daily, so
 * every installment passes through day 3 and day 1). Overdue stages use
 * latest-threshold semantics: an installment first seen 10 days late
 * gets OVERDUE_7, not a backfill of OVERDUE_1/3 — and each threshold is
 * crossed exactly once, which the (installment, stage, channel) unique
 * guard turns into "at most one send per stage".
 */
export function stageForDayDiff(diff: number): ReminderStageCode | null {
  if (diff === 3) return 'DUE_SOON_3'
  if (diff === 1) return 'DUE_SOON_1'
  if (diff === 0) return 'DUE_TODAY'
  if (diff < 0) {
    const overdueDays = -diff
    for (const t of OVERDUE_THRESHOLDS) {
      if (overdueDays >= t.days) return t.stage
    }
  }
  return null
}

export function stageForDueDate(dueDate: Date, now: Date): ReminderStageCode | null {
  return stageForDayDiff(daysUntilDue(dueDate, now))
}

// ---------------------------------------------------------------
// PTP suppression
// ---------------------------------------------------------------

export interface PtpLike {
  status: string
  promiseDate: Date
}

/**
 * A loan is PTP-covered when it has an ACTIVE promise-to-pay whose
 * promise day is today or later (calendar days, reminder timezone).
 * Once the promise day has passed, coverage ends and reminders resume.
 */
export function isPtpCovered(ptps: PtpLike[], now: Date): boolean {
  const today = dayNumber(now)
  return ptps.some(
    (p) => p.status === 'ACTIVE' && dayNumber(new Date(p.promiseDate)) >= today
  )
}

// ---------------------------------------------------------------
// Messages (wording stays in src/lib/whatsapp.ts templates)
// ---------------------------------------------------------------

export function firstName(fullName: string): string {
  return (fullName || '').trim().split(/\s+/)[0] || 'there'
}

/** Display date for messages, e.g. "5 Nov 2026" (reminder timezone). */
export function formatDueDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: REMINDER_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/** Amount string as used inside the WhatsApp templates (`₹{amount}`). */
export function templateAmount(paise: number): string {
  return (Math.max(0, Math.trunc(paise)) / 100).toLocaleString('en-IN')
}

function templateForStage(stage: ReminderStageCode): string {
  if (stage === 'DUE_TODAY') return WHATSAPP_TEMPLATES.DUE_TODAY
  if (stage.startsWith('OVERDUE')) return WHATSAPP_TEMPLATES.OVERDUE
  return WHATSAPP_TEMPLATES.PAYMENT_REMINDER
}

export interface ReminderMessageInput {
  stage: ReminderStageCode
  orgName: string
  candidateName: string
  loanNumber: string
  installmentNumber: number
  /** Outstanding amount for the installment (totalDue − paidAmount), paise. */
  amountPaise: number
  dueDate: Date
}

export function buildReminderMessage(input: ReminderMessageInput): string {
  return buildWhatsAppMessage(templateForStage(input.stage), {
    candidateName: firstName(input.candidateName),
    loanNumber: input.loanNumber,
    amount: templateAmount(input.amountPaise),
    dueDate: formatDueDate(input.dueDate),
    orgName: input.orgName,
  })
}

export function reminderTitle(stage: ReminderStageCode, installmentNumber: number): string {
  switch (stage) {
    case 'DUE_SOON_3':
    case 'DUE_SOON_1':
      return `Payment reminder — installment ${installmentNumber} due soon`
    case 'DUE_TODAY':
      return `Payment due today — installment ${installmentNumber}`
    case 'RECEIPT':
      return 'Payment received'
    default:
      return `Payment overdue — installment ${installmentNumber}`
  }
}

/** Portal notification type for a stage (NotificationType enum values). */
export function notificationTypeForStage(stage: ReminderStageCode): string {
  if (stage === 'RECEIPT') return 'RECEIPT'
  if (stage.startsWith('OVERDUE')) return 'OVERDUE'
  return 'PAYMENT_REMINDER'
}

export interface ReceiptMessageInput {
  orgName: string
  candidateName: string
  loanNumber: string
  amountPaise: number
  receiptNumber?: string | null
}

/** Portal title/body + WhatsApp text for a verified payment. */
export function buildReceiptMessage(input: ReceiptMessageInput): {
  title: string
  portalBody: string
  whatsappText: string
} {
  const amount = formatPaiseToINR(input.amountPaise)
  const first = firstName(input.candidateName)
  const receiptBit = input.receiptNumber ? ` Receipt ${input.receiptNumber}.` : ''
  return {
    title: 'Payment received',
    portalBody: `We have received your payment of ${amount} for loan ${input.loanNumber}.${receiptBit} Thank you!`,
    whatsappText: buildWhatsAppMessage(WHATSAPP_TEMPLATES.RECEIPT, {
      candidateName: first,
      loanNumber: input.loanNumber,
      amount: templateAmount(input.amountPaise),
      orgName: input.orgName,
    }),
  }
}
