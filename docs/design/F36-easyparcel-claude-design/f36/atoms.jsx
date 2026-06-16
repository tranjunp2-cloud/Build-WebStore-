/* F36 — Shared atoms, helpers, chrome shells, dialog scaffold.
   Loaded before the five screen files. Everything is hung on window so the
   per-screen babel scripts (separate scopes) can reach it. */

const { useState, useEffect, useRef } = React;

/* ── lucide icon helper ─────────────────────────────────────────────────── */
function Icon({ name, className = "", style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (window.lucide && ref.current) {
      ref.current.innerHTML = "";
      ref.current.setAttribute("data-lucide", name);
      window.lucide.createIcons({ nameAttr: "data-lucide", icons: window.lucide.icons });
    }
  }, [name]);
  return <i ref={ref} data-lucide={name} className={className} style={style} />;
}

/* ── currency: internal sen → display RM (MYR) ──────────────────────────── */
const fmtRM = (sen) =>
  "RM " + (sen / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Malaysian states (16) for warehouse / origin select ─────────────────── */
const MY_STATES = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang",
  "Pulau Pinang", "Perak", "Perlis", "Selangor", "Terengganu",
  "Sabah", "Sarawak", "Kuala Lumpur", "Labuan", "Putrajaya",
];
const EAST_STATES = ["Sabah", "Sarawak", "Labuan"];

/* ── Couriers — `from` in sen. Monogram tiles are original marks (no brand
      logos). Sorted cheapest-first for the storefront ranking. ──────────── */
const COURIERS = [
  { id: "flash",  name: "Flash Express",  mono: "FX", color: "#e0a800", from: 490, eta: "2–4 days" },
  { id: "poslaju",name: "Pos Laju",       mono: "PL", color: "#d6232a", from: 540, eta: "2–3 days" },
  { id: "jnt",    name: "J&T Express",    mono: "JT", color: "#e2231a", from: 542, eta: "2–3 days" },
  { id: "citylink",name:"City-Link",      mono: "CL", color: "#1f6f3f", from: 580, eta: "3–4 days" },
  { id: "ninja",  name: "Ninja Van",      mono: "NV", color: "#1a1a1a", from: 590, eta: "1–3 days" },
  { id: "dhl",    name: "DHL eCommerce",  mono: "DH", color: "#b8860b", from: 650, eta: "2–5 days" },
];
const courierById = (id) => COURIERS.find((c) => c.id === id);

function CourierLogo({ courier, size = 34 }) {
  return (
    <span className="cl-logo" style={{ background: courier.color, width: size, height: size, fontSize: size * 0.32 }}>
      {courier.mono}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   DASHBOARD SHELL  (dark) — sidebar 240 + topbar, F18 CMS layout
   ════════════════════════════════════════════════════════════════════════ */
function DashShell({ crumbs = [], active = "shipping", children, dim = false }) {
  useEffect(() => { if (window.lucide) window.lucide.createIcons(); });
  const NAV = [
    { cap: "Online Store", items: [
      { ic: "layout-dashboard", label: "Dashboard", id: "dashboard", solo: true },
      { ic: "layout-template", label: "Editor", id: "editor" },
      { ic: "pencil", label: "Blog", id: "blog" },
    ] },
    { cap: "Core Operations", items: [
      { ic: "shopping-cart", label: "Orders", id: "orders" },
      { ic: "package", label: "Products", id: "products", count: "6" },
      { ic: "percent", label: "Discounts", id: "discounts" },
    ] },
    { cap: "CRM", items: [
      { ic: "users", label: "All Customers", id: "customers" },
      { ic: "user-plus", label: "Contact Leads", id: "leads" },
    ] },
    { cap: "Settings", items: [
      { ic: "credit-card", label: "Payments", id: "payments" },
      { ic: "truck", label: "Shipping", id: "shipping" },
      { ic: "globe", label: "Domains", id: "domains" },
      { ic: "bell", label: "Email Templates", id: "emails" },
      { ic: "users-round", label: "Team & Account", id: "team" },
    ] },
    { cap: "Support", items: [
      { ic: "headphones", label: "Help Center", id: "help" },
    ] },
  ];
  // Dashboard sits above the section captions as a standalone item.
  const dashItem = NAV[0].items[0];
  const groups = [{ cap: NAV[0].cap, items: NAV[0].items.slice(1) }, ...NAV.slice(1)];
  return (
    <div className="dash-shell">
      <div className="dash-brand">
        <button className="sb-dots" title="Switch workspace" aria-label="Switch workspace">
          {Array.from({ length: 9 }).map((_, i) => <span key={i} />)}
        </button>
        <span className="dash-mark"><Icon name="mouse-pointer-click" /></span>
        <span className="dash-word"><b>Prime</b><span className="t">Web</span></span>
        <span className="sb-collapse" title="Collapse"><Icon name="chevrons-left" /></span>
      </div>

      <aside className="dash-sidebar">
        <div className="sb-scroll">
          <button className={`nav-i ${active === dashItem.id ? "active" : ""}`} style={{ marginBottom: 2 }}>
            <Icon name={dashItem.ic} /><span>{dashItem.label}</span>
          </button>
          {groups.map((g) => (
            <React.Fragment key={g.cap}>
              <div className="nav-cap">{g.cap}</div>
              {g.items.map((n) => (
                <button key={n.id} className={`nav-i ${active === n.id ? "active" : ""}`}>
                  <Icon name={n.ic} /><span>{n.label}</span>
                  {n.count && <span className="count">{n.count}</span>}
                </button>
              ))}
            </React.Fragment>
          ))}
        </div>

        <div className="sb-foot">
          <div className="lang-switch">
            <Icon name="globe" />
            <div className="lang-pills">
              <button>MY</button>
              <button className="on">EN</button>
            </div>
          </div>
          <button className="logout"><Icon name="log-out" /><span>Logout</span></button>
        </div>
      </aside>

      <header className="dash-top">
        <div className="dash-top-r">
          <button className="ico-btn"><Icon name="bell" /></button>
          <button className="ico-btn sun"><Icon name="sun" /></button>
          <button className="dash-user"><span className="dash-avatar">J</span><Icon name="chevron-down" /></button>
        </div>
      </header>

      <main className="dash-main" style={dim ? { filter: "blur(1.5px)", opacity: .5 } : null}>
        {children}
      </main>
    </div>
  );
}

/* A lightweight dimmed order-detail page used behind the C/E dialogs for
   context (instead of re-mounting a full interactive page). */
function OrderDetailBackdrop() {
  return (
    <div className="dash-page" style={{ maxWidth: 760 }}>
      <div className="page-h">
        <h1>Order #PRM-1042</h1>
        <p>Aisyah Rahman · 2 items · Paid via Stripe · 16 Jun 2026</p>
      </div>
      <div className="card"><div className="card-b">
        <div className="bd-line" style={{ width: "40%" }} />
        <div className="bd-line" style={{ width: "85%" }} />
        <div className="bd-line" style={{ width: "70%" }} />
        <div className="bd-line" style={{ width: "55%" }} />
      </div></div>
      <div className="card"><div className="card-b">
        <div className="bd-line" style={{ width: "30%" }} />
        <div className="bd-line" style={{ width: "90%" }} />
        <div className="bd-line" style={{ width: "60%" }} />
      </div></div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   STOREFRONT SHELL  (light)
   ════════════════════════════════════════════════════════════════════════ */
function StoreShell({ children, store = "Aurora Batik" }) {
  useEffect(() => { if (window.lucide) window.lucide.createIcons(); });
  return (
    <>
      <header className="store-head">
        <span className="store-mark"><Icon name="shopping-bag" /></span>
        <span className="store-name">{store}</span>
        <span className="secure"><Icon name="lock" /> Secure checkout</span>
      </header>
      <div className="store-body">{children}</div>
    </>
  );
}

/* ── Small shared bits ──────────────────────────────────────────────────── */
function Switch({ on, onClick }) {
  return <button className={`switch ${on ? "on" : ""}`} onClick={onClick} aria-pressed={on} />;
}

function Alert({ kind = "info", icon, title, children, link }) {
  return (
    <div className={`alert ${kind}`}>
      {icon && <Icon name={icon} className="lead" />}
      <div className="a-body">
        {title && <div className="a-t">{title}</div>}
        {children}
      </div>
      {link && <span className="a-link">{link.label} <Icon name={link.icon || "external-link"} /></span>}
    </div>
  );
}

function Dialog({ title, icon, wide, onClose, children, footer }) {
  return (
    <div className="dialog-backdrop">
      <div className={`dialog ${wide ? "wide" : ""}`}>
        <div className="dialog-h">
          {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
          <h3>{title}</h3>
          <span className="x"><Icon name="x" /></span>
        </div>
        <div className="dialog-b">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

Object.assign(window, {
  React, useState, useEffect, useRef,
  Icon, fmtRM, MY_STATES, EAST_STATES, COURIERS, courierById, CourierLogo,
  DashShell, OrderDetailBackdrop, StoreShell, Switch, Alert, Dialog,
});
