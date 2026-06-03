/* F33 — S1 · Discount list + CSV export (Payload admin) */

const FilterChip = ({ icon, label, value, options, onChange, allLabel }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const active = value && value !== "all";
  const current = active ? options.find((o) => o.id === value)?.label : allLabel;
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className={`filter-chip ${active ? "active" : ""}`} onClick={() => setOpen((o) => !o)}>
        <i data-lucide={icon} />
        {label}: {current}
        {active && <span className="badge-count">1</span>}
        <i data-lucide="chevron-down" />
      </button>
      {open &&
        <div className="filter-menu-pop">
          <button className={`fmenu-item ${!active ? "selected" : ""}`} onClick={() => { onChange("all"); setOpen(false); }}>
            <span>{allLabel}</span>{!active && <i data-lucide="check" />}
          </button>
          {options.map((o) => (
            <button key={o.id} className={`fmenu-item ${value === o.id ? "selected" : ""}`} onClick={() => { onChange(o.id); setOpen(false); }}>
              <span>{o.label}</span>{value === o.id && <i data-lucide="check" />}
            </button>
          ))}
        </div>
      }
    </div>
  );
};

const ListView = ({ discounts, viewState, onOpen, onCreate, onExport, onDelete,
  search, setSearch, statusFilter, setStatusFilter, typeFilter, setTypeFilter,
  sortBy, setSortBy, sortDir, setSortDir }) => {

  const filtered = useMemo(() => {
    let rows = discounts;
    if (statusFilter !== "all") rows = rows.filter((d) => d.status === statusFilter);
    if (typeFilter !== "all") rows = rows.filter((d) => d.type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((d) => d.code.toLowerCase().includes(q) || (d.description || "").toLowerCase().includes(q));
    }
    const dir = sortDir === "desc" ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      let A = a[sortBy], B = b[sortBy];
      if (sortBy === "usage") { A = a.usageLimit ? a.usageCount / a.usageLimit : a.usageCount / 1e9; B = b.usageLimit ? b.usageCount / b.usageLimit : b.usageCount / 1e9; }
      if (sortBy === "expiresAt") { A = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity; B = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity; }
      A = A ?? ""; B = B ?? "";
      if (typeof A === "number") return (A - B) * dir;
      return String(A).localeCompare(String(B)) * dir;
    });
    return rows;
  }, [discounts, search, statusFilter, typeFilter, sortBy, sortDir]);

  const SortableTh = ({ id, children, align }) => (
    <th className={sortBy === id ? "sorted" : ""} style={{ textAlign: align || "left" }}
      onClick={() => { if (sortBy === id) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortBy(id); setSortDir("asc"); } }}>
      {children}
      <span className="sort"><i data-lucide="chevron-up" /><i data-lucide="chevron-down" /></span>
    </th>
  );

  let body;
  if (viewState === "loading") {
    body = <LoadingSkeleton />;
  } else if (viewState === "empty-first-time") {
    body = <FirstTimeEmpty onCreate={onCreate} />;
  } else if (filtered.length === 0) {
    body = <NoResultsEmpty onClear={() => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); }} />;
  } else {
    body = (
      <>
        <div className="t-wrap">
          <table className="ctable dtable">
            <thead>
              <tr>
                <SortableTh id="code">Code</SortableTh>
                <SortableTh id="type">Type</SortableTh>
                <SortableTh id="value" align="right">Value</SortableTh>
                <SortableTh id="usage">Usage</SortableTh>
                <SortableTh id="expiresAt">Expires</SortableTh>
                <SortableTh id="status">Status</SortableTh>
                <th style={{ width: 80, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} onClick={() => onOpen(d.id)}>
                  <td>
                    <div className="cell-code">
                      <span className="code-chip">{d.code}</span>
                      {d.description && <span className="code-desc">{d.description}</span>}
                    </div>
                  </td>
                  <td><TypeBadge type={d.type} /></td>
                  <td style={{ textAlign: "right" }}><span className="value-cell tabular">{fmtValue(d.type, d.value)}</span></td>
                  <td style={{ minWidth: 150 }}><UsageMeter count={d.usageCount} limit={d.usageLimit} /></td>
                  <td className="cell-date">{fmtDate(d.expiresAt) || <span className="muted">—</span>}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button className="ra-btn" title="Edit" onClick={() => onOpen(d.id)}><i data-lucide="pencil" /></button>
                      <button className="ra-btn danger" title="Delete" onClick={() => onDelete(d)}><i data-lucide="trash-2" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TableFooter total={filtered.length} />
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="ph-title">Discount Codes</h1>
          <p className="ph-sub">
            Create and manage promo codes for this store. Customers apply one code at checkout;
            usage is tracked against each code's limit. Deleting a code keeps its usage history.
          </p>
        </div>
        <div className="ph-actions">
          <button className="btn btn-secondary" onClick={onExport}><i data-lucide="download" />Export CSV</button>
          <button className="btn btn-primary" onClick={onCreate}><i data-lucide="plus" />Create discount</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <i data-lucide="search" className="icon-search" />
          <input placeholder="Search code or description…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <FilterChip icon="circle-dot" label="Status" value={statusFilter} onChange={setStatusFilter} allLabel="All"
          options={[{ id: "active", label: "Active" }, { id: "inactive", label: "Inactive" }]} />
        <FilterChip icon="tag" label="Type" value={typeFilter} onChange={setTypeFilter} allLabel="All"
          options={[{ id: "percentage", label: "Percentage" }, { id: "fixed", label: "Fixed amount" }]} />
      </div>

      <div className="card">{body}</div>
    </>
  );
};

const TableFooter = ({ total }) => {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="t-foot">
      <div className="row-flex" style={{ gap: 16 }}>
        <span>Showing <strong style={{ color: "var(--ink-1)" }}>1–{Math.min(pageSize, total)}</strong> of <strong style={{ color: "var(--ink-1)" }}>{total}</strong> codes</span>
        <div className="page-size">
          <span>Rows per page:</span>
          <select defaultValue="25"><option>10</option><option>25</option><option>50</option><option>100</option></select>
        </div>
      </div>
      <div className="pager">
        <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><i data-lucide="chevron-left" /></button>
        {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => i + 1).map((n) =>
          <span key={n} className={`pnum ${n === page ? "active" : ""}`} onClick={() => setPage(n)}>{n}</span>)}
        <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><i data-lucide="chevron-right" /></button>
      </div>
    </div>
  );
};

const FirstTimeEmpty = ({ onCreate }) => (
  <div className="empty-state">
    <div className="empty-illus"><i data-lucide="ticket" /></div>
    <h4>No discount codes yet</h4>
    <p>Create your first code to run a promotion — set a percentage or fixed amount off, an optional usage limit, and a date window. Customers apply it at checkout.</p>
    <div className="empty-cta">
      <button className="btn btn-secondary"><i data-lucide="book-open" />Read docs</button>
      <button className="btn btn-primary" onClick={onCreate}><i data-lucide="plus" />Create discount</button>
    </div>
  </div>
);

const NoResultsEmpty = ({ onClear }) => (
  <div className="empty-state">
    <div className="empty-illus" style={{ background: "var(--surface-3)", border: "1px solid var(--line-1)", color: "var(--ink-3)" }}><i data-lucide="search-x" /></div>
    <h4>No codes match your filters</h4>
    <p>Try a different search term, or clear the status and type filters to see more results.</p>
    <div className="empty-cta"><button className="btn btn-secondary" onClick={onClear}><i data-lucide="x" />Clear filters</button></div>
  </div>
);

const LoadingSkeleton = () => (
  <div className="t-wrap">
    <table className="ctable dtable">
      <thead><tr><th>Code</th><th>Type</th><th style={{ textAlign: "right" }}>Value</th><th>Usage</th><th>Expires</th><th>Status</th><th></th></tr></thead>
      <tbody>
        {Array.from({ length: 8 }).map((_, i) => (
          <tr key={i}>
            <td><div className="row-flex" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}><span className="sk" style={{ width: 90, height: 14, borderRadius: 4 }} /><span className="sk" style={{ width: 140, height: 10 }} /></div></td>
            <td><span className="sk" style={{ width: 88, height: 20, borderRadius: 999 }} /></td>
            <td style={{ textAlign: "right" }}><span className="sk" style={{ width: 48, height: 12 }} /></td>
            <td><span className="sk" style={{ width: 120, height: 18 }} /></td>
            <td><span className="sk" style={{ width: 80, height: 12 }} /></td>
            <td><span className="sk" style={{ width: 64, height: 20, borderRadius: 999 }} /></td>
            <td><span className="sk" style={{ width: 48, height: 24 }} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

Object.assign(window, { ListView });
