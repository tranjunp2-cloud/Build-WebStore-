import type { MouseEvent, ReactNode } from 'react'
import { scrollToSection } from './lv-scroll'

/** In-page anchor: keeps a real `href="#key"` but scrolls with the nav offset (and respects reduced motion). */
export function SectionLink({ to, className, onNavigate, children }: {
  to: string
  className?: string
  onNavigate?: () => void
  children: ReactNode
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    onNavigate?.()
    scrollToSection(to)
  }
  return <a className={className} href={`#${to}`} onClick={onClick}>{children}</a>
}
