// schema.org structured data for the homepage (rendered by
// src/components/json-ld.tsx).
//
// Deliberately minimal and factual: an Organization and a
// SoftwareApplication node. NO aggregateRating, NO review, NO offers
// — the product has no public ratings or public pricing, and
// inventing them for search engines risks a Google manual action.
// No sameAs either: there are no official public profiles to link
// yet; add them here when they exist.

export function buildStructuredData(appUrl: string) {
  const url = appUrl.replace(/\/+$/, '')
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'LoanOPS',
        url,
      },
      {
        '@type': 'SoftwareApplication',
        name: 'LoanOPS',
        url,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
      },
    ],
  }
}
