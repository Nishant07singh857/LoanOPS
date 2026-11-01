// PRISMA ERROR SHAPES (red-team round 3, P1/P3)
//
// Pure classifiers for Prisma failure shapes, kept in a leaf module
// with no imports: api.ts re-exports them, and unit tests can import
// them without dragging in the request-handler stack (which loads
// db.ts and its environment validation).

// A unique-constraint violation does not always arrive as the coded
// P2002: inside an interactive transaction the loser of an insert
// race can surface at commit time as a PrismaClientUnknownRequestError
// whose message still names the failed constraint ("Unique constraint
// failed on the fields: ..."). Both shapes are the same client-visible
// fact — the resource already exists — so both map to 409. Before
// this, the apply-vs-signup race loser got a 500.
export function isUniqueConstraintError(err: any): boolean {
  if (!err) return false
  if (err?.code === 'P2002') return true
  const msg = String(err?.message || '')
  return /unique constraint failed|duplicate key value violates unique constraint/i.test(msg)
}

// Postgres rejects out-of-range integers and over-long values with
// driver-level errors that carry no Prisma P-code. When the message
// names that cause, the fault is the client's input (a value that can
// never fit the column), not the server — map it to 422 instead of
// the generic 500 the bare Prisma-name branch in api.ts would produce.
// Genuine server faults (connections, timeouts, engine errors) do
// not match these phrases and still surface as 500.
export function isValueRangeError(err: any): boolean {
  if (!err) return false
  const msg = String(err?.message || '')
  return /out of range|value too long for type|invalid input syntax/i.test(msg)
}

// A concurrency loser is not a server fault either: a Postgres
// deadlock (40P01 — Prisma surfaces it as an unknown-request error
// whose message names the deadlock) or a transaction write conflict
// (P2034) means another writer won the same rows first and this
// transaction was rolled back in full, leaving no partial state. On
// this app's user-input write paths that is a conflict — map to 409.
// (Round-3 P1: before the apply/signup write orders were aligned,
// the race loser deadlocked and surfaced as exactly this shape.)
export function isConcurrencyConflictError(err: any): boolean {
  if (!err) return false
  if (err?.code === 'P2034') return true
  const msg = String(err?.message || '')
  return /deadlock/i.test(msg)
}
