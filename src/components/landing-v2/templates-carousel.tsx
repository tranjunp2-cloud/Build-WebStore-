import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Ic } from './lv-icon'
import { SectionHead } from './section-head'
import { TemplateThumb } from './template-thumb'
import { prefersReducedMotion } from './lv-scroll'
import { templatesForChip } from './template-picks'
import type { LandingTemplatesState } from './use-landing-templates'
import type { LvCopy, LvTemplate } from './lv-types'

const SKELETON_COUNT = 4
const GAP = 20
const EDGE_PX = 2

function cardCategory(t: LvTemplate, chip: string, cats: Record<string, string>): string {
  const c = chip !== 'all' && t.category.includes(chip) ? chip : (t.category[0] ?? '')
  return cats[c] ?? c
}

/** Section #templates: category chips + one-row scroll-snap carousel of live previews. */
export function TemplatesCarousel({ copy, tpl }: { copy: LvCopy; tpl: LandingTemplatesState }) {
  const tp = copy.templates
  const cats: Record<string, string> = tp.cats
  const [chip, setChip] = useState('all')
  const [edges, setEdges] = useState({ start: true, end: true })
  const trackRef = useRef<HTMLDivElement>(null)
  const loading = tpl.status === 'loading'
  const list = templatesForChip(tpl.templates, chip)
  const hasTemplates = tpl.templates.length > 0

  const syncEdges = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth - EDGE_PX
    setEdges({ start: el.scrollLeft <= EDGE_PX, end: el.scrollLeft >= max })
  }, [])

  // Re-measure when the card set changes (chip / data) and on viewport resize
  useEffect(() => {
    const el = trackRef.current
    if (el) el.scrollLeft = 0
    syncEdges()
    window.addEventListener('resize', syncEdges)
    return () => window.removeEventListener('resize', syncEdges)
  }, [chip, list.length, loading, syncEdges])

  const step = (dir: 1 | -1) => {
    const el = trackRef.current
    const card = el?.querySelector('.tcard')
    if (!el || !card) return
    el.scrollBy({ left: dir * (card.getBoundingClientRect().width + GAP), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const showTrack = loading || hasTemplates
  return (
    <section data-sec="templates" id="templates" className="sec">
      <div className="wrap">
        <SectionHead label={tp.label} title={tp.title} sub={tp.sub} />
        {showTrack ? (
          <>
            <div className="tbar" data-reveal="up">
              <div className="cats" role="group" aria-label={tp.label}>
                {Object.entries(cats).map(([key, label]) => (
                  <button key={key} type="button" className="cat" aria-pressed={chip === key} onClick={() => setChip(key)}>{label}</button>
                ))}
              </div>
              <div className="tnav">
                <button type="button" className="tarrow" aria-label={tp.prev} disabled={edges.start} onClick={() => step(-1)}><Ic n="chevron-left" s={18} /></button>
                <button type="button" className="tarrow" aria-label={tp.next} disabled={edges.end} onClick={() => step(1)}><Ic n="chevron-right" s={18} /></button>
              </div>
            </div>
            <div className="ttrack" ref={trackRef} onScroll={syncEdges} data-reveal="up" style={{ '--i': 1 } as React.CSSProperties} aria-busy={loading}>
              {loading
                ? Array.from({ length: SKELETON_COUNT }, (_, i) => (
                  <div key={i} className="tcard skel" aria-hidden="true">
                    <div className="thumb r1610" />
                    <div className="tmeta"><span className="skel-line" /></div>
                  </div>
                ))
                : list.map((t) => (
                  <div key={t.id} className="tcard spot">
                    <TemplateThumb id={t.id} name={t.name} />
                    <div className="tmeta"><span className="tname">{t.name}</span><span className="tcat">{cardCategory(t, chip, cats)}</span></div>
                  </div>
                ))}
            </div>
          </>
        ) : null}
        <div className="tcta"><Link className="btn-ghost" href="/templates">{tp.cta}<Ic n="arrow-right" s={16} /></Link></div>
      </div>
    </section>
  )
}
