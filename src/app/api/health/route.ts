// GET /api/health — production readiness & database health check
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/server/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  const timestamp = new Date().toISOString()
  try {
    await db.$queryRaw`SELECT 1`
    const payload = {
      ok: true,
      status: 'healthy',
      db: 'connected',
      timestamp,
      version: '0.2.1',
    }
    return NextResponse.json({ ...payload, data: payload }, { status: 200 })
  } catch (err) {
    logger.error('Health check failed: database unreachable', err)
    const payload = {
      ok: false,
      status: 'unhealthy',
      db: 'disconnected',
      timestamp,
      version: '0.2.1',
    }
    return NextResponse.json(
      { ...payload, error: { code: 'DB_UNAVAILABLE', message: 'Database connection failed' } },
      { status: 503 }
    )
  }
}
