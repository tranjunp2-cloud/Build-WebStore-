/* F32 — Edit view (2) Edit 1 template with realtime preview
   Split 40/60: form on left, live email mockup on right. */

const LIMITS = { subject: 200, greeting: 500, cta: 100, closing: 2000 };

const EditView = ({ template, onBack, onSave, onReset, onToast }) => {
  const [locale, setLocale] = useState("en");
  const [previewMode, setPreviewMode] = useState("desktop"); // desktop | mobile
  const [enabled, setEnabled] = useState(template.enabled);
  const [draft, setDraft] = useState(() => ({
    en: { ...template.locales.en },
    ms: { ...template.locales.ms },
  }));

  const cur = draft[locale];
  const setCur = (patch) => setDraft(d => ({ ...d, [locale]: { ...d[locale], ...patch } }));

  const dirty = useMemo(() =>
    enabled !== template.enabled ||
    JSON.stringify(draft) !== JSON.stringify(template.locales),
  [enabled, draft, template]);

  const handleInsertVar = (field, varName) => {
    setCur({ [field]: (cur[field] || "") + `{${varName}}` });
  };

  const save = () => {
    onSave({ ...template, enabled, locales: draft, customized: true, updatedAt: new Date().toISOString() });
    onToast({ kind: "success", title: "Template saved", msg: `"${template.name}" — changes applied to the ${locale.toUpperCase()} locale.` });
  };

  const reset = () => {
    onReset(template.id);
    onToast({ kind: "info", title: "Reset to default", msg: `"${template.name}" reverted to the PrimeWeb default copy.` });
  };

  return (
    <>
      {/* Header */}
      <div className="f32-detail-h">
        <button className="icon-btn" onClick={onBack} title="Back to list">
          <i data-lucide="arrow-left" />
        </button>
        <div className="tpl-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
          <i data-lucide={template.icon} style={{ width: 22, height: 22 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="ttl">
            {template.name}
            {template.customized && (
              <span className="tpl-customized" style={{ fontSize: 10 }}>Customized</span>
            )}
          </h2>
          <div className="meta">
            <span>{template.audience === "buyer" ? "Buyer-facing" : "Seller-facing"}</span>
            <span className="dot" />
            <span>Last edited {relTime(template.updatedAt)}</span>
            <span className="dot" />
            <code className="kbd-key">tpl_{template.id}</code>
          </div>
        </div>
        <button className="btn btn-secondary"><i data-lucide="send" />Send test</button>
        <button className="btn btn-secondary"><i data-lucide="eye" />Open in new tab</button>
      </div>

      {/* Dirty bar */}
      {dirty && (
        <div className="dirty-bar">
          <span><i data-lucide="circle-alert" style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 6 }} />Unsaved changes on this template.</span>
          <div className="dirty-actions">
            <button className="btn btn-ghost" onClick={() => { setEnabled(template.enabled); setDraft({ en: {...template.locales.en}, ms: {...template.locales.ms} }); }}>
              <i data-lucide="undo-2" />Revert
            </button>
            <button className="btn btn-primary" onClick={save}>
              <i data-lucide="check" />Save changes
            </button>
          </div>
        </div>
      )}

      {/* Split layout */}
      <div className="edit-split">
        {/* LEFT — Form */}
        <div className="card edit-form">
          {/* Template select pill */}
          <div className="edit-template-pill">
            <div className="tpl-icon">
              <i data-lucide={template.icon} />
            </div>
            <div className="meta">
              <div className="name">{template.name}</div>
              <div className="audience">
                {template.audience === "buyer" ? "Sent to buyers" : "Sent to seller (you)"} · {template.id}
              </div>
            </div>
            <button className="icon-btn" title="Pick another template">
              <i data-lucide="chevrons-up-down" />
            </button>
          </div>

          {/* Status row */}
          <div className="status-row" style={{ marginTop: 12 }}>
            <div>
              <div className="lbl">Sending status</div>
              <div className="sub">
                {enabled
                  ? "Live — this email is sent in production."
                  : "Paused — no buyers will receive this email."}
              </div>
            </div>
            <div className="toggle-cell">
              <Toggle on={enabled} onClick={() => setEnabled(e => !e)} stopPropagation={false} />
              <span className="toggle-label" style={{ color: enabled ? "#059669" : "var(--ink-4)" }}>
                {enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          <div className="edit-divider" style={{ margin: "18px 0" }} />

          {/* Locale tabs */}
          <div className="form-block" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <label className="field-label" style={{ marginBottom: 4 }}>Content locale</label>
              <div className="field-help">Each locale stores its own copy. Visitors get the closest match.</div>
            </div>
            <div className="locale-tabs">
              <div
                className={`locale-tab ${locale === "en" ? "active" : ""}`}
                onClick={() => setLocale("en")}
              >
                <span className="flag flag-en" />EN
              </div>
              <div
                className={`locale-tab ${locale === "ms" ? "active" : ""}`}
                onClick={() => setLocale("ms")}
              >
                <span className="flag flag-ms" />MS
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="form-block">
            <FieldRow
              label="Subject"
              required
              hint="Shown in the inbox preview. Keep it under 60 chars for mobile."
              value={cur.subject || ""}
              limit={LIMITS.subject}
              variables={template.variables}
              onChange={(v) => setCur({ subject: v })}
              onInsertVar={(v) => handleInsertVar("subject", v)}
            />
          </div>

          {/* Greeting */}
          <div className="form-block">
            <FieldRow
              label="Greeting"
              required
              textarea
              rows={2}
              value={cur.greeting || ""}
              limit={LIMITS.greeting}
              variables={template.variables.filter(v => /name/i.test(v))}
              onChange={(v) => setCur({ greeting: v })}
              onInsertVar={(v) => handleInsertVar("greeting", v)}
            />
          </div>

          {/* CTA Label */}
          <div className="form-block">
            <FieldRow
              label="CTA Label"
              hint="Button text. Use a strong verb — “Track Order”, “Confirm”, “Open Inbox”."
              value={cur.cta || ""}
              limit={LIMITS.cta}
              variables={[]}
              onChange={(v) => setCur({ cta: v })}
            />
          </div>

          {/* Closing */}
          <div className="form-block">
            <FieldRow
              label="Closing"
              textarea
              rows={3}
              value={cur.closing || ""}
              limit={LIMITS.closing}
              variables={template.variables.filter(v => /brand|support|seller/i.test(v))}
              onChange={(v) => setCur({ closing: v })}
              onInsertVar={(v) => handleInsertVar("closing", v)}
            />
          </div>

          {/* Save row */}
          <div className="edit-save-row">
            <div className="save-meta">
              {dirty ? "Unsaved changes" : "All changes saved"}
            </div>
            <button
              className="btn btn-primary btn-full"
              style={{ flex: 1, maxWidth: 220 }}
              onClick={save}
              disabled={!dirty}
            >
              <i data-lucide="check" />Save Changes
            </button>
          </div>
        </div>

        {/* RIGHT — Preview */}
        <div className="card preview-pane">
          <div className="preview-head">
            <div className="lbl">
              <span className="dot" />
              Live Preview
            </div>
            <div className="actions">
              <button
                className={previewMode === "desktop" ? "active" : ""}
                title="Desktop"
                onClick={() => setPreviewMode("desktop")}
              ><i data-lucide="monitor" /></button>
              <button
                className={previewMode === "mobile" ? "active" : ""}
                title="Mobile"
                onClick={() => setPreviewMode("mobile")}
              ><i data-lucide="smartphone" /></button>
              <button title="Refresh"><i data-lucide="refresh-cw" /></button>
            </div>
          </div>

          <div className={`preview-canvas ${previewMode === "mobile" ? "mobile-view" : ""}`}>
            <EmailPreview template={template} content={cur} locale={locale} />
          </div>

          <div className="demo-data-card">
            <div className="head">
              <i data-lucide="flask-conical" />
              Demo data used in preview
            </div>
            <div className="demo-data-grid">
              <span className="k">Order #</span>      <span className="v">DEMO-001</span>
              <span className="k">Customer</span>     <span className="v">John Doe</span>
              <span className="k">Total</span>        <span className="v">MYR 299.00</span>
              <span className="k">Brand</span>        <span className="v">Aurora Batik</span>
              <span className="k">Support email</span><span className="v">help@aurora-batik.my</span>
            </div>
          </div>

          <div className="preview-foot">
            <span>Rendered with sample data · won't be sent to real customers</span>
            <a className="reset-link" onClick={(e) => { e.preventDefault(); reset(); }} href="#">
              <i data-lucide="rotate-ccw" />
              Reset to default
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

/* ── Field row with character counter + variable chips ── */
const FieldRow = ({ label, required, hint, textarea, rows = 2, value, limit, variables = [], onChange, onInsertVar }) => {
  const len = (value || "").length;
  const cls = len > limit ? "over" : len > limit * 0.9 ? "warn" : "";
  return (
    <>
      <div className="field-w-counter">
        <label className="field-label">
          {label}{required && <span className="req">*</span>}
        </label>
        <span className={`char-counter ${cls}`}>{len}/{limit}</span>
      </div>
      {textarea ? (
        <textarea
          className="textarea"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ marginTop: 6 }}
        />
      ) : (
        <input
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ marginTop: 6 }}
        />
      )}
      {hint && <span className="field-help" style={{ marginTop: 6 }}>{hint}</span>}
      {variables.length > 0 && (
        <div className="var-chips">
          {variables.map(v => (
            <span key={v} className="var-chip" onClick={() => onInsertVar && onInsertVar(v)} title={`Insert {${v}}`}>
              <i data-lucide="plus" />
              {`{${v}}`}
            </span>
          ))}
        </div>
      )}
    </>
  );
};

/* ── The actual email mockup, parameterized by template + content ── */
const EmailPreview = ({ template, content, locale }) => {
  const sub = (s) => (s || "").replace(/\{customerName\}/g, "John Doe")
    .replace(/\{orderNumber\}/g, "DEMO-001")
    .replace(/\{brandName\}/g, "Aurora Batik")
    .replace(/\{supportEmail\}/g, "help@aurora-batik.my")
    .replace(/\{sellerName\}/g, "Siti Yusoff")
    .replace(/\{orderTotal\}/g, "MYR 299.00")
    .replace(/\{orderCount\}/g, "12")
    .replace(/\{totalRevenue\}/g, "MYR 4,180.00")
    .replace(/\{submittedAt\}/g, "Mon, 18 May, 14:22")
    .replace(/\{reviewLink\}/g, "https://aurora-batik.my/r/x4n")
    .replace(/\{resetLink\}/g, "https://aurora-batik.my/reset/x4n")
    .replace(/\{confirmLink\}/g, "https://aurora-batik.my/c/x4n")
    .replace(/\{discountCode\}/g, "WELCOME10")
    .replace(/\{failureReason\}/g, "Card declined")
    .replace(/\{retryLink\}/g, "https://aurora-batik.my/retry/x4n")
    .replace(/\{expiresIn\}/g, "30 minutes")
    .replace(/\{newSubscribers\}/g, "47")
    .replace(/\{openRate\}/g, "34%");

  return (
    <div className="email-shell">
      <div className="email-header">
        <div className="brand-mark">
          <span className="dot"><i data-lucide="store" style={{ width: 12, height: 12 }} /></span>
          Aurora Batik
        </div>
        <h2>{sub(content.subject) || (locale === "ms" ? "(Tiada subjek)" : "(Untitled subject)")}</h2>
        <div className="sub">
          {template.audience === "buyer" ? "Order receipt · sent automatically" : "Internal notification"}
        </div>
      </div>

      <div className="email-body">
        <p className="greeting" style={{ whiteSpace: "pre-line" }}>{sub(content.greeting) || "Hi there,"}</p>

        {/* Body — varies a bit by template type but keeps a generic shape */}
        {template.id === "order_confirmation" || template.id === "new_order_seller" ? (
          <>
            <p>
              {template.audience === "buyer"
                ? "Thanks for your order. Here's a summary of what's on its way."
                : "A new order just landed. Confirm it before 6 PM to ship today."}
            </p>
            <table className="email-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ width: 40 }}>Qty</th>
                  <th className="right" style={{ width: 100 }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Demo Product A <div className="var">Variant: Default</div></td>
                  <td>2</td>
                  <td className="right">MYR 199.00</td>
                </tr>
                <tr>
                  <td>Demo Product B <div className="var">Variant: Large</div></td>
                  <td>1</td>
                  <td className="right">MYR 100.00</td>
                </tr>
              </tbody>
              <tfoot>
                <tr><td>Shipping</td><td></td><td className="right">Free</td></tr>
                <tr className="total"><td>Total</td><td></td><td className="right">MYR 299.00</td></tr>
              </tfoot>
            </table>
          </>
        ) : template.id === "order_delivered" ? (
          <p>Your order arrived at <strong>12, Jalan Kerinchi 3, Kuala Lumpur</strong> on 19 May. We'd love to hear what you think.</p>
        ) : template.id === "password_reset" ? (
          <p>Tap the button below to set a new password. The link expires in <strong>30 minutes</strong>.</p>
        ) : template.id === "welcome" ? (
          <p>Welcome aboard. Use code <code className="kbd-key" style={{ fontSize: 12, padding: "2px 8px" }}>WELCOME10</code> for 10% off your first order.</p>
        ) : template.id === "order_failed" ? (
          <p style={{ color: "#b91c1c" }}>We couldn't process your payment for order <strong>#DEMO-001</strong>. Reason: <em>Card declined</em>.</p>
        ) : template.id === "order_cancelled" ? (
          <p>Your order <strong>#DEMO-001</strong> has been cancelled. Any payment captured will be refunded within 3–5 business days.</p>
        ) : template.id === "daily_sales_summary" ? (
          <p>Yesterday at Aurora Batik: <strong>12 orders</strong>, <strong>MYR 4,180.00</strong> revenue, 3 carts abandoned. View the full breakdown in your dashboard.</p>
        ) : (
          <p>This is where the body content of <strong>{template.name}</strong> will appear. The body is template-specific and is not edited from this screen.</p>
        )}

        {content.cta && (
          <a className="email-cta" href="#">{sub(content.cta)}</a>
        )}

        <p style={{ whiteSpace: "pre-line", color: "#475569", fontSize: 13, marginTop: 14, marginBottom: 0 }}>
          {sub(content.closing) || "—"}
        </p>
      </div>

      <div className="email-footer">
        Aurora Batik · 12 Jalan Kerinchi 3, Kuala Lumpur, Malaysia
        <div className="small">You're receiving this because you placed an order on aurora-batik.my</div>
      </div>
    </div>
  );
};

Object.assign(window, { EditView });
