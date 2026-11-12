import { Ic } from './lv-icon'
import type { LvCopy } from './lv-types'

const METHODS = [
  { icon: 'credit-card', name: 'Stripe', key: 'stripe' },
  { icon: 'qr-code', name: 'DuitNow QR', key: 'duitnow' },
  { icon: 'banknote', name: 'COD', key: 'cod' },
] as const

/** Product-tour visual 3: order card + payment methods. Decorative. */
export function SellVisual({ x }: { x: LvCopy['mock'] }) {
  const s = x.sell
  return (
    <>
      <div className="dd-card">
        <div className="ocard-top"><span className="num">#1042</span><span className="pui-s">{s.items}</span><span className="amt">{s.total}</span></div>
        <div className="oline"><span className="thumbsq" /><span>{s.l1}</span><span className="q">×1</span></div>
        <div className="oline"><span className="thumbsq b" /><span>{s.l2}</span><span className="q">×1</span></div>
        <div className="ofoot">
          <span className="st green"><Ic n="circle-check" s={12} />{s.paid}</span>
          <span className="st teal"><Ic n="printer" s={12} />{s.label}</span>
        </div>
      </div>
      <div className="dd-card">
        <div className="dd-cap"><Ic n="credit-card" s={14} />{s.methods}</div>
        {METHODS.map((m) => (
          <div key={m.key} className="pm">
            <span className="pui-ic"><Ic n={m.icon} s={14} /></span>
            <div><div className="nm">{m.name}</div><div className="ds">{s[m.key]}</div></div>
            <span className="tgl" />
          </div>
        ))}
      </div>
    </>
  )
}

/** Product-tour visual 4: SEO health + AI blog writer. Decorative. */
export function SeoVisual({ x }: { x: LvCopy['mock'] }) {
  const d = x.seoD
  return (
    <>
      <div className="dd-card">
        <div className="dd-cap"><Ic n="gauge" s={14} />{d.cap}</div>
        <div className="seo-top">
          <span className="hring"><Ic n="search" s={20} /></span>
          <div className="chk">
            <div><span className="ok"><Ic n="circle-check" s={14} /></span>{d.ok1}</div>
            <div><span className="ok"><Ic n="circle-check" s={14} /></span>{d.ok2}</div>
            <div><span className="warn"><Ic n="circle-alert" s={14} /></span>{d.warn}</div>
          </div>
        </div>
      </div>
      <div className="dd-card">
        <div className="dd-cap"><Ic n="file-text" s={14} />{d.blog}<span className="r btn-ok sm"><Ic n="sparkles" s={12} />{d.gen}</span></div>
        <div className="blog">
          <div className="field"><span className="k">{d.topic}</span><span className="v">{d.topicV}</span></div>
          <div className="field"><span className="k">{d.title}</span><span className="v gen">{d.titleV}</span></div>
        </div>
      </div>
    </>
  )
}
