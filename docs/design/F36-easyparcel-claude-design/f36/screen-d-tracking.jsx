/* F36 · Screen D — Buyer Order Tracking  (storefront, light)
   /sites/[slug]/orders/[orderNumber]
   state: preparing | in-transit | delivered
   Polling (30–60 min) — not realtime. */

const { Icon: DIcon, courierById: D_by, CourierLogo: D_Logo, StoreShell: D_Store } = window;

const STAGES = [
  { key: "picked",  t: "Đã lấy hàng",      time: "16/06 · 10:20" },
  { key: "transit", t: "Đang trung chuyển", time: "16/06 · 18:45" },
  { key: "out",     t: "Đang giao",         time: "" },
  { key: "delivered", t: "Đã giao",         time: "" },
];

function Timeline({ current }) {
  // current index: in-transit -> 1 (now), delivered -> all done
  const nowIdx = current === "delivered" ? STAGES.length : 1;
  return (
    <div className="timeline">
      {STAGES.map((s, i) => {
        let cls = "pending";
        if (current === "delivered") cls = "done";
        else if (i < nowIdx) cls = "done";
        else if (i === nowIdx) cls = "now";
        const icon = cls === "done" ? "check" : cls === "now" ? "truck" : "circle";
        const time = current === "delivered"
          ? (s.time || (s.key === "out" ? "17/06 · 09:10" : "17/06 · 14:30"))
          : s.time;
        return (
          <div key={s.key} className={`tl-step ${cls}`}>
            <div className="tl-rail">
              <div className="tl-node"><DIcon name={icon} /></div>
              <div className="tl-line" />
            </div>
            <div className="tl-body">
              <div className="tl-t">{s.t}{cls === "now" && " · hiện tại"}</div>
              {time && <div className="tl-time">{time}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrackingScreen({ state = "in-transit", mobile = false }) {
  const courier = D_by("jnt");
  const delivered = state === "delivered";
  const preparing = state === "preparing";

  return (
    <div className={`f36 f36-store ${mobile ? "m375" : ""}`} data-theme="light">
      <D_Store store="Aurora Batik">
        <div className="track-wrap">
          <div className="track-head">
            <h1>Đơn #PRM-1042</h1>
            {delivered ? <span className="badge solid-teal" style={{ height: 26, padding: "0 12px" }}><DIcon name="check" /> Đã giao</span>
              : preparing ? <span className="badge gray" style={{ height: 26, padding: "0 12px" }}><DIcon name="package" /> Đang chuẩn bị</span>
              : <span className="badge blue" style={{ height: 26, padding: "0 12px" }}><DIcon name="truck" /> Đang giao</span>}
          </div>

          {/* Shipping block */}
          <div className="block">
            <h3 className="block-h"><DIcon name="truck" /> Vận chuyển</h3>
            {preparing ? (
              <div className="empty-rate" style={{ borderStyle: "solid", background: "#f8fafc" }}>
                <DIcon name="package-2" /> Đơn đang được chuẩn bị — mã vận đơn sẽ xuất hiện khi hàng được lấy.
              </div>
            ) : (
              <div className="ship-block">
                <div className="ship-row"><span className="sr-k">Đơn vị</span><span className="sr-v"><D_Logo courier={courier} size={24} /> J&T Express</span></div>
                <div className="ship-row"><span className="sr-k">Mã vận đơn</span><span className="sr-v" style={{ fontFamily: "var(--font-mono)" }}>631234567890 <span className="cf-btn" style={{ color: "#2563eb", fontWeight: 600, cursor: "pointer" }}><DIcon name="copy" /> Copy</span></span></div>
                <div style={{ marginTop: 4 }}>
                  <a className="track-link"><DIcon name="external-link" /> Theo dõi trên J&T</a>
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          {!preparing && (
            <div className="block">
              <h3 className="block-h"><DIcon name="route" /> Hành trình</h3>
              <Timeline current={state} />
              {!delivered && (
                <div className="help" style={{ marginTop: 6, color: "#64748b" }}>
                  <DIcon name="clock" /> Cập nhật mỗi 30–60 phút — không realtime.
                </div>
              )}
            </div>
          )}
        </div>
      </D_Store>
    </div>
  );
}

window.TrackingScreen = TrackingScreen;
