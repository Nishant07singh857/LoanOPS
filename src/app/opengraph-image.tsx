import { ImageResponse } from 'next/og'

// Social share card (1200×630), generated at build time. Brand colours
// from the app theme: light background, deep-navy primary text, and the
// brand mark from public/logo.svg. Copy is deliberately plain — the
// product name and one factual line, no claims or ratings.
export const alt = 'LoanOPS — loan operations platform for lending businesses'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '80px',
          background: '#f6fdff',
          fontFamily: 'sans-serif',
        }}
      >
        <svg width="200" height="200" viewBox="0 0 30 30">
          <path
            fill="#2D2D2D"
            d="M24.51,28.51H5.49c-2.21,0-4-1.79-4-4V5.49c0-2.21,1.79-4,4-4h19.03c2.21,0,4,1.79,4,4v19.03C28.51,26.72,26.72,28.51,24.51,28.51z"
          />
          <g fill="#FFFFFF">
            <path d="M15.47,7.1l-1.3,1.85c-0.2,0.29-0.54,0.47-0.9,0.47h-7.1V7.09C6.16,7.1,15.47,7.1,15.47,7.1z" />
            <polygon points="24.3,7.1 13.14,22.91 5.7,22.91 16.86,7.1" />
            <path d="M14.53,22.91l1.31-1.86c0.2-0.29,0.54-0.47,0.9-0.47h7.09v2.33H14.53z" />
          </g>
        </svg>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginLeft: '64px',
          }}
        >
          <div style={{ fontSize: '84px', fontWeight: 700, color: '#0f3778', letterSpacing: '-1px' }}>
            LoanOPS
          </div>
          <div style={{ fontSize: '34px', color: '#3d4a66', marginTop: '18px', lineHeight: 1.35 }}>
            Loan operations platform for lending businesses
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
