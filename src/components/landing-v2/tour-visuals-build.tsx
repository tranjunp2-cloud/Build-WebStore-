import { Ic } from './lv-icon'
import { PuiItem } from './bento-parts'
import { MASCOT_SRC } from './lv-assets'
import type { LvCopy } from './lv-types'

/** Product-tour visual 1: in-place AI editor (canvas + chat). Decorative. */
export function EditorVisual({ x }: { x: LvCopy['mock'] }) {
  const e = x.ed
  return (
    <>
      <div className="canvas">
        <span className="canvas-tag">{e.hero}</span>
        <div className="btool">
          <span><Ic n="grip-vertical" s={13} /></span>
          <span><Ic n="copy" s={13} />{e.dup}</span>
          <span className="aib"><Ic n="sparkles" s={13} />{e.ai}</span>
          <span className="del"><Ic n="trash-2" s={13} /></span>
        </div>
        <div className="ttl">{e.to}</div>
        <div className="sml">{e.small}</div>
        <span className="cbtn">{e.btn}</span>
      </div>
      <div className="chat">
        <div className="msg-u">{e.ask}</div>
        <div className="msg-a">
          <span className="av"><Ic n="sparkles" s={14} /></span>
          <div className="applied">
            <div className="h"><Ic n="check" s={14} />{e.done}</div>
            <div className="d"><del>{e.from}</del> → {e.to}</div>
            <div className="act">
              <span className="mini-btn"><Ic n="undo-2" s={12} />{e.undo}</span>
              <span className="mini-btn"><Ic n="check" s={12} />{e.keep}</span>
            </div>
          </div>
        </div>
        <div className="chat-in">{e.input}<span className="snd"><Ic n="send" s={14} /></span></div>
      </div>
    </>
  )
}

/** Product-tour visual 2: ECH Agent work queue + approval card. Decorative. */
export function AgentVisual({ f, x }: { f: LvCopy['feat']; x: LvCopy['mock'] }) {
  const a = x.ag
  return (
    <>
      <div className="dd-card">
        <div className="dd-cap">
          {/* eslint-disable-next-line @next/next/no-img-element -- 20px decorative mascot */}
          <img src={MASCOT_SRC} alt="" width={20} height={20} />{a.cap}<span className="r st teal">3</span>
        </div>
        <div className="pui bare">
          <div className="pui-row"><PuiItem tone="amber" icon={<Ic n="clipboard-list" s={14} />} title={f.agQ1} sub={f.agQ1f} late /><span className="pui-go">{f.agQ1go}</span></div>
          <div className="pui-row"><PuiItem tone="red" icon={<Ic n="package" s={14} />} title={a.q3} sub={a.q3f} /><span className="pui-go">{a.q3go}</span></div>
          <div className="pui-row"><PuiItem icon={<Ic n="package" s={14} />} title={f.agQ2} sub={f.agQ2f} /><span className="pui-go">{f.agQ2go}</span></div>
        </div>
      </div>
      <div className="approve">
        <div className="h"><Ic n="pen-line" s={14} />{a.appr}</div>
        <div className="diff"><b>{a.item}</b></div>
        <div className="diff">{a.edit} <span className="from">0</span> → <span className="to">20</span></div>
        <div className="row"><span className="btn-ok"><Ic n="check" s={13} />{a.approve}</span><span className="undo"><Ic n="undo-2" s={12} />{a.undo}</span></div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative floating mascot */}
      <img className="agent-masc" src={MASCOT_SRC} alt="" />
    </>
  )
}
