import { Ic } from './lv-icon'
import { BentoCard, BrowserFrame, PuiItem } from './bento-parts'
import { TemplateThumb } from './template-thumb'
import { MASCOT_SRC } from './lv-assets'
import type { LvCopy, LvTemplate } from './lv-types'

interface Props { f: LvCopy['feat']; x: LvCopy['mock']; heroTemplate?: LvTemplate; loading: boolean }

/** Bento cards 1-5: AI builder, visual editor, ECH Agent, payments, shipping. */
export function BentoCardsBuild({ f, x, heroTemplate, loading }: Props) {
  return (
    <>
      <BentoCard cls="big s2" i={0} icon={<Ic n="wand-2" s={20} />} title={f.aiT} desc={f.aiD} mockCls="stack12">
        <div className="pillrow"><span className="pill"><Ic n="utensils" s={14} />{f.aiInd}</span><span className="pill"><Ic n="store" s={14} />Kopi Senja</span></div>
        <div className="brief"><Ic n="sparkles" s={16} />{f.aiBrief}</div>
        <BrowserFrame url="kopisenja.com.my">
          <TemplateThumb id={heroTemplate?.id} name={heroTemplate?.name} ratio="16/9" loading={loading} />
        </BrowserFrame>
      </BentoCard>

      <BentoCard cls="s2" i={1} icon={<Ic n="mouse-pointer-click" s={20} />} title={f.edT} desc={f.edD} mockCls="edpanel">
        <div className="rtb">
          <span className="hsel">H1<Ic n="chevron-down" s={11} /></span><span className="div" />
          <span className="sq on"><Ic n="bold" s={13} /></span><span className="sq"><Ic n="italic" s={13} /></span>
          <span className="sq"><Ic n="underline" s={13} /></span><span className="sq"><Ic n="link" s={13} /></span>
          <span className="div" /><span className="ai"><Ic n="sparkles" s={12} />AI</span>
        </div>
        <div className="edhead">{f.edSample}</div>
      </BentoCard>

      {/* eslint-disable-next-line @next/next/no-img-element -- 40px decorative mascot */}
      <BentoCard i={2} icon={<img src={MASCOT_SRC} alt="" />} title={f.agT} desc={f.agD} mockCls="pui">
        <div className="pui-row"><PuiItem tone="amber" icon={<Ic n="clipboard-list" s={14} />} title={f.agQ1} sub={f.agQ1f} late /></div>
        <div className="pui-row flush"><span className="pui-go ind">{f.agQ1go}</span></div>
        <div className="pui-row"><PuiItem icon={<Ic n="package" s={14} />} title={f.agQ2} sub={f.agQ2f} /></div>
        <div className="pui-row flush"><span className="pui-go ind">{f.agQ2go}</span></div>
      </BentoCard>

      <BentoCard i={3} icon={<Ic n="credit-card" s={20} />} title={f.payT} desc={f.payD}>
        <div className="paychips">{f.payChips.map((c) => <span key={c} className="pill">{c}</span>)}</div>
        <div className="paynote"><Ic n="landmark" s={15} />{f.payNote}</div>
      </BentoCard>

      <BentoCard i={0} icon={<Ic n="truck" s={20} />} title={f.shipT} desc={f.shipD} mockCls="pui">
        <div className="pui-row"><PuiItem icon={<Ic n="package" s={14} />} title={x.ship.parcel} sub={x.ship.to} /></div>
        <div className="pui-row wrap6">
          <span className="st green"><Ic n="printer" s={12} />{f.shipM1}</span>
          <span className="st blue"><Ic n="truck" s={12} />{f.shipM2}</span>
        </div>
      </BentoCard>
    </>
  )
}
