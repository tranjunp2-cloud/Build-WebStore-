# Naming Convention — Customers vs Audience

> **Owner:** Dev + PM
> **Created:** 2026-05-20
> **Status:** Active — lock convention for two distinct modules that both touch "people in the system" but represent different concepts.

---

## TL;DR

| If the person... | Module | DB slug | Sidebar label | Doc prefix |
|------------------|--------|---------|---------------|------------|
| ...placed an order (is a buyer) | **F25 Shop Customers** | `customers` | **Customers** | `F25-shop-customers-*` |
| ...submitted contact form or newsletter (a lead) | **F24 Audience Tracking** | `audience` | **Audience** | `F24-audience-tracking-*` |

When in doubt: **a Customer paid you, an Audience member subscribed.**

---

## Why the convention exists

Both modules emerged in 2026 Q2 and both initially proposed the slug `customers`:

1. **F24 Audience Tracking** (plan `260429-1024-cms-customer-tracking/`, status: pending) originally proposed a virtual collection with slug `customers` that aggregates `ContactSubmissions` + `Subscribers` by email — a CRM-lite view of marketing leads.

2. **F25 Shop Customers** (plan `260520-1432-customers-module/`, merged) needed the slug `customers` for a real first-class buyer entity linked to Orders by `(tenant, email)` — restoring PW1 parity.

Phase 01 of plan 260520 renamed F24's slug `customers` → `audience` so F25 could claim the natural noun. This document locks the convention so the team doesn't drift back into ambiguous language.

---

## Concept boundary

### Shop Customers (F25)

- **What:** People who have placed at least one order, or were manually added by the merchant.
- **Source of records:** Auto-created by `Orders.beforeChange` hook when an order has a valid email; manually creatable in admin.
- **Tenant scope:** `(tenant_id, lower(trim(email)))` UNIQUE — same buyer across all sites under one tenant is one record.
- **Linked entity:** `Orders.customer` foreign key.
- **Industry equivalent:** Shopify Customers, WooCommerce Customers.
- **Lifecycle:** Hard-delete blocked. GDPR / anonymize deferred to separate plan.

### Audience (F24, pending)

- **What:** People who interacted with the storefront's marketing surfaces but may never have bought.
- **Source of records:** Aggregation view (virtual) over `ContactSubmissions` + `Subscribers` collections; no separate write path.
- **Site scope:** `(site_id, lower(trim(email)))` — one audience member per site.
- **Linked entity:** None directly; cross-referenced by `email` only.
- **Industry equivalent:** Mailchimp Audience, HubSpot Contacts (pre-conversion).
- **Lifecycle:** Read-only collection in admin; underlying submission records keep their own delete rules.

### Overlap

A single person can appear in both — they submitted a contact form (Audience) and later bought (Customer). The system does NOT auto-merge across modules. Each module tracks the person from its own surface. Linking by email is a future enhancement (post-F25, post-F24).

---

## Naming table — surface-by-surface

| Surface | Old / Audience | New / Customers (F25) |
|---------|----------------|-----------------------|
| **DB slug** | `audience` | `customers` |
| **Collection file** | `src/collections/Audience.ts` (when F24 ships) | `src/collections/Customers.ts` |
| **TypeScript type** | `Audience`, `AudienceMember` | `Customer` |
| **Admin sidebar label** | Audience | Customers |
| **Page title H1** | Audience | Customers |
| **Breadcrumb segment** | Audience | Customers |
| **Empty state copy** | "No audience members yet" | "No customers yet — they'll be added when orders are placed" |
| **REST URL** | `/api/v1/audience` (planned) | `/api/v1/customers` |
| **CSV export filename** | `audience-{tenantId}-{date}.csv` (planned) | `customers-{tenantId}-{date}.csv` |
| **Doc filename prefix** | `F24-audience-*` | `F25-shop-customers-*` |
| **Plan dir** | `plans/260429-1024-cms-customer-tracking/` (folder name retained for git history; slug inside = `audience`) | `plans/260520-1432-customers-module/` |
| **Feature ID** | F24-audience-tracking | F25-shop-customers |
| **Stakeholder language** | "marketing list", "leads", "audience" | "buyer database", "shop customers", "CRM" |
| **Internal nickname (Slack)** | "audience" or "leads" | "shop customers" or "buyers" |
| **Email/comms to merchant** | "your audience", "newsletter subscriber" | "your customer", "your buyer" |

---

## Anti-patterns (do NOT do)

- ❌ "Customer Module" referring to the audience module — confuses post-rename slug. Use "Audience Module".
- ❌ Slug `shop-customers` or `buyers` — redundant with the `customers` slug already established.
- ❌ Slug `contacts` or `leads` — would create yet another concept on top of audience.
- ❌ Calling a contact-form submitter a "Customer" in user-facing copy — they haven't bought.
- ❌ Calling a buyer an "Audience member" in admin UI — too generic, hides revenue intent.
- ❌ Mixing terminology within one document — pick one term per concept, stick with it.

---

## Glossary

| Term | Definition |
|------|------------|
| **Customer** | A person who placed at least one Order in this tenant. Tracked in `customers` collection. |
| **Buyer** | Synonym for Customer. Use "Customer" in product copy; "Buyer" OK in conversational/internal contexts. |
| **Audience member** | A person who submitted a contact form or subscribed to a newsletter on a site of this tenant. Tracked via `ContactSubmissions` + `Subscribers`, surfaced via `audience` virtual collection. |
| **Lead** | Synonym for Audience member. Used by sales/marketing teams. |
| **Subscriber** | A specific subtype of Audience member who joined the newsletter (vs filled contact form). Recorded in `Subscribers` collection directly. |
| **Contact submission** | A specific subtype of Audience member who filled the contact form. Recorded in `ContactSubmissions` directly. |

---

## Drift points to fix (one-time cleanup)

| # | Surface | Action |
|---|---------|--------|
| 1 | GitHub Issue #867 title `[Customers Module] UI Enhancements...` | Rename → `[Audience Module] UI Enhancements...` (refers to F24, not F25). Edit when convenient. |
| 2 | Plan 260429 H1 `# CMS Customer Tracking — Plan Overview` | Optional rename → `CMS Audience Tracking`. Already has 2026-05-20 note at top explaining slug rename; H1 update is cosmetic. |
| 3 | Migration matrix `docs/migration/pw1-vs-pw2-feature-matrix.md` lines 42-43 | After F25 lands, verify Customers row says "F25 done; F24 audience pending" not mixed wording. |

These are documentation hygiene fixes. Not blocking F25 merge.

---

## Future considerations (not yet decided)

1. **Cross-module identity link** — if a buyer emails X also appears in audience email X (same person), do we link? Probably yes via shared `lower(trim(email))` join, but ownership / privacy implications need PM call. Defer until both modules ship.

2. **Storefront-facing terminology** — when a buyer logs into "My Account", do we call them a "Customer" or just "you"? Use "you / your orders" in 2nd-person copy; reserve "Customer" for admin-side merchant view.

3. **Multi-tenant identity** — a single human may shop across multiple tenants. Today identity scope is `(tenant_id, email)` — each tenant sees their own copy. No cross-tenant link planned (privacy-by-default).

---

## When to update this doc

- A new module emerges that touches "people in the system" — add a row to the surface table.
- An anti-pattern shows up in code review or PR comments repeatedly — codify it.
- Vocabulary drift detected in user-facing copy — update glossary + audit affected screens.

Maintained by: Dev lead. PRs welcome.
