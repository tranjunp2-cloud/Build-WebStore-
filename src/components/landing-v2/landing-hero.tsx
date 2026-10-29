import Link from 'next/link'
import { Ic } from './lv-icon'
import { SectionLink } from './section-link'
import { HeroVideoPlayer } from './hero-video-player'
import type { LvCopy } from './lv-types'

/** Hero: staged text entrance + video frame that tilts flat on scroll (motion hook drives the tilt). */
export function LandingHero({ copy }: { copy: LvCopy }) {
  const { hero, nav } = copy
  return (
    <section data-sec="top" className="hero" id="top">
      <div aria-hidden="true" className="deco-glow-b" />
      <div aria-hidden="true" className="deco-glow-a" />
      <div className="hero-in">
        <div className="hero-text">
          <span className="eyebrow"><span className="eyebrow-dot"><Ic n="sparkles" s={12} /></span>{hero.eyebrow}</span>
          <h1 className="h1"><span className="h1-l">{hero.t1}</span> <span className="h1-l gtext">{hero.t2}</span></h1>
          <p className="hero-sub">{hero.sub}</p>
          <div className="hero-btns">
            <Link href="/register" className="btn-grad btn-lg">{nav.cta}<Ic n="arrow-right" s={18} /></Link>
            <SectionLink to="how" className="btn-ghost btn-lg">{hero.cta2}</SectionLink>
          </div>
          <div className="trust">
            {hero.trust.map((x) => <span key={x}><Ic n="circle-check" s={16} />{x}</span>)}
          </div>
        </div>
        <div className="vwrap">
          <div className="vframe">
            <HeroVideoPlayer copy={hero} />
          </div>
        </div>
      </div>
    </section>
  )
}
