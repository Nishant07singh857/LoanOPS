// Client-side error reporting for the React error boundaries.
//
// Fail-open like every other optional integration in this app: when
// NEXT_PUBLIC_SENTRY_DSN is not set (Sentry never enabled) this is a
// no-op and the boundaries behave exactly as they did before — a
// console.error and the recovery UI. When a DSN exists, the SDK is
// loaded lazily so the no-DSN bundle carries no Sentry code on this
// path at all; the initialised SDK's beforeSend scrubber
// (src/lib/sentry-scrub.ts) still sanitises the event before send.

export function reportClientError(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  void import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.captureException(error)
    })
    .catch(() => {
      // Reporting must never throw into the error boundary itself.
    })
}
