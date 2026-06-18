/* F36 · Screen A — EasyParcel Settings  (dashboard, dark)
   Settings › Shipping › tab "EasyParcel"  (sits beside "Flat Rate")
   state: disconnected | testing | invalid | connected | saving

   Aligned to PRD #1232 (fidelity-fix, single-courier):
   - Connect UI mirrors F34 Payments (XenditConnectBlock/ConnectedBar): 2 masked keys + eye + Test.
   - NO environment selector — auto-detected at Test connection (production → demo fallback).
   - Warehouse = Prime source of truth; State→City→Postcode = geo cascade (/api/geo/*),
     postcode force-validated at Test connection.
   - Connected reveals ONE courier (RadioGroup single-select, default J&T, no price).
   - NO default-parcel form, NO fulfilment-mode toggle, NO wallet-balance UI. */

const { Icon: AIcon, fmtRM: AfmtRM, MY_STATES: A_STATES, COURIERS: A_COURIERS,
        courierById: A_byId, CourierLogo: A_Logo, DashShell: A_Dash, Alert: A_Alert } = window;

const A_TOP3 = ["jnt", "poslaju", "flash"]; // J&T #1 SME default; Pos Laju, Flash next

function SettingsTabs() {
  return (
    <div className="tabs">
      <button className="tab"><AIcon name="calculator" /> Flat Rate</button>
      <button className="tab active"><AIcon name="truck" /> EasyParcel</button>
    </div>
  );
}

function SecretInput({ label, hint, value, reveal, onToggle }) {
  return (
    <div className="field">
      <label className="lbl">{label}</label>
      <div className="inp mono">
        <input type={reveal ? "text" : "password"} defaultValue={value} readOnly />
        <span className="rev" onClick={onToggle}><AIcon name={reveal ? "eye-off" : "eye"} /></span>
      </div>
      {hint && <div className="help"><AIcon name="info" /> {hint}</div>}
    </div>
  );
}

function ConnectCard({ state, reveal, setReveal, children }) {
  const testing = state === "testing";
  const dimStyle = testing ? { opacity: .5, pointerEvents: "none" } : null;
  return (
    <section className="card">
      <header className="card-h">
        <span className="tile teal"><AIcon name="plug-zap" /></span>
        <div style={{ flex: 1 }}>
          <h2>🔌 Connect EasyParcel</h2>
          <p>Mỗi cửa hàng dùng tài khoản EasyParcel riêng. Cước trừ thẳng ví của bạn — không phụ phí.</p>
        </div>
        <span className="switch on" style={{ marginTop: 4 }} />
      </header>
      <div className="card-b">
        {/* Two keys — mirror F34 Xendit connect block. No env selector (auto-detect). */}
        <div className="row-2" style={dimStyle}>
          <SecretInput label="API Key" hint="Field: api" value="ek_live_8f2a••••••••" reveal={reveal === "api"} onToggle={() => setReveal(reveal === "api" ? null : "api")} />
          <SecretInput label="Auth Key" hint="Field: authentication" value="auth_3c9d••••••••" reveal={reveal === "auth"} onToggle={() => setReveal(reveal === "auth" ? null : "auth")} />
        </div>

        {/* Warehouse / origin — Prime source of truth; geo cascade State→City→Postcode */}
        <div className="field" style={dimStyle}>
          <label className="lbl"><span>Warehouse address</span> <span className="opt">· origin</span></label>
          <div className="inp"><input defaultValue="Lot 23, Jalan Industri 4/2, Taman Perindustrian" placeholder="Address line 1" /></div>
        </div>
        <div className="row-3" style={dimStyle}>
          <div className="field">
            <label className="lbl">State</label>
            <div className="sel">
              <select defaultValue="Selangor">{A_STATES.map((s) => <option key={s}>{s}</option>)}</select>
              <AIcon name="chevron-down" className="chev" />
            </div>
          </div>
          <div className="field">
            <label className="lbl">City / District</label>
            <div className="sel">
              <select defaultValue="Shah Alam"><option>Shah Alam</option><option>Petaling Jaya</option><option>Klang</option></select>
              <AIcon name="chevron-down" className="chev" />
            </div>
          </div>
          <div className="field">
            <label className="lbl">Postcode</label>
            <div className="sel">
              <select defaultValue="40300"><option>40300</option><option>40400</option><option>40450</option></select>
              <AIcon name="chevron-down" className="chev" />
            </div>
          </div>
        </div>
        <div className="help" style={dimStyle ? { opacity: .5 } : null}>
          <AIcon name="info" /> Kho dùng cho cả tính cước &amp; tạo vận đơn. Geo cascade <code>/api/geo/*</code>; postcode được kiểm tra khi Test connection.
        </div>

        {children}
      </div>
    </section>
  );
}

/* Single courier per shop — RadioGroup, default J&T, top-3 badged, rest collapsed.
   No price shown (real rate only at checkout). */
function CourierPicker() {
  const [sel, setSel] = useState("jnt");
  const Row = (c) => (
    <label key={c.id} className={`radio-card ${sel === c.id ? "on" : ""}`} onClick={() => setSel(c.id)}>
      <span className="radio-dot" />
      <A_Logo courier={c} size={28} />
      <div style={{ flex: 1 }}>
        <div className="rc-t">{c.name} {A_TOP3.includes(c.id) && <span className="badge blue">Phổ biến SME</span>}</div>
      </div>
    </label>
  );
  const rest = A_COURIERS.filter((c) => !A_TOP3.includes(c.id));
  return (
    <div className="field">
      <label className="lbl">Courier <span className="opt">· chọn 1 cho shop</span></label>
      <div className="radio-stack">{A_TOP3.map(A_byId).map(Row)}</div>
      <details style={{ marginTop: 8 }}>
        <summary className="help" style={{ cursor: "pointer", listStyle: "none" }}>
          <AIcon name="plus" /> Xem thêm courier ({rest.length})
        </summary>
        <div className="radio-stack" style={{ marginTop: 8 }}>{rest.map(Row)}</div>
      </details>
      <div className="help"><AIcon name="info" /> Không hiển thị giá ở đây — giá thật tính ở checkout. Vận đơn tạo thủ công trên từng đơn.</div>
    </div>
  );
}

function SettingsScreen({ state = "disconnected", mobile = false }) {
  const [reveal, setReveal] = useState(null);
  const connected = state === "connected" || state === "saving";
  const testing = state === "testing";
  const invalid = state === "invalid";
  const saving = state === "saving";

  return (
    <div className={`f36 f36-dash ${mobile ? "m375" : ""}`} data-theme="dark">
      <A_Dash crumbs={["Settings", "Shipping", "EasyParcel"]} active="shipping">
        <div className="dash-page">
          <div className="page-h">
            <h1>Shipping</h1>
            <p>Connect EasyParcel to quote live courier rates at checkout. Charges are deducted straight from your EasyParcel wallet — no platform markup.</p>
          </div>

          <SettingsTabs />

          <ConnectCard state={state} reveal={reveal} setReveal={setReveal}>
            {/* Test connection / states */}
            {testing ? (
              <button className="btn btn-outline" style={{ alignSelf: "flex-start" }} disabled>
                <span className="spin" /> Đang kiểm tra…
              </button>
            ) : (
              <button className="btn btn-outline" style={{ alignSelf: "flex-start" }}>
                <AIcon name="search-check" /> Test connection
              </button>
            )}

            {invalid && (
              <A_Alert kind="error" icon="shield-alert" title="EASYPARCEL_INVALID_KEY">
                Khóa API hoặc Auth không hợp lệ (hoặc warehouse postcode sai → <code>EASYPARCEL_INVALID_WAREHOUSE</code>). Cấu hình chưa được lưu.
              </A_Alert>
            )}

            {connected && (
              <>
                <A_Alert kind="success" icon="check-circle-2" title="Connected — Production (tự nhận)">
                  Tài khoản đã xác thực; môi trường tự nhận diện ở bước Test (production trước, fallback demo).
                </A_Alert>

                <CourierPicker />
              </>
            )}
          </ConnectCard>

          {/* Footer actions — shared with Flat Rate tab (dirty state at client level) */}
          {(connected || invalid) && (
            <div className="card-foot" style={{ borderRadius: 12, border: "1px solid var(--border-1)", marginTop: 18, background: "var(--bg-surface-2)" }}>
              <button className="btn btn-ghost">Cancel</button>
              <button className={`btn btn-primary ${saving ? "disabled" : ""}`} disabled={saving}>
                {saving ? <><span className="spin dark" /> Đang lưu…</> : <><AIcon name="save" /> Save</>}
              </button>
            </div>
          )}
        </div>
      </A_Dash>

      {/* Saved toast */}
      {saving && (
        <div style={{ position: "absolute", bottom: 22, right: 22, zIndex: 30 }}>
          <div className="alert success" style={{ boxShadow: "var(--shadow-popover)" }}>
            <AIcon name="check-circle-2" className="lead" /><div className="a-body">Đã lưu cấu hình EasyParcel.</div>
          </div>
        </div>
      )}
    </div>
  );
}

window.SettingsScreen = SettingsScreen;
