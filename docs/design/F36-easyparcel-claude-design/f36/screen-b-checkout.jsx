/* F36 · Screen B — Checkout, multi-courier rate  (storefront, light)
   /sites/[slug]/checkout · 2-column. Left = address + courier choice,
   right = order summary that re-totals on courier select.
   state: empty | loading | rates | free | fallback */

const { Icon: BIcon, fmtRM: BfmtRM, COURIERS: B_COURIERS, courierById: B_by,
        CourierLogo: B_Logo, StoreShell: B_Store } = window;

const SUBTOTAL = 8900;   // sen — cart subtotal (RM 89.00)
const FREE_THRESHOLD = 15000;

function AddressForm({ filled }) {
  return (
    <div className="block">
      <h3 className="block-h"><BIcon name="map-pin" /> Địa chỉ giao hàng</h3>
      <div className="addr-grid">
        <div className="field"><label className="lbl">Họ tên</label><div className="inp"><input defaultValue={filled ? "Aisyah Rahman" : ""} placeholder="Nguyễn..." /></div></div>
        <div className="field"><label className="lbl">Điện thoại</label><div className="inp"><input defaultValue={filled ? "012-345 6789" : ""} placeholder="01x-xxx xxxx" /></div></div>
      </div>
      <div className="field" style={{ marginTop: 13 }}><label className="lbl">Địa chỉ</label><div className="inp"><input defaultValue={filled ? "12 Jalan Bukit Bintang" : ""} placeholder="Address line 1" /></div></div>
      <div className="addr-grid" style={{ marginTop: 13, gridTemplateColumns: "1fr 1fr 1.2fr" }}>
        <div className="field"><label className="lbl">Postcode</label><div className="inp"><input inputMode="numeric" maxLength={5} defaultValue={filled ? "55100" : ""} placeholder="5 digits" /></div></div>
        <div className="field"><label className="lbl">City</label><div className="inp"><input defaultValue={filled ? "Kuala Lumpur" : ""} /></div></div>
        <div className="field"><label className="lbl">State</label><div className="sel"><select defaultValue={filled ? "Kuala Lumpur" : ""}><option value="">Select…</option><option>Kuala Lumpur</option><option>Selangor</option><option>Johor</option></select><BIcon name="chevron-down" className="chev" /></div></div>
      </div>
    </div>
  );
}

function CourierChoice({ state }) {
  // ranking by price; selected = J&T (542). Cheapest=Flash, 2nd=Pos Laju... 
  // brief: J&T shows ⚡ "rẻ nhì" badge in the example, FREE badge in free state.
  const offered = ["flash", "poslaju", "jnt", "ninja"].map(B_by);
  const selected = "jnt";
  const isFree = state === "free";

  if (state === "empty") {
    return (
      <div className="block">
        <h3 className="block-h"><BIcon name="truck" /> Chọn đơn vị vận chuyển</h3>
        <div className="empty-rate"><BIcon name="lightbulb" /> Nhập địa chỉ giao hàng để xem cước vận chuyển.</div>
      </div>
    );
  }
  if (state === "loading") {
    return (
      <div className="block">
        <h3 className="block-h"><BIcon name="truck" /> Chọn đơn vị vận chuyển</h3>
        <div className="cc-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="cc-card" style={{ cursor: "default" }}>
              <div className="sk" style={{ width: 19, height: 19, borderRadius: 99 }} />
              <div className="sk" style={{ width: 34, height: 34, borderRadius: 8 }} />
              <div style={{ flex: 1 }}>
                <div className="sk" style={{ width: "55%", height: 13, marginBottom: 7 }} />
                <div className="sk" style={{ width: "35%", height: 11 }} />
              </div>
              <div className="sk" style={{ width: 54, height: 16 }} />
            </div>
          ))}
        </div>
        <div className="help" style={{ marginTop: 12, color: "#94a3b8" }}><BIcon name="loader" /> Đang lấy cước EasyParcel… (debounce 300ms)</div>
      </div>
    );
  }
  if (state === "fallback") {
    return (
      <div className="block">
        <h3 className="block-h"><BIcon name="truck" /> Vận chuyển</h3>
        <div className="cc-list">
          <div className="cc-card on">
            <span className="cc-radio" />
            <div className="cc-info"><div className="cc-name">Giao hàng tiêu chuẩn</div><div className="cc-eta">3–5 ngày làm việc · Semenanjung</div></div>
            <div className="cc-price">{BfmtRM(800)}</div>
          </div>
        </div>
      </div>
    );
  }

  // rates / free
  return (
    <div className="block">
      <h3 className="block-h"><BIcon name="truck" /> Chọn đơn vị vận chuyển</h3>
      <div className="cc-list">
        {offered.map((c, i) => {
          const on = c.id === selected;
          const cheapest = i === 0;
          const second = i === 1;
          return (
            <div key={c.id} className={`cc-card ${on ? "on" : ""}`}>
              <span className="cc-radio" />
              <B_Logo courier={c} size={34} />
              <div className="cc-info">
                <div className="cc-name">
                  {c.name}
                  {cheapest && <span className="cc-badge cheap">⚡ rẻ nhất</span>}
                  {second && <span className="cc-badge cheap">rẻ nhì</span>}
                </div>
                <div className="cc-eta">{c.eta}</div>
              </div>
              <div className={`cc-price ${isFree && on ? "free" : ""}`}>
                {isFree && on ? "🎉 FREE" : BfmtRM(c.from)}
              </div>
            </div>
          );
        })}
      </div>
      {isFree && (
        <div className="help" style={{ marginTop: 12, color: "#059669", fontWeight: 600 }}>
          <BIcon name="party-popper" /> Đơn ≥ {BfmtRM(FREE_THRESHOLD)} — miễn phí ship với đơn vị đã chọn.
        </div>
      )}
    </div>
  );
}

function OrderSummary({ state }) {
  const isFree = state === "free";
  const ship = state === "fallback" ? 800 : 542;       // J&T 5.42 / flat 8.00
  const shippingSen = isFree ? 0 : ship;
  const known = state !== "empty" && state !== "loading";
  const sst = Math.round((SUBTOTAL + shippingSen) * 0.06);
  const total = SUBTOTAL + shippingSen + sst;

  return (
    <div className="summary">
      <h3>Order Summary</h3>
      <div className="sum-row"><span>Subtotal · 2 items</span><span className="v">{BfmtRM(SUBTOTAL)}</span></div>
      <div className={`sum-row ${isFree ? "free" : !known ? "muted" : ""}`}>
        <span>Shipping {state === "fallback" ? "" : "(J&T Express)"}</span>
        <span className="v">{!known ? "—" : isFree ? "FREE" : BfmtRM(shippingSen)}</span>
      </div>
      <div className="sum-row"><span>SST (6%)</span><span className="v">{known ? BfmtRM(sst) : "—"}</span></div>
      <div className="sum-total">
        <span className="l">Total</span>
        <span className="v">{known ? BfmtRM(total) : BfmtRM(SUBTOTAL + Math.round(SUBTOTAL * 0.06))}</span>
      </div>
      <button className="btn btn-primary btn-block" style={{ marginTop: 18, height: 46 }} disabled={!known}>
        <BIcon name="lock" /> Place Order
      </button>
      <div className="sum-hint"><BIcon name="shield-check" /> Cước EasyParcel raw — không phụ phí.</div>
    </div>
  );
}

function CheckoutScreen({ state = "rates", mobile = false }) {
  const filled = state !== "empty";
  return (
    <div className={`f36 f36-store ${mobile ? "m375" : ""}`} data-theme="light">
      <B_Store store="Aurora Batik">
        <div className="store-wrap">
          <h1 className="store-h1">Checkout</h1>
          <div className="co-grid">
            <div>
              <AddressForm filled={filled} />
              <CourierChoice state={state} />
            </div>
            <OrderSummary state={state} />
          </div>
        </div>
      </B_Store>
    </div>
  );
}

window.CheckoutScreen = CheckoutScreen;
