// Sentry — browser runtime (loaded by Next.js before hydration).
//
// Initialised only when NEXT_PUBLIC_SENTRY_DSN is set at build time;
// with no DSN this file is inert and the app behaves exactly as it
// did before. SDK data collection is locked down and every event is scrubbed
// of borrower PII before sending (src/lib/sentry-scrub.ts). No
// session-replay integration is registered — replay would record
// borrower screens, which this product must not do.

import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent, type ScrubbableEvent } from './lib/sentry-scrub'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    // v11 successor of sendDefaultPii:false — no user info, no
    // cookies, no HTTP bodies, no DB query data are collected.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpBodies: [],
      databaseQueryData: false,
    },
    tracesSampleRate: 0.1,
    beforeSend(event) {
      scrubSentryEvent(event as unknown as ScrubbableEvent)
      return event
    },
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
