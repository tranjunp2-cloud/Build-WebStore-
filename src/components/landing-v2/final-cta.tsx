import Link from 'next/link'
import { Ic } from './lv-icon'
import { MASCOT_SRC } from './lv-assets'
import type { LvCopy } from './lv-types'

/** Section #contact (final CTA): mascot, headline and a single "Get started free" button. */
export function FinalCta({ copy }: { copy: LvCopy }) {
  const fn = copy.final
  return (
    <section data-sec="contact" id="contact" className="sec">
      <div className="final" data-reveal="scale">
        <div aria-hidden="true" className="deco-glow-b" />
        <div aria-hidden="true" className="deco-glow-a" />
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative mascot */}
        <img className="masc" src={MASCOT_SRC} alt="" aria-hidden="true" />
        <h2 className="h2">{fn.title}</h2>
        <p className="sub">{fn.sub}</p>
        <div className="hero-btns">
          <Link href="/register" className="btn-grad btn-lg">{fn.cta}<Ic n="arrow-right" s={18} /></Link>
        </div>
      </div>
    </section>
  )
}
