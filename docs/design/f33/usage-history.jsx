/* F33 — S4 · Discount usage history (Payload admin, read-only) */

const UsageHistory = ({ usage, viewState, search, setSearch }) => {
  const filtered = useMemo(() => {
    let rows = usage;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((u) => u.code.toLowerCase().includes(q) || u.orderNo.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime());
  }, [usage, search]);

  let body;
  if (viewState === "empty") {
    body = (
      <div className="empty-state">
        <div className="empty-illus"><i data-lucide="receipt" /></div>
        <h4>No redemptions yet</h4>
        <p>When a customer applies a discount code at checkout, a read-only record appears here — one row per order. History is preserved even if the code is later deleted.</p>
      </div>
    );
  } else if (filtered.length === 0) {
    body = (
      <div className="empty-state">
        <div className="empty-illus" style={{ background: "var(--surface-3)", border: "1px solid var(--line-1)", color: "var(--ink-3)" }}><i data-lucide="search-x" /></div>
        <h4>No redemptions match your search</h4>
        <p>Search by discount code or order number. Clear the search to see all redemptions.</p>
        <div className="empty-cta"><button className="btn btn-secondary" onClick={() => setSearch("")}><i data-lucide="x" />Clear search</button></div>
      </div>
    );
  } else {
    body = (
      <>
        <div className="t-wrap">
          <table className="ctable dtable">
            <thead>
              <tr>
                <th>Code</th><th>Type</th>
                <th style={{ textAlign: "right" }}>Amount applied</th>
                <th>Order #</th><th>Customer email</th><th>Used date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="no-hover">
                  <td><span className="code-chip">{u.code}</span></td>
                  <td><span className="type-mini">{u.type === "percentage" ? `${u.value}%` : fmtRM(u.value)}</span></td>
                  <td style={{ textAlign: "right" }}><span className="amount-applied tabular">−{fmtRM(u.amountApplied)}</span></td>
                  <td><a className="order-link" onClick={(e) => e.preventDefault()} href="#"><span className="kbd-key">{u.orderNo}</span><i data-lucide="arrow-up-right" /></a></td>
                  <td className="cell-email-mono">{u.customerEmail}</td>
                  <td className="cell-date" title={fmtDateTime(u.usedAt)}>{fmtDate(u.usedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="t-foot">
          <span>Showing <strong style={{ color: "var(--ink-1)" }}>1–{filtered.length}</strong> of <strong style={{ color: "var(--ink-1)" }}>312</strong> redemptions</span>
          <div className="pager">
            <button disabled><i data-lucide="chevron-left" /></button>
            <span className="pnum active">1</span><span className="pnum">2</span><span className="pnum">3</span>
            <span className="pnum dots">…</span><span className="pnum">13</span>
            <button><i data-lucide="chevron-right" /></button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="ph-title">Discount Usage History</h1>
          <p className="ph-sub">
            Every code redemption, newest first. This log is immutable for audit — no editing or deleting.
            One row per order; webhook retries never duplicate a row.
          </p>
        </div>
        <div className="ph-actions">
          <span className="immutable-pill"><i data-lucide="lock" />Read-only</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <i data-lucide="search" className="icon-search" />
          <input placeholder="Search by code or order #…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">{body}</div>
    </>
  );
};

Object.assign(window, { UsageHistory });
