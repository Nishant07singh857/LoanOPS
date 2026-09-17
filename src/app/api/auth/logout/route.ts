// POST /api/auth/logout
import { NextRequest } from 'next/server'
import { revokeSession, clearSessionCookie, getSessionCookie } from '@/lib/server/auth'
import { apiHandler, success } from '@/lib/server/api'

export const POST = apiHandler(async (req: NextRequest) => {
  const token = await getSessionCookie()
  if (token) {
    await revokeSession(token)
  }
  await clearSessionCookie()
  return success({ ok: true })
})
