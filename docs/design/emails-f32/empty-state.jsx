/* F32 — Empty state (3) When tenant hasn't customized anything */

const EmptyState = ({ onBrowse }) => (
  <>
    <div className="page-head">
      <div>
        <h1 className="ph-title" style={{ margin: 0 }}>Email Templates</h1>
        <p className="ph-sub">
          Customize the transactional emails your store sends to buyers and to yourself.
        </p>
      </div>
    </div>

    <div className="card">
      <div className="empty-hero">
        <div className="icon-bowl">
          <i data-lucide="mail" />
        </div>
        <h2>No customizations yet</h2>
        <p>
          Your store is currently using the default PrimeWeb templates. Customize them to match
          your brand voice, tone, and writing style — every change stays scoped to your tenant.
        </p>
        <div className="empty-cta">
          <button className="btn btn-secondary"><i data-lucide="book-open" />How it works</button>
          <button className="btn btn-primary" onClick={onBrowse}>
            <i data-lucide="layout-grid" />
            Browse Templates
            <i data-lucide="arrow-right" />
          </button>
        </div>

        <div className="how-grid">
          <div className="how-card">
            <div className="num">1</div>
            <h4>Pick a template</h4>
            <p>Browse the 12 transactional emails grouped by Buyer and Seller audience.</p>
          </div>
          <div className="how-card">
            <div className="num">2</div>
            <h4>Edit copy &amp; preview live</h4>
            <p>Tweak subject, greeting, CTA and closing in EN or MS — the preview updates instantly.</p>
          </div>
          <div className="how-card">
            <div className="num">3</div>
            <h4>Save · revert anytime</h4>
            <p>Your edits go live the moment you save. Reset to the PrimeWeb default with one click.</p>
          </div>
        </div>
      </div>
    </div>
  </>
);

Object.assign(window, { EmptyState });
