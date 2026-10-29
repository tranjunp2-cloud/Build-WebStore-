import { Ic, type IconName } from './lv-icon'
import { SectionHead } from './section-head'
import type { LvCopy } from './lv-types'

const INDUSTRY_ICONS: IconName[] = ['utensils-crossed', 'shopping-bag', 'flower-2', 'stethoscope']

function Step({ n, i, mock, title, desc }: { n: string; i: number; mock: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="step spot" data-reveal="up" style={{ '--i': i } as React.CSSProperties}>
      {mock}
      <div className="step-tx"><span className="step-n">{n}</span><h3 className="h3">{title}</h3><p className="p">{desc}</p></div>
    </div>
  )
}

function GenMark({ i }: { i: number }) {
  if (i === 0) return <span className="done"><Ic n="circle-check" s={14} /></span>
  return i === 1 ? <span className="spin" /> : <span className="gring" />
}

/** Section #how: three steps, each with a small product-UI mock (decorative, aria-hidden). */
export function HowItWorks({ copy }: { copy: LvCopy }) {
  const h = copy.how
  return (
    <section data-sec="how" id="how" className="sec alt">
      <div className="wrap">
        <SectionHead label={h.label} title={h.title} />
        <div className="steps">
          <Step n="01" i={0} title={h.s1t} desc={h.s1d} mock={
            <div className="mock m1" aria-hidden="true">
              {h.industries.map((label, i) => (
                <div key={label} className={`tile ${i === 0 ? 'on' : 'off'}`}>
                  <span className="badge"><Ic n={INDUSTRY_ICONS[i]} s={13} /></span>{label}
                </div>
              ))}
              <div className="m1-input"><span className="k">{h.mName}:</span>{h.mNameV}<span className="caret" /></div>
            </div>
          } />
          <Step n="02" i={1} title={h.s2t} desc={h.s2d} mock={
            <div className="mock m2" aria-hidden="true">
              <div className="m2-h"><Ic n="sparkles" s={14} />{h.mGen}</div>
              <div className="bar"><div /></div>
              <div className="gsteps">
                {h.genSteps.map((label, i) => (
                  <div key={label} className={`gstep${i === 2 ? ' pending' : ''}`}><GenMark i={i} />{label}</div>
                ))}
              </div>
              <div className="wire"><span /><span /><span /></div>
            </div>
          } />
          <Step n="03" i={2} title={h.s3t} desc={h.s3d} mock={
            <div className="mock m3" aria-hidden="true">
              <div className="url"><span className="lock"><Ic n="lock" s={14} /></span><span className="u">kopisenja.com.my</span><span className="live">{h.mLive}</span></div>
              <div className="dchips">
                <span className="dchip"><Ic n="landmark" s={13} />FPX</span>
                <span className="dchip"><Ic n="qr-code" s={13} />DuitNow QR</span>
                <span className="dchip"><Ic n="truck" s={13} />EasyParcel</span>
              </div>
              <div className="okline"><Ic n="circle-check" s={14} />{h.mPay}</div>
            </div>
          } />
        </div>
      </div>
    </section>
  )
}
