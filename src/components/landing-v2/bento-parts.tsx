import type { CSSProperties, ReactNode } from 'react'

/** Bento card shell: icon + title + text, then an aria-hidden mock slot. */
export function BentoCard({ cls = '', i, icon, title, desc, mockCls = '', children }: {
  cls?: string
  i: number
  icon: ReactNode
  title: string
  desc: string
  mockCls?: string
  children: ReactNode
}) {
  return (
    <div className={`card ${cls} spot`.replace(/\s+/g, ' ')} data-reveal="up" style={{ '--i': i } as CSSProperties}>
      <div className="card-h"><span className="card-ic">{icon}</span><h3>{title}</h3><p className="p">{desc}</p></div>
      <div className={`card-m ${mockCls}`.trim()} aria-hidden="true">{children}</div>
    </div>
  )
}

export function BrowserFrame({ url, children }: { url?: string; children: ReactNode }) {
  return (
    <div className="browser">
      <div className="browser-bar"><i /><i /><i />{url ? <span>{url}</span> : null}</div>
      {children}
    </div>
  )
}

/** Two-line item row used by the agent / shipping / notification mocks. */
export function PuiItem({ icon, tone = '', title, sub, when, late = false }: {
  icon: ReactNode
  tone?: string
  title: string
  sub: string
  when?: string
  late?: boolean
}) {
  return (
    <>
      <span className={`pui-ic ${tone}`.trim()}>{icon}</span>
      <div className="mw0"><div className="pui-t">{title}</div><div className={`pui-s${late ? ' late' : ''}`}>{sub}</div>{when ? <div className="when">{when}</div> : null}</div>
    </>
  )
}
