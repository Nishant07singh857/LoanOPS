// Optional dead-man's-switch ping for the scheduled runners
// (scripts/send-reminders.ts, scripts/mark-overdue.ts).
//
// A heartbeat monitor (healthchecks.io, Better Stack, …) alerts when a
// job FAILS TO RUN AT ALL — the silent failure nobody notices for
// weeks. Each runner pings its configured URL once, after a successful
// run only, so a missing ping means "the job did not complete".
//
// Contract: this function NEVER throws. An unset URL is a no-op (the
// feature is off), and a failed or slow ping is logged and swallowed —
// monitoring must never be able to fail the job it watches.

const HEARTBEAT_TIMEOUT_MS = 5_000

export async function pingHeartbeat(url: string | undefined, label: string): Promise<void> {
  if (!url) return
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS)
  try {
    await fetch(url, { method: 'GET', signal: controller.signal })
  } catch (err) {
    console.warn(
      `[heartbeat] ${label} ping failed (ignored):`,
      err instanceof Error ? err.message : err
    )
  } finally {
    clearTimeout(timer)
  }
}
