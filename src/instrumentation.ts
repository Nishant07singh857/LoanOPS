// Next.js server instrumentation. Loads the Sentry config matching
// the runtime being started; both configs are no-ops when SENTRY_DSN
// is unset, so this file changes nothing until error tracking is
// deliberately enabled (see docs/LAUNCH.md).

import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Forwards unhandled server errors (route handlers, server
// components) to Sentry; inert when the SDK was never initialised.
export const onRequestError = Sentry.captureRequestError
