// Sentry — server (Node.js) runtime.
//
// Error tracking is OPTIONAL and fails open, exactly like Redis
// (src/lib/server/redis.ts): the SDK is initialised only when
// SENTRY_DSN is set. With no DSN the app behaves exactly as it did
// before this file existed — no client, no network calls, no noise.
//
// PII discipline: SDK data collection is locked down (no user
// info, cookies, HTTP bodies or DB query data) and every event passes
// through src/lib/sentry-scrub.ts before it can leave the process.
// tracesSampleRate is kept low so a looping error cannot burn the
// free-tier quota (5k events/month) in one incident.

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
