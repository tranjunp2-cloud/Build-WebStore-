/* F32 — List view (1) Browse all email templates
   - Top bar: Title + "+ Add custom" button
   - Tabs: Buyer Emails (8) · Seller Emails (4)
   - Rows: icon, name + description, status toggle, "Edited Xd ago", edit btn */

const ListView = ({ templates, audienceTab, setAudienceTab, onOpen, onToggle, search, setSearch }) => {
  const filtered = useMemo(() => {
    let rows = templates.filter(t => t.audience === audienceTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [templates, audienceTab, search]);

  const buyerCount = templates.filter(t => t.audience === "buyer").length;
  const sellerCount = templates.filter(t => t.audience === "seller").length;
  const customizedCount = templates.filter(t => t.customized).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="ph-title" style={{ margin: 0 }}>Email Templates</h1>
          <p className="ph-sub">
            Customize the transactional emails your store sends to buyers and to yourself.
            Edits are scoped to this tenant — defaults stay safe and revertable.
          </p>
        </div>
      </div>

      {/* Audience tabs */}
      <div className="tabs" role="tablist" aria-label="Audience">
        <button
          role="tab"
          aria-selected={audienceTab === "buyer"}
          className={`tab ${audienceTab === "buyer" ? "active" : ""}`}
          onClick={() => setAudienceTab("buyer")}
        >
          <i data-lucide="user" />
          Buyer Emails
          <span className="tab-count tabular">{buyerCount}</span>
        </button>
        <button
          role="tab"
          aria-selected={audienceTab === "seller"}
          className={`tab ${audienceTab === "seller" ? "active" : ""}`}
          onClick={() => setAudienceTab("seller")}
        >
          <i data-lucide="store" />
          Seller Emails
          <span className="tab-count tabular">{sellerCount}</span>
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, paddingBottom: 8 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            <strong style={{ color: "var(--ink-1)" }}>{customizedCount}</strong> of {templates.length} customized
          </span>
        </div>
      </div>

      {/* Toolbar removed */}

      <div className="card">
        <div className="tpl-section-head">
          <i data-lucide={audienceTab === "buyer" ? "user" : "store"} style={{ width: 14, height: 14 }} />
          <span>{audienceTab === "buyer" ? "Buyer-facing emails" : "Seller-facing emails"}</span>
          <span className="count tabular">{filtered.length}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-illus" style={{ background: "var(--surface-3)", border: "1px solid var(--line-1)", color: "var(--ink-3)" }}>
              <i data-lucide="search-x" />
            </div>
            <h4>No templates match your search</h4>
            <p>Try a different keyword, or switch tabs to see {audienceTab === "buyer" ? "seller" : "buyer"} emails.</p>
          </div>
        ) : (
          <div className="tpl-list">
            {filtered.map(t => (
              <TemplateRow
                key={t.id}
                tpl={t}
                onOpen={() => onOpen(t.id)}
                onToggle={() => onToggle(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer tip */}
      <div style={{
        marginTop: 16, padding: "12px 14px",
        background: "var(--surface)",
        border: "1px solid var(--line-1)",
        borderRadius: "var(--radius-md)",
        display: "flex", alignItems: "flex-start", gap: 10,
        fontSize: 12, color: "var(--ink-3)", lineHeight: 1.55,
      }}>
        <i data-lucide="info" style={{ width: 14, height: 14, color: "var(--brand)", flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ color: "var(--ink-1)" }}>Tenant-scoped overrides.</strong>{" "}
          Disabling a template stops it from sending in your store only — global defaults keep serving other tenants.
          Reset any template to default at any time from the edit view.
        </div>
      </div>
    </>
  );
};

const TemplateRow = ({ tpl, onOpen, onToggle }) => (
  <div
    className={`tpl-row ${!tpl.enabled ? "disabled" : ""}`}
    onClick={onOpen}
  >
    <div className="tpl-icon">
      <i data-lucide={tpl.icon} />
    </div>
    <div className="tpl-body">
      <div className="tpl-name">
        {tpl.name}
        {tpl.customized && <span className="tpl-customized">Customized</span>}
      </div>
      <div className="tpl-desc">{tpl.description}</div>
    </div>
    <div className="toggle-cell">
      <Toggle on={tpl.enabled} onClick={onToggle} />
      <span className="toggle-label" style={{ color: tpl.enabled ? "#059669" : "var(--ink-4)" }}>
        {tpl.enabled ? "Enabled" : "Disabled"}
      </span>
    </div>
    <div className="tpl-meta">
      {tpl.customized ? `Edited ${relTime(tpl.updatedAt)}` : "Default"}
    </div>
    <button className="tpl-edit-btn" title="Edit template" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
      <i data-lucide="pencil" />
    </button>
  </div>
);

Object.assign(window, { ListView });
