// PATCH /api/owner/agents/[id] — deactivate / reactivate an agent.
//
// Deactivation is a soft off-boarding, not a deletion:
// - BOTH active flags flip together: AgentProfile.isActive drives the
//   owner agents list / assignment pickers, User.isActive drives staff
//   login (the login route only resolves active users, so a deactivated
//   agent gets the same generic "Invalid credentials" as a wrong
//   password — no account-existence leak) and session resolution.
// - Every live session for the agent's user is revoked in the same
//   transaction, so an already-logged-in agent is signed out at once.
// - Nothing is unassigned or deleted: the agent's candidates, tasks,
//   collections and audit history stay exactly where they were. The
//   owner reassigns candidates manually via the existing assign flow.
// Reactivation flips both flags back and clears any login lockout, so
// the agent can sign in immediately. Both directions are audit-logged.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, notFound, badRequest, validateBody } from '@/lib/server/api'

const setActiveSchema = z.object({
  isActive: z.boolean(),
}).strict()

export const PATCH = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validateBody(setActiveSchema, body)

  const agent = await db.agentProfile.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    select: {
      id: true,
      isActive: true,
      userId: true,
      user: { select: { id: true, name: true, isActive: true } },
    },
  })
  if (!agent) return notFound('Agent not found')

  // Idempotent: already in the requested state — nothing to change,
  // nothing to audit.
  if (agent.isActive === data.isActive && agent.user.isActive === data.isActive) {
    return success({ id: agent.id, userId: agent.userId, isActive: data.isActive, sessionsRevoked: 0 })
  }

  const now = new Date()
  const sessionsRevoked = await db.$transaction(async (tx) => {
    await tx.agentProfile.update({
      where: { id: agent.id },
      data: { isActive: data.isActive },
    })
    await tx.user.update({
      where: { id: agent.user.id },
      data: {
        isActive: data.isActive,
        // Reactivation restores login immediately — a stale lockout
        // from before deactivation must not keep the agent out.
        ...(data.isActive ? { failedLoginAttempts: 0, lockedUntil: null } : {}),
      },
    })
    if (!data.isActive) {
      const revoked = await tx.session.updateMany({
        where: { userId: agent.user.id, revokedAt: null },
        data: { revokedAt: now },
      })
      return revoked.count
    }
    return 0
  })

  await audit(
    ctx,
    'UPDATE',
    'AgentProfile',
    agent.id,
    data.isActive
      ? `Reactivated agent ${agent.user.name}`
      : `Deactivated agent ${agent.user.name} (login disabled, ${sessionsRevoked} session(s) revoked, assignments unchanged)`,
    { userId: agent.user.id, isActive: data.isActive, sessionsRevoked }
  )

  return success({ id: agent.id, userId: agent.userId, isActive: data.isActive, sessionsRevoked })
})
