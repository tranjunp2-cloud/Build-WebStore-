import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { Ic, type IconName } from './lv-icon'
import { SectionHead } from './section-head'
import { AgentVisual, EditorVisual } from './tour-visuals-build'
import { SeoVisual, SellVisual } from './tour-visuals-run'
import { prefersReducedMotion } from './lv-scroll'
import type { LvCopy } from './lv-types'

export const TOUR_MS = 7000
const TOUR: ReadonlyArray<{ key: 'editor' | 'agent' | 'sell' | 'seo'; icon: IconName }> = [
  { key: 'editor', icon: 'mouse-pointer-click' },
  { key: 'agent', icon: 'bot' },
  { key: 'sell', icon: 'shopping-cart' },
  { key: 'seo', icon: 'search' },
]

function Points({ points }: { points: string[] }) {
  return (
    <ul className="dd-list">
      {points.slice(0, 3).map((p) => <li key={p}><Ic n="circle-check" s={18} /><span>{p}</span></li>)}
    </ul>
  )
}

/**
 * Section #tour: 4 tabs + stage. Autoplay (7s, driven by the tab progress bar's animationend) runs only while the
 * section is in view, pauses on hover/focus and stops for good after a manual pick or under reduced motion.
 */
export function ProductTour({ copy }: { copy: LvCopy }) {
  const [index, setIndex] = useState(0)
  const [manual, setManual] = useState(false)
  const [inView, setInView] = useState(false)
  const [hold, setHold] = useState(false)
  const [reduce, setReduce] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const auto = !reduce && !manual

  useEffect(() => { setReduce(prefersReducedMotion()) }, [])

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((es) => setInView(es[0]?.isIntersecting ?? false), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const select = (i: number, fromUser: boolean) => {
    setIndex((i + TOUR.length) % TOUR.length)
    if (fromUser) setManual(true)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const d = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[e.key]
    if (!d) return
    e.preventDefault()
    const next = (index + d + TOUR.length) % TOUR.length
    select(next, true)
    tabRefs.current[next]?.focus()
  }

  const visuals = {
    editor: <EditorVisual x={copy.mock} />,
    agent: <AgentVisual f={copy.feat} x={copy.mock} />,
    sell: <SellVisual x={copy.mock} />,
    seo: <SeoVisual x={copy.mock} />,
  }

  return (
    <section data-sec="tour" id="tour" className="sec alt">
      <div className="wrap">
        <SectionHead label={copy.tour.label} title={copy.tour.title} sub={copy.tour.sub} />
        <div data-reveal="up">
          <div
            ref={rootRef}
            className={`tour${auto ? ' auto' : ''}${!inView || hold ? ' paused' : ''}`}
            style={{ '--tour-ms': `${TOUR_MS}ms` } as CSSProperties}
            onPointerEnter={() => setHold(true)}
            onPointerLeave={() => setHold(false)}
            onFocus={() => setHold(true)}
            onBlur={() => setHold(false)}
            onAnimationEnd={(e) => { if (auto && e.animationName === 'lv-tourbar') select(index + 1, false) }}
          >
            <div className="tour-tabs" role="tablist" aria-label={copy.tour.label} onKeyDown={onKeyDown}>
              {TOUR.map(({ key, icon }, i) => {
                const d = copy.deep[key]
                const on = index === i
                return (
                  <button
                    key={key}
                    ref={(el) => { tabRefs.current[i] = el }}
                    type="button"
                    role="tab"
                    className="tt"
                    id={`tt-${key}`}
                    aria-selected={on}
                    aria-controls={`tp-${key}`}
                    tabIndex={on ? 0 : -1}
                    onClick={() => select(i, true)}
                  >
                    <span className="tt-ic"><Ic n={icon} s={18} /></span>
                    <span className="tt-tx">
                      <span className="tt-l">{d.label}</span>
                      <span className="tt-t">{d.title}</span>
                      <span className="tt-more"><span className="tt-d">{d.sub}</span><Points points={d.points} /></span>
                    </span>
                    <span className="tt-bar" aria-hidden="true"><i /></span>
                  </button>
                )
              })}
            </div>
            <div className="tour-stage">
              {TOUR.map(({ key }, i) => {
                const d = copy.deep[key]
                return (
                  <div key={key} className={`tp${index === i ? ' on' : ''}`} role="tabpanel" id={`tp-${key}`} aria-labelledby={`tt-${key}`}>
                    <div className="tp-tx"><h3 className="tp-t">{d.title}</h3><p className="tp-d">{d.sub}</p><Points points={d.points} /></div>
                    <div className="dd-vis" aria-hidden="true">{visuals[key]}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
