'use client'

// Root-level error boundary: renders when the root layout itself
// fails, so it cannot rely on the app's CSS or components — plain
// elements and inline styles only, in the product's voice. Reports
// through the same gated path as app/error.tsx (no-op without a
// Sentry DSN).

import * as React from 'react'
import { reportClientError } from '@/lib/error-reporting'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error('[Global Error Boundary]', error)
    reportClientError(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          backgroundColor: '#FAF7F0',
          color: '#14231C',
          padding: '1rem',
        }}
      >
        <main
          role="alert"
          style={{
            maxWidth: '28rem',
            width: '100%',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#b91c1c',
            }}
          >
            Unexpected Error
          </p>
          <h1 style={{ margin: '0.75rem 0 0', fontSize: '1.5rem', fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', lineHeight: 1.6, color: '#64748b' }}>
            We encountered an unexpected error while loading this page. Your financial data and
            ledger records remain safe.
          </p>
          {error?.digest && (
            <p
              style={{
                margin: '0.75rem 0 0',
                fontSize: '0.75rem',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                color: '#64748b',
              }}
            >
              Reference ID: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: '1.5rem',
              height: '2.75rem',
              padding: '0 1.5rem',
              borderRadius: '0.75rem',
              border: 'none',
              backgroundColor: '#0A3D2C',
              color: '#FAF7F0',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </main>
      </body>
    </html>
  )
}
