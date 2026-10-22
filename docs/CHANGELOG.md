---
owner: Dev
last_updated: 2026-10-22
---

# Project Changelog

Curated per-release notes. Seeded 2026-04-19 from v1.0 kickoff (commit `6c06d015`, 2026-03-13) through 2026-04-19. Maintained per-release going forward — see `docs/PROJECT_ALIGNMENT.md` for priorities.

Source: `git log main --since=2026-03-13 --merges --first-parent` (~370 merges, filtered to `feat:` + `fix:` only).

For full architectural decisions + incident post-mortems: see `docs/journals/`.

---

## [Unreleased] — Staging

### F05 — Redesign Pages panel / Page library (US-F05-02, GH-1984)

- **New card layout:** page name + badges on one row, eye/trash as icon buttons on the right, `path · dd-mm` below; the whole card selects the page. The selected card gets a teal accent and a small "Edit with AI chat" button.
- **Add new page moved to the end of the list** (dashed button → inline form with `URL: /slug` preview). Duplicate name/slug (incl. `home` and `404`) and names with no letters/numbers are rejected inline; the server's 409 stays as fallback. The empty state keeps the button.
- **Inline delete confirm** replaces the modal (Esc/Cancel close it); soft delete + Undo toast unchanged.
- **Hidden badge:** a page with `isVisible = false` shows a grey `Hidden` badge (was Live + amber "Hidden"). Live / Draft / No Link logic unchanged.
- **Toasts** name the page ("Menu hidden from your website", "Page “X” created — add it to Menu to show it", deleted/restored) with a teal check icon and border; scoped to this panel via `page-toast.tsx`, the shared editor Toaster is unchanged.
- **Custom 404** is pinned to the bottom of the panel; its button reads "Editing 404 page" while selected.
- **Internals:** `PageManagerPanel.tsx` (628 → 176 lines) now composes `src/components/editor/page-manager/*`. Light theme colours added. i18n keys added for en/ms; unused `visible`/`hidden`/`deleteConfirm*` removed. No API, store or schema change. Tests: TC-F05-02-18..27.

### F23 — Sync Store Owner avatar from SSO (US-F23-05, GH-1723)

- **Owner avatar is SSO-owned:** `POST /api/users/me/avatar` now returns 403 for Owners and the `users.avatar` field denies Owner updates through REST/GraphQL (`canUpdateAvatarField`). Staff upload is unchanged. TC-F23-SSO-10.
- **New SSO push endpoint:** `POST /api/v1/sso/sync-avatar` (super-admin Bearer, same as the other `/v1/sso/*` routes). SSO sends `PRESENT`/`ABSENT` on avatar change, on every PW2 open and during backfill. PWv2 downloads the image into Media and links it, then deletes the previous avatar Media only when an avatar flow created it (`alt: 'User avatar'`) and no other user uses it. Idempotent: duplicate `avatar_key` and older `changed_at` are no-ops.
- **Safe download (no config):** HTTPS only, never follows redirects (3xx → 422), the host must resolve to public addresses only (loopback/private/link-local/metadata/CGNAT/multicast blocked, incl. IPv6 forms), ≤ 2 MB, JPEG/PNG bytes that decode, ≤ 50 MP. Permanent rejection → 422 (SSO does not retry), transient → 502 (SSO retries).
- **Race-safe writes:** binding `ssoUserId` and the avatar compare-and-set on `ssoAvatarSyncedAt` are each one atomic `UPDATE … WHERE … RETURNING` (`src/lib/sso/avatar-sync/sso-user-sql.ts`); only Postgres `23505` counts as a conflict, other DB errors return 500 so SSO retries. The raw SQL deliberately bypasses Payload hooks: the audit hook never set anything for Local-API writes and the welcome email is create-only. Media creation goes through `withMediaCreateLock` (GH-1185); verified with 8 parallel-sync rounds (exactly one winner each, no orphan Media).
- **Immutable identity:** new `users.ssoUserId` (unique), `ssoAvatarKey`, `ssoAvatarSyncedAt` (+ `db-setup.js` migrations; server-only, create/update access denied). Provision stores `sso_user_id`, returns 409 before creating a tenant if that id is already bound, and removes its new tenant and answers 409 if it loses a race on the id. **Email binding of existing Owners is OFF** (`ALLOW_EMAIL_BIND = false` → `409 email_bind_disabled`) until PO/BA approve the BR-23-04 change; only Owners that already have `sso_user_id` sync.
- **No new env var.** Contract: `plans/261020-1358-gh-1723-sso-owner-avatar-sync/contract-sso-pw2-avatar-sync.md`. Tests: TC-F23-SSO-01..11.

### F35 — PW1 website migration: unblock pending stores (GH-1956)

- **Root cause:** 44 of the 58 pending stores were not BE mapping gaps. 18 stores kept `product_category` pointing at a template-owned category (PW1 template cloning copies it verbatim); 26 stores selected fixed products the BE export deliberately excluded (`NO_VALID_VARIANTS`, `MISSING_VARIANT_DOMAIN`). The other 14 pass product selection; their pending cause needs the Neon batch logs.
- **Fix:** `resolveProductSelections` leaves a template-owned category listing empty and drops fixed products that the BE evidence marks as not emitted, each with a store warning. Missing mappings without evidence still fail `BE_MAPPING_INVALID`. Tests: TC-F35.M62, TC-F35.M63.

### F37 — Unified SEO Health Score + Checklist (US-F37-04, GH-1312)

- **Authoritative score:** Dashboard > SEO now has one validated 100-point surface: Business 20 + Schema 35 + AI Discoverability 15 + Technical Health 30. Loading and failure states never display a stale or invented number.
- **Single address source:** Local Business Info no longer duplicates Street Address or Country. Sellers edit `contactInfo.address`; legacy `localBusiness.streetAddress` remains a compatibility fallback, JSON-LD emits implicit `addressCountry: "MY"`, and Business Address actions focus Contact Info Address.
- **Actionable issues:** all deduplicated seller-owned root causes render with AI/You ownership, issue-specific accessible action names, and allowlisted Editor/Domain/publish/content/image destinations; platform-only signals remain hidden.
- **Bounded metadata AI:** detail requests filter title/description before pagination, proposal/apply batches cap at 100, and backlogs disclose “Fix next 100 with AI.” Local Business data is excluded.
- **Mutation safety:** proposal/apply requires active membership, exact-site ownership, and a current score revision. Apply uses per-target `updatedAt` CAS with site scope (plus tenant scope for products/blogs), so concurrent edits become stale results instead of being overwritten; Undo is available only with a post-apply revision token.
- **Security and scale:** only active tenant memberships may read score/detail; the evaluator uses narrow Payload projections, deterministic 100-row pagination, stable double-read fingerprints, and a 10,000-record ceiling. TC-F37-04-19 verifies 1,001 pages with 28 collection reads across two snapshots.
- **Local verification:** the exact post-CAS state passes 701 Vitest files / 11,687 tests (one file / three tests skipped), typecheck, lint, `git diff --check`, an isolated production build with 112/112 pages, and Playwright discovery. Current-code authenticated browser execution is blocked by the exact localhost:3000 allowlist while that port belongs to another worktree. Live staging fixture/reset/apply evidence, p95 below 2 seconds, canary/rollback, and Story Sync #1312 remain pending.

### F37 — Platform-managed AI Discoverability (US-F37-03, GH-1311)

- **Crawler policy:** approved AI assistant crawlers are always allowed by platform policy; legacy `aiCrawlersEnabled` values are non-authoritative. Known scraper bots remain blocked and `/api` + `/admin` exclusions remain in every applicable robots group.
- **Public discovery routes:** robots, sitemap, and llms routes share tenant/custom-domain resolution and independent failure behavior. Robots applies the tenant-level platform crawler policy even without a published site; sitemap and llms require a published site and generate only real public URLs. Sitemap and llms fetch all matching published pages, products, and blogs with narrow field projections; `llms.txt` then round-robins candidates within its 10-URL output cap so one content type cannot starve another. Successful sitemap/llms responses use `Cache-Control: no-store`, preventing stale 200 content after unpublish. Nested product/blog slugs are skipped because their public detail routes accept one segment, and new blog writes reject nested slugs. The account-derived site-status lookup reads at most two rows while enforcing the one-site invariant. Unpublished storefronts retain crawler access while sitemap and llms return 404.
- **Seller UI simplified:** removed the crawler toggle API, SEO Action Tools block, resubmit action, and related locale/types/preferences. Persisted Dashboard preferences automatically discard the retired Tools block.
- **Acceptance hardening:** registered unique `TC-F37-03-01..52`; added public Playwright coverage that reuses the account's single site through a guarded E2E-only status route and verifies/restores its initial status without invoking the production publish workflow, required direct custom-domain product/blog reachability, and authenticated Dashboard assertions for retired controls; code-review hardening fixed custom-domain request-header forwarding, detail-route resolution, and shared safe slug encoding. F37 now reads hydrated account-owned tenants plus opt-in tenant-scoped site status from `/api/users/me?include=site-status`, keeping fixture selection independent from the public responses under test without adding work to normal profile requests. Custom-domain probes require HTTPS public DNS, pin Chromium to the validated IP, block cross-origin requests, and try all active domains deterministically. Shared staging and default Playwright Run All run TC-28/29 through `f37-regression` and exclude TC-52; the separate `playwright.f37-custom-domain.config.ts` keeps TC-52 explicitly runnable without skip/fixme through `f37-custom-domain-manual` until the active custom-domain/product/blog fixture exists. Live staging TC-28/29 passed 2/2 before this fixture-wiring change; one account-backed local run passed setup plus TC-28 and TC-29 with temporary site-state restoration on 2026-07-31, while TC-52 awaits an active custom domain, and authenticated TC-30 remains pending.
- **Docs reconciliation:** Stories and QA now follow PRD v2.6 FR-12..14 with an explicit delivery split: #1311 owns route/UI behavior, while US-F37-04 / #1312 consumes those facts for exact 9/5/1 scoring and the 100-point scorecard. Multi-site route disambiguation remains deferred.

### F01 — AI Gen: images matched the wrong industry (GH-1611)

A bakery's generated Gallery mixed cake photos with clothing photos (jeans flatlay, shirt rack).

- **Root cause — silent category drift.** The builder form posts `businessInfo.industry` as an already-resolved composer key (`'fnb'`), but five call sites fed it back through `resolveComposerCategory()`, a free-text classifier. `'fnb'` and `'realestate'` are absent from their own keyword lists, so both scored 0 and fell into the `'business'` safe sink. Pixabay was then filtered on `category=business` instead of `food` — retail/fashion stock became eligible. Fixed by using the existing `normalizeComposerCategory()` (`route.ts` ×4, `gen-page-split.ts`). Side effects also fixed: a bakery was stored with `siteType=business` instead of `restaurant`, and blog/nav seeding used the wrong category.
- **Relevance gate now runs in production.** The gate (`photoMatchesQuery`, GH-1185) only applied to Vietnamese queries, but the pool query is translated to English by default (`GEN_TRANSLATE_POOL_KEYWORDS`) — so it never ran. New `photoMatchesTerms()` gates **every** language and matches per product TERM instead of AND-matching the joined query, which had demanded a single photo be both a cake and a baguette.
- **Fallback tiers no longer search by internal key.** Broadened/scaffolding queries used the composer key verbatim (`q="fnb"` → 0 hits; `q="business"` → the retail photos in this bug). They now use `CATEGORY_BASE_KEYWORDS[category][0]` (`'coffee shop'`).
- **Pool sizing:** a bucket now counts as filled only when it can serve the hungriest block that draws from it (gallery = 6), not at half the bucket size. Previously the ladder stopped at 4 of 9, and media-injector patched gallery's 2-slot deficit with an off-pool search whose photos were appended last — the exact "first 4 right, last 2 wrong" pattern reported.
- **Observability:** `[image-pool] UNDERFILL` warn (category, query, per-bucket counts) when the pool cannot fill.
- Tests: `composer-category-resolver.test.ts` pins idempotency across all 14 `TEMPLATE_CATEGORY_OPTIONS` values, so a newly added industry option cannot drift unnoticed.

### F36 — Order Detail Redesign (Full-Page 2-Column with EasyParcel Fulfillment, GH-1333)

**Order fulfillment CMS screen moved from right-slide drawer to full-page route:**

- **Routing:** New full-page route `src/app/(dashboard)/orders/[id]/page.tsx` (2-column layout). Old drawer removed from OrdersClientLayout; OrdersTable row click now navigates to `/orders/[id]`. Legacy `?order=` deep-link redirects via route handler.
- **Schema:** New fields on Orders collection: `selfDeliveryCourier` (text, manual courier for self-delivery), `pickupScheduledAt` (date, seller-selected pickup), `pickupSlot` (text, e.g. "08:00–12:00", informational). Migration in `scripts/db-setup.js` MIGRATIONS array per schema rule (CI hard-gate `check-migrations.js`).
- **Fulfillment State Machine:** 7 states based on order status + EasyParcel + label creation + tracking:
  - **pending→confirm** — weight wizard → create label
  - **ready→create-label** — missing weight form
  - **success** — print label modal + schedule pickup popover + COD recovery (if applicable)
  - **shipping/completed** — tracking timeline from `shippingTrackingHistory`
  - **cancelled** — reason display
  - **cod-blocked** — East Malaysia (Sabah/Sarawak/Labuan) COD orders recover via self-delivery only
  - **missing-weight** — parcelWeight input + confirm
- **New API Routes:** `POST /api/orders/[id]/self-deliver` (body: `{courier, trackingNumber}`), `POST /api/orders/[id]/pickup` (body: `{scheduledAt, slot}`). Both handler-authenticated.
- **New Components** under `src/app/(dashboard)/orders/_components/detail/`: fulfillment-zone (dispatcher), create-label-flow, schedule-pickup-popover, print-label-modal, missing-weight-form, self-delivery-zone, cod-recovery, tracking-timeline, order-items-card (SKU/weight/thumbnail), customer-card, payment-card, order-actions-card, courier-logo. Styles: order-detail.css, fulfillment.css, items-table.css, side.css using `--dash-*` design tokens.
- **Helper Module** `src/lib/shipping/cod-block.ts` exports `isCodBlocked(order): boolean` — detects COD + East MY state for recovery routing.
- **i18n:** 9 new key groups under `dashboard.orders` + extended detail.* (en.json + ms.json): fulfillment, createLabel, pickup, printLabel, missingWeight, selfDelivery, codRecovery, tracking + milestone statuses (pending, confirmed, picked-up, in-transit, out-for-delivery, delivered).
- **Note:** EasyParcel create-label is single-step (returns awbNo + labelUrl PDF). Pickup scheduling is local-state only (no EP reschedule API call). Wallet balance not shown (API doesn't return it).

**Files modified:** `src/collections/Orders.ts` (schema), `src/app/(dashboard)/orders/**` (routing + layout changes), `src/app/(dashboard)/orders/[id]/page.tsx` (RSC), `src/app/(dashboard)/orders/_components/detail/**` (12 new components), `src/app/api/orders/[id]/{self-deliver,pickup}/route.ts` (2 new endpoints), `src/lib/shipping/cod-block.ts` (new helper), `scripts/db-setup.js` (migration), `src/i18n/locales/{en,ms}.json` (9 key groups). **Tests:** Unit + component tests in `src/__tests__/unit/dashboard/` + `src/__tests__/api/` covering state machine, COD detection, API routes. See `docs/qa/F14-shipping.md` § 3.16+ for new TC-IDs (F36 order detail tests). See `docs/architecture/F14-shipping.md` § 16 for full architecture.

---

### Bug Fixes

- **GH-1588 Scope 02:** AI bulk parsing now receives the actor's resolved primary tenant's active category IDs and returns a canonical `categoryId` or `null`. The review modal requires an existing category, revalidates selected IDs before side effects, canonicalizes/deduplicates IDs, rejects malformed IDs before querying, and never auto-creates categories. Tenants with zero active categories are directed to category management before parsing; partial saves refresh Products without unmounting the remaining drafts even when refresh fails, and stale partial responses cannot overwrite a newer final refresh; completion of an older AI session no longer clears a newer prompt. An AI-only Server Action independently enforces exactly one active tenant category and draft status while the manual Product save flow remains unchanged. Concurrent category deletion uses a shared per-Payload-pool FIFO mutation gate locally and conflicting `FOR KEY SHARE`/`FOR UPDATE` row locks across instances; both lock paths use a bounded two-second wait and return a retryable error instead of pinning connections indefinitely. Mixed batches retain timeout-failed drafts in the drawer and remove only products that committed. The same user/tenant/Payload context is reused through persistence. The permanent staging E2E fixture creates and removes category/product data through the dashboard UI and tenant-scoped Server Actions—no direct collection REST or hardcoded IDs; guarded provisioning idempotently ensures only the fresh tenant's required Site. Browser verification passed 2/2 with zero active product/category fixture residue.

- **GH-1587** security(multi-tenant): five cross-tenant IDOR/anonymous-read bugs fixed — **Bugs A/C/D/E verified live against real Postgres before fix.** (1) Categories `beforeChange` hook now validates parent-field & bare tenant/site field-spoof independently, not just when parent present (Bug A/C). (2) Products `beforeChangeHook` applies same guard (Bug D). (3) saveBlogAction now checks `findByID` + tenant-ownership before update (Bug E, was present on create but missing on update branch). (4) Categories/Products/Blogs/BlogCategories all block anonymous REST reads via `if (!req.user) return false` in `access.read` (Bug B). **Root cause:** Payload's `access.update` Where-filter gates row *selection*, not write-body mutations — hooks must independently re-validate tenant-scoped fields. Same gap exists (deferred) in Orders/Customers/Sites. **Tests:** 31 persisted unit tests + 8 TC-IDs (TC-F08-05-14/15/16, TC-F09-SEC-01/02, TC-F17-SEC-01/02/03) verify each bug exploitable pre-fix, blocked post-fix. See `docs/journals/260714-gh1587-tenant-isolation-bugs-a-e.md` for pattern analysis + follow-up scope (Orders/Customers/Sites).

- **PR #1591 pre-merge** fix(F37): 3 bugs from code review — Code-review adversarial pass on PR #1591 (US-F37-02 + Opening Hours redesign + Geo-cascade) found and fixed 3 bugs, all verified red→green: (1) **opening-hours Zod refine incomplete** — `.refine()` covered schema-level validation but some paths to `opens`/`closes` fields remained uncovered. Fixed by switching to `.superRefine()` (allows per-error granularity) + added cross-field field-level validate in `src/collections/Sites.ts` using `siblingData` to access `isClosed` state. **Impact:** pre-fix bug allowed invalid rows (missing/malformed times on open days) to persist, silently rejected by save API. Tests: TC-F37-02-25 (3 new cases in `sites-local-business.test.ts`). (2) **geo-cascade race condition** — `bootstrap()` async reverse-resolve on mount could complete after user manually selected a cascade value, silently overwriting the choice. Fixed by adding `userInteractedRef` guard — bootstrap skips writes if user has interacted. **Impact:** on rapid edit of existing address, pre-fill could clobber user's manual selection. Tests: TC-F37-01-25 (added to `geo-cascade-fields.test.tsx`). (3) **check-migrations.js false-negative risk + compact-form miss** — (a) caller `getNewFieldsFromDiff()` was skipping field names that appeared both in diff AND somewhere as array-nested in the file (poor intersection logic), now explicit intersect prevents false-negative when a field is both newly top-level AND happens to be array-nested elsewhere; (b) `getArrayNestedFieldNames()` regex missed compact single-line field forms (`{ name: 'x', type: 'y' }`), only detected multi-line. Fixed by adding compact form regex branch. Also refactored for testability: `module.exports` + `require.main === module` guard. **Impact:** edge-case false-negatives where newly-added array-nested fields were skipped or compact forms missed. Tests: TC-F37-03-CHECK-01..03 (3 new in new `check-migrations.test.ts`). Full suite: all 3 fixes verified independently fail-without-fix / pass-with-fix; tsc clean; docs updated § 3.7–3.11 `docs/qa/F37-local-seo.md`.

- **PR #1591 pre-merge, round 2** fix: check-migrations.js redesign + 3 bugs from a second code review — `check-migrations.js`'s new-field detection was fully redesigned (base-vs-current file comparison by `(name, nested)` identity, replacing diff-line parsing entirely — closes 4 rounds of false-negatives from lost hunk boundaries; see `docs/journals/260713-pr1591-f37-02-three-bug-fixes.md`). A second adversarial review of that redesign + the round-1 fixes above raised 3 more concerns: **(C1, reported HIGH, investigated and found ALREADY FIXED)** the reviewer flagged that the 4 state-name fixes in `scripts/data/malaysia-geo.json` (`W.P. Kuala Lumpur→Kuala Lumpur`, `W.P. Labuan→Labuan`, `Pulau Pinang→Penang`, `W.P. Putrajaya→Putrajaya`) would never reach an already-seeded staging/prod DB, since `seed-malaysia-geo-boot.js` skips entirely once `malaysia_states` has rows. A migration was initially added to `scripts/db-setup.js` to cover this — but a follow-up question surfaced that `db-setup.js` already contains an equivalent normalize migration (`malaysia_states.normalize_penang/kl/putrajaya/labuan`, commit `d5c03917`, 2026-05-25) that predates this PR and is already merged into `staging` (`git merge-base --is-ancestor d5c03917 origin/staging` confirms). Since `runMigrations()` re-runs every entry on every deploy (not version-tracked), staging's `malaysia_states.name` has already been normalized on every deploy since 2026-05-25. The newly-added migration was therefore a pure duplicate and was removed. **Process gap identified:** neither the original reviewer, nor the initial fix, nor the Stage 2/Stage 3 code-review passes caught this — all traced `seed-malaysia-geo-boot.js`'s skip-if-seeded behavior and `db-setup.js`'s execution order in detail, but none grepped the full `MIGRATIONS` array for an existing `malaysia_states` entry before concluding a new one was needed. **(C2, Medium-High)** `sanitizeLegacyOpeningHours` (added in round 1's fix) only ran when `patch.openingHours` was absent — but `applyBatchSave` passes every day NOT being edited through unchanged, so a legacy-invalid row on an untouched day still 400'd a modal save. Also, orphan rows with no `dayOfWeek` were kept unconditionally by `applyBatchSave` (correct for local edits) but are invisible in the UI (`groupRowsByDay` never matches them) and unfixable by the user, silently exhausting the 21-row cap. Fixed by calling the sanitize unconditionally (no-op for `encodeDay`'s well-formed output) and dropping no-`dayOfWeek` rows at the save boundary. Tests: TC-F37-02-26, TC-F37-02-27. **(C3, Medium)** `isPathMissingAtRef`'s regex only matched `does not exist in`, but the realistic git error for the redesign's actual code path (file passed `existsSync()`, absent at base) is `exists on disk, but not in '<ref>'` — a brand-new tracked collection file would silently skip the new-field check entirely instead of getting flagged. Fixed regex + added TC-check-migrations-08 with the real captured message. Also answered the reviewer's Q2 (not just C1-C3): added a `beforeValidate` hook (`sanitizeOpeningHoursOnValidate`) to `src/collections/Sites.ts` reusing the same `sanitizeLegacyOpeningHours`, so a direct Payload admin-panel edit (bypasses the custom Editor UI's client-side sanitize entirely) gets the same self-heal — closing the same C2 bug class for that write path too. **Stage 3 adversarial pass** on this whole round-2 fix set (traced live Payload CMS source inside the running container to verify the `beforeValidate` hook's spread/merge never wipes sibling `localBusiness` fields on a partial PATCH — confirmed safe by tracing `fields-level beforeValidate` backfill order, not assumed) found one real Medium gap: the new hook itself had zero direct test coverage (only the pure function it delegates to was tested). Fixed: exported `sanitizeOpeningHoursOnValidate`, added `sites-opening-hours-sanitize-hook.test.ts` (TC-F37-02-28, 8 tests incl. sibling/top-level-field non-mutation guard). Full suite verified clean (140/140 across all F37 + check-migrations + hook test files); docs updated §3.12–3.13, §4.8–4.9 `docs/qa/F37-local-seo.md`.
- **GH-1579** fix(pagination): hide table pagination bar when total ≤ 10 — **Shared `TablePagination` component** (`src/components/ui/table-pagination.tsx`) now returns `null` when dataset fits on first default page (total ≤ 10), avoiding empty bordered footer and orphaned padding. **New exported helpers:** `shouldShowTablePagination(total, rowsOptions?)` — gates 11 dashboard table caller wrappers so no empty div remains; `useTablePageClamp(page, total, limit, onPageChange, enabled?)` — snaps stranded page back to last valid page when shrinking dataset (e.g., after deletion), wired into products/staff/categories/blog/contact-leads/discounts (list + usage history)/orders; delete flows refetch after the server commit so records+total reconcile atomically (no rows stranded when a delete crosses the 11→10 hide boundary, no DELETE race). **UX refinement:** rows-per-page `<select>` now displays lucide `ChevronDown` icon (muted, non-interactive) for visual consistency. **Intentional behavior changes:** customers-detail-orders-tab pager now hidden for total 1–10 (previously always shown); blog card-view pager gate changed from dynamic `total > limit` to fixed `total > 10` (identical at default limit 10; with limit 25/50/100 and 10 < total ≤ limit the pager now shows instead of hiding). **Tests:** TC-DS1222-05-06 updated (total=0 → null); added TC-DS1222-05-07..10 (hide/show boundaries, icon, page-clamp edge cases). See `docs/qa/F-DS-1222-table-standardization.md` § NHÓM 05.

- **GH-1557** fix(editor): mobile editor UX/interaction bugs (4 of 7 fixed) — QA found 7 interaction bugs on the real Editor's mobile/compact view (`/editor/[siteId]`). **Bug 1 (iOS auto-zoom) — not fixed, by decision:** after discussion, this is standard iOS Safari behavior (auto-zoom on focusing a sub-16px input), not treated as a bug to fix here; `input.tsx` left unchanged. **Bug 2 (Template picker Preview button legibility):** already fixed by unrelated commit `076b24e8d` (#1538) before this branch started — no new change needed. **Bug 4 (scroll lock):** `CompactEditorLayout.tsx` gained a single `useEffect` locking `document.body.style.overflow` while either the block-settings sheet or Tools sheet is open, keyed on `(isMobileSettingsOpen || toolsSheetOpen)` to avoid a two-writers race across sheet transitions. **Bug 7 (nav/footer tap routing):** `handleMobileBlockSelect` (`page.tsx`) now routes `navigation`/`footer`/`breadcrumb` taps to the Settings panel's Menu tab like desktop's `handleBlockSelectWithContext`; `CompactEditorLayout.tsx` needed an additional `navFooterMenuMode` fix (not in the original plan) since `currentBlock` never resolves for these block types and the sheet only mounted `if (currentBlock)`. **Bug 3/6 (image tap opens a buried toolbar):** `PreviewScripts.tsx`'s `onClick` now skips posting `BLOCK_CONTAINER_CLICKED` for taps that land on an editable image (shared `resolveEditableImageBlock()` helper, also used by the pre-existing `IMAGE_EDITING_STARTED` branch to avoid duplicated detection logic), so the full-screen block-settings sheet no longer covers the small Change-Image toolbar. Scoped to `?compact=1` (mobile/tablet) only — desktop's always-visible SettingsPanel intentionally shows both the block selection and the image toolbar together, unchanged. No change needed to `hero-media-overlay.tsx`/`LogoImageOverlay.tsx`/`gallery/index.tsx` — an initial attempt at a touch-visibility CSS fix for Hero's own overlay button was reverted after code review found it actually broke the fix above (its `pointer-events-auto` scrim sat on top of the real `<img>`, diverting taps away from it); the generic mutual-exclusion fix alone already covers Hero via the existing floating `ImageToolbar`. **Bug 5 (mobile inline text-edit) — not implemented, confirmed with PM as intentional:** would have reversed a deliberate decision from PR #1485/#1472 (commit `7d035d55`); PM confirmed mobile has no inline text edit by design — only block/component editing via the settings sheet, matching current behavior. Bugs 1 and 5 both stay open on the issue tracker as won't-fix (product decisions, not silently dropped). **Tests:** 11 new unit tests (TC-GH1557-04-01/02, 05-01..04, 06-01/02, 07-01..03) across 3 new files in `src/__tests__/unit/editor/`; full suite 469 files / 8587 tests passing, `tsc --noEmit` clean. See `docs/qa/F05-ai-editor-testcases.md` § GH-1557 and `plans/260709-1659-GH-1557-mobile-editor-ux-bugs/`.

- **GH-1337** fix(contact-leads): badge figma redesign + font portal fix — **Badges:** new `_lib/badge-tokens.ts` is the single source of truth for tinted rgba colors (STATUS_COLORS + SOURCE_COLORS, Figma node-id 32179-5360/5364). `customer-status-badge.tsx` + `customer-source-badge.tsx` rewritten: dropped shadcn Badge variants, now use inline `style={}` from badge-tokens (pill shape, rgba bg/border/text per status/source). `customer-detail-panel.tsx` removed duplicate STATUS_COLORS definition, imports from badge-tokens; StatusDropdown and text sizes normalized to Tailwind semantic tokens (`text-sm`, `text-xs`, `text-lg`, `text-xl`, `text-2xl`). Tests: TC-CUST-26..29 assertions migrated from `className.toContain()` to `toHaveStyle({ color })` (7/7 pass). **Font:** `src/lib/fonts/variables.ts` aggregates all next/font CSS variable class names; applied to `<html>` in root layout so `--font-*` vars are available in portals (CustomerDetailPanel createPortal). Removed `--font-inter/outfit: system-ui` fallback from `globals.css` `:root` that was overriding Inter via equal CSS specificity. **Impact:** Contact Leads badges exactly match Figma spec; Inter font renders correctly in portal-rendered detail panel.

- **GH-1410** fix(products): silent-fail on AI chat create products — dual write+read-side tenant ID mismatch. **Write-side:** `src/app/(dashboard)/products/actions.ts` `saveProductAction` did not explicitly set `tenant` field on created product; relied on `beforeChangeHook` which may not populate tenants in Server Action context. Added `data.tenant = tenantIdForQuery(user)` before `payload.create()`. **Read-side:** `src/lib/auth.ts` `extractTenantId()` returns string but Neon PostgreSQL `products.tenant_id` is INTEGER — WHERE filter silently matched nothing. Added `tenantIdForQuery()` helper that coerces numeric strings to `Number` before query. **Frontend:** `src/components/dashboard/BulkCreateModal.tsx` now verifies `res?.id` before counting success; shows `toast.error` with JSON-parsed server error message instead of silent `console.warn`; fixed plural grammar in i18n keys. **Tests:** 10 new unit tests (TC-F08-04-26..31) in `src/__tests__/unit/actions/save-product-action.test.ts`, `src/__tests__/unit/lib/auth.test.ts`, `src/__tests__/unit/dashboard/bulk-create-save.test.tsx`. Updated `docs/qa/F08-product-crud.md` test registry.

- **GH-1587** fix(categories): field-level access control + parent cross-tenant validation — **Security hardening (8 confirmed PR #1605 findings):** Categories collection lacked field-level Payload `access` blocks, allowing authenticated tenant users to overwrite sensitive fields (`dna`, `tenant`, `site`, `deletedAt`) via REST API. **Field access fixes:** `dna` field now gated super-admin-only for both create+update (closes C1 create-path smuggling vector). `tenant` and `site` fields now absolutely locked for ALL users including super-admin on both create+update; these are server-injected-only via `beforeChange` hook or legitimate reassignment via raw SQL outside the Payload API (GH-1587 H2). `deletedAt` field locked for update (soft-delete only via `deleteCategoryAction`'s internal write with `overrideAccess:true`, GH-1587 H1). **Parent cross-tenant validation:** `beforeValidate` hook now validates that a category's parent belongs to the same tenant as the category itself, preventing tenant-A user from nesting their category under a tenant-B parent (GH-1587 H2). Validation enforces 3-level max depth, cycle detection, and derives owner tenant from authenticated `req.user` (create) or persisted `originalDoc.tenant` (update), never from client payload. **Error handling:** Raw Vietnamese error strings converted to sentinel codes (`CATEGORY_CYCLE_ERROR`, `CATEGORY_MAX_DEPTH_ERROR`, `CATEGORY_PARENT_TENANT_MISMATCH`) for proper i18n handling; new i18n key `dashboard.products.categories.toast.parentTenantMismatch` added to en.json/ms.json for user-facing error message. **Breadcrumb staleness fix:** Partial re-parent updates (e.g. `{ parent: null }`) now correctly fall back to existing `originalDoc.name` when computing breadcrumb instead of stomping it with "undefined" (GH-1587 M2). **Server actions schema:** Replaced `.passthrough()` with explicit field allowlist in `src/app/(dashboard)/products/categories/actions.ts` for safer payload handling. **Files modified:** `src/collections/Categories.ts` (field access + validation hooks), `src/app/(dashboard)/products/categories/actions.ts` (schema allowlist), `scripts/db-setup.js` (DDL cleanup: conditional DROP INDEX guard), `src/i18n/locales/{en,ms}.json` (new toast key). **Tests:** All 77 existing category tests + new regression tests pass. **QA doc:** `docs/qa/F08-product-crud.md` updated in Phase 03 (TC-F08-05-05 corrected, TC-F08-05-07 marked removed) — no re-touch needed.

- **[#1386]** fix(tracking): normalize site-slug prefix in pageUrl tracking — `src/components/site-renderer/TrackingManager.tsx` now strips `/sites/{slug}` prefix from page paths before sending analytics requests. Root cause: SiteLayoutShell renders URLs via `pathname` which includes `/sites/{slug}` prefix on direct/cross-tenant access, while subdomain URLs skip the prefix entirely, causing same page to log as different pageUrl (GH-1386 duplicate "top blogs" entries). Fix: regex `replace(/^\/sites\/[^/]+/, '') || '/'` normalizes both access patterns to canonical path. Moved TrackingManager rendering from inline product page to SiteLayoutShell for DRY enforcement across all shell-wrapped pages (blog, product, etc.). Removed inline TrackingManager from `src/app/sites/[slug]/products/[productSlug]/page.tsx`. Tests: 5 new TC-IDs (TC-F09-TRACK-09..13) validate normalization: prefixed blog → `/blog/*`, prefixed product → `/products/*`, root with slash → `/`, root without slash → `/`, already-clean paths unchanged. See `src/__tests__/unit/storefront/tracking-manager.test.tsx`. **Note:** This fix resolves "Top Blogs" duplicate-entry grouping. "Top Products" widget aggregation is a separate follow-up — `AnalyticsView.tsx:99` aggregator currently matches `/product/` (singular) while normalized product URLs are `/products/` (plural); tracked separately.

- **GH-1364** fix(contact, newsletter): input visibility + form fallback — **Newsletter:** `src/blocks/newsletter/index.tsx` line 176 added `bg-[rgba(var(--brand-primary-rgb),0.03)] placeholder:text-[var(--text-muted)]` CSS classes to brand-variant input, fixing invisible placeholder text in light-mode storefront (inverse variant already had proper white/light colors). **Contact:** `src/blocks/contact/index.tsx` added `DEFAULT_FORM_FIELDS` constant (name/email/phone/message) + fallback logic on line 176 to render sensible defaults when `formFields` array is empty, preventing blank form renders.
- **[#1266]** fix(ai): hero variant lock-in + video placeholder — AI-generated hero blocks showing "No video URL provided" placeholder and repeated same variant regardless of category. Root causes: (1) BROKEN_VARIANTS.hero missing video/split-video variants in template-composer.ts, (2) narrow hero pools (4 variants each for tech/fitness) biasing seed-based picker toward minimal variant, (3) batch3 preset homepage heroes over-represented minimal variant (34% of 16 presets). Fixes: expanded BROKEN_VARIANTS to include video variants, diversified tech pool → 6 variants (added split-left, slideshow), fitness pool → 6 variants (added split-left, magazine), diversified batch3 homepage presets to span 8 distinct variants across 16 presets. Files: `src/lib/ai/template-composer.ts` (BROKEN_VARIANTS, pool expansion), `src/lib/ai/openai-generator.ts` (hero pool alignment), `src/lib/ai/template-presets-batch3.ts` (preset diversification), `src/__tests__/unit/ai/gh-1266-hero-variant-rotation.test.ts` (13 tests, TC-1266-10..14), `docs/qa/F01-ai-builder-variety.md` (TC-1266-10..14 registration).

- **[#1179]** fix(cart): validate quantity against variant stock not aggregate inventory — `src/components/storefront/product-add-to-cart-section.tsx` now uses `selectedVariant?.stock` as inventory source when variant is selected, preventing UX mismatch with server-side CAS. Component previously checked `product.inventory` (aggregate), causing users to be able to add quantities unavailable in the selected variant. Affected by TC-F09.237x, TC-F09.238x regression tests.

- **GH-1293** fix(sso): increase timeout + deduplicate step events via upsert — SSO Hub provisioning timeout raised from 10s to 30s to handle slow network conditions; `sso_step_events` collection now uses unique index and upsert logic to prevent duplicate (user_id, step) entries on retry; 4 provisioning routes updated to use Next.js `after()` for reliable event notification without blocking response. See `src/lib/sso/sso-api-client.ts` + `scripts/db-setup.js` migrations + `src/__tests__/unit/lib/sso-api-client.test.ts`.

---

### F37 — Local Business Data Model (US-01, Phase 03: Editor UI Accordion)

**Sellers can now enter and save local business information in the AI Editor. Editor accordion with address, hours, category, and service area — data persists end-to-end.**

**Phase 03 deliverables:**

- **New UI component — Local Business Info accordion** (`src/components/editor/SettingsPanel.tsx`): added to AI Editor's global Site Settings, open by default. Sellers can enter: structured address (street/city/state select with MY_STATES enum, postcode, country), Google Maps link with auto-extraction, manual lat/lng advanced fallback, business category (dropdown, limited enum per PRD), price range (select), service area description (textarea), and opening hours table (7 rows for Mon-Sun with closed-day toggle + time inputs). Data field: `site.localBusiness` (Payload group, Phase 01 — `src/collections/Sites.ts`). Minimal completion checklist (address/hours/category saved ✓/○) provides UX feedback. Save-route validation via `localBusinessSchema` Zod object in `src/lib/validations/sites.ts`.

- **Maps link resolver API route** (`POST /api/local-seo/resolve-maps-link`, auth-gated): 3-layer geocoding pipeline for extracting lat/lng from seller's pasted Google Maps link. (1) Client-side regex extraction (handles common Maps URL formats), (2) server redirect-resolver (follows short links, e.g. `maps.app.goo.gl`), (3) Geocoding API fallback (requires optional `GOOGLE_MAPS_GEOCODING_API_KEY`). SSRF-hardened with host allowlist, rate-limited per user. Returns `{ lat: number, lng: number, source: 'redirect' | 'geocode' }` on success or 422 on failure. Gracefully degrades when Geocoding API key absent (layers 1-2 cover ~90-95% of cases per PRD); editor reveals manual lat/lng input when layer 3 unavailable.

- **Optional env var** (`GOOGLE_MAPS_GEOCODING_API_KEY`): added to `.env.staging.example` and `.env.production.example`. Documented in both files with explanation of optional nature and fallback behavior. When unset, routes skip layer 3 geocoding; sellers can still enter data manually. Non-breaking; no env var required for local business feature to function.

- **Data persistence:** wired to the existing site-save API (`PATCH /api/sites/[siteId]/save`, `src/app/api/sites/[siteId]/save/route.ts`), invoked via `handleSiteSettingsChange` in `src/app/(editor)/editor/[siteId]/page.tsx`. That handler and its `localBusiness` round-trip through `src/app/api/sites/[siteId]/editor-data/route.ts` were extended in this phase (were previously missing from the load/save cycle). Editor accordion state round-trips correctly on reload; data persists across sessions.

**Non-breaking:** Existing sites without `localBusiness` unaffected. Field is optional at save. Phase 04-05 (JSON-LD emission, Local SEO Score) will follow; this phase delivers pure data-entry UX.

**Related phases:** Phase 04 (JSON-LD wiring + structured data tests) and Phase 05 (Local SEO Score calculation) pending. Phase 06 (QA/docs) follows final feature completion.

---

### F37 — Local Business Data Model (US-01, Phase 04: JSON-LD Enrichment)

**Homepage now emits richer LocalBusiness JSON-LD with structured address, hours, and category-specific Schema.org @type — even without a Contact block.**

**Phase 04 deliverables:**

- **Enhanced LocalBusiness JSON-LD emission:** `src/lib/seo/json-ld.ts` `generateLocalBusinessSchema()` now emits full structured schema instead of bare street-address string:
  - **PostalAddress:** street / city / state / postcode / country (from Phase 03's `site.localBusiness` form data)
  - **GeoCoordinates:** latitude / longitude (from Maps resolver or manual entry)
  - **OpeningHoursSpecification:** 7 days with times, filtered to exclude `isClosed` days (from opening hours table)
  - **Category-derived @type:** Not generic `LocalBusiness`, but category-specific sub-types (`Restaurant`, `FoodEstablishment`, `MedicalClinic`, `Store`, etc.) derived from seller's chosen `businessCategory`. Examples: `businessCategory: 'foodEstablishment'` → `@type: 'FoodEstablishment'` in emitted JSON-LD
  - **priceRange:** Seller-provided or category heuristic ($$, $$$, etc.)
  - **areaServed:** Seller's service area description
- **New mapping module:** `src/lib/seo/schema-helpers.ts` centralizes category→Schema.org @type logic:
  - `schemaTypeForLocalBusiness(businessCategory)` — F37's business category vocabulary maps 1:1 to Schema.org types; fallback to generic `LocalBusiness` for unknown values (Google accepts)
  - `priceRangeForLocalBusinessCategory(businessCategory)` — category-specific price-range heuristics
  - `dayOfWeekToSchema(code)` — opening-hours day-of-week mapping (Mo→Monday, Tu→Tuesday, etc.)
  - Also contains refactored AI-gen category mappings (moved from `json-ld-templates.ts`, unchanged behavior). Two separate vocabularies: AI-gen (`restaurant`, `fnb`, `health`) and F37 (`foodEstablishment`, `healthAndBeautyBusiness`, etc.) — intentionally NOT unified
- **Loosened homepage trigger:** LocalBusiness JSON-LD now emits when `site.localBusiness` has meaningful data (street address OR non-closed opening hours), independent of Contact block. Previously only appeared if Contact block existed on page.
- **Security + compliance:**
  - `serializeJsonLd()` XSS-hardens JSON-LD string before `dangerouslySetInnerHTML` (escapes `<`, `>`, `&`, line separators)
  - No `aggregateRating` at LocalBusiness level (matches Google 2025–26 policy forbidding this at LocalBusiness; review aggregation only at Review/Product level)

**Tests:** the 9 pre-existing cases (TC-F03.G3-01..09) in `src/__tests__/unit/seo/json-ld-enrichment.test.ts` predate F37 and confirm the legacy (no `localBusiness` group) path is unchanged. The new Phase 04 behaviors above (structured address, geo, opening-hours filtering, category mapping) were verified during implementation via a temporary test file, deleted after use — permanent TC-ID-tagged coverage for them is deferred to Phase 06.

**Non-breaking:** Existing sites without `localBusiness` unaffected. Homepages with Contact blocks unchanged. Only affects SEO crawlers; no user-visible UI change.

**Impact:** Sellers' local business data (from Phase 03 UI) now produces rich, search-engine-discoverable structured data on live storefront. This is the core SEO payoff of F37: richer context helps Google Business Profile integration, voice search, and local AI assistant retrieval.

**Related phases:** Phase 05 (Local SEO Score calculation) will layer scoring diagnostics atop Phase 04's emission. Phase 03 → Phase 04 → Phase 05 is one complete user journey: enter data → emit rich SEO output → compute performance score.

---

### F37 — Local Business Data Model (US-01, Phase 05: Local SEO Score Backend)

**Backend scoring engine + read-only API endpoint for local SEO performance diagnostics. Infrastructure layer for future US-F37-04 dashboard — score not yet displayed to users.**

**Phase 05 deliverables:**

- **Local SEO Score calculation function:** `src/lib/seo/local-seo-score.ts` exports `calculateLocalSeoScore(input: LocalSeoScoreInput): LocalSeoScoreResult`. Points-subtraction model (start 100, deduct for missing signals), yielding integer 0–100 + breakdown object with per-bucket scores. **4 buckets (Phase 1):**
  - **Business Data (35 pts):** businessName, address, phone, hours, category, website, description — 5 pts each (7 signals max)
  - **Structured Data (30 pts):** LocalBusiness JSON-LD (10) + industry subtype (5) + FAQ schema (8) + Organization schema (7)
  - **AI Discoverability (20 pts):** allowsSearchBots (12) + sitemapPresent (8) — **critical fix: deliberately NO "blocks suspicious bots" sub-signal** — PRD §13.8 explicitly forbids this (contradicts BR-03, the architectural decision that AI crawlers default to ALLOW). A prior research proposal suggested a 10/5/5 split with that sub-signal; rejected and NOT followed.
  - **Technical Health (15 pts):** coreWebVitals ≥80 (8), mobileResponsive (4), httpsEnabled (3) — **known limitation: these three are hardcoded assume-passing placeholders** (no real Lighthouse/CWV measurement infra). Flagged for PM decision before US-F37-04's dashboard surfaces the score to sellers; PRD §13.8's "earned/applicable" normalization pattern may be the right fix if these stay unmeasured.

- **API endpoint:** `GET /api/sites/[siteId]/local-seo-score` (auth-gated). Returns `{ success: true, score, breakdown }`. Signal sourcing notes in route handler comment explain placeholders and real signals (`allowsSearchBots` reflects actual robots.txt state pre-US-F37-03, `sitemapPresent` uses real `site.status === 'published'` check).

- **Exported types + helpers from `src/lib/seo/json-ld.ts`:** Phase 05 made 3 previously-internal symbols public: `LocalBusinessOpeningHour` (shape of one opening-hours row), `LocalBusinessSiteData` (full shape of `site.localBusiness` group), `hasMeaningfulLocalBusinessData(localBusiness)` predicate. Used by route handler to detect when `localBusiness` has enough data to contribute score signals.

- **Test coverage:** `src/__tests__/unit/seo/local-seo-score.test.ts` with TC-F37-01-10 (≥20pt gain when business data saved — acceptance criterion AC-1), TC-F37-01-11 (bounded 0–100 + bucket sum validation). Includes explicit test validating the NO `blocksSuspiciousBots` design decision (type-level + runtime assertion on AI Discoverability bucket).

**Non-breaking:** Scoring function is pure; API endpoint is read-only and new. Existing sites without `localBusiness` will score lower (missing signals) but that's correct. No schema/UI changes in this phase.

**Impact:** Backend infrastructure now ready for US-F37-04 (Local SEO Score Dashboard widget + checklist). Score calculation matches canonical PRD §13.8 spec — critical architectural decision ("no block-bots sub-signal") is locked in code + tests, preventing accidental reversion when Phase 2 (GBP) lands.

**Related phases:** Phase 06 (QA / permanent test coverage) will add comprehensive TC-ID-tagged tests for scoring behavior. Phase 03 (data entry) → Phase 04 (JSON-LD emission) → Phase 05 (score calculation) → Phase 06 (dashboard UI) completes the user journey.

### F37 — Local Business Data Model (US-01, Phase 06: Test Coverage & QA Finalization)

**Permanent test coverage + QA documentation for all Phase 03–05 behaviors. Story US-F37-01 now complete and fully tested.**

**Phase 06 deliverables:**

- **Test suite:** 34 unit tests across 3 files formalize provisional TC-IDs TC-F37-01-01..12:
  - `src/__tests__/unit/validations/sites-local-business.test.ts` (11 tests): Zod schema validation for latitude/longitude/postcode bounds, localBusiness-only PATCH acceptance, XSS sanitization (2 security tests)
  - `src/__tests__/unit/seo/local-business-json-ld.test.ts` (17 tests): Full PostalAddress + geo emission, opening-hours filtering, no aggregateRating, category→@type mapping, homepage trigger dedupe, 7-day week mapping, XSS-safe JSON-LD serialization (1 security test)
  - `src/__tests__/unit/seo/local-seo-score.test.ts` (6 tests): ≥20pt gain on business data save, bounds 0..100, bucket breakdown sum validation, no "blocks suspicious bots" sub-signal (architectural decision validation per PRD §13.8)

- **QA documentation:** `docs/qa/F37-local-seo.md` formalizes TC-IDs with AC/FR cross-references, test file locations, execution commands, and known limitations (Technical Health signal hardcoding flagged for PM review before US-F37-04 dashboard ships).

**Test results:** 1301/1301 full suite pass. 100% coverage on new functions. Zero XSS escapes, zero schema compliance violations.

**Non-breaking:** All tests are read-only; no code changes in Phase 06 beyond tests themselves.

**Impact:** US-F37-01 (Local Business Data Model) now complete across all 6 phases: Phase 01 (schema), Phase 02 (validation), Phase 03 (UI data entry), Phase 04 (JSON-LD emission), Phase 05 (score backend), Phase 06 (permanent test coverage). Ready for US-F37-04 (Local SEO Score Dashboard widget) and Phase 2 (GBP OAuth) dependency work.

---

### US-F37-03 — AI Crawler Permissions & llms.txt

**AI crawler default-allow + dynamic content-contract route. First phase of Local SEO feature.**

**Implementation complete (46 new/passing SEO unit tests, 2 adversarial review passes):**
- **New field:** `aiCrawlersEnabled` boolean on Sites collection (`src/collections/Sites.ts`, default `true`, migration in `scripts/db-setup.js`) — seller opt-out toggle for AI crawler access.
- **robots.txt dynamic defaults:** `src/app/sites/[slug]/robots.txt/route.ts` fetches site config and honors the toggle. Default behavior: GPTBot, ClaudeBot, Google-Extended, PerplexityBot, CCBot are allowed (Disallow rules removed); scraper bots (Amazonbot, Bytespider, etc.) always blocked. When toggle is `false`, only the 5 AI bots get `Disallow: /` rule. Googlebot and other standard crawlers unaffected by toggle. Cache TTL kept short (10 min / 1h stale) so toggle changes propagate quickly.
- **New llms.txt route:** `src/app/sites/[slug]/llms.txt/route.ts` serves dynamic markdown content-contract per tenant, scoped by `site.id` (not just tenant) for pages/products/blogs to avoid cross-site leakage on multi-site tenants. Includes: business name, description, 5+ key URLs (floored via static routes for sparse new sites), contact info, opening hours (from US-F37-01's `site.localBusiness.openingHours`, once that merged into this branch), experimental-standard notice. Response cached 5 minutes. 404 on missing tenant/site.
- **API toggle endpoint:** `src/app/api/seo/ai-crawlers-toggle/route.ts` (POST) — owner-auth + tenant-ownership check (403 prevention on cross-tenant IDOR). Validates `siteId` presence (400 on missing) and rejects string values for `enabled`.
- **Dashboard UI:** AI-crawler toggle in `src/components/dashboard/revamp/seo-tools.tsx`, wired via `src/lib/dashboard/seo-data.ts` → `src/lib/dashboard/dashboard-types.ts` → `src/app/(dashboard)/dashboard/page.tsx`. Fires analytics event `ai_crawler_toggle_changed` client-side on successful persist. i18n strings under `dashboard.revamp.tools.aiCrawlers*` in `src/i18n/locales/en.json` and `ms.json`.
- **Tests:** All 46 new tests passing (TC-F37-03-01 through TC-F37-03-46 provisional IDs; QC backfill required post-merge, see Open Blockers).

**Acceptance Criteria (from US-F37-03 story):**
- AC-4: robots.txt allows GPTBot/ClaudeBot by default, blocks scrapers always, respects toggle ✓
- AC-5: /llms.txt serves markdown per-tenant, 5-min cache, 404 on missing site ✓
- AC-6: POST toggle endpoint enforces auth + tenant-ownership, logs analytics ✓

**Related:** PRD `docs/prd/F37-local-seo-search-performance.md` (FR-07/08/09), stories `docs/stories/F37-local-seo-stories.md` (US-F37-03). Plan detail `plans/260708-1112-GH-03-ai-crawler-llms-txt/`.

**QC NOTE:** Test case IDs use provisional TC-F37-03-01 through 46 format. QC/PM must backfill official TC-IDs in `docs/qa/F37-local-seo.md` post-merge (file does not yet exist; copy story acceptance criteria as scaffold).

**Known follow-ups (from adversarial + independent PR review, deferred — not blocking):** (1) Schema allows 2+ published sites per tenant (no unique constraint); `robots.txt`/`llms.txt` site lookup now sorts by `createdAt` for determinism, but `aiCrawlersEnabled` is per-site while the route resolves per-tenant — a sibling site's compliance opt-out could silently not apply if a tenant genuinely has multiple published sites (pre-existing pattern shared with `sitemap.xml`). No current product flow creates this configuration, so it's a best-effort mitigation, not a guarantee. Revisit with real domain-based per-site resolution if multi-site-per-tenant becomes supported. (2) `ai-crawlers-toggle` ownership check accepts any tenant in the user's full tenant list while `withFeatureGuard` only checks `tenants[0]` — same mismatch pre-exists in the sibling `auto-meta-toggle` route. Confirmed with PM: current product reality is 1 tenant per user, so not actively exploitable today; revisit if multi-tenant-per-user becomes supported (needs a coordinated fix across both routes at that point).
---

### F37 — Opening Hours Editor Redesign (Google Maps-style List View + Edit Modal, Multi-day Batch & Split-shift)

**Local Business opening-hours editor redesigned from fixed 7-row inline table to Google Maps-style list view + modal, enabling multi-day batch edits and split-shift support (3 time ranges/day).**

**Deliverables:**

- **New pure-logic utilities module:** `src/components/editor/local-business/opening-hours-utils.ts` (1:1 row-data model, no canonicalization). Exports:
  - `groupRowsByDay(rows)` — flatten array into day→ranges[] map for UI rendering
  - `rangesFromDay(day, rows)` — extract time ranges for a single day
  - `applyBatchSave(rows, selectedDays, ranges)` — atomic overwrite: drop all rows of selected days, re-insert from new ranges (Google parity)
  - `defaultWeek()` — suggested default (Mon–Fri open, weekend closed)
  - `describeDay(day)` — human label for day code

- **New edit modal component:** `src/components/editor/local-business/opening-hours-edit-modal.tsx` (Radix Dialog, multi-day select toggle buttons, 3 time-range add/edit slots, closed/open-24h/custom modes). Features:
  - Multi-day selector (7 day-toggle buttons, wraps at ~320px width)
  - Mode picker: Closed / Open 24h (00:00–23:59) / Custom (N time ranges, N ≤ 3)
  - Add Range button (up to 3 per day in modal)
  - Save overwrites selected days atomically; Cancel discards changes

- **Redesigned list-view editor:** Renamed `src/components/editor/local-business/opening-hours-table.tsx` → `opening-hours-editor.tsx`; component export `OpeningHoursTable` → `OpeningHoursEditor`. Now renders:
  - One row per day (Mo–Su), height scales with number of time ranges (split-shift support)
  - "Closed" badge for closed days, multi-line time ranges for open days
  - Edit pencil icon → opens modal
  - Quick-actions: "Edit all" (pre-fill from Monday), "Edit Mon–Fri" (batch weekday edit)
  - Old fixed-7-row table deleted

- **Validation cap increase:** `src/collections/Sites.ts` + `src/lib/validations/sites.ts` raised `openingHours.maxRows` from 7 to 21 (7 days × 3 shifts max). Zod cap synced with collection schema; enforced invariant prevents overflow.

- **SettingsPanel wiring:** `src/components/editor/SettingsPanel.tsx` updated: 1-line import swap (`OpeningHoursEditor` imports + tag name change). Contract unchanged (same `onChange(rows)` callback).

- **i18n updates:** `src/i18n/locales/en.json`, `ms.json` — 9 new keys (editAllHours, editWeekdaysHours, addTimeRange, multipleTimeRanges, openingTime, closingTime, etc.).

- **No DB migration:** `day_of_week` has no unique constraint; 1:1 row mapping to new flat array model — existing data loads without loss.

- **Architecture notes:**
  - Save semantics: **overwrite, not merge**. Selecting Mon/Wed and saving new ranges drops all Mon/Wed rows, inserts new ones (Google Calendar parity).
  - Encoding: closed = 1 row `{isClosed:true}`; open-24h = `{opens:'00:00', closes:'23:59'}`; split = N rows, same day, different times.
  - Cap: 3 ranges/day in modal → 7×3 = 21 total rows (invariant).
  - JSON-LD emission unchanged (already split-shift compatible; Phase 04's `OpeningHoursSpecification` generator handles 1:1 row mapping).

**Tests:** 75/75 F37 test suite passing (49 before, +26 new tests). Unit + component coverage for list-view, modal, batch-save logic, validation. See `docs/qa/F37-local-seo.md` (v2.5) for TC-IDs.

**Files created:** `src/components/editor/local-business/opening-hours-utils.ts`, `src/components/editor/local-business/opening-hours-edit-modal.tsx`. **Files deleted:** `src/components/editor/local-business/opening-hours-table.tsx`. **Files modified:** `src/components/editor/SettingsPanel.tsx`, `src/collections/Sites.ts`, `src/lib/validations/sites.ts`, `src/i18n/locales/{en,ms}.json`, `src/__tests__/unit/seo/local-business-json-ld.test.ts` (no changes to JSON-LD logic; test count reflects full suite).

**Non-breaking:** Existing 1-row/day sites load with zero data loss. Field is optional. Max-row validation only blocks saves exceeding 21, doesn't regress earlier <7-row data.

**Related:** Phase 04 (JSON-LD, Phase 05 scoring) already released and compatible with split-shift; no changes needed there. QA doc `docs/qa/F37-local-seo.md` already updated to v2.5 by QC; no duplicate work.

---

### F37 — Local Business Info: State→District→Postcode Cascade + hasMap JSON-LD (US-F37-01 Data Quality Follow-up & US-F37-02 Enhancement)

**Data quality improvement: Sellers now enter standardized location data via DB-backed state/district/postcode cascade instead of freetext inputs. Enhanced JSON-LD now includes `hasMap` field for richer local search signals.**

**F37-01 Data Quality Deliverables:**

- **New cascade component:** `src/components/editor/local-business/geo-cascade-fields.tsx` — reusable State→District→Postcode cascade (forward cascade + reverse pre-fill resolution) using checkout's live `/api/geo/*` endpoints. Handles DB lookups (state/district names → ids), forward cascading (state change → reset district), and legacy pre-fill resolution (for edit mode on already-saved state/city/postcode strings).
- **Removed dead code:** Deleted `src/components/editor/local-business/state-select.tsx` (single-select State field, superseded by cascade).
- **SettingsPanel wiring:** `src/components/editor/SettingsPanel.tsx` updated to use new geo-cascade component; removed old city/postcode `<Input>` fields and postcode regex validation state.
- **i18n updates:** `src/i18n/locales/en.json`, `ms.json` — added `selectCity`, `selectPostcode`, `loadingOption`, `legacyValueHint` cascade labels; removed the now-orphaned `invalidPostcode` validation key (postcode is selected from a DB-backed list, no longer freetext-validated).
- **Tests:** `src/__tests__/unit/editor/geo-cascade-fields.test.tsx` — 8 unit tests covering forward cascade, reverse pre-fill, legacy degradation, and API error handling. All passing.

**F37-02 Enhancement Deliverables:**

- **Enhanced JSON-LD:** `src/lib/seo/json-ld.ts` added `hasMap` field (a Google Maps URL string, e.g. `https://www.google.com/maps?q={lat},{lng}`) to the LocalBusiness schema. Derived from the site's saved `latitude`/`longitude` as a fallback until GBP/Waze connect (US-F37-05/09); omitted entirely when coordinates are absent — improves local search signal richness for Google crawlers.

**Files modified:** `src/components/editor/SettingsPanel.tsx`, `src/lib/seo/json-ld.ts`, `src/i18n/locales/{en,ms}.json`. **Files created:** `src/components/editor/local-business/geo-cascade-fields.tsx`, `src/__tests__/unit/editor/geo-cascade-fields.test.tsx`. **Files deleted:** `src/components/editor/local-business/state-select.tsx`. **Tests:** 8 new unit tests (all passing); 0 regressions on existing test suite.

**Impact:** Local business location data now guaranteed to be valid and consistent with live geo database (no typos, postcodes tied to real districts). Reduces future data-quality issues and improves JSON-LD signal reliability for search engines. Sellers benefit from simplified, guided form UX instead of manual text entry.

**Post-Implementation Follow-up Fixes (2026-07-10):**

- **State-name mismatch:** `scripts/data/malaysia-geo.json` corrected 4 state names (KUL/LBN/PNG/PJY) to match `MY_STATES` enum, fixing seller address save failures in Kuala Lumpur/Penang/Labuan/Putrajaya on fresh-seed. Test: `src/__tests__/unit/scripts/malaysia-geo-seed-data.test.ts` (2 cases, both TC-F37-01-23).

- **Geo-cascade race condition:** `src/components/editor/local-business/geo-cascade-fields.tsx` added ref-based stale-response guard in state/district select handlers, preventing concurrent rapid selections from overwriting district list with outdated API response. Test: added to `src/__tests__/unit/editor/geo-cascade-fields.test.tsx` (now 9 total, TC-F37-01-24).

**Tests:** Full suite 9882 pass, 0 regressions. Fixes verified via `/code-review` adversarial pass + test fail-without-fix/pass-with-fix validation.

---

### GH-1502 — AI Bulk-Create UX Redesign (Phases 1–6 complete)

**Improved UX for AI-powered product bulk generation. New field tracks AI-generated drafts; enhanced textarea with auto-resize, suggestion pills, and visual indicators.**

**All 6 phases complete:**
- **New field:** `aiReviewPending` boolean on Products collection (`src/collections/Products.ts`, migration in `scripts/db-setup.js`, default false) — tracks whether a product was auto-created by AI chat and awaits merchant review.
- **Backend state management:** `BulkCreateModal`'s `buildSavePayload()` sets `aiReviewPending: true` on every AI-generated draft product. `saveProductAction()` clears flag to `false` on any manual edit; `updateProductFieldAction()` clears to `false` when product transitions to `'active'` status. Archived/soft-deleted products leave flag untouched.
- **Frontend — Enhanced textarea:** Replaced single-line `<Input>` prompt field with multi-line auto-growing `<textarea>` (new hook: `src/hooks/use-auto-resize-textarea.ts`). Plain Enter now submits; Shift+Enter inserts a newline. Improves UX for multi-sentence product descriptions.
- **Frontend — Suggestion pills:** Added 3 clickable suggestion pills below textarea — "Describe your product", "Add features", "Include materials" — each pre-fills with contextual prompt text. Speeds up first-time user onboarding.
- **Frontend — Visual indicator:** New component `src/components/dashboard/AiReviewIndicator.tsx` — emerald pulsing dot + tooltip ("Created by AI — needs review") — displays next to AI-bulk-created products in both desktop table rows and mobile cards in the Products list. Clears (optimistically + server-confirmed) when product status transitions to `'active'`.
- **UX flow:** After successful bulk-generate, page auto-switches to Draft tab and resets sort to "Latest" so newly created drafts appear on top (no full page reload).
- **i18n updates:** `src/i18n/locales/en.json`/`ms.json` — renamed AI-chat button label ("Create" → "Generate Drafts" / "Cipta" → "Jana Draf"), updated placeholder copy, added suggestion-pill strings and AI-review tooltip strings.
- **Tests:** 8 new test cases (TC-F08-04-34 through 41) in `bulk-create-utils.test.ts`, `save-product-action.test.ts`, and new `ai-review-indicator.test.tsx`; amended TC-F08-04-27 (assertion changed due to `router.refresh()` removal from modal's `handleSave`). All passing.
- **Code-review follow-ups:** SKU-conflict retry hardened with a DB-level unique-constraint fallback (`translateDbSkuConflict` in `actions.ts`); `description` field sanitized via `sanitizeXSS()` before Lexical conversion; case-insensitively duplicate variant names now deduped at parse time in `handleParse` (first occurrence kept) instead of hitting `products_variants_name_parent_uniq` and being misreported as a SKU conflict — fixed at parse time rather than by renaming in `buildSavePayload` after an adversarial re-review caught that a post-parse rename would desync the row from `buildVariantMatrix`'s exact-string tier-combo matching and silently reset its price/sku/stock on a later tier-matrix edit. See TC-F08-04-48 through 52.
- **Design-system alignment:** `ProductForm.tsx`'s save bar migrated to the sticky floating-card template (`--save-bar-bg` token, amber "unsaved changes" indicator, renders only while `methods.formState.isDirty`) matching the shared template already used by Payments/Shipping/Discounts/Customers-detail. Replaces the older always-visible fixed full-width bar to avoid two competing save-bar styles in the dashboard. Footer actions ("Discard" and "Approve All") in `BulkCreateModal` were also migrated from custom styled `<button>` tags to the standard `<Button>` component (`dashPrimary` and `dashSecondary` variants, `dash` size).
- **Frontend — Variant layout styling:** Improved layout in the preview table of `BulkCreateModal` by switching from the truncating `truncate` class to wrap-friendly layout classes (`min-w-[110px] whitespace-normal break-words self-start pt-1.5`) to handle multiple variant names seamlessly without UI clipping.
- **Frontend — Image uploader alt-text typography styling:** Updated the edit alt-text button's typography style in `src/components/dashboard/ImageUploader.tsx` to use `font-medium` to improve legibility and contrast of the alt-text preview/trigger.

**Related:** `docs/architecture/F08-products-crud.md` § GH-1502 (UX Redesign).

---

### GH-1458 — Soft validation publishing gate (Phases 1–4 complete)

**Publishing gate blocking incomplete products from Active status. Storefront alt-text fallback implemented. All 4 phases shipped.**

**Phase 1 + 2 wiring (complete):**
- **Publishing gate guard:** Products cannot transition Draft → Active if core fields missing: non-variant products require `price` + `sku` + `inventory` (all non-null, but 0 is valid); variant products require `sku` + non-empty `variants[]` matrix with all required variant fields. Guard implemented in pure function `productPublishBlocks()` (`src/lib/products/publish-guard.ts`), reused for both client + server checks.
- **Client-side enforcement:** `src/app/(dashboard)/products/page.tsx` `handleUpdateStatus()` evaluates guard before optimistic update; if blocked, opens `ConfirmModal` listing missing fields (mapped to i18n labels) instead of making server call. No visual flickering or rollback needed.
- **Server-side enforcement:** `src/app/(dashboard)/products/actions.ts` `updateProductFieldAction()` re-validates guard against fetched product when `status: 'active'` requested. Throws structured `PUBLISH_BLOCKED` error with `missingFields[]` array (field keys only, not internals). Source of truth; client gate cannot be bypassed via direct API calls.
- **Modal UX:** ConfirmModal variant='default' with warning icon, title "Cannot publish yet", intro line, bulleted missing field names (localized via existing `t.dashboard.products.form.*` keys). Single acknowledge button (no false "proceed anyway" option). Mirror pattern from `CategoryManager` warning-box styling.
- **i18n keys added:** `publishGateTitle` (modal title), `publishGateAck` (intro text), `price`/`sku`/`inventory`/`variants` field labels in dashboard dictionary (en/ms, mirroring PW1 field label conventions). Fallback labels prevent regression if new i18n key missing.
- **Tests (Phase 1 + 2):** 5 concrete test cases in `src/__tests__/unit/actions/save-product-action.test.ts` (TC-09.37 coverage per docs/qa/F09-products-crud.md). Scenarios: incomplete non-variant (missing price) blocked, incomplete non-variant (missing sku) blocked, incomplete variant (missing variant matrix) blocked, complete product allowed to toggle, server-side double-check enforces gate on direct API bypass. All passing.
- **Non-breaking:** Draft save with missing fields still succeeds (gate only affects Active transition). Archive/restore unaffected. Existing complete products toggle normally.

**Phase 3 wiring (complete; alt-text fallback on storefront):**
- **Alt-text fallback:** Storefront product images now always have non-empty `<img alt>` text via fallback pattern `"{Product Name}"`. Satisfies WCAG requirement that images must have descriptive alt text. Fallback generated when product lacks explicit alt-text metadata.
- **Server-side persistence:** `src/app/(dashboard)/products/actions.ts` `saveProductAction()` now persists blank image alt text from `product.name` only for dashboard/manual saves (no tenant `Sites.name` lookup on that path). `buildProductAlt()` utility (`src/lib/products/build-product-alt.ts`) still keeps the render-time fallback chain `product.name` → `site.name` → `"Product image"` for storefront safety.
- **Render-time usage:** All storefront render paths apply `buildProductAlt()` fallback at display time: `src/components/storefront/ProductImageGallery.tsx`, `src/blocks/products-grid/index.tsx`, `src/blocks/products-featured/index.tsx`, `src/blocks/product-quick-view/index.tsx`. Instances without explicit alt preserve computed fallback via utility; no merchant action required.
- **Non-breaking:** Existing products with explicit alt-text unchanged. Fallback only applies when alt is missing/empty. Draft/Archive transitions unaffected.

**Phase 4 wiring (complete; inline advisory hints + alt-text Popover):**
- **Inline advisory hints:** Product form now displays a non-blocking advisory message under Images when alt-text is missing, and under Category (see note below — Category itself stays hard-required). Matches the soft-validation philosophy (warn, don't block) for Alt text specifically.
  - **Image uploader alt-text UX enhancement:** `src/components/dashboard/ImageUploader.tsx` replaced cramped inline alt-text input with Radix Popover (trigger: "+ Add Alt text" button or truncated text + pencil icon). Popover contains auto-growing Textarea (125-char hard cap, red counter at limit), helper text, and Cancel/Save buttons (draft-until-Save UX). Tests: TC-F08-01-33..37 (all passing).
- **Category field — required, corrected 2026-07-03:** `src/components/dashboard/product-form/schema.ts` `categoryIds.min(1)` was briefly relaxed to advisory-only during Phase 4 to match the alt-text pattern (and the issue's literal acceptance-criteria wording), but the product owner confirmed Category must stay **hard-required** at Save — the relaxation was reverted the same day. Category keeps its advisory hint (still fires before submit) alongside the restored required-asterisk and Zod block. Only Alt text is truly optional at Save.
- **Save-as-draft regression tests:** Verified products with empty alt-text can be saved to Draft without throwing errors (Category still blocks Save when empty, by design).
- **Bulk-create draft verification:** AI bulk-create (via `buildSavePayload()`) always produces `status: 'draft'` regardless of category/image completeness, preventing accidentally creating Active products via template generation.
- **Tests (Phase 4):** Regression tests TC-09.39 (Save-Draft succeeds with missing alt only), TC-09.40 (Bulk-create always starts Draft) in `docs/qa/F09-products-crud.md`. `TC-F08-01-01e` (category-required) reverted to its original assertion. All passing.

**Post-Phase 4 addendum — `weight` added to the publishing gate (2026-07-03):** `productPublishBlocks()` now also requires `weight` before Draft → Active, in BOTH variant and non-variant modes (it's a single top-level shipping-calc field, not part of the variant matrix). Unlike `price`/`inventory`, `weight:0` (the collection's own default) is treated as **missing**, not valid — a product's physical weight can never legitimately be 0. Wired into `src/lib/products/publish-guard.ts`, `src/app/(dashboard)/products/actions.ts` (`updateProductFieldAction`), and the `PUBLISH_GATE_FIELD_KEYS` label map in `src/app/(dashboard)/products/page.tsx`. New i18n key `dashboard.products.form.fields.weight` (en/ms). Tests updated in `publish-guard.test.ts` and `save-product-action.test.ts`; TC-09.37 text updated in `docs/qa/F09-products-crud.md`.

**Post-Phase 4 addendum — `ConfirmModal` `hideCancel` prop (2026-07-03):** Phase 2's publish-gate modal originally set both `confirmLabel` and `cancelLabel` to the same "Got it" text (workaround — the shared `ConfirmModal`, used in 8+ dashboard call sites, required both props with no way to hide Cancel), flagged as non-blocking cosmetic debt in the Phase 2 code review. Implemented that review's suggested fix: `src/components/ui/confirm-modal.tsx` now takes an optional `hideCancel?: boolean` prop (and `cancelLabel` is now optional) — when true, renders only the confirm button. Publish-gate modal in `page.tsx` now passes `hideCancel` instead of duplicating `cancelLabel`. Fully backward-compatible; the other 7 call sites are unaffected (`hideCancel` defaults to `false`). New tests TC-GH1290-CM-07 in `confirm-modal.test.tsx`.

**Related phases:** Phase 1 (guard library, unit tests) shipped 2026-07-02. Phase 2 (client + server wiring) shipped 2026-07-03. Phase 3 (alt-text fallback) shipped 2026-07-03. Phase 4 (inline warnings + alt-text Popover) shipped 2026-07-03; category-required reverted same day. Weight requirement added 2026-07-03. `ConfirmModal.hideCancel` added 2026-07-03.

**Impact:** Merchants can no longer activate incomplete products (missing price/sku/inventory/weight). Storefront product images always have descriptive alt text (accessibility + SEO). Invalid products remain Draft until core requirements met. Alt-text is advisory only (reduces friction); Category remains a hard requirement at Save per product-owner decision. Reduces merchant support burden and ensures storefront accessibility compliance.

---

### `generate-site` weight/dimensions/alt parity (2026-07-03)

**Follow-up to GH-1458** — tracked in its own plan (`plans/260703-1341-GH-1458-generate-site-weight-alt-parity/`), not a GH-1458 addendum, since it fixes a different code path. `src/app/api/ai/generate-site/route.ts` (the "generate whole website" AI onboarding flow) creates Product docs directly via `payload.create()`, bypassing `saveProductAction`/`updateProductFieldAction` entirely — so the publish-guard's `weight` requirement and the alt-text save-time persistence never applied there. Products came out `status:'active'` with `weight=0/undefined` (blocked on re-toggle later) and blank `images[].alt` (merchant edit form showed empty Alt text, though storefront was already fine via render-time fallback). Alt-text fixed by persisting a `buildProductAlt()` fallback into `images[].alt` at both image-setting call sites — reusing `result.siteName` already in scope, no extra DB query needed.

**Phase 1 (weight/dimensions, initial):** shipped flat `weight:1` + `dimensions:{0,0,0}` constants for every product, believing this mirrored `BulkCreateModal.buildSavePayload()`'s `prod.weight || 1`.

**Phase 2 (weight/dimensions, corrected same day):** that belief was wrong — `BulkCreateModal`'s `|| 1`/`|| 0` is a defensive fallback around a REAL per-product AI estimate from `/api/ai/products-bulk-parse`'s prompt ("Estimated logical shipping weight in kg. Minimum 0.1", estimated per product based on category — e.g. a sofa vs. earrings). `generate-sample-products.ts` (used by `generate-site`) never asked its AI tier (`generateSampleProductsAI`, GPT-4.1-nano) for weight/dimensions at all. Corrected by extending that prompt to estimate `weight`/`length`/`width`/`height` per product, same as `products-bulk-parse`; `SampleProduct` interface gained matching optional fields. `generate-site/route.ts`'s `baseData` now reads `product.weight || 1` / dimensions `|| 0` (code review caught `?? 1` letting an AI-hallucinated `weight:0` through unguarded — `||` closes that) — the constants apply when the AI omits a value or returns 0, not as the primary source. Tier-2 curated fallback library (non-AI, rare path) still has no dimension data and correctly falls through to the constants — accepted as out of scope (would require manually curating the entire static library for a rarely-hit path). Tests: TC-09.41 (AI-omission fallback), TC-09.42 (alt persistence), TC-09.43 (AI-value passthrough), TC-09.44 (weight:0 hallucination guard) in `src/__tests__/api/ai.test.ts`; 3 new tests in `src/__tests__/unit/lib/ai/sample-products-image-fallback.test.ts` (required refactoring that file's `openai` mock from `mockImplementation`-returning-an-object to prototype-based, since `vi.clearAllMocks()` was wiping the former's return value across tests — see journal for details).

---

### Full-branch adversarial code review (2026-07-03)

3-stage review (`/code-review`, ultrathink) of all uncommitted GH-1458 work before commit — spec compliance (pass), 2 parallel code-quality passes, 1 adversarial red-team pass on the API-surface changes. Findings and fixes:

- **Critical — `saveProductAction` never enforced the publishing gate.** `updateProductFieldAction` (the list-view Toggle Active button) called `productPublishBlocks()`; `saveProductAction` (the create/edit form's Server Action) never did. Since `ProductServerSchema` is `.passthrough()` and the React form never sends `status` on edits, a *direct* call to `saveProductAction` (bypassing the form UI) could set `status:'active'` with missing sku/inventory/weight — Payload's own collection validation doesn't enforce those. Fixed: `saveProductAction` now gates whenever `data.status === 'active'`, checked against the merged existing-doc + incoming-fields view. Tests: TC-09.45 in `save-product-action.test.ts` (4 cases: create-incomplete-active blocked, edit-incomplete-active blocked, edit-complete-active proceeds, create-complete-active proceeds).
- **High — unbounded AI-supplied weight/dimensions.** `generate-sample-products.ts`'s `toOptionalNumber` only rejected non-numeric AI output, not out-of-range values (negative, absurdly large) — unlike the form-side Zod schema (weight max 1000, dims max 10000). Renamed to `toBoundedNumber(v, min, max)`, applying the exact same bounds as `schema.ts`; out-of-range values now collapse to `undefined` (→ the `|| 1`/`|| 0` fallback) instead of persisting on a live `status:'active'` product. Test: TC-GH1458-P2-03. Also tightened the parser from lenient `parseFloat(String(v))` to strict `typeof v === 'number'` (was silently accepting `"5kg"` → `5` or `[5,10]` → `5`).
- **Medium — derived alt text could exceed its own cap.** `ProductServerSchema`'s new `images[].alt` `.max(500)` cap only applies to the *submitted* alt; `buildProductAlt()` computes a fallback (`"{name}"`) AFTER Zod validation, unbounded by it. A long `name` (previously uncapped server-side) could produce a >500-char derived alt. Fixed: added `.max(120)` to `name` in `ProductServerSchema` (matches the form's client-side cap) and `.slice(0, 500)` on the derived alt as a second line of defense.
- **Medium — orphaned `categoryHint` i18n key.** Left behind in en.json/ms.json after the advisory hint's JSX was removed per earlier user request ("bỏ cái warning đi"); plan.md still claimed it was wired. Both cleaned up.
- **Low (fixed):** documented (code comment) the pre-existing TOCTOU race between the gate's read and either action's write — same accepted-risk class as the pre-existing variant-loss race already documented in `actions.ts`.
- **Deferred (not fixed, tracked as tech debt):** `ConfirmModal.cancelLabel` optional weakens compile-time safety for future call sites lacking `hideCancel:true` (all 8 current sites verified unaffected); extra unconditional `sites.find` query on every `saveProductAction` call; `saveProductAction`'s "one site per tenant" store-name lookup could pick the wrong site's name for multi-site tenants (pre-existing pattern elsewhere in the dashboard, propagated here — not introduced fresh by this branch).

**Fix-cycle re-review (same day):** all 3 fixes above (Critical/High/Medium) independently re-verified line-by-line — VERIFIED FIXED, no regressions, ordering/merge/comparison logic all correct. 2 new Low-severity notes from the re-review (both informational, not fixed): (1) the gate is now duplicated across `saveProductAction`/`updateProductFieldAction` rather than centralized in a `products` collection `beforeChange` hook — a future write path (bulk import, new server action) could silently bypass it unless wired in manually; (2) if `findByID` fails transient during an edit-to-active save, the gate fails CLOSED (false-positive `PUBLISH_BLOCKED` on an already-complete product), never fails open — a UX/availability edge case, not a security issue.

---

### PR #1500 code review — collection-level gate enforcement (2026-07-03)

External `/code-review` on PR #1500 escalated the "gate duplicated across 2 Server Actions" item above from deferred tech debt to a live, trivially exploitable bypass — confirmed via manual trace + adversarial subagent, not hypothetical:

- **Critical — `saveProductAction`'s gate only fired on payloads explicitly setting `status:'active'`.** Editing an already-`active` product without touching `status` (exactly what the edit form does on every save) skipped the gate entirely; `sku`/`inventory`/`weight` have no `required` flag at the Payload field level, so `''`/`null`/`0` were silently accepted, deterministically leaving a live active product with missing core fields.
- **Critical — no collection-level enforcement at all.** Both Server Action gates were the *only* enforcement; Payload's default REST/GraphQL API (not disabled on this collection) bypassed both outright — any authenticated tenant user with product-management access could `PATCH /api/products/:id` directly.
- **Fix (both, same root cause):** new `publishGateHook` (`beforeChange`) on the `products` collection (`src/collections/Products.ts`) — single source of truth enforced on every write path (both Server Actions, REST, GraphQL, Local API, future bulk import), keyed on the RESULTING status (`data.status` if present, else `originalDoc.status`) rather than only the incoming payload. Fires when status resolves to `active` AND (status is being explicitly set active, OR a scalar gate field — price/sku/inventory/weight/hasVariants — is present in the write, OR `variants` CONTENT differs from the original doc). Existing two Server Action checks kept as-is (fast, structured client errors); the hook is the new authoritative backstop. Tests: TC-09.47 (`products-hooks.test.ts`, 9 cases).
- **Medium — alt-text length caps enforced inconsistently.** `ImageUploader`'s 125-char cap was DOM-`maxLength`-only — a pre-existing over-cap alt saved without editing persisted uncut. `generate-site`'s persisted alt fallback had no cap at all, unlike `saveProductAction`'s 500-char cap it claimed to mirror. Fixed: clamp on `saveAlt()` (`ImageUploader.tsx`) and `.slice(0, 500)` on `generate-site`'s `fallbackAlt` (`route.ts`). Tests: TC-F08-01-38, TC-09.49.
- **Medium — `productPublishBlocks`'s weight check relied on JS coercion.** `!value || value <= 0` treats a non-numeric string (e.g. `"abc"`, reachable via `saveProductAction`'s `.passthrough()` schema) as valid. Fixed with an explicit `typeof`/`Number.isFinite` check. Test: TC-09.46.
- **Low — `id === 0` falsy-zero bug.** `saveProductAction`'s `id ? ... : undefined` treated a legitimate `id:0` as absent, routing to create instead of update. Not currently reachable (Payload serial PKs start at 1) but fixed for correctness. Test: TC-09.50.

**Impact:** the publishing gate is now enforced at the correct architectural layer — no write path (present or future) can set/leave a product `active` with missing core fields, closing the exact class of bug this feature already fixed once, permanently this time.

**Self-review + adversarial round 2 (same day):** re-ran `/code-review` on this fix itself before commit. Self-review caught one Critical regression the fix's own first draft introduced; a follow-up adversarial subagent pass caught 3 more (all fixed same session):

- **Critical (self-caught) — excluding `variants` from the trigger set reopened the exact bypass class being closed.** First draft excluded `variants`/`variantConfigs` entirely from `PUBLISH_GATE_TRIGGER_FIELDS` to avoid `updateProductFieldAction`'s always-re-passed-variants workaround from falsely blocking soft-deletes. But a direct call with only `{variants: [bad data]}` (no status/hasVariants key) then skipped the gate outright. Fixed by comparing `variants` CONTENT (id-normalized via new `normalizeVariantsForCompare()`, mirroring `actions.ts`'s `stripIds()`) against `originalDoc` instead of checking key presence — catches genuine variant edits while still not re-firing on the no-op re-pass.
- **Medium — `isBlank()` could throw on non-string truthy input.** `sku: {}` or `sku: []` from a raw REST/GraphQL call reached `value.trim()` without a type guard, throwing an unhandled `TypeError` instead of a clean `PUBLISH_BLOCKED`. Fixed: `isBlank()` now type-guards (`typeof value !== 'string'`).
- **Medium — `price`/`inventory` retained the type-unsafe `== null` pattern that `weight` was already fixed for.** A non-numeric `price`/`inventory` (e.g. `"abc"`) would pass the `== null` check as "present." Unified all three (plus variant `price`/`stock`) behind one `isValidNumber()` type-guard helper.
- **Medium — `normalizeVariantsForCompare` diverged from `stripIds()` on non-array input.** `stripIds(null)` returns `[]`; the new compare function passed non-array values through unchanged, so a legacy row storing `variants: null` would spuriously compare as "changed" against `updateProductFieldAction`'s re-passed `[]`, re-firing the gate on an untouched soft-delete. Fixed to coerce non-array to `[]`, matching `stripIds()`.
- **Low — stale comment.** `generate-site/route.ts`'s comment still claimed this route "bypasses the guard," no longer true now that the collection-level hook covers it. Updated for accuracy.
- **Deferred (not fixed, Low, safe-direction):** if Payload applies field `defaultValue`s AFTER `beforeChange` hooks run (unconfirmed — Payload docs are ambiguous on ordering, `node_modules` inspection blocked by this repo's sandbox policy), a raw API create with `status:'active'` omitting `inventory` (relying on its `defaultValue:0`) would be incorrectly blocked rather than defaulting to 0. Fail-closed (over-blocks), not a bypass; narrow edge case only reachable via a direct API call bypassing both Server Actions (which always send `inventory` explicitly).

Tests: TC-09.51 (`publish-guard.test.ts` + `products-hooks.test.ts`). Full suite after all fixes: 9321/9324 pass (3 pre-existing DB-connectivity failures, no local Postgres in this sandbox — unrelated). Typecheck clean.

**Independent review round 3 (2026-07-06) — posted as a PR comment, not by the branch author:**

- **Medium — `publishGateHook`'s key-presence trigger re-fired on every Payload `/admin` panel save of a legacy-incomplete active product, even for unrelated field edits.** Payload's own `/admin` (`src/app/(payload)/admin`) submits the FULL document on every save, unlike the two Server Actions' partial payloads — `price`/`sku`/`inventory`/`weight`/`hasVariants` are always present in that payload regardless of what a human actually edited. Fixed: trigger fields now compare by VALUE CHANGED against `originalDoc`, not by key presence, unifying the scalar-field logic with the content-comparison already used for `variants`. Also redefined `statusBeingSetActive` as a real transition (`original?.status !== 'active'`), not just "the payload happens to include `status:'active'`." Tests: TC-09.52.
- **Low — thumbnail `<img alt>` in `ProductImageGallery.tsx` appended a numeric index to the FULL `buildProductAlt()` result, corrupting real merchant-authored alt text** (e.g. "Front view" → "Front view 2") and duplicating the parent `<button>`'s existing `aria-label="View image N"`. Fixed: thumbnail alt now matches the main image's plain `buildProductAlt()` output, no index suffix. Test: TC-F09-1451-07.
- **Medium (flagged, resolved same day with product-owner input) — `weight` field unit was ambiguous.** Collection's `admin.description` said "in grams"; the form label, AI prompts (`generate-sample-products.ts`), and seed data all treat it as kg. No current consumer reads the field (F14 shipping calc not wired up yet), so no data migration was needed. **Decision: canonical unit is kg** — `admin.description` corrected in `src/collections/Products.ts` to match every actual reader of this field.
- **Low (deferred, non-blocking, per reviewer's own framing):** alt-fallback persisted at save time goes stale if the product/store is renamed later, and a merchant can never clear alt back to empty (inherent tradeoff of the persist-on-save design, not a bug); `updateProductFieldAction`'s gate check reads only `existing` without merging incoming fields (latent — none of the 3 current call sites send both `status` and other fields together, so not reachable); AI-estimated weight below 0.01 (rings, stickers) falls back to the 1kg constant (demo-data quality only); `ms.json`'s "Edit teks Alt" should be "Sunting teks Alt" (untranslated word, cosmetic).

Confirmed with the team: Payload `/admin` IS used to edit products directly, so the value-changed trigger fix above is not just a theoretical edge case.

**Verification of round-3 fix (2026-07-06) — independent code-quality + adversarial subagent pass on this exact diff:** the value-changed refactor was traced against all 3 previously-fixed bypasses (partial-payload field clearing, direct REST/GraphQL draft→active, create with missing fields) — all still closed with certainty, confirmed via full manual trace matching `TC-09.47`. 0 Critical/High/Medium bypass found. One real Medium doc-consistency issue found OUTSIDE this diff and fixed: `docs/design/F36-easyparcel-delivery-design.md` and `docs/prd/F14-shipping.md` (not-yet-implemented shipping specs) still assumed `Products.weight`/`parcelWeight` were stored in grams — left uncorrected, a future F14/F36 implementation would divide an already-kg value by 1000 again, producing exactly the 1000×-under bug those docs' own comments warn against. Corrected both docs' unit references to kg with a dated callout.

Open design question (not a bug, flagged by the adversarial pass): the gate now re-validates ALL scalar fields whenever ANY gate-relevant field changes — so fixing e.g. a wrong `price` on a legacy-incomplete active product (grandfathered `weight:0`) will also require fixing `weight` in the same save, since `productPublishBlocks()` checks the whole set once triggered. This is arguably correct (an active product should never be re-saved into a still-incomplete state), but is a UX friction point worth confirming with the product owner if it causes support tickets after deploy.

Tests: TC-09.52 (`products-hooks.test.ts`), TC-F09-1451-07 (`product-dp.test.tsx`). Full suite: 9324/9327 pass (same 3 pre-existing DB-connectivity failures). Typecheck clean.

Tests: TC-09.52 (`products-hooks.test.ts`), TC-F09-1451-07 (`product-dp.test.tsx`). Full suite: 9324/9327 pass (same 3 pre-existing DB-connectivity failures). Typecheck clean.

---

### F34 — Subscription Enforcement Error Message i18n

**Malay localization for subscription block errors in editor and dashboard:**

- **i18n resolver utility:** `src/lib/ui/resolve-api-error.ts` new helper maps server error codes (`FEATURE_LOCKED`, `SUBSCRIPTION_EXPIRED`) and error string patterns to localized messages. Supports Pattern A (error object with `code` + `message` fields) and Pattern B (plain English error string) from server actions. Falls back to caller's provided fallback for non-subscription errors. Keyed messages stored under `common.subscriptionErrors` (en/ms parity).
- **13 handlers audited and wired:** Editor handlers (PageManagerPanel create/visibility/delete/restore, page save, site settings save, page settings) and dashboard handlers (blog list actions, blog editor save, product status/restore/delete, domain add, payment/email-template settings save) now route subscription errors through resolver. Preserves non-subscription fallback behavior.
- **Tests:** `src/__tests__/unit/lib/resolve-api-error.test.ts` validates resolver logic for both error patterns, locale mapping, fallback passthrough, null safety.
- **Server untouched:** API routes + server actions still emit English responses (contract/logging stability preserved).

**Impact:** Malay users now see localized subscription enforcement messages instead of hardcoded English throughout editor and dashboard.

---

### F34 — Phase 06 Code Review Fixes (Phase 1–2)

**Feature code corrections + Pattern A enforcement test coverage:**

- **fix(seo): correct feature guards on SEO routes** — `src/app/api/seo/apply-fixes/route.ts` and `src/app/api/seo/fix/route.ts` now use `withFeatureGuard('content_management')` (was incorrectly `sitemap_robot_configuration`). Root cause: `sitemap_robot_configuration` guards only the GET sitemap endpoint (read); SEO meta fixes are content edits (write), scoped to `content_management`. `auto-meta-toggle` remains correctly guarded by `sitemap_robot_configuration` (toggle affects sitemap inclusion). Tests: 4 new TC-IDs (TC-SUB-060..063) validate Pattern A guard dispatch: 401 (no auth), 403 (no subscription), 403 (feature disabled), 200 (allowed). See `src/__tests__/api/feature-guard-enforcement.test.ts`.

- **fix(ai): falsy-0 safety on tenantId check** — `src/app/api/ai/apply-template/route.ts` line ~45 changed `if (tenantId)` → `if (tenantId != null)` to prevent bypass when tenant ID is numeric 0 (edge case but security-sensitive). Defensive guard against type coercion.

**Tests:** New test file `src/__tests__/api/feature-guard-enforcement.test.ts` exercises the real `withFeatureGuard` HOF with mocked internal dependencies. 4 tests (TC-SUB-060..063) covering: no auth (401), no subscription (403), feature disabled (403), allowed (200). All pass.

**Impact:** SEO meta fixes now correctly gated by `content_management` plan feature, not sitemap configuration. Pattern A HOF enforcement validated with comprehensive test coverage.

---

### F34 — Phase 06 Code Review Fixes (Phase 3–5)

**Subscription enforcement guard alignment + SSO validation + staff limit syncing:**

- **fix(subscriptions): align guard tenant resolution to tenants[0]** — `src/lib/subscriptions/feature-guard.ts` now consistently uses `tenants[0]` for subscription lookup (was using `find(owner)` in one code path), eliminating auth-context mismatch that could cause false 403 errors when user is not primary owner. Defensive guard ensures all paths use same tenant selection strategy.

- **fix(sso): add VALID_BASE_CODES validation on provision** — `src/app/api/v1/sso/provision/route.ts` now validates subscription code against known base codes before passing to `getPlanCode()`. Unknown codes return 400 `INVALID_SUBSCRIPTION_CODE` instead of silently fabricating invalid plan states. Prevents SSO onboarding chaos when external systems send malformed pack codes.

- **fix(subscriptions): getPlanCode throws on unknown base code** — `src/lib/subscriptions/plan-subscription.ts` `getPlanCode()` now throws `SubscriptionError` on unknown base code instead of returning fabricated enum values. Requires caller to validate codes pre-call, ensuring fail-fast behavior.

- **fix(subscriptions): sync staff_limit usage on role change** — `src/collections/Users.ts` `update-staff` server action now calls `recountStaffUsage()` when user toggles between owner ↔ non-owner role. Fixes usage counter drift: adding staff when non-owner doesn't increment limit, but later promotion to owner should. Recount resyncs count to match actual non-owner staff count per tenant.

- **test(sso): add rejection test for invalid pack_code** — `src/__tests__/unit/auth/sso-provision.test.ts` now validates SSO endpoint returns 400 when pack_code is unknown (complementary to PR guards). TC-ID reserved.

**Impact:** Subscription enforcement guards are now tenant-context consistent. SSO onboarding rejects malformed codes upfront. Staff limit tracking stays synchronized across role changes. No breaking changes; existing valid flows unaffected.

---

### F34 — Plan Subscription Management Phase 06: Subscription Enforcement Layer

**Features:**
- **Subscription enforcement HOF:** `src/lib/subscriptions/feature-guard.ts` exports `withFeatureGuard(featureCode)` — higher-order function wrapping route handlers with plan subscription + feature checks. Returns 401 if unauthenticated, 403 if subscription expired or feature disabled/locked.
- **Numeric limit enforcement:** `src/lib/subscriptions/plan-subscription.ts` new function `canUseWithinLimit(payload, subscriptionId, planCode, featureCode)` — compares consumed usage count against numeric plan limit; returns true if usage < limit, true always for YES/UNLIMITED features, false if limit exceeded or feature missing.
- **23 protected API routes (per feature code):**
  - **website_builder:** POST/PATCH sites pages (page save + publish)
  - **content_management:** POST blogs, POST/GET blog-categories
  - **email_template_configuration:** POST/GET email templates, GET email-preview endpoint
  - **payment_integration:** POST Stripe Connect onboard
  - **order_management:** PATCH/cancel/refund orders, inline email-confirmation send
  - **sitemap_robot_configuration:** GET SEO sitemap endpoint
  - **shipping_fee_configuration:** PATCH sites shipping-config
  - **account_profile:** PATCH users me endpoint
  - **allowing_buyer_making_order:** POST orders checkout (storefront)
  - **allowing_buyer_tracking_order:** GET orders track (storefront)
  - **template_limit:** POST AI apply-template (storefront)
  - **domain_connection:** Server action addCustomDomain
- **Collection access guards (async `create` access in collection configs):**
  - `Products.ts` — `create` access guarded by `product_management` feature
  - `Categories.ts` — `create` access guarded by `product_management` feature
  - `Users.ts` — invite/remove staff members call `canUseWithinLimit(payload, sub.id, sub.plan, 'staff_limit')` before `recordUsage()` / `reduceUsage()`
- **Usage lifecycle:**
  - `recordUsage(payload, subscriptionId, featureCode, amount?)` — increments usage counter on feature use (staff invite, product create, etc.)
  - `reduceUsage(payload, subscriptionId, featureCode, amount?)` — decrements usage counter on feature undo (staff remove, product delete, etc.)
  - `clearUsage(payload, subscriptionId)` — resets all usage counters when plan changes
  - `recountStaffUsage(payload, subscriptionId, tenantId)` — resyncs staff_limit count post-upgrade/downgrade (non-owner members only)

**Architecture:**
- Feature codes defined as TypeScript enum in `src/collections/PlanFeatures.ts` (PlanFeatureCode type)
- Plan codes defined as enum in `src/collections/PlanSubscriptions.ts` (PlanCode type: FREEMIUM, STARTER_TM_USER, STARTER_NON_TM_USER, STANDARD_TM_USER, STANDARD_NON_TM_USER, PROFESSIONAL_TM_USER, PROFESSIONAL_NON_TM_USER)
- Limit matrix stored in `plan-features` collection: (planCode, featureCode) → value (YES|UNLIMITED|numeric)
- Usage tracking in `plan-subscription-usages` collection: (subscriptionId, featureCode) → used count
- Single active plan per tenant stored in `plan-subscriptions` collection (name='main'), auto-activated via Webhook from SSO
- Pure helpers (`canUse`, `getFeatureValue`, `isSubscriptionActive`) pre-compute before route guard dispatch; no N+1 queries

**Code changes:**
- New: `src/lib/subscriptions/feature-guard.ts` (HOF wrapper, 62 LOC)
- New: `canUseWithinLimit()` added to `src/lib/subscriptions/plan-subscription.ts` (14 LOC)
- Modified: 23 route handlers across `src/app/api/**` and server actions to wrap with `withFeatureGuard()` HOF
- Modified: `Users.ts`, `Products.ts`, `Categories.ts` collection configs to guard `create` access and call usage helpers

**Mirrors PW1 SubscriptionAbility + SubscriptionUsageManager:**
- `getPlanCode(code, type)` — SSO code → PlanCode enum
- `getActivePlanSubscription(payload, tenantId)` — active 'main' subscription lookup
- `canUse(payload, planCode, featureCode)` — binary feature enablement check
- `canUseWithinLimit(payload, subscriptionId, planCode, featureCode)` — numeric limit check
- `recordUsage / reduceUsage / getConsumed` — usage lifecycle management
- `getFeatureValue / getFeatureSettings` — feature matrix lookups

**Guard order (defensive):**
1. User authentication check (401)
2. Active subscription lookup (403)
3. Feature enablement check (403)
4. Numeric limit check (per-action, returns false if limit exceeded)

**Non-breaking:** Feature guards are applied transparently; existing no-plan (null subscription) behavior gates all routes to 403 with standardized error codes.

**Related:** F34 Phase 05 (usage tracking), Phase 07 (admin UI enforcement + soft-delete grace period). See `docs/architecture/F34-plan-subscription-management.md`.

---

### F33 — Discount CMS Dashboard UI (Phase 2: Form + Usage History + Stripe Bugfix)

**Dashboard discount create/edit form + cross-tenant usage history page + stripe-checkout free-order bugfix.**

**Code changes (Phase 2 UI + API integration):**
- New: `src/app/(dashboard)/discounts/new/page.tsx` (RSC create discount page, server-side redirect)
- New: `src/app/(dashboard)/discounts/[id]/page.tsx` (RSC edit discount page, server-side fetch + error handling)
- New: `src/app/(dashboard)/discounts/usage-history/page.tsx` (S4 global usage history page, date range filtering)
- New: `src/app/api/v1/discounts/usage-history/route.ts` (GET cross-discount usage history, tenant-scoped, paginated, sortable)
- New: `src/app/(dashboard)/discounts/_components/discount-form.tsx` (client form component, edit/create branch logic)
- New: `src/app/(dashboard)/discounts/_components/discount-form-fields.tsx` (code, type, value, dates, limits fields with validation)
- New: `src/app/(dashboard)/discounts/_components/discount-form-header.tsx` (header with back button + page title)
- New: `src/app/(dashboard)/discounts/_components/discount-delete-dialog.tsx` (async delete with success toast)
- New: `src/app/(dashboard)/discounts/_components/discounts-usage-history-layout.tsx` (client layout with date pickers, table, pagination)

**Bug fix:**
- **fix(orders): stripe-checkout free-order detection** — `src/app/api/orders/stripe-checkout/route.ts` removed premature `Math.max(0, subtotal - discountRM)` clamping that broke the `total <= 0` check (TC-F13.103). Now correctly detects free orders when discount eliminates cost, enabling COD zero-charge checkout without Stripe session.

**Integration:**
- Discount form wired to `PATCH /api/v1/discounts/{id}` (update) + `POST /api/v1/discounts` (create)
- Usage history endpoint scoped to tenant, supports date-range filtering (startsAt/endsAt), pagination (limit/offset), sorting (by usage/date)
- Form validation matches backend: code 3–50 chars alphanumeric+hyphen, type enum, value bounds, date logic (startsAt < expiresAt)
- Delete action calls `DELETE /api/v1/discounts/{id}` (soft-delete via beforeDelete hook)

**UX:**
- Create: empty form, POST to `/api/v1/discounts`, redirect to edit page on success
- Edit: pre-fill form from `PATCH`, show current usage count + limit meter, delete button with confirmation dialog
- Usage history: sortable table (order ID, code, discount amount, order total, customer, date), date range filters, per-page limit (25/50/100)

**Non-breaking:**
- Phase 1 discount list page behavior unchanged
- Existing orders unaffected; new usage history rows only on fresh orders
- Stripe checkout correctly handles free-cost orders with or without discount code

**Related:** `docs/qa/F33-discounts.md` (usage history TCs), `docs/prd/F33-discounts.md` (phase 2 spec)

### GH-1099 — Remove Dead `oversellReview` Flag (US-F13-06 Rework)

**Decision:** Decrement-upfront architecture makes oversell-after-capture impossible; `oversellReview` flag is dead code.

**Root cause:** F13 Wave 6.5 (GH-1099) changed payment flow to decrement stock UPFRONT at checkout (Stripe session creation for card/FPX, COD/bank_transfer order creation) using atomic CAS `WHERE stock >= qty RETURNING id`. This eliminates the race window where an order could be charged but inventory unavailable (oversell-after-capture). The `oversellReview` flag was designed to detect this scenario post-capture as fallback; with prevention upstream, the flag is never set.

**Implementation:**
- **Removed from Orders collection:** Field `oversellReview` deleted from `src/collections/Orders.ts` (no Payload form exposure, no REST CRUD).
- **Removed from refund route:** `src/app/api/orders/[id]/refund/route.ts` — condition `order.oversellReview ? showBanner : hideBanner` removed; refund remains available via standard POST flow for legitimate use cases (customer requests, returns).
- **Removed from UI:** `src/components/dashboard/OrderDetailPanel.tsx` — oversell warning banner and "Manual Refund Required" indicator removed.
- **Database idempotent:** Column `oversell_review` KEPT in DB per NEVER-DROP policy; migration `orders.oversell_review` in `scripts/db-setup.js` unchanged (field optional, default false, forever stale); no data cleanup.
- **Tests simplified:** TC-F13.146 (UI banner test) removed; TC-F13.145 (oversell-after-capture TC) marked OBSOLETE with decision reference.

**Rationale:** Decrement-upfront + atomic CAS achieves prevention where fallback detection would have been needed. Architecture more robust; less code to maintain.

**Non-breaking:** Refund API unchanged; existing refund workflows unaffected. Dead field removal has no impact on shipping, payment reconciliation, or order status flow.

**Related:** GH-1099 decrement-upfront decision log; see `docs/qa/F13-payment-gateway.md` TC-F13.145..146 for obsolete TC docs.

---

### GH-1082 Final Review Fixes (Approve-Payment Race Guard + Orphaned Order Sentinel)

**2 additional critical fixes from fix/1082-f10-cancel-variant-stock-restock branch:**

- **fix(orders): approve-payment cancel+approve race via SQL CAS guard** — `src/app/api/orders/[id]/approve-payment/route.ts` now uses atomic SQL CAS (`UPDATE WHERE status NOT IN ('cancelled', 'refunded')`) to prevent concurrent cancel from overwriting the approval state mid-flight. Pre-approval guard (`status !== 'cancelled'`) catches stale state; post-CAS recheck (when `rows=0`) distinguishes cancelled-race (409 CONFLICT) from double-approve idempotency (200). New tests TC-F10-06-44, 45, 46 cover defensive guard, race detection, and idempotent retry.

- **fix(orders): orphaned order sentinel marks cancelled before delete** — `src/app/api/orders/checkout/route.ts` compensation path now calls `payload.update({ status: 'cancelled' })` before delete when stock-decrement fails (lines 356–366). Prevents orphaned order double-restock if delete fails (FK constraint, transient network error) — concurrent or future cancel calls will skip restock due to sentinel status. Best-effort guard with `.catch()` logging; delete failure still logged for ops visibility. Test: TC-F10-02-27 validates sentinel prevents double-increment on delete failure.

**Impact:** Approve-payment fully protected from cancel races (atomic guard + semantic error code). Orphaned orders no longer risk double-restock. Both fixes shipped in single atomic commit to GH-1082 fix branch.

**Tests:** 4 new tests (TC-F10-06-44..46 + TC-F10-02-27). All 59 orders tests pass (orders-checkout: 38, orders-cancel: 21).

### GH-1082 Final Review Fixes (Variant CAS Guard + Error Code Semantics)

**5 final production-readiness fixes from stock flow review:**

- **fix(db): UNIQUE INDEX on products_variants(_parent_id, lower(name))** — new constraint `products_variants_name_parent_uniq` in migration. Guards against duplicate variant names within the same product, preventing CAS double-decrement race (one product with Red-M variants in multiple rows). Inserted as part of schema validation audit (not user-reported; proactive defense-in-depth).

- **fix(orders): variant_not_found at CAS → maps to PRODUCT_NOT_FOUND error code** — `src/app/api/orders/checkout/route.ts` line 286: when `decrementVariantStock()` detects variant row missing at CAS time (data integrity edge case, e.g. variant deleted post-cache), failedReason now correctly reports `product_not_found` (was `variant_not_found`). Improves UX clarity for customer-facing error ("Product is no longer available" vs misleading "Out of stock"). Preserves internal diagnostics logging.

- **fix(orders): new STOCK_UPDATE_FAILED error code for transient write failures** — `src/app/api/orders/checkout/route.ts` lines 362, 364: transient failures during stock decrement (not OOS, not missing) now map to `STOCK_UPDATE_FAILED` instead of collapsing into generic `OUT_OF_STOCK`. Enables ops alerting on systemic write bottlenecks vs. legitimate inventory exhaustion. Typed as `failedReason: 'write_failed' | 'variant_not_found' | 'product_not_found'`.

- **fix(orders): restockItem trims variantName before SQL** — `src/app/api/orders/lib/stock-utils.ts` line ~60: variant name lookup now `.trim()`s historical order data that may contain trailing whitespace. Defensive; prevents false-negative variant lookups during cancel restock. Test: TC-F10-03-15 confirms retry succeeds after trim.

- **fix(orders): payload.logger.error on failed restock in cancel route** — `src/app/api/orders/[id]/cancel/route.ts` lines ~120–125: when `restockItem()` returns `skipped: true`, now calls `payload.logger.error()` (not silent). Logs `orderId`, `productId`, `variantName`, `reason` for ops visibility. Complements checkout compensation path (GH-1082 Code Review Fixes).

- **fix(orders): Number.isFinite ID guard in cancel route** — `src/app/api/orders/[id]/cancel/route.ts` line ~45: order ID now validated via `Number.isFinite()` before SQL, preventing accidental type coercion on malformed URLs. Defensive against fuzzing; aligned with security best practices.

**Tests:** Extended existing TC-F10-02/03 suites; no new TC-IDs. All 59 tests pass (orders-checkout: 38, orders-cancel: 21).

**Impact:** Variant stock decrement race fully guarded (index + error semantics). Cancel restock fully observable. Checkout error codes now semantically correct for ops response. Production-ready.

### GH-1082 Repost-merge Fixes (Atomic Variant Decrement + Error Observability)

**3 follow-up fixes to resolve stock flow race conditions and observability gaps:**

- **fix(orders): atomic variant stock decrement via SQL CAS** — `src/app/api/orders/lib/stock-utils.ts` `decrementVariantStock()` now uses raw SQL `UPDATE products_variants SET stock = stock - ? WHERE _parent_id = ? AND name = ? AND stock >= ? RETURNING id` (PostgreSQL CAS), eliminating the non-atomic read-modify-write race from prior Payload API approach. Variant stock now correctly protected from concurrent oversell. Non-variant path (`products.inventory`) unaffected (already atomic). Inventory aggregate `products.inventory` recomputed post-CAS to sync derived field.

- **fix(orders): approve-payment now runs variant-aware decrement** — `src/app/api/orders/[id]/approve-payment/route.ts` calls `decrementVariantStock()` for variant items on bank_transfer payment approval (not just COD). Ensures variant stock is correctly decremented at payment approval, enabling proper restock on order cancel (was no-op before because variants had never been decremented).

- **fix(orders): console.error on variant-not-found during checkout** — `src/app/api/orders/checkout/route.ts` now surfaces ORM cache vs DB table inconsistency via `console.error()` when `decrementVariantStock()` returns `variant_not_found`. Non-blocking; allows checkout to proceed but raises ops alert for data reconciliation (e.g. variant deleted post-cache, stale ORM state). Added to compensation path (lines ~315–318) to log `reason` on `restockItem()` skip.

**Tests:** Extended TC-F10-02-15..26 (checkout path) to assert atomic CAS behavior + error logging. All 59 tests pass (orders-checkout: 38, orders-cancel: 21).

**Impact:** Variant stock decrement is now atomic (no concurrent oversell possible). Bank transfer orders now restock correctly on cancel. Ops has visibility into variant deletion races via console.error.

### GH-1082 — Fix Variant Stock Restock + Decrement (F10 Bug Fix)

**Bug:** Variant products did not restore stock on order cancel (restock used undefined top-level `stock` field instead of per-variant `stock`). COD checkout did not decrement per-variant stock, only aggregate `inventory` — causing variant inventory to drift and eventual oversell. OOS check at checkout used aggregate inventory, allowing buyers to order a quantity unavailable in the requested variant.

**Root cause:** Dual schema model (`products.stock` for non-variants vs `products.variants[N].stock` for variants) led to confusion in cancel + checkout routes. Variant array updates use optimistic patterns (read-then-write) without atomic protection, causing concurrent cancels on the same product to clobber each other's writes.

**Implementation:**
- **New module:** `src/app/api/orders/lib/stock-utils.ts` — extracted shared stock helpers:
  - `restockItem(payload, productId, variantName, quantity)` — restock single order line, handles variant vs non-variant, optimistic retry (3 attempts, 25ms exponential backoff)
  - `decrementVariantStock(payload, productId, variantName, quantity)` — decrement per-variant stock for COD checkout, same retry pattern
  - `RestockResult` + `DecrementResult` types for structured responses
  - MAX_RETRIES constant (3) to mitigate concurrent `variants[]` array writes
- **Route updates:**
  - `src/app/api/orders/[id]/cancel/route.ts` — imports `restockItem()`, branches on `product.hasVariants`. For variant products, finds variant by name snapshot and increments `variants[idx].stock`. Non-variant path unchanged (updates `stock` field).
  - `src/app/api/orders/checkout/route.ts` — imports `decrementVariantStock()` + `restockItem()`. OOS check now uses per-variant `variant.stock` when `hasVariants`. COD decrement branches: variant items call `decrementVariantStock()`, non-variant items use existing CAS `UPDATE inventory`. Compensation (on mid-flight failure) calls `restockItem()` for variant items, CAS for non-variant.
- **Payload hooks:** `Products.ts:115-117` `beforeChange` hook auto-recalculates `inventory` from `sum(variants[].stock)` whenever `variants` array is updated — no double-bookkeeping needed.
- **Test coverage:** 9 new TC-IDs added to `docs/qa/F10-orders-management.md`:
  - **Cancel tests** (4): TC-F10-03-12 (variant restock happy), TC-F10-03-13 (variant name not found), TC-F10-03-14 (mixed cart), TC-F10-03-15 (optimistic retry)
  - **Checkout tests** (5): TC-F10-02-15 (COD variant decrement), TC-F10-02-16 (variant OOS 422), TC-F10-02-17 (mixed cart), TC-F10-02-18 (bank_transfer skip decrement), TC-F10-02-19 (mid-flight compensation)
  - **Test files updated:** `src/__tests__/api/orders-cancel.test.ts` (4 new tests, 1 rename), `src/__tests__/api/orders-checkout.test.ts` (5 new tests). All 46/46 passing for affected files.

**Guard order (defensive):**
1. Product not found → skip + log reason
2. Variant products → find variant by name snapshot
3. Variant not found → skip + log (variant may have been deleted after order placed)
4. Retry on write conflict → exponential backoff, max 3 attempts

**Breaking changes:** None. Non-variant restock behavior identical (writes to `stock` field). Variant restock now works (previously silently no-op). Variant OOS check now accurate (previously allowed oversell).

**Impact:**
- Order cancel: variant stock now properly restored (fixes data drift)
- COD checkout: per-variant stock decremented correctly (prevents overstocking display)
- OOS check: per-variant when applicable (prevents oversell for popular variants)
- All existing tests pass; no regression in non-variant paths

**Related:** F10 bug #1082 (production issue: variant stock never restored)

---

### GH-1082 Code Review Fixes (F10 Post-merge cleanup)

**3 follow-up fixes from code review of the variant stock restock implementation:**

- **fix(orders): log compensation failures when restockItem returns skipped** — `src/app/api/orders/checkout/route.ts` compensation path (lines ~309–318) now awaits `restockItem()` return value and logs `console.error` when `comp.skipped === true`, instead of relying on dead `.catch()` code. Logs include `orderId`, `productId`, `variantName`, `reason` for ops visibility on stock reconciliation failures.

- **fix(orders): return restocked=0 on product_not_found in restockItem** — `src/app/api/orders/lib/stock-utils.ts` line 39 now returns `restocked: 0` (correct semantics) instead of `restocked: quantity` when product is not found, preventing metric corruption if any downstream consumer sums `restocked` values.

- **docs(architecture/F10): document non-atomic variant decrement race** — Added inline comment to `decrementVariantStock()` in `stock-utils.ts` identifying the read-modify-write race window on variant array updates. Added "Known limitations" subsection to `docs/architecture/F10-orders-management.md` documenting the non-atomic variant decrement vs. atomic non-variant SQL CAS path, with v1.2 deferral for advisory-lock fix.

**Tests:** Extended TC-F10-02-19 to assert `console.error` is called when compensation `restockItem()` returns `skipped: true`. All 47 tests pass (orders-checkout: 32, orders-cancel: 15).

**Impact:** Compensation failures now observable in logs for debugging. Return values semantically correct. Known race documented for future atomicity fix.

### GH-1082 Additional Post-merge Fix (Variant Deletion Race UX)

**1 additional edge-case fix:**

- **fix(orders): improve error message when variant deleted mid-checkout** — `src/app/api/orders/checkout/route.ts` now properly handles race condition where a variant product is deleted between initial OOS check and COD stock decrement. `failedReason` type widened from 2-way to 3-way union (`'insufficient_stock' | 'product_not_found' | 'write_failed'`); when `decrementVariantStock()` fails with `product_not_found`, user receives "Product X is no longer available — please remove it from your cart and try again" instead of misleading "Stock update failed". Guard improved from `if (failedItem)` to `if (failedReason)` (removes non-null assertion, improves type safety).

**Tests:** New TC-F10-02-20 added to `src/__tests__/api/orders-checkout.test.ts` covering variant deletion mid-decrement scenario. All 48 tests pass (orders-checkout: 33, orders-cancel: 15).

**Impact:** Race condition now has clear, actionable UX feedback. Type safety improved.

---

### F33 — Discount CMS Dashboard UI (Phase 1: List Page)

**Dashboard discount list page** with sortable table, search, filters, status badge, and usage meter.

**Code changes (Phase 1 UI):**
- New: `src/lib/discounts/format.ts` (formatting utilities: fmtRM, fmtValue, fmtDate)
- New: `src/app/(dashboard)/discounts/page.tsx` (RSC shell, force-dynamic)
- New: `src/app/(dashboard)/discounts/_components/discounts-client-layout.tsx` (client orchestration)
- New: `src/app/(dashboard)/discounts/_components/discounts-toolbar.tsx` (search + filters + buttons)
- New: `src/app/(dashboard)/discounts/_components/discounts-table.tsx` (sortable table with type/status/usage cols)
- New: `src/app/(dashboard)/discounts/_components/discount-status-badge.tsx` (status pill component)
- New: `src/app/(dashboard)/discounts/_components/discount-usage-meter.tsx` (count/limit progress bar)
- Modified: `src/components/dashboard/Sidebar.tsx` (add Discounts nav item with children after Orders)
- Modified: `src/components/editor/EditorMenuDrawer.tsx` (same nav item)
- Modified: `src/app/api/v1/discounts/route.ts` (add type filter param, sort allowlist, parseInt NaN guard)

---

### F33 — Discount CMS Backend (Phases 1–5 complete)

**Overview:** Discount code engine with admin CRUD API and storefront preview. Supports percentage + fixed discounts, usage limits, date-based activation/expiry, per-tenant isolation, and server-side recomputation at order time.

**Phases 1–4 (Implementation):**
- **Phase 1:** `applyDiscount()` pure function, Zod validation, Discounts + DiscountUsageHistory collections, DB migrations
- **Phase 2:** Admin REST API (`POST /api/v1/discounts`, `GET /api/v1/discounts`, `PATCH /api/v1/discounts/:id`)
- **Phase 3:** Storefront preview endpoint (`POST /api/storefront/discounts/apply`) with rate-limiting (20 req/60s), silent-reject (no reason leakage)
- **Phase 4:** Order integration — server-side recomputation, usage history row creation, checkout field binding

**Phase 5 (Tests only — this phase):**
- Unit tests: `src/__tests__/unit/discounts/apply-discount.test.ts` (9 tests, TC-F33-01..09)
- Unit tests: `src/__tests__/unit/discounts/discount-validation.test.ts` (validates Zod schema, code format, value bounds)
- Integration tests: `src/__tests__/integration/discounts/discounts-api.test.ts` (4 tests, TC-F33-10..13, 20..23)
- All tests use TC-IDs from `docs/qa/F33-discounts.md` (22 TCs total, 21 AUTO, 1 MANUAL)
- All 22 tests passing; 100% coverage on discount modules

**Code changes (Phases 1–4):**
- New: `src/collections/Discounts.ts`, `src/collections/DiscountUsageHistory.ts` (schema + tenant-scoped access)
- New: `src/lib/discounts/apply-discount.ts` (pure engine, 9 guard checks), `src/lib/validations/discounts.ts` (Zod)
- New: `src/app/api/v1/discounts/route.ts` (CRUD, 201/409/403/400 guards)
- New: `src/app/api/storefront/discounts/apply/route.ts` (public preview, rate-limited, silent-reject)
- Modified: `src/collections/Orders.ts` (discount_code FK, discountSen field)
- Modified: `src/app/api/orders/checkout/route.ts`, `/stripe-checkout/route.ts` (recompute discount server-side)
- Modified: `scripts/db-setup.js` (6 migrations: discounts table, usage-history table, FK, indices, fields)

**Key properties:**
- **Discount types:** percentage (0–100) | fixed (0–999,999,999 sen)
- **Validation:** code (3–50 chars, alphanumeric + hyphen), dates (startsAt < expiresAt), rates (0 ≤ value ≤ max)
- **Clamping:** discount amount never exceeds subtotal; final total ≥ 0
- **Tenant isolation:** (tenant_id, upper(code)) unique; cross-tenant blocked; case-insensitive lookup
- **Usage tracking:** usageCount incremented on order creation (idempotent; duplicate orders don't double-count)
- **Backward compatible:** existing orders unchanged; preview API returns silent reject (no reason leak)

**Security:**
- Server-side recomputation: client-sent discount amounts never trusted
- Critical guard order: not-found → expired → not-started → inactive → at-limit → wrong-tenant
- Storefront API always returns HTTP 200 (no 4xx for invalid codes), preventing enumeration attacks
- IDOR prevention: all queries scoped to tenant + authenticated user

**Non-breaking:**
- No changes to existing order fields or checkout UX
- Discount feature opt-in per order; NULL code allowed
- All tests pass; zero regression in adjacent modules

**Related:** `docs/qa/F33-discounts.md` (22 TCs + coverage notes), `docs/prd/F33-discounts.md` (phase specs)

---

### F32 — Email Template CMS Settings

**Features:**
- Per-tenant customization of 15 transactional email templates (subject, greeting, CTA label, closing) in 2 languages (English, Malay)
- Enable/disable toggle per template with critical-type guard (otp-verification, forgot-password, password-changed cannot be disabled)
- Real-time preview via `/api/email-preview` (sandboxed iframe, debounced 300ms, no DB write/send)
- Upstash Redis cache (TTL 300s) for config lookups; invalidates on save/delete
- New Payload collection: `email-template-settings` (multi-tenant scoped, unique index on tenant+type+recipient)
- Dashboard navigation: Settings → Email Templates
- 15 email template functions refactored to accept optional CMS override config
- Backward compatible: no config row = hardcoded defaults, send behavior unchanged

**Email Template Types (15):**
- Critical (cannot disable): otp-verification, forgot-password, password-changed
- Commerce: order-confirmation, shipment-notification, refund-processed
- User: welcome, contact-confirmation, subscription-created, subscription-canceled
- Engagement: review-notification, product-restock, discount-alert, feature-announcement, generic

**Code changes:**
- New: `src/collections/EmailTemplateSettings.ts` (Payload collection definition)
- New: `src/lib/email/types.ts` (EmailTemplateType enum, EmailRecipient enum)
- New: `src/lib/email/get-template-config.ts` (Redis cache + Payload DB lookup)
- New: `src/lib/email/merge-template-config.ts` (config merge + variable substitution with HTML escaping)
- New: `src/lib/email/preview-fixtures.ts` (mock data per template type)
- New: `src/lib/email/template-registry.ts` (templateType → render fn mapping)
- New: `src/lib/redis.ts` (shared Upstash Redis singleton, extracted from rateLimit.ts)
- New: `src/app/api/email-preview/route.ts` (authenticated preview endpoint)
- New: `src/app/(dashboard)/settings/email-templates/` (page + UI components, server actions)
- Modified: `src/lib/email/send.ts` (extended with templateType/recipient/tenantId/config params)
- Modified: `src/lib/rateLimit.ts` (import redis from ./redis)
- Modified: `src/payload.config.ts` (register EmailTemplateSettings collection)
- Modified: `scripts/db-setup.js` (4 migrations: create table, add columns, create indices)
- Modified: `src/components/dashboard/Sidebar.tsx` + `src/components/editor/EditorMenuDrawer.tsx` (add "Email Templates" nav item)

**Tests:**
- 25 automated test cases (TC-F32-001..020): cache layer (hit/miss/null/fallback), merge/variable substitution, multi-tenant isolation, backward compat, critical-type guard, HTML escaping
- Unit tests: `src/__tests__/unit/email/get-template-config.test.ts` (6 tests), `src/__tests__/unit/email/merge-template-config.test.ts` (11 tests)
- Integration tests: `src/__tests__/integration/email-settings/multi-tenant-isolation.test.ts` (8 tests)
- All tests pass; 100% coverage on new code

**Security:**
- All DB ops scoped to getCurrentTenantId() (IDOR prevention)
- Critical types (otp/forgot-pwd/pwd-changed) cannot be disabled (gated at server action + UI)
- Preview API: authenticated, enum-validated templateType, no DB write/send
- HTML-escaping of all substituted values prevents XSS injection

**Non-breaking:**
- No changes to existing email send paths
- Existing order/user emails render identically when no config row exists
- All 15 template functions accept optional config; backward compatible with undefined

### GH-1082 Final Review Fixes (Approve-Payment Race Guard + Orphaned Order Sentinel)

**2 additional critical fixes from fix/1082-f10-cancel-variant-stock-restock branch:**

- **fix(orders): approve-payment cancel+approve race via SQL CAS guard** — `src/app/api/orders/[id]/approve-payment/route.ts` now uses atomic SQL CAS (`UPDATE WHERE status NOT IN ('cancelled', 'refunded')`) to prevent concurrent cancel from overwriting the approval state mid-flight. Pre-approval guard (`status !== 'cancelled'`) catches stale state; post-CAS recheck (when `rows=0`) distinguishes cancelled-race (409 CONFLICT) from double-approve idempotency (200). New tests TC-F10-06-44, 45, 46 cover defensive guard, race detection, and idempotent retry.

- **fix(orders): orphaned order sentinel marks cancelled before delete** — `src/app/api/orders/checkout/route.ts` compensation path now calls `payload.update({ status: 'cancelled' })` before delete when stock-decrement fails (lines 356–366). Prevents orphaned order double-restock if delete fails (FK constraint, transient network error) — concurrent or future cancel calls will skip restock due to sentinel status. Best-effort guard with `.catch()` logging; delete failure still logged for ops visibility. Test: TC-F10-02-27 validates sentinel prevents double-increment on delete failure.

**Impact:** Approve-payment fully protected from cancel races (atomic guard + semantic error code). Orphaned orders no longer risk double-restock. Both fixes shipped in single atomic commit to GH-1082 fix branch.

**Tests:** 4 new tests (TC-F10-06-44..46 + TC-F10-02-27). All 59 orders tests pass (orders-checkout: 38, orders-cancel: 21).

### GH-1082 Final Review Fixes (Variant CAS Guard + Error Code Semantics)

**5 final production-readiness fixes from stock flow review:**

- **fix(db): UNIQUE INDEX on products_variants(_parent_id, lower(name))** — new constraint `products_variants_name_parent_uniq` in migration. Guards against duplicate variant names within the same product, preventing CAS double-decrement race (one product with Red-M variants in multiple rows). Inserted as part of schema validation audit (not user-reported; proactive defense-in-depth).

- **fix(orders): variant_not_found at CAS → maps to PRODUCT_NOT_FOUND error code** — `src/app/api/orders/checkout/route.ts` line 286: when `decrementVariantStock()` detects variant row missing at CAS time (data integrity edge case, e.g. variant deleted post-cache), failedReason now correctly reports `product_not_found` (was `variant_not_found`). Improves UX clarity for customer-facing error ("Product is no longer available" vs misleading "Out of stock"). Preserves internal diagnostics logging.

- **fix(orders): new STOCK_UPDATE_FAILED error code for transient write failures** — `src/app/api/orders/checkout/route.ts` lines 362, 364: transient failures during stock decrement (not OOS, not missing) now map to `STOCK_UPDATE_FAILED` instead of collapsing into generic `OUT_OF_STOCK`. Enables ops alerting on systemic write bottlenecks vs. legitimate inventory exhaustion. Typed as `failedReason: 'write_failed' | 'variant_not_found' | 'product_not_found'`.

- **fix(orders): restockItem trims variantName before SQL** — `src/app/api/orders/lib/stock-utils.ts` line ~60: variant name lookup now `.trim()`s historical order data that may contain trailing whitespace. Defensive; prevents false-negative variant lookups during cancel restock. Test: TC-F10-03-15 confirms retry succeeds after trim.

- **fix(orders): payload.logger.error on failed restock in cancel route** — `src/app/api/orders/[id]/cancel/route.ts` lines ~120–125: when `restockItem()` returns `skipped: true`, now calls `payload.logger.error()` (not silent). Logs `orderId`, `productId`, `variantName`, `reason` for ops visibility. Complements checkout compensation path (GH-1082 Code Review Fixes).

- **fix(orders): Number.isFinite ID guard in cancel route** — `src/app/api/orders/[id]/cancel/route.ts` line ~45: order ID now validated via `Number.isFinite()` before SQL, preventing accidental type coercion on malformed URLs. Defensive against fuzzing; aligned with security best practices.

**Tests:** Extended existing TC-F10-02/03 suites; no new TC-IDs. All 59 tests pass (orders-checkout: 38, orders-cancel: 21).

**Impact:** Variant stock decrement race fully guarded (index + error semantics). Cancel restock fully observable. Checkout error codes now semantically correct for ops response. Production-ready.

### GH-1082 Repost-merge Fixes (Atomic Variant Decrement + Error Observability)

**3 follow-up fixes to resolve stock flow race conditions and observability gaps:**

- **fix(orders): atomic variant stock decrement via SQL CAS** — `src/app/api/orders/lib/stock-utils.ts` `decrementVariantStock()` now uses raw SQL `UPDATE products_variants SET stock = stock - ? WHERE _parent_id = ? AND name = ? AND stock >= ? RETURNING id` (PostgreSQL CAS), eliminating the non-atomic read-modify-write race from prior Payload API approach. Variant stock now correctly protected from concurrent oversell. Non-variant path (`products.inventory`) unaffected (already atomic). Inventory aggregate `products.inventory` recomputed post-CAS to sync derived field.

- **fix(orders): approve-payment now runs variant-aware decrement** — `src/app/api/orders/[id]/approve-payment/route.ts` calls `decrementVariantStock()` for variant items on bank_transfer payment approval (not just COD). Ensures variant stock is correctly decremented at payment approval, enabling proper restock on order cancel (was no-op before because variants had never been decremented).

- **fix(orders): console.error on variant-not-found during checkout** — `src/app/api/orders/checkout/route.ts` now surfaces ORM cache vs DB table inconsistency via `console.error()` when `decrementVariantStock()` returns `variant_not_found`. Non-blocking; allows checkout to proceed but raises ops alert for data reconciliation (e.g. variant deleted post-cache, stale ORM state). Added to compensation path (lines ~315–318) to log `reason` on `restockItem()` skip.

**Tests:** Extended TC-F10-02-15..26 (checkout path) to assert atomic CAS behavior + error logging. All 59 tests pass (orders-checkout: 38, orders-cancel: 21).

**Impact:** Variant stock decrement is now atomic (no concurrent oversell possible). Bank transfer orders now restock correctly on cancel. Ops has visibility into variant deletion races via console.error.

### GH-1082 — Fix Variant Stock Restock + Decrement (F10 Bug Fix)

**Bug:** Variant products did not restore stock on order cancel (restock used undefined top-level `stock` field instead of per-variant `stock`). COD checkout did not decrement per-variant stock, only aggregate `inventory` — causing variant inventory to drift and eventual oversell. OOS check at checkout used aggregate inventory, allowing buyers to order a quantity unavailable in the requested variant.

**Root cause:** Dual schema model (`products.stock` for non-variants vs `products.variants[N].stock` for variants) led to confusion in cancel + checkout routes. Variant array updates use optimistic patterns (read-then-write) without atomic protection, causing concurrent cancels on the same product to clobber each other's writes.

**Implementation:**
- **New module:** `src/app/api/orders/lib/stock-utils.ts` — extracted shared stock helpers:
  - `restockItem(payload, productId, variantName, quantity)` — restock single order line, handles variant vs non-variant, optimistic retry (3 attempts, 25ms exponential backoff)
  - `decrementVariantStock(payload, productId, variantName, quantity)` — decrement per-variant stock for COD checkout, same retry pattern
  - `RestockResult` + `DecrementResult` types for structured responses
  - MAX_RETRIES constant (3) to mitigate concurrent `variants[]` array writes
- **Route updates:**
  - `src/app/api/orders/[id]/cancel/route.ts` — imports `restockItem()`, branches on `product.hasVariants`. For variant products, finds variant by name snapshot and increments `variants[idx].stock`. Non-variant path unchanged (updates `stock` field).
  - `src/app/api/orders/checkout/route.ts` — imports `decrementVariantStock()` + `restockItem()`. OOS check now uses per-variant `variant.stock` when `hasVariants`. COD decrement branches: variant items call `decrementVariantStock()`, non-variant items use existing CAS `UPDATE inventory`. Compensation (on mid-flight failure) calls `restockItem()` for variant items, CAS for non-variant.
- **Payload hooks:** `Products.ts:115-117` `beforeChange` hook auto-recalculates `inventory` from `sum(variants[].stock)` whenever `variants` array is updated — no double-bookkeeping needed.
- **Test coverage:** 9 new TC-IDs added to `docs/qa/F10-orders-management.md`:
  - **Cancel tests** (4): TC-F10-03-12 (variant restock happy), TC-F10-03-13 (variant name not found), TC-F10-03-14 (mixed cart), TC-F10-03-15 (optimistic retry)
  - **Checkout tests** (5): TC-F10-02-15 (COD variant decrement), TC-F10-02-16 (variant OOS 422), TC-F10-02-17 (mixed cart), TC-F10-02-18 (bank_transfer skip decrement), TC-F10-02-19 (mid-flight compensation)
  - **Test files updated:** `src/__tests__/api/orders-cancel.test.ts` (4 new tests, 1 rename), `src/__tests__/api/orders-checkout.test.ts` (5 new tests). All 46/46 passing for affected files.

**Guard order (defensive):**
1. Product not found → skip + log reason
2. Variant products → find variant by name snapshot
3. Variant not found → skip + log (variant may have been deleted after order placed)
4. Retry on write conflict → exponential backoff, max 3 attempts

**Breaking changes:** None. Non-variant restock behavior identical (writes to `stock` field). Variant restock now works (previously silently no-op). Variant OOS check now accurate (previously allowed oversell).

**Impact:**
- Order cancel: variant stock now properly restored (fixes data drift)
- COD checkout: per-variant stock decremented correctly (prevents overstocking display)
- OOS check: per-variant when applicable (prevents oversell for popular variants)
- All existing tests pass; no regression in non-variant paths

**Related:** F10 bug #1082 (production issue: variant stock never restored)

---

### GH-1082 Code Review Fixes (F10 Post-merge cleanup)

**3 follow-up fixes from code review of the variant stock restock implementation:**

- **fix(orders): log compensation failures when restockItem returns skipped** — `src/app/api/orders/checkout/route.ts` compensation path (lines ~309–318) now awaits `restockItem()` return value and logs `console.error` when `comp.skipped === true`, instead of relying on dead `.catch()` code. Logs include `orderId`, `productId`, `variantName`, `reason` for ops visibility on stock reconciliation failures.

- **fix(orders): return restocked=0 on product_not_found in restockItem** — `src/app/api/orders/lib/stock-utils.ts` line 39 now returns `restocked: 0` (correct semantics) instead of `restocked: quantity` when product is not found, preventing metric corruption if any downstream consumer sums `restocked` values.

- **docs(architecture/F10): document non-atomic variant decrement race** — Added inline comment to `decrementVariantStock()` in `stock-utils.ts` identifying the read-modify-write race window on variant array updates. Added "Known limitations" subsection to `docs/architecture/F10-orders-management.md` documenting the non-atomic variant decrement vs. atomic non-variant SQL CAS path, with v1.2 deferral for advisory-lock fix.

**Tests:** Extended TC-F10-02-19 to assert `console.error` is called when compensation `restockItem()` returns `skipped: true`. All 47 tests pass (orders-checkout: 32, orders-cancel: 15).

**Impact:** Compensation failures now observable in logs for debugging. Return values semantically correct. Known race documented for future atomicity fix.

### GH-1082 Additional Post-merge Fix (Variant Deletion Race UX)

**1 additional edge-case fix:**

- **fix(orders): improve error message when variant deleted mid-checkout** — `src/app/api/orders/checkout/route.ts` now properly handles race condition where a variant product is deleted between initial OOS check and COD stock decrement. `failedReason` type widened from 2-way to 3-way union (`'insufficient_stock' | 'product_not_found' | 'write_failed'`); when `decrementVariantStock()` fails with `product_not_found`, user receives "Product X is no longer available — please remove it from your cart and try again" instead of misleading "Stock update failed". Guard improved from `if (failedItem)` to `if (failedReason)` (removes non-null assertion, improves type safety).

**Tests:** New TC-F10-02-20 added to `src/__tests__/api/orders-checkout.test.ts` covering variant deletion mid-decrement scenario. All 48 tests pass (orders-checkout: 33, orders-cancel: 15).

**Impact:** Race condition now has clear, actionable UX feedback. Type safety improved.

---

### GH-1084 — Add-to-Cart Variant Selection + Stock Fix (F09 Phase 03)

**Bug → Feature:** Checkout flow failed silently when products with variants were added without explicit variant selection, or when variant pricing was stale. Root cause: `buildOrderItems` function was embedded in stripe-checkout route, duplicating logic and making testing difficult. Eligibility guards were missing (draft/deleted products accepted), and OOS logic used per-variant `stock` field which is never decremented (causing stale reads).

**Implementation:**
- **New module:** `src/app/api/orders/stripe-checkout/build-order-items.ts` — extracted `buildOrderItems()` function (92 LOC) with comprehensive guards:
  - **Eligibility guard** — rejects draft products (`status !== 'active'`) + soft-deleted products (`deletedAt` set) before attempting variant/stock resolution
  - **Variant guards** — `VARIANT_REQUIRED` (hasVariants product missing variant field), `VARIANT_NOT_FOUND` (variant name doesn't exist on product)
  - **IDOR guard** — cross-tenant rejection when `tenantId` mismatch
  - **OOS guard** — uses aggregate `p.inventory` (decrement via stock-CAS in COD flow), NOT per-variant `variant.stock` (never decremented, permanently stale)
  - **Pricing:** variant.price used when variant selected; base product.price otherwise
  - **Stripe format:** line items include variant name in display ("Shirt (Red)"), prices in sen (smallest unit: 100 sen = RM 1)
- **Route integration:** `src/app/api/orders/stripe-checkout/route.ts` — imports `buildOrderItems()`, eliminates duplicated logic
- **Direct unit tests:** `src/__tests__/api/build-order-items.test.ts` (7 tests, TC-F09.230–236) — covers eligibility, variant, pricing, OOS, non-variant paths. All pass.
- **TypeScript:** `OrderItemRow`, `CheckoutItemRow`, `BuildResult` interfaces exported from module for reuse.

**Guard order (defensive depth):**
1. Product not found (NULL check)
2. Eligibility (status + deletedAt)
3. IDOR (tenant mismatch)
4. Variant required (if hasVariants)
5. Variant resolution (name lookup)
6. OOS (aggregate inventory)

**Code review fixes (post-merge):**
- Removed orphaned `useAddToCart` hook (`use-add-to-cart.ts`) — dead code superseded by `AddToCartButton` inline logic
- Fixed inventory source-of-truth in `ProductAddToCartSection`: was using `selectedVariant.stock` (stale), now uses `product.inventory` (aggregate, CAS-decremented)

**Breaking change:** None. New module is extraction + consolidation; stripe-checkout route behavior unchanged. Old tests for route now test module directly.

**Impact:**
- Checkout now rejects draft products and correctly identifies missing/stale variants before Stripe API call
- OOS logic now uses authoritative aggregate inventory (not stale per-variant stock)
- Future per-variant stock decrement (US-1084 Phase 04) will extend variant.stock logic; today aggregate only

**UX Design Decision — Listing pages route to PDP, not direct add-to-cart:**
- `products-grid` block: all products (variant or not) show **"View Detail"** → navigate to PDP. Rationale: PDP is the authoritative purchase entry point; enforces correct variant selection and stock display before cart.
- `products-featured` hero block: **"Add to Cart" button removed**. Only "View Details" link remains.
- `product-quick-view` modal (live products): CTA changed from direct add-to-cart to **"View Product"** → navigate to PDP. Applies regardless of OOS state — PDP handles stock display.

This is intentional — not a regression. `useAddToCart` is still used on PDP via `ProductAddToCartSection`.

**Related:** GH-1084 Phase 01 (client-side variant picker), Phase 02 (eligibility guards), Phase 03 (extraction + direct testing), Phase 04 (per-variant stock — pending)

### F25 Code Review Gap Fixes (Phase 1 — CQ-01 to CQ-04)

**4 important issues fixed post-implementation review:**
- **CQ-01:** Added `orders.customer_id_fk` FK migration with `ON DELETE SET NULL` constraint. Ensures customer deletion (if ever enabled) does not cascade-delete orders; sets `customer_id` to NULL instead.
- **CQ-02:** Phone field schema + validation hardened. Added `customers.phone_type_varchar20` migration (aligns schema to spec); added > 20 chars null-guard in `normalizePhone()` for defence-in-depth against malicious direct API calls bypassing frontend validation.
- **CQ-03:** Fixed useCallback missing dep warning in `customers-client-layout.tsx`. Extracted `loadFailedMsg` const before `load` callback to avoid stale-closure on locale change; added to dependency array.
- **CQ-04:** CSV export `csvField` now strips `\r\n` before formula-injection guard (aligns with `sanitizeCell` behavior in dashboard, prevents row-boundary confusion in RFC 4180 parsers).

**Tests:** All customers-related unit tests pass; ESLint exhaustive-deps warning resolved.

**Impact:** F25 backend robustness + API contract hardening. Zero breaking changes; feature fully spec-compliant.

### F25 Code Review Gap Fixes (Phase 2 — CQ-05 to CQ-06)

**2 minor docs issues resolved post-implementation review:**
- **CQ-05:** Fixed stale architecture description — `docs/architecture/F25-shop-customers.md` §2 now correctly documents latest-wins behavior: `syncCustomerSnapshot` patches denormalized name/phone on `operation=create` AND on `update` when `customerName` or `customerPhone` differ from `previousDoc`. Previously doc said "create-only", but implementation was already correct.
- **CQ-06:** Added missing `customers.normalize_existing_phones` migration entry to `docs/architecture/F25-shop-customers.md` §4 migrations table. Migration exists in `scripts/db-setup.js` and is required for partial unique index on existing phone data; now spec-aligned.

**Impact:** Architecture docs now fully align with implementation. Zero code changes; pure documentation accuracy fix.

### F25 Light/Dark Mode Theming (CSS Variable Refactor)

**Theming refactor — pure visual, no behavior changes:**
- **CSS variables added:** `src/app/globals.css` introduces `--cus-*` semantic token set for F25 Customers feature (26 tokens + rank badge variants). Covers surfaces (card, header, dropdown, info), borders (subtle/medium/strong), text layers (secondary/muted/subtle/faint), code blocks, skeletons, and 4 rank badges (VIP/Gold/Silver/Bronze) with light + dark mode overrides.
- **Component refactoring:** All 6 customer UI components refactored to replace hardcoded dark colors with `var(--cus-*)` tokens. Affected: `customer-list.tsx`, `customer-detail.tsx`, `customer-*-tab.tsx`, rank badge components.
- **Light mode support:** Full light mode palette added to complement existing dark baseline; all UI automatically respects `<html class="dark">` toggle.

**Impact:** F25 feature now theme-aware; no breaking changes; visual behavior identical, just token-driven instead of hardcoded.

### F25 Review Bug Fixes (Wave 2 polish)

**10 bugs fixed across backend + frontend after code review:**
- **BE-1:** `Customers.ts` beforeChange hook now normalizes phone: trim → strip `[-\s().]` → lowercase → null on empty
- **BE-2:** `auto-link-customer.ts` found-customer path no longer overwrites existing customer addresses (was losing address book on duplicate phone)
- **FE-1:** `customers-client-layout.tsx` — added stale genRef response guard + useCallback memoization for click handler
- **BE-3/BE-4:** `Orders.ts` corrected `shippingAddress` + `customerName` field descriptions (were swapped)
- **FE-3:** Renamed `customers-atoms.tsx` → `customers-shared-ui.tsx` (clarity)
- **FE-4:** `customers-detail-default-tab.tsx` added fallback split guard `?? ''` (prevent undefined spread in JSX)
- **FE-5:** `actions.ts` `meta` returns `safePage` not raw `page` (defensive pagination bound)
- **FE-6:** `customers-list-toolbar.tsx` Apply button now disabled when `localFrom > localTo` (date range validation)
- **BE-7:** Added 3 regression tests: `auto-link-customer.test.ts` (TC-F25-006b, TC-F25-02-20) covering phone edge cases + address preservation

**Impact:** F25 feature now spec-aligned; no breaking changes; all tests pass.

### F25 Round 2 — Bug Fixes (Phone Normalization + Hooks Stability)

**6 issues fixed post-review:**
- **fix(customers):** strip `+` from phone normalization — prevents identity fragmentation (`+60...` vs `60...` treated as different customers). Regex `/[-\s()+.]/g` applied in `auto-link-customer.ts`, `Customers.ts` beforeChange hook, plus tests (TC-F25-09-01..02).
- **fix(customers):** `latestOrderAt` now only written on `operation=create` in `syncCustomerSnapshot.ts`. Previously updated on edit, causing historical timestamp corruption (TC-F25-09-03).
- **fix(customers):** `syncCustomerSnapshot.ts` checks `operation === 'create'` before writing denormalized fields, preventing overwrites on order edits (TC-F25-09-04..05).
- **fix(customers):** CSV export `sanitizeCell` now strips embedded newlines (`\r\n`) per RFC 4180. Prevents cell value escape corruption in Excel (TC-F25-09-06).
- **fix(customers):** `fetchOrderStats` single-customer limit raised from 1 000 to 5 000 rows. Supports high-volume customer detail pages without query pagination (TC-F25-09-07).
- **test(customers):** new `sync-customer-snapshot.test.ts` — 9 tests covering operation semantics, field isolation, latestOrderAt timing (TC-F25-09-01..07).

**Impact:** Phone identity fragmentation eliminated; snapshot isolation guarantees met; large customer exports stable. Zero breaking changes; 79 tests pass.

---

### GH-1018 — Code Review Bug Fixes (iframe guard + DRY editor detection)

**Bug fixes (fix/BUG-F05-1018-block-product-view-detail):**
- **Quick View iframe guard tightened** — replaced over-broad `if (window.parent !== window)` with scoped `isInEditorPreview()` check. Fixes silent navigation break in non-editor iframe embeds (preview tools, embeds); preserves editor-preview toast behavior when `?editor` or `?builder` query param present.
- **DRY editor detection** — extracted duplicated `window.parent !== window && (?editor || ?builder)` logic into `isInEditorPreview()` utility exported from `src/lib/storefront/editor-intercept.ts`. Consumed by `handleCartClick()`, `useAddToCart()`, and Quick View button handler. Includes SSR guard (`typeof window === 'undefined'` → false).

**Impact:** Quick View button now navigates correctly in non-editor iframe embeds; add-to-cart toast still blocks navigation in editor preview.

---

### GH-1018 — Block Product Navigation + Add to Cart Wiring (F05 Bug Fix + Enhancement)

**Bug → Feature:** Product block links (products-featured "View Details", products-grid "Quick View") navigated inside editor iframe, breaking layout. Enhanced to add real Add to Cart functionality on public storefront.

**Implementation:**
- **New hook:** `src/lib/storefront/use-add-to-cart.ts` — `useAddToCart(product, siteSlug, siteId)` hook encapsulates cart logic: adds item to `cartStore`, tracks `add_to_cart` event, editor guard via iframe detection (`window.parent !== window`), out-of-stock check via `product.inventory`.
- **API enhancement:** `src/app/api/storefront/products/route.ts` (new) — public endpoint for product listing. Query params: `site` (required), `limit`, `page`, `sort`. Returns products with inventory field, variant details stripped to prevent schema drift.
- **Block integration:** `src/blocks/products-featured/index.tsx` + `src/blocks/products-grid/index.tsx` + `src/blocks/product-quick-view/index.tsx` — extracted inner components (`HeroProductView`, `ProductCard`, `QuickViewModal`), wired `useAddToCart` hook. Quick-view modal implements 3-branch CTA logic: ctaUrl (navigation) → hasLiveData (real cart) → static (editor-guarded). "Add to Cart" button replaces "View Details" link on storefront (editor still shows navigation block).
- **Product enrichment:** Products fetched via API now include `inventory` field; hooks check `inventory <= 0` to disable button.
- **Type updates:** `src/blocks/product-quick-view/config.ts` — extended `QuickViewProduct` type with optional `slug` field (for dynamic quick-view modal); runtime block enriches products with `_id`, `_inventory`, `_compareAtPrice`, `_currencyCode` from API response.

**Pattern:** Editor nav blocking via `window.parent !== window` iframe guard (posts toast); storefront nav via real cart actions + analytics tracking.

**Impact:** 
- Editor preview: Product blocks show "Add to Cart" text but clicking raises "Navigation is disabled" toast (unchanged from GH-1018 initial fix).
- Public storefront: "Add to Cart" button functional, adds to cart, tracks event, disables if out-of-stock.

**Non-breaking:** Existing editor behavior preserved. Public storefront now has working cart integration (previously unavailable).
### F25 — Shop Customers Collection (Restore PW1 Parity)

**Features:**
- First-class Customers collection: email (normalized per-tenant), name, phone, rank (manual bronze/silver/gold/vip), addresses book (≤10 per customer)
- Auto-link to Orders via beforeChange hook: orders with customerEmail auto-upsert Customer by (tenant_id, normalized_email), idempotent (5 orders same email = 1 Customer)
- Tenant-scoped access control: users see only their tenant's customers; super-admin unrestricted; delete forbidden (protects Order FK integrity)
- Admin UI: list view (search by email/name, filter by rank), detail view (edit addresses + rank), Orders history tab (custom Payload component), CSV export (10k row cap)
- CSV export endpoint `/api/v1/customers/export?tenantId=X`: streams 7 columns (email, name, phone, rank, createdAt, addressCount, orderCount), formula-injection guarded, PII data cached privately

**Acceptance Criteria:**
- TC-F25-001..010: Email normalization, auto-link idempotency (5 orders = 1 Customer), empty/invalid email silent skip (non-throwing), database fault tolerance, tenant isolation (read+update+no delete), addresses validator (max 10), rank enum (bronze|silver|gold|vip only)

**Code changes:**
- New: `src/collections/Customers.ts` (177 LOC) — schema, Payload hooks, tenant-scoped access
- New: `src/collections/orders-hooks/auto-link-customer.ts`, `sync-customer-snapshot.ts` — Order linkage hooks (non-throwing, idempotent upsert)
- New: `src/app/api/v1/customers/export/route.ts` — CSV streaming with tenant isolation + 10k cap
- New: `src/components/admin/customers-*.tsx` — Admin list/detail UI, custom Orders tab
- Modified: `src/collections/Orders.ts` — add `customer` FK field + hook wiring
- Modified: `src/payload.config.ts` — import + register Customers collection
- Database: 9 migration entries (`customers.create_table`, `customers_addresses.create_table`, `orders.customer` FK, indices, Payload rels tables)

**Tests:**
- 39 automated tests (TC-F25-001..010): auto-link-customer.test.ts (5 tests), customers-access.test.ts (2 tests), customers-field-validation.test.ts (2 tests), customers-export.test.ts (2 tests) — all pass
- Manual smoke matrix deferred (user QA post-merge): list/search/filter UI, Orders tab navigation, CSV 10k cap

**Non-breaking:**
- Order denormalized snapshot fields (`customerEmail/Name/Phone/shippingAddress`) untouched → backward-compatible
- Existing orders without customer FK remain valid (NULL FK allowed)
- Orphan backfill script pseudocode in phase-03 spec; not executed (pending US-MIGA-12 ETL plan)

**Restores PW1 parity:** Tier-S priority #9, Group B3 / US-MIGA-12. PW2 entity built; historical data migration deferred.

---

### GH-1024 — Block CRUD Helpers + Menu Block Nested Arrays (F08 Phase 03) + Code Review Fixes

**Features:**
- Added nested CRUD helper functions to SettingsPanel: `updateNestedItem()`, `addNestedItem()`, `removeNestedItem()` for two-level array nesting (categories → items)
- Implemented settings sections for `menu-display` and `menu-food` blocks in editor SettingsPanel, enabling live category/item editing
- Menu items support extended fields: `dietaryTags` (validated against `VALID_DIETARY_TAGS` set), `isPopular` checkbox, `isNew` flag
- RichText rendering fixed for menu-food items (classic + card variants now parse HTML markup in `item.name`/`item.description`)
- Menu-display photo-grid variant: item text center-aligned with proper flex wrapping

**Code changes:**
- `src/components/editor/SettingsPanel.tsx` (~2700 lines) — added three nested CRUD helpers + two 60+ line CRUD sections for menu-display + menu-food blocks (categories label, add-category button, category iteration with remove button, items CRUD within each category)
- `src/i18n/locales/en.json` + `ms.json` — 10 new keys: `categoriesLabel`, `addCategory`, `categoryN`, `itemsLabel`, `addMenuItem`, `menuItemN`, `dietaryTags`, `isNew`, `tag`, `storefront.checkout.calculatingShipping` (carryover from F14)
- Block render updates: `src/blocks/menu-food/index.tsx`, `src/blocks/menu-display/index.tsx` — RichText integration, alignment fixes
- Config types: `src/blocks/menu-display/config`, `src/blocks/menu-food/config` — MenuDisplayCategory, MenuDisplayItem, MenuCategory, MenuItem type exports

**Tests:** 10 TC-IDs in Phase 03 suite (TC-F08-CRUD-MENUDISP-*, TC-F08-CRUD-MENUFOOD-*) covering category/item add/remove/update, dietary tag validation, isPopular/isNew toggles. All tests pass.

**Code review fixes (Phase 03 follow-up):**
- **C-1 (Critical):** Removed `menu-display` from `SupportedAddSectionType` union, matcher regexes, labels map, and builder case in `src/lib/ai/add-section.ts` — closes AI injection path where chat prompts like "add menu" could bypass `BLOCKS_TEMP_HIDDEN` policy and create unsupported `menu-display` blocks. Expanded `menu-food` matcher to explicitly include synonyms (menu, food, restaurant, dish).
- **I-1 (Important):** Fixed variable shadowing in `src/components/editor/FeatureComparisonSettings.tsx` — renamed callback param `t` → `prev` (inner `t` shadowed i18n `useI18n().t`).
- **I-2 (Important):** Added `safeTab` defensive derivation in `FeatureComparisonSettings.tsx` to prevent undefined array index access when `products.length` shrinks below `activeTab` post-decrement.
- **M-1 (Minor):** Changed React keys in menu-food CRUD from name-based to index-only (`mf-cat-${ci}`, `mf-item-${ci}-${ii}`) in `src/components/editor/SettingsPanel.tsx` — prevents blur-driven remount when category/item name changes mid-keystroke.
- **M-2 (Minor):** Added `type="button"` attribute to 4 menu-food CRUD buttons (remove category, remove item, add item, add category) in `src/components/editor/SettingsPanel.tsx` — prevents accidental form submission.
- **M-3 (Minor):** Fixed `noreferrer` deduplication logic in `src/lib/utils/rich-text-render.tsx` — splits `noopener`/`noreferrer` checks; prevents duplicate `noreferrer` when `rel="noreferrer"` already present.
- **M-4 (Minor):** Added nested image FK cleanup for menu-food `categories[].items[].image` in `src/app/api/sites/[siteId]/save/route.ts` — ensures numeric image IDs are stripped during save retry.
- **M-5 (Minor):** Added intent comment above `useEffect` with `exhaustive-deps` suppression in `src/components/editor/FeatureComparisonFeatureModal.tsx` — documents intentional snapshot-on-open (draft-on-open) pattern.

**Related:** GH-960 (product blocks F05 editor enablement) + GH-962 (F14 shipping). Phase 01 (product variants, UI) and Phase 02 (AI generation, SEO) previously merged.

---

### GH-1023 — Floating Cart Global Visibility & Checkout Auto-sync

**Features:**
- Cart widget, WhatsApp button, and social media blocks now support global scope: auto-injected into all pages regardless of where configured, reducing editor redundancy
- Cart drawer footer always visible (even with empty cart) to reinforce checkout affordance; "Checkout" button disabled when cart is empty
- Global block detection and injection via `applyGlobalSystemBlocks()` in `SiteRenderer`; scans pages for commerce blocks and auto-applies globally if marked `scope: 'global'`
- Block registry exposes scope metadata (`scope`, `scopeTooltip`) for admin UI classification
- Editor UI: 🌐 badge on global-scope blocks in Block Library Panel for visual distinction

**Code changes:**
- New library: `src/lib/site-renderer/` — pure utility functions: `detect-commerce-presence.ts` (scans pages for commerce block types), `extract-first-global-block.ts` (finds first block instance of given type), `has-header-cart.ts` (checks if header navigation includes cart button)
- `src/components/site-renderer/SiteRenderer.tsx` — `applyGlobalSystemBlocks()` extended; `NavPage` type updated with `layout?` + `isHomepage?` metadata
- `src/components/storefront/CartDrawer.tsx` — checkout footer visibility + button disabled state when cart empty
- `src/blocks/types.ts` — `BlockMeta` gains `scope?: 'global'|'page'` + `scopeTooltip?: string`
- Block configs updated (`cart-widget`, `social-widget`, `whatsapp-button`, `navigation`, `footer`): added `scope: 'global'`
- `src/lib/admin/block-registry-reader.ts` — `NormalizedBlock` gains `scope` + `scopeTooltip` fields
- `src/components/editor/BlockLibraryPanel.tsx` — renders 🌐 badge for global-scope blocks

**Benefits:**
- Eliminates manual repetition of global UI elements (cart, contact, social) across pages
- Improves commerce UX by always showing checkout affordance
- Reduces editor cognitive load for multi-page sites

**Non-breaking:**
- Pure enhancement; existing page-scoped blocks remain unchanged. Global blocks are opt-in via config.

---

### GH-962 — Shipping Flat-Rate Configuration (F14) — Phase 1–3

**Phase 1–2 Features (existing):**
- Flat-rate shipping by Malaysian region (West RM 8 / East RM 15 default): sellers configure rates in dashboard, buyers see dynamic fees at checkout
- Three API endpoints: `GET /api/sites/:siteId/shipping-config`, `PATCH /api/sites/:siteId/shipping-config` (authed), `POST /api/orders/calculate-shipping` (public)
- Free shipping threshold: sellers set minimum order amount → shipping = RM 0 when subtotal ≥ threshold; checkout hint "Add RM X more for FREE shipping" (highlight tier when gap ≤ RM 50, neutral >RM 50)
- Live checkout calculation: state selection debounces 300ms, recalc shipping fee without page reload, updates order summary dynamically
- Supports 16 Malaysian states + Labuan territory; postcode validation regex `^\d{5}$` (format only)
- Dashboard settings form: West/East rate inputs (RM 0.00–RM 1,000.00), free shipping toggle + threshold input, Reset to Defaults button

**Phase 3 Pure functions + Component wiring (NEW):**
- `validateRate()` — validates RM input (13 edge cases: empty, negative, over-max, scientific notation, comma/dot decimals, multiple decimals, zero warning)
- `parseRateRm()` — parses comma/dot decimals, trims whitespace, returns null on non-numeric
- `validateCrossField()` — cross-field validation: warns if free threshold below max(westRate, eastRate)
- Form input wiring: `onChange` filter rejects non-numeric, `onBlur` auto-formats to 2 decimals, paste normalization (trim+parse), `aria-invalid`/`aria-describedby` attributes, error paragraphs with `role=alert`

**Code changes (Phase 1–3):**
- Library: `src/lib/shipping/` — `classify-region.ts`, `calculate-fee.ts`, `constants.ts`, plus new `validate-rate.ts`, `parse-rate.ts`, `validate-cross-field.ts` helpers
- API routes: `src/app/api/orders/calculate-shipping/route.ts`, `src/app/api/sites/[siteId]/shipping-config/route.ts`
- Dashboard: `src/app/(dashboard)/settings/shipping/shipping-settings-client.tsx` with form validation wiring, error display, accessibility attributes
- Checkout: `src/app/sites/[slug]/checkout/page.tsx` — state selection triggers debounced calculate-shipping call, live fee update

**Security:**
- PATCH rate validation: boundaries enforced (0 ≤ rate ≤ RM 1,000), tenant member check, cross-tenant 403 guard
- State classification: invalid states rejected at API level (400 INVALID_STATE), fallback to West region
- Body null guard: POST/PATCH return 400 on malformed JSON instead of 500

**Tests (Phase 3 new):**
- Unit: `src/__tests__/unit/dashboard/shipping-rate-validation.test.tsx` — TC-F14.21–F14.38 (13 validateRate edge cases + 5 component wiring tests covering paste, onBlur format, onChange filter, aria attributes)
- Coverage: pure input validation (13 cases), parseRateRm, validateCrossField, form integration (paste handling, blur auto-format, onChange filter, ARIA labeling)

**Non-breaking:**
- Existing `Sites.shippingConfig` schema unchanged; `freeAbove` default = 10000 sen (RM 100)
- Wave 6 scope: self-delivery tracking number = free-text (no carrier API)

**Total tests:** 138 TC-IDs (TC-F14.01–123b) covering calculation, API validation, edge cases, integration, unit validation. All Phase 1–3 tests pass.

---

### GH-899 — Announcement Bar: CTA Link Integration & Content Configuration

**Features:**
- Editor settings panel now exposes all announcement-bar fields: message, CTA link text/URL (external or internal page picker), dismissible toggle, color pickers (BG Color 1 + Color 2 for gradient), vertical padding slider (4–32px)
- Gradient variant now supports independent Color 2 via `backgroundColor2` field
- Vertical padding controlled via internal `paddingY` field (default 12px = py-3)
- Preview renderer correctly branches gradient/solid/minimal variants

**Bug fixes:**
- CTA fields (`linkText`, `linkUrl`) were invisible in SettingsPanel — zero editable fields
- Gradient Color 2 was hardcoded to `CSS_VARS.secondary` — now user-configurable
- Padding slider had no effect (block is FLOATING_BLOCK_TYPE) — replaced with internal paddingY
- Preview HTML renderer always showed solid background regardless of variant

**Security:** HTML-escaped `message`/`linkText` in preview renderer; `rel="noopener noreferrer"` on external CTA links

**Tests:** 16 unit TCs (all pass) in `src/__tests__/unit/blocks/announcement-bar.test.tsx` covering gradient/solid/minimal variants, CTA rendering, padding, and dismissible toggle.

---

### GH-960 — Enable Product Blocks in Editor (F05-08)

**Features:**
- 9 product/commerce blocks now enabled for drag-drop and AI generation in F05 editor: `products-grid`, `products-featured`, `cart-widget`, `menu-food`, `product-quick-view`, `pricing-table`, `menu-display`, `pricing`, `property-card`
- `cart-widget` re-enabled (was hidden since GH-839, checkout ships in v1.1) with "Add to Cart" preview toast in editor
- `menu-display` and `pricing-table` blocks registered in Payload Pages collection (previously absent → silently dropped on save)
- Product blocks marked `aiVisible: true` and re-categorized from archive → commerce/store, enabling AI gen for industry-appropriate industries
- AI system prompt updated with VARIETY RULES 8–10 for industry-specific block recommendations
- Restaurant/food blocks (`menu-food`, `menu-display`) now appear in category recipes for hospitality industry

**Related changes:**
- Migrations: new DB fields for `menu-display` + `pricing-table` block configurations
- Payload schema: registered 2 new blocks in `src/collections/Pages.ts`
- AI pipeline: removed blocks from `unsupported-blocks.ts` (menu-display, property-card) and `template-composer.ts` (property-card)
- Editor registry: removed cartWidget from `EDITOR_HIDDEN_BLOCKS`

**Tests:** 5+ unit TCs covering block visibility, AI generation, and toast behavior. All CI tests pass (lint, type-check).

---

### Added
- **GH-871 Blog Auto-seed on Website Generation (F08)** — when user generates a website, 3 published blog posts are now auto-seeded per tenant using hand-curated seed data. Prevents blog-list block from appearing empty. Ships `src/lib/ai/seed-blog-posts.ts` with `seedBlogPosts()` and `wrapExcerptInLexical()` helpers, integrated into generate-site pipeline. Non-fatal operation; skips if tenant already has posts. Unit tests: `src/__tests__/unit/lib/ai/seed-blog-posts.test.ts` (5 tests, TC-F08-BS.01–05, all pass). Slug collision avoided via tenantId prefix.
- **GH-871+ Blog Seed Thumbnails (F08)** — auto-seeded blog posts now include distinct thumbnail images using 2-tier strategy: Tier A searches Unsplash by blog category; Tier C falls back to gallery pool if search returns no results. Non-fatal per-post; posts created without thumbnail if fetch fails. Extracted shared `src/lib/ai/upload-media.ts::uploadImageUrl()` helper for reuse across product and blog seed flows (DRY refactor). Extended tests: `src/__tests__/unit/lib/ai/seed-blog-posts.test.ts` (9 tests, TC-F08-BS.01–09, all pass).
- **GH-871++ AI-generated Blog Seeds (F08)** — replaced static blog-seed library with GPT-4.1-nano per-business generation. New task entry `'blog-seed'` added to AI config with rate-limits (free 5, starter 20, pro 100, business unlimited). Caller-agnostic: static seeds preserved as fallback on AI failure (quota, timeout, parse error). New module `src/lib/ai/generate-blog-seeds.ts` (85 LOC) exports `generateBlogSeedsAI`, `BlogSeedAI` interface. `seedBlogPosts()` signature extended with optional `industry?: string` param (8th arg, backward-compatible) to plumb raw user industry into AI prompt for better niche-specific output. Image search keyword now sourced from AI `imageKeyword` field when available (vs static category). Within-batch slug de-duplication applied after static fill. Unit tests extended: 19 TC-IDs total (TC-F08-BS.01–18), all pass. Estimated cost ≤ $0.0002 per site-gen (negligible vs existing $0.004 site-gen call). Non-blocking `void` seeder ensures user experience not impacted.
- **GH-864 Page Library UX + Menu Linkage** — Renamed "Page Manager" → "Page Library" (`PageManagerPanel.tsx`); added micro-copy below title; removed search input; introduced `menuPageIds` prop wired via new `src/lib/menu-page-links.ts` (`collectMenuPageIds` pure helper); Live/Draft badge now reflects menu linkage (published + in-menu + site-published → Live, else Draft) wrapped in Radix Tooltip; `data-coach` anchors on Page Library and Menu Settings panels; 2-step `EditorCoachMarks` overlay for first-time users (localStorage flag `editor:coach-marks:v1:seen`, ESC/backdrop/skip/finish dismiss). i18n keys added in `en.json`/`ms.json`. Unit tests: 49 tests across 4 files (TC-F05-02-13..16).
- **F30 Hero Media Overlay (GH-12)** — inline hover overlay for hero blocks enabling live image/video swap without leaving the site renderer. Ships `src/lib/media/compress-image.ts` (canvas-based client compression: 1920px, 2MB cap, WebP 0.85), `src/components/site-renderer/BlockEditCallbackContext.tsx` (React context wiring `blockIndex` + `onFieldChange`), and `src/blocks/hero/hero-media-overlay.tsx` ("Change Image" + optional "Change Video" buttons, file-type validation, upload via `uploadMediaAction`, `VideoInputPopover` for URL entry, `positionClass` prop for background-image variants). Wired into 6 hero variants: split, magazine, cards-overlay, slideshow, video, split-video. QA doc `docs/qa/F30-hero-media-overlay.md` (10 TC-IDs); unit tests `src/__tests__/unit/blocks/hero-media-overlay.test.tsx` (9 tests, all pass). Branch: `fix/F05-12-image-upload-ai-gen`.

### Fix
- **GH-935 Variant Form Clarity & Validation** — redesigned product variant tier input UX with improved labeling ("Option N (Example: ...)" replaces ambiguous "Tier N"), inline validation (required indicators, duplicate-value detection per-tier), and corrected button labels ("Generate variants" vs "Create SKU Table", "Add values" vs "Add option"). Generate button now gated when any tier lacks a name or has no values or contains duplicates, preventing malformed variant matrices. i18n updates to `en.json` and `ms.json`. Changes: `src/components/dashboard/product-form/VariantsInventorySection.tsx`, `src/components/dashboard/product-form/schema.ts`.
- **GH-103 Attributes Dashboard UI (F08-06)** — added "Thông tin Mở rộng (Attributes)" section to product create/edit form with dynamic key/value rows (max 20, `useFieldArray`), inline validation, dark theme support, and correct load/save mapping to Payload `attributes` array. Server-side constraints: `key: maxLength 100`, `value: maxLength 500`. i18n support added (`en.json`, `ms.json`). Component: `src/components/product-form/attributes-section.tsx`.
- **GH-737**: Heading and body font selections now apply correctly in storefront preview — `fontNameToCSSVar` reordered to put literal font name first (resolves AppShell scope limitation); added missing `body` key to Tailwind `fontFamily` config so `font-body` utility generates a CSS rule
- **GH-12 Hero Block PRD Gap Fixes** — resolved 11 compliance gaps in `src/blocks/hero/`: fixed gradient PRM duplicate div bug (C1), added prefers-reduced-motion to split-video (C2), wired overlayOpacity in cards-overlay (C3), added split-right column reversal (I1), removed dead `height`/`overlay` config fields (I2, I3), added Framer Motion scroll parallax to magazine image (I4), optimized slideshow to render current+next only (I5), fixed minimal CTA to use RichText (I6), suppressed video autoplay on mobile (I7), replaced fullscreen py-32 with HERO_MIN_HEIGHT constant (I8)

### Added
- feat(ci): auto re-seed templates + drift/harness gate on CI (plan 260419-2022)
- feat(admin): `/dashboard/templates-health` drift dashboard (super-admin) — re-seed + harness buttons, per-template drift badges (plan 260419-2022 phase 04)
- feat(templates): stamp `blockSchemaVersion` sha256 on seed — enables per-row staleness detection via `scanDbTemplates` (plan 260419-2022 phase 05)
- ClaudeKit rules + docs refactor (2026-04-19): split `CLAUDE.md` 296→113 lines, created 8 `.claude/rules/*.md` (database-schema, vercel-deploy, env-vars, git-flow, testing, email-smtp, workflow, orchestration), seeded 6 canonical `docs/*.md`

### Pending
- v1.0 stabilization (staging /admin 404, SSO JWT mismatch, AI gen JSON parse intermittent)
- Key rotation (DO Spaces + Unsplash — leaked 2026-04-15)
- Production S3 bucket + prod credentials

---

## 2026-04-17 → 2026-04-19 — Wave 1 / Wave 2 Wix-parity polish

**Focus:** F01 AI Builder robustness + F05 AI Editor publish correctness.

- **F01:** Wave 1 completion (#698), wave 2 Wix-detailed (#697), template-first-gen (#680, #682), variant wiring demo (#683, #685), register industry blocks (#686), subpage polish (#687), pipeline + block-quality fixes (#684), old templates fix (#688)
- **F05:** Publish block-id collision fix (#694), publish validation error surface (#693), update-page-draft bug fix (#692), merge drag buttons bug (#691), AI editor improvements (#689), 404 page rendering fix (#677), unhide-page 500 (#678), inline AI chat lost fix (#673), hidden page still live (#676), empty block data (#669), publish new pages (#670)

Journal: `plans/260418-1740-wave2-continuation-harness-cleanup/`, `plans/260418-2358-wave1-completion/`.

---

## 2026-04-15 — 500 Fix Campaign

**Outcome:** 450 → < 10 errors/day. 8 bugs, 6 PRs.

Key modules patched:
- `pages-schema` — draft/published collision
- `site-type` detection — missing industry fallback
- `payload-retry` — transient DB timeout handling
- `post-ai-swap` — block reference integrity
- `stripOrphanMediaRefs` — hanging media pointers after block deletion

Full post-mortem: `docs/journals/260415-500-fix-campaign-and-ai-gen-v2.md`.

---

## 2026-04-13 → 2026-04-14 — Vercel CI-driven deploy

**Problem:** Vercel Pro blocked commits from non-team-members ("The Deployment was blocked because the commit author does not have contributing access"). Team has 1 member (phuongltweb) — inviting more = $20/seat/mo.

**Fix:** Switch from Vercel git webhook → GitHub Actions CI using `VERCEL_TOKEN` (token owner = team member). All deploys now attributed to phuongltweb, bypassing author check.

PRs: #559 (disable webhook), #560 (CI deploy scaffold), #562 (staging target fix), #565 (env pull scoping), #567 (alias rollover verification), #569 (smart-notify integration).

Plan: `plans/260413-1126-vercel-deploy-blocked/`.
Journal: `docs/journals/260414-ai-gen-flow-overview.md`, `docs/journals/260414-session-ai-gen-deep-dive.md`.

---

## 2026-04-12 — DigitalOcean → Vercel migration

Retired DigitalOcean App Platform (ech-prime-web v1). All runtime + bot moved to Vercel. Legacy files (`Dockerfile`, `.github/scripts/sync-do-envs.py`) retained for reference; `Dockerfile` still used for local `docker-compose` dev.

---

## 2026-03-29 (PR #364 – #374) — Test infra + DB stability sprint

### Added
- Fix missing FK columns + auto-sync rels tables (#364)
- SMTP migration: Resend → Payload SMTP via AWS SES (#365)
- Smoke tests + Quality Metrics + Env sync fix (#366)
- 12 missing DB tables + CI table check (#367)
- Git flow docs + AGENTS.md + Security scan + Codex setup (#368)
- `products_rels` table (#369)
- Locale validation (AI Builder) (#370)
- Unit test count parsing fix (#371)
- `docs/TEST_CONVENTION.md` (#372)
- 26 Pages block tables + block columns (#373)
- ALTER TABLE fallbacks for all array tables (#374)

---

## 2026-03-26 → 2026-03-31 — Sprint 1 (Crash Launch)

**Outcome:** Core USP + CMS + Auth + Commerce shipped; Phase 1 launch 2026-03-31 → extended to 2026-04-14 for stabilization.

Feature waves:
- **2026-03-26 → 28:** F01 (AI Builder), F05 (AI Editor), F11 (SEO), F12 (Undo/Redo), F18 (CMS Layout), F02 (Auth), F06 (Onboarding)
- **2026-03-29 → 30:** F19 (Store Config), F08 (Products), F09 (Storefront), F10 (Orders), F21 (Localization), F20 (Analytics)
- **2026-03-31:** F17 (Blog), F03 (Dashboard), F07 (Templates), F16 (Notifications) — best-effort

---

## 2026-03-13 → 2026-03-25 — Sprint 0 (Foundation)

**Outcome:** Backend APIs, CI/CD green, test infrastructure, Figma design alignment.

- GitHub Actions pipeline (`ci.yml`): quality → test → deploy
- Vitest + React Testing Library + Playwright E2E
- Payload CMS 3 + Drizzle + Neon Postgres schema
- Lark bot integration (`prime-bot-assistant`) for CI notifications
- DigitalOcean App Platform initial deploy (retired 2026-04-12)

v1.0 kickoff: commit `6c06d015` (2026-03-13 15:58).

---

## Related docs

- Full merged PR list: `git log main --since=2026-03-13 --merges --oneline`
- Per-feature architecture changes: `docs/architecture/F*.md`
- Strategic decisions + post-mortems: `docs/journals/`
- Timeline + priority: `docs/PROJECT_ALIGNMENT.md`
- Open blockers: `docs/tracking/OPEN_BLOCKERS.md`
