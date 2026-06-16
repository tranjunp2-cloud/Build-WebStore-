/* F36 · Screen E — Returns / Refund  (dashboard, dark · Dialog)
   Orders › [order] › "Xử lý trả hàng"
   Reverse-label radio choice + wallet box. Auxiliary 3-tier cancel/refund
   block (color-coded by how far the shipment has progressed).
   state: form | submitting | success | error */

const { Icon: EIcon, fmtRM: EfmtRM, courierById: E_by, CourierLogo: E_Logo,
        DashShell: E_Dash, OrderDetailBackdrop: E_Backdrop } = window;

function RefundTiers() {
  return (
    <div className="field">
      <label className="lbl">Nếu huỷ đơn — hoàn tiền theo tiến độ giao</label>
      <div className="alert success">
        <span style={{ fontWeight: 800, marginRight: 2 }}>①</span>
        <div className="a-body"><div className="a-t">Chưa mua nhãn</div>Refund FULL (hàng + ship) + restock ngay.</div>
      </div>
      <div className="alert warning">
        <span style={{ fontWeight: 800, marginRight: 2 }}>②</span>
        <div className="a-body"><div className="a-t">Đã mua nhãn, chưa pickup</div>Refund tiền hàng. Huỷ đơn trên dashboard EasyParcel để hoàn lại cước vào ví.</div>
        <span className="a-link">EasyParcel <EIcon name="external-link" /></span>
      </div>
      <div className="alert error">
        <span style={{ fontWeight: 800, marginRight: 2 }}>③</span>
        <div className="a-body"><div className="a-t">Đã pickup</div>Refund tiền hàng. ⚠️ Cước vận chuyển đã mất, không hoàn được.</div>
      </div>
    </div>
  );
}

function ReturnsScreen({ state = "form" }) {
  const submitting = state === "submitting";
  const success = state === "success";
  const error = state === "error";
  const busy = submitting;

  return (
    <div className="f36 f36-dash" data-theme="dark">
      <E_Dash crumbs={["Orders", "#PRM-1042", "Xử lý trả hàng"]} active="orders" dim>
        <E_Backdrop />
      </E_Dash>

      <div className="dialog-backdrop">
        <div className="dialog wide">
          <div className="dialog-h">
            <span style={{ fontSize: 18 }}>↩️</span>
            <h3>Xử lý trả hàng — Đơn #PRM-1042</h3>
            <span className="x"><EIcon name="x" /></span>
          </div>

          {success ? (
            <>
              <div className="dialog-b">
                <div className="alert success"><EIcon name="check-circle-2" className="lead" /><div className="a-body"><div className="a-t">Đã tạo nhãn trả hàng</div>EasyParcel đã đảo origin↔dest — kho của bạn là nơi nhận.</div></div>
                <div className="field">
                  <label className="lbl">Mã vận đơn trả (return AWB)</label>
                  <div className="copyfield"><span className="cf-v">639887766554</span><span className="cf-btn"><EIcon name="copy" /> Copy</span></div>
                </div>
                <div className="kv"><span className="k">Courier</span><span className="v"><E_Logo courier={E_by("jnt")} size={22} /> J&T Express</span></div>
                <div className="alert info"><EIcon name="wallet" className="lead" /><div className="a-body">Đã trừ <b>{EfmtRM(542)}</b> cước trả. Số dư ví còn <b>{EfmtRM(4258)}</b>.</div></div>
              </div>
              <div className="dialog-foot">
                <button className="btn btn-outline"><EIcon name="printer" /> In nhãn trả (PDF)</button>
                <button className="btn btn-primary"><EIcon name="check" /> Xong</button>
              </div>
            </>
          ) : (
            <>
              <div className="dialog-b">
                {error && (
                  <div className="alert error"><EIcon name="circle-alert" className="lead" /><div className="a-body"><div className="a-t">Không tạo được nhãn trả</div>EasyParcel API lỗi tạm thời. Đơn chưa thay đổi — thử lại sau giây lát.</div></div>
                )}

                <div className="field">
                  <label className="lbl">Phương thức trả hàng</label>
                  <div className="radio-stack">
                    <label className="radio-card on">
                      <span className="radio-dot" />
                      <div><div className="rc-t">Tạo nhãn trả hàng <span className="badge blue">reverse</span></div>
                        <div className="rc-d">EasyParcel tạo đơn mới đảo origin↔dest: kho của bạn = nơi nhận.</div></div>
                    </label>
                    <label className="radio-card">
                      <span className="radio-dot" />
                      <div><div className="rc-t">Buyer tự gửi</div>
                        <div className="rc-d">Bạn xác nhận khi nhận được hàng → refund + restock.</div></div>
                    </label>
                  </div>
                </div>

                <div className="wallet">
                  <span className="w-ico"><EIcon name="wallet" /></span>
                  <div>
                    <div className="w-main">Cước trả ~<b>{EfmtRM(542)}</b> — trừ ví của bạn</div>
                    <div className="w-sub">Ví hiện tại: <b>{EfmtRM(4800)}</b></div>
                  </div>
                </div>

                <RefundTiers />
              </div>
              <div className="dialog-foot">
                <button className="btn btn-ghost" disabled={busy}>Hủy</button>
                {error
                  ? <button className="btn btn-primary"><EIcon name="refresh-cw" /> Thử lại</button>
                  : <button className={`btn btn-primary ${busy ? "disabled" : ""}`} disabled={busy}>
                      {submitting ? <><span className="spin dark" /> Đang tạo nhãn trả…</> : <><EIcon name="undo-2" /> Tạo nhãn trả &amp; trừ ví</>}
                    </button>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.ReturnsScreen = ReturnsScreen;
