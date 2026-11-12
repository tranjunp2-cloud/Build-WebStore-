import Link from 'next/link'
import { Ic } from './lv-icon'
import { LvLogo } from './lv-logo'
import { SectionLink } from './section-link'
import { NAV_KEYS, type LvCopy } from './lv-types'

/** Footer: logo + tagline, the four section links, language toggle, sign in / sign up, copyright. */
export function LandingFooter({ copy, onToggleLang }: { copy: LvCopy; onToggleLang: () => void }) {
  const { nav, footer } = copy
  return (
    <footer className="foot">
      <div className="foot-in">
        <div className="foot-r1">
          <div className="foot-brand"><LvLogo /><p>{footer.tagline}</p></div>
          <nav className="foot-links" aria-label={nav.menu}>
            {NAV_KEYS.map((k) => <SectionLink key={k} to={k} className="nav-link">{nav.items[k]}</SectionLink>)}
          </nav>
          <div className="foot-act">
            <button type="button" className="nav-tog" onClick={onToggleLang} aria-label={nav.lang} title={nav.langName}>
              <Ic n="globe" s={16} /><span>{nav.langLabel}</span>
            </button>
            <Link href="/login" className="nav-signin">{nav.signIn}</Link>
            <Link href="/register" className="btn-grad">{nav.cta}</Link>
          </div>
        </div>
        <div className="foot-r2">{footer.rights}</div>
      </div>
    </footer>
  )
}
