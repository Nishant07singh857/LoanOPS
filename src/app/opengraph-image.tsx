import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Social share card (1200×630), generated at build time. Colours and
// type are the current brand system (the homepage's): deep forest
// green field (#0A3D2C), ivory Fraunces serif headline, mint subline,
// and the brand mark (public/logo.svg) redrawn as a tile in the hero
// gradient's darker green (#082A1F). Copy is deliberately plain — the
// product name and one factual line, no claims or ratings. The serif
// is real Fraunces SemiBold, subset and bundled alongside this file
// (fonts/fraunces-semibold.ttf), and the subline is set in the
// homepage's body face, IBM Plex Sans Medium (fonts/plex-sans-500.ttf),
// so the card never depends on system fonts.
export const alt = 'LoanOPS — loan operations platform for lending businesses'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpenGraphImage() {
  // The card is prerendered at build time, so the bundled fonts are
  // read from disk (the fetch(new URL(...)) pattern is not implemented
  // for static generation in this Next version).
  const fontsDir = join(process.cwd(), 'src/app/fonts')
  const [fraunces, plexSans] = await Promise.all([
    readFile(join(fontsDir, 'fraunces-semibold.ttf')),
    readFile(join(fontsDir, 'plex-sans-500.ttf')),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '80px',
          background: '#0A3D2C',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '200px',
            height: '200px',
            borderRadius: '44px',
            background: '#082A1F',
          }}
        >
          {/* Loan-card glyph (the brand mark), drawn with divs: card
              outline, top stripe, chip dot and two ledger lines, in
              the same proportions as public/logo.svg. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '120px',
              height: '88px',
              border: '9px solid #FAF7F0',
              borderRadius: '12px',
            }}
          >
            <div style={{ height: '13px' }} />
            <div style={{ height: '9px', background: '#FAF7F0' }} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexGrow: 1,
                paddingLeft: '6px',
                marginTop: '10px',
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '7px',
                  background: '#FAF7F0',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  marginLeft: '14px',
                }}
              >
                <div style={{ width: '55px', height: '6px', background: '#FAF7F0' }} />
                <div
                  style={{
                    width: '38px',
                    height: '6px',
                    background: '#FAF7F0',
                    marginTop: '5px',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginLeft: '64px',
          }}
        >
          <div
            style={{
              fontFamily: 'Fraunces',
              fontSize: '84px',
              fontWeight: 600,
              color: '#FAF7F0',
              letterSpacing: '-1px',
            }}
          >
            LoanOPS
          </div>
          <div
            style={{
              fontFamily: 'Plex Sans',
              fontWeight: 500,
              fontSize: '34px',
              color: '#A7E8C9',
              marginTop: '18px',
              lineHeight: 1.35,
            }}
          >
            Loan operations platform for lending businesses
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Fraunces', data: fraunces, style: 'normal', weight: 600 },
        { name: 'Plex Sans', data: plexSans, style: 'normal', weight: 500 },
      ],
    }
  )
}
