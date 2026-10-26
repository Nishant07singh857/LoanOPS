// One-off remediation — encrypts legacy plaintext Candidate.bankAccount
// values in place. Rows written before the QR-apply fix stored the raw
// submitted account number; every current write path stores encryptPII()
// output (`enc:v1:` format). Run once per environment with:
//   npx tsx scripts/encrypt-plaintext-bank-accounts.ts [--dry-run]
// Idempotent: already-encrypted rows are skipped, so a second run is a
// no-op. Prints ONLY counts — never account values.

import { encryptPII } from '../src/lib/server/crypto'
import { db } from '../src/lib/db'

const ENCRYPTED_PREFIX = 'enc:v1:'

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const rows = await db.candidate.findMany({
    where: { bankAccount: { not: null } },
    select: { id: true, bankAccount: true },
  })

  // Filter in JS: anything non-null that is not already enc:v1: ciphertext
  // is legacy plaintext needing encryption.
  const plaintext = rows.filter(
    (r) => r.bankAccount && !r.bankAccount.startsWith(ENCRYPTED_PREFIX)
  )

  console.log(
    `[encrypt-plaintext-bank-accounts] ${rows.length} candidate(s) with a bank account, ` +
      `${plaintext.length} plaintext, ${rows.length - plaintext.length} already encrypted` +
      (dryRun ? ' (dry-run — no writes)' : '')
  )

  if (dryRun) return

  let updated = 0
  for (const row of plaintext) {
    await db.candidate.update({
      where: { id: row.id },
      data: { bankAccount: encryptPII(row.bankAccount as string) },
    })
    updated++
  }

  console.log(`[encrypt-plaintext-bank-accounts] ${updated} bank account(s) encrypted`)
}

main()
  .catch((err) => {
    console.error('[encrypt-plaintext-bank-accounts] failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
