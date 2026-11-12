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
- [x] AUTO — Source hero banners use a native Hero; multiple slides stay in one slideshow Hero; single-image heroes retain copy/image/CTA; reject Carousel for hero banners and reject single-slide variants that would lose slides. Small banners remain Carousel. Single-image heroes without separate headline/subheadline/CTA allow only slideshow and use the existing slideshow renderer with imageFit=contain, overlay=0 and natural aspect ratio; migration persistence never invents a Welcome headline. Browser coverage checks migrated store 834 when present.

### TC-F35.M23 — Batch input, retry and isolation
- [x] AUTO — Validate the whole array and owner/store uniqueness before processing; support multiple stores per owner; stable input hashing; skip unchanged completed stores; require rerun for changed completed stores; continue after individual failures and record each result.

- [x] AUTO TC-F35.M24: Map legacy cart/order tracking routes to native features, preserve external routes, and activate cart without product blocks including pending drafts.

- [x] AUTO TC-F35.M25: Category listing supports Carousel cards and Portfolio Grid grid/masonry/showcase when every item has a source image; preserves item order, copy and links.

### TC-F35.M26 — Native blueprint
- [x] AUTO — Keep source contract and page identity without generating legacy blocks; reject duplicate page/component IDs and invalid homepage/order.

### TC-F35.M27 — BE collection adapter
- [x] AUTO — Preserve footer contact text and arbitrary HTTP(S) icon links in their source columns (WhatsApp, Maps, GrabMart, Foodpanda); retain enabled URL-less banner labels without inventing targets; explicit header cart visibility enables the native widget even with disabled legacy commerce pages. Browser checks store 922/1044/1174/1856 and SJS category regression.
- [x] AUTO — Website JSON giữ category references (`pending`/`unavailable`); `category-mapping.json` ghi ID PW1 → ID PW2 đã xác minh, hoặc `destinationId: null`. Không đổi BE import. Link category unavailable mở listing PW2 rỗng bằng `categoryId=0`; category đã có mapping dùng ID PW2 thật. Kiểm duplicate/ID giả và E2E bấm footer → Products → clear filters.
- [x] AUTO — Project website-only data; keep locale and content; exclude disabled/deleted/empty records; promote valid menu children; reject ambiguous owners and cross-store settings.

### TC-F35.M62 — Variant fidelity
- [x] AUTO — Banner with a source image is never bound to a hero variant that cannot render it (fullscreen/gradient/minimal); the capability table is verified by rendering every hero variant, and the binder rejects a lossy AI choice.

### TC-F35.M63 — Rich-text image rehost
- [x] AUTO — Entity-encoded `src` (e.g. `&amp;` in signed CDN URLs) is decoded before download, so the real image is hosted instead of the 403 placeholder; source downloads send a browser User-Agent for CDNs that block the default one.

### TC-F35.M64 — Source image download resilience
- [x] AUTO — Redirects are followed with every hop kept HTTPS/no-credentials/no-port; 403 from bot-protected CDNs is retried through a headless browser before falling back to the placeholder; images labelled with a generic content-type (`image`, octet-stream, or `text/plain` for PW1 uploads stored as `.txt`) are accepted when the bytes are a real image; other bytes are still rejected.

### TC-F35.M65 — Footer brand block
- [x] AUTO — Footer uses the store logo image (not text) when its stored logo is a media id, and `dark-gradient` always shows the footer tagline (else the site SEO description) plus the site's address/phone/email with icons under the logo, with no per-footer flag; other variants never show them and keep the source footer unchanged.

### TC-F35.M66 — Footer variant for branded multi-column footers
- [x] AUTO — A source footer with a tagline or contact details and three or more link columns is always bound to `dark-gradient`, regardless of the AI's choice; fewer columns or no brand block keep the AI choice.

### TC-F35.M67 — Placeholder images are retried
- [x] AUTO — A placeholder produced by a blocked/failed download is not cached by URL (next run retries it), and an already cached 960x640 placeholder is retried and replaced by the real image under a new filename; cached real images are reused without downloading.

### TC-F35.M68 — Footer variant repair for generated stores
- [x] AUTO — The repair rule (brand info or SEO description or contact details beside 3+ link columns => `dark-gradient`) updates an already generated footer (not yet on dark-gradient; footers already on dark-gradient are never touched) using the site's own SEO description/contact info, changes only the variant (logo/links/socials/tagline untouched), is idempotent, and leaves footers with fewer than 3 columns, no brand info, or no footer untouched. The binder and the repair share one rule.
- [ ] MANUAL — `npm run migrate:pw1:repair -- --only footer` (dry-run) lists the stores to change; `-- --apply` appends the previous footers to a backup JSONL before updating `footer_block`/`pending_footer_block`, skips a footer edited meanwhile; after the 5-minute footer cache (first view after expiry may still be stale) the public footer shows the dark-gradient layout.

### TC-F35.M69 — Rich-text image repair for generated stores
- [x] AUTO — Absolute `<img>` sources in rich text on PW1 storage (DigitalOcean Spaces) that were never rehosted (not `pw1-<tenant>-…` media) are found with entities decoded; the repair reuses the migration's downloader to rehost them and rewrite the `src`, does nothing (and downloads nothing) when all images are already rehosted, and reports images that still cannot be downloaded without changing the html.
- [ ] MANUAL — `npm run migrate:pw1:repair -- --only images` (dry-run) lists the images still pointing at PW1 per store/page/block without downloading; `-- --apply` rehosts them (images from other sites are not listed or touched), updates `pages_blocks_custom_html` and the matching draft-version rows, saves the previous html to the backup first, and reports images broken at the source.

### TC-F35.M70 — Hero banner variant repair for generated stores
- [x] AUTO — A hero with an image on a variant that cannot render it (fullscreen → parallax, gradient/minimal → centered) is moved to an image-rendering variant; heroes without an image or already on an image-rendering variant are untouched, and every replacement variant renders the image.
- [ ] MANUAL — `npm run migrate:pw1:repair -- --only hero` (dry-run) lists affected heroes per store/page/block; `-- --apply` updates `pages_blocks_hero` and the matching draft-version rows, saving the previous variant to the backup first.

### TC-F35.M71 — Footer link repair for generated stores
- [x] AUTO — A footer column that still has label text and holds fewer links than the same-titled column adapted from the PW1 export takes the source links and text; the source's social icon links (already shown as the footer's social icons), complete columns, columns without text, unmatched columns and every other footer field are untouched.
- [ ] MANUAL — `npm run migrate:pw1:repair -- --only links` (dry-run) lists the columns to restore per store; `-- --apply` rewrites `sites.footer_block` / `pending_footer_block` (previous JSON saved to the backup first). Re-running reports 0 footers.

### TC-F35.M72 — Placeholder image repair for generated stores
- [x] AUTO — Placeholder media is matched to its PW1 source URL through the tenant/hash filename; repointing updates every foreign key into `media` and the copied media URL inside json columns, and skips the URL rewrite when it did not change.
- [ ] MANUAL — `npm run migrate:pw1:repair -- --only placeholders` (dry-run) lists placeholder media per store without downloading; `-- --apply` downloads the real image (uploads to the configured media storage), repoints all references and reports images still broken at the source (no upload for those).

### TC-F35.M73 — Empty fixed product list shows every product
- [x] AUTO — PW1 drops the empty `id` filter, so a `fixed` listing without items lists every active product: the binder maps it to `all` (a fixed list whose products the BE did not emit, and a template-owned category, stay empty), and the repair turns existing `fixed` grids with no products into `all`; grids with products or another mode are untouched, and stores whose migration warned about a deliberate empty selection are skipped.
- [ ] MANUAL — `npm run migrate:pw1:repair -- --dry-run --only product-grids` lists the grids per store/page/block; the default run updates `pages_blocks_products_grid` and the draft-version rows (previous mode saved to the backup). `/sites/mas-anita` then shows its 4 products under "New Arrival" and "Harga Istimewa".

### TC-F35.M74 — Rich-text images from other sites keep their URL
- [x] AUTO — Only images on PW1 storage (`*.digitaloceanspaces.com`) are copied into destination media by the migration and by `--only images`; an `<img>` hotlinked from another site is neither downloaded nor rewritten, so a CDN that blocks bots (HTTP 403) can no longer turn it into the grey placeholder (`pw1-image-origin`, `rehostHtmlImages`, `externalImageUrls`).
- [ ] MANUAL — Migrate a store whose rich text holds an `oecd.org`/`freebw.com` image: the page still shows that URL, no `-placeholder.jpg` media is created for it.

### TC-F35.M75 — Rich-text placeholders are restored
- [x] AUTO — Source `<img>` URLs are collected from every html string of the PW1 contract; a stored copy is matched to its source image through the tenant/hash file name (https form of the URL), also when an older build saved it without the `-placeholder` suffix; for an image hotlinked from another site any stored copy (downloaded or placeholder) is swapped back to the PW1 URL, for an image on PW1 storage only its neutral placeholder (960x640, 9447 bytes) is; the copy URL is swapped for the new one (entity-encoded) in every occurrence; each block is backed up first, rewritten only if unchanged since the read, and its draft versions follow.
- [ ] MANUAL — `npm run migrate:pw1:repair -- --dry-run --only placeholders` lists `[html-placeholders]` rows (PW1 storage image still a placeholder: downloaded again; other site: original URL put back whatever copy was stored); the default run saves the previous html to the backup and the page (e.g. `/sites/nd-nterprise/services`) shows the image again after the page cache expires. Unsupported: images already lost at the source stay as the placeholder.

### Rich text editor HTML compatibility
- [x] AUTO TC-F35-RT-01: Tiptap retains PW1 container styles, headings, lists, image metadata and tables during an HTML edit round trip.
- [x] AUTO TC-F35-RT-02: Editing text color replaces the prior color without removing unrelated span styles.
- [x] AUTO TC-F35-RT-03: Image inline/left-wrap/right-wrap/standalone layouts and spacing survive HTML reload; legacy floats can be reset to inline.
- [x] AUTO TC-F35-RT-04: Source percent-width images, formatted captions, trusted media and HSL/RGB colors survive normalization; unsafe embedded HTML is removed.
- [x] AUTO TC-F35-RT-10: Table cells (new table, added row/column, Tab navigation) default to an empty paragraph so text can be typed; no hidden empty media block is created.

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

### TC-F35.M51 — Automatic prepared master parts
- [x] AUTO — Select the newest completed BE run, including nested import-runs; use destination manifest order and verify all part hashes before execution. Reject incomplete handoffs, duplicate/path-traversal entries and modified/missing files; run all parts sequentially, log failures, retry failed parts once after the first pass, and stop immediately on cancellation. Explicit file input remains supported.

### TC-F35.M52 — Normalize legacy page URLs
- [x] AUTO — Normalize spaces, accents and escaped legacy paths to PW2 slugs; preserve source page IDs, titles and content, remap internal links with query/fragment, suffix collisions by source page ID without dropping pages.

### TC-F35.M53 — Disabled homepage preservation
- [x] AUTO — Preserve an undeleted disabled homepage when no active homepage exists; retain content and carry keep-draft policy into generation. Deleted homepages remain excluded; active homepages retain automatic publication.

### TC-F35.M54 — Imported blog detail content
- [x] AUTO — Render HTML strings, PW1 HTML wrapped in Lexical, and native Lexical content; sanitize unsafe HTML.

### TC-F35.M55 — Blog detail listing links
- [x] AUTO — Back link and breadcrumb resolve to an existing published blog-list page, prefer a dedicated listing over homepage, and fall back to homepage when no listing exists.

### TC-F35.M56 — Blog excerpts
- [x] AUTO — Extract plain text excerpts from HTML and Lexical including imported HTML wrappers, preserve paragraph spacing, and truncate consistently.

### TC-F35.M57 — Blog card CTA locale
- [x] AUTO — Empty or whitespace CTA labels fall back to the store language (English/Malay); custom labels are preserved.

### TC-F35.M58 — Per-block product category
- [x] AUTO — Settings loads only site categories and changes the existing category field. A fixed block category is sent to the product query with or without sidebar filters and cannot be overridden by URL category selection.

### TC-F35.M59 — Product listing modes and PW1 identity mapping
- [x] AUTO — Fixed selections preserve order, reject invalid IDs and remain scoped to the destination; random ordering is stable per seed without duplicates across pages; empty fixed lists do not fall back to all products.
- [x] AUTO — Source product selections, stock visibility and category are resolved using verified BE IDs; missing mappings fail before generation. Page size uses the configured limit on all viewports (supersedes TC-F09.239a's 9/10 defaults).
- [x] AUTO — Local browser fixture verifies fixed/category/stock filtering, random pagination and independent listing blocks without AI.

### Product listing filter compatibility (TC-F35.M59)
- [x] AUTO — All reads URL filters; fixed ignores configured category and URL filters; random uses configured category only. Fixed/random use local pagination. URL updates do not trigger global scrolling (supersedes prior F09 scroll-reposition expectations).

- [x] AUTO — PW2 extension: fixed/random accept block-local category, price, search and attribute filters when enabled; never read/write page URL filters. Category options are derived from the eligible source products. All retains URL filtering.

### TC-F35.M60 — PW1 page filter mapping
- [x] AUTO: Map same-page product criteria to listings, union multiple controls, preserve explicit disabled criteria; never infer proximity.
- [x] AUTO: Article category mapping, malformed criteria, orphan filters, unsupported brand, intentional sorting exclusions.
- [x] AUTO: Browser verifies migrated product filter controls on desktop/mobile and blog category filtering without scroll navigation.

- [x] AUTO (TC-F35.M60): Active price chips use store currency; unrelated blog/view URL parameters do not refetch products.

### TC-F35.M62 — Template-owned category in a product listing (Issue #1956)
- [x] AUTO — A `random` listing whose source category has a VERIFIED mapping outside the destination site/tenant becomes an empty `fixed` listing with a warning; a category with no mapping still fails `BE_MAPPING_INVALID`; an in-scope category resolves as before (`src/__tests__/unit/migration/pw1-product-selection.test.ts`).

### TC-F35.M63 — Fixed products not emitted by the BE export (Issue #1956)
- [x] AUTO — Evidenced (`retained-source`) products are dropped from a `fixed` selection in source order with a snapshot-naming warning; missing mappings without evidence, products with several targets, and calls without a source store id still fail `BE_MAPPING_INVALID`; the evidence lookup receives the source store id (`src/__tests__/unit/migration/pw1-product-selection.test.ts`).

### TC-F35.M64 — Evidence and category lookups on a real database (Issue #1956)
- [x] AUTO — `scripts/tests/pw1-selection-evidence.ts` (local DB only, rolled-back transaction): evidence is taken only from the `exporter_sidecar` snapshot of the store's own `VERIFIED` run, ignoring a later `synthetic_fixture` snapshot, another source instance and another store's rows; out-of-scope categories report their destination tenant/site and ignore soft-deleted targets.
