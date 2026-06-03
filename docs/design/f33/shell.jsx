/* F33 Discount Codes — Shared atoms, seed data, shell
   Multi-tenant discount CMS. Admin surfaces (S1/S2/S4) follow Payload
   conventions; S3 is the storefront checkout. Tenant: "Aurora Batik". */

const { useState, useMemo, useEffect, useRef, useCallback } = React;

const TENANT = { name: "Aurora Batik", slug: "aurora-batik" };

/* ─────────────────────────────────────────────────────────────────
   Seed — discount codes (value stored in % for percentage, sen for fixed)
   ───────────────────────────────────────────────────────────────── */
const SEED_DISCOUNTS = [
  { id: 1,  code: "SUMMER50",  description: "Summer campaign — sitewide",
    type: "percentage", value: 50,   status: "active",   usageLimit: 10,   usageCount: 3,
    startsAt: "2026-06-01T00:00:00+08:00", expiresAt: "2026-08-31T23:59:59+08:00",
    createdAt: "2026-05-12T10:22:00+08:00" },
  { id: 2,  code: "WELCOME",   description: "First-order welcome credit",
    type: "fixed",      value: 2500, status: "active",   usageLimit: 100,  usageCount: 100,
    startsAt: "2026-01-01T00:00:00+08:00", expiresAt: "2026-06-15T23:59:59+08:00",
    createdAt: "2025-12-20T09:00:00+08:00" },
  { id: 3,  code: "RAYA15",    description: "Hari Raya promo — 15% off",
    type: "percentage", value: 15,   status: "active",   usageLimit: 500,  usageCount: 412,
    startsAt: "2026-03-20T00:00:00+08:00", expiresAt: "2026-04-30T23:59:59+08:00",
    createdAt: "2026-03-10T14:05:00+08:00" },
  { id: 4,  code: "FREESHIP10",description: "RM10 off — shipping offset",
    type: "fixed",      value: 1000, status: "active",   usageLimit: 200,  usageCount: 168,
    startsAt: "2026-05-01T00:00:00+08:00", expiresAt: "2026-07-31T23:59:59+08:00",
    createdAt: "2026-04-28T11:40:00+08:00" },
  { id: 5,  code: "VIP100",    description: "VIP loyalty — RM100 credit",
    type: "fixed",      value: 10000,status: "active",   usageLimit: null, usageCount: 24,
    startsAt: "2026-02-01T00:00:00+08:00", expiresAt: null,
    createdAt: "2026-01-30T16:10:00+08:00" },
  { id: 6,  code: "BATIK20",   description: "Batik collection — 20% off",
    type: "percentage", value: 20,   status: "active",   usageLimit: 150,  usageCount: 47,
    startsAt: "2026-05-10T00:00:00+08:00", expiresAt: "2026-09-30T23:59:59+08:00",
    createdAt: "2026-05-08T08:30:00+08:00" },
  { id: 7,  code: "OLD2025",   description: "Legacy code — retired",
    type: "percentage", value: 10,   status: "inactive", usageLimit: null, usageCount: 8,
    startsAt: "2025-01-01T00:00:00+08:00", expiresAt: null,
    createdAt: "2024-12-15T10:00:00+08:00" },
  { id: 8,  code: "FLASH30",   description: "Flash sale — 30% off, capped",
    type: "percentage", value: 30,   status: "active",   usageLimit: 80,   usageCount: 80,
    startsAt: "2026-05-20T00:00:00+08:00", expiresAt: "2026-05-25T23:59:59+08:00",
    createdAt: "2026-05-18T09:15:00+08:00" },
  { id: 9,  code: "MERDEKA",   description: "Merdeka special — RM31 off",
    type: "fixed",      value: 3100, status: "inactive", usageLimit: 300,  usageCount: 0,
    startsAt: "2026-08-25T00:00:00+08:00", expiresAt: "2026-09-16T23:59:59+08:00",
    createdAt: "2026-05-22T13:00:00+08:00" },
  { id: 10, code: "STUDENT5",  description: "Student discount — 5% off",
    type: "percentage", value: 5,    status: "active",   usageLimit: null, usageCount: 137,
    startsAt: "2026-01-15T00:00:00+08:00", expiresAt: null,
    createdAt: "2026-01-12T10:00:00+08:00" },
  { id: 11, code: "BUNDLE75",  description: "Bundle saver — RM75 off",
    type: "fixed",      value: 7500, status: "active",   usageLimit: 50,   usageCount: 41,
    startsAt: "2026-04-01T00:00:00+08:00", expiresAt: "2026-06-30T23:59:59+08:00",
    createdAt: "2026-03-29T12:20:00+08:00" },
  { id: 12, code: "NEWYEAR",   description: "New year kickoff — 25% off",
    type: "percentage", value: 25,   status: "inactive", usageLimit: 1000, usageCount: 643,
    startsAt: "2025-12-26T00:00:00+08:00", expiresAt: "2026-01-31T23:59:59+08:00",
    createdAt: "2025-12-20T09:30:00+08:00" },
];

/* ─────────────────────────────────────────────────────────────────
   Seed — usage history (immutable; one row per order)
   ───────────────────────────────────────────────────────────────── */
const SEED_USAGE = [
  { id: "u1",  code: "SUMMER50", type: "percentage", value: 50,  amountApplied: 5000, orderNo: "PW-001044", customerEmail: "aisyah.rahman@gmail.com", usedAt: "2026-05-29T14:21:00+08:00" },
  { id: "u2",  code: "RAYA15",   type: "percentage", value: 15,  amountApplied: 1785, orderNo: "PW-001043", customerEmail: "weiming.tan@kopitiam.my",  usedAt: "2026-05-29T11:08:00+08:00" },
  { id: "u3",  code: "WELCOME",  type: "fixed",      value: 2500,amountApplied: 2500, orderNo: "PW-001041", customerEmail: "priya.s@example.com",      usedAt: "2026-05-28T19:44:00+08:00" },
  { id: "u4",  code: "BATIK20",  type: "percentage", value: 20,  amountApplied: 3960, orderNo: "PW-001039", customerEmail: "faizal@nasimak.com.my",    usedAt: "2026-05-28T16:50:00+08:00" },
  { id: "u5",  code: "FREESHIP10",type:"fixed",      value: 1000,amountApplied: 1000, orderNo: "PW-001037", customerEmail: "suyin.lim@gmail.com",      usedAt: "2026-05-28T09:30:00+08:00" },
  { id: "u6",  code: "SUMMER50", type: "percentage", value: 50,  amountApplied: 4500, orderNo: "PW-001035", customerEmail: "razak.hamzah@bizmail.my",  usedAt: "2026-05-27T15:12:00+08:00" },
  { id: "u7",  code: "VIP100",   type: "fixed",      value: 10000,amountApplied:10000,orderNo: "PW-001033", customerEmail: "devi.krishnan@example.org",usedAt: "2026-05-27T10:00:00+08:00" },
  { id: "u8",  code: "BUNDLE75", type: "fixed",      value: 7500,amountApplied: 7500, orderNo: "PW-001031", customerEmail: "nurul.h@gmail.com",        usedAt: "2026-05-26T18:20:00+08:00" },
  { id: "u9",  code: "RAYA15",   type: "percentage", value: 15,  amountApplied: 2235, orderNo: "PW-001029", customerEmail: "thomas.cheong@gmail.com",  usedAt: "2026-05-26T12:05:00+08:00" },
  { id: "u10", code: "FLASH30",  type: "percentage", value: 30,  amountApplied: 5970, orderNo: "PW-001027", customerEmail: "siti.aminah@hospital.gov.my", usedAt: "2026-05-25T20:11:00+08:00" },
  { id: "u11", code: "BATIK20",  type: "percentage", value: 20,  amountApplied: 1780, orderNo: "PW-001025", customerEmail: "aisyah.rahman@gmail.com",  usedAt: "2026-05-25T13:40:00+08:00" },
  { id: "u12", code: "WELCOME",  type: "fixed",      value: 2500,amountApplied: 2500, orderNo: "PW-001023", customerEmail: "lim.kok@gmail.com",        usedAt: "2026-05-24T09:18:00+08:00" },
];

/* ─────────────────────────────────────────────────────────────────
   Helpers — currency (sen → RM), value, dates (Asia/Kuala_Lumpur)
   ───────────────────────────────────────────────────────────────── */
const fmtRM = (sen) =>
  "RM " + (sen / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtValue = (type, value) =>
  type === "percentage" ? `${value}%` : fmtRM(value);

const fmtDate = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
};
const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) +
    ", " + d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false });
};
const relativeTime = (iso) => {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 365) return `${Math.floor(diff / 86400 / 30)}mo ago`;
  return `${Math.floor(diff / 86400 / 365)}y ago`;
};

/* ─────────────────────────────────────────────────────────────────
   Atoms — status badge, type badge, usage indicator
   ───────────────────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => (
  <span className={`status-badge ds-${status}`}>
    <span className="dot" style={{ background: "currentColor" }} />
    {status === "active" ? "Active" : "Inactive"}
  </span>
);

const TypeBadge = ({ type }) => (
  <span className={`type-badge ds-type-${type}`}>
    <i data-lucide={type === "percentage" ? "percent" : "banknote"} />
    {type === "percentage" ? "Percentage" : "Fixed"}
  </span>
);

/* Usage indicator: count/limit + thin progress bar.
   ≥80% amber · at-limit red · unlimited → ∞ */
const UsageMeter = ({ count, limit, compact }) => {
  if (limit == null) {
    return (
      <div className={`usage-meter unlimited ${compact ? "compact" : ""}`}>
        <div className="usage-text">
          <span className="uc tabular">{count.toLocaleString("en-MY")}</span>
          <span className="usep">/</span>
          <span className="ul">∞</span>
          <span className="usage-tag">unlimited</span>
        </div>
        {!compact && <div className="usage-bar"><span className="usage-fill inf" style={{ width: "100%" }} /></div>}
      </div>
    );
  }
  const pct = Math.min(100, Math.round((count / limit) * 100));
  const level = count >= limit ? "full" : pct >= 80 ? "near" : "ok";
  return (
    <div className={`usage-meter ${level} ${compact ? "compact" : ""}`}>
      <div className="usage-text">
        <span className="uc tabular">{count.toLocaleString("en-MY")}</span>
        <span className="usep">/</span>
        <span className="ul tabular">{limit.toLocaleString("en-MY")}</span>
        {level === "full" && <span className="usage-tag full">at limit</span>}
        {level === "near" && <span className="usage-tag near">{pct}%</span>}
      </div>
      {!compact && <div className="usage-bar"><span className={`usage-fill ${level}`} style={{ width: pct + "%" }} /></div>}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   Sidebar (Payload-style — Discounts active)
   ───────────────────────────────────────────────────────────────── */
const Sidebar = ({ counts, activeSub, onSub }) => {
  const [open, setOpen] = useState(true);
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <span className="sb-mark"><i data-lucide="mouse-pointer-click" /></span>
        <div>
          <div className="sb-wordmark">Prime<span>Web</span></div>
          <div className="sb-tenant">{TENANT.name}</div>
        </div>
      </div>

      <div className="sb-section-label">Collections</div>
      <div className="sb-item"><i data-lucide="package" /><span>Products</span><span className="sb-count">142</span></div>
      <div className="sb-item"><i data-lucide="layers" /><span>Categories</span><span className="sb-count">18</span></div>
      <div className="sb-item"><i data-lucide="shopping-bag" /><span>Orders</span><span className="sb-count">384</span></div>
      <div className="sb-item"><i data-lucide="users" /><span>Customers</span><span className="sb-count">{counts?.customers ?? 210}</span></div>

      <div className={`sb-item sb-group-trigger open active-parent`} onClick={() => setOpen((o) => !o)}>
        <i data-lucide="ticket" />
        <span>Discounts</span>
        <i data-lucide="chevron-down" className="sb-chev" />
      </div>
      {open &&
        <div className="sb-sub">
          <div className={`sb-item sb-sub-item ${activeSub === "codes" ? "active" : ""}`} onClick={() => onSub && onSub("codes")}>
            <span className="sb-sub-tick" /><span>Discount codes</span>
            <span className="sb-count">{counts?.discounts ?? 12}</span>
          </div>
          <div className={`sb-item sb-sub-item ${activeSub === "history" ? "active" : ""}`} onClick={() => onSub && onSub("history")}>
            <span className="sb-sub-tick" /><span>Usage history</span>
            <span className="sb-count">{counts?.usage ?? 312}</span>
          </div>
        </div>
      }

      <div className="sb-section-label">Globals</div>
      <div className="sb-item"><i data-lucide="settings" /><span>Store settings</span></div>
      <div className="sb-item"><i data-lucide="truck" /><span>Shipping zones</span></div>
      <div className="sb-item"><i data-lucide="credit-card" /><span>Payment</span></div>

      <div className="sb-section-label">System</div>
      <div className="sb-item"><i data-lucide="shield" /><span>Admins</span></div>

      <div className="sb-footer">
        <div className="sb-avatar">SY</div>
        <div className="sb-userinfo">
          <div className="sb-username">Siti Yusoff</div>
          <div className="sb-userrole">Tenant admin</div>
        </div>
        <button className="sb-logout" title="Sign out"><i data-lucide="log-out" /></button>
      </div>
    </aside>
  );
};

/* ─────────────────────────────────────────────────────────────────
   Topbar
   ───────────────────────────────────────────────────────────────── */
const Topbar = ({ crumbs, theme, onToggleTheme }) => (
  <div className="topbar">
    <div className="crumbs">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="crumb-sep">/</span>}
          <span className={`crumb ${i === crumbs.length - 1 ? "current" : ""}`}>
            {c.icon && <i data-lucide={c.icon} style={{ marginRight: 4, verticalAlign: -2 }} />}
            {c.label}
          </span>
        </React.Fragment>
      ))}
    </div>
    <div className="tb-right">
      <div className="tb-tenant-chip"><i data-lucide="store" />{TENANT.name}</div>
      <button className="icon-btn" title="Help"><i data-lucide="circle-help" /></button>
      <button className="icon-btn" title="Notifications"><i data-lucide="bell" /></button>
      <div className="tb-divider" />
      <button className="icon-btn" title="Toggle theme" onClick={onToggleTheme}>
        <i data-lucide={theme === "dark" ? "sun" : "moon"} />
      </button>
    </div>
  </div>
);

Object.assign(window, {
  React, useState, useMemo, useEffect, useRef, useCallback,
  TENANT, SEED_DISCOUNTS, SEED_USAGE,
  fmtRM, fmtValue, fmtDate, fmtDateTime, relativeTime,
  StatusBadge, TypeBadge, UsageMeter,
  Sidebar, Topbar,
});
