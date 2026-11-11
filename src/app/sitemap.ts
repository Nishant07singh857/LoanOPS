import type { MetadataRoute } from 'next'

// Public routes only — the logged-in product areas (/admin, /agent,
// /portal) and /api must never be advertised to crawlers. Tokenised
// flows (/apply/[token], password reset) are per-user links, not
// indexable pages, so they are excluded by design. The base URL comes
// from NEXT_PUBLIC_APP_URL so a future custom domain needs no code
// change (see docs/LAUNCH.md).

const PUBLIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/product', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/security', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/grievance', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/fair-practices', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/kfs', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/login', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/signup', priority: 0.4, changeFrequency: 'monthly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
  const lastModified = new Date()
  return PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
