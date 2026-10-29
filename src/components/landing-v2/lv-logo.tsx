import { scrollToSection } from './lv-scroll'

/** Logo + wordmark ("Store" keeps #06B6D4 in both themes — see `.wordmark b`). Click scrolls to top. */
export function LvLogo() {
  return (
    <button type="button" className="logo" aria-label="Web Store" onClick={() => scrollToSection('top')}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static brand mark, matches prototype */}
      <img src="/images/logo-icon-3c4d76.png" alt="" width={30} height={30} />
      <span className="wordmark">Web <b>Store</b></span>
    </button>
  )
}
