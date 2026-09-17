# F35 — Native PW1 batch migration QA

Current automated coverage uses synthetic data. Browser/live generation checks are reported separately. Pilot-specific E2E files with hardcoded local stores are excluded; manual destination checks below require a prepared migrated site. Cases M01–M10 and M13–M17 belonged to the retired raw-export/source-reconstruction flows and are retired with their tests.

### TC-F35.M11 — Target isolation
- [x] AUTO — The shared generation service rejects a foreign tenant target before generation/writes (`src/__tests__/api/ai.test.ts`).

### TC-F35.M12 — Source media boundary
- [x] AUTO — HTTPS source URLs accept arbitrary hosts without an allowlist; malformed URLs, non-HTTPS protocols, credentials and custom ports are rejected (`pw1-media.test.ts`).

### TC-F35.M18 — AI design using existing PW2 blocks
- [x] AUTO — Stable per-store design briefs cover six directions; all native navigation variants preserve source links; AI receives the selected brief.
- [x] AUTO — AI request includes source footer/navigation and the complete native footer variant enum; binder preserves footer content for each supported variant.
- [x] AUTO — AI is called before binding; preserve slide/card/document/video content and order; reject new block types and reordered IDs; no silent fallback when AI fails.

### TC-F35.M19 — Product listings use the destination database
- [x] AUTO — Native AI rejects presentation blocks for product_listing; the native flow emits products-grid without source products, prices, images, IDs or snapshot payloads. Empty destination data is handled by the existing product renderer.

### TC-F35.M20 — Blog listings use the destination database
- [x] AUTO — The native binder maps article_listing to Blog List without snapshot posts; AI cannot choose Portfolio/Carousel for article components. Native tenant blog querying and empty-state behavior are retained.

### TC-F35.M21 — Compact website input
- [x] AUTO — Resolve page links; preserve static content and listing limits; reject duplicate identities/paths and invalid database bindings; report pending controls and exclude disabled components; run through the native AI binder.

### TC-F35.M22 — Preserve hero role
- [x] AUTO — Source hero banners use a native Hero; multiple slides stay in one slideshow Hero; single-image heroes retain copy/image/CTA; reject Carousel for hero banners and reject single-slide variants that would lose slides. Small banners remain Carousel.

### TC-F35.M23 — Batch input, retry and isolation
- [x] AUTO — Validate the whole array and owner/store uniqueness before processing; support multiple stores per owner; stable input hashing; skip unchanged completed stores; require rerun for changed completed stores; continue after individual failures and record each result.

- [x] AUTO TC-F35.M24: Map legacy cart/order tracking routes to native features, preserve external routes, and activate cart without product blocks including pending drafts.

- [x] AUTO TC-F35.M25: Category listing supports Carousel cards and Portfolio Grid grid/masonry/showcase when every item has a source image; preserves item order, copy and links.

### TC-F35.M26 — Native blueprint
- [x] AUTO — Keep source contract and page identity without generating legacy blocks; reject duplicate page/component IDs and invalid homepage/order.

### TC-F35.M27 — BE collection adapter
- [x] AUTO — Project website-only data; keep locale and content; exclude disabled/deleted/empty records; promote valid menu children; reject ambiguous owners and cross-store settings.

### Rich text editor HTML compatibility
- [x] AUTO TC-F35-RT-01: Tiptap retains PW1 container styles, headings, lists, image metadata and tables during an HTML edit round trip.
- [x] AUTO TC-F35-RT-02: Editing text color replaces the prior color without removing unrelated span styles.
- [x] AUTO TC-F35-RT-03: Image inline/left-wrap/right-wrap/standalone layouts and spacing survive HTML reload; legacy floats can be reset to inline.
- [x] AUTO TC-F35-RT-04: Source percent-width images, formatted captions, trusted media and HSL/RGB colors survive normalization; unsafe embedded HTML is removed.

### TC-F35.M28 — Batch validation isolation
- [x] AUTO — Invalid entries do not block valid stores; duplicate identities quarantine all conflicting entries; multi-site bundles split safely.
### TC-F35.M29 — Retry policy
- [x] AUTO — Retry uncommitted store execution failures, including AI layout validation and unknown errors, up to the configured attempt limit (default 3 total attempts) with backoff; record failed and continue other stores after exhaustion. Stop on cancellation, operational budgets, identity/destination conflicts, published sites and concurrent edits. Provisioning retains transport-only retries.
### TC-F35.M30 — Atomic local DB writes and recovery
- [x] AUTO — Local integration: rollback exceptions and worker termination preserve old site/pages; commit receipts recover interrupted ledger state; scoped media cache reuses existing uploads.
### TC-F35.M31 — Operator commands
- [x] AUTO — Local integration: status/logs expose failed attempts and batch input errors; retry policy skips completed stores; dry-run makes no writes.

### TC-F35.M32 — Batch operational budgets
- [x] AUTO — Validate positive limits; generation attempt/token budgets stop new attempts; time limits checked at safe boundaries; spacing respects deadline. Local CLI verifies deferred stores can resume via retry without regenerating completed stores.
### TC-F35.M33 — Batch reports
- [x] AUTO — JSON/CSV include validation failures, deferred/skipped stores and attempt durations; missing usage stays null; CSV quotes multiline content and neutralizes formulas. Local DB report export does not mutate ledger.
### TC-F35.M34 — BE availability preflight
- [x] AUTO — Distinguish missing data, no dependency and available-but-unverified mapping. Strict mode refuses unmapped data-dependent stores before provisioning/AI; never certifies source ID parity from counts alone.

### TC-F35.M35 — Migration orphan-media cleanup
- [x] AUTO — Cleanup validates store, retention and batch bounds; only strict migration filename/cache provenance qualifies. Real local CLI dry-run preserves media; apply deletes old unreferenced migration media/cache, retains ID/HTML references and recent media; concurrent migration lock rejects cleanup.

### TC-F35.M36 — Automatic cleanup after terminal store failure
- [x] AUTO — Real CLI batch fails after logo upload, automatically deletes only the newly imported orphan and continues the next store. Tracking scope isolates concurrent contexts and does not record cache hits; cleanup refuses committed/unresolved attempts and preserves live/version/backup references.

### TC-F35.M37 — Bounded preparation and serialized writes
- [x] AUTO — Pool limits active stores, serializes same-account jobs, drains on fatal errors. Real DB preparation opens no transaction; two preparations overlap but gated persistence never overlaps. Rollback/session fencing and crash recovery remain valid. Real CLI runs concurrent stores and cleanup after pool drain.

- [x] AUTO TC-F35.M38: CLI transactions retain one backend PID/transaction ID despite concurrent pool reads; real DB regression in `scripts/tests/pw1-reliability.ts`.

### TC-F35.M39 — Legacy brand evidence
- [x] AUTO — Rank CTA/navigation colors, retain neutral samples for visual analysis, exclude transparent samples; reject private network destinations; nonfatal fallback and cancellation. Native AI prompt includes color evidence but excludes screenshot bytes.

### TC-F35.M40 — Source tenant slug
- [x] AUTO — Preserve PW1 hostname label; custom www domains use next label. Reserved/invalid/occupied names use store-ID suffix; collision checks never attach to an existing tenant.

- [x] AUTO TC-F35.M39: Isolated visual palette accepts neutral/logo-only identity, rejects parked-site evidence, reports model/tokens and falls back on AI errors; cancellation propagates.

### TC-F35.M41 — Source carousel layout
- [x] AUTO — Adapter preserves explicit source frame ratio, fit and slides per view. Browser fixtures verify source geometry; responsive destination navigation, stable frame height and overflow require manual checks on a migrated site.
- Migration does not infer layout from image dimensions. Unverified Small banner layouts use PW2 defaults with a report warning; per-theme PW1 extraction remains pending.

### TC-F35.M42 — Source link mapping
- [ ] MANUAL — Navigate migrated menu/CTA/rich-text links and reload subpages anonymously; verify destination routes and checkout on the selected test site.
- [x] AUTO — Map same-store page URLs in menus, CTA and HTML, preserve query/hash and external/media URLs; never reinterpret legacy category IDs, warn on unresolved links.

### TC-F35.M43 — Portfolio category controls
- [ ] MANUAL — On a migrated site, portfolio without category groups renders its cards without an All-only or empty category filter.

### TC-F35.M44 — Explicit BE destination/category mapping
- [x] AUTO — Validate positive IDs, unique category source identity, active ownership, draft site, tenant/site category scope and deletion; translate category/category_id only with verified mapping into native categoryId and an enabled product listing page. Unmapped/external/ambiguous URLs stay unchanged.

### TC-F35.M45 — Public post-migration quality audit
- [x] AUTO — Classify legacy entity links separately from unmapped source page links; ignore external links, preserve evidence URLs and never fetch PW1 targets during link verification.

- [x] AUTO TC-F35.M41: Browser measures rendered Swiper frame rather than intrinsic image ratio; exact source URL matching rejects conflicting observations.
- [x] AUTO TC-F35.M42: Reviewed per-store corrections use an existing source page ID; image-only map links receive an accessible label, preserving existing names.
- [x] AUTO TC-F35.M35: Grouped reset reference queries execute against isolated local fixtures; reference and transaction protections remain enabled.

### TC-F35.M46 — Partial completion finalization
- [x] AUTO — A drained partial failure runs the requested audit and preserves nonzero migration exit; setup failure/cancellation does not audit; audit failure retains both errors.
- [x] AUTO — Local CLI records three failed attempts in one batch, cleans orphan media and continues the next store without a manual retry command.
- [x] AUTO — Local DB cleanup after a later successful attempt removes failed-attempt orphan media while preserving committed references.
- [x] AUTO — AI response schema rejects block/variant pairs incompatible with the source component before binding.

### TC-F35.M47 — Missing source-page links
- [x] AUTO — Report missing page links by source store/page/component separately from BE entity mappings; only explicit same-source HTTP 404/410 evidence disables a link.
- [x] AUTO — Retain HTTP 200 SPA shells, redirects to other domains and network/server failures; never guess Home as a destination.
- [x] AUTO — Unwrap broken rich-text anchors preserving text/images; remove broken navigation items while preserving valid children; preserve broken CTA label as plain description text.

### TC-F35.M48 — Automatic CLI publish
- [x] AUTO — Regular run/retry automatically uses existing app publish API; invalid origin fails before mutation; dry-run stays read-only.
- [x] AUTO — Real CLI: unavailable publish API exhausts its own attempt budget, preserves migration completion and proceeds to other stores; retry succeeds without new generation attempts.
- [x] AUTO — Already-published sites are skipped; JSON/CSV distinguish publication failure from migration failure.

### TC-F35.M49 — Page-scoped carousel source preparation
- [x] AUTO — Match source media within its source page, preserve explicit layout, reject conflicting observations and preserve provenance for verified alternate images.
- [x] AUTO — Browser fixtures measure gapped Swiper, Slick and CSS background frames; srcset upgrade must load and retain image ratio.
- [x] AUTO — Native binder preserves verified frame/fit/count and chosen image while AI selects the carousel variant.

### TC-F35.M50 — PW1 SPA missing destinations
- [x] AUTO — Complete single-store page inventory can confirm an absent path; partial pagination, wrong tenant and unreadable responses cannot.
- [x] AUTO — Same-source HTTP200 rendered not-found can disable a CTA; HTTP errors/timeouts alone cannot; valid pages and working redirects survive.
- [x] AUTO — Browser rendering requires a visible not-found heading and Back to Home control, not merely a footer/link mentioning 404.
