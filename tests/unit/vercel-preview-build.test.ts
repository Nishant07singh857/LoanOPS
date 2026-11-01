// Unit tests for the Vercel Preview build fix:
// - During the build phase (NEXT_PHASE=phase-production-build), the
//   import-time startup guards in src/lib/db.ts and
//   src/lib/server/auth.ts must NOT throw when deployment env vars are
//   absent — `next build` imports route modules to collect page data
//   but never executes them, and Preview deployments may have no env
//   vars at all (Vercel scopes them per environment). Before the fix,
//   every Preview build failed collecting /api/files/[fileKey].
// - In every non-build phase the same guards keep their fail-fast
//   behaviour byte-for-byte: db import throws without DATABASE_URL,
//   auth import throws without SESSION_SECRET.
// - Build-phase env validation must not print per-variable ❌ lines
//   (Vercel surfaces them as build errors); it defers to runtime.
//
// Each case runs in a subprocess (tsx) with a hand-built environment:
// the behaviours under test are import-time and env-dependent, so they
// cannot be exercised in this process, whose env is already seeded.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const tsxBin = join(repoRoot, 'node_modules', '.bin', 'tsx')

// Assembled at runtime (the house pattern) so no connection-string-
// shaped literal sits in the source tree. Never connected to: the
// imports under test construct clients lazily and exit immediately.
const FAKE_DB_URL = ['postgres', '://unit-test@', 'localhost:5432/', 'unit_tests_only'].join('')

function childEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
  }
  // Engine-location parity for sandboxes/CI that resolve the Prisma
  // engine via env vars; unrelated to the app env under test.
  for (const key of [
    'PRISMA_QUERY_ENGINE_LIBRARY',
    'PRISMA_QUERY_ENGINE_BINARY',
    'PRISMA_SCHEMA_ENGINE_BINARY',
  ]) {
    if (process.env[key]) env[key] = process.env[key]
  }
  return { ...env, ...extra } as NodeJS.ProcessEnv
}

function probeImport(
  mod: string,
  extra: Record<string, string>
): { status: number | null; output: string } {
  const snippet =
    `import('${mod}')` +
    `.then(()=>{console.log('IMPORT_OK');process.exit(0)})` +
    `.catch((e)=>{console.error('IMPORT_FAIL: '+(e&&e.message));process.exit(1)})`
  const res = spawnSync(tsxBin, ['-e', snippet], {
    cwd: repoRoot,
    env: childEnv(extra),
    encoding: 'utf8',
    timeout: 90_000,
  })
  if (res.error) throw res.error
  return { status: res.status, output: `${res.stdout ?? ''}\n${res.stderr ?? ''}` }
}

const BUILD_PHASE_ENV = {
  NEXT_PHASE: 'phase-production-build',
  NODE_ENV: 'production',
}

// 1. Build phase: db imports cleanly with no DATABASE_URL, and the
//    deferred validation warning carries no ❌ lines.
{
  const { status, output } = probeImport('./src/lib/db.ts', BUILD_PHASE_ENV)
  assert.equal(status, 0, `build-phase db import should succeed:\n${output}`)
  assert.ok(output.includes('IMPORT_OK'), output)
  assert.ok(!output.includes('❌'), `build-phase output must not contain ❌ lines:\n${output}`)
  assert.ok(output.includes('deferred to runtime'), output)
}

// 2. Build phase: auth imports cleanly with no SESSION_SECRET /
//    DATABASE_URL (its FATAL startup guard is build-phase-skipped).
{
  const { status, output } = probeImport('./src/lib/server/auth.ts', BUILD_PHASE_ENV)
  assert.equal(status, 0, `build-phase auth import should succeed:\n${output}`)
  assert.ok(output.includes('IMPORT_OK'), output)
}

// 3. Runtime (non-build): db import still throws without DATABASE_URL.
{
  const { status, output } = probeImport('./src/lib/db.ts', {
    NODE_ENV: 'development',
    npm_lifecycle_event: 'test',
  })
  assert.equal(status, 1, `non-build db import should fail:\n${output}`)
  assert.ok(output.includes('DATABASE_URL is not set'), output)
}

// 4. Runtime (non-build): auth import still throws without
//    SESSION_SECRET (DATABASE_URL present, so db's guard passes and
//    auth's own guard is the one exercised).
{
  const { status, output } = probeImport('./src/lib/server/auth.ts', {
    NODE_ENV: 'development',
    npm_lifecycle_event: 'test',
    DATABASE_URL: FAKE_DB_URL,
  })
  assert.equal(status, 1, `non-build auth import should fail:\n${output}`)
  assert.ok(output.includes('SESSION_SECRET is not set'), output)
}

console.log('vercel-preview-build: all 4 import-guard cases passed')
