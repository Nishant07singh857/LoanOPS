'use client'

// Homepage mobile menu — the phone counterpart of the pill nav's
// desktop link run (mobile-layout research, §2/§8.3): on phones the
// pill keeps only the wordmark, the Log in pill and this button;
// the section anchors live in a full-height sheet behind it.
//
// The sheet is a separate layer from the pill on purpose: solid
// (no glass — the mobile glass budget is pill + card only), rows
// ≥52px, the Book a demo action pinned at the bottom in thumb
// reach, close on selection, on Escape, and via its close button,
// with focus moved into the sheet on open and returned to the
// button on close. It renders through a portal because the pill's
// backdrop-filter would otherwise become the containing block for
// a fixed-position descendant.
//
// There is deliberately NO login link in the sheet — the homepage
// carries exactly one /login link, the pill's Log in, at every
// width. Without JS the button simply never opens and the page is
// complete without it: every anchor below is also reachable by
// scrolling, and the enquiry anchor is the hero's own CTA.

import * as React from 'react'
import { createPortal } from 'react-dom'
import { Menu, X } from 'lucide-react'

const LINKS = [
  { href: '#lifecycle', label: 'Lifecycle' },
  { href: '#modules', label: 'Modules' },
  { href: '#security', label: 'Security' },
]

const FOCUSABLE = 'a[href], button:not([disabled])'

export function MobileMenu() {
  const [open, setOpen] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const sheetRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const sheet = sheetRef.current
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheet?.querySelector<HTMLElement>('[data-menu-close]')?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'Tab' || !sheet) return
      // A light trap: cycle Tab within the sheet's focusables.
      const items = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      buttonRef.current?.focus()
    }
  }, [open ])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Open menu"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors duration-[160ms] ease-[cubic-bezier(0.3,0,0.2,1)] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:hidden"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>
      {open
        ? createPortal(
            <div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="fixed inset-0 z-[60] flex flex-col bg-[#04150E] text-[#FAF7F0]"
            >
              <div className="flex h-16 items-center justify-between px-6 pt-4">
                <span className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-[#34D399]" />
                  <span className="text-[17px] font-semibold leading-none tracking-[-0.01em] text-white">LoanOps</span>
                </span>
                <button
                  type="button"
                  data-menu-close
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
              <nav aria-label="Homepage sections" className="mt-6 px-6">
                <ul className="divide-y divide-white/10 border-y border-white/10">
                  {LINKS.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="flex h-[52px] items-center text-base font-medium text-[#FAF7F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-auto px-6 pb-8">
                <a
                  href="#enquire"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-[52px] w-full items-center justify-center rounded-full bg-white px-7 text-base font-semibold text-[#0A3D2C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Book a demo
                </a>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
