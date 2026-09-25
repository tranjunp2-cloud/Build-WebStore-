# F42 — PW1 local JSON importer (#1886)

Status: test design only, 2026-09-16. AUTO marks planned automation, not a passing result or QA signoff. Scope: existing local DB clone, selected non-Page data, no live cutover. Requirements trace to [approved technical contract](../../plans/260916-1617-pw1-local-json-import/technical-contract.md) and [acceptance runbook](../../plans/260916-1617-pw1-local-json-import/acceptance-runbook.md); requirement labels below are descriptive, not invented issue AC numbers.

Read docs/TEST_CONVENTION.md before implementing. Import actual source, use AAA and TC-ID names. Pure helpers use Vitest; CLI cases use real subprocesses. DB cases remain manual until separately automated and evidenced. No test below has been executed.

## Planned automated cases

| TC-ID | Mode | Requirement | Scenario and expected result |
|---|---|---|---|
| TC-F42-IMP-001 | [x] AUTO | Store selection | One/list/inclusive range/all; numeric sorting and dedupe; IDs remain strings without precision loss; malformed, conflicting or missing selector rejects. |
| TC-F42-IMP-002 | [x] AUTO | Batch resume | json: batch identity; invalid child ID and conflicting flags rejected; resume cursor cannot skip earliest unfinished Store. |
| TC-F42-IMP-003 | [x] AUTO | Export handoff | Missing publication manifest, wrong hash/version/schema, inconsistent partitions or global unknown blocker rejects before writes; importReady=false alone is not corruption. |
| TC-F42-IMP-004 | [x] AUTO | Scope dispositions | Pages excluded; raw removed only from write projection and retained in artifact; verified-empty, quarantined and source-unverified remain distinct; unknown required nonempty collection blocks. |
| TC-F42-IMP-005 | [x] AUTO | Strict resource-bound reader | Invalid UTF8/grammar/duplicate keys/symlink/input drift rejected; selected Store extraction discards unselected array items; no full-file UTF8 parse. |
| TC-F42-IMP-006 | [x] AUTO | Target guard | Nonlocal/unexpected database/schema rejected, including misleading hostname or database names; errors omit URI credentials. |
| TC-F42-IMP-007 | [x] AUTO | Exact mapped values | Zero stock survives; null is not zero; nonzero minor-unit discount not converted twice; fractional quantities/nonfinite/unsafe magnitudes rejected; ISO instants preserved. |
| TC-F42-IMP-008 | [x] AUTO | Identity and relations | Resolve typed relationship fields and Lexical upload values only; raw/text @ strings untouched; absent/cross-tenant/required unresolved references reject. |
| TC-F42-IMP-009 | [x] AUTO | Stable nested records | Existing valid variant IDs preserved; missing child IDs deterministically derived within pinned snapshot; duplicate IDs rejected; projection/checksum deterministic. |
| TC-F42-IMP-010 | [x] AUTO | Conflict policy | Source claim vs target natural-key collision distinguished; tenant Product slug contract/global target uniqueness conflict reported; no suffix, merge or UPDATE fallback. |
| TC-F42-IMP-011 | [x] AUTO | Binding and credentials | Snapshot/code/schema/target drift rejects; credential metadata authenticated; wrong source/User/key rejects; no plaintext/ciphertext/PII canary in CLI stdout/stderr/report. |
| TC-F42-IMP-012 | [x] AUTO | Real CLI | Help/invalid flags/prepare validation/dry-run subprocess exits and sanitized parseable reports; no application writes on invalid preflight. |

AUTO helper assertions do not certify actual DB atomicity, concurrency, credential round-trip or bounded peak memory of production-size artifacts. Record executed command, fixture size, code revision and result before assigning evidence.

## Manual real-DB evidence

All cases: [ ] MANUAL, NOT_RUN. Never restore into the existing source target, never terminate its sessions, and never emit row values or auth internals. Use a unique isolated clone without app/cron/outbound connectivity.

| TC-ID | Runbook evidence | Expected invariant |
|---|---|---|
| TC-F42-IMP-DB-01 | MAN-LOCAL-01 | Dry-run selection and wrong target: zero DB/DDL writes. |
| TC-F42-IMP-DB-02 | MAN-LOCAL-02 | Actual approved master selected scope writes correct projections/refs; outside scope and Pages unchanged. |
| TC-F42-IMP-DB-03 | MAN-LOCAL-03 | Same/new run replay: zero duplicated parent/child rows, original claim owner retained. |
| TC-F42-IMP-DB-04 | MAN-LOCAL-04 | Kill/resume: committed entities reused, unfinished Store not complete. |
| TC-F42-IMP-DB-05 | MAN-LOCAL-05 | Lost COMMIT acknowledgement reconciled from ledger/target without blind retry. |
| TC-F42-IMP-DB-06 | MAN-LOCAL-06 | Concurrent and stale fenced writer cannot commit/finalize. |
| TC-F42-IMP-DB-07 | MAN-LOCAL-07 | Ledger failure rolls back entity and children atomically. |
| TC-F42-IMP-DB-08 | MAN-LOCAL-08 | Snapshot/code/schema/target drift blocks without overwrite. |
| TC-F42-IMP-DB-09 | MAN-LOCAL-09 | Correct/wrong/missing synthetic credential; existing global User secrets/memberships unchanged. |
| TC-F42-IMP-DB-10 | MAN-LOCAL-10 | External Media S3-enabled read/populate preserves URL, filename NULL, zero upload. |
| TC-F42-IMP-DB-11 | MAN-LOCAL-11 | Zero stock/nonzero discount/money limits and missing child IDs preserve values; no historical side effects. |
| TC-F42-IMP-DB-12 | MAN-LOCAL-12 | Background expiry/provider predicates isolated; unfinished pass2 refs cannot verify. |
| TC-F42-IMP-DB-13 | MAN-LOCAL-13 | Batch boundary resume survives missing report and continues next selected Store. |
| TC-F42-IMP-DB-14 | MAN-LOCAL-14 | Legacy rollback cannot delete rows consumed by JSON batches. |
| TC-F42-IMP-DB-15 | MAN-LOCAL-15 | Changed writer requires blocked old run and new disposable-baseline rehearsal, not rewritten ledger. |
| TC-F42-IMP-DB-16 | MAN-LOCAL-16 | Missing-source-history replay uses recorded provenance, not new run timestamp. |

Evidence states: PASS / FAIL / NOT_RUN / BLOCKED separately. Synthetic fixtures cannot mark DB-02 complete; local success is not live readiness. Integration evidence must include sanitized target identity, baseline counts/schema fingerprint, run binding and outside-scope comparison.

## Helper evidence — 2026-09-16

Executed `npm test -- src/__tests__/unit/migration/pw1-json-selectors-runtime.test.ts src/__tests__/unit/migration/pw1-json-artifact-credentials.test.ts src/__tests__/unit/migration/pw1-json-projection.test.ts`: **33 tests passed / 3 files**. Synthetic artifacts only; filesystem fixtures removed by test cleanup. Evidence covers subsets of IMP-001,003,004,005,006,007,008,009,011. Partition inconsistency test initially failed, then passed after source fix.

Covered: large-ID numeric sorting, sparse inclusive ranges, invalid selectors, local clone guard and symbol capability, bound SQL values, selected Store spool/hash/private mode, Page diagnostic exclusion versus global blockers, inconsistent source partition, file hash/size/symlink/duplicate keys, credential AEAD wrong key/metadata, zero stock, integer/calendar validation, stable child IDs, typed references versus text, optional hasMany deferral, projection child identity and legacy namespace.

Not covered by this command: real CLI IMP-012, batch resume IMP-002, production-sized peak memory, all conflict cases IMP-010, DB transactional/concurrency/outbound/authentication assertions. All DB-01..16 remain NOT_RUN in this document. Initial typecheck reported one runtime logger configuration error (runtime.ts); this is a source diagnostic, not a test failure. Repeat typecheck after its fix before completion.

## Final targeted verification — 2026-09-16

Latest targeted command covers the four `pw1-json-*.test.ts` files plus existing `category-row-lock`, `category-delete-breadcrumbs` and `tenant-product-isolation`: **63 tests / 7 files passed** (49 importer tests,14 existing regressions). `npm run typecheck` passed. Logs: `/tmp/pw1-import-final-tests.log`, `/tmp/pw1-import-tester-typecheck.log`. This supersedes the initial runtime logger type error above. Additional regressions cover actual Payload `createLocalReq` preserving the private capability through repeated normalization, forged string-only context rejected, SQL array binding remaining one parameter, parsed manifest byte hash, Category parent-first dependency and cross-Store source identity collision.

Manually invoked integration harness: [pw1-json-clone-rehearsal.ts](../../src/__tests__/integration/pw1-json-clone-rehearsal.ts). Explicit clone-only invocation:

```bash
PW1_TEST_INTERRUPT=1 PW1_TEST_TWO=1 PW1_TEST_FULL=1 \
PW1_TEST_DATABASE=pw1_import_1886_20260916095934 \
node --import tsx --require ./scripts/seed-preload.cjs \
src/__tests__/integration/pw1-json-clone-rehearsal.ts
```

Synthetic artifact/evidence directory `/tmp/pw1-cli-rehearsal-1789555092780`; logs private0600. Batch `json:efcccb72-ae39-44ad-bae5-a5590b4a35d8`. Tests never used production credentials or changed the source DB. Test keys existed only in process environment; encrypted test sidecar is not a reusable operator credential artifact without those keys.

Observed:

- Dry-run selects two Stores/17 entities, exit0, before/after tracked counts unchanged.
- First Store writes all15 supported collections. Site SEO Media forward reference exercises deferred creation and pass2 update. SIGINT after first Store VERIFIED produces exit4/INTERRUPTED.
- Resume same batch finishes second Store's Tenant/Site, exit0. New batch reuses17 entities with zero creates, exit0.
- Independent SQL checks confirm15 source claims for first Store; Payload PBKDF hash matches synthetic recovered password, SSO ciphertext decrypts to same synthetic password without logging either; Order major subtotal10/discount100minor/total9; completed+unpaid COD status preserved; Product inventory0; canonical Customer name unchanged; Media URL/sourceUrl match and filename NULL.
- Intentional edit of synthetic Tenant name causes subsequent dry-run exit3/TARGET_PROJECTION_CONFLICT, without silently overwriting target.
- Counts for final run: tenants1223→1225, sites1213→1215, Pages436 unchanged; migration_runs1218→1222 (two Stores across two batches). Earlier unsuccessful rehearsal namespaces remain on disposable clone as evidence, not cleaned from ledger.

Evidence maps to **subsets** of DB-01,03,04,08,09,10,11,13,16. DB-02 actual master remains NOT_RUN. This does not certify hard kill during an entity, real network COMMIT loss, every existing-user conflict, Media public accessibility/tenant isolation, complete outside-scope field checksums or background provider/expiry behavior. DB-04 here is controlled SIGINT at Store boundary; DB-13 missing-report deletion was not separately injected. Other DB cases retain their previous state until linked independent evidence is recorded. No live readiness or complete16-case acceptance is claimed.


## Selected master dependency scope correction — 2026-09-17

TC-F42-IMP-004/008 [x] AUTO: source orphan diagnostics stay in the audit but do not block a selected Store when the verified report proves the parent is absent, neither the source row nor parent occurs in the selected master's references/reachable creator ancestry, and the source row contributes to no selected Store. A table-level summary is excluded only when all its unresolved rows satisfy this proof. Referenced missing Users, selected report contributions, mixed summaries, unknown diagnostics and structural corruption remain blocking. Explicit Store selection does not inherit dependencies from other Stores; `--all` includes every emitted Store.

Executed seven relevant test files: **132 tests PASS**; `npm run typecheck` PASS. The v3 fixture suite has55cases, including nine new dependency-scope cases. Historical broader test counts above refer to different file selections. Actual-source CLI evidence is recorded in the local import runbook.

## Dashboard preferences regression

TC-F42-IMP-PREFS [x] AUTO: Non-array JSON preferences render default dashboard blocks without throwing. Import target projection normalizes legacy non-array preferences, preserves valid list order, and does not mutate source artifact data.

TC-F42-PRODUCT-PAGING [x] AUTO: All 307 tenant products are reachable across pages; search/filter/sort apply before pagination; counts remain global; invalid query limits rejected; real browser check on imported local inventory.

2026-09-18 product pagination verification: 15 tests/3files PASS (pure pagination, existing API compatibility, AI refresh regressions). Real Playwright browser test on Docker localhost:3005/tenant1282 PASS: 307 total, page31 has7rows, search for oldest SKU outside initial100 succeeds, no-results and clearing search succeed. This is a read-only product-list acceptance test using a short-lived signed local session; login/OTP are not tested. Run with `npx playwright test --config playwright.f42-products-local.config.ts --output /tmp/pw1-products-pagination-results`. Other Playwright configurations skip this local-only test.

Implementation note: server scans lightweight authorized filter/sort metadata in batches of100 to preserve variant-minimum-price and compareAtPrice-versus-price semantics; only chosen page receives full descriptions/images. Counts and selection are computed on server, browser receives at most100 products. Legacy array API callers still receive complete inventory. Large-catalog SQL optimization remains separate; metadata work grows with tenant inventory.

- [x] AUTO **TC-F42-IMP-STATUS-001**: Accept only the exact exporter 1.3/source-status mapping hash pair while preserving 1.2 compatibility and classification/receipt gates. Preserve Product, Blog and Discount active/inactive publication states through entity projection and reference resolution.

- [x] AUTO TC-F42-IMP-ARCHIVE-001: exporter 1.4 exact contract; external CSV evidence retained, forged/missing/secret evidence rejected.

- [x] AUTO TC-F42-IMP-OUTCOME-001: exporter 1.5 successful publication remains subject to import blockers; approved fidelity delegated; unsafe links retained; false outcome rejected.

- [x] AUTO TC-F42-IMP-OUTCOME-002: global CSV template consumer evidence, foreign/mixed/unverified negative cases; 1.5.1 outcome counts and 1.5.0 compatibility.

- [x] AUTO TC-F42-IMP-DESCRIPTION-001: Accept exact exporter 1.6.0/hash pair with unchanged outcome verification and payment warning target gates; retain 1.5.1 support.

- [x] AUTO TC-F42-IMP-DESCRIPTION-001 extension: accept exact 1.6.1 Blog-owner fallback contract and retain outcome/target checks.

- [x] AUTO TC-F42-IMP-DESCRIPTION-001 extension: accepts exact 1.6.2 Blog content contract, retains outcome/target checks and old version support.

- [x] AUTO TC-F42-IMP-DESCRIPTION-001 extension: exact 1.7.0 contract acceptance preserves outcome verification and target checks.

- [x] AUTO TC-F42-IMP-EXCLUSION-001: Exact contract 1.8.0 chỉ nhận Product thiếu giá/stock có evidence đầy đủ và không emit; reject thiếu root/sai reason/sai Store/old contract; không miễn diagnostic khác.

## Legacy users manifest destination handoff

- [x] AUTO TC-F42-IMP-DESTINATION: derived master preserves every source collection/Store and adds verified tenant/site IDs plus empty productCategories only to selected Stores; reject hash mismatch, malformed/missing/duplicate identity, unsafe output and existing output; failed publication leaves no final output and source unchanged.
- [x] AUTO TC-F42-IMP-USERS: users CLI selectors and output-master flag validation; dry-run does not publish destination output. DB foundation verification remains manual until evidenced.

- [x] AUTO TC-F42-IMP-POLICY-001: Contract 1.8.2 accepts absent/false reserved flags, rejects true/unknown flags, preserves manifest policy hashes and prior approval boundaries; prepare/load regression and historical version support.

- [x] AUTO TC-F42-IMP-USERS-SCOPE: Foundation loads only Tenant/User/Site and authenticated identity inputs; unrelated reports/receipts are not read, master tampering is rejected, full loader still rejects invalid receipts.

- [x] AUTO TC-F42-IMP-LEGACY-DASHBOARD: Legacy dashboard object and normalized default blocks compare equal without changing DB values; custom block lists and other settings still conflict.

- [x] AUTO TC-F42-IMP-POLICY-002: Reviewed conflict policies require new contract, exact warning shape and enabled flag; unknown Orders remain blocked.

- [x] AUTO TC-F42-IMP-SYSTEM-EMAIL: Resolve approved system creator by exact email, use arbitrary actual DB ID, reject missing/ambiguous/invalid identity without granting roles.

- [x] AUTO TC-F42-IMP-MISSING-CREDENTIAL: Users/full fallback accepts absent credentials, generates distinct random passwords without keyString, rejects partial/invalid credentials, and keeps partial/invalid credentials blocked.

- [x] AUTO TC-F42-IMP-EMAIL-NORMALIZATION: User email projection follows Payload lowercase/trim, leaves source unchanged and produces the same checksum for equivalent email spelling.

- [x] AUTO **TC-F42-IMP-POLICY-003** — Exact 1.9.1 owner/email warning gates, exact invalid-email projection, installed Payload password authentication compatibility.

- [x] AUTO **TC-F42-IMP-POLICY-004** — Catalog exclusion exact-contract/flag guards; canonical lower-ID same-Store source proof; no emitted excluded Product; disabled/historical/forged evidence rejection.

- [x] AUTO **TC-F42-IMP-POLICY-005** — Source-entity omissions require the approved 1.9.3 contract, enabled entity policy and validated exclusion-family proof; earlier contracts reject active omission flags.

- [x] AUTO **TC-F42-IMP-POLICY-006** — 1.9.4 permits only PROD Store 43 Orders 112/132 negative-total omissions; wrong namespace/Store/ID/disabled/historical policy fails; mixed earlier Product/owner/email/raw-retention policies remain accepted.

- [x] AUTO **TC-F42-IMP-PARTS-001** — 1.10.0 descriptor-set binding, streaming/selection/spooling across parts, UTF-8 bytes, missing/extra/reordered/duplicate/tampered parts, EOF hashing and empty set; inherited policies preserved.
- [x] AUTO **TC-F42-IMP-PARTS-002** — Legacy users manifest output: exactly one destination part per input master; same filenames, Store boundaries/order and content, including unselected Stores. Verify hashes/IDs, publish index last without overwrite and clean up on failure.

## One-command workflow

- [x] AUTO **TC-F42-IMP-WORKFLOW** — Strict portable config and selector modes, run locking, dry-run no writes, preallocated batch identity, continuation after interruption, missing/changed batch rejection, users no-resume boundary, recovery guidance that does not prescribe output-only for incomplete users writes, and output-only retry without import.
- [x] AUTO **TC-F42-IMP-DESTINATION-MAP** — Internal ledger mapping builder and legacy compact-report helper: verified CREATE/REUSE mappings, live target/tenant checks, partial completeness and provenance-safe atomic output retries. Config workflow consumes the mapping internally and rejects incomplete selection; it does not publish a compact report.

- [x] AUTO **TC-F42-IMP-INLINE-DESTINATION** — Complete verified selection annotates each prepared master in place; source/master content preserved, same part boundaries, journal-bound original/output hashes, interrupted replace recovery and tamper rejection, sealed input guard and no repeat DB writes on finalization retry.


- [x] AUTO TC-F42-IMP-SCOPE-001: Contract 1.10.3 accepts exact source-only markers and emitted Order proof; rejects forged contribution, unknown discount fields, missing overflow receipt/flag, historical opt-in and altered outcome counts. Raw Page/Menu remains delegated; shipping proof uses actual Sites.shippingConfig defaults.

- [x] AUTO TC-F42-IMP-SCOPE-001 follow-up: accepted editor requires exact role/membership/empty permissions/source contribution; foreign tenant/custom permissions/owner role/old contract remain blocked. Historical Order coupon warning requires emitted Order/source contribution, preserved code, no operational discount FK and approved historical policy. Known promotion fields accepted, unknown fields rejected. PROD full-selection audit 0 BLOCKED after regression.

- [x] AUTO TC-F42-IMP-TARGET-ENTITY: target diagnostics select the intended collection and source identity, independent of entity order; blog/product media sharing a source ID cannot satisfy the check. Missing, duplicate or unknown targets remain blocked.

- [x] AUTO TC-F42-IMP-BLOG-MEDIA-IDENTITY: Blog and thumbnail from the same PW1 row use distinct normalized source keys in projection, disk registry and ledger lookups; repeat ownership stays valid, cross-Store ownership and changed source checksum remain blocked.

- [x] AUTO TC-F42-IMP-FULL-CREDENTIAL: full creation uses the missing-both fallback for normal and preserved-invalid-email users; partial credentials remain blocked and reuse does not reset authentication. Full logs report ledger-backed reset evidence with source/target IDs, deduplicated per session including recovered claims.

- [x] AUTO TC-F42-IMP-RAW-SETTINGS: Contract 1.10.4 preserves opaque model_settings including HTML/tel spaces in artifact; exact field/path/Store receipts required; no raw replay in runtime; missing/tampered/duplicate receipt, wrong Store and old-contract claims rejected. Unknown parent with valid direct Store is raw-only; genuinely unowned/excluded-Store rows remain documented source-only.

- [x] AUTO TC-F42-IMP-CATEGORY-BREADCRUMBS: Category hook reads parent breadcrumbs for the private migration capability; anonymous app requests and forged string markers retain normal access control. Parent validation and projection matching remain enforced.

- [x] AUTO TC-F42-IMP-HISTORICAL-WEIGHT: Private historical import preserves mapped Product status/weight when weight is the only publish blocker. Other publish blockers, normal app requests and forged context remain rejected; no guessed weight or status rewrite.

### Full local import verified — 2026-09-24

- Input: exporter 1.10.3, `pw1-prod-1103-20260924/artifact`; all 2,913 emitted Stores (5 policy-excluded Stores remain excluded).
- Runtime: `$PW1_ROOT/runtime-20260924-full-v3`; branch source continued independently, so this result applies to the frozen snapshot.
- Run: `2026-09-24T06-31-32-300Z-c14163c7-e807-4f1d-8211-a9ef24a6963a`; batch `json:5776917b-945f-4072-b0c2-76ca79d986d7`.
- Command: `npm run migrate:pw1:import -- --config "$PW1_ROOT/local.json" --all`.
- Exit 0; one VERIFIED batch; 2,913 VERIFIED Store ledger rows; no failed/remaining Stores. End-to-end duration approximately 113 minutes including prepare and destination.
- DB: 2,913 tenants, 2,913 sites, 2,958 users including retained system user, 32,642 products, 869 orders. Summary records 28 imported users requiring password reset.
- Destination journal complete; all 10 prepared master parts contain destination for all 2,913 Stores; no missing/invalid tenantId, siteId or productCategories containers. Original exporter artifact remains separate and unchanged by destination output.
- Regression: 698 tests / 41 files passed; typecheck passed. Real Product 2486 transaction probe passed with rollback before the full run; full run subsequently verified every selected Store.
- Fixes verified: Category parent breadcrumb read uses private migration capability; historical Product replay allows only the weight-only publish blocker. Ordinary/forged contexts and other publish blockers stay enforced.
- This is an actual write/verify result for the recorded artifact and runtime, not a guarantee that arbitrary future artifacts or all Payload hooks are covered by dry-run.

- [x] AUTO TC-F42-IMP-SOURCE-DOMAIN: Contract 1.10.5 inherits restored raw settings and approved policies; original Sites.domain passes projection/resolution independently of tenant slug. Source-domain receipt requires emitted Site, exact Store/source/path/fields; historical contract, missing/duplicate/forged receipt rejected. Malformed PW1 domain warning is approved only with matching selected-source receipt and graceful policy. No hostname is invented for null/absent values.
