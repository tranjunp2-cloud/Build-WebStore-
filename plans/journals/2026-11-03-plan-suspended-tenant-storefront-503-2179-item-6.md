---
title: "Plan: suspended tenant storefront 503 (#2179 item 6)"
date: 2026-11-03
summary: Planned 503 unavailable page + public API block for suspended tenants
---

# Plan: suspended tenant storefront 503 (#2179 item 6)

## What happened
Planned #2179 item 6 on branch fix/F09-suspended-tenant-storefront-503 (from origin/staging 4d06ca56d).
Plan: plans/261103-1520-2179-suspended-tenant-storefront-503/.
Scout findings:
- The existing 503 maintenance response comes from the middleware: `/api/slug/redirect` → `buildMaintenanceHtml`.
- Custom domains have no 503 at all.
- `MaintenancePage` returns 200.
- Public `/api/storefront/*` routes do not check tenant status.

## Decision
- Rollout is gated by merge order, not an env flag: merge to staging after the dev rollout of #2182, and promote to main after the prod rollout.
- The 503 copy follows the site's primary language (ms → BM, anything else → EN).
- Public APIs are blocked in the same PR.
- Only `status === 'suspended'` is blocked.

## Next steps
Run /ak:cook on the plan (phases 01 → 02/03 → 04). The TC IDs start at TC-F09.277.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Update (same day)
- Scope widened: a store is unavailable when the tenant is suspended **or** its latest main subscription is no longer active (PW2 does not suspend on expiry).
- Rule C (exporter change) dropped: the prod delta already ran and will not rerun. The 5 affected stores are fixed by hand after #6 ships (PD-027, `docs/migration/pw1-expired-owner-manual-reactivation-2179.md`).
