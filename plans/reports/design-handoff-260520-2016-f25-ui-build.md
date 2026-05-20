# F25 Shop Customers — UI Build Hand-off Brief

> **Audience:** Claude session (or any AI design agent) tasked with building the full UI mockup / Figma / interactive prototype for F25.
> **Created:** 2026-05-20
> **Status:** Backend + tests done (PR #1042). Design spec doc exists (PR #1046). **UI mockups + Figma TBD** — that's your job.

---

## 1. Mission

Build the **complete UI flow** for the F25 Shop Customers module in PW2 admin (Payload CMS). Deliverable: high-fidelity mockups (Figma / HTML demo / Next+Tailwind prototype — your call) covering 8 screens + state variants.

Backend is already implemented and tested (39/39 green). Your scope is **visual + interaction design** that a reviewer can hand to PM/stakeholder for sign-off.

---

## 2. Feature in 1 paragraph

PW2 currently denormalizes buyer info inside Orders (`customerEmail/customerName/customerPhone/shippingAddress`). F25 promotes them into a first-class `customers` collection with multi-address book + manual rank tag (`bronze|silver|gold|vip`). Orders auto-link to Customer via beforeChange hook on `(tenant, lower(trim(email)))`. UI lives in Payload Admin: list view, detail view with 3 tabs, CSV export. Restores parity with PW1. ETL from PW1 deferred.

---

## 3. Locked PM decisions (DO NOT redesign these)

1. **Identity scope = tenant-wide** — same buyer across all sites under one tenant inherits same rank + history.
2. **Phone field exists but NOT unique-indexed** — shared family/hotline OK.
3. **Hard-delete disabled** — `delete: () => false` in collection access. UI shows greyed-out "Delete" button → 403 on click. GDPR / anonymize deferred.
4. **Rank enum English in DB** (`bronze|silver|gold|vip`). Display labels stay English in v1; F21 will localize.
5. **Customers auto-created from Orders** — not the primary creation path. Admin can edit but rarely creates from scratch.

---

## 4. Screens to design (8 surfaces + states)

### 4.1. List view — `/admin/collections/customers`

- Search input (email or name) at top
- Filter chips: Rank (5 options incl. Unranked), Created date range
- Export CSV button (top-right)
- Columns: Email | Name | Rank (badge) | Phone | Created (relative time)
- Pagination 25/page bottom
- Sort indicators on all 5 columns
- **States**: empty (first time), populated (5 / 50 / 1000+ rows), search no results, loading skeleton

### 4.2. Detail view — `/admin/collections/customers/:id`

- Breadcrumb: `Customers > {email}`
- Tab bar: **Default** | **Addresses** | **Orders**
- Save button top-right
- Default tab fields: Email* / Name* / Phone / Rank (select) / Notes (textarea) / FirstOrderAt (read-only) / Created / Updated
- **States**: new customer (blank form), existing with full data, validation errors inline, hard-delete attempt error toast

### 4.3. Addresses tab (Payload native array UI)

- Cards stacked vertically, drag handles + reorder
- Per-card fields: Label / Line 1* / Line 2 / City / State / Postcode / Country (default Malaysia) / `isDefault` checkbox
- "+ Add another address" button at bottom (disabled when 10 reached)
- Remove button per card
- **States**: 0 addresses (empty state with CTA), 1-10 addresses, 10/10 (Add button disabled with tooltip)

### 4.4. Orders tab (NEW — F25 custom component)

- Header: "Orders ({total})"
- Table columns: Order # | Status (badge) | Total + currency | Payment status (badge) | Date (en-MY format)
- Row click → navigate to order detail
- Pagination 25/page (Prev / Page X of Y / Next)
- **States**: empty ("No orders linked yet"), 1-25 rows, multi-page, error ("Failed to load orders: …")
- Component file: `src/components/admin/customers-orders-tab.tsx`

### 4.5. CSV Export flow

- Trigger: button in list view
- Click → browser download (no modal, no progress bar in v1)
- Filename: `customers-{tenantId}-{YYYYMMDD}.csv`
- **States**: success download, 413 too-large toast ("Filter then retry"), 403 forbidden toast

### 4.6. Rank badges visual spec

```
🥇 Gold     accent #f59e0b, background tint 10% opacity
🥈 Silver   accent #94a3b8
🥉 Bronze   accent #b45309
⭐ VIP      accent #7c3aed
—           Unranked (null) — muted grey #6b7280, no emoji
```

Same badge component reused in list table + detail Rank select + Orders tab status reference.

### 4.7. Order status badges (reuse Orders palette)

```
pending           #f59e0b amber
new               #06b6d4 cyan
confirmed         #3b82f6 blue
ready_to_ship     #8b5cf6 purple
shipped           #6366f1 indigo
completed         #10b981 green
cancelled         #ef4444 red
refunded          #6b7280 gray
paid              #10b981
payment_failed    #ef4444
processing        #f59e0b
```

### 4.8. Mobile + responsive

- Admin is desktop-first; just verify list collapses to horizontal scroll <768px and Edit tabs stack vertically <640px
- No native mobile-first redesign in v1

---

## 5. Design system constraints

- **Primary**: Payload Admin 3.79 native UI components (use `@payloadcms/ui` primitives where possible — `Button`, `Field`, `Table`, `Tab`, etc.)
- **Fallback**: Tailwind + shadcn/ui if Payload primitives unavailable (consistent with rest of codebase)
- **F18 Global Layout**: Sidebar trái + Topbar không change — design within main content area
- **No emojis in production code** except where specified (rank badges, status badges)
- **Accessibility**: ARIA tablist for tabs, `role="alert"` for errors, keyboard navigation, focus states visible

---

## 6. Reference files (read these for context)

| Type | Path | Purpose |
|------|------|---------|
| Source of truth — design spec | `docs/design/F25-shop-customers-design.md` | Full 467-line wireframe doc (your bible) |
| PRD | `docs/prd/F25-shop-customers.md` | Business scope + AC |
| Architecture | `docs/architecture/F25-shop-customers.md` | Data model + hook flow |
| QA | `docs/qa/F25-shop-customers.md` | TC-F25-001..010 |
| Collection schema | `src/collections/Customers.ts` | Fields + access rules |
| Custom Orders tab | `src/components/admin/customers-orders-tab.tsx` | Existing implementation (working but unstyled) |
| CSV export endpoint | `src/app/api/v1/customers/export/route.ts` | Backend contract |
| Plan | `plans/260520-1432-customers-module/` | Full implementation history |
| Reference style — Orders design | `docs/design/F10-orders-management-design.md` | Same module family, mirror this aesthetic |
| Reference style — Products design | `docs/design/F08-products-crud-design.md` | Another precedent |

---

## 7. Deliverables expected

Pick one tier based on time budget:

### Tier 1 — Wireframe pass (~2-4h)
- Mid-fidelity Figma frames for all 8 surfaces (§4)
- All state variants annotated
- Component spec page with rank badges + status badges + form fields

### Tier 2 — High-fidelity prototype (~6-8h)
- Tier 1 deliverables + interactive Figma prototype (click-through list → detail → tabs)
- Empty / error / loading state mockups
- Mobile breakpoint mockups

### Tier 3 — HTML demo (~8-12h)
- Standalone self-contained HTML page in `docs/design/F25-customers-ui-demo.html` (precedent: `F08-category-management-ui.html`)
- Tailwind via CDN, no build step
- Static data for 5-10 sample customers
- Navigable: list → detail (3 tabs), CSV button shows toast

### Tier 4 — Production-ready React stubs
- Update `src/components/admin/customers-orders-tab.tsx` styling
- Add list view component overrides (if Payload allows)
- Reuse existing `@payloadcms/ui` primitives
- Hand back PR for code-reviewer

---

## 8. Out of scope (DO NOT touch)

- Schema changes (fields, validators, access rules) — locked
- Hook logic (autoLinkCustomer, syncCustomerSnapshot) — locked
- CSV export endpoint contract — locked (only the trigger UI can be styled)
- Stories doc — user opted PRD-only
- Rank label localization — F21 owns
- Auto-calc rank by spend/count — YAGNI
- Bulk actions — disabled (hard-delete blocked)
- Customer merge UI — YAGNI
- Activity timeline / audit log — YAGNI
- ETL from PW1 — US-MIGA-12 separate plan

---

## 9. Questions you may face

| Question | Answer |
|----------|--------|
| Should I add a "+ Create customer" button? | Yes, Payload provides natively. Most customers come from Orders hook though — note in empty state copy. |
| Where does "Delete" button live? | Payload Edit view footer. We can't hide it (access rule blocks runtime). Style as disabled if Payload allows. |
| Can I add filter by tenant for super-admin? | Defer to v2 (YAGNI). Super-admin uses URL `?where[tenant][equals]=N` manually for now. |
| Should Orders tab pagination be infinite scroll? | No. 25/page with Prev/Next is fine. Match Payload table conventions. |
| Can I add a customer photo / avatar? | Defer. Schema has no avatar field. Don't add to design without PM ask. |
| Should Notes field have rich-text? | No. Plain textarea per schema. KISS. |
| Mobile-first design? | No. Desktop-first. Just verify breakpoint degradation works. |

---

## 10. Definition of done

- [ ] All 8 surfaces (§4.1-4.8) have mockups
- [ ] All state variants (empty / loading / error / populated) shown
- [ ] Rank badges + status badges visualized (§4.6, §4.7)
- [ ] Accessibility annotations present (ARIA, focus, contrast)
- [ ] Color tokens listed (no magic hex without naming)
- [ ] Mobile breakpoint mockup at least 1 surface
- [ ] Hand-back artifact (Figma link / HTML demo / React PR) referenced from `docs/design/F25-shop-customers-design.md` "Figma Design" line

---

## 11. Contact

- Spec questions → comment on PR #1046 (design doc) or #1042 (code)
- Stakeholder ask → tag PM on issue #1043
- Implementation history → `plans/260520-1432-customers-module/`

**Have fun. F25 is the foundation for many future customer-relationship features.**
