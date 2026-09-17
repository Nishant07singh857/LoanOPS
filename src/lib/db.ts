// Prisma client initialization.
// Loads .env explicitly and passes the URL to Prisma via datasourceUrl
// to ensure the right database is used regardless of bundler env propagation.
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

// Best-effort .env loader (Next.js usually loads .env but Turbopack has quirks)
// IMPORTANT: .env file values take PRECEDENCE over inherited shell env vars
// (so a sandbox-provided DATABASE_URL=sqlite won't override our Neon config).
function loadEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const lines = content.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const m = trimmed.match(/^([A-Z_]+)=(.*)$/)
        if (m) {
          const key = m[1]
          let val = m[2]
          // Strip surrounding quotes
          val = val.replace(/^["']|["']$/g, '')
          // Always override — .env is authoritative for this project
          process.env[key] = val
        }
      }
    }
  } catch (e) {
    // best-effort
  }
}

loadEnvFile()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Check your .env file.')
}
if (!databaseUrl.startsWith('postgres')) {
  // Refuse to use a non-PostgreSQL URL — the schema is PostgreSQL-only.
  throw new Error(`DATABASE_URL must be a postgresql:// URL. Got: ${databaseUrl.slice(0, 40)}...`)
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasourceUrl: databaseUrl,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
