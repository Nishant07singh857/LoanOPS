'use client'

// Homepage hero — subtle 3D tilt for the loan-card group.
//
// Implements the research spec (subtle-3D homepage study, §6)
// exactly: pointer tilt capped at rotateY 5° / rotateX 4° under a
// 1100px perspective, the card drifting ±3px and the two stat chips
// ±8px in the same direction, inner card rows lifted on translateZ
// (declared in page.tsx), no glare, no scale, no idle float, no
// library, nothing on the nav, the CTAs or any text block.
//
// The server-rendered page is the finished design. This component
// attaches listeners only while ALL of these hold: a fine pointer
// with hover, prefers-reduced-motion: no-preference, the pointer
// over the card group, and the hero in the viewport. If any gate
// fails, nothing is attached and the hero is simply static. The
// rAF loop runs only while values are converging — on
// pointer-leave everything eases back to flat over ~500ms with
// cubic-bezier(0.2, 0, 0, 1) and the loop stops; a hidden tab
// suspends rAF itself, so an idle or backgrounded page does zero
// animation work.

import * as React from 'react'

const MAX_RY = 5 // degrees at the left/right edges
const MAX_RX = 4 // degrees at the top/bottom edges
const LERP = 0.1 // per-frame approach toward the pointer target

// cubic-bezier(0.2, 0, 0, 1) — the emphasized easing used for the
// settle back to flat. Solve x(s) = 0.6s(1-s)^2 + s^3 for s by
// Newton iteration, then return y(s) = 3s^2 - 2s^3.
function emphasized(t: number): number {
  let s = t
  for (let i = 0; i < 3; i++) {
    const inv = 1 - s
    const err = 0.6 * s * inv * inv + s * s * s - t
    if (Math.abs(err) < 0.0001) break
    s = Math.min(1, Math.max(0, s - err / (0.6 * inv * (1 - 3 * s) + 3 * s * s)))
  }
  return 3 * s * s - 2 * s * s * s
}

const clampUnit = (v: number) => Math.min(1, Math.max(-1, v))
const round3 = (v: number) => Math.round(v * 1000) / 1000

export function HeroTilt({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const root = ref.current
    if (!root) return
    const card = root.querySelector<HTMLElement>('[data-tilt-card]')
    if (!card) return
    const rootEl = root
    const cardEl = card
    const chips = Array.from(root.querySelectorAll<HTMLElement>('[data-tilt-chip]'))
    const mqs = [
      window.matchMedia('(hover: hover) and (pointer: fine)'),
      window.matchMedia('(prefers-reduced-motion: no-preference)'),
    ]

    let attached = false
    let inView = false
    let mode = 0 // 0 idle, 1 follow (lerp), 2 settle (timed ease to flat)
    let raf = 0
    let settleStart = 0
    let tx = 0
    let ty = 0
    let cx = 0
    let cy = 0
    let fx = 0
    let fy = 0

    function apply() {
      cardEl.style.transform =
        `translate3d(${round3(cx * 3)}px, ${round3(cy * 3)}px, 0) ` +
        `rotateX(${round3(-cy * MAX_RX)}deg) rotateY(${round3(cx * MAX_RY)}deg)`
      // The shadow deepens a touch as the tilt grows — depth is
      // sold more cheaply by shadow than by angle. The custom
      // property feeds the card's box-shadow in page.tsx.
      cardEl.style.setProperty(
        '--hp-shadow',
        String(round3(0.65 + (Math.abs(cx) + Math.abs(cy)) * 0.05)),
      )
      const chip = `translate3d(${round3(cx * 8)}px, ${round3(cy * 8)}px, 0)`
      for (const el of chips) el.style.transform = chip
    }

    function stopLoop() {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      mode = 0
    }

    function followStep() {
      cx += (tx - cx) * LERP
      cy += (ty - cy) * LERP
      if (Math.abs(tx - cx) < 0.0005) cx = tx
      if (Math.abs(ty - cy) < 0.0005) cy = ty
      apply()
      if (mode !== 1) return
      if (cx !== tx || cy !== ty) raf = requestAnimationFrame(followStep)
      else {
        mode = 0
        raf = 0
      }
    }

    function settleStep(now: number) {
      const t = Math.min((now - settleStart) / 500, 1)
      const e = emphasized(t)
      cx = fx * (1 - e)
      cy = fy * (1 - e)
      if (t < 1) {
        apply()
        if (mode === 2) raf = requestAnimationFrame(settleStep)
      } else {
        cx = 0
        cy = 0
        apply()
        if (mode === 2) {
          mode = 0
          raf = 0
        }
      }
    }

    function startSettle() {
      if (mode === 2) return
      stopLoop()
      tx = 0
      ty = 0
      if (cx === 0 && cy === 0) return
      mode = 2
      fx = cx
      fy = cy
      settleStart = performance.now()
      raf = requestAnimationFrame(settleStep)
    }

    function onMove(e: PointerEvent) {
      if (!inView) return
      const r = rootEl.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      tx = clampUnit(((e.clientX - r.left) / r.width) * 2 - 1)
      ty = clampUnit(((e.clientY - r.top) / r.height) * 2 - 1)
      if (mode !== 1) {
        stopLoop()
        mode = 1
        raf = requestAnimationFrame(followStep)
      }
    }

    function attach() {
      if (attached) return
      attached = true
      rootEl.addEventListener('pointermove', onMove)
      rootEl.addEventListener('pointerleave', startSettle)
    }

    function detach() {
      if (!attached) return
      attached = false
      rootEl.removeEventListener('pointermove', onMove)
      rootEl.removeEventListener('pointerleave', startSettle)
      stopLoop()
      tx = 0
      ty = 0
      cx = 0
      cy = 0
      cardEl.style.transform = ''
      cardEl.style.removeProperty('--hp-shadow')
      for (const el of chips) el.style.transform = ''
    }

    function evaluate() {
      if (mqs[0].matches && mqs[1].matches) attach()
      else detach()
    }

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? false
        if (!inView) startSettle()
      },
      { threshold: 0 },
    )
    io.observe(rootEl)
    for (const mq of mqs) mq.addEventListener('change', evaluate)
    evaluate()

    return () => {
      io.disconnect()
      for (const mq of mqs) mq.removeEventListener('change', evaluate)
      detach()
    }
  }, [])

  return (
    <div ref={ref} className="[perspective:1100px]">
      {children}
    </div>
  )
}
