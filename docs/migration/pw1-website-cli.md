# PW1 website migration CLI

## Automatic prepared input

```sh
npm run migrate:pw1
npm run migrate:pw1 -- --dry-run
npm run migrate:pw1 -- --store 205
# Optional explicit input: process only this file
npm run migrate:pw1 -- /external/prepared/master-0001.json
```

Without a file, the CLI searches `.migration/runs` (including nested `import-runs`) and selects the completed BE run whose `run.json` was modified most recently. It prints that run and reads its completed `prepared/destination-manifest.json`. All listed master parts are checked against their destination output hashes before any migration starts, then processed sequentially in manifest order. Exporter artifacts and incomplete BE runs are not selected. An invalid newest completed handoff fails rather than silently falling back to an older run.

Each part runs in a fresh process with the existing migration/publish/audit flow; audit reports remain beside each input file. Concurrency, retry and operational budgets apply per part. Failed parts are recorded while later parts continue. After the first pass, only failed parts are retried once, using ledger skip semantics (without `--rerun`) so successful stores are not regenerated. Remaining failures produce a nonzero exit. Each invocation writes `parts.jsonl` and `summary.json` under the selected BE run’s `website-runs/<session>/`, including file, pass and exit code. Integrity errors stop execution immediately; Ctrl+C does not trigger retries. Rerunning the command reuses the database ledger. If a newer BE run has completed since then, automatic selection changes; pass an explicit file to pin an older part. `--store` selects its containing part. A shared `--audit-output` is rejected when multiple parts are selected to prevent reports overwriting each other. Ctrl+C stops the current process and prevents subsequent parts from starting.

## Current batch command

```sh
npx tsx --require ./scripts/seed-preload.cjs scripts/migrate-pw1.ts /external/pw1-websites.json
```

This is the complete normal flow: validate → migrate (up to 5 active stores, up to 3 total attempts per store with automatic retry) → orphan-media cleanup → automatic publish → public audit. Failed stores exhaust their retry budget and are recorded without blocking other stores. No concurrency/attempt/retry/audit flags are required. Operational flags below are advanced overrides, not additional required steps.

Audit uses the existing `NEXT_PUBLIC_SERVER_URL` and writes `INPUT.json.migration-audit.json`, with `.md` and `.jsonl` companions beside the input. Install Chromium and configure the running destination app before execution. Re-running the same command resumes from the database ledger, skips unchanged completed generation and retries publication when needed; no reset or separate `retry` command is required. A stopped/killed process cannot restart itself.

The positional file is **one JSON array**, with one object per PW1 store. The command applies by default and calls the real shared website-generation service with PW2 native blocks. SQL dump extraction and conversion remain a separate external step.

```json
[
  {
    "sourceUserId": "517",
    "sourceStoreId": "205",
    "owner": { "email": "amelina@yopmail.com", "firstName": "Ameline 2001 Beavis" },
    "source": { "websiteUrl": "https://amelina.web.dev.ecommercehub.my" },
    "website": {
      "name": "Amelina Bevis",
      "locale": "en",
      "branding": {},
      "navigation": [],
      "footer": {},
      "pages": []
    }
  }
]
```

This is a structural illustration; supply the actual validated page/component configuration in `website.pages`. The updated external Amelina input retains 3 source pages and 18 components, with one filter component explicitly pending. Multiple stores belonging to one user repeat the same owner identity and use distinct source store IDs. There is no fixed input file size limit. The CLI reads and parses the complete JSON file in memory; each store is validated before processing, and malformed stores are recorded without blocking unrelated valid stores.

The preload reads `.env.local` / `.env` from the working directory; existing process environment takes precedence. Configure the destination database, Payload secret, OpenAI and media storage there once. No `--env-file`, account, site ID, output directory or `--apply` argument is required for the batch command.

- Add `--dry-run` to validate and summarize without DB or AI calls.
- Destination accounts must already exist: accounts are matched by email and the migration never creates users. A store whose owner email has no destination account fails with `USER_NOT_IMPORTED`; run the BE user import first, then retry the same input.
- Each previously unmapped source store gets a new tenant, draft site and default FREEMIUM subscription. Paid plans and commerce records are not imported. Account, membership, site and source-ID mappings commit together.
- By default, up to two stores prepare concurrently; website writes are serialized. Stores belonging to the same account run sequentially. A store failure is recorded and processing continues; the command exits nonzero when any store fails.
- Rerun the same command to retry failed stores. Completed stores with unchanged input are skipped. Changed completed input requires `--rerun`; this also explicitly regenerates unchanged completed stores. Replacement requires a draft site.
- Progress, mappings and generation/backup artifacts are stored in `pw1_migration_accounts`, `pw1_migration_stores`, `pw1_migration_attempts` and `pw1_migration_batches`. No per-store JSON files are generated. These tables are installed by `db-setup.js` and bootstrapped idempotently by the command.

A database-wide advisory lock prevents overlapping batch commands. Retries reuse the mapped account/tenant/site and tenant-keyed source media cache. Site/page replacement and its commit receipt are atomic; media preparation remains outside the transaction for reuse. The website adapter supports English/Malay and single-segment paths. Product/blog blocks read PW2 database records and show their native empty states when no records exist. Product filters and source-specific sorting remain pending. The command does not import products, blogs or orders. Successful stores are automatically published after migration and cleanup.

Local verification: the Amelina array reused user 1847 and provisioned tenant 1821/site 3659. After one rejected AI design, the same command succeeded using that mapping; a subsequent identical run skipped the completed store. Production execution across 1,300+ users has **not** been load-tested.

### In-process concurrency

```sh
npx tsx --require ./scripts/seed-preload.cjs scripts/migrate-pw1.ts input.json
# Optional: raise the bounded pool after a representative pilot.
npx tsx --require ./scripts/seed-preload.cjs scripts/migrate-pw1.ts input.json --concurrency 5
```

`--concurrency` defaults to **5**, accepts **1–5**, and counts complete active store jobs, including jobs waiting to persist. Use `1` for the original sequential behavior. A free slot takes another store immediately; it does not wait for a fixed group to finish. Stores sharing a source account never overlap. Completion/report order may differ from input order; identify results by `sourceStoreId`.

AI and image downloads can overlap. Provisioning, actual media creation and website persistence share the existing in-process Payload adapter gate. The CLI pins each transaction to one PostgreSQL connection, including Payload upload transactions, to avoid driver Pool-class mismatches. A website transaction opens only after preparation finishes and the write gate is acquired; no database transaction is held while waiting for AI. Snapshot checks, verification and the commit receipt remain inside that transaction. The bounded pool also bounds prepared results waiting in memory. Existing per-account generation rate limits still apply.

The same command drains active jobs before shutting down Payload. Automatic orphan cleanup runs after the pool drains because its reference checks lock tables. No worker service or additional terminal is needed. The concurrency limit is recorded with batch limits. Local tests verify overlap and isolation; this does not establish throughput for 1,350 production stores.

## Active flow

`migrate-pw1.ts` → validate the complete array → `runPw1Batch` → adapt website input → `createNativeBlueprint` → `applyPw1Website` → shared `generateSiteService` → native AI design/binder → media import and page persistence.

The batch CLI accepts an optional positional file; omitting it selects the latest completed BE prepared handoff. The old raw-dump/single-store arguments, artifact-only generation, source-layout generation and file-based resume have been removed. Retry uses the same array and database ledger; each retry of a failed store calls AI again. Extraction/conversion from SQL stays outside this flow.

Native outputs: Hero, Carousel, Products Grid, Blog List, Custom HTML, Video, Navigation and Footer. Image-backed category listings use Carousel `cards` or Portfolio Grid variants. Category items retain source content; verified destination category mappings can replace legacy links (see below).

`website.features: { "cart": true, "orderTracking": true }` activates the native cart system. PW2 order lookup is coupled to cart. The adapter also recognizes same-origin legacy cart/tracking navigation routes and removes those old links.

## Retained compatibility

The `rich-text`, `content-cards` and Hero `sourceLayout` renderers/schema remain only to support previously persisted experimental pages. The local DB still contains those blocks. They are not generated by the current migration flow. No database records or historical sites are deleted during code cleanup; remove this compatibility only after those sites have been explicitly converted or retired.

## Files

- `scripts/migrate-pw1.ts`: the sole CLI entry.
- `scripts/sql/pw1-migration-batch.sql`: ledger schema, also loaded by `scripts/db-setup.js`.
- `src/lib/migration/pw1-batch-input.ts`: array validation, hashing and retry decisions.
- `src/lib/migration/pw1-batch.ts`: provisioning, locking, progress and orchestration.
- `src/lib/migration/pw2-website-input.ts`: public website input adapter.
- `src/lib/migration/pw1-contract.ts`: internal contract and native blueprint validation.
- `src/lib/migration/pw1-native-ai.ts`: native AI design and deterministic content binding.
- `src/lib/migration/pw1-media.ts`: trusted source image import.
- `src/lib/migration/pw1-apply.ts`: ownership checks, snapshots and shared-service invocation.

The component gap report is a separate planning document; unimplemented component/editor improvements are not part of this cleanup.

## BE collection export input

The same command now also accepts an array of collection bundles (`tenants`, `users`, `sites`, `pages`, `media`, etc.). It resolves owner/tenant/store identities and projects raw PW1 nested component data into the native website contract entirely in memory. No intermediate input file is created and commerce/customer/order records are not passed to AI.

The adapter reads `sites.domain`, branding and menus; page `type`, status/deleted_at and position; component definitions/defaults plus model_settings; banners and shortlist_items. Only active undeleted content is considered. Runtime cart/checkout/tracking pages use native commerce features. Empty banner/rich-text/category components are reported and skipped. Deleted menu targets are removed and valid children promoted. Footer text-only content becomes tagline, and empty link columns are omitted (native footer permits four nonempty columns).

For collection bundles, `sites[].sourceLocale` (`en`/`ms`) selects the PW1 storefront language; when omitted, the adapter uses `en`, matching PW1’s unprefixed public routes. `sites[].locale` can contain the account/CMS preference and is not used to choose public menu labels. Normalized website inputs still use `website.locale`. An active rich-text setting whose `value` field is missing is rejected with store/page/component/setting IDs; an explicitly empty value remains an empty component. Re-export the missing content before retrying; the script must not silently publish a blank page. Native block limitations still apply: filter/sort controls and selected product/article semantics are reported as pending. Brand cards keep source image/name but no link; category links still use source URLs until destination mappings are implemented. Header search is reported as pending. Blog bodies/commerce import are handled by BE separately.

Reports print during validation and are saved as `collection-input-report.json` inside each database attempt's artifacts. No raw collection dump is saved there. A store with no active source pages fails validation rather than generating invented content. Existing local source-store ledger mappings are reused; this adapter does not automatically adopt arbitrary sites created by a separate BE import without destination mapping integration.

Site settings from collection inputs now pass through the native contract independently of AI design: branding logo/favicon, contact phone/email/address, supported social links, and SEO title/description/OG image. Symbolic SEO media references must resolve within the bundle. Assets use the trusted PW1 media importer; branding stores the imported public URLs and OG image stores its media relationship. Explicit empty source settings clear stale values. These settings are verified after persistence; a mismatch fails the migration attempt. Compact inputs without the optional settings object retain their previous behavior.


## Reliable batch operations

```sh
npm run migrate:pw1 -- input.json --dry-run
npm run migrate:pw1 -- input.json --max-attempts 3
npm run migrate:pw1 -- status
npm run migrate:pw1 -- status --store 205
npm run migrate:pw1 -- logs --store 205
npm run migrate:pw1 -- retry input.json
npm run migrate:pw1 -- retry input.json --store 205
npm run migrate:pw1 -- input.json --store 205 --rerun
```

- File JSON/array failures remain fatal. Per-store errors are saved in batch results, including failures before a destination account exists. Duplicate store identities and conflicting valid owner identities quarantine all conflicting entries.
- Default maximum is three attempts (allowed 1–5). Retryable timeouts, rate limits, selected connection/DB errors and upstream 5xx use capped exponential delay with jitter (at most 30.5 seconds). Permanent validation/identity/permission errors stop the store. The next store still runs.
- `retry` selects mapped failed/pending stores, plus unmapped stores with an earlier batch failure. Normal execution also processes new stores. Completed unchanged stores are skipped; changed completed input requires `--rerun`.
- Attempts record batch ID, stage, error code/message, retryability, attempt ordinal and a 15-second heartbeat. `logs` shows recent attempts and failing batch results (including invalid input); artifacts remain in the DB. `status` shows recent batches and store outcomes. Outputs are JSON and can be redirected to a private file.
- Store status remains `completed` internally for compatibility; `warning_count` and operator output distinguish `completed_with_warnings`. Missing supported settings/page/block output fails verification. Unsupported controls/category mapping and BE-dependent catalog/blog bindings produce warnings, not a claim that commerce data was imported.
- AI and media preparation run before taking write locks. The existing site/page timestamps are checked under lock to detect concurrent CMS edits. Site/pages/settings are written in one PostgreSQL transaction. Missing pages, changed block count/order or failed settings verification roll back. Migration never falls back to removing failed images.
- Media is keyed by tenant and source URL hash in `pw1_migration_media`; a deterministic filename also recovers the upload-before-cache crash window. The current media collection is global (no tenant column), so cache keys and tenant-prefixed filenames enforce migration reuse boundaries. Media assets may remain after failed attempts and are reused, rather than deleted while another reference might need them.
- A durable `pw1_migration_commits` receipt commits with site/page writes. If the worker dies before ledger completion, the next batch acquires the exclusive lock and reconciles stale attempts: receipt present → completed; no receipt → failed/retryable. Old interrupted batch records remain marked failed for audit.
- SIGINT/SIGTERM requests a stop at safe phase boundaries. Ongoing upstream calls retain their existing network timeouts; cancellation does not abandon a background promise that could write later. Losing the batch-lock connection requests the same stop. SIGKILL relies on PostgreSQL connection cleanup to roll back.

### Verification and limitations

Run deterministic tests with `npx vitest run src/__tests__/unit/migration`. Run real PostgreSQL rollback/worker-kill/recovery/media-cache tests with `npx tsx --require ./scripts/seed-preload.cjs scripts/tests/pw1-reliability.ts`; this refuses remote DB hosts and creates/cleans synthetic fixtures. It also uploads/deletes one test pixel using configured local storage. Do not run against a shared active migration database.

Preparation uses a bounded in-process Promise pool; website persistence remains serialized. There is no external worker queue, monetary cost budget, full-AI checkpoint resume, production load certification or automatic BE commerce coordination. Retrying generation may spend AI tokens again. The cache does not re-download external assets whose content changes behind an unchanged URL. Provision-stage failures are available in batch results; attempt rows start after provisioning. Operators must retain the input file and its mapping. Raw dumps and credentials should stay outside Git.

### P1: operational controls and reports

```sh
npm run migrate:pw1 -- input.json --max-generation-attempts 20 --max-batch-seconds 3600 --max-store-seconds 300 --min-generation-interval-seconds 5 --max-design-tokens 100000
npm run migrate:pw1 -- input.json --require-be-data
npm run --silent migrate:pw1 -- report --batch BATCH_UUID --format json > batch.json
npm run --silent migrate:pw1 -- report --batch BATCH_UUID --format csv > batch.csv
```

Limits are optional, positive integers (seconds ≤ 86400). `--max-generation-attempts` counts generation attempts across all stores/retries, not individual provider requests. `--min-generation-interval-seconds` spaces generation starts across the whole pool; shared-service requests within one generation may be more frequent. Start reservations and attempt budgets are serialized. Limit configuration is retained on the batch. Re-running a command starts a new budget.

Batch/store time limits are checked before new work and at media/generation/write/verify/commit boundaries. They do not forcibly abandon an in-flight network call or DB transaction. Calls retain their existing timeouts. A store time limit fails that store; global time/attempt/token limits defer remaining work. Deferred results carry a reason and nonzero batch exit status; `retry input.json` resumes pending/failed stores and unmapped deferred entries, skipping completed stores. A completed store that was explicitly selected for regeneration still requires `--rerun` again if regeneration did not start.

`--max-design-tokens` is a **soft, observed native-design budget**: already-started generations (up to the configured concurrency) may cross it and finish; once the observed limit is reached, another generation will not start. Native-design response usage is captured before validation, so invalid designs with a response still count. This excludes translation, credit probes and provider retries without a response; it is not a hard total-AI or monetary cap. JSON reports use `costUsd: null` and explicit usage scope, rather than inventing cost. Missing token measurements remain null. Configure provider-side spending limits separately when required.

Reports are read-only and need only DB configuration. They include result/error/warnings, attempts, elapsed time and observed design tokens, including deferred and validation-failed stores. CSV quotes cells and neutralizes spreadsheet formulas. Keep exported files private: errors and warnings can contain source content. Use `npm run --silent` to avoid npm banners in machine-readable output.

BE preflight counts active undeleted products scoped to destination site and published blogs scoped to tenant, only for enabled source listings. It records `not-required`, `missing-data` or `data-present-mapping-unverified`. Default execution permits native empty states with warnings. `--require-be-data` blocks missing required data before generation; unmapped data-dependent stores are blocked before provisioning. Existing completed stores are still skipped unless `--rerun` is supplied. Counts never certify source-to-destination IDs or complete BE import; automated adoption/mapping requires the BE contract and remains follow-up work.

Run local real-CLI P1 verification with `npx tsx --require ./scripts/seed-preload.cjs scripts/tests/pw1-batch-operations.ts`. It calls configured AI for three synthetic stores, checks budget/deferred retry/report/BE gate/dry-run and cleans its fixtures. Run on an idle local migration DB. Larger staging pilot still needs a staging destination and representative input; local tests do not certify production throughput.

### Cleanup unused migration media

Apply the SQL migrations with the normal `scripts/db-setup.js --migrate-only` deployment step before using cleanup. The media reuse ledger now records `last_used_at`; existing cache entries receive a fresh retention period on schema upgrade.

```sh
# List candidates only (default retention: 7 days since import/last reuse).
npm run migrate:pw1 -- cleanup-media --store 205
# Delete eligible orphan files through Payload's configured storage hooks.
npm run migrate:pw1 -- cleanup-media --store 205 --apply
# Bounded scan; use nextAfterId from the report to continue past retained items.
npm run migrate:pw1 -- cleanup-media --store 205 --limit 20 --after-id 12345
```

The standalone command is for older leftover assets. The runner now also cleans newly created orphan media automatically after a terminal store failure, as described below. Recently reused existing assets are never selected by that automatic path. `--older-than-hours` is 1–87600 (default 168); `--limit` is 1–100 (default 20). `nextAfterId` lets an operator advance the scan without repeatedly scanning the same referenced records. Dry-run is advisory; apply rechecks each candidate.

Only assets registered in `pw1_migration_media` for the selected store's tenant, with the exact tenant/hash filename produced by the importer, qualify. Unregistered upload-before-cache crashes and manually named files are retained rather than guessing ownership. All database tables are conservatively checked for references by media ID or filename stem, including other sites/tenants, draft/version rows, HTML/JSON URLs and migration backup artifacts. Primary keys and known non-media parent/foreign keys are not media references. Uncertain matches retain the file. Backups can intentionally keep an otherwise-unused asset indefinitely; this command does not prune backups.

Run apply in an idle maintenance window. It shares the migration advisory lock, rejects unresolved running attempts and briefly locks application tables against writes during each final reference check/delete; ordinary reads can continue. Lock contention or row-level security fails closed and is reported, never bypassed. This guards database writes, not external consumers or future stale editor submissions; do not run alongside schema changes or active editors.

Payload deletion handles the original and configured derivative/storage files and cascades the migration cache row. Storage and PostgreSQL cannot form one atomic transaction: a storage/commit error may leave a partially removed *unreferenced* asset; the error is reported and cleanup can be retried. No referenced website data is intentionally removed. Results report `eligible`, `retained`, `deleted` or `error`, with media IDs and reasons.

Local integration: `npx tsx --require ./scripts/seed-preload.cjs scripts/tests/pw1-media-cleanup.ts` creates only synthetic media, tests dry-run/apply/reference/retention/lock behavior, then removes its fixtures.


### Automatic cleanup in the single migration command

`npm run migrate:pw1 -- input.json` now handles: failed attempt → rollback → retry when allowed → failed-attempt media (whether the store eventually succeeds or fails) → queue cleanup → finish/drain all store work → clean queued orphan media → final report. No second command or seven-day wait is required for this path.

An async store scope tracks IDs returned by actual new imports across all attempts. Cache hits and existing uploaded files recovered by filename are not included. Cleanup runs after all preparation and website writes have drained, uses the runner's existing batch lock, and refuses committed or unresolved attempts. It reuses the reference/storage deletion checks; website, versions, other tenants and `site-before.json` backups remain protected. Temporary generated artifacts from this store's failed attempts are diagnostic, not live references, and do not keep new orphan uploads alive.

The batch result includes `mediaCleanup` (also in JSON/CSV and failed-batch logs). Cleanup errors do not replace the original migration error or stop the next store. Lock contention/unproven provenance retains media and reports why. Budget-deferred/interrupted work keeps assets for resume; process death or a fatal batch infrastructure error cannot guarantee queued cleanup and relies on the separate maintenance command after recovery. Uploads that failed before registration/returning an ID cannot be safely attributed and are not guessed.

### Duplicate source page URLs

Page identity is scoped to the source store and page ID. Distinct pages sharing a URL are retained. The first page keeps its route; later duplicates receive a collision-safe `-pw1-PAGE_ID` suffix to satisfy PW2's unique site/slug index. Only the first homepage remains the homepage. Page-ID links follow the assigned route; raw URL links retain their original destination. Reports preserve source/destination paths in `routeChanges` and warnings for user cleanup. Duplicate source IDs still fail. The collection adapter prefers source `url`, falling back to `slug` only when absent. Post-write reconciliation consumes one distinct persisted page per expected layout.

Source image imports do not use a host allowlist. The operator-provided input determines the source host. URLs must use HTTPS without credentials or custom ports; redirects are rejected. The importer retains its 30-second download timeout, 10 MiB size limit and supported image MIME checks.

### Content layout variety

Native design uses stable per-store art directions and per-component preferences drawn from compatible layouts. Single-image heroes additionally support magazine, cards-overlay and parallax; multi-slide heroes retain slideshow. Image-backed category listings can use carousel cards or portfolio grid/masonry/showcase, preserving ordered source items. Product/blog listings remain database-backed. Rich-text HTML is retained inside reading, wide or panel wrappers according to site direction. AI preferences are guidance, not quotas; report measured layout counts separately from visual acceptance.

### Source brand colors (CLI)

The migrate command scans each source domain before layout generation. One isolated Chromium browser runs at a time; bounded process-local URL+logo cache and per-store analyzed evidence avoid repeat scans/AI on retries. Navigation tries normal HTTPS, relaxed-certificate HTTPS, then HTTP; transport is recorded. The browser is read-only, uses no login cookies, rejects private-network requests and credentials/custom ports, and has a60s browser-work deadline plus10s launch timeout.

Computed CTA/navigation/link colors include neutral black/white/gray. A JPEG captures the page up to6000px tall; a separate source-logo image is captured when available, including when the domain fails. A separate visual AI call (45s timeout, no provider retry) proposes only primary/secondary colors, reason and confidence, rejects error/parked/blank pages without useful logo, and never generates blocks. Layout AI receives only CSS colors and the analyzed palette; screenshot bytes never enter layout generation. Visual-analysis failure falls back to CSS evidence, or contextual colors when none exists. Brand-analysis tokens count toward the batch AI token budget and are separately recorded in evidence.

Runner setup requires development dependencies plus `npx playwright install --with-deps chromium`. The migrate invocation is unchanged. Browser absence produces a nonfatal warning. No new environment variables or migrations are needed.

`report --batch <id> --format json` exposes attempt `brand_evidence`: URL, transport, timestamp, CSS colors, analyzed palette/reason/confidence, warning and visual model/tokens. `brand_selection` contains the final generated theme. Website and logo JPEG bytes stay in attempt artifacts and are excluded from reports. Evidence reused on retry is not another AI charge. Native-design usage totals remain separate from visual-analysis usage. Existing completed/published sites are not recolored automatically.

Native AI output still passes strict source identity/order/variant validation. On invalid output the generator permits one corrective AI call with the validation error and expected identities; if it remains invalid the store fails without bypassing validation. Each response is recorded in usage controls.

New tenants use the source website hostname label as slug (www custom domains use the next label), not `pw1-ID` or the exported tenant display slug. Reserved/invalid/occupied labels receive a store-ID suffix; further collisions receive a numeric suffix. Existing tenant slugs and previous-slug aliases are checked; no existing tenant is claimed. Existing mapped stores keep their current tenant unless explicitly renamed.

### Carousel source layout

Carousel aspectRatio/imageFit/slidesPerView are passed through from explicit source component config. Image dimensions do not determine layout; the importer no longer synthesizes these values. The renderer has no migration-wide480px/55vh cap. Optional maxImageWidth remains supported as an explicit block setting. Missing Small-banner ratio/slide count is reported as unverified PW1 layout and uses normal PW2 defaults, not a claim of equivalent source presentation. Per-theme extraction/verified mappings are still pending; current collection export lacks that geometry. Do not reintroduce image-size heuristics as source-layout evidence.

### Internal source links
The compact adapter resolves same-host HTTP/HTTPS page URLs against this store's migrated page routes, including navigation, footer, banner CTA, category cards and HTML anchors. Query strings and fragments survive. Page-ID targets retain identity even when duplicate source paths receive temporary destination slugs; URL-only duplicate targets resolve to the first source page. Rich-text rendering prefixes local `/sites/{slug}` links without writing that prefix back to editor content.

Unmatched source routes and legacy entity-filter URLs (for example `?category=42`) remain unchanged with an `Unresolved source link retained` report warning. These require verified BE entity mappings; replacing the host alone is unsafe. External destinations and media URLs are preserved. This is not a claim that every source link has been migrated.

### Explicit BE destination and category mapping

An optional `destination` on each batch entry (or collection bundle) attaches migration to an **existing draft** BE site instead of creating a fresh tenant/site. Example (IDs are placeholders):

```json
{
  "destination": {
    "tenantId": 100,
    "siteId": 200,
    "productCategories": [300, 301]
  }
}
```

`productCategories` accepts bare destination category IDs (the F42 prepared-master format) or explicit mapping objects `{ "sourceId": "32589", "destinationId": 300, "listingPageId": "12251", "sourcePath": "/products" }`. Bare IDs resolve their source category through the BE import's `migration_entity_map` (`VERIFIED` `categories` → `categories` rows) and apply to every source page containing an enabled product listing; IDs without a verified pair produce a warning and their `?category=` links remain unresolved. Never guess the source side.

The importing operator supplies the source-to-destination identities. Runtime checks require an existing account matching the input email, active owner membership, the declared site belonging to that tenant and still in draft, and every destination category undeleted in that exact tenant/site. Existing migration mappings cannot be redirected. Two stores cannot claim the same destination. Attaching does not create/change accounts, memberships, subscriptions or commerce records; website content is regenerated using the existing atomic replacement and backup mechanism. Do not point this at a published site.

`listingPageId` is the **source page ID**, and must contain an enabled product listing. Its migrated route receives `?categoryId=DESTINATION_ID`; native category filtering is enabled for that page's product blocks. Only verified `category`/`category_id` links matching `sourcePath` are translated; unrelated query/hash data survive. No matching by category name. Validation happens before generation and is repeated inside the website write transaction. `be-mapping.json` records verified declared mappings, and store results expose `beMapping` separately from the broader catalog-readiness assessment.

This implements product-category link mapping only. It does not certify completeness of BE product/blog imports, map brands/blog categories/product detail URLs, or apply legacy listing selections/sorting. Those remain pending. Input without `destination` behaves as before. `--dry-run` validates the declaration's structure and source-page reference only; it does not access the destination DB.

### Public quality audit (no BE dependency)

```sh
npx tsx --require ./scripts/seed-preload.cjs scripts/migrate-pw1.ts audit input.json --audit-base-url http://localhost:3000 --audit-output /tmp/pw1-quality.json
```

Reads mapped sites/pages from DB and visits published `/sites/{tenantSlug}` routes anonymously at 1440px and 390px, using two browser contexts. Never publishes sites, submits forms, clicks controls or follows PW1/external links. Checks HTTP/runtime errors, loaded broken images, horizontal overflow, unnamed controls and internal links. PW1 entity-filter links are grouped as `waiting-be`; other PW1 page links need review. This classification is based on URL shape, not a verification of BE mapping. Not a visual parity or commerce correctness certification.

Outputs JSON + `.md` plus incremental `.jsonl` page results. Each finding has store/page/URL, block index when available and viewport. Per-store status distinguishes `needs-fix`, `needs-review`, `waiting-be`, `checked`, `not-checked`. Exit 2 means detected errors, skipped/unpublished stores or invalid input entries; warnings/BE waits remain visible without making the command fail. Browser/DB setup failures exit 1. An HTTP 200 cannot prove absence of a rendered soft-404, and the scan does not exercise hover menus, carousel navigation or purchase flows.

Normal run/retry automatically audits using NEXT_PUBLIC_SERVER_URL and an output path beside the input. Supply both `--audit-base-url ORIGIN --audit-output REPORT.json` only to override those defaults. Audit runs after the batch drains, including when individual stores failed; fatal setup failures and cancellation do not start an audit. Migration failure still produces a nonzero exit even if audit succeeds; draft sites are reported as not checked (failed migrations/publications remain unpublished). The combined command audits available published results even after partial migration failure; failed/draft stores remain visible as not checked. GitHub runner needs Chromium installed as described above, and a reachable running PW2 application. Each page is bounded to 160 scroll steps, 30-second navigation and 15-second link checks; incomplete scan is reported. Only up to 2,000 unique same-store links are requested, redirects are reported rather than followed, and external link health is not checked.

### GitHub Actions (deferred)

User deferred this integration. A local workflow draft has not been committed or dispatched; the supported entry point remains the CLI command above.

### Reviewed URL corrections and source carousel evidence

A batch entry (or collection bundle) can include `linkCorrections`. Each correction is scoped to that store and requires an exact `from`, an existing source `pageId`, and a review `reason`:

```json
{"linkCorrections":[{"from":"/products-services","pageId":"5135","reason":"Reviewed source page uses /product-service"}]}
```

Corrections participate in the input hash. They are not fuzzy path matching; external URLs remain unchanged unless explicitly listed. The adapter also maps the legacy same-store `/checkout` URL to PW2's existing checkout route. This does not migrate payments or assert that BE product import is complete. Empty unstyled editor anchors are removed; image-only or decorative external links without a name receive a destination label.

The existing read-only PW1 homepage scan now captures rendered Swiper image frame ratio, image fit and visible slide count. Exact source image URLs bind this evidence to Small banner components, with conflicting observations rejected. Explicit input layout values win. `carousel-evidence.json` records applied/unverified components. This is rendered homepage evidence, not coverage of every legacy theme: inaccessible pages, CSS background images, non-Swiper carousels and inner-page-only banners may still need explicit source configuration. No intrinsic image-size or fixed-height heuristic is used.

Audit scrolling now allows up to 160 steps (previously 20); pages exceeding that bound still produce `SCAN_LIMIT`. Cleanup adds a conservative pages/sites preflight, and local reset reference queries are grouped in batches of 20 tables. Deletion still requires the full locked reference check. Run cleanup during an idle period; concurrent CMS writes can safely reject the lock rather than bypass checks.


### Bounded retry and completion checks (2026-09-17)

Each uncommitted generation/apply failure gets up to `--max-attempts` total attempts (default 3, including the initial attempt). AI layout validation and unknown execution errors are included. Safety conflicts, cancellation and operational budgets stop retries. Exhaustion records the store failure and continues the pool; the command exits nonzero only after draining and reporting. Provisioning and preflight retain their separate checks.

Native AI structured output restricts source IDs to permitted block/variant pairs; binder validation still checks exact page/section order and source fidelity. This prevents a category from choosing a product block through independent global enums.

After retries drain, cleanup examines media created during failed attempts even when a subsequent attempt succeeded. Only failed attempt IDs are eligible for runtime-artifact exclusion. Successful attempt artifacts, live documents, versions and before-state backups still protect media; no committed attempt is excluded from reference scanning.

### Missing source-page links (2026-09-17)

The regular batch runner calls `prepareSourceLinks` before generation. Known migrated pages and verified category mappings still resolve first. Remaining same-host page links are checked with the existing CLI browser dependency (up to 10 unique URLs/store, 5 seconds/navigation, 30-second browser budget after launch). External and BE entity links are not probed. DNS guards reject private hosts and cross-host navigations; no authentication/cookies are supplied. As with the existing brand scanner, the source browser permits legacy TLS certificate errors, but other TLS/connection failures remain unverified.

Only same-host HTTP 404/410 responses disable a missing-page link. HTTP 200 alone does not prove a valid source page (PW1 can return an empty SPA shell); retain it for source/input review. Network failures, redirects, server errors and scanner limits retain the link with a diagnostic. No guessed destination or store-specific URL list is used.

Confirmed broken rich-text anchors are unwrapped, preserving text/media. Broken menu items are omitted, promoting valid children. Broken banner CTA labels are preserved as description text with no clickable button. Card content remains, with its broken URL removed. `source-link-checks.json` records URL, status, reason, timestamp and source locations; JSON batch reports expose these checks. `--dry-run` reports missing links without launching a network scan. This does not import a missing page from a live website or edit previously migrated sites; it applies during generation in the normal migration script.


### Automatic publish in the same command (2026-09-17)

```sh
npx tsx --require ./scripts/seed-preload.cjs scripts/migrate-pw1.ts input.json --concurrency 5
# Resume publication without regenerating completed stores:
npx tsx --require ./scripts/seed-preload.cjs scripts/migrate-pw1.ts retry input.json
```

Regular run/retry automatically publishes completed stores using `NEXT_PUBLIC_SERVER_URL` (HTTPS or local HTTP). The app must be running against the same destination DB and Payload secret. No publish flag, new environment variable or link-list export is needed. Dry-run and reporting commands never publish.

After migration and cleanup drain, publication runs sequentially via the existing authenticated publish API, preserving its subscription checks, validation, draft/page-version promotion and cache invalidation. Only completed store mappings with the same input hash/owner are eligible. Already published sites are left untouched. Completed stores skipped by generation can still publish, including on `retry INPUT`.

Publish has its own bounded attempts using `--max-attempts` (default 3), never regenerates a completed store and continues after failure. A publish timeout rechecks destination status before another request. HTTP 429 Retry-After is honored up to 60 seconds per wait. Results contain `publish.status`, `attempts`, and error when present; JSON totals include published/publishFailed and CSV includes the publish field. Publish failure leaves migration completion intact but causes a nonzero batch exit; a requested audit still runs after the batch drains. No automatic link list is produced.


### Page-scoped carousel preparation (2026-09-17)

Normal migration now runs a dedicated source-carousel scan before native AI generation. It visits original input paths containing Small banners, including inner pages; generated PW2 slugs are never used as PW1 paths. Frames are scoped to source page ID and matched by exact source image/declared srcset URLs. Supports Swiper, Slick, Owl and Bootstrap carousel structures, including simple CSS URL backgrounds with cover/contain. Gap-aware slide pitch determines visible count; image resolution never determines layout.

Explicit input geometry wins. Conflicting same-page frames or missing matches remain unchanged with a reason in `carousel-evidence.json`. `carousel-scan.json` records source page URLs, observed frames and failed/budget-exhausted pages. The binder keeps measured aspectRatio/imageFit/slidesPerView independently of the AI's images/cards variant selection.

A larger image is used only when declared by srcset, actually loaded and ratio-compatible with the loaded original. No URL rewriting or image enlargement is presented as recovered quality. Verified source images enlarged more than 2× in their observed frame generate page/component warnings; this is not a guarantee about final desktop/mobile sharpness.

The scanner is serialized across stores, limited to 12 source pages and 60 seconds after browser launch (10-second launch timeout), with bounded navigation, scrolling and image probes. Public-network checks and same-host navigation apply; legacy TLS certificates are tolerated for read-only source inspection. Source failures are warnings and do not manufacture layout evidence. Unsupported slider markup, background-size:auto, ambiguous shared images, inaccessible pages, and pages beyond the budget retain PW2 fallback. Brand scanning no longer also scans carousels.



### PW1 SPA missing-link verification (2026-09-17)

The regular migration source-link step now permits SPA rendering and observes the public /pages response. Absence evidence requires a complete nonempty single-page inventory with exact pagination counts and every row scoped to the expected source store. Partial/mixed-store inventories are ignored. Existing destinations and redirects to an existing page are retained. A visible not-found heading plus Back to Home control also confirms a rendered soft404 despite HTTP200. Network/TLS errors, loading shells without inventory and server errors alone do not disable links.

For legacy HTTPS TLS failures, a fresh HTTP page is attempted on the same source host. Public-network guards, same-host navigation, a 60-second browser lifetime and 10-URL cap remain in place. Reports retain final URL, inventory and decision reason per source URL. Existing adapter handling removes confirmed dead links while preserving CTA text/images. No store-ID exceptions or guessed destination rewrites.

### Subscription trong CLI migration

CLI migration website dùng context nội bộ để bỏ qua kiểm tra subscription và quyền `website_builder`. User vẫn phải là owner đang active của tenant chứa site đích. Ngoại lệ không tạo hoặc sửa subscription; API generate trong CMS vẫn giữ nguyên hai kiểm tra và không nhận cờ bypass từ request. Chi phí AI vẫn phát sinh.

Bước publish của CLI gửi grant có chữ ký server, hiệu lực 2 phút, ràng buộc user/site/tenant/source store/input hash. API chỉ miễn kiểm tra subscription cho owner active của site draft có ledger migration `completed` khớp grant. Publish CMS không có grant hợp lệ vẫn kiểm tra subscription và `website_builder`; các bước promote trang, kiểm tra dữ liệu và cache invalidation giữ nguyên.

### Xác định ngành kinh doanh

Migration xác định ngành từ tên store và nội dung nguồn trong chính lần gọi AI chọn thiết kế, không gọi thêm API phân loại. Ngành phải thuộc danh sách PW2 hỗ trợ; kết quả có độ tin cậy thấp dùng `business`. Ngành được dùng cho thiết kế và thông tin site khi lưu; không thay đổi nội dung nguồn hoặc luồng tạo website thông thường. Trước khi AI trả kết quả, migration dùng `business` làm giá trị trung lập thay vì gắn cứng `ecommerce`.

Mỗi lần chạy lưu `industry-selection.json` trong thư mục kết quả của attempt, gồm `category`, `confidence`, `reason`; kết quả cũng nằm trong `sourceMigration.industry`. Chỉ tăng nhẹ token hướng dẫn và phản hồi của lần gọi hiện có; không phát sinh lượt gọi AI riêng. Store đã migrate không tự đổi ngành nếu chưa chạy lại generation.

### Domain nguồn và liên kết nội bộ PW1

Script dùng `site.domain` trong input collection làm domain nguồn PW1. BE phải map đúng domain nguồn vào trường này; script không tự đọc CSV hay suy đoán domain từ nội dung. Nếu BE cung cấp domain PW2 thay cho PW1 thì phải sửa input trước khi chạy. `store_domains` nhúng trong bundle (nếu có) chỉ bổ sung alias domain active, chưa xóa, đúng `store_id`; không thay thế `site.domain`. Input compact dùng `source.websiteUrl` và tùy chọn `source.origins`.

Đường dẫn được so khớp không phân biệt hoa/thường, gộp dấu `/` lặp trong pathname và bỏ `/` cuối. Slug PW1 cũ được giữ làm alias chỉ khi trỏ duy nhất một page; URL chính có ưu tiên. Query và fragment được giữ nguyên. Link entity vẫn cần mapping ID; domain của store khác không bị đổi. Cơ chế áp dụng chung cho rich text, CTA slide, menu/footer và category cards. Audit nhận diện các domain nguồn đã xác minh. Thay đổi này không sửa dữ liệu site đã migrate.

### Bố cục rich text nguồn

Script không áp khung panel/viền/bo góc theo design direction lên rich text. Các figure ảnh của trình soạn thảo PW1 được chuyển thành CSS inline cục bộ để giữ căn trái/phải/giữa và giới hạn chiều rộng trên mobile. Nhóm figure căn trái liên tiếp có caption, không có width/float/display riêng, được đặt trong gallery CSS Grid responsive; đoạn văn hoặc bảng ngăn nhóm. Giữ nguyên ảnh, caption, link và thứ tự. Không suy diễn chính xác số cột PW1 khi nguồn không có CSS.

### Chạy lại site đã publish

`--store ID --rerun` cho phép tái tạo site đã publish trong mapping migration hiện có. Không dùng `--rerun` thì vẫn không được thay thế site published. Kiểm tra tenant, owner active và category scope giữ nguyên, được kiểm tra lại trước khi ghi. AI/media chuẩn bị trước; thay đổi site/page ghi trong transaction có kiểm tra concurrent edit. Khi generation/ghi thất bại trước commit, dữ liệu site cũ giữ nguyên. Sau commit site chuyển về draft và flow publish tự chạy; nếu publish thất bại, kết quả ghi nhận lỗi để lần chạy sau tiếp tục publish.

Cấu hình hiển thị cart PW1: `header.config.cart_status` bằng `0`, `"0"` hoặc `false` luôn tắt cart và tracking, kể cả các page hệ thống vẫn active. Giá trị thiếu/null/rỗng không được coi là tắt. Các trường hợp còn lại vẫn yêu cầu page/component commerce hoạt động; `cart_status: 1` không tự bật cart khi tất cả page commerce đã tắt. Quy tắc chỉ áp dụng migration.

### Legacy page URL normalization

Website migration normalizes source paths (spaces, percent escapes, accents and punctuation) into PW2 slugs while retaining page IDs, titles and component content. Internal links use source paths and resolve to the normalized destination with query/fragment preserved. Collisions receive a source-page-ID suffix. Same-store absolute URLs use their pathname; external URLs or homepage anchors stored on non-home pages fall back to that page’s source slug. Input files are not modified. A missing active homepage still fails validation rather than inventing content.

When PW1 has no active homepage but has an undeleted homepage with status `0`, migration preserves its content and keeps the destination website and generated pages as drafts. Publication reports `kept-draft` (not a failure) and does not call the publish API. PW2 currently promotes all page drafts when publishing a website, so manually publishing that website later will also activate the homepage. Deleted or absent homepages are not synthesized. Source master files remain unchanged.
