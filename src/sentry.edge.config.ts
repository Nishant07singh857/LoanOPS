// Sentry — edge runtime. Same contract as the server config:
// initialised only when SENTRY_DSN is set, data collection locked down, and
// every event scrubbed of borrower PII before it leaves the process
// (see src/lib/sentry-scrub.ts).

import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent, type ScrubbableEvent } from './lib/sentry-scrub'

const dsn = process.env.SENTRY_DSN

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
