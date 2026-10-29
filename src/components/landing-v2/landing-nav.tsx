import { useState } from 'react'
import Link from 'next/link'
import { Ic } from './lv-icon'
import { LvLogo } from './lv-logo'
import { SectionLink } from './section-link'
import { NAV_KEYS, type LvCopy } from './lv-types'
import type { LvTheme } from './use-landing-theme'

interface Props {
  copy: LvCopy
  theme: LvTheme
  onToggleTheme: () => void
  onToggleLang: () => void
}

/** Sticky nav: scroll progress bar + scrolled shadow + scrollspy are driven by use-landing-motion. */
export function LandingNav({ copy, theme, onToggleTheme, onToggleLang }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { nav } = copy
  const themeLabel = theme === 'dark' ? copy.theme.toLight : copy.theme.toDark
  const closeMenu = () => setMenuOpen(false)

  return (
    <nav className="nav" aria-label={nav.menu}>
      <div>
        <div className="nav-in">
          <LvLogo />
          <div className="nav-links">
            {NAV_KEYS.map((k) => (
              <SectionLink key={k} to={k} className="nav-link">{nav.items[k]}</SectionLink>
            ))}
          </div>
          <div className="nav-right">
            <button type="button" className="nav-tog" onClick={onToggleTheme} aria-label={themeLabel} title={themeLabel}>
              <Ic n={theme === 'dark' ? 'sun' : 'moon'} s={16} />
            </button>
            <button type="button" className="nav-tog" onClick={onToggleLang} aria-label={nav.lang} title={nav.langName}>
              <Ic n="globe" s={16} /><span>{nav.langLabel}</span>
            </button>
            <Link href="/login" className="nav-signin">{nav.signIn}</Link>
            <Link href="/register" className="btn-grad nav-cta">{nav.cta}</Link>
            <button
              type="button"
              className="nav-menu"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={nav.toggle}
              aria-expanded={menuOpen}
              aria-controls="mpanel"
            >
              <Ic n={menuOpen ? 'x' : 'menu'} s={20} />
            </button>
          </div>
        </div>
        <div className="mpanel" id="mpanel" hidden={!menuOpen}>
          {NAV_KEYS.map((k) => (
            <SectionLink key={k} to={k} className="mp-item" onNavigate={closeMenu}>{nav.items[k]}</SectionLink>
          ))}
          <div className="mp-foot">
            <Link href="/login" className="mp-signin">{nav.signIn}</Link>
            <Link href="/register" className="btn-grad mp-cta">{nav.cta}</Link>
          </div>
        </div>
      </div>
      <div className="prog" aria-hidden="true" />
    </nav>
  )
}
