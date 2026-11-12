# Code review — F42 PW1 stale-expired Store status (Rule A) + bound-domain slug (Rule B)

Scope: identity-site.ts, tenant-slug-from-domain.ts (new), diagnostics.ts, pw1-identity.test.ts, addendum doc, QA rows, PD-026. Read-only review.
Verification: `npx vitest run src/__tests__/unit/migration + pw1-reconciliation-artifact + pw1-master-export-cli` → 132 files / 1863 tests passed. `npm run typecheck` → clean. Master doc sha256 = a5f311ee… = MASTER_SHA256 = SOURCE_DOMAIN_MAPPING_HASH (untouched). master-version.ts untouched.

## Verdict
No critical or high-severity defects found. Rule A and Rule B match the spec. The refactor does not change behavior.

## Critical
None.

## High
None.

## Medium
1. **Rule B can now block a Store that used to export (bound row off-suffix).** tenant-slug-from-domain.ts:32 throws `DEFAULT_DOMAIN_SUFFIX_MISMATCH` even under graceful. Before this change, a graceful multi-default + binding Store always got `store-<id>` with no suffix check. Now, if the bound `is_default=1` row is not `*.<sourcePlatformSuffix>` (for example a custom domain flagged default, or a profile with a different suffix), the whole Store becomes a blocker.
   - Today's PROD bindings (1327→1282, 1329→1182) are platform domains, so this does not happen now. The addendum still says "Strict mode unchanged" without mentioning this new graceful failure path.
   - Fix (pick one): (a) in the multi-default branch, catch the mismatch and fall back to `store-<id>` with the legacy `PLATFORM_DOMAIN_FALLBACK` reason, or (b) document it in the addendum and add a TC-F42-EXP-116 case that asserts the blocker.
2. **Plan B3 classification test is missing.** No `prepare()`/`loadImportArtifact` test checks that a `stores`-table `DEFAULT_DOMAIN_AMBIGUOUS`/`SOURCE_DOMAIN_BINDING_APPLIED` diagnostic is not reported as `SOURCE_CLASSIFICATION_INVALID`. The only such test (pw1-json-v3-contract.test.ts:245) uses the legacy `store_domains`/`PLATFORM_DOMAIN_FALLBACK` shape.
   - By reading the code it looks fine: classification.ts:142 only remaps `store_domains`, and `stores` + `sourceId=storeId` resolves to the Store row, which is the same shape as TENANT_LIFECYCLE_CONFLICT.
   - Still, the plan TODO explicitly asks for this test. Add an `it.each` row for the new reason with `table:'stores'`. The same gap applies to `TENANT_STALE_EXPIRED_STATUS`.
3. **Behavior changed under an unchanged contract hash.** Artifacts carrying `contractSha256=a5f311ee…` now mean different things depending on the exporter build: 96 tenants are `active` with COD on, and Stores 1327/1329 get new slugs. The addendum and PD-026 accept and record this. The remaining risk is that someone compares or validates old and new artifacts by hash alone. Make sure the delta run uses a fresh export, and record the exporter commit SHA in the TC-F42-DELTA-11 evidence.

## Low
4. **Rule A path has no direct test for `owner.status !== '1'`.** The spec focus calls this out. The code guards it (identity-site.ts:161), and the "owner banned" case covers `banned_at`. Add one case: Store 2 + owner 2 + future `expired_at` + active main → conflict, suspended, no TENANT_STALE_EXPIRED_STATUS.
5. **Rule B has no test for a bound row with an invalid hostname.** In graceful mode this gives SOURCE_SITE_DOMAIN_FORMAT_PRESERVED plus slug `store-<id>` silently: no TENANT_SLUG_INVALID, and the slug contribution still credits the bound row. This matches the existing single-default behavior, so it is not a regression.
6. **Diagnostics order and duplicates on blocked Stores.** `membership(owner)` moved from tenantStatus computation up to identity-site.ts:200, before the domain checks. It was already called inside `userDoc(owner)` at line 126, so strict-mode throw order is unchanged and every Store still gets 2 calls, as before.
   - Only difference: in graceful mode, a Store that later throws on a domain error now records a second `USER_LIFECYCLE_CONFLICT` warning (the issue list has no dedupe, and issues persist on blocked Stores). This is cosmetic.
   - Also, inside `isStaleExpired`, `ownerMembership === 'active'` is implied by the earlier checks (status 1, no ban, expiry > asOf), so it is redundant but harmless.
7. **Orphaned JSDoc.** identity-site.ts:147 — "Creates Store identity atomically…" now sits above `isStaleExpired`'s doc block instead of `mapIdentity`. Move it down to `mapIdentity`.
8. **`slugRow` has a dead branch.** In identity-site.ts:352, `graceful ? selectedSiteDomain : undefined`: non-graceful multi-default already threw at :226, so it reduces to `defaults.length === 1 ? defaults[0] : selectedSiteDomain`. Optional simplification.
9. **TC-F42-EXP-116 "single-default unchanged" is a weak assertion** (slug only). Existing suites cover the single-default slug paths (they pass), so this is acceptable.

## Correctness checks (pass)
- **Rule A gating:** requires graceful, store `'2'`, owner `'1'`, no `banned_at`, and `expired_at` present. `sourceTime()` applies the same timezone and offset as `membership()`, and the comparison is strict `>` against `Date.parse(asOf)`. The equality case is tested.
- **Other matrix rows unchanged:** the subscription must be `'active'`, so ended or immediate-canceled stays a conflict. The strict path is untouched. Store 0/3 is never stale because `store.status !== '2'`. Staff `userDoc` is untouched.
- **tenantStatus:** `!(store.status==='1' || staleExpired)` is correct. COD follows `tenantStatus`.
- **Refactor:** the `slugFromDefaultDomain` body is a byte-for-byte move of the old single-default block: suffix-mismatch throw, DOMAIN_INVALID strict throw, fallback chain, and the TENANT_SLUG_INVALID row id (`row.id` = `defaults[0].id`). `hostname` was private before, so identity-site is its only importer and it now imports it correctly.
- **diagnostics.ts:**
  - TENANT_STALE_EXPIRED_STATUS is added next to TENANT_LIFECYCLE_CONFLICT. Both are gated on `gracefulTenantResolution` with the same hash list.
  - SOURCE_DOMAIN_BINDING_APPLIED is added to the `stores`-aggregate fast path. Its 5-hash list includes the current hash.
  - Legacy `PLATFORM_DOMAIN_FALLBACK` entries are kept, both the `store_domains` entry and the `stores` one.
  - `reviewCategory` puts both new warnings in `warning`. Missing reason-text entries fall back to generic text, so they do not break anything.
- **Downstream:**
  - The delta updates tenants generically through `updateDocument`, so the PW2_EDITED_CONFLICT projection guard applies.
  - The Tenants beforeChange hook validates format and reserved names only and does not write previousSlugs, which matches the addendum's "no redirect".
  - website-input does not derive anything from the tenant slug.
  - The importer and exporter have no cross-tenant slug uniqueness preflight. That gap existed before, but it now matters for the 2 renamed slugs (see the rollout notes).

## Rollout notes (Phase 03)
- Before applying the delta, confirm on the target that `de-lettuce-bear-berhad` and `westwell-technology-malaysia-sdn-bhd` are not used as any tenant's `slug` or `previousSlugs.slug`. Otherwise the unique index fails mid-delta, or the slug clashes with an existing 301.
- Tenants and sites among the 96 that were reactivated or edited by hand in PW2 will surface as PW2_EDITED_CONFLICT or SITE_WEBSITE_GENERATED. Expect them and record them as evidence; do not force them.
- The plan item "local re-export diff" is still open. The expected diff is: the 96 Stores (status + COD), and the 2 slugs.

## Docs
- The addendum matches the code apart from the item 1 omission. QA rows for 115/116/108 are accurate, and DELTA-11 is correctly left unchecked. PD-026 is complete.
- The plan phase checkboxes are all still unchecked; the review did not update them.

**Status:** DONE_WITH_CONCERNS
**Summary:** Rule A and Rule B are correct and match the spec. The refactor does not change behavior, the allowlist is consistent, and tests and typecheck pass. There are no blockers.
**Concerns/Blockers:** (1) Rule B adds a new graceful blocker when the bound row is off-suffix; it is undocumented and untested. (2) The plan B3 classification test for the `stores`-table new reasons is missing. (3) Check that the renamed slugs are free on the target before the delta.
