# Phase 01 — Exporter rules A+B + diagnostics + tests

## Context
- `src/lib/migration/pw1-export/mappers/identity-site.ts:190-200` — `hasLifecycleConflict`; `:260` — `tenantStatus`, `:261` — `cod`
- `src/lib/migration/pw1-export/mappers/identity-lifecycle.ts` — `membership()` (treats missing `expired_at` as active → do not rely on it alone), `mainSubscription()` (`active` iff not immediate-cancel and `ends_at > asOf`)
- `src/lib/migration/pw1-json/diagnostics.ts:103-135` `approvedConflictWarning` (policy-flag gated); `:160` blocks any warning without approved policy; `:163` hash list includes current `SOURCE_DOMAIN_MAPPING_HASH`
- Outcome/summary message maps: `pw1-export/export-outcome.ts`, `pw1-json/export-outcome.ts`, `pw1-export/store-summary.ts`
- Test: `src/__tests__/unit/migration/pw1-identity.test.ts` (TC-F42-EXP-018 ~L163-190; fixture owner has no `expired_at`, main `ends_at` 2027-01-01)

## Overview
Priority high. Rule A: one lifecycle matrix branch. Rule B: slug for multi-default stores with binding (1329, 1327). No contract doc/hash change (see plan.md hard constraint).

## Requirements
- Rule exactly as plan.md; only under `gracefulTenantResolution`.
- Stale-expired → tenant `active`; COD follows source (`tenants[].payments.payment_cod`, `sites[].paymentConfig.enableCod`).
- Unchanged: strict mode; Store 2 + owner 2 expired + main ended → suspended; Store 2 + owner 1 with missing/past `expired_at` → conflict; main ended → conflict; owner banned → suspended/conflict as today; Store 0/3; staff ban.

## Implementation steps
1. `identity-site.ts`: compute `ownerMembership = membership(owner, ctx)` once (reuse at L260 to avoid duplicate diagnostics).
2. `staleExpired = graceful && store.status==='2' && owner.status==='1' && !owner.banned_at && Boolean(owner.expired_at) && Date.parse(sourceTime(owner.expired_at, ctx)) > Date.parse(ctx.config.asOf) && ownerMembership==='active' && subscription.doc.status==='active'` (extract a small named helper with a comment citing PW1 renew bug).
3. `hasLifecycleConflict = !staleExpired && (existing expr)`.
4. If `staleExpired`: `ctx.issue('TENANT_STALE_EXPIRED_STATUS','stores',ctx.storeId,'status','warning','OWNER_RENEWED_ACTIVE')`.
5. `tenantStatus = (hasLifecycleConflict || !(store.status==='1' || staleExpired) || ownerMembership!=='active') ? 'suspended' : 'active'`.
6. `diagnostics.ts` `approvedConflictWarning`: add `matches('gracefulTenantResolution','TENANT_STALE_EXPIRED_STATUS','stores','status','OWNER_RENEWED_ACTIVE')` next to `TENANT_LIFECYCLE_CONFLICT`. Add message entries to the 3 maps if typed exhaustive (typecheck tells).
7. Do NOT touch `master-version.ts`, `classification.ts` hash constants, or the mapping doc.
8. Tests (`pw1-identity.test.ts`), new `TC-F42-EXP-115` (TC-018 cases stay as-is):
   - graceful, Store 2 + owner 1 + `expired_at` 2027 + main active → `true`, tenant `active`, `payment_cod`/`enableCod` true, warning emitted once.
   - same but `expired_at` missing → unchanged (conflict, suspended).
   - `expired_at` ≤ asOf → suspended.
   - main `ends_at` ≤ asOf → conflict, suspended.
   - strict mode (no graceful) → still `false`/throws as today.
   - diagnostics: new warning → `APPROVED_POLICY` under graceful policy (import `disposition`/collector from source, no re-implementation).
### Rule B — slug from bound domain (#2179 item 7)
B1. `identity-site.ts:209-227`: extract the single-default slug block into a small helper `slugFromDefaultDomain(row, suffix, ctx, graceful)` (suffix check, strip, validate/reserved, `-store-<id>` / `store-<id>` fallback, `TENANT_SLUG_INVALID` warning) — no behavior change for single-default stores. Keeps file from growing (already 477 lines).
B2. `defaults.length !== 1`: strict → throw `DEFAULT_DOMAIN_AMBIGUOUS` as today. Graceful → `slug = slugFromDefaultDomain(selectedSiteDomain, …)` (row already validated as bound, live, `is_default=1`) + `ctx.issue('DEFAULT_DOMAIN_AMBIGUOUS','stores',ctx.storeId,undefined,'warning','SOURCE_DOMAIN_BINDING_APPLIED')`. Comment: contract 1.10.5 override, see addendum.
    Also emit slug provenance for the bound row: change `identity-site.ts:349` guard to `const slugRow = defaults.length === 1 ? defaults[0] : graceful ? selectedSiteDomain : undefined; if (slugRow) ctx.contribute('store_domains', slugRow, ['domain','is_default','deleted_at'], 'tenants[].slug', 'MASTER-3.1-DOMAIN')` (same fields/code as single-default).
B3. `diagnostics.ts:162` aggregate-store approval: accept `DEFAULT_DOMAIN_AMBIGUOUS` + `SOURCE_DOMAIN_BINDING_APPLIED` same as `PLATFORM_DOMAIN_FALLBACK` (graceful only). Add reason text to message maps if typed exhaustive. `classification.ts:142` remaps only `store_domains`-table aggregate warnings; new warning is emitted with table `stores` → no remap needed, but confirm with a classification test (→ `APPROVED_POLICY`, not report corruption).
    Keep every existing `PLATFORM_DOMAIN_FALLBACK` allowlist entry (`diagnostics.ts:132,162`, `classification.ts:142`): under graceful the `store-<id>` ambiguous branch becomes unreachable for new exports, but old artifacts (import 16/09, legacy hashes) still carry that reason and must keep verifying. Do not delete the branch's diagnostics support.
B4. Tests:
   - Update `TC-F42-EXP-108` (`pw1-identity.test.ts:539-560`): expected slug = subdomain of bound row 40, not `store-10`; still 2 aggregate warnings on `stores`, reason now `SOURCE_DOMAIN_BINDING_APPLIED`.
   - New `TC-F42-EXP-116`: graceful + 2 defaults (`x.<suffix>`, `x-2.<suffix>`) + binding → slug `x`; bound domain invalid/reserved → `x-store-<id>` fallback + `TENANT_SLUG_INVALID`; strict → throws `DEFAULT_DOMAIN_AMBIGUOUS`; single default unchanged; diagnostics → `APPROVED_POLICY`.
   - Grep other suites asserting `store-<id>` for multi-default stores (`pw1-json-v3-contract.test.ts:245`, clone rehearsal) and update only where they go through the graceful binding path.

9. Verify: `npm run typecheck`; `npx vitest run src/__tests__/unit/migration`; `npx vitest run src/__tests__/integration/pw1-reconciliation-artifact.test.ts` (proves doc hash untouched).
10. Local re-export (snapshot 281026, default asOf) and diff vs previous export.

## Todo
- [ ] rule + helper in identity-site.ts
- [ ] diagnostics allowlist (+ message maps if required)
- [ ] TC-F42-EXP-115 tests
- [ ] Rule B helper + graceful bound-domain slug + diagnostics reason
- [ ] slug contribution for bound row
- [ ] classification test for new reason; legacy `PLATFORM_DOMAIN_FALLBACK` allowlists kept
- [ ] TC-F42-EXP-108 updated, TC-F42-EXP-116 added
- [ ] typecheck + migration unit + reconciliation-artifact test green
- [ ] local re-export diff

## Success criteria
Tests green; re-export diff: only the 96 status=2 stores change (`tenants` status, payments.payment_cod + `sites` paymentConfig.enableCod), plus 1329 `tenants[].slug` `store-1329`→`de-lettuce-bear-berhad` and 1327 `store-1327`→`westwell-technology-malaysia-sdn-bhd`; no new blockers.

## Risks
- Delta writes full doc with edit guard → PW2-edited tenants hit `PW2_EDITED_CONFLICT` (handled in Phase 03).
- COD enabled for these stores — matches PW1 source; state in PR.

## Security
Reactivation grants login + checkout; rule requires owner active, unbanned, explicit unexpired date, main subscription active.
