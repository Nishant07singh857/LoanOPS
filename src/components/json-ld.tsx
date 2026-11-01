// Server component rendering the homepage's JSON-LD structured
// data (Organization + SoftwareApplication — see
// src/lib/structured-data.ts for what is deliberately left out).
// Mounted ONLY on the homepage (src/app/page.tsx).

import { buildStructuredData } from '@/lib/structured-data'

export function JsonLd() {
  const data = buildStructuredData(
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  )
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
