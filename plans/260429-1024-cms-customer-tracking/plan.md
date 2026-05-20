---
title: "CMS Customer tracking view (per-tenant)"
description: "Unified view aggregating Contact + Newsletter submissions by email, scoped per template owner."
status: pending
priority: P2
effort: 6h
branch: feat/block-usage-admin
tags: [cms, payload, customers, tenant-access, contact, newsletter]
created: 2026-04-29
---

# CMS Customer Tracking — Plan Overview

Unified read-only Customers view in Payload admin. Aggregates `contact-submissions` + `subscribers` by `lower(trim(email))` within `site_id`. Tenant-scoped: template owners see own sites only, super-admin sees all. Proposed feature id: **F24-customer-tracking** (next free after F22).

## Verified context (file:line refs)

- `src/collections/Tenants.ts:31-55` — tenant access pattern: `req.user.roles?.includes('super-admin')` OR `id IN req.user.tenants[].tenant.id`.
- `src/collections/Sites.ts:13-41` — same pattern, scoped via `tenant: { in: tenantIds }`. Sites belong to tenants via `tenant` relationship (line 44-51).
- `src/collections/Users.ts:915-967` — `users.tenants` is array `{ tenant: relationship, status, role: owner/admin/editor/viewer/custom, permissions[] }`.
- `src/collections/ContactSubmissions.ts:16-21` — read/update/delete = super-admin only. Has `site` rel + `email` (indexed) + `status` enum.
- `src/collections/Subscribers.ts:10-15` — same lockdown. Has `site` rel + `email` (indexed). DB has `UNIQUE INDEX subscribers_email_site_uniq (email, site_id)` per `scripts/db-setup.js:2398`.
- `src/payload.config.ts:116-143` — collections registered as array; admin component overrides supported via `admin.components.views.list`.
- `src/app/api/contact-submit/route.ts` + `src/app/api/subscribe/route.ts` — public POST endpoints, untouched by this feature.
- **No existing `src/access/` dir** — design fresh helper.
- Payload `3.79.0` — supports custom endpoints + virtual collections via `dbName: false` is NOT a thing; we use `useAsTitle` + custom List view + custom collection-level endpoints. Option (a) feasible.

## Strategy decision

**Option (a) — virtual read-only collection backed by custom List view.** Rationale: No domain data writes / no backfill; aggregation lives in one custom List component fetching both collections via Local API, grouping by `lower(trim(email))` per `site_id`. Detail view is just a deep-link to filtered ContactSubmissions + Subscribers lists (no synthetic doc id needed). Trade-off: no native pagination/sort across aggregate — handled in custom List with controlled query params (acceptable for expected volumes <10k contacts/site). **Minor cost**: Payload 3.79 still requires a real (empty) `customers` table for collection registration → 3 migration entries (`customers` table + `payload_locked_documents_rels` + `payload_preferences_rels` ALTERs) per project pattern. Trips `check-migrations.js` gate; mirrored from `subscribers` migration precedent.

Fallback to (b) materialized table only if (a) page render exceeds 2s on 5k rows during phase-03 smoke. Plan does NOT pre-build (b) — YAGNI.

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 01 | Tenant access refactor (helper + relax ContactSubmissions/Subscribers reads) | pending | 1.5h | [phase-01](./phase-01-tenant-access-refactor.md) |
| 02 | Customers virtual collection + custom List view | pending | 3.5h | [phase-02-customers-virtual-collection.md](./phase-02-customers-virtual-collection.md) |
| 03 | Smoke + manual verification matrix | pending | 1h | [phase-03-smoke-verification.md](./phase-03-smoke-verification.md) |

## Dependencies

- 01 → 02 (List view relies on relaxed reads to fetch as tenant user).
- 02 → 03 (smoke needs UI live).
- Phase 02 touches `scripts/db-setup.js` (3 migration entries — empty `customers` table + 2 rels ALTERs) → `check-migrations.js` CI gate must pass before merge.

## Risk register

| Risk | L×I | Mitigation |
|------|-----|------------|
| Tenant leak (relaxed read on submissions exposes other-tenant data) | L×H | Helper unit-tested; phase-03 explicit cross-tenant check |
| Aggregation perf on large datasets | M×M | Cap initial query `limit: 1000` per collection; flag if exceeded → trigger fallback (b) |
| Email casing inconsistency creates duplicate rows | M×L | Normalize via `lower(trim(email))` in JS aggregator; future: enforce on submit endpoints |
| Custom List view breaks on Payload upgrade | L×M | Keep view component thin (<150 LOC), document Payload 3.79 contract |

## Backwards compatibility

Additive only. ContactSubmissions/Subscribers schemas unchanged. Existing super-admin queries unaffected. Public submit endpoints untouched. Rollback = revert PR.

## File ownership (no parallel conflicts)

- Phase 01 owns: `src/access/tenant-scope.ts` (new), `src/collections/ContactSubmissions.ts`, `src/collections/Subscribers.ts`.
- Phase 02 owns: `src/collections/Customers.ts` (new), `src/components/admin/customers-list-view.tsx` (new), `src/payload.config.ts` (single-line addition), `scripts/db-setup.js` (3 migration entries + `customers` slug added to `COLLECTION_SLUGS[]`).
- Phase 03 owns: `plans/260429-1024-cms-customer-tracking/reports/smoke-*.md` only.

## Success criteria (measurable)

1. Tenant-owner login sees Customers row count = unique emails across own sites' submissions.
2. Tenant A cannot read Tenant B's customer rows (verified via direct REST call + admin UI).
3. Super-admin sees all customers, with optional site filter.
4. Tenant-owner can update ContactSubmission `status` (read+write), cannot edit other fields.
5. Page load <2s on test dataset (≥100 contacts + 100 subscribers).

## Open questions (do not block planning)

1. **Slug naming**: `customers` vs `site-customers`. Recommend `customers` for now; rename if F09 storefront-commerce introduces real "shop customers" entity (collision risk). Flag for PM.
2. **Super-admin per-tenant filter**: defer to phase-02 stretch. Implement as URL query param `?siteId=` honored by List view (low cost).
3. **Tenant-owner write scope on submissions**: Recommend allow `update` on `status` field only (mark replied/archived). Block updates on email/name/message/site/source/ipAddress via field-level access. Implemented in phase-01.
4. **TC-IDs**: No existing F24 TC-IDs. Phase-03 uses ad-hoc smoke; docs-manager phase will propose new `TC-F24-001..005` in `docs/qa/F24-customer-tracking.md` post-merge.
