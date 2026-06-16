/* F36 · Screen A — EasyParcel Settings  (dashboard, dark)
   Settings › Shipping › tab "EasyParcel"  (sits beside "Flat Rate")
   state: disconnected | testing | invalid | connected | saving
   Connected reveals couriers, default parcel, fulfilment mode, wallet warning. */

const { Icon: AIcon, fmtRM: AfmtRM, MY_STATES: A_STATES, COURIERS: A_COURIERS,
        CourierLogo: A_Logo, DashShell: A_Dash, Switch: A_Switch, Alert: A_Alert } = window;

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

function ConnectCard({ state, env, setEnv, reveal, setReveal, children }) {
  const testing = state === "testing";
  const disabled = testing ? "disabled" : "";
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
        {/* Environment */}
        <div className="field">
          <label className="lbl">Environment</label>
          <div className={`radio-seg ${disabled}`} style={testing ? { opacity: .5, pointerEvents: "none" } : null}>
            <button className={env === "demo" ? "on" : ""} onClick={() => setEnv("demo")}>Demo</button>
            <button className={env === "prod" ? "on" : ""} onClick={() => setEnv("prod")}>Production</button>
          </div>
        </div>

        <div className={`row-2 ${disabled}`} style={testing ? { opacity: .5, pointerEvents: "none" } : null}>
          <SecretInput label="API Key" hint="Field: api" value="ek_live_8f2a••••••••" reveal={reveal === "api"} onToggle={() => setReveal(reveal === "api" ? null : "api")} />
          <SecretInput label="Auth Key" hint="Field: authentication" value="auth_3c9d••••••••" reveal={reveal === "auth"} onToggle={() => setReveal(reveal === "auth" ? null : "auth")} />
        </div>

        {/* Warehouse / origin */}
        <div className="field" style={testing ? { opacity: .5, pointerEvents: "none" } : null}>
          <label className="lbl"><span>Warehouse address</span> <span className="opt">· origin</span></label>
          <div className="inp"><input defaultValue="Lot 23, Jalan Industri 4/2, Taman Perindustrian" placeholder="Address line 1" /></div>
        </div>
        <div className="row-3" style={testing ? { opacity: .5, pointerEvents: "none" } : null}>
          <div className="field">
            <label className="lbl">City</label>
            <div className="inp"><input defaultValue="Shah Alam" /></div>
          </div>
          <div className="field">
            <label className="lbl">Postcode</label>
            <div className="inp"><input inputMode="numeric" maxLength={5} defaultValue="40300" placeholder="5 digits" /></div>
          </div>
          <div className="field">
            <label className="lbl">State</label>
            <div className="sel">
              <select defaultValue="Selangor">{A_STATES.map((s) => <option key={s}>{s}</option>)}</select>
              <AIcon name="chevron-down" className="chev" />
            </div>
          </div>
        </div>

        {children}
      </div>
    </section>
  );
}

function CourierPicker() {
  const picked = new Set(["poslaju", "jnt", "ninja", "flash"]);
  return (
    <div className="field">
      <label className="lbl">Couriers offered at checkout</label>
      <div className="chk-list">
        {A_COURIERS.map((c) => (
          <div key={c.id} className={`chk-row ${picked.has(c.id) ? "on" : ""}`}>
            <span className="chk-box"><AIcon name="check" /></span>
            <A_Logo courier={c} size={30} />
            <span className="c-name">{c.name}</span>
            <span className="c-from">from {AfmtRM(c.from)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsScreen({ state = "disconnected", mobile = false }) {
  const [env, setEnv] = useState("prod");
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

          <ConnectCard state={state} env={env} setEnv={setEnv} reveal={reveal} setReveal={setReveal}>
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
                Khóa API hoặc Auth không hợp lệ. Kiểm tra lại trên EasyParcel dashboard. Cấu hình chưa được lưu.
              </A_Alert>
            )}

            {connected && (
              <>
                <A_Alert kind="success" icon="check-circle-2" title="Connected — 6 couriers khả dụng">
                  Tài khoản đã xác thực ở môi trường Production.
                </A_Alert>

                <CourierPicker />

                {/* Default parcel */}
                <div className="field">
                  <label className="lbl">Default parcel <span className="opt">· fallback khi sản phẩm thiếu số đo</span></label>
                  <div className="row-2">
                    <div className="inp"><span className="pre">Weight</span><input defaultValue="500" /><span className="suf">g</span></div>
                    <div className="row-3" style={{ gap: 10 }}>
                      <div className="inp"><input defaultValue="20" /><span className="suf">L cm</span></div>
                      <div className="inp"><input defaultValue="15" /><span className="suf">W cm</span></div>
                      <div className="inp"><input defaultValue="8" /><span className="suf">H cm</span></div>
                    </div>
                  </div>
                </div>

                {/* Fulfilment mode */}
                <div className="field">
                  <label className="lbl">Tạo vận đơn</label>
                  <div className="radio-stack">
                    <label className="radio-card on">
                      <span className="radio-dot" />
                      <div><div className="rc-t">Manual <span className="badge gray">Mặc định</span></div>
                        <div className="rc-d">Bạn bấm “Tạo vận đơn” trên từng đơn khi sẵn sàng gửi.</div></div>
                    </label>
                    <label className="radio-card">
                      <span className="radio-dot" />
                      <div><div className="rc-t">Auto</div>
                        <div className="rc-d">Tự tạo vận đơn ngay khi đơn đã thanh toán thành công.</div></div>
                    </label>
                  </div>
                </div>

                {/* Wallet warning */}
                <A_Alert kind="warning" icon="wallet" link={{ label: "Nạp ví", icon: "external-link" }}>
                  <b>Số dư ví: {AfmtRM(4800)}</b> — đủ cho khoảng 8 đơn. Nạp thêm để tránh gián đoạn.
                </A_Alert>
              </>
            )}
          </ConnectCard>

          {/* Footer actions */}
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
