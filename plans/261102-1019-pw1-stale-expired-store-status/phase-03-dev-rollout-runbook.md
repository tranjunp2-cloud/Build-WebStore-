# Phase 03 — Dev rollout runbook: delta → website → COD repair

Operator commands: `docs/migration/pw1-stale-expired-rollout-runbook.md` (canonical). This phase = plan-level facts + todo.

Pre: Phase 01 merged + deployed to dev; shell env points to **dev DB**; `NEXT_PUBLIC_SERVER_URL` = dev app. Credentials from team vault — never commit.

## Key facts
- Delta change detection = checksum of mapped output (`pw1-json/projection.ts:109`) → mapper change yields CHANGED → UPDATE.
- Update = full-doc write with edit guard: live doc must equal last import/delta projection, else `PW2_EDITED_CONFLICT` (`delta-writer.ts:78-82`).
- Sites of stores with a generated website are never written: `SITE_WEBSITE_GENERATED` (`delta-apply.ts:70`); store then counted in `failedStores` (expected, it already has a website).
- Checkout COD requires BOTH `tenant.payments.payment_cod === true` AND `site.paymentConfig.enableCod !== false` (`api/orders/checkout/route.ts:91`; storefront `site-by-slug/route.ts:91`).
- Groups (from CSV 281026 vs dev 2026-11-02):
  - **39 pending** (no website): tenant + site written; site `enableCod` flips → in `website-input.json`; all 39 have COD.
  - **57 generated** (website published): tenant written (status active, `payment_cod` true); site blocked → `enableCod` stays `false` (e.g. store 1329: tenant 1457, site 1849 published, enableCod=false) → COD hidden at checkout while seller's Payment Settings shows COD on. All 57 have COD → needs Step 4 patch.
- Rule B: 1329 (in the 96) and 1327 (banned → tenant stays suspended) get tenant slug change only; `sites` has no slug field (site `domain` already = bound PW1 domain) → no site write needed. Storefront resolves by `tenants.slug` → new link works right after delta (tenant cache tag busted on write).
- Profile: delta must use default `configs/migration/pw1-prod-profile.json` (has `sourceDomainBindings` 1327→1282, 1329→1182). Never pass `pw1-dev-profile.json` — it has no bindings → 1329/1327 still throw `SOURCE_SITE_DOMAIN_SELECTION_REQUIRED`.
- Storefront tenant cache (`getCachedTenantBySlug`, TTL 300s): CLI write may not bust the tag → wait ≥5 min before judging status/slug verification as failed.
- Mass-change gate is computed on ALL store changes before the `--store` filter (`scripts/pw1-delta.ts:139-140`) → a `--store` rehearsal can trip `MASS_CHANGE_BLOCKED` because of other stores. If it trips, inspect the filtered report for the target stores only; use `--allow-mass-change` only when those stores' diff is as expected.
- Delta applies ALL changes of the target stores since their last import/delta projection, not only status/COD/slug. Before Step 1 check dev's latest delta baseline: if CSV 281026 was not applied yet for these stores, expect other source changes (products, pages…) in the report too — review them, don't treat as failure.
- Website step requires owner membership `active` + site `draft` (`pw1-destination.ts:33-34`).

## Steps
1. Rehearsal 2917 (pending group):
   `npm run migrate:pw1:delta -- --new /home/liam/Documents/DB_PROD_281026_clean --store 2917`
   Report: tenant 3045 suspended→active, payments.payment_cod true; site 3437 enableCod true; other diffs only if baseline is older than 281026 (see Key facts); no conflict. Confirm. Log: `Website input: 1 stores → <run>/website-input.json`.
2. Website 2917: `npm run migrate:pw1:website -- <run>/website-input.json --store 2917 --dry-run` → real run → `status --store 2917` / `logs --store 2917`.
3. Rehearsal 1 generated store (1329): delta `--store 1329` → expect tenant written (status active + slug `de-lettuce-bear-berhad`), site `SITE_WEBSITE_GENERATED` conflict. Before running, confirm slug free on dev (tenants `slug`/`previousSlugs.slug`). Prod already checked 2026-11-02: `site-by-slug` 404 + `/api/slug/redirect` `redirect:false` for `de-lettuce-bear-berhad`, `westwell-technology-malaysia-sdn-bhd`, `de-lettuce-bear-berhad-2` — re-check right before prod rollout. Verify `https://de-lettuce-bear-berhad.<suffix>/` 200 after. Then Step 4 for site 1849 only; verify checkout offers COD.
4. COD for generated sites: `npm run migrate:pw1:site-cod -- --store <ids>` (dry-run) → `--apply` (Phase 04). Replaces the manual GET/PATCH; no site ids or admin credentials needed. Report under `.migration/delta-runs/site-cod-*/`.
5. Full set: delta `--store <96 ids>,1327` (add `--allow-mass-change` only if gate trips and diff = exactly these tenants/sites) → website with produced file (dev: input ~39, only 2917 generates — the other 57 page-having stores are already generated; 38 skip "no active pages") → Step 4 for 57 generated.
6. Conflicts: any `PW2_EDITED_CONFLICT` on tenants → list ids, inspect what PW2 changed, decide manually (do not force).
7. Verify on dev: 96 tenants `active`; 1329/1327 slugs = bound domains, old `store-<id>` links 404 (no redirect — confirmed, links never shared); 2917 storefront renders pages (count per generator mapping, not raw PW1 9); owner login OK; COD visible at checkout for a sample from each group.
8. Record evidence in `docs/qa/F42-pw1-master-json-export.md` MANUAL TC-F42-DELTA-xx.

## Todo
- [ ] 2917 delta + website + verify
- [ ] 1329 delta (status + slug) + COD patch + verify
- [ ] 1327 slug via full-set delta
- [ ] 96-store delta (39 sites written), 1 website (2917), ~51 COD patches (6 already on → 57 sites COD on)
- [ ] conflicts triaged
- [ ] QA evidence recorded

## Success
96 tenants active; 1329/1327 slugs fixed; 1 website generated (2917; 38 stores have no published page); 57 sites `enableCod=true`; COD works at checkout; no unexplained conflicts.

## Prod rollout
Same Steps 1-7 on prod after dev sign-off, incl. Step 4 COD patch for the 57 generated sites (confirmed 2026-11-02). Re-check slug availability before delta.

## Risks
- Mass-change/parity gate → inspect report, never blanket `--allow-mass-change`.
- Design token cost: dev/prod only 1 generation (2917) → negligible.
- Rollback: keep run dir; re-suspend via delta with old exporter or manual patch.
