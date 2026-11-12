'use client'

import { useEffect } from 'react'
import type { RefObject } from 'react'
import { prefersReducedMotion } from './lv-scroll'
import { NAV_KEYS } from './lv-types'

const SPY_LINE = 0.35 // fraction of the viewport height at which a section becomes "current"
const GLOW_SPEED = [0.2, 0.12] as const // deco-glow-b, deco-glow-a (px per scrolled px)

/**
 * Scroll/pointer effects for the landing root: reveal-on-scroll, scroll progress bar, nav shadow, scrollspy,
 * hero glow parallax, video-frame tilt and card cursor spotlight. Under prefers-reduced-motion everything is
 * revealed immediately and only the non-motion bits (progress, nav shadow, scrollspy) stay.
 * One passive scroll listener + rAF; everything is torn down on unmount.
 */
export function useLandingMotion(rootRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduce = prefersReducedMotion()
    const cleanups: Array<() => void> = []

    // --- reveal on scroll
    const revealEls = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (reduce || typeof IntersectionObserver === 'undefined') {
      revealEls.forEach((el) => el.classList.add('in'))
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          e.target.classList.add('in')
          io.unobserve(e.target)
        })
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
      revealEls.forEach((el) => io.observe(el))
      cleanups.push(() => io.disconnect())
    }

    // --- scroll-linked effects (one rAF per frame)
    const nav = root.querySelector<HTMLElement>('.nav')
    const prog = root.querySelector<HTMLElement>('.prog')
    const vframe = root.querySelector<HTMLElement>('.vframe')
    const glows = Array.from(root.querySelectorAll<HTMLElement>('.hero .deco-glow-b, .hero .deco-glow-a'))
    const spyLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>('.nav-links .nav-link'))
    const secTop = (key: string) => root.querySelector(`[data-sec="${key}"]`)?.getBoundingClientRect().top

    const spy = () => {
      const mid = window.innerHeight * SPY_LINE
      let cur = ''
      NAV_KEYS.forEach((k) => { const t = secTop(k); if (t !== undefined && t <= mid) cur = k })
      // the product tour belongs to "Features" in the nav
      const tourTop = secTop('tour')
      if (cur === 'how' && tourTop !== undefined && tourTop <= mid) cur = 'features'
      spyLinks.forEach((a) => {
        if (a.getAttribute('href') === `#${cur}`) a.setAttribute('aria-current', 'true')
        else a.removeAttribute('aria-current')
      })
    }

    const frame = () => {
      const y = window.scrollY
      const vh = window.innerHeight
      const max = document.documentElement.scrollHeight - vh
      if (prog) prog.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`
      nav?.classList.toggle('scrolled', y > 8)
      spy()
      if (reduce) return
      glows.forEach((g, i) => { g.style.transform = `translate3d(0, ${y * GLOW_SPEED[i % 2]}px, 0)` })
      if (vframe) {
        const p = Math.min(1, Math.max(0, (vh - vframe.getBoundingClientRect().top) / (vh * 0.75)))
        vframe.style.transform = `perspective(1600px) rotateX(${(1 - p) * 16}deg) scale(${0.93 + p * 0.07})`
      }
    }

    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => { raf = 0; frame() })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    cleanups.push(() => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    })
    frame()

    // --- cursor spotlight (fine pointers only)
    if (!reduce && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches) {
      const onMove = (e: PointerEvent) => {
        const el = (e.target as Element | null)?.closest<HTMLElement>('.spot')
        if (!el) return
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
      }
      root.addEventListener('pointermove', onMove)
      cleanups.push(() => root.removeEventListener('pointermove', onMove))
    }

    return () => cleanups.forEach((fn) => fn())
  }, [rootRef])
}
