import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs/config'
import { SECURITY_HEADERS } from './src/lib/security-headers'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [...SECURITY_HEADERS],
      },
    ]
  },
}

// Sentry's build wrapper (source-map upload, release wiring) applies
// ONLY when a DSN is configured at build time. With no DSN the
// exported config is byte-for-byte the plain config above, so a
// deployment that never enables error tracking builds and behaves
// exactly as it did before the launch package. org/project/auth
// token are read from SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN
// when source-map upload is wanted; without a token the upload step
// is skipped by the plugin.
const sentryConfigured = Boolean(
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
)

export default sentryConfigured
  ? withSentryConfig(nextConfig, { silent: true })
  : nextConfig
