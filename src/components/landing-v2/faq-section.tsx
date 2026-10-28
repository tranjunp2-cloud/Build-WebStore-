import { useState } from 'react'
import { Ic } from './lv-icon'
import type { LvCopy } from './lv-types'

/** Section #faq: grouped accordion — one answer open at a time, switching group closes everything. */
export function FaqSection({ copy }: { copy: LvCopy }) {
  const fq = copy.faq
  const [group, setGroup] = useState(0)
  const [open, setOpen] = useState<number | null>(null)
  const [swapped, setSwapped] = useState(false)
  const items = (fq.groups[group] ?? fq.groups[0]).items

  const pickGroup = (i: number) => {
    setGroup(i)
    setOpen(null)
    setSwapped(true)
  }

  return (
    <section data-sec="faq" id="faq" className="sec alt">
      <div className="wrap faq-grid">
        <div className="faq-side" data-reveal="left">
          <span className="label">{fq.label}</span>
          <h2 className="h2 faq-h2">{fq.title}</h2>
          <p className="sub">{fq.sub}</p>
          <div className="fgroups" role="group" aria-label={fq.label}>
            {fq.groups.map((g, i) => (
              <button key={g.id} type="button" className="fgroup" aria-pressed={group === i} onClick={() => pickGroup(i)}>
                {g.name}<span className="fcount">{g.items.length}</span>
              </button>
            ))}
          </div>
        </div>
        <div data-reveal="right">
          <div key={group} className={`faq${swapped ? ' swap' : ''}`}>
            {items.map((it, i) => {
              const isOpen = open === i
              return (
                <div key={it.q} className={`qa${isOpen ? ' open' : ''}`}>
                  <h3>
                    <button type="button" id={`faq-q${i}`} aria-expanded={isOpen} aria-controls={`faq-a${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                      <span>{it.q}</span><span className="qa-ic"><Ic n="plus" s={18} /></span>
                    </button>
                  </h3>
                  <div className="ans-wrap" id={`faq-a${i}`} role="region" aria-labelledby={`faq-q${i}`}>
                    <div className="ans-in"><p className="ans">{it.a}</p></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
