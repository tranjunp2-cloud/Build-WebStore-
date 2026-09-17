# Current handoff — 2026-09-17: latest full 30-store reset and migration complete

User requested another full reset/migration of30 after the link fix. New private evidence root: /Users/levietducprime/Work/pw1-exports/reconstruction/pilot-full-links-30-20260917. Backup before-reset.dump, original input snapshot preserved. Reset removed30 mappings/sites/tenants, preserved accounts/outside sites, deleted133 migration media and retained198 referenced/uncertain files.

Important provenance: this run was interrupted by chat/tool cancellation. Initial batch ac0c550f-aa94-4f5d-828c-220c8b79ab41 completed15 before its process stopped. Normal resume batch5a165da9-a1ca-4d6f-b4b6-3e89d2a28a07 recovered interrupted ledger/work and generated the remainder, skipped15 already complete. Local Next server had also stopped, so all30 publication attempts failed connection. Restarted Next dev detached (log /tmp/pw1-local-server-restart.log), then script retry batche296ba62-e069-40b1-9488-97f10e8bc3e0 skipped all generation and automatically published30. Do NOT claim one uninterrupted successful batch or conflate these infrastructure interruptions with store retry behavior.

Final state:30 migrated/published;157 pages including404; branding/contact/social/SEO readback matches all30. Latest automatic desktop/mobile public audit127/127 checked,0errors/0warnings/0skipped/0failed,167waiting-BE findings. All8 confirmed broken source links disabled (1042=2,1033=3,645=3). Site/page IDs changed, public tenant slugs unchanged. Existing links usable for manual review.

Artifacts: run.log, resume.log, publish-recovery.log, report.json (explicit aggregate with source batch IDs), verification.json, published-state.json, published-links.md, quality.json/.json.md/.json.jsonl. Earlier failed publication audit preserved as quality-before-server-restart.json. Final public audit supersedes intermediate reports.

No additional code changes in this rerun. Code/context still uncommitted. Remaining work: larger staging pilot and BE commerce mapping/validation. User explicitly skipped further preserved-label visual checks; do not reopen that task automatically.

---

# Current handoff — 2026-09-17: eight dangling PW1 CTA links fixed and applied

Implemented general source-link verification in the migration runner: complete same-store live /pages inventory and rendered soft404 detection, bounded SPA render, fresh same-host HTTP fallback for TLS failures. Partial inventories, other-store responses, server/network errors and working redirects are retained. Existing adapter disables confirmed dead links, preserving CTA text and images. No store-specific code or post-migration SQL content patches.

168 unit tests, browser not-found visibility fixtures and TypeScript passed. Read-only preparation first confirmed all8 links. Then backed up DB at private pilot-links-3-20260917/before-rerun.dump, captured outside-site state and exact scope, unpublished only3 pilot sites through owner-authorized API to allow existing draft-only migration, and ran ONE --rerun invocation on the 3-store input with automatic publication/audit.

Batch 7fbcb1f4-882b-4ea8-a74c-9baebe8c1261: 1042/1033/645 all completed_with_warnings and published on first attempt. Broken/disabled counts2+3+3=8. Public audit3/3 pages, zero errors/warnings/BE findings in these pages. Other sites' IDs/updated_at/status unchanged. Evidence: /Users/levietducprime/Work/pw1-exports/reconstruction/pilot-links-3-20260917 (input,scope,backup,run.log,verification.json,quality.json and public-links-verification.json).

This supersedes prior “8 unresolved links” task: implemented and applied. Existing 30-store bulk result remains historical; these3 now have newer regenerated page IDs, same site IDs/slugs. Remaining work: larger staging pilot and BE commerce mapping/validation; commit/push still pending. No reset of the other27 stores.

---

# Current handoff — 2026-09-17: remaining eight source links checked

Read-only investigation completed, no code or site data changed. All 8 links originate in source banner CTAs: 1042 component17142 banners9544/9545; 1033 component17014 banners9456/9457/9458; 645 component9373 banners4890/4891/4892.

Full live PW1 /pages API inventories (pagination total_pages=1, counts6/6/7) agree with exported source tables: none of /about-us, /product-service, /contact-us exists for the respective store. Store1042 has2 links, 1033 has3,645 has3. These are dangling source CTA destinations, not export/migration page loss.
- /product-service (1042/1033/645) and /contact-us (1033/645) render Page Not Found despite HTTP200; 1033 redirects to /page-not-found.
- /about-us on all3 remains a Loading shell/header/footer without actual page content even after12seconds. Absence confirmed by the complete live page inventory, not by HTTP status alone.
- 1033 HTTPS fails; a fresh HTTP browser navigation succeeds and exposes the same six-page inventory.

Existing migration checker blocks subresources and checks document HTTP404/410 only, so it cannot detect these SPA soft404s or missing-page shells. Suggested next implementation: verify a complete same-store source page inventory and/or unambiguous rendered not-found, then use existing broken-CTA handling to preserve text while removing the dead link. Do not guess /product-service -> /products or redirect to Home. User requested check only; no fix applied yet.

Evidence: pilot-carousel-auto-30-20260917/missing-links-review.json (sanitized live inventories); /tmp/pw1-eight-links-live.json, /tmp/pw1-links-followup.json, /tmp/pw1-links-1033-http.json and screenshots. Prior "unknown destination" status is now resolved as an investigation; cleanup logic/application is still outstanding.

---

# Current handoff — 2026-09-17: fresh 30-store single-command pilot completed

User requested item 1: reset/re-run the 30 pilot stores with latest migration, retry, cleanup, automatic publication and audit. Completed in ONE migration invocation, no separate retry/publish command.

- Backup: private pilot-carousel-auto-30-20260917/before-reset.dump (40 MB). Scoped reset removed 30 sites/tenants/mappings; accounts preserved, outside site timestamps unchanged. Reset media cleanup deleted 138, conservatively retained 193.
- Batch **9fd7c3fb-ba94-4e82-ab06-54bf92df2b82**, concurrency 5, max-attempts 3: **30 completed_with_warnings, 30 published, 0 failed/skipped/deferred**, 31 generation attempts.
- Store 1004 first attempt timed out (code 23); runner retried automatically and succeeded on attempt 2. Failed-attempt cleanup completed; its tracked media was retained because a page-version navigation still references it. Do not claim an orphan was deleted in this particular run.
- Batch migration+publish duration 223.556 seconds. Whole command including browser audit 635.506 seconds, exit 0. No manual recovery command.
- DB readback: 157 pages including 404, all 30 branding/contact/social/SEO checks match input.
- Automatic public browser audit: 127/127 pages checked desktop/mobile, 0 skipped/failed/errors, 3 source-link warnings, 167 waiting-BE findings. This is not full visual/commerce parity certification.
- Successful attempts: 46 source Small-banner components, 22 observed-source-frame and 24 unverified. Source ambiguity/unavailability remains visible; no blanket claim that image sharpness/layout is fixed.
- Selected carousel UI checks (205/253/567/416): navigation works where present and frame heights remain stable. Screenshots and carousel-interaction.json saved.
- Current public slugs are unchanged from prior list, but site/page IDs changed. New published-links.md in this run's private directory points to current sites.

Evidence directory: /Users/levietducprime/Work/pw1-exports/reconstruction/pilot-carousel-auto-30-20260917
Files: input.json (private snapshot), reset-summary.json, run.log, timing.json, report.json, verification.json, quality.json / .json.md / .json.jsonl, published-links.md, carousel screenshots and interaction results. Do not overwrite historical pilot artifacts.

Context/code changes remain uncommitted. No GitHub Actions added or run. BE mapping validation, ambiguous source links and larger staging performance validation remain separate follow-ups. Do not reset the 30 stores again unless requested.

---

# Current handoff — 2026-09-17: carousel source preparation improved

User approved a general migration-script fix, never store-ID special cases. Added dedicated bounded `scanPw1Carousels` before AI generation. Targets come from original input source page IDs/paths containing Small banners; supports inner pages, Swiper/Slick/Owl/Bootstrap and simple CSS backgrounds. Slide pitch includes gaps. Exact media matching is page-scoped; explicit input geometry wins; conflicting/missing evidence stays unverified with reason. Verified declared srcset alternatives may replace low-resolution input only after real image decode and ratio check. No guessed original URLs, universal height cap or contain override.

Source scan and per-component provenance persist as carousel-scan.json/carousel-evidence.json. Quality warnings carry page/component and observed upscale. Evidence is prepared once per store and reused during generation retries. Scan limit: 12 pages, 60 seconds after browser launch, serialized browser scans; page/budget failures retained. Removed duplicate carousel inspection from brand scan. Existing binder already preserves layout and selected image for both carousel variants; regression added.

Validation: 165 unit tests / 21 suites; TypeScript; real browser fixture verifies gapped Swiper, Slick backgrounds, loaded srcset upgrades, broken/different-ratio alternate rejection. Read-only actual source checks: 205 scanned 2 pages / 14 frames, two components remain unverified; 416 scanned 1 page / 27 frames, component verified; 253 scanned 2 pages / no frames, three components unverified. Evidence /tmp/pw1-carousel-live-new.json. This does not certify all theme coverage or fix all low-resolution sources.

Prior read-only 30-store browser review: 127 pages, 50 rendered image-carousel blocks across 27 stores at desktop/mobile. 10 blocks in 8 stores have a loaded image enlarged ≥3×: 205/253/546/567/602/627/645/939. This is a screening metric, not an automatic repair rule; some lazy images remained unloaded. Selected Next interactions retained stable heights. Evidence /tmp/pw1-carousel-review/README.md.

No 30-store reset, generation, destination data update, publish, commit or push performed in this turn. Next full migration is needed to inspect new generated output. Prior changes below remain uncommitted.

---

# Current handoff — 2026-09-17: automatic CLI publish implemented

User clarified publication must be built directly into the migration flow, not enabled by a flag. Regular run/retry now automatically publishes successful stores using `NEXT_PUBLIC_SERVER_URL`. Removed both publish CLI flags. Origin validation happens before migration writes; dry-run and reporting commands do not require the origin or publish anything.

After migration/cleanup drain, publish runs sequentially through existing PATCH publish API as the verified active owner, retaining API subscription checks, page-version promotion and cache invalidation. Exact completed mapping/input hash/owner/tenant required. Already-published sites are not republished. Previously completed stores skipped by generation can publish, so `retry INPUT` recovers publication without re-running AI.

Publication has a separate bounded attempt loop using `--max-attempts`. Failure records `publish.status/attempts/error`, keeps migration completion intact, continues other stores and makes batch exit nonzero. Requested audit still runs on partial publication failure. HTTP timeout rechecks site status before retry; 429 honors Retry-After up to 60 seconds per wait. Report JSON totals include published/publishFailed; CSV includes publish. No site-link export added. App server must be reachable and configured against the same destination DB/secret.

Usage: `npx tsx --require ./scripts/seed-preload.cjs scripts/migrate-pw1.ts input.json --concurrency 5`.

Verification: 161 tests across 21 suites passed; TypeScript and diff checks passed. Real CLI/DB/API/browser integration passed all five scenarios: automatic publication after partial migration failure, generation budgets, retry/resume, bounded publish failures and recovery without regeneration, already-published skips, BE gate and read-only dry-run. Isolated fixtures were cleaned. Log: /tmp/pw1-auto-publish-integration.log. Existing 30 pilot sites were not regenerated or republished.

Code/docs/context remain uncommitted, together with prior changes below. GitHub Actions remains deferred.

---

# Current handoff — 2026-09-17: missing-page link policy is inside migration

User explicitly requires fixes in the migration script, never post-migration DB patches. Implemented `prepareSourceLinks` in the regular batch runner before AI generation. Adapter now records exact source page/component/slide/menu locations for unresolved links, separately from BE/entity links. Browser verification is bounded to 10 URLs/store, 5 seconds/navigation, 30-second browser lifetime after launch; public-host guard, cross-host navigation blocked, no auth. Only explicit same-host HTTP 404/410 disables a link. Network/TLS failures, external redirects and HTTP 200 SPA shells retain it with diagnostic evidence.

Disabled rich-text anchors retain children/text/images; broken menu items are removed while valid children survive; banner CTA label becomes plain description text; category card URL is omitted. No hardcoded store IDs or `/about-us` rule. Checks and findings persist as `source-link-checks.json`, `input-adaptation.json`, and are exposed in JSON batch reports. `--dry-run` remains network-free.

Source investigation: PW1 snapshot DB has no About Us page for stores 645/1033/1042, including deleted records. Running the **same preparation helper used by the batch** read-only against actual input discovered **8 missing destination URLs**, including links on inactive carousel slides that the prior browser audit did not expose:
- 1042: `/about-us`, `/product-service`; source responds HTTP 200, no matching input pages.
- 1033: `/about-us`, `/product-service`, `/contact-us`; HTTPS TLS connection fails.
- 645: `/about-us`, `/product-service`, `/contact-us`; source responds HTTP 200, no matching input pages.
The adapter source for 645 is `duc-test-61.web.dev.ecommercehub.my`; `junshop.com` is a separate URL found in source data and was initially inspected in error. Do not use its parked-domain behavior to classify the actual adapter source.

All 8 remain retained/unverified, not automatically deleted: missing input alone and HTTP 200 shells are not conclusive 404 evidence. No source page invented, no links redirected to Home. This step delivers general checking/reporting and confirmed-broken handling; it does **not** claim these 8 links have valid PW2 destinations. To remove these ambiguous links, an explicit reviewed disposition or a complete authoritative page-inventory policy is still needed.

Validation: 153 tests across 20 suites and TypeScript passed. Read-only evidence `/tmp/pw1-source-link-review-20260917.json` (captured before the diagnostic label was refined to distinguish TLS errors). No destination DB patch, no reset/regeneration/republish in this step. Previously published 30 sites remain unchanged. Changes, including the prior finalization work below, are uncommitted.

---

# Current handoff — 2026-09-17: retry finalization implemented; 30 sites published

This section supersedes the unfinished-pilot state below. Current changes are not committed/pushed yet.

## Implementation

- `nativeDesignSchemaForSource` constrains OpenAI structured output by source component ID and allowed block/variant pair. The previous independent global enums admitted incompatible category layouts; strict binding remains intact. Store 546 succeeded on its first attempt with the new schema.
- Batch tracks failed attempt IDs and media created before those failures. After all work drains, it queues cleanup even when a later attempt succeeded. Only failed runtime artifacts are excluded; successful attempts/receipts, live references, versions and before-state backups remain protected by existing cleanup checks.
- `MigrationBatchIncompleteError` distinguishes drained store failures from fatal errors/cancellation. `runMigrationWithAudit` runs the requested audit after partial failure, preserves migration nonzero exit and reports both errors if audit also fails. It does not publish draft sites automatically.
- User's default remains 3 total attempts per store (initial + 2 retries), then record failed and continue within the same command. No workers or GitHub Actions added.

## Verification completed

- 131 unit tests across 18 PW1 suites pass, TypeScript noEmit passes.
- Real CLI/DB/AI integration `scripts/tests/pw1-batch-operations.ts` passes: one fixture fails all three attempts within one invocation; the next store completes; orphan image is deleted; budget/deferred resume, reports, strict BE gate and dry-run pass. Log `/tmp/pw1-retry-policy-integration.log`.
- Real DB/storage integration `scripts/tests/pw1-media-cleanup.ts` passes: failed-attempt orphan cleanup with a later committed successful attempt preserves referenced images and versions; unresolved/committed attempts remain protected. Log `/tmp/pw1-retry-cleanup-integration.log`.

## Current pilot results

Run `retry INPUT --concurrency 5 --max-attempts 3` batch `9ae4370e-0659-4ea7-87f4-eeac8ffce8b6`: 546 completed on attempt 1; 29 previous successful stores skipped. Before/after site IDs and updated_at confirm those 29 sites were unchanged by migration. This is a recovery run, not a claim that the initial 30-store batch succeeded without failures.

Aggregate latest state: **30 completed**, 157 pages including 404; branding presence/contact/social/SEO readback checks pass. All 30 published through local publish API with HTTP 200; DB confirms published. Fresh browser audit completed on desktop/mobile: **127/127 pages checked, 0 skipped, 0 failed, 0 errors**. Remaining findings: 3 source-page warnings (About Us links for stores 645, 1033, 1042) and 167 waiting-BE entity-link findings. This is automated quality verification, not full visual/commerce parity certification.

Artifacts: `/Users/levietducprime/Work/pw1-exports/reconstruction/pilot-carousel-30-20260916/`:
- `retry-final-20260917.log`, `report.json` (explicit aggregate, includes contributing batch IDs), `reconciliations-final.json`, `verification.json`.
- `publish-final-20260917.log`, `results.json`, `published-links.md` regenerated for current sites.
- `quality-final-20260917.json` / `.json.md` / `.json.jsonl` for this audit.
- `/tmp/pw1-before-finalization-30.json` records the pre-recovery mapping snapshot.

Private input/local DB/artifacts are outside Git and do not transfer to another machine through pull. Public links are local `http://localhost:3000/sites/...`.

Pending scope remains real BE import/mapping validation, broader carousel source coverage and large-scale throughput validation. GitHub Actions remains deferred. Do not reset completed stores as a routine continuation.

---

# Current handoff — 2026-09-16: retry policy corrected; pilot unfinished

This section supersedes older pilot completion claims below for the current reset.

## User requirement and implementation

User requires one migration command: automatically retry a failed store within the same run, then record failed and continue other stores after exhausting the limit. Do not manually launch retry commands and present their aggregate success as one successful batch.

This retry-policy change adds `classifyStoreAttemptError` to the generation/apply attempt catch in `pw1-batch.ts`. All uncommitted execution failures, including AI layout validation and unknown errors, are eligible for bounded retry. Default is **3 total attempts (initial + 2 retries)**, configurable with existing `--max-attempts` (1–5), using existing exponential backoff/jitter. Logs show attempt/limit and automatic retry vs final failure. Exhausted stores remain failed, cleanup is queued, and the pool continues. Batch exits nonzero after draining if failures remain.

Safety/operational stops do not retry: interruption, time/token/generation budgets, owner/destination conflicts, missing required BE data, published sites, concurrent edits. Commit receipts still prevent blindly retrying an already committed write. Provisioning retains its existing transport-only retry policy; preflight/input errors occur outside the execution attempt loop. Do not claim every possible preflight failure is retried three times.

Transport classification now recognizes UND_ERR_SOCKET, UND_ERR_HEADERS_TIMEOUT and UND_ERR_BODY_TIMEOUT. Actual store 18 log was TypeError `terminated`, cause `other side closed`, code UND_ERR_SOCKET: a closed HTTP connection, not the entire process terminating.

Validation: 26 tests in `pw1-reliability.test.ts` passed; TypeScript noEmit passed; diff whitespace check passed. QA TC-F35.M29 updated. **New policy has not yet been exercised in a real migration batch. Code, tests, QA notes and this handoff are included together in the retry-policy commit.**

## Actual current 30-store run

Last pushed implementation before this run: `0e7230eaa` (migration fidelity and verification). Local-only scoped reset completed: 30 mappings/sites/tenants removed, login accounts preserved, outside sites unchanged; media 139 deleted/192 retained. Backup `/tmp/pw1-before-reviewed-rerun-30.dump`.

Initial batch `fc1fe38b-1be2-4e71-870b-88c99e687692`, concurrency 5, 271.43 seconds: **28 succeeded, 2 failed (546 and 18)**. It ran before this retry policy correction.

Manual retries were subsequently launched by the assistant, contrary to the intended operational flow:
- Store 546 retry batch `74147b35-c912-440b-9fef-7bef0aeb1cea`: still failed with `Category listings require native cards or portfolio layout`.
- Store 18 retry succeeded (see retry-18.log).

Current result: **29 successful stores, store 546 unresolved. Current regenerated set has not been published or verified end-to-end.** Do not claim 30/30 completed or use old published links/checks as proof for this run. Do not reset the 29 successes merely to retry 546. The user has not requested a further full reset since the retry discussion.

Input (local/private, not in Git): `/Users/levietducprime/Downloads/stores-205-285-pw2-current-schema-collection-only(1).json`.
Artifact root: `/Users/levietducprime/Work/pw1-exports/reconstruction/pilot-carousel-30-20260916`.
Current evidence: `run.log`, `timing.json`, `run-metadata.json`, `report-initial.json`, `retry-546.log`, `retry-18.log`, `reset-summary.json`. Previous evidence archived in `archive-reviewed-20260916-174738`. Other existing top-level report/verification/public-links files can still be stale. Preserve individual batch histories when generating any aggregate report.

## Next steps / home machine

1. Pull the current research branch to get the retry-policy commit (code, tests, QA notes and context). Private input, local DB, /tmp backups and external artifacts do not transfer with Git.
2. Verify the automatic bounded retry in a real run, including exhausted-store continuation. Investigate 546's repeat layout validation failure without weakening source fidelity checks. Do not substitute silent manual retries for proof of the new policy.
3. After successful migration, read back settings and page counts, publish the 30 authorized pilot sites, verify anonymous public routes, regenerate the current public-link list. Prior expected counts were 157 pages including 404 / 127 public non-404 pages; verify rather than assume.
4. BE product/category mapping remains pending real BE imports. GitHub Actions remains explicitly deferred by user.

---

# Corrected carousel policy — 2026-09-16

User rejected generic caps and image-derived geometry. Removed480px/55vh renderer cap and median/max image sizing import policy. Removed helper/tests asserting that incorrect policy. Explicit source config aspectRatio/imageFit/slidesPerView now passes through adapter→binder→carousel; absentSmallbanner geometry produces percomponent warning. CurrentPW1export has no verifiedthemegeometry; full mapping still pending, not paritycomplete. Cleared49pilotcarousel heuristic settings plus98version records, republished30local sites; backup `/tmp/carousel-before-remove-inference.json`. Existing olddefaults return; this is removal of incorrect guesses, not a claim of blur fixed or PW1 layout replicated. Prior sizingdocs superseded. No reset.

# Carousel oversized frame correction — 2026-09-16

User reported small portrait centered in huge blank frame. Root: largest source width plus median aspect could produce multi-thousand-pixel frames; scale-down only fixed image scaling. Renderer now bounds migrated scale-down frames to480px/55svh and clamps aspect0.75–2.4, constrains viewport width accordingly. Legacy cover unchanged. Existing49carousels benefit immediately, no reset/DB mutation. Future migration uses median source width capped960 and ratio*480 instead oflargest; unknown metadata uses16:9/800px. Stable frame across slides.

Validation: TypeScript+3puretests+5realbrowser tests pass (desktop/mobile253; worstdimensions546our-services,1127,1047). Verified PC_DEMO_14 screenshot /tmp/carousel-bounded.png. No republish/regeneration needed; code uncommitted.

# Fresh30 carousel pilot — 2026-09-16

User requested full reset+migrate. Backup `/tmp/pw1-before-carousel-30.dump`; scoped reset30 keeps loginaccounts and outside sites. Batch `12dd0e43-fc24-4f79-9c15-3816503d504b`:30completed_with_warnings,0failed/skip,143.388s excluding reset/publish, no manualretry. Readback157pages including404, allsettingsmatch. Published30 localsites.49/49carousel persisted scale-down+aspectRatio+maxImageWidth AFTERpublish. Anonymous127/127 HTTP200.29brandobserved/1fallback. Existing BE mapping warnings remain.

Latest evidence+published-links.md `~/Work/pw1-exports/reconstruction/pilot-carousel-30-20260916/`. Source-domain slugs unchanged; newsite IDs. Reset script moved out of repo. No code changes or commit/push thisrun. This pilot proves carousel fields survive ordinary migrate+publish without postmigrationpatch.

# Carousel image layout improvement — 2026-09-16

User requested general migration fix after PW1 carousel research. Added optional carousel aspectRatio/imageFit/maxImageWidth/slidesPerView to config/renderer, Pages fields, additive DB migration for current+version tables, and AI field allowlist. Media importer derives median ratio/max source width from actual media dimensions, uses scale-down; honors explicit sourceLayout geometry when supplied. No automatic per-theme scraping implemented; unknown layout keeps1slide. Legacyblocks preservedefaults. Cards withouttext no longer renderemptycontentpadding.

Applied layout to49carousel blocks across30localpilot sites (and their version records so publish retainsvalues), republished30. Temporary script and before-data backup moved outsideGit. Store253 persistedafterpublish ratio1.8,maxwidth900,imageFit scale-down. Initial publish encountered devHMR Drizzle schema error; server restarted clean via nextdev, successful republish afterward. Serverlog /tmp/pw1-carousel-next.log. Browser E2E tests tests/pw1-carousel-layout.spec.ts use local253fixture and desktop/mobile navigation. No reset/regeneration thisturn; no commit/push. Source domain links unchanged.

# Full30 brand-v2 pilot — 2026-09-16

User requested reset30 and migrate again. Backup `/tmp/pw1-before-brand-v2-30-20260916.dump`. Reset30sites/tenants/mappings; login accounts preserved, outside sites unchanged;131media deleted/200retained. Source-domain tenant slugs now provisioned directly.

Initial batch `17b27c71-8df9-4eb6-9793-ca4b7ff0ca4a`:29completed/1failed (1047 category variant validation),172.983seconds excluding reset/publish. Retry `a7c75656-a5af-4f77-ad9a-1c60d1ba0058` completed1047,29skipped. Final30completed_with_warnings,0failed remaining. Brand evidence28observed/2fallback (1041 webpage timeout+logo generic photo rejected;939page screenshot5s timeout). Do not claim all30 recovered brand identity. Readback157pages including404; branding/contact/social/SEO matches input30/30. Publish30/30 via localAPI; anonymous127/127 HTTP200. No visual acceptance claim.

Private evidence `~/Work/pw1-exports/reconstruction/pilot-brand-v2-30-20260916/`: original reports for bothbatches, combined report.json, verification, results, anonymous-checks, published-links.md with actual domain slugs and palette. Temporaryreset moved here. No code changes needed thisrun; no commit/push. Latest link list supersedes previouspilot. Local sites remain published.

# Brand scan v2 — 2026-09-16

User requested broader PW1 visual reference. Scanner now tries HTTPS→relaxed cert→HTTP, records transport, retains neutral colors, captures up to6000px page JPEG and source-logo image in guarded browser. Can analyze logo even if domain unavailable. Separate analyzePw1Brand visual AI returns only palette/reason/confidence/usable; layout AI never sees screenshot bytes. Error/parked pages rejected; visual-AI failure uses CSS/contextual fallback. Batch budgets include visual tokens, artifacts/report expose them separately. Browser cache raw byURL+logo; analyzed evidence reused perstore onretry.

Real scan+AI smoke (no DB mutation): store205 Amelina recovered via https-relaxed, brown#241305/olive#748a53 confidence medium; store253 CSS-empty recovered fromlogo blue#28489f/orange#f58220 confidencehigh. Evidence `/tmp/pw1-brand-v2-smoke.log`. 30 publishedsites NOT regenerated/recolored this turn. Previous source-slug mapping remains current. No new env/schema/dependency. Changes uncommitted.

# PW1 source slug — 2026-09-16

User confirmed public tenant slug must follow PW1 domain, not pw1-storeID. Provision now uses selectPw1TenantSlug: first hostname label, strip www; validate existing tenant constraints; suffix source ID for reserved/invalid/collision, then counter. Checks existing tenant current and previous slug aliases, never claims another tenant. No schema/env changes.

Explicitly updated30 local pilot tenant slugs using Payload, preserved old slugs in previousSlugs with30day expiry. Pages/site IDs and content unchanged. Store546 now `/sites/test-dev-pw10` (source domain), not exported tenant slug ary-... . Mapping audit outsideGit in pilot-brand-30-20260916/slug-changes.json; published-links.md updated. Existing mapped stores are not renamed automatically on CLI retry. Earlier /sites/pw1-ID handoff URLs superseded.

# Reset + migrate30 với màu PW1 — 2026-09-16

User yêu cầu reset30 và migrate lại. Backup `/tmp/pw1-before-brand-30-20260916.dump`. Reset30sites/tenants/mappings, giữ login accounts, outside sites unchanged; cleanup138 deleted/193 retained. Evidence riêng `~/Work/pw1-exports/reconstruction/pilot-brand-30-20260916/`; reset.ts chuyển khỏi repo.

Batch đầu `ec70e843-ca31-45e1-b15e-8fcf77371af2`:24 completed/6failed,149.139s. Lỗi native AI page/section identity hoặc category variant. Bỏ JPEG khỏi AI layout prompt (vẫn lưu audit), chỉ truyền bảng màu; retry `fa7c0014-6283-4454-9f1a-adef6c1422fb` sửa3. Thêm một lượt correction có validation error+expected identities/allowedOutput, binder vẫn strict; retry `0db4c027-0796-42fd-bdc1-b727ee406225` sửa3 còn lại. Tổng30 completed_with_warnings,0failed remaining. Không được mô tả đây là một batch thành công ngay lần đầu. Usage accumulation sửa để đếm mọi native-design call khi correction; lần retry2 chạy trước sửa accumulation nên report usage correction có thể thiếu.

16store brand observed,14fallback (10SSL/4no chromatic UI color). Readback157pages including404, allSettingsMatch=true. Publish30/30 local API. Anonymous127/127 pages returned200, chưa nghiệm thu visual. Link giữ `/sites/pw1-ID`; published-links.md ngoàiGit có palette và evidence status. Report riêng từngbatch giữ nguyên; report.json là tổng hợp thành công qua3batch (aggregateTotals là kết quả gộp).

171tests/16files+tsc+diff check pass. Generator hiện không gửi screenshot cho AI nữa vì screenshot ảnh hưởng cấu trúc; screenshot vẫn ở artifact. Một lượt correction có test thành công và hết lượt vẫn fail. Chưa commit/push. Các mục dưới là lịch sử trước lượt này.

# CLI source brand scan — 2026-09-16

Added automatic scan of input source.websiteUrl in batch CLI before AI generation. CLI-only Playwright, one browser at a time, bounded100 URL process cache, per-store evidence reused on retry. Captures ranked chromatic CTA/nav/link computed colors and viewport JPEG; passes evidence + image to native AI with instruction to retain brand anchors and adjust readability. Artifact brand-evidence.json plus brand-selection.json; JSON batch report exposes evidence without JPEG and generated theme. Fallback warning for launch/network/SSL/no-color failures; cancellation still aborts. No new env vars/schema/dependencies (existing Playwright). CI runner setup needs `npx playwright install --with-deps chromium`; migrate command unchanged. Existing published30 sites NOT recolored in this turn.

Validation: TypeScript,170 tests/16 files, diff check pass. Real browser PC_DEMO_14 returned observed #337ab7(nav/link), #ee9051(nav/CTA/link), JPEG45844base64 chars. This smoke test did not call AI or mutate DB. Browser Chromium installed locally for verification. Pending full migration with brand scan and visual evaluation of generated palettes. Latest reset/publish remains previous block-variety batch below. Code uncommitted.

# Reset + migrate lại 30 store với block variety — 2026-09-16

Theo yêu cầu user, reset đúng30 stores rồi chạy lại full flow với code variant mới. Backup trước reset: `/tmp/pw1-before-block-variety-30-20260916.dump`. Đã xóa30site/tenant/mapping; giữ login accounts và xác nhận site ngoài scope không đổi. Cleanup xóa136 media, giữ195 có thể còn tham chiếu.

Batch `6a703988-5024-4057-8d4e-2d18fbfdc5da`, concurrency5, writes serialized:30 completed_with_warnings,0failed/skip,59.270s (không gồm reset/publish). Readback157pages gồm404; branding/contact/social/SEO khớp cả30. Publish API local30/30 thành công. Anonymous HTTP127/127 trang không phải404 trả200; đây là kiểm tra routing, chưa phải nghiệm thu visual/mobile. URL giữ `/sites/pw1-{storeId}`; site IDs đã đổi.

Actual output across pages: hero slideshow37/fullscreen4/split-right3/centered9/parallax3/split-left2/cards-overlay4; products grid3=12/grid4=17/list8; portfolio grid9/showcase8/masonry8; blog list24/cards17; carousel images21/cards27. Footer dark-gradient53/simple26/centered-stack48. Đây là số block trên tất cả page, không phải số store. Các cảnh báo BE product/blog import, source identity mapping và filter/search/category mapping vẫn tồn tại; không tuyên bố full PW1 parity.

Evidence riêng ngoàiGit: `~/Work/pw1-exports/reconstruction/pilot-block-variety-30-20260916/` gồm reset-summary, run.log, timing, report, verification, results, anonymous-checks, block-counts và published-links.md. Script reset tạm đã chuyển ra khỏi repo. Thay đổi code variant chưa commit/push; các mục bên dưới là lịch sử trước lần chạy này.

# Đa dạng block nội dung — 2026-09-16

User yêu cầu đa dạng cả block bên trong. Đã mở hero một ảnh thêm magazine/cards-overlay/parallax (không mở minimal/gradient vì renderer không hiển thị ảnh, không mở video khi nguồn không có video). Multi-slide giữ slideshow để không mất slide. Category listing nay cho phép carousel cards hoặc portfolio-grid grid/masonry/showcase khi mọi item có ảnh nguồn; giữ thứ tự/title/image/description/link. Products/blog vẫn query DB thật. Thêm preferredOutput ổn định theo store+component ID từ allowedOutput, AI có quyền chọn khác nếu không phù hợp. Rich text giữ nguyên HTML, wrapper reading/wide/panel theo art direction thay vì luôn960px. Không tạo block type mới.

167 tests + TypeScript pass. AI generate+bind thử30/30 hợp lệ, chưa ghi DB/publish. So với lần đo trước: products-grid list0→7; category portfolio25block (showcase9/grid8/masonry8); blog cards29/list12→cards18/list23; hero thêm cards-overlay4/parallax4 (magazine được mở nhưng lần này AI không chọn). Hero tổng62block, slideshow36 vẫn nhiều vì nguồn multi-slide. Evidence `~/Work/pw1-exports/reconstruction/block-variety-30-20260916/` có designs và block-counts; số đếm là block trên toàn bộ page, không phải số store. Cần regenerate/publish và visual QA trước khi kết luận UI đạt yêu cầu; các30 site đang publish vẫn là bản pilot-footer trước đó.

# Tăng đa dạng thiết kế — 2026-09-16

User nhận xét 30 site giống nhau gần80%. Đã bổ sung `pw1-design-direction.ts`:6 định hướng editorial/catalog/immersive/boutique/studio/classic, chọn ổn định từ storeId hash, làm gợi ý cho AI chứ không ép layout hoặc random theo lần chạy. Mở đủ6 navigation variants từ schema native. AI nhận mood và preferred header/footer/single-image hero/products/blog layouts; vẫn giữ các ràng buộc bảo toàn nội dung (multi-slide hero luôn slideshow, rich text giữ HTML).

Đã gọi AI thật trên30 input, chỉ generate+bind trong bộ nhớ, KHÔNG ghi đè30 site published. 30/30 output hợp lệ. Header: transparent7/default7/mega5/floating6/sidebar2/centered3. Footer: dark-gradient12/simple7/centered-stack11 (trước đó simple26/30). Đây là số variant, chưa phải đánh giá visual/mobile hay khẳng định % web khác nhau. Evidence riêng `~/Work/pw1-exports/reconstruction/variety-30-20260916/`. 161 tests và TypeScript pass. Muốn nhìn phiên bản này trên website cần migrate/regenerate tiếp; không tự reset dữ liệu trong lượt đo AI này.

# Pilot footer 30 store — 2026-09-16

Đã reset đúng30 stores, backup `/tmp/pw1-before-footer-30-20260916.dump`, giữ login accounts. Batch `b729f25d-75f9-4fd6-b51f-27554061d0aa` chạy concurrency5 từ đầu: 30 completed_with_warnings, 0failed/skip, wall55.914s (không gồm reset). Read-back157pages gồm404, branding/contact/social/SEO khớp cả30. Đã publish lại30 trên local qua API. Footer actual:26simple,2minimal(store959/1041),2centered-stack(store602/1044),0dark-gradient. Prompt mới chưa tạo khác biệt lớn về phân bố; chưa được xem là nghiệm thu visual.

Reset phát hiện cleanup filename validator thiếu ico; đã thêm ico kèm regression assertion. 154 migration tests và TypeScript pass. Evidence riêng ngoàiGit: `~/Work/pw1-exports/reconstruction/pilot-footer-30-20260916/`. Các siteIDs đã đổi; dùng `/sites/pw1-{storeId}`. Server local được khởi động Next dev không turbopack, log `/tmp/pw1-footer-next.log`.

# Cập nhật 2026-09-16 — Footer AI

Đã sửa prompt native migration để gửi đầy đủ `source.site.footer` và `source.site.navigation`. Footer output enum và danh sách cho AI lấy trực tiếp từ FooterConfigSchema (simple/minimal/centered-stack/dark-gradient), không hardcode tập con. Hướng dẫn AI chọn theo nội dung/phong cách, không random để tạo khác biệt; cảnh báo hạn chế hiển thị của minimal khi có tagline/socials/nhiều nhóm link. Footer vẫn global trong mỗi site, binder giữ nguyên nội dung nguồn.

15 tests native AI và TypeScript pass. Chưa gọi AI thật để đo phân bố variant mới; chưa regenerate 30 site đang published. Các site cũ chưa thay đổi. Mục “footer CHƯA sửa” bên dưới là trạng thái lịch sử đã được thay thế bởi cập nhật này. Các mapping BE và staging pilot vẫn pending.

# Context mới nhất — 2026-09-15

Phần này thay thế trạng thái cũ bên dưới. Branch vẫn là `levietducprime/research-f35-spike-f35-11-nghi-n-c-u-t-i-t-o-web`. User yêu cầu lưu context và commit/push; chưa yêu cầu merge hoặc triển khai production.

## Việc tiếp theo: footer AI (đã điều tra, CHƯA sửa)

- User thấy footer các site gần như giống nhau dù migrate qua AI. DB của 30 site: 28 `simple`, 1 `centered-stack`, 1 `dark-gradient`.
- Footer global dùng chung giữa các page của cùng site là chủ ý. Vấn đề là lựa chọn giữa các site thiếu đa dạng/phù hợp nội dung.
- `src/lib/migration/pw1-native-ai.ts`: schema/prompt chỉ mở simple/centered-stack/dark-gradient, bỏ sót minimal có trong footerMeta. User prompt chỉ có site name và page components, KHÔNG gửi source.site.footer/navigation cho AI chọn layout.
- Hướng đã giải thích: truyền đủ nội dung footer, dùng danh sách variant native hiện có; để AI chọn phù hợp nội dung, không random chỉ để khác nhau. User đồng ý rồi yêu cầu bàn giao trước. Chưa implement hướng này.

## Trạng thái migrate hiện tại

- 30/30 store completed kèm warnings sau nhiều lượt retry, không phải một lượt full đều thành công.
- Tất cả 30 site đã publish trên LOCAL theo yêu cầu test; kiểm tra anonymous homepage HTTP 200 đủ 30. Không publish production.
- Link: `http://localhost:3000/sites/pw1-{storeId}`. `/preview/{siteId}` không phải link anonymous.
- Store IDs: 205,1047,1127,1111,1044,1042,1041,1036,1033,1004,1023,986,963,959,957,949,627,602,645,253,655,416,185,567,18,743,939,495,257,546.
- Input riêng ngoài Git: `~/Downloads/stores-205-285-pw2-current-schema-collection-only(1).json`, 30 bundles. Full PW1 source archives và reports: `~/Work/pw1-exports/reconstruction/`. Các file này/DB/storage không đi theo git push; máy khác cần bản copy riêng hoặc export lại.
- DB local localhost:5433/primeweb, Docker primeweb-db; PW1 snapshot chỉ đọc. Backup trước reset gần nhất `/tmp/pw1-before-full-30-rerun-20260915.dump`.
- Lượt full gần nhất d1c65e1a-252c-45a8-a5f5-203dbe1cbfb8: 22 success / 8 fail / 0 skip, 58.209s chưa tính reset. Retry các fix sau đó đạt 30. Không dùng số này làm cam kết throughput 1350 store.

## Những thay đổi trong lần commit này

- P0/P1 batch reliability: DB ledger/report JSON/CSV, retry classification, limits/readiness, receipt/recovery, rollback website write, cleanup media lỗi sau khi drain batch. Xem `docs/migration/pw1-website-cli.md` và `plans/260914-pw1-batch-reliability/plan.md`.
- Một lệnh npx/CLI, Promise pool trong process, mặc định 2 tối đa 5. AI/media chuẩn bị song song; ghi website tuần tự, cùng source account tuần tự. Không external worker.
- Fix transaction PG: pin connection vì nhiều bản pg làm Drizzle nhận nhầm Pool. Regression integration scripts trong scripts/tests; không chạy trên shared/production DB.
- User yêu cầu bỏ host allowlist: đã bỏ, giữ HTTPS/no credentials/custom port, redirect:error, timeout30s/10MiB. ICO dùng MIME set và uploader chung PW2, filename .ico. Store185 đã pass và favicon HTTP200.
- Banner store18: nút status=0 thì bỏ qua mode/default và URL CTA; không đọc object từ mảng rỗng khi disabled. Giữ ảnh/banner. Đã retry pass.
- URL page: ưu tiên trường url nguồn thay vì slug cũ. Store257 trước đó 3 URL khác nhau nhưng slug đều new-page-1; đã pass.
- Cùng store trùng URL: DB CÓ unique index pages_site_slug_uniq (site_id,slug) WHERE deleted_at IS NULL. Không bỏ index. Giữ đủ page ID; trang đầu giữ route, trang trùng gán suffix -pw1-PAGE_ID tránh collision. Chỉ một homepage. Page-ID links được remap, URL links nguyên gốc không đoán page. routeChanges/warnings ghi lại URL gốc và mới. User sẽ tự xóa trang dư. 1036/986 giữ 8 page nguồn mỗi store +404, đã pass.
- Storefront 404 subpages: migration lưu bare slug nhưng route tìm leading slash. Owner và cached visitor lookup nhận cả hai; cache key v2 để tránh cache miss cũ. Store253 E2E thật click cả3 menu rồi reload anonymous HTTP200. Test ở tests/pw1-migrated-page-routes.spec.ts cần fixture local published253; đã chạy Chrome installed bằng config tạm (đã bỏ).

## Validation và giới hạn

- Lượt tổng unit gần đây 149 tests pass trước fix disabled CTA; sau đó thêm CTA regression, suite collection5 tests pass. TypeScript pass sau các thay đổi. Real migration và read-back đã dùng để xác nhận ICO, duplicate pages, CTA.
- Chạy lại toàn bộ tests migration + tsc trước commit bàn giao để ghi số mới nhất trong phản hồi.
- Known warnings còn nguyên: BE products/blog import riêng, source mapping chưa xác minh, một số CTA/filter/search chưa hỗ trợ. Completed không có nghĩa đã đạt toàn bộ parity PW1.
- Không đưa secret, token, account password, full dump hoặc input khách hàng vào Git.

---

## Lịch sử bàn giao trước (có thông tin đã cũ)

# Context bàn giao — PW1 migration & Rich text PW2

Cập nhật: 2026-09-11. Đây là bản tóm tắt context để tiếp tục trên máy khác, không phải transcript nguyên văn. Đọc file này trước khi sửa code tiếp.

## Điểm tiếp tục

- Branch: `levietducprime/research-f35-spike-f35-11-nghi-n-c-u-t-i-t-o-web`.
- Commit implementation mới nhất tại thời điểm viết: `dd3c66dc0` — `feat(f35): support pw1 collection imports and inline rich text editing` (35 files).
- Commit trước đó: `5d46971d9` — migration CLI batch.
- Người dùng đã yêu cầu commit/push tất cả thay đổi và bàn giao context để làm ở nhà. Không có yêu cầu merge, publish hay migrate production.
- Việc cuối cùng đã làm: ẩn nút Media, thu gọn ô font 140px/cỡ chữ 64px, thêm border và nền trắng cho ô Site font. Đã commit trong `dd3c66dc0`.

## Ý định và quyết định đã chốt

1. Migrate theo **store**, không theo từng user. Một user có thể có nhiều store.
2. Đầu vào **một file JSON chứa một array**; một script đọc và xử lý tất cả. Không sinh nhiều file JSON trung gian cho từng user/store. Mục tiêu tương lai hơn 1.300 users, chưa nghiệm thu quy mô production.
3. SQL dump PW1 đã restore trong Docker trên máy làm việc. Extract/convert SQL → JSON là bước riêng bên ngoài migration script.
4. Script phải gọi flow **generate website thật** của PW2 và lưu vào account đích, không chỉ xuất website JSON, không truyền sẵn `generatedResult`.
5. Giữ nội dung/cấu trúc component PW1, dùng block native PW2, có thể làm đẹp theo PW2; không cố dựng lại pixel-perfect website cũ.
6. Filter page/component/banner bị disabled/deleted. Bỏ menu trỏ page đã xóa, promote children hợp lệ.
7. Product listing dùng Products Grid lấy DB PW2. Blog listing dùng Blog List lấy DB PW2. DB trống thì block trống, không bịa data hoặc lấy snapshot làm product/blog giả.
8. BE import commerce/blog riêng. Brand CTA tạm bỏ; giữ ảnh/tên brand, chưa làm link. Category CTA vẫn cần map sang category đích (chưa xong).
9. Cart/order tracking phải bật tính năng native. Header search và một số filter/sort vẫn pending.
10. Không commit credentials hoặc dump dữ liệu khách hàng vào repo.

## Flow migrate hiện tại

Lệnh:

```sh
npm run migrate:pw1 -- /path/to/input.json --dry-run
npm run migrate:pw1 -- /path/to/input.json
npm run migrate:pw1 -- /path/to/input.json --rerun
```

- Lệnh không cần arg env/account/site/output/apply. Đọc `.env.local`/`.env`; biến môi trường đã có được ưu tiên.
- Mặc định apply; dry-run không gọi AI/ghi DB. `--rerun` regenerate store đã hoàn tất, kể cả input không đổi. Chỉ replacement draft site.
- Ledger DB giữ mapping/progress/retry, skip completed input không đổi; xử lý tuần tự; lock chống batch đồng thời.
- File đầu vào hỗ trợ cả compact website array và **BE collection-bundle array mới**.
- Luồng: CLI → parse/validate toàn bộ array → `runPw1Batch` → adapter → native blueprint → `applyPw1Website` → shared `generateSiteService` → native AI design + deterministic binder → import media/persist pages.
- Không import products/orders/blog bodies; không publish site. Generate/page replacement không phải một transaction hoàn chỉnh; retry có thể trùng media.

Mapping chính:

| PW1 | PW2 |
|---|---|
| Hero banner | Hero; nhiều slide dùng slideshow, không tách mỗi slide thành block |
| Small banner | Carousel images/cards |
| Category listing | Một Carousel cards |
| Product listing | Products Grid, data DB PW2 |
| Article listing | Blog List, data DB PW2 |
| Rich text | Block slug `custom-html`, tên UI **Rich text**; một số embed được script tách thành Video |

File code chính:

- `scripts/migrate-pw1.ts`: CLI duy nhất.
- `src/lib/migration/pw1-collection-input.ts`: adapter BE export mới, tự đọc domain/menu/nested component/model_settings/banners/shortlists.
- `src/lib/migration/pw2-website-input.ts`: adapter compact input.
- `src/lib/migration/pw1-batch-input.ts`, `pw1-batch.ts`: validate/hash, provision account/tenant/site, ledger và orchestration.
- `src/lib/migration/pw1-contract.ts`, `pw1-native-ai.ts`: contract/blueprint, chọn native block và bind nội dung.
- `src/lib/migration/pw1-media.ts`, `pw1-apply.ts`: media, backup/ownership, shared generation.
- `src/lib/ai/generate-site-service.ts`: service dùng chung API và CLI.
- `scripts/sql/pw1-migration-batch.sql`, `scripts/db-setup.js`: ledger/schema.
- `docs/migration/pw1-website-cli.md`: mô tả CLI chi tiết.

Giữ các block legacy `rich-text`, `content-cards` và Hero sourceLayout vì DB cũ còn dùng. Không xóa chúng nhầm với Rich text mới.

## Data và môi trường máy làm việc — KHÔNG đi theo git

Máy làm việc đã dùng:

- Input BE mới nhất: `~/Downloads/stores-205-285-pw2-current-schema-collection-only(1).json`. Tên vẫn có 285 nhưng người dùng đã xóa store 285; bản kiểm tra chỉ còn **205**.
- Compact input cũ: `~/Work/pw1-exports/reconstruction/amelina.website-input.v1.json`.
- Website PW1 đối chiếu: `https://amelina.web.dev.ecommercehub.my/`.
- Mapping DB local đã dùng: source store 205 → user 1847, tenant 1821, site 3659; owner `amelina@yopmail.com`.
- Preview/editor local: `/preview/3659`, `/editor/3659` trên localhost:3000.
- Batch BE cuối cùng thành công trước đợt sửa Rich text: 9 content pages + 404, locale MS; có runtime pages/filter components được bỏ hoặc báo pending.
- Export/log/screenshot thường nằm ở `~/Work/pw1-exports/reconstruction/`; các script Playwright kiểm tra gần đây nằm ở `/tmp/`. **Không giả định chúng tồn tại trên máy ở nhà.**
- Có account thử thứ hai `amelina2@yopmail.com`; không dùng nó để suy ra mapping store chính.

Để tái hiện ở nhà, cần chuyển file input và cấu hình `.env.local` qua kênh riêng, và truy cập/copy DB, object storage tương ứng. Git không mang DB, Docker volumes, media hay secret. **Không giả định ID 3659/1847/1821 có cùng ý nghĩa ở DB khác.** Không dùng production env để thử script. Kiểm tra dry-run và DB đích trước khi apply.

Source PW1 dùng đối chiếu nằm ngoài repo PW2:

- `~/Work/primeweb-cms-frontend/src/components/WebBuilder/Page/Edit/EditConfigRichText.vue`
- `~/Work/primeweb-cms-frontend/src/components/Editor/VCKEditor.vue`
- `~/Work/primeweb-cms-frontend/src/utils/ckeditor.js`
- `~/Work/primeweb-frontend-v2/src/assets/style/ckeditor.less`

Nếu cần nghiên cứu tiếp ở nhà thì cần checkout hai repo PW1 tương ứng. Source local chưa được xác nhận là đúng revision đang deploy production.

## Hero / Carousel đã sửa

- Hero slideshow có Next/Prev cùng style Carousel.
- Ratio Hero slideshow thống nhất 16:9, không đổi chiều cao theo từng slide có/không có text.
- Autoplay vẫn **5 giây**. Next/Prev/dot reset đủ 5 giây, kể cả bấm dot đang active. Không tự đổi thành 3 giây: đó chỉ là ví dụ của người dùng.
- Khoảng cách tâm dot giảm từ 52px xuống 24px; hit area 24×44px. Carousel đã đồng bộ dot.
- Chưa có UI cấu hình animation/timing/add-slide hoàn chỉnh như PW1; xem component gap report.

## Rich text hiện tại: Tiptap, không phải CKEditor

Lịch sử quyết định UX:

- Ban đầu dùng CKEditor trong modal, sau đó inline rồi floating; người dùng không hài lòng modal, khung to, nút Apply/Cancel lớn, block nhảy chiều cao.
- Đã chuyển sang **Tiptap** để tùy biến UI và không có badge. Không chuyển ngược CKEditor hoặc ẩn badge CKEditor bằng CSS.
- Rich text giữ slug/schema `custom-html` + trường `html`, chỉ đổi tên UI để dữ liệu cũ vẫn dùng được; không đổi schema DB.
- Bấm nội dung để sửa. Không có dòng “Edit rich text inline”, không có modal, không có hàng nút Apply/Cancel.
- Toolbar hiển thị **toàn bộ tool**, ghim đầu block, full width; màn hình hẹp xuống hàng. Không dùng More tools.
- Giữ viền xanh 2px và block action bar (kéo/nhân bản/AI/xóa). Có offset bar để tránh đè toolbar.
- Giữ nội dung readonly đến `onReady` để tránh nháy trắng; test từng thấy 14 frames trắng, sau fix 0.
- Click ngoài áp dụng thay đổi; Esc hủy phiên sửa; Undo qua editor store. Khi chưa thay đổi, không serialize lại vô ích.
- **Media toolbar hiện đã ẩn theo yêu cầu**, nhưng extension/sanitizer giữ media có sẵn. Video mới nên dùng native Video block.

Files:

- `src/components/editor/RichTextBlockEditor.tsx`: Tiptap + full toolbar + upload + edit lifecycle.
- `rich-text-block-editor.css`: UI và nodeview CSS.
- `rich-text-image.ts`: inline/left-wrap/right-wrap/standalone; spacing, resize, alt, caption, percent width; ResizableNodeView riêng.
- `rich-text-extensions.ts`: giữ wrapper/class/style và caption nguồn.
- `normalize-pw1-rich-html.ts`: chuẩn hóa CKEditor figure/image-inline, caption có định dạng và percent width; bỏ figure.media rỗng.
- `rich-text-media.ts`: media atom/nodeview. Placeholder “Embedded media” đã bị bỏ, node media không có preview không hiện chữ đó nữa.
- `rich-text-colors.ts`: màu HSL/RGB/named → hex cho picker.
- `src/blocks/custom-html/html-safety.ts`: sanitize dùng chung editor/renderer; media provider allowlist; không cho srcdoc/iframe tùy ý.
- `src/blocks/custom-html/index.tsx`, `rich-text-content.css`: renderer, active border và preserve readonly lúc loading.
- `src/components/editor/PreviewFrame.tsx`: message lifecycle, update store + UPDATE_BLOCK_DATA về iframe; active Rich text index riêng với selected/hover.
- `SettingsPanel.tsx`, `BlockLibraryPanel.tsx`, block registry/meta, add-section: tên và hỗ trợ thêm block.

Tính năng đã thêm:

- Heading, bold/italic/underline/strike/code, list, alignment, link, quote, undo/redo.
- Font PW1 gồm Tahoma, font hiện tại; cỡ tùy ý px/em/rem/% và presets 9/11/13/17/19/21…; picker chuẩn hóa HSL/RGB.
- Ảnh upload/URL, resize, alt, spacing, 4 layout. **Không có text tự chảy cả 4 phía quanh ảnh giữa**; CKEditor 5 cũng không có mode này mặc định.
- Caption toggle/edit. Caption HTML nguồn giữ định dạng đến khi sửa qua ô text caption (lúc đó thay bằng plain text người dùng nhập).
- Giữ ảnh width %, kéo resize chuyển sang px.
- Table thêm/xóa row/column, merge/split/delete.
- Typography extension cho text transformations; các class text-tiny/small/big/huge.
- Media support khi đọc dữ liệu: YouTube, Vimeo, SoundCloud player, Dailymotion embed, Spotify embed; code chèn file HTTPS video/audio vẫn có nhưng nút Media bị ẩn. Không khẳng định mọi provider PW1 được hỗ trợ.

Tiptap đã có trong package.json từ commit `095d71e43` ngày 2026-04-03, tác giả tgiangk1. Phiên này thêm extension table/text-align/text-style/typography 3.22.1. CKEditor còn phục vụ blog editor khác nên không gỡ dependency bừa.

## Kiểm chứng và vấn đề còn mở

Kiểm tra ngay trước commit dd3c66dc0:

```sh
npx tsc --noEmit
npx vitest run src/__tests__/unit/editor/rich-text-tiptap.test.ts src/__tests__/unit/migration src/__tests__/unit/blocks/all-block-schemas.test.ts src/__tests__/unit/lib/ai/add-section.test.ts src/__tests__/unit/lib/ai/add-section-locale.test.ts
```

Kết quả: TypeScript pass, **414 tests / 14 files pass**. Rich text có 11 ca riêng, gồm HTML round-trip, 4 image layouts, formatted caption, width %, trusted media/sanitize và màu. Đã có kiểm tra UI thủ công qua Playwright cho typing/bold/table/cancel, image layout, font/size/code/media/caption; không phải full E2E regression production.

**Vấn đề đang mở quan trọng:** `/api/sites/3659/pages` trả HTTP 500 trong nhiều lần test UI local; panel Pages hiện “No pages found”. Chưa điều tra root cause. Không được xem thông báo “Saved” hoặc UI cập nhật là bằng chứng lưu DB đã nghiệm thu. Phần kiểm tra apply/undo và HTML round-trip trước đây không thay thế kiểm chứng lưu → reload từ DB. Nếu tiếp tục nghiệm thu, ưu tiên kiểm tra API này và database schema/log trước.

Các phần migrate còn pending: category CTA map sang DB đích, filter/sort/product-selection semantics, header search, mapping tới site BE đã provision sẵn, load test batch production. Brand CTA và blog import đã được người dùng chủ động hoãn/giao BE, không tự mở rộng lại.

Các báo cáo:

- `docs/migration/pw1-rich-text-parity-audit.md`: đối chiếu source PW1, có mục cập nhật implementation cuối file. Các bảng thiếu sót đầu file là trạng thái trước bổ sung, **không đọc chúng như trạng thái mới nhất**.
- `docs/migration/pw1-pw2-banner-gap-report.md`: report 6 component và editor settings trước đợt Rich text mới; nhiều nhận xét Custom HTML chưa có editor đã lỗi thời.
- Không tuyên bố “100% tương đương PW1” chỉ dựa số nút hoặc unit tests. Chưa kiểm tra toàn bộ dữ liệu production/provider/HTML đặc biệt.

## Gợi ý câu mở phiên trên máy ở nhà

> Đọc `docs/migration/SESSION-HANDOFF.md` trên branch hiện tại, kiểm tra trạng thái repo/môi trường rồi tiếp tục phần PW1 migration và Rich text Tiptap từ commit dd3c66dc0. Đừng migrate lại hay sửa dữ liệu trước khi xác định DB đích.

Lưu ý phối hợp: người dùng thích làm trực tiếp, sửa nhỏ rồi quan sát UI, không hỏi lại quyền cho thay đổi đã được yêu cầu. Đọc screenshot cẩn thận; “full toolbar” nghĩa hiển thị đủ công cụ, không chỉ kéo rộng thanh vẫn có More tools. Không tự merge/publish/gửi thông báo hoặc mang mật khẩu vào tài liệu bàn giao.

## Internal links repair — 2026-09-16
- Added `pw1-links.ts`, used by compact adapter for known same-store page URLs in navigation/footer/banner/category CTA and Rich text anchors. Preserve query/hash and external/media URLs. Preserve Page-ID category CTA previously omitted.
- Unmapped entity filters and unknown pages remain source links with report warnings; 30-store input audit has 96 distinct-per-store unresolved URLs (`/tmp/pw1-link-audit.json`). Do not report all PW1 links removed.
- Patched 57 fields in 9 local pilot stores (current/version blocks), backed up exact changes to `/tmp/pw1-link-repair-backup.json`, then republished all30. No content generation/reset performed.
- Custom HTML/Rich text local runtime prefixes internal anchors with `/sites/{slug}`; editor data remains portable.

## BE destination/category mapping — 2026-09-16
- Optional per-entry/bundle `destination` declares existing draft tenant/site and product category ID pairs + source listing page ID. No guessing from names.
- Provisioner can attach to existing BE site only after active owner/site/category scope verification; existing store mappings cannot be redirected. Categories checked again inside atomic website write. No new schema/env vars.
- Verified category/category_id links become native categoryId links on mapped product listing; its native filters are enabled. Other entity types/listing selection semantics remain pending.
- `be-mapping.json` artifact and JSON/CSV `beMapping` summarize verified declarations. Broader BE readiness remains explicitly unverified, not overridden by category mappings.
- 185 migration unit tests, TypeScript and real local DB/browser E2E pass. E2E creates isolated fixtures, verifies site reuse/no extra tenant, rejects invalid scope, clicks CTA and proves only matching category product returned; cleans fixtures.
- Current 30-store input has no destination mapping. No reset/regeneration or guessed BE IDs applied to those sites this turn. Need actual BE ID pairs to activate category mapping there. Product/blog/brand mapping and filter/sort fidelity are still next stages.

## Non-BE quality audit / CI — 2026-09-16
- CLI adds `audit FILE --audit-base-url ORIGIN --audit-output REPORT.json`, or optional audit flags after successful run/retry. Published-only anonymous QA; draft sites explicitly not checked, never auto-published. JSON/Markdown + incremental JSONL, per-store severity and page/block/viewport evidence.
- 30-store audit completed:127 pages,0 scanner failures,1 internal link404,77 warnings,167 per-page BE-link findings. Unique source entity URLs64; source page URLs17. Ten stores exceed bounded scroll scan; lower sections remain unchecked. Report at private pilot root `quality-report.json`, user summary `quality-summary.md`.
- Real findings:963 Home has stale source HTML `/products-services` but page is `/product-service`;205 Home embeds absolute localhost root links in source HTML. Do not blindly rewrite similar names or unrelated external URLs.
- An initial tsx DOM serialization failure was fixed using a local __name shim (not injected into site globals); its invalid report was replaced by the full successful rerun.
- Migration report adds warningGroups (BE/presentation/functionality/links/other). Manual GitHub workflow added for dry-run/run/retry + private input/env secrets and report artifacts; YAML/bash validated, not dispatched.
- 188 unit tests, browser audit fixture and TypeScript passed. No data reset, migration generation, publishing or commit/push this turn. Carousel theme extraction and media-cleanup performance tuning are still pending.

## 2026-09-16 follow-up: QA fixes, source carousel evidence, cleanup

User deferred GitHub Actions. Workflow draft remains local/uncommitted. Remaining migration work and context are being committed on the current branch.

- Added per-store `linkCorrections` (exact from + source pageId + review reason), validated before any migration and included in input hash. Pilot input has reviewed corrections for 205 localhost root -> source home 646, and 963 /products-services -> source page 5135. Original input backed up at /tmp/pw1-input-before-reviewed-links.json.
- Native checkout route is now included in source link resolution; no payment settings/import inferred. Remaining source about-us links (645,1033,1042) have no confirmed destination and remain warnings.
- Removes empty unstyled editor links and names external image-only links when alt/title/aria name absent; Google Maps gets a purpose-specific label.
- Applied scoped local HTML repairs (4 rows incl latest versions) and checkout navigation/footer repairs (106 rows incl latest versions). Backups /tmp/pw1-reviewed-repair-sql-backup.json and /tmp/pw1-checkout-repair-backup.json. No reset/AI regeneration. Generic Payload full-page update encountered id uniqueness validation and was rolled back; used narrow transactional SQL patches instead, preserving older versions.
- Added CLI-only pw1-carousel-evidence module. Reads rendered Swiper image frames, exact media matching and conflict rejection; explicit source config wins. Existing brand scan supplies evidence and batch writes carousel-evidence.json. Unavailable/non-Swiper/inner-page-only source layouts still report unverified; not a complete legacy-theme catalog. Real source store253 scan returned no frames, so it was NOT changed to a guessed ratio.
- Cleanup uses conservative pages/sites preflight (retention only), preserving locked authoritative checks before delete; reset scans union 20 table probes per round trip. No unlocked deletion or cleanup during generation introduced.
- Audit scroll bound raised 20 ->160 steps; still reports SCAN_LIMIT when exceeded. Follow-up audit artifacts /tmp/pw1-quality-followup.json*.
- Checkout global navigation required updating sites.global_blocks as well (14 fields backed up at /tmp/pw1-checkout-global-backup.json). Republished the 17 affected local pilot sites to invalidate public caches; results /tmp/pw1-reviewed-publish-results.json.
- Audit scrolling also bypasses CSS smooth scrolling and waits for a stable bottom after initial hydration. Intermediate audit artifacts contain stale findings from before republish; use the final completed audit only.
- Deferred workflow draft moved outside the checkout to the pilot `reviewed-fixes/pw1-migration.workflow-draft.yml` artifact; no Actions workflow is included in this commit.
- Follow-up browser checks: 6 passed; 194 migration unit tests (22 files), TypeScript and real DB/storage cleanup fixtures passed. Source carousel measured-frame test also rejects fractional visible counts that PW2 cannot represent faithfully.
- Final reconciled QA: 30 stores / 127 pages desktop+mobile; 0 errors, 0 skipped/failed, 3 warnings (unmapped About Us on stores 645,1033,1042), 167 BE link findings. No remaining scan-limit/unnamed-control findings after targeted rechecks of 655 and 743. Intermediate concurrent local checks hit request timeouts; sequential rechecks succeeded. Final report `pilot-carousel-30-20260916/quality-reviewed-final.json` preserves source-run provenance; Markdown companion available.
- Store655 contained an empty styled citation anchor from pasted source HTML; migration now names these external decorative links as well as image links. Patched current/latest local HTML, backed up `/tmp/pw1-final-controls-backup.json`, republished store655, confirmed rendered aria-label.
