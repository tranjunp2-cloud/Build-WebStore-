---
title: PW1 stale expired store status → active tenant + bound-domain slug
status: pending
created: 2026-11-02
revised: 2026-11-02 (post-review: contract hash, policy gate, explicit expiry, generated-site COD; + issue #2179 item 7 slug from bound domain)
issue: "#2179 (items 1-3, 7)"
branch: fix/F42-pw1-stale-expired-store-status (from staging)
---

# PW1 stale `stores.status=2` → active tenant; multi-default store slug from bound domain

Issue: #2179 — this plan covers items 1-3 (stale expired) and 7 (2-domain stores). Other items are separate PRs / data ops.

## Problem A — stale expired status
PW1 renew API (`prime-web-api UserController.php:496-500`) extends owner `expired_at` + main subscription but never resets `stores.status` → stays `2`. Exporter treats Store=2/owner=1 as `TENANT_LIFECYCLE_CONFLICT` (contract 2026-09-15) → tenant `suspended` (= ban on PW2: force logout, no checkout). 96/96 status=2 stores in CSV 281026: owner `status=1`, explicit `expired_at > asOf`, main subscription active. Dev: all 96 `suspended`; e.g. #2917 `luxurious-wedding` (tenant 3045).

Evidence: [reports/brainstorm-261102-1014-pw1-expired-store-status-mapping.md](reports/brainstorm-261102-1014-pw1-expired-store-status-mapping.md)

## Problem B — 2 default domains → slug `store-<id>`
Stores 1329, 1327 each have 2 live default+main domains (original + `-2`). Exporter: `defaults.length !== 1` → slug `store-<id>` (`DEFAULT_DOMAIN_AMBIGUOUS`/`PLATFORM_DOMAIN_FALLBACK`, `identity-site.ts:211-214`), even though profile `sourceDomainBindings` already picks the original domain for `sites[].domain` (1329→row 1182 `de-lettuce-bear-berhad`, 1327→row 1282 `westwell-technology-malaysia-sdn-bhd`). Contract 1.10.5 (master doc ~L2001) says binding does not change slug fallback → overridden by addendum. Decision (#2179): use the domain without the number = the bound domain.

## Rule A
Only when `migrationPolicy.gracefulTenantResolution === true` (all 3 profiles in `configs/migration/`). Strict mode unchanged (throws).

Store `status=2` AND owner `status=1` AND owner `banned_at` empty AND owner `expired_at` **present and > asOf** AND `membership(owner)==='active'` AND main subscription `active` at asOf → not a conflict: tenant `active`, warning `TENANT_STALE_EXPIRED_STATUS` (`stores`/`status`, reason `OWNER_RENEWED_ACTIVE`). Every other matrix row unchanged (incl. owner without `expired_at` → still conflict).

## Rule B
Only under `gracefulTenantResolution`. Store has ≠1 live default domain AND valid `sourceDomainBindings` row (already enforced before slug step) → slug derived from the bound row with the same suffix-strip + `validateSlugFormat`/`isReservedSlug` + fallback path as single-default stores. Warning `DEFAULT_DOMAIN_AMBIGUOUS` reason `SOURCE_DOMAIN_BINDING_APPLIED` (table `stores`, sourceId = StoreID, replaces `PLATFORM_DOMAIN_FALLBACK` for that store). Strict mode unchanged. `-2` domain not kept (platform-suffix hosts are never custom domains — unchanged).

## Hard constraint — do NOT edit `docs/migration/pw1-pw2-master-field-mapping.md`
Its sha256 = `MASTER_SHA256` = `SOURCE_DOMAIN_MAPPING_HASH` (pinned by `pw1-reconciliation-artifact.test.ts:77`; used as artifact `mappingHash`/`contractSha256` and in diagnostics/classification/credentials allowlists). Any byte change breaks import/delta. Rules documented in one addendum + decision log instead; contract bump = separate task.

## Phases
| # | Phase | Status |
|---|---|---|
| 01 | [Exporter rules A+B + diagnostics + tests](phase-01-exporter-stale-expired-rule.md) | pending |
| 02 | [Addendum doc + QA TC + decision log](phase-02-contract-docs-and-qa.md) | pending |
| 03 | [Dev rollout runbook: delta → COD patch → website](phase-03-dev-rollout-runbook.md) | pending |
| 04 | [CLI bật lại COD cho site đã dựng web (`migrate:pw1:site-cod`)](phase-04-generated-site-cod-repair-cli.md) | done (chờ review) |

## Decisions (confirmed 2026-11-02)
- Rule A approved — overrides 2026-09-15 row "Store=2, owner=1 → conflict".
- Rule B approved — overrides 1.10.5 "binding không thay đổi fallback slug"; slug = domain without number.
- No redirect for old `store-1329` / `store-1327` links: never shared with anyone (export schema forbids `previousSlugs`; a manual PATCH would make later deltas of these tenants hit `PW2_EDITED_CONFLICT`).
- Prod rollout: patch `paymentConfig.enableCod=true` for the 57 generated sites (same as dev, Phase 03 Step 4).
- Only open BA item in #2179: store 55 `mk` (<3 chars) — out of this plan.

## Dependencies
- Phase 03 needs Phase 01 + 04 merged + deployed to dev; env pointing to dev DB.
- Operator runbook (mọi lệnh của PR #2182): `docs/migration/pw1-stale-expired-rollout-runbook.md`.

## Out of scope (other #2179 items)
Checkout COD/QR block when suspended (#5, own PR); storefront block (#6, after this reaches prod); unpublish 38 banned sites (#4), 575 / 2650 / MIG-03 stores (#8-#10) — data ops; 55 `mk` (<3 chars) and 2330 (70 chars) — BA decision; website build for other ~1,505 pending stores; PW1 source fix; master contract version bump.
