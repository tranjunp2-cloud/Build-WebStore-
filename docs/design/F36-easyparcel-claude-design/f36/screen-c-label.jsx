/* F36 · Screen C — Create Label / ShipOrderModal  (dashboard, dark · Dialog)
   Orders › [order] › "Tạo vận đơn"
   2-step create (submit → pay). Idempotent once an AWB exists (form locks).
   state: form | submitting | paying | success | error  */

const { Icon: CIcon, fmtRM: CfmtRM, COURIERS: C_COURIERS, courierById: C_by,
        CourierLogo: C_Logo, DashShell: C_Dash, OrderDetailBackdrop: C_Backdrop } = window;

function LabelForm({ locked }) {
  const offered = ["flash", "poslaju", "jnt", "ninja", "dhl"].map(C_by);
  return (
    <div style={locked ? { opacity: .5, pointerEvents: "none" } : null} className="dialog-b" >
      {/* mode toggle */}
      <div className="radio-seg" style={{ alignSelf: "flex-start" }}>
        <button className="on"><CIcon name="truck" /> EasyParcel</button>
        <button><CIcon name="pencil-line" /> Nhập tracking thủ công</button>
      </div>

      <div className="field">
        <label className="lbl">Courier <span className="opt">· buyer đã chọn</span></label>
        <div className="sel">
          <select defaultValue="jnt">{offered.map((c) => <option key={c.id} value={c.id}>{c.name} — from {CfmtRM(c.from)}</option>)}</select>
          <CIcon name="chevron-down" className="chev" />
        </div>
      </div>

      <div className="field">
        <label className="lbl">Parcel <span className="opt">· prefill từ sản phẩm</span></label>
        <div className="row-2">
          <div className="inp"><span className="pre">Weight</span><input defaultValue="600" /><span className="suf">g</span></div>
          <div className="row-3" style={{ gap: 10 }}>
            <div className="inp"><input defaultValue="22" /><span className="suf">L</span></div>
            <div className="inp"><input defaultValue="16" /><span className="suf">W</span></div>
            <div className="inp"><input defaultValue="9" /><span className="suf">H</span></div>
          </div>
        </div>
      </div>

      <div className="row-2">
        <div className="field">
          <label className="lbl">Hình thức lấy hàng</label>
          <div className="radio-stack">
            <label className="radio-card on" style={{ padding: "11px 13px" }}><span className="radio-dot" /><div><div className="rc-t">Đặt lấy hàng</div><div className="rc-d">Courier đến kho lấy.</div></div></label>
            <label className="radio-card" style={{ padding: "11px 13px" }}><span className="radio-dot" /><div><div className="rc-t">Tự gửi (dropoff)</div><div className="rc-d">Bạn mang ra điểm gửi.</div></div></label>
          </div>
        </div>
        <div className="field">
          <label className="lbl">Ngày lấy</label>
          <div className="inp"><span className="pre"><CIcon name="calendar" /></span><input defaultValue="17 Jun 2026 (Thứ 3)" readOnly /></div>
          <div className="help"><CIcon name="info" /> Mặc định ngày làm việc kế tiếp.</div>
        </div>
      </div>

      <div className="wallet">
        <span className="w-ico"><CIcon name="wallet" /></span>
        <div>
          <div className="w-main">Cước dự kiến: <b>{CfmtRM(542)}</b> — trừ ví EasyParcel</div>
          <div className="w-sub">Ví hiện tại: <b>{CfmtRM(4800)}</b></div>
        </div>
      </div>
    </div>
  );
}

function LabelScreen({ state = "form" }) {
  const submitting = state === "submitting";
  const paying = state === "paying";
  const success = state === "success";
  const error = state === "error";
  const busy = submitting || paying;
  const locked = busy || success;

  return (
    <div className="f36 f36-dash" data-theme="dark">
      <C_Dash crumbs={["Orders", "#PRM-1042", "Tạo vận đơn"]} active="orders" dim>
        <C_Backdrop />
      </C_Dash>

      <div className="dialog-backdrop">
        <div className="dialog">
          <div className="dialog-h">
            <span style={{ fontSize: 18 }}>🚚</span>
            <h3>Tạo vận đơn — Đơn #PRM-1042</h3>
            <span className="x"><CIcon name="x" /></span>
          </div>

          {success ? (
            <>
              <div className="dialog-b">
                <div className="alert success"><CIcon name="check-circle-2" className="lead" /><div className="a-body"><div className="a-t">Đã tạo vận đơn</div>Đơn sẵn sàng để gửi cho courier.</div></div>
                <div className="field">
                  <label className="lbl">Mã vận đơn (AWB)</label>
                  <div className="copyfield">
                    <span className="cf-v">631234567890</span>
                    <span className="cf-btn"><CIcon name="copy" /> Copy</span>
                  </div>
                </div>
                <div className="kv"><span className="k">Courier</span><span className="v"><C_Logo courier={C_by("jnt")} size={22} /> J&T Express</span></div>
                <div className="kv"><span className="k">Trạng thái</span><span className="v"><span className="badge ok"><CIcon name="circle-check" /> Ready to ship</span></span></div>
                <div className="alert info"><CIcon name="wallet" className="lead" /><div className="a-body">Đã trừ <b>{CfmtRM(542)}</b>. Số dư ví còn <b>{CfmtRM(4258)}</b>.</div></div>
              </div>
              <div className="dialog-foot">
                <button className="btn btn-outline"><CIcon name="calendar-clock" /> Lịch pickup</button>
                <button className="btn btn-primary"><CIcon name="printer" /> In nhãn (PDF)</button>
              </div>
            </>
          ) : error ? (
            <>
              <div className="dialog-b">
                <div className="alert error"><CIcon name="circle-alert" className="lead" /><div className="a-body"><div className="a-t">EASYPARCEL_WALLET_LOW</div>Ví không đủ cước (cần {CfmtRM(542)}, còn {CfmtRM(210)}). Nạp ví rồi thử lại — đơn chưa thay đổi.</div></div>
                <LabelFormLockedNote />
              </div>
              <div className="dialog-foot">
                <button className="btn btn-outline"><CIcon name="external-link" /> Nạp ví</button>
                <button className="btn btn-primary"><CIcon name="refresh-cw" /> Thử lại</button>
              </div>
            </>
          ) : (
            <>
              <LabelForm locked={locked} />
              <div className="dialog-foot">
                <button className="btn btn-ghost" disabled={busy}>Hủy</button>
                <button className={`btn btn-primary ${busy ? "disabled" : ""}`} disabled={busy}>
                  {submitting ? <><span className="spin dark" /> Đang giữ chỗ…</>
                    : paying ? <><span className="spin dark" /> Đang trừ ví…</>
                    : <><span style={{ fontSize: 15 }}>🏷️</span> Tạo &amp; trừ ví</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LabelFormLockedNote() {
  return (
    <div className="wallet" style={{ background: "rgba(239,68,68,.06)", borderColor: "rgba(239,68,68,.2)" }}>
      <span className="w-ico" style={{ background: "rgba(239,68,68,.12)", color: "#f87171" }}><CIcon name="wallet" /></span>
      <div>
        <div className="w-main">Cước dự kiến: <b>{CfmtRM(542)}</b></div>
        <div className="w-sub" style={{ color: "#f87171" }}>Ví: <b style={{ color: "#fca5a5" }}>{CfmtRM(210)}</b> — không đủ</div>
      </div>
    </div>
  );
}

window.LabelScreen = LabelScreen;
