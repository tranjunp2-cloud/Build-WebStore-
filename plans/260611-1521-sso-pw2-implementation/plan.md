---
title: "SSO-PW2 Integration — PW2 Implementation"
description: "Implement toàn bộ PW2-side của SSO↔PW2 integration: schema, endpoints, provision fix, ETL, back button"
status: pending
priority: P0
effort: 10.5h
branch: feat/{issue}-sso-pw2-implementation
tags: [sso, pw2, integration, subscription, schema]
created: 2026-06-11
source: docs/sso-pw2-integration (PR #1159)
blockedBy:
  - F34 (#1187) must merge before Phase 3 and Phase 4
---

# SSO-PW2 Integration — PW2 Implementation Plan

## Context

- **Source docs:** PR #1159 (`docs/sso-pw2-integration` branch) — 2 PRDs + 8 plan dirs
- **Dependency:** PR #1187 (F34-06 subscription enforcement) — cung cấp PlanSubscriptions collection, `upsertPlanSubscription()`, `getPlanCode()`, `mapPlanCodeToTier()`, upgrade/downgrade routes, session-check route
- **Scope:** PW2-side only. SSO-side (Items 1–3 SSO service methods + jobs, Item 7 SSO dashboard redirect) nằm repo `sso-api/main` — ngoài scope plan này.
- **Blocked:** Luồng A (`/post-sso-landing`, FR-22) — blocked pending TM team confirm `SSO_SHARED_SECRET` JWT signing. Không implement trong sprint này.

## Phase Table

| # | Phase | Effort | Dependency | Status |
|---|-------|--------|------------|--------|
| 01 | [Foundation Schema](./phase-01-foundation-schema.md) | 1h | None | pending |
| 02 | [Simple Endpoints](./phase-02-simple-endpoints.md) | 2h | Phase 01 | pending |
| 03 | [Provision Fix + Session-Check](./phase-03-provision-fix.md) | 4h | Phase 01 + F34 merged | pending |
| 04 | [Subscription Endpoints + ETL Corrections](./phase-04-subscription-endpoints.md) | 2.5h | F34 merged | pending |
| 05 | [Back Button (SsoPortalLink)](./phase-05-back-button.md) | 1h | None | pending |
| 06 | [Audit Trail (createdBy / updatedBy)](./phase-06-audit-trail.md) | 0.5h | Phase 01 | done |

## Implement Order

```
Phase 01 (Foundation Schema)
    ├── Phase 02 (Simple Endpoints) — starts after Phase 01
    └── After F34 merges:
        ├── Phase 03 (Provision Fix) — requires Phase 01 + F34
        └── Phase 04 (Subscription Endpoints) — requires F34 only

Phase 05 (Back Button) — independent, can start anytime
```

## New Files (PW2 side)

| File | Phase |
|------|-------|
| `src/app/api/v1/sso/ban-user/route.ts` | 02 |
| `src/app/api/v1/sso/unban-user/route.ts` | 02 |
| `src/app/api/v1/sso/change-email/route.ts` | 02 |
| `src/app/api/v1/sso/check-email/route.ts` | 02 |
| `src/app/api/v1/sso/renew/route.ts` | 04 |
| `src/components/sso-portal-link.tsx` | 05 |

## Modified Files (PW2 side)

| File | Phase | Change |
|------|-------|--------|
| `src/collections/Users.ts` | 01, 06 | Add `migrationStatus` + `customerIdNumber`; Add `createdBy` + `updatedBy` + hook |
| `src/collections/Tenants.ts` | 01 | Add `migrationStatus` |
| `scripts/db-setup.js` | 01, 06 | Add migration entries (migrationStatus, customerIdNumber, createdBy, updatedBy) |
| `src/app/api/auth/session-check/route.ts` | 02 | Add suspended tenant check |
| `src/app/api/v1/sso/provision/route.ts` | 03 | Composite key + PlanSubscription bridge |
| `src/app/api/v1/sso/upgrade/route.ts` | 04 | Fix auth 3-guard pattern |
| `src/app/api/v1/sso/downgrade/route.ts` | 04 | Fix auth 3-guard pattern |
| `scripts/migrate-pw1-subscriptions.js` | 04 | ETL: derivePackCode() + deleted_at filter |
| `.env.staging.example` | 05 | Add `NEXT_PUBLIC_SSO_PORTAL_URL` |
| `.env.production.example` | 05 | Add `NEXT_PUBLIC_SSO_PORTAL_URL` |
| `src/app/(dashboard)/layout.tsx` (or header) | 05 | Integrate SsoPortalLink |

## Source Plans (PR #1159)

| Source Plan | Maps to Phase |
|-------------|---------------|
| `plans/260604-1103-sso-pw2-foundation/phase-03,04,05` | Phase 01 + 03 |
| `plans/260604-1103-sync-ban-user/phase-03,04` | Phase 02 |
| `plans/260604-1103-sync-unban-user/phase-03` | Phase 02 |
| `plans/260604-1103-sync-change-email/phase-03` | Phase 02 |
| `plans/260604-1103-check-email-exists/phase-02` | Phase 02 |
| `plans/260604-1103-sync-subscription/phase-04,05` | Phase 04 |
| `plans/260604-1103-pw2-sso-back-button/phase-01,02` | Phase 05 |

## Key Constraints

- URL paths: `/v1/sso/...` (không phải `/api/v1/...`) — base URL đã có `/api`
- Auth pattern: 3-guard (Bearer check → `getCurrentUser()` null check → roles check)
- All endpoints: `super-admin` role required
- Schema changes: phải có entry trong `scripts/db-setup.js` MIGRATIONS array — CI hard-gate
- Fire-and-forget: Ban endpoint — SSO không retry. Change-email + Unban: SSO có retry (JobBase) → phải idempotent
- `upsertPlanSubscription()` hardcodes `name='main'` — không pass `name` vào data arg
- `Tenants.plan` phải sync sau `upsertPlanSubscription()` bằng `mapPlanCodeToTier()` riêng
- Date format: SSO gửi MySQL format (`YYYY-MM-DD HH:MM:SS`) — normalize `.replace(' ', 'T')` trước khi parse
- `endsAt` dùng `T23:59:59Z` (UTC suffix) để tránh UTC+7 offset làm sai ngày

## Out of Scope (sprint này)

- Luồng A (`/post-sso-landing`) — blocked, pending TM team confirm `SSO_SHARED_SECRET`
- SSO-side: service methods + jobs (Items 1–3, 5), SSO dashboard redirect (Item 7) — repo khác
- `Tenants.limits` group — replaced by `PlanFeatures.canUse()` per ADR-01
- `subscriptionHistory` — non-goal sprint này
- Reconciliation cron — nice-to-have

## PRD References

- `docs/prd/sso-primeweb-v2-integration.md` — 9 operations, FR-01–FR-24, AC
- `docs/prd/pw2-sso-subscription-endpoints.md` — renew endpoint, provision enhancements, ADR-01

---

## Validation Summary

**Validated:** 2026-06-11
**Questions asked:** 4

### Confirmed Decisions

- **Branch:** 1 branch duy nhất `feat/{issue}-sso-pw2-implementation` — implement 01+02+05 trước, 03+04 sau khi F34 merge, 1 PR tổng
- **Session-check:** Tách khỏi Phase 02 → chuyển vào Phase 03 (cả hai cùng chờ F34 merge)
- **QA doc:** Tạo `docs/qa/F-SSO-PW2.md` trước khi viết tests (TC-IDs required by testing.md)
- **ETL scope:** Phase 04c tạo toàn bộ `scripts/migrate-pw1-subscriptions.js` (không chỉ patch corrections)

### Action Items

- [ ] **Trước implementation:** Tạo `docs/qa/F-SSO-PW2.md` với TC-IDs map từ AC-01–AC-20+ của PRD
- [ ] **phase-02:** Xoá phần "2e — Update session-check" — chuyển sang Phase 03
- [ ] **phase-03:** Thêm phần session-check update (append suspended check sau khi F34 creates file)
- [ ] **phase-04c:** Mở rộng scope: tạo TOÀN BỘ `scripts/migrate-pw1-subscriptions.js` (không chỉ corrections) — bao gồm PW1→PW2 data migration logic + 2 corrections từ PRD FR-03/FR-04
