/* F32 Email Template Settings — shell, seed data, sidebar/topbar */

const { useState, useMemo, useEffect, useRef, useCallback } = React;

/* ─────────────────────────────────────────────────────────────────
   Seed email templates (Buyer + Seller)
   ───────────────────────────────────────────────────────────────── */

const TEMPLATES = [
  // ── Buyer
  {
    id: "order_confirmation",
    audience: "buyer",
    name: "Order Confirmation",
    description: "Sent the moment a buyer's checkout succeeds — receipts, items, shipping.",
    icon: "package-check",
    enabled: true,
    customized: true,
    updatedAt: "2026-05-19T10:14:00+08:00",
    locales: {
      en: {
        subject: "Your order {orderNumber} is confirmed",
        greeting: "Hi {customerName},",
        cta: "Track Order",
        closing: "Best regards,\nPrimeWeb Team",
      },
      ms: {
        subject: "Pesanan {orderNumber} anda telah disahkan",
        greeting: "Hai {customerName},",
        cta: "Jejak Pesanan",
        closing: "Salam mesra,\nPasukan PrimeWeb",
      },
    },
    variables: ["customerName", "orderNumber", "brandName", "supportEmail"],
  },
  {
    id: "order_cancelled",
    audience: "buyer",
    name: "Order Cancelled",
    description: "Notify buyer when their order is cancelled (by them, ops, or auto-cancel).",
    icon: "package-x",
    enabled: true,
    customized: false,
    updatedAt: "2026-04-30T16:02:00+08:00",
    locales: { en: { subject: "Order {orderNumber} has been cancelled", greeting: "Hi {customerName},", cta: "Browse Store", closing: "Best regards,\nPrimeWeb Team" }, ms: { subject: "", greeting: "", cta: "", closing: "" } },
    variables: ["customerName", "orderNumber", "brandName", "supportEmail"],
  },
  {
    id: "order_delivered",
    audience: "buyer",
    name: "Order Delivered",
    description: "Delivery confirmation with review prompt and reorder CTA.",
    icon: "package",
    enabled: true,
    customized: true,
    updatedAt: "2026-05-12T09:30:00+08:00",
    locales: { en: { subject: "Your order {orderNumber} has arrived", greeting: "Hi {customerName},", cta: "Leave a Review", closing: "Hope you love it,\nPrimeWeb Team" }, ms: { subject: "", greeting: "", cta: "", closing: "" } },
    variables: ["customerName", "orderNumber", "brandName", "reviewLink"],
  },
  {
    id: "order_failed",
    audience: "buyer",
    name: "Order Failed",
    description: "Payment or stock failure — explain the next step.",
    icon: "circle-alert",
    enabled: false,
    customized: false,
    updatedAt: "2025-12-08T11:00:00+08:00",
    locales: { en: { subject: "We couldn't process order {orderNumber}", greeting: "Hi {customerName},", cta: "Retry Payment", closing: "Need help?\nPrimeWeb Team" }, ms: { subject: "", greeting: "", cta: "", closing: "" } },
    variables: ["customerName", "orderNumber", "failureReason", "retryLink"],
  },
  {
    id: "order_refunded",
    audience: "buyer",
    name: "Order Refunded",
    description: "Confirm refund has been issued back to the buyer's account.",
    icon: "banknote",
    enabled: true,
    customized: false,
    updatedAt: "2026-05-22T14:05:00+08:00",
    locales: { en: { subject: "Refund processed for order {orderNumber}", greeting: "Hi {customerName},", cta: "View Refund Details", closing: "Thanks,\n{brandName}" }, ms: { subject: "", greeting: "", cta: "", closing: "" } },
    variables: ["customerName", "orderNumber", "refundAmount", "refundMethod", "refundedAt", "brandName"],
  },
  {
    id: "payment_reminder_bank_transfer",
    audience: "buyer",
    name: "Payment Reminder (Bank Transfer)",
    description: "Remind buyer to complete bank transfer — order auto-cancels after 24h.",
    icon: "hourglass",
    enabled: true,
    customized: false,
    updatedAt: "2026-05-22T13:55:00+08:00",
    locales: { en: { subject: "Action needed: complete payment for order {orderNumber} within 24h", greeting: "Hi {customerName},", cta: "View Payment Details", closing: "Thanks,\n{brandName}" }, ms: { subject: "", greeting: "", cta: "", closing: "" } },
    variables: ["customerName", "orderNumber", "orderTotal", "bankAccount", "expiresAt", "brandName"],
  },
  {
    id: "welcome",
    audience: "buyer",
    name: "Welcome",
    description: "First-touch hello when a buyer signs up or places their first order.",
    icon: "hand",
    enabled: true,
    customized: false,
    updatedAt: "2026-02-04T08:15:00+08:00",
    locales: { en: { subject: "Welcome to {brandName}", greeting: "Hi {customerName},", cta: "Start Shopping", closing: "See you soon,\n{brandName}" }, ms: { subject: "", greeting: "", cta: "", closing: "" } },
    variables: ["customerName", "brandName", "discountCode"],
  },
  {
    id: "password_reset",
    audience: "buyer",
    name: "Password Reset",
    description: "One-tap password reset link, valid for 30 minutes.",
    icon: "key-round",
    enabled: true,
    customized: false,
    updatedAt: "2025-11-21T14:00:00+08:00",
    locales: { en: { subject: "Reset your {brandName} password", greeting: "Hi {customerName},", cta: "Reset Password", closing: "If you didn't request this, ignore this email." }, ms: { subject: "", greeting: "", cta: "", closing: "" } },
    variables: ["customerName", "brandName", "resetLink", "expiresIn"],
  },
  // ── Seller
  {
    id: "new_order_seller",
    audience: "seller",
    name: "New Order Notification",
    description: "Heads-up to the seller every time a new order lands.",
    icon: "bell-ring",
    enabled: true,
    customized: true,
    updatedAt: "2026-05-18T22:11:00+08:00",
    locales: { en: { subject: "New order {orderNumber} — {customerName}", greeting: "Hi {sellerName},", cta: "Fulfil Order", closing: "PrimeWeb Ops" }, ms: { subject: "", greeting: "", cta: "", closing: "" } },
    variables: ["sellerName", "orderNumber", "customerName", "orderTotal"],
  },
  {
    id: "payment_received_seller",
    audience: "seller",
    name: "Payment Received",
    description: "Buyer has paid — confirm the order in CMS to proceed with fulfilment.",
    icon: "badge-check",
    enabled: true,
    customized: false,
    updatedAt: "2026-05-22T14:00:00+08:00",
    locales: { en: { subject: "Payment received for order {orderNumber} — please confirm", greeting: "Hi {sellerName},", cta: "Confirm Order in CMS", closing: "PrimeWeb Ops" }, ms: { subject: "", greeting: "", cta: "", closing: "" } },
    variables: ["sellerName", "orderNumber", "customerName", "orderTotal", "paidAt", "paymentMethod"],
  },
  {
    id: "daily_sales_summary",
    audience: "seller",
    name: "Daily Sales Summary",
    description: "End-of-day digest — orders, revenue, abandoned carts.",
    icon: "trending-up",
    enabled: false,
    customized: false,
    updatedAt: "2025-09-18T08:00:00+08:00",
    locales: { en: { subject: "Yesterday at {brandName}: {orderCount} orders, {totalRevenue}", greeting: "Morning {sellerName},", cta: "Open Dashboard", closing: "Have a great day,\nPrimeWeb" }, ms: { subject: "", greeting: "", cta: "", closing: "" } },
    variables: ["sellerName", "brandName", "orderCount", "totalRevenue"],
  },
  {
    id: "contact_form_seller",
    audience: "seller",
    name: "Contact Form (Seller)",
    description: "Forward the message to seller's support inbox.",
    icon: "inbox",
    enabled: true,
    customized: false,
    updatedAt: "2026-01-22T11:34:00+08:00",
    locales: { en: { subject: "New enquiry from {customerName}", greeting: "Hi {sellerName},", cta: "Open Inbox", closing: "PrimeWeb" }, ms: { subject: "", greeting: "", cta: "", closing: "" } },
    variables: ["sellerName", "customerName", "submittedAt"],
  },
  {
    id: "newsletter_seller",
    audience: "seller",
    name: "Newsletter (Seller Digest)",
    description: "Weekly digest of newsletter signups, opens, click-through.",
    icon: "newspaper",
    enabled: false,
    customized: false,
    updatedAt: "2025-08-30T10:00:00+08:00",
    locales: { en: { subject: "Your newsletter, this week", greeting: "Hi {sellerName},", cta: "View Analytics", closing: "PrimeWeb" }, ms: { subject: "", greeting: "", cta: "", closing: "" } },
    variables: ["sellerName", "newSubscribers", "openRate"],
  },
];

/* Counts derived from the seed */
const TEMPLATE_COUNTS = {
  buyer: TEMPLATES.filter(t => t.audience === "buyer").length,
  seller: TEMPLATES.filter(t => t.audience === "seller").length,
  customized: TEMPLATES.filter(t => t.customized).length,
};

/* ─────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────── */

const relTime = (iso) => {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff/86400)}d ago`;
  if (diff < 86400 * 365) return `${Math.floor(diff/86400/30)}mo ago`;
  return `${Math.floor(diff/86400/365)}y ago`;
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) +
         ", " + d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false });
};

/* ─────────────────────────────────────────────────────────────────
   Toggle switch
   ───────────────────────────────────────────────────────────────── */

const Toggle = ({ on, onClick, stopPropagation = true }) => (
  <div
    className={`toggle ${on ? "on" : ""}`}
    role="switch"
    aria-checked={on}
    onClick={(e) => { if (stopPropagation) e.stopPropagation(); onClick && onClick(); }}
  />
);

/* ─────────────────────────────────────────────────────────────────
   Sidebar — matches F25; "Email templates" highlighted under Globals
   ───────────────────────────────────────────────────────────────── */

const Sidebar = () => {
  const [emailsOpen, setEmailsOpen] = useState(true);
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <span className="sb-mark"><i data-lucide="mouse-pointer-click" /></span>
        <div>
          <div className="sb-wordmark">Prime<span>Web</span></div>
        </div>
      </div>

      <div className="sb-section-label">Collections</div>
      <div className="sb-item"><i data-lucide="package" /><span>Products</span><span className="sb-count">142</span></div>
      <div className="sb-item"><i data-lucide="layers" /><span>Categories</span><span className="sb-count">18</span></div>
      <div className="sb-item"><i data-lucide="shopping-bag" /><span>Orders</span><span className="sb-count">384</span></div>
      <div className="sb-item"><i data-lucide="users" /><span>Customers</span><span className="sb-count">10</span></div>
      <div className="sb-item"><i data-lucide="ticket" /><span>Discounts</span><span className="sb-count">7</span></div>

      <div className="sb-section-label">Globals</div>
      <div className="sb-item"><i data-lucide="settings" /><span>Store settings</span></div>
      <div className="sb-item"><i data-lucide="truck" /><span>Shipping zones</span></div>
      <div className="sb-item"><i data-lucide="credit-card" /><span>Payment</span></div>

      <div className={`sb-item sb-group-trigger active-parent ${emailsOpen ? "open" : ""}`}
           onClick={() => setEmailsOpen(o => !o)}>
        <i data-lucide="mail" />
        <span>Emails</span>
        <i data-lucide="chevron-down" className="sb-chev" />
      </div>
      {emailsOpen && (
        <div className="sb-sub">
          <div className="sb-item sb-sub-item active">
            <span className="sb-sub-tick" />
            <span>Templates</span>
            <span className="sb-count">{TEMPLATES.length}</span>
          </div>
          <div className="sb-item sb-sub-item">
            <span className="sb-sub-tick" />
            <span>Logs</span>
            <span className="sb-count">2.4k</span>
          </div>
          <div className="sb-item sb-sub-item">
            <span className="sb-sub-tick" />
            <span>Sender domains</span>
          </div>
        </div>
      )}

      <div className="sb-section-label">System</div>
      <div className="sb-item"><i data-lucide="shield" /><span>Admins</span></div>
      <div className="sb-item"><i data-lucide="terminal" /><span>API logs</span></div>

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
   Topbar — breadcrumb + actions
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
      <button className="icon-btn" title="Help"><i data-lucide="circle-help" /></button>
      <button className="icon-btn" title="Notifications"><i data-lucide="bell" /></button>
      <div className="tb-divider" />
      <button className="icon-btn" title="Toggle theme" onClick={onToggleTheme}>
        <i data-lucide={theme === "dark" ? "sun" : "moon"} />
      </button>
    </div>
  </div>
);

/* Expose to global */
Object.assign(window, {
  React, useState, useMemo, useEffect, useRef, useCallback,
  TEMPLATES, TEMPLATE_COUNTS, relTime, fmtDateTime,
  Toggle, Sidebar, Topbar,
});
