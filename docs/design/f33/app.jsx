/* F33 Discount Codes — Main app
   Routes S1 (list) · S2 (form) · S3 (checkout) · S4 (usage history),
   wires the tweaks panel, toast stack, and delete-confirm modal. */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "screen": "s1-list",
  "theme": "dark",
  "listState": "populated",
  "checkoutState": "applied",
  "gateway": "stripe"
}/*EDITMODE-END*/;

const App = () => {
  const [tweaks, setTweak] = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme || "light");
  }, [tweaks.theme]);

  const [discounts, setDiscounts] = useState(SEED_DISCOUNTS);
  const [usage] = useState(SEED_USAGE);
  const [selectedId, setSelectedId] = useState(null);

  /* list state */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [histSearch, setHistSearch] = useState("");

  /* S3 gateway is tweak-driven but also locally settable */
  const setGateway = (g) => setTweak({ gateway: g });

  /* toasts */
  const [toasts, setToasts] = useState([]);
  const pushToast = (t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, ...t }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.duration || 4200);
  };
  const dismissToast = (id) => setToasts((ts) => ts.filter((x) => x.id !== id));

  /* delete confirm */
  const [confirmDel, setConfirmDel] = useState(null);

  const screen = tweaks.screen;

  /* sync sidebar sub ↔ screen */
  const goSub = (sub) => setTweak({ screen: sub === "history" ? "s4-history" : "s1-list" });

  useEffect(() => { if (window.lucide) window.lucide.createIcons(); });

  const openDiscount = (id) => { setSelectedId(id); setTweak({ screen: "s2-edit" }); };
  const createDiscount = () => { setSelectedId(null); setTweak({ screen: "s2-create" }); };
  const goToList = () => { setSelectedId(null); setTweak({ screen: "s1-list" }); };

  const handleSave = (draft) => {
    if (screen === "s2-create") {
      const id = Math.max(...discounts.map((d) => d.id)) + 1;
      const now = new Date().toISOString();
      setDiscounts((ds) => [{ ...draft, id, usageCount: 0, createdAt: now,
        startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
        expiresAt: draft.expiresAt ? new Date(draft.expiresAt + "T23:59:59").toISOString() : null }, ...ds]);
      setSelectedId(id);
      setTweak({ screen: "s2-edit" });
      pushToast({ kind: "success", title: "Discount created", msg: `${draft.code} is now live for ${TENANT.name}.` });
    } else {
      setDiscounts((ds) => ds.map((d) => d.id === draft.id ? { ...d, ...draft,
        startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
        expiresAt: draft.expiresAt ? new Date(draft.expiresAt + "T23:59:59").toISOString() : null } : d));
      pushToast({ kind: "success", title: "Changes saved", msg: `${draft.code} updated.` });
    }
  };

  const doDelete = (d) => {
    setDiscounts((ds) => ds.filter((x) => x.id !== d.id));
    setConfirmDel(null);
    if (selectedId === d.id) goToList();
    pushToast({ kind: "info", title: "Discount deleted", msg: `${d.code} removed — its usage history is preserved for audit.` });
  };

  const handleExport = () => {
    const variant = tweaks.exportResult || "success";
    if (variant === "too-large") {
      pushToast({ kind: "error", title: "Export limited to 10,000 rows", msg: "Please apply a date filter first, then export again." });
    } else {
      const date = new Date().toISOString().slice(0, 10);
      pushToast({ kind: "success", title: "Export started", msg: `discounts-${TENANT.slug}-${date}.csv will download shortly.` });
    }
  };

  const selected = discounts.find((d) => d.id === selectedId);

  const crumbs = (() => {
    if (screen === "s4-history") return [{ icon: "ticket", label: "Discounts" }, { label: "Usage history" }];
    if (screen === "s3-checkout") return [{ icon: "store", label: TENANT.name }, { label: "Checkout" }];
    if (screen === "s2-create") return [{ icon: "ticket", label: "Discounts" }, { label: "Create" }];
    if (screen === "s2-edit") return [{ icon: "ticket", label: "Discounts" }, { label: selected?.code || "Edit" }];
    return [{ icon: "ticket", label: "Discounts" }, { label: "Discount codes" }];
  })();

  const activeSub = screen === "s4-history" ? "history" : "codes";

  /* S3 renders standalone (storefront) — no admin chrome */
  if (screen === "s3-checkout") {
    return (
      <div className="app s3-app">
        <CheckoutDiscount initialState={tweaks.checkoutState} gateway={tweaks.gateway} setGateway={setGateway} />
        <TweaksUI tweaks={tweaks} setTweak={setTweak} handleExport={handleExport} />
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar counts={{ discounts: discounts.length, usage: 312 }} activeSub={activeSub} onSub={goSub} />
      <div className="main">
        <Topbar crumbs={crumbs} theme={tweaks.theme} onToggleTheme={() => setTweak({ theme: tweaks.theme === "dark" ? "light" : "dark" })} />
        <div className="page">
          {screen === "s4-history" ? (
            <UsageHistory usage={tweaks.listState === "empty-first-time" ? [] : usage}
              viewState={tweaks.listState === "empty-first-time" ? "empty" : "populated"}
              search={histSearch} setSearch={setHistSearch} />
          ) : (screen === "s2-create" || screen === "s2-edit") ? (
            <FormView discount={screen === "s2-edit" ? selected : null}
              onBack={goToList} onSave={handleSave} onDelete={setConfirmDel} onToast={pushToast} />
          ) : (
            <ListView
              discounts={tweaks.listState === "empty-first-time" ? [] : discounts}
              viewState={tweaks.listState === "loading" ? "loading"
                : tweaks.listState === "empty-first-time" ? "empty-first-time"
                : tweaks.listState === "no-results" ? "populated" : "populated"}
              onOpen={openDiscount} onCreate={createDiscount} onExport={handleExport} onDelete={setConfirmDel}
              search={tweaks.listState === "no-results" ? "zzz-no-match" : search} setSearch={setSearch}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              typeFilter={typeFilter} setTypeFilter={setTypeFilter}
              sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir} />
          )}
        </div>
      </div>

      {/* Toast stack */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind || "info"}`}>
            <div className="toast-icon"><i data-lucide={t.kind === "success" ? "check-circle" : t.kind === "error" ? "circle-alert" : "info"} /></div>
            <div className="toast-body"><div className="toast-title">{t.title}</div><div className="toast-msg">{t.msg}</div></div>
            <button className="toast-close" onClick={() => dismissToast(t.id)}><i data-lucide="x" /></button>
          </div>
        ))}
      </div>

      {/* Delete confirm */}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon danger"><i data-lucide="trash-2" /></div>
            <h3>Delete discount '{confirmDel.code}'?</h3>
            <p>The code will stop working immediately and won't be redeemable at checkout. Its <strong>usage history is preserved</strong> for audit.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-primary danger" onClick={() => doDelete(confirmDel)}><i data-lucide="trash-2" />Delete discount</button>
            </div>
          </div>
        </div>
      )}

      <TweaksUI tweaks={tweaks} setTweak={setTweak} handleExport={handleExport} />
    </div>
  );
};

/* ── Tweaks panel ─────────────────────────────────────────────────── */
const TweaksUI = ({ tweaks, setTweak, handleExport }) => {
  if (!window.TweaksPanel) return null;
  const { TweaksPanel, TweakSection, TweakSelect, TweakRadio, TweakButton } = window;
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Screen">
        <TweakSelect label="View" value={tweaks.screen} onChange={(v) => setTweak({ screen: v })}
          options={[
            { value: "s1-list", label: "S1 · Discount list" },
            { value: "s2-create", label: "S2 · Create discount" },
            { value: "s2-edit", label: "S2 · Edit discount" },
            { value: "s3-checkout", label: "S3 · Checkout field" },
            { value: "s4-history", label: "S4 · Usage history" },
          ]} />
      </TweakSection>

      <TweakSection label="List / view state">
        <TweakSelect label="Variant" value={tweaks.listState} onChange={(v) => setTweak({ listState: v })}
          options={[
            { value: "populated", label: "Populated" },
            { value: "loading", label: "Loading skeleton" },
            { value: "empty-first-time", label: "Empty (first-time)" },
            { value: "no-results", label: "Search · no results" },
          ]} />
      </TweakSection>

      <TweakSection label="S3 · Checkout state">
        <TweakRadio label="State" value={tweaks.checkoutState} onChange={(v) => setTweak({ checkoutState: v })}
          options={[{ value: "empty", label: "Empty" }, { value: "applied", label: "Applied" }, { value: "invalid", label: "Rejected" }]} />
        <TweakSelect label="Gateway" value={tweaks.gateway} onChange={(v) => setTweak({ gateway: v })}
          options={[{ value: "cod", label: "Cash on Delivery" }, { value: "qr", label: "QR / Bank Transfer" }, { value: "stripe", label: "Card — Stripe" }]} />
      </TweakSection>

      <TweakSection label="Display">
        <TweakRadio label="Theme" value={tweaks.theme} onChange={(v) => setTweak({ theme: v })}
          options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      </TweakSection>

      <TweakSection label="Try CSV export">
        <TweakButton label="Export — success" onClick={() => { setTweak({ exportResult: "success" }); handleExport(); }} />
        <TweakButton label="Export — 10k row cap" onClick={() => { setTweak({ exportResult: "too-large" }); handleExport(); }} />
      </TweakSection>
    </TweaksPanel>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
