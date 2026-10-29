// Auto-reminder runner — the DB half of the reminder engine.
//
// Pure decisions (which stage fires, PTP suppression, message text) live
// in src/lib/reminders.ts. This module acts on them:
//
//   PORTAL channel   — a borrower Notification in the portal (always on).
//   WHATSAPP channel — Meta Cloud API send when WHATSAPP_API_TOKEN +
//                      WHATSAPP_PHONE_NUMBER_ID are configured; otherwise
//                      a staff CollectionTask carrying the wa.me draft
//                      link (status QUEUED). Nothing is ever logged as
//                      sent that was not actually delivered.
//
// Idempotency: every action first CLAIMS a ReminderLog row under the
// (installmentId | paymentId, stage, channel) unique constraint. A claim
// that finds the row already present means another run handled it.
//
// Kill switch: Organization.remindersEnabled = false short-circuits both
// the scheduled runner and the receipt path for that org.

import { db } from '@/lib/db'
import { logger } from '@/lib/server/logger'
import {
  buildReceiptMessage,
  buildReminderMessage,
  isPtpCovered,
  notificationTypeForStage,
  reminderTitle,
  stageForDueDate,
  type ReminderChannelCode,
  type ReminderStageCode,
} from '@/lib/reminders'
import { buildWhatsAppLink } from '@/lib/whatsapp'
import { isWhatsAppApiConfigured, sendWhatsAppText } from './whatsapp-sender'

const CHANNELS: ReminderChannelCode[] = ['PORTAL', 'WHATSAPP']

export interface ReminderRunSummary {
  dryRun: boolean
  organizations: number
  installmentsEvaluated: number
  sent: number
  queued: number
  skippedPtp: number
  failed: number
  alreadyLogged: number
  noStage: number
}

interface ClaimInput {
  organizationId: string
  candidateId: string
  loanId: string
  installmentId?: string | null
  paymentId?: string | null
  stage: ReminderStageCode
  channel: ReminderChannelCode
  status: 'QUEUED' | 'SKIPPED_PTP'
  message: string
}

/**
 * Claims a ReminderLog row. Returns null when the row already exists.
 * Uses createMany + skipDuplicates (INSERT … ON CONFLICT DO NOTHING) so
 * the routine "already claimed" outcome of every re-run is a silent
 * no-op rather than a unique-violation error in the logs; the unique
 * constraint remains the ultimate guard against racing runners.
 */
async function claimReminder(data: ClaimInput) {
  const row = {
    organizationId: data.organizationId,
    candidateId: data.candidateId,
    loanId: data.loanId,
    installmentId: data.installmentId ?? null,
    paymentId: data.paymentId ?? null,
    stage: data.stage,
    channel: data.channel,
    status: data.status,
    message: data.message,
  }
  const result = await db.reminderLog.createMany({ data: [row], skipDuplicates: true })
  if (result.count === 0) return null
  return db.reminderLog.findFirst({
    where: {
      organizationId: data.organizationId,
      stage: data.stage,
      channel: data.channel,
      ...(data.installmentId
        ? { installmentId: data.installmentId }
        : { paymentId: data.paymentId }),
    },
  })
}

async function settleClaim(id: string, status: 'SENT' | 'FAILED', error?: string) {
  await db.reminderLog.update({
    where: { id },
    data: { status, ...(error ? { error } : {}) },
  })
}

interface WhatsAppDelivery {
  mobile: string
  text: string
  organizationId: string
  candidateId: string
  candidateName: string
  loanId: string
  loanNumber: string
  assignedAgentId: string | null
  amountPaise: number
  dueDate: Date
  taskTitle: string
}

/**
 * Delivers one WhatsApp-channel message for a claimed ReminderLog row:
 * API send when configured (row settles SENT/FAILED), otherwise a staff
 * task with the wa.me draft (row stays QUEUED — a human still sends it).
 */
async function deliverWhatsApp(
  logId: string,
  d: WhatsAppDelivery
): Promise<'SENT' | 'QUEUED' | 'FAILED'> {
  if (isWhatsAppApiConfigured()) {
    const result = await sendWhatsAppText(d.mobile, d.text)
    if (result.ok) {
      await settleClaim(logId, 'SENT')
      return 'SENT'
    }
    await settleClaim(logId, 'FAILED', result.error ?? 'WhatsApp send failed')
    return 'FAILED'
  }

  const link = buildWhatsAppLink(d.mobile, d.text)
  await db.collectionTask.create({
    data: {
      organizationId: d.organizationId,
      candidateId: d.candidateId,
      loanId: d.loanId,
      assignedToId: d.assignedAgentId,
      title: d.taskTitle,
      description:
        `Auto-reminder for ${d.candidateName} (loan ${d.loanNumber}).\n\n` +
        `Message:\n${d.text}\n\nSend it on WhatsApp: ${link}`,
      amount: d.amountPaise,
      dueDate: d.dueDate,
      priority: 'MEDIUM',
      status: d.assignedAgentId ? 'ASSIGNED' : 'OPEN',
    },
  })
  return 'QUEUED'
}

// ---------------------------------------------------------------
// Scheduled installment reminders
// ---------------------------------------------------------------

export interface RunRemindersOptions {
  organizationId?: string
  dryRun?: boolean
  now?: Date
}

export async function runReminders(
  options: RunRemindersOptions = {}
): Promise<ReminderRunSummary> {
  const now = options.now ?? new Date()
  const dryRun = options.dryRun ?? false
  const summary: ReminderRunSummary = {
    dryRun,
    organizations: 0,
    installmentsEvaluated: 0,
    sent: 0,
    queued: 0,
    skippedPtp: 0,
    failed: 0,
    alreadyLogged: 0,
    noStage: 0,
  }

  const orgs = await db.organization.findMany({
    where: {
      remindersEnabled: true,
      ...(options.organizationId ? { id: options.organizationId } : {}),
    },
    select: { id: true, name: true },
  })
  summary.organizations = orgs.length

  for (const org of orgs) {
    // Unpaid / partially-paid installments on ACTIVE loans only.
    // paidAmount < totalDue is filtered in memory (a column-vs-column
    // comparison Prisma cannot express) — same pattern as overdue.ts.
    const installments = await db.installment.findMany({
      where: {
        status: { not: 'PAID' },
        loan: { organizationId: org.id, status: 'ACTIVE' },
      },
      include: {
        loan: {
          include: {
            candidate: {
              select: {
                id: true,
                fullName: true,
                mobile: true,
                userId: true,
                assignedAgentId: true,
              },
            },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }],
    })

    const open = installments.filter((i) => i.paidAmount < i.totalDue)
    summary.installmentsEvaluated += open.length
    if (open.length === 0) continue

    // Active PTPs per loan, for suppression.
    const loanIds = [...new Set(open.map((i) => i.loanId))]
    const ptps = await db.ptp.findMany({
      where: { loanId: { in: loanIds }, status: 'ACTIVE' },
      select: { loanId: true, status: true, promiseDate: true },
    })
    const ptpsByLoan = new Map<string, typeof ptps>()
    for (const p of ptps) {
      const list = ptpsByLoan.get(p.loanId) ?? []
      list.push(p)
      ptpsByLoan.set(p.loanId, list)
    }

    for (const inst of open) {
      const stage = stageForDueDate(new Date(inst.dueDate), now)
      if (!stage) {
        summary.noStage++
        continue
      }
      const loan = inst.loan
      const candidate = loan.candidate
      const amountPaise = inst.totalDue - inst.paidAmount
      const message = buildReminderMessage({
        stage,
        orgName: org.name,
        candidateName: candidate.fullName,
        loanNumber: loan.loanNumber,
        installmentNumber: inst.installmentNumber,
        amountPaise,
        dueDate: new Date(inst.dueDate),
      })
      const covered = isPtpCovered(ptpsByLoan.get(loan.id) ?? [], now)

      for (const channel of CHANNELS) {
        if (covered) {
          if (dryRun) {
            summary.skippedPtp++
            continue
          }
          const row = await claimReminder({
            organizationId: org.id,
            candidateId: candidate.id,
            loanId: loan.id,
            installmentId: inst.id,
            stage,
            channel,
            status: 'SKIPPED_PTP',
            message,
          })
          if (row) summary.skippedPtp++
          else summary.alreadyLogged++
          continue
        }

        if (dryRun) {
          // No API is configured in a dry run's world unless env says so;
          // count the honest outcome each channel WOULD produce.
          if (channel === 'PORTAL') summary.sent++
          else if (isWhatsAppApiConfigured()) summary.sent++
          else summary.queued++
          continue
        }

        const row = await claimReminder({
          organizationId: org.id,
          candidateId: candidate.id,
          loanId: loan.id,
          installmentId: inst.id,
          stage,
          channel,
          status: 'QUEUED',
          message,
        })
        if (!row) {
          summary.alreadyLogged++
          continue
        }

        try {
          if (channel === 'PORTAL') {
            await db.notification.create({
              data: {
                organizationId: org.id,
                userId: candidate.userId ?? null,
                candidateId: candidate.id,
                type: notificationTypeForStage(stage) as any,
                title: reminderTitle(stage, inst.installmentNumber),
                message,
                metadata: {
                  loanId: loan.id,
                  installmentId: inst.id,
                  stage,
                  channel,
                },
              },
            })
            await settleClaim(row.id, 'SENT')
            summary.sent++
          } else {
            const outcome = await deliverWhatsApp(row.id, {
              mobile: candidate.mobile,
              text: message,
              organizationId: org.id,
              candidateId: candidate.id,
              candidateName: candidate.fullName,
              loanId: loan.id,
              loanNumber: loan.loanNumber,
              assignedAgentId: candidate.assignedAgentId,
              amountPaise,
              dueDate: new Date(inst.dueDate),
              taskTitle: `WhatsApp reminder — ${candidate.fullName} (installment ${inst.installmentNumber})`,
            })
            if (outcome === 'SENT') summary.sent++
            else if (outcome === 'QUEUED') summary.queued++
            else summary.failed++
          }
        } catch (err) {
          logger.error('Reminder delivery failed', {
            reminderLogId: row.id,
            stage,
            channel,
            error: err instanceof Error ? err.message : String(err),
          })
          await settleClaim(
            row.id,
            'FAILED',
            err instanceof Error ? err.message.slice(0, 500) : 'Delivery failed'
          ).catch(() => undefined)
          summary.failed++
        }
      }
    }
  }

  return summary
}

// ---------------------------------------------------------------
// Receipt notifications (owner payment VERIFY success path only)
// ---------------------------------------------------------------

export interface ReceiptNotificationInput {
  paymentId: string
  organizationId: string
  receiptNumber?: string | null
}

/**
 * Sends the "Payment received" receipt for a VERIFIED payment: portal
 * notification + WhatsApp channel under the same rules as the scheduled
 * engine. Idempotent per payment via the (paymentId, stage, channel)
 * unique guard, so a retried verify can never double-notify. Never
 * throws — a receipt problem must not fail the verification itself.
 */
export async function notifyPaymentReceipt(
  input: ReceiptNotificationInput
): Promise<{ sent: number; queued: number; skipped: boolean }> {
  const counts = { sent: 0, queued: 0, skipped: false }
  try {
    const payment = await db.payment.findFirst({
      where: { id: input.paymentId, organizationId: input.organizationId },
      include: {
        loan: { select: { id: true, loanNumber: true } },
        candidate: {
          select: {
            id: true,
            fullName: true,
            mobile: true,
            userId: true,
            assignedAgentId: true,
          },
        },
        organization: { select: { id: true, name: true, remindersEnabled: true } },
      },
    })
    if (!payment) {
      counts.skipped = true
      return counts
    }
    if (!payment.organization.remindersEnabled) {
      counts.skipped = true
      return counts
    }

    const org = payment.organization
    const candidate = payment.candidate
    const receiptNumber = input.receiptNumber ?? payment.receiptNumber
    const built = buildReceiptMessage({
      orgName: org.name,
      candidateName: candidate.fullName,
      loanNumber: payment.loan.loanNumber,
      amountPaise: payment.amount,
      receiptNumber,
    })
    const receiptPath = `/portal/receipts/${payment.id}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
    const whatsappText = appUrl
      ? `${built.whatsappText} View your receipt: ${appUrl}${receiptPath}`
      : built.whatsappText

    // PORTAL channel
    const portalRow = await claimReminder({
      organizationId: org.id,
      candidateId: candidate.id,
      loanId: payment.loanId,
      paymentId: payment.id,
      stage: 'RECEIPT',
      channel: 'PORTAL',
      status: 'QUEUED',
      message: built.portalBody,
    })
    if (portalRow) {
      await db.notification.create({
        data: {
          organizationId: org.id,
          userId: candidate.userId ?? null,
          candidateId: candidate.id,
          type: 'RECEIPT',
          title: built.title,
          message: built.portalBody,
          metadata: {
            paymentId: payment.id,
            loanId: payment.loanId,
            receiptNumber,
            receiptPath,
            stage: 'RECEIPT',
            channel: 'PORTAL',
          },
        },
      })
      await settleClaim(portalRow.id, 'SENT')
      counts.sent++
    }

    // WHATSAPP channel
    const waRow = await claimReminder({
      organizationId: org.id,
      candidateId: candidate.id,
      loanId: payment.loanId,
      paymentId: payment.id,
      stage: 'RECEIPT',
      channel: 'WHATSAPP',
      status: 'QUEUED',
      message: whatsappText,
    })
    if (waRow) {
      const outcome = await deliverWhatsApp(waRow.id, {
        mobile: candidate.mobile,
        text: whatsappText,
        organizationId: org.id,
        candidateId: candidate.id,
        candidateName: candidate.fullName,
        loanId: payment.loanId,
        loanNumber: payment.loan.loanNumber,
        assignedAgentId: candidate.assignedAgentId,
        amountPaise: payment.amount,
        dueDate: new Date(),
        taskTitle: `WhatsApp receipt — ${candidate.fullName} (${payment.paymentNumber})`,
      })
      if (outcome === 'SENT') counts.sent++
      else if (outcome === 'QUEUED') counts.queued++
    }

    return counts
  } catch (err) {
    logger.error('Receipt notification failed', {
      paymentId: input.paymentId,
      error: err instanceof Error ? err.message : String(err),
    })
    return counts
  }
}
