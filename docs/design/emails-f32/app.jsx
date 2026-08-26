/* F32 Email Template Settings — main app
   Routes between List ↔ Edit ↔ Empty, owns toast + tweaks state. */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "screen": "list",
  "audienceTab": "buyer",
  "selectedTemplate": "order_confirmation"
}/*EDITMODE-END*/;

const App = () => {
  const [tweaks, setTweak] = window.useTweaks
    ? window.useTweaks(TWEAK_DEFAULTS)
    : [TWEAK_DEFAULTS, () => {}];

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme || "light");
  }, [tweaks.theme]);

  /* Local template state — apply tenant overrides on top of defaults */
  const [templates, setTemplates] = useState(TEMPLATES);

  /* When screen=empty, hide all customizations */
  const visibleTemplates = useMemo(() => {
    if (tweaks.screen === "empty") {
      return templates.map(t => ({ ...t, customized: false, enabled: t.id === "order_confirmation" }));
    }
    return templates;
  }, [templates, tweaks.screen]);

  const [search, setSearch] = useState("");
  const [audienceTab, setAudienceTab] = useState(tweaks.audienceTab || "buyer");
  useEffect(() => { if (tweaks.audienceTab) setAudienceTab(tweaks.audienceTab); }, [tweaks.audienceTab]);

  /* Toasts */
  const [toasts, setToasts] = useState([]);
  const pushToast = (t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, ...t }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), t.duration || 4200);
  };
  const dismissToast = (id) => setToasts(ts => ts.filter(x => x.id !== id));

  /* Re-render lucide icons */
  useEffect(() => { if (window.lucide) window.lucide.createIcons(); });

  /* Navigation */
  const openTemplate = (id) => {
    setTweak({ screen: "edit", selectedTemplate: id });
  };
  const goToList = () => setTweak({ screen: "list" });
  const goToEmpty = () => setTweak({ screen: "empty" });
  const goToBrowse = () => setTweak({ screen: "list" });

  /* Actions */
  const toggleTemplate = (id) => {
    setTemplates(ts => ts.map(t => t.id === id ? { ...t, enabled: !t.enabled, updatedAt: new Date().toISOString() } : t));
    const t = templates.find(t => t.id === id);
    pushToast({
      kind: "success",
      title: t.enabled ? "Template disabled" : "Template enabled",
      msg: `"${t.name}" will ${t.enabled ? "no longer be sent to buyers" : "now be sent automatically"}.`,
    });
  };
  const saveTemplate = (next) => {
    setTemplates(ts => ts.map(t => t.id === next.id ? next : t));
  };
  const resetTemplate = (id) => {
    const def = TEMPLATES.find(t => t.id === id);
    setTemplates(ts => ts.map(t => t.id === id ? { ...def, customized: false } : t));
  };

  const selected = templates.find(t => t.id === tweaks.selectedTemplate) || templates[0];

  const crumbs = (() => {
    if (tweaks.screen === "edit") return [
      { icon: "mail", label: "Emails" },
      { label: "Templates" },
      { label: selected.name },
    ];
    if (tweaks.screen === "empty") return [
      { icon: "mail", label: "Emails" },
      { label: "Templates" },
      { label: "Set up" },
    ];
    return [
      { icon: "mail", label: "Emails" },
      { label: "Templates" },
    ];
  })();

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar
          crumbs={crumbs}
          theme={tweaks.theme}
          onToggleTheme={() => setTweak({ theme: tweaks.theme === "dark" ? "light" : "dark" })}
        />

        <div className={`page ${tweaks.screen === "edit" ? "no-bottom-pad" : ""}`}>
          {tweaks.screen === "empty" ? (
            <EmptyState onBrowse={goToBrowse} />
          ) : tweaks.screen === "edit" ? (
            <EditView
              key={selected.id}
              template={selected}
              onBack={goToList}
              onSave={saveTemplate}
              onReset={resetTemplate}
              onToast={pushToast}
            />
          ) : (
            <ListView
              templates={visibleTemplates}
              audienceTab={audienceTab}
              setAudienceTab={(v) => { setAudienceTab(v); setTweak({ audienceTab: v }); }}
              onOpen={openTemplate}
              onToggle={toggleTemplate}
              search={search}
              setSearch={setSearch}
            />
          )}
        </div>
      </div>

      {/* Toast stack */}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.kind || "info"}`}>
            <div className="toast-icon">
              <i data-lucide={t.kind === "success" ? "check-circle" : t.kind === "error" ? "circle-alert" : "info"} />
            </div>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              <div className="toast-msg">{t.msg}</div>
            </div>
            <button className="toast-close" onClick={() => dismissToast(t.id)}>
              <i data-lucide="x" />
            </button>
          </div>
        ))}
      </div>

      {/* Tweaks */}
      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Screen">
            <window.TweakRadio
              label="View"
              value={tweaks.screen}
              onChange={(v) => setTweak({ screen: v })}
              options={[
                { value: "list", label: "List" },
                { value: "edit", label: "Edit" },
                { value: "empty", label: "Empty" },
              ]}
            />
          </window.TweakSection>

          <window.TweakSection label="List view">
            <window.TweakRadio
              label="Audience tab"
              value={audienceTab}
              onChange={(v) => { setAudienceTab(v); setTweak({ audienceTab: v }); }}
              options={[
                { value: "buyer", label: "Buyer" },
                { value: "seller", label: "Seller" },
              ]}
            />
          </window.TweakSection>

          <window.TweakSection label="Edit view">
            <window.TweakSelect
              label="Template"
              value={tweaks.selectedTemplate}
              onChange={(v) => setTweak({ selectedTemplate: v, screen: "edit" })}
              options={templates.map(t => ({ value: t.id, label: `${t.audience === "buyer" ? "👤" : "🛒"} ${t.name}` }))}
            />
          </window.TweakSection>

          <window.TweakSection label="Display">
            <window.TweakRadio
              label="Theme"
              value={tweaks.theme}
              onChange={(v) => setTweak({ theme: v })}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </window.TweakSection>

          <window.TweakSection label="Try interactions">
            <window.TweakButton label="Toast — saved" onClick={() => pushToast({ kind: "success", title: "Template saved", msg: "Order Confirmation updated for the EN locale." })} />
            <window.TweakButton label="Toast — reset" onClick={() => pushToast({ kind: "info", title: "Reset to default", msg: "Welcome reverted to the PrimeWeb default copy." })} />
            <window.TweakButton label="Toast — send test failed" onClick={() => pushToast({ kind: "error", title: "Test email failed", msg: "Sender domain aurora-batik.my isn't verified yet. Verify in Emails → Sender domains." })} />
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
