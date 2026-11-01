import type { MetadataRoute } from 'next'

// Web app manifest (served at /manifest.webmanifest). Colours come from
// the app theme in globals.css: theme_color is the deep-navy primary,
// background_color the light app background. Icons are renders of the
// brand mark (public/logo.svg) kept under public/icons/.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LoanOPS',
    short_name: 'LoanOPS',
    description:
      'Loan operations platform for lending businesses — origination, KYC, disbursement, repayment schedules, collections and audit trails.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6fdff',
    theme_color: '#0f3778',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
