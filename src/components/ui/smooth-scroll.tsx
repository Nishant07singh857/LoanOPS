'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Disable Lenis on mobile, touchscreens, tablets, or when reduced motion is preferred
    if (
      typeof window === 'undefined' ||
      window.innerWidth < 1024 ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // CRITICAL: without this, Lenis preventDefaults every wheel event and
      // converts it into a window scroll — nested scrollers (the sidebar
      // nav, table wrappers, dropdowns, dialog panes) could then only be
      // moved by dragging their scrollbar thumbs. With allowNestedScroll,
      // Lenis yields when the gesture starts inside a nested scroller that
      // can still move in that direction; at its end the gesture chains
      // back to the page. Key regions also carry data-lenis-prevent.
      allowNestedScroll: true,
    })

    let rafId: number
    function raf(time: number) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }

    const onResize = () => {
      lenis.resize()
    }
    window.addEventListener('resize', onResize, { passive: true })

    rafId = requestAnimationFrame(raf)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  return <>{children}</>
}

