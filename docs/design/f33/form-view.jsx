/* F33 — S2 · Discount create/edit form (Payload admin) */

const blankDiscount = () => ({
  code: "", description: "", type: "percentage", value: "", status: "active",
  usageLimit: "", usageCount: 0, startsAt: "", expiresAt: "",
});

/* existing codes for the async-unique check (same tenant) */
const TAKEN_CODES = SEED_DISCOUNTS.map((d) => d.code);

const toDateInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const FormView = ({ discount, onBack, onSave, onDelete, onToast }) => {
  const isNew = !discount;
  const init = useMemo(() => discount
    ? { ...discount, value: String(discount.value), usageLimit: discount.usageLimit == null ? "" : String(discount.usageLimit),
        startsAt: toDateInput(discount.startsAt), expiresAt: toDateInput(discount.expiresAt) }
    : blankDiscount(), [discount]);

  const [draft, setDraft] = useState(init);
  const [errors, setErrors] = useState({});
  useEffect(() => { setDraft(init); setErrors({}); }, [init]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(init), [draft, init]);

  const validate = () => {
    const e = {};
    const code = draft.code.trim().toUpperCase();
    if (!code) e.code = "Code is required.";
    else if (TAKEN_CODES.includes(code) && (isNew || code !== discount.code)) e.code = "This code is already in use for your tenant.";
    if (draft.value === "" || draft.value == null) e.value = "Value is required.";
    else {
      const v = Number(draft.value);
      if (Number.isNaN(v)) e.value = "Enter a number.";
      else if (draft.type === "percentage" && (v < 0 || v > 100)) e.value = "Percentage must be between 0 and 100.";
      else if (draft.type === "fixed" && v < 0) e.value = "Fixed amount must be ≥ 0.";
    }
    if (draft.usageLimit !== "" && Number(draft.usageLimit) < 0) e.usageLimit = "Usage limit must be ≥ 0.";
    if (draft.startsAt && draft.expiresAt && new Date(draft.startsAt) >= new Date(draft.expiresAt))
      e.dates = "Start date must be before expiry date.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) { onToast({ kind: "error", title: "Cannot save", msg: "Please fix the highlighted fields before saving." }); return; }
    onSave({
      ...draft, code: draft.code.trim().toUpperCase(),
      value: Number(draft.value),
      usageLimit: draft.usageLimit === "" ? null : Number(draft.usageLimit),
    });
  };

  const senPreview = draft.type === "fixed" && draft.value !== "" && !Number.isNaN(Number(draft.value))
    ? fmtRM(Number(draft.value)) : null;

  const usageCount = discount?.usageCount ?? 0;
  const usageLimit = draft.usageLimit === "" ? null : Number(draft.usageLimit);

  return (
    <>
      <div className="detail-header">
        <div className="detail-h-left">
          <button className="icon-btn" onClick={onBack} title="Back to list"><i data-lucide="arrow-left" /></button>
          <div className="detail-title">
            <h2>
              {isNew ? "Create discount" : draft.code || "Discount"}
              {!isNew && <StatusBadge status={discount.status} />}
            </h2>
            <div className="meta">
              {isNew ? <span>New code · {TENANT.name}</span> : (
                <>
                  <span>ID <code className="kbd-key">disc_{String(discount.id).padStart(5, "0")}</code></span>
                  <span className="dot" />
                  <span>Created {fmtDate(discount.createdAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        {!isNew &&
          <div className="detail-actions">
            <button className="btn btn-secondary danger-on-hover" onClick={() => onDelete(discount)}><i data-lucide="trash-2" />Delete</button>
          </div>
        }
      </div>

      {dirty &&
        <div className="dirty-bar">
          <span><i data-lucide="circle-alert" style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 6 }} />You have unsaved changes.</span>
          <div className="dirty-actions">
            <button className="btn btn-ghost" onClick={() => { setDraft(init); setErrors({}); }}><i data-lucide="undo-2" />Revert</button>
            <button className="btn btn-primary" onClick={handleSave}><i data-lucide="check" />Save</button>
          </div>
        </div>
      }

      <div className="detail-layout">
        <div className="card" style={{ padding: 24 }}>
          <div className="form-grid">
            {/* Code */}
            <div className="form-row">
              <label className="field-label">Code <span className="req">*</span></label>
              <input className={`input input-mono code-input ${errors.code ? "error" : ""}`} value={draft.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="SUMMER50" autoComplete="off" maxLength={32} />
              {errors.code
                ? <span className="field-error"><i data-lucide="circle-alert" />{errors.code}</span>
                : <span className="field-help">Unique for this store · auto-trimmed &amp; UPPERCASE. Case-insensitive at checkout.</span>}
            </div>

            {/* Status */}
            <div className="form-row">
              <label className="field-label">Status</label>
              <div className="select-wrap">
                <select value={draft.status} onChange={(e) => set("status", e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <span className="field-help">Inactive codes are silently rejected at checkout.</span>
            </div>

            {/* Description */}
            <div className="form-row full">
              <label className="field-label">Description <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>(optional · ≤ 500)</span></label>
              <input className="input" value={draft.description} onChange={(e) => set("description", e.target.value.slice(0, 500))}
                placeholder="e.g. Summer campaign — sitewide" />
            </div>

            {/* Type */}
            <div className="form-row full">
              <label className="field-label">Type <span className="req">*</span></label>
              <div className="seg-radio">
                <button className={draft.type === "percentage" ? "on" : ""} onClick={() => set("type", "percentage")}>
                  <i data-lucide="percent" />Percentage
                </button>
                <button className={draft.type === "fixed" ? "on" : ""} onClick={() => set("type", "fixed")}>
                  <i data-lucide="banknote" />Fixed amount
                </button>
              </div>
            </div>

            {/* Value */}
            <div className="form-row full">
              <label className="field-label">Value <span className="req">*</span></label>
              <div className="value-input-row">
                <div className={`affix-input ${errors.value ? "error" : ""}`}>
                  {draft.type === "fixed" && <span className="affix pre">sen</span>}
                  <input className="input" type="number" value={draft.value} onChange={(e) => set("value", e.target.value)}
                    placeholder={draft.type === "percentage" ? "50" : "2500"} min="0" max={draft.type === "percentage" ? "100" : undefined} />
                  {draft.type === "percentage" && <span className="affix post">%</span>}
                </div>
                {draft.type === "fixed" && senPreview && <span className="value-preview">= {senPreview}</span>}
                {draft.type === "percentage" && <span className="value-preview muted">0–100</span>}
              </div>
              {errors.value
                ? <span className="field-error"><i data-lucide="circle-alert" />{errors.value}</span>
                : <span className="field-help">{draft.type === "percentage" ? "Percent off the subtotal." : "Stored in sen (smallest unit). 2500 sen = RM 25.00."}</span>}
            </div>

            {/* Usage limit */}
            <div className="form-row">
              <label className="field-label">Usage limit</label>
              <input className={`input ${errors.usageLimit ? "error" : ""}`} type="number" value={draft.usageLimit}
                onChange={(e) => set("usageLimit", e.target.value)} placeholder="Leave blank = unlimited" min="0" />
              {errors.usageLimit
                ? <span className="field-error"><i data-lucide="circle-alert" />{errors.usageLimit}</span>
                : <span className="field-help">Blank = unlimited redemptions.</span>}
            </div>

            {/* Used so far (read-only, edit only) */}
            <div className="form-row">
              <label className="field-label">
                Used so far
                <span className="field-info" data-tip="Read-only. Increments by one per order that redeems this code." tabIndex={0}><i data-lucide="info" /></span>
              </label>
              <input className="input input-mono" value={isNew ? "0" : String(usageCount)} readOnly />
            </div>

            {/* Dates */}
            <div className="form-row">
              <label className="field-label">Starts at</label>
              <input className={`input ${errors.dates ? "error" : ""}`} type="date" value={draft.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
              <span className="field-help">Normalized to start of day (Asia/Kuala_Lumpur).</span>
            </div>
            <div className="form-row">
              <label className="field-label">Expires at</label>
              <input className={`input ${errors.dates ? "error" : ""}`} type="date" value={draft.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
              {errors.dates
                ? <span className="field-error"><i data-lucide="circle-alert" />{errors.dates}</span>
                : <span className="field-help">End of day. Both blank = always available.</span>}
            </div>
          </div>
        </div>

        {/* Side rail */}
        <div className="side-rail">
          <div className="card rail-card">
            <h3 className="rail-title">Live preview</h3>
            <div className="preview-chip-row">
              <span className="code-chip lg">{draft.code || "CODE"}</span>
              <TypeBadge type={draft.type} />
            </div>
            <div className="preview-value">{draft.value !== "" && !Number.isNaN(Number(draft.value)) ? fmtValue(draft.type, Number(draft.value)) : "—"} <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>off subtotal</span></div>
            <div style={{ marginTop: 14 }}>
              <div className="rail-label">Usage</div>
              <UsageMeter count={isNew ? 0 : usageCount} limit={usageLimit} />
            </div>
            <div className="rail-meta-row" style={{ marginTop: 14 }}>
              <span className="k">Window</span>
              <span className="v">{draft.startsAt ? fmtDate(draft.startsAt) : "—"} → {draft.expiresAt ? fmtDate(draft.expiresAt) : "—"}</span>
            </div>
          </div>

          <div className="card rail-card" style={{ background: "var(--surface-2)" }}>
            <h3 className="rail-title" style={{ marginBottom: 8 }}>
              <i data-lucide="shield-check" style={{ width: 13, height: 13, verticalAlign: -2, marginRight: 4, color: "var(--brand)" }} />Tenant-scoped
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>
              This code is scoped to <strong style={{ color: "var(--ink-2)" }}>{TENANT.name}</strong>. The same code can exist for other stores without conflict. Discount applies to the subtotal only.
            </p>
          </div>
        </div>
      </div>

      <div className="save-bar">
        <span className="muted" style={{ fontSize: 12 }}>{dirty ? "Unsaved changes" : isNew ? "New discount" : "Up to date"}</span>
        <div className="row-flex">
          <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!dirty && !isNew}>
            <i data-lucide="check" />Save{isNew ? " discount" : ""}
          </button>
        </div>
      </div>
    </>
  );
};

Object.assign(window, { FormView });
