// Prisma client initialization.
// Loads .env explicitly and passes the URL to Prisma via datasourceUrl
// to ensure the right database is used regardless of bundler env propagation.
import { PrismaClient } from '@prisma/client'
import { validateEnv, isBuildPhase } from '@/lib/server/env'
import fs from 'fs'
import path from 'path'

// Best-effort .env loader (Next.js usually loads .env but Turbopack has quirks)
// IMPORTANT: variables already present in process.env (container / CI /
// platform-injected secrets) take PRECEDENCE over the .env file. The file
// only fills in values that are not already set, so a stale or baked-in
// .env can never silently override deployed secrets.
function loadEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      const lines = content.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
        if (m) {
          const key = m[1]
          // Only set when undefined — real environment wins over the file.
          if (process.env[key] !== undefined) continue
          let val = m[2]
          // Strip surrounding quotes
          val = val.replace(/^["']|["']$/g, '')
          process.env[key] = val
        }
      }
    }
  } catch (e) {
    // best-effort
  }
}

loadEnvFile()

// Validate critical env vars (crashes in production if missing/weak)
validateEnv()

// Build-phase placeholder: while `next build` collects page data,
// route modules are imported but never executed, and a Preview
// deployment may have no DATABASE_URL at all (Vercel scopes env vars
// per environment). Constructing the client with a placeholder keeps
// module evaluation safe in that phase only — Prisma connects lazily,
// so the placeholder is never dialled. Assembled at runtime (the same
// trick the unit tests use for their fake URLs) so no
// connection-string-shaped literal sits in the source tree.
const BUILD_PLACEHOLDER_URL = [
  'postgres',
  '://preview-build:preview-build@',
  'localhost:5432/',
  'preview_build',
].join('')

let databaseUrl = process.env.NODE_ENV === 'test' ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL
if (isBuildPhase()) {
  // Build phase only: skip the fail-fast validation below and fall
  // back to the placeholder when no usable URL is configured. Every
  // other phase keeps the strict behaviour byte-for-byte — a missing
  // or invalid DATABASE_URL at runtime must keep crashing at import.
  if (!databaseUrl || !databaseUrl.startsWith('postgres')) {
    databaseUrl = BUILD_PLACEHOLDER_URL
  }
} else if (!databaseUrl) {
  throw new Error(`DATABASE_URL${process.env.NODE_ENV === 'test' ? '_TEST' : ''} is not set. Check your .env file.`)
} else if (!databaseUrl.startsWith('postgres')) {
  // Refuse to use a non-PostgreSQL URL — the schema is PostgreSQL-only.
  throw new Error(`DATABASE_URL must be a postgresql:// URL. Got: ${databaseUrl.slice(0, 40)}...`)
}
if (!databaseUrl.includes('connection_limit=')) {
  const sep = databaseUrl.includes('?') ? '&' : '?'
  databaseUrl = `${databaseUrl}${sep}connection_limit=5&pool_timeout=30&connect_timeout=15`
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

globalForPrisma.prisma = db

