/** Height of the sticky nav; in-page jumps stop this far above the target section. */
export const NAV_OFFSET = 68

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Smooth-scroll to a `[data-sec]` section (or the top), offset by the sticky nav; instant under reduced motion. */
export function scrollToSection(key: string): void {
  if (typeof window === 'undefined') return
  const el = key === 'top' ? null : document.querySelector(`.lv [data-sec="${key}"]`)
  const top = el ? el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET : 0
  window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}
