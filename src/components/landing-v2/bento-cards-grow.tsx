import { Ic } from './lv-icon'
import { BentoCard, BrowserFrame, PuiItem } from './bento-parts'
import { TemplateThumb } from './template-thumb'
import type { LvCopy, LvTemplate } from './lv-types'

const ORDER_TONES = ['green', 'amber', 'blue'] as const

interface Props {
  f: LvCopy['feat']
  x: LvCopy['mock']
  locale: 'en' | 'ms'
  previews: Array<LvTemplate | undefined>
  loading: boolean
}

/** Bento cards 6-10: orders, SEO health, templates, languages, notifications. */
export function BentoCardsGrow({ f, x, locale, previews, loading }: Props) {
  const ms = locale === 'ms'
  return (
    <>
      <BentoCard cls="s2" i={1} icon={<Ic n="shopping-cart" s={20} />} title={f.ordT} desc={f.ordD}>
        <div className="pui">
          <table className="otable">
            <tbody>
              {f.ordRows.map(([num, status], i) => (
                <tr key={num}>
                  <td className="num">{num}</td>
                  <td><span className={`st ${ORDER_TONES[i]}`}>{status}</span></td>
                  <td className="amt">{x.ord.amounts[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span className="disc"><Ic n="tag" s={13} />{f.ordCode}</span>
      </BentoCard>

      <BentoCard i={2} icon={<Ic n="gauge" s={20} />} title={f.seoT} desc={f.seoD} mockCls="pui seo-m">
        <span className="hring"><Ic n="search" s={18} /></span>
        <div className="chk">
          <div><span className="ok"><Ic n="circle-check" s={14} /></span>{x.seo.r1}</div>
          <div><span className="warn"><Ic n="circle-alert" s={14} /></span>{x.seo.r2}</div>
        </div>
      </BentoCard>

      <BentoCard cls="s2" i={3} icon={<Ic n="layout-template" s={20} />} title={f.tplT} desc={f.tplD} mockCls="tthumbs">
        {previews.map((tpl, i) => (
          <BrowserFrame key={tpl?.id ?? `empty-${i}`}>
            <TemplateThumb id={tpl?.id} name={tpl?.name} loading={loading} />
          </BrowserFrame>
        ))}
      </BentoCard>

      <BentoCard i={0} icon={<Ic n="languages" s={20} />} title={f.langT} desc={f.langD}>
        <div className="seg"><span className={ms ? '' : 'on'}>English</span><span className={ms ? 'on' : ''}>Bahasa Melayu</span></div>
        <div className="langprev">
          <Ic n="shopping-cart" s={13} /><b>{ms ? x.lang.sampleMs : x.lang.sample}</b>·<span>{ms ? x.lang.sample : x.lang.sampleMs}</span>
        </div>
      </BentoCard>

      <BentoCard i={1} icon={<Ic n="bell" s={20} />} title={f.notT} desc={f.notD} mockCls="pui clip">
        <div className="notif">
          <PuiItem tone="green" icon={<Ic n="shopping-bag" s={14} />} title={f.notM1} sub={x.notif.m1} when={x.notif.now} />
          <span className="dot" />
        </div>
        <div className="notif">
          <PuiItem tone="amber" icon={<Ic n="package" s={14} />} title={f.notM2} sub={x.notif.m2} when={x.notif.ago} />
          <span className="dot" />
        </div>
      </BentoCard>
    </>
  )
}
