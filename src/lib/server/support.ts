// Support ticket thread + status-walk — server-side shared logic
// for the candidate / owner / agent support routes (feature gap D3).
//
// Access rules mirror the pre-existing support surfaces exactly:
//  - Borrower: only tickets whose candidateId is their own profile.
//  - Owner: every ticket in their organization.
//  - Agent: only tickets for candidates ASSIGNED to them — the same
//    scope as GET /api/agent/support's list filter.
// A ticket outside the caller's scope is indistinguishable from a
// missing one (routes answer 404), matching the house pattern of
// org-scoped findFirst lookups.
//
// Notifications follow the existing support conventions: rows use
// the AI_INSIGHT type with metadata { ticketId } (the same shape the
// ticket-creation routes have always written), and borrower-facing
// rows carry candidateId so they surface in the portal's
// notification list (userId set too when the borrower has claimed
// their portal account).

import { db } from '@/lib/db'
import { audit, type AuthContext } from '@/lib/server/auth'
import { canTransitionSupportStatus, type SupportStatusValue } from '@/lib/support'

export const supportTicketInclude = {
  candidate: {
    select: {
      id: true,
      fullName: true,
      mobile: true,
      userId: true,
      assignedAgentId: true,
    },
  },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  },
} as const

export type SupportTicketWithThread = NonNullable<
  Awaited<ReturnType<typeof loadTicketForBorrower>>
>

/** Borrower scope: the ticket must belong to the caller's own candidate profile. */
export async function loadTicketForBorrower(ctx: AuthContext, ticketId: string) {
  if (!ctx.user.candidateId) return null
  return db.supportTicket.findFirst({
    where: { id: ticketId, candidateId: ctx.user.candidateId },
    include: supportTicketInclude,
  })
}

/**
 * Staff scope: owner → any ticket in the org; agent → only tickets
 * whose candidate is assigned to them (same rule as the agent list).
 */
export async function loadTicketForStaff(ctx: AuthContext, ticketId: string) {
  const ticket = await db.supportTicket.findFirst({
    where: { id: ticketId, organizationId: ctx.user.organizationId },
    include: supportTicketInclude,
  })
  if (!ticket) return null
  if (ctx.user.role === 'AGENT') {
    const agentProfile = await db.agentProfile.findUnique({ where: { userId: ctx.user.id } })
    if (!agentProfile || ticket.candidate.assignedAgentId !== agentProfile.id) return null
  }
  return ticket
}

/** Serialize a loaded ticket + thread for an API response. */
export function serializeTicketThread(ticket: SupportTicketWithThread, viewerUserId: string) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    category: ticket.category,
    subject: ticket.subject,
    description: ticket.description,
    attachmentUrl: ticket.attachmentUrl,
    status: ticket.status,
    resolution: ticket.resolution,
    candidate: {
      id: ticket.candidate.id,
      fullName: ticket.candidate.fullName,
      mobile: ticket.candidate.mobile,
    },
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    messages: ticket.messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      author: { id: m.author.id, name: m.author.name, role: m.author.role },
      mine: m.author.id === viewerUserId,
    })),
  }
}

async function notifyBorrower(
  ticket: SupportTicketWithThread,
  title: string,
  message: string,
) {
  await db.notification.create({
    data: {
      organizationId: ticket.organizationId,
      userId: ticket.candidate.userId ?? null,
      candidateId: ticket.candidateId,
      type: 'AI_INSIGHT',
      title,
      message,
      isRead: false,
      metadata: { ticketId: ticket.id },
    },
  })
}

async function notifyStaffOfBorrowerReply(
  ctx: AuthContext,
  ticket: SupportTicketWithThread,
  body: string,
) {
  // Owners — the same createMany fan-out the ticket-creation route uses.
  const owners = await db.user.findMany({
    where: { organizationId: ticket.organizationId, role: 'OWNER', isActive: true },
    select: { id: true },
  })
  const recipients = new Set(owners.map((o) => o.id))
  // Plus the assigned agent's user account, if the candidate has one.
  if (ticket.candidate.assignedAgentId) {
    const profile = await db.agentProfile.findUnique({
      where: { id: ticket.candidate.assignedAgentId },
      select: { userId: true },
    })
    if (profile) recipients.add(profile.userId)
  }
  // Never notify the author about their own reply.
  recipients.delete(ctx.user.id)
  if (recipients.size === 0) return
  await db.notification.createMany({
    data: [...recipients].map((userId) => ({
      organizationId: ticket.organizationId,
      userId,
      type: 'AI_INSIGHT' as const,
      title: 'New reply on support ticket',
      message: `${ticket.candidate.fullName} replied on ticket ${ticket.ticketNumber}: ${body.slice(0, 120)}`,
      isRead: false,
      metadata: { ticketId: ticket.id },
    })),
  })
}

/**
 * Append a reply to the thread, notify the other side, and audit it.
 * Callers load the ticket through the scope loaders above first.
 * Replies on CLOSED tickets are refused (terminal state) — the
 * caller maps the returned marker to a 422.
 */
export async function postSupportReply(
  ctx: AuthContext,
  ticket: SupportTicketWithThread,
  body: string,
): Promise<{ kind: 'closed' } | { kind: 'ok'; messageId: string }> {
  if (ticket.status === 'CLOSED') return { kind: 'closed' }

  const message = await db.supportTicketMessage.create({
    data: { ticketId: ticket.id, authorUserId: ctx.user.id, body },
  })

  if (ctx.user.role === 'CANDIDATE') {
    await notifyStaffOfBorrowerReply(ctx, ticket, body)
  } else {
    await notifyBorrower(
      ticket,
      'New reply on your support ticket',
      `Our team replied on ticket ${ticket.ticketNumber} (${ticket.subject}): ${body.slice(0, 120)}`,
    )
  }

  await audit(
    ctx,
    'CREATE',
    'SupportTicketMessage',
    message.id,
    `Replied on support ticket ${ticket.ticketNumber}`,
  )

  return { kind: 'ok', messageId: message.id }
}

export type SupportStatusChangeResult =
  | { kind: 'invalid'; from: SupportStatusValue; to: SupportStatusValue }
  | { kind: 'ok'; status: SupportStatusValue; resolution: string | null }

/**
 * Move a ticket along the status walk. The transition map in
 * src/lib/support.ts is the single source of truth — anything not
 * listed there (including every exit from CLOSED) is refused.
 * Moving to RESOLVED stores the resolution note when one is given.
 * The borrower is notified and the change is audit-logged.
 */
export async function changeSupportStatus(
  ctx: AuthContext,
  ticket: SupportTicketWithThread,
  to: SupportStatusValue,
  resolution?: string,
): Promise<SupportStatusChangeResult> {
  const from = ticket.status as SupportStatusValue
  if (!canTransitionSupportStatus(from, to)) {
    return { kind: 'invalid', from, to }
  }

  const updated = await db.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: to,
      ...(to === 'RESOLVED' && resolution ? { resolution } : {}),
    },
  })

  await notifyBorrower(
    ticket,
    'Support ticket status updated',
    `Ticket ${ticket.ticketNumber} (${ticket.subject}) is now ${to.replace('_', ' ')}.`,
  )

  await audit(
    ctx,
    'UPDATE',
    'SupportTicket',
    ticket.id,
    `Changed support ticket ${ticket.ticketNumber} status ${from} → ${to}`,
  )

  return { kind: 'ok', status: updated.status as SupportStatusValue, resolution: updated.resolution }
}
