---
owner: PM
last_updated: 2026-07-30
---

# Open Blockers

Active blockers across v1.0 stabilization and v1.1 prep. Update weekly (every Friday PM sync) or after any incident is resolved.

Source of truth: Lark `[PrimeWeb - V2] — CI/CD` + GitHub issues labelled `P0`.

## Security / Secrets

- 🔐 **Key rotation pending** — DO Spaces + Unsplash keys leaked in session history 2026-04-15 (`S3_ACCESS_KEY_ID=YGVGOA5T...`, `S3_SECRET_ACCESS_KEY=yh7QWHOD...`, `UNSPLASH_ACCESS_KEY=u65JQqw-...`). Rotate before prod launch.
- 🔐 **Production S3 setup** — Create `tm-prime-web-prod` bucket on DO Spaces, generate prod-only credentials, apply public-read policy. See `.claude/rules/env-vars.md` for Vercel add procedure.

## Runtime bugs (staging)

- 🐛 **SSO JWT mismatch** — `/api/v1/sso/provision` logs `signature verification failed`; JWT secret mismatch with `web-cms-v2.dev.ecommercehub.my`.
- 🐛 **AI gen JSON parse intermittent** — `[AI] OpenAI generation failed: 400 We could not parse JSON body`. Prompt format bug; falls back to legacy `generateBlocks`.
- 🐛 **Structure Enforcer gap** — `no library content for required "client-logos"` — seed data missing logos for recipe `biz-proof`.
- ⚠️ **Staging /admin 404** — Server HTML correct but client-side fails.

## Infrastructure

- ⚠️ **Missing Vercel secrets** — Stripe, Lark, ECH credentials not yet added to Vercel Production scope. S3 added 2026-04-15.
- ⚠️ **Coverage below target** — `docs/TEST_CONVENTION.md` deadline 2026-04-15 passed. Targets raised to 70/70/70 on 2026-04-19. Catch-up sprint pending.

## QC test environment (isolated `qc-test`)

Plan: `plans/260702-1719-qc-test-env-setup/`. Code + docs landed 2026-07-02;
the external items below block QC handover.

- [ ] Neon project `ech-prime-web-v2-qc-test` created (Singapore region, Free tier) + schema migrated via `db-setup.js` (Phase 01)
- [ ] Vercel custom env `qc-test` scope created + env vars set (DATABASE_URI etc.) (Phase 02 Step 1-2)
- [ ] Git branch `qc-test` pushed + branch protection applied per `.github/branch-protection.md` (Phase 02 Step 3, 5)
- [ ] 1Password vault "PrimeWeb QC" created + members added (Phase 04 Step 4)
- [ ] Custom domain `qc-test.web-v2.dev.ecommercehub.my` decision — custom vs Vercel URL (Phase 02 Step 7)
- [ ] QC lead confirms ownership + added to vault + `qc-test` push permission (Phase 05 handover)
- [ ] End-to-end smoke test: JMeter 100 req/s for 5 min against QC → staging metrics unaffected (Phase 05 Step 6)

## F35 — Webstore template migrate (9 V1 templates → Payload)

- 🚧 **Block config gaps block data load** — [#1188](https://github.com/primeproduction/ech-prime-web-v2/issues/1188) (`P0`). V2 thiếu cấu hình để tái tạo UI 9 template V1; KHÔNG đổ data tới khi xong. Hai gap:
  - **GAP-1 `hero`** — có carousel (`slideshow` + `images[]`) nhưng slide chỉ là ảnh "câm"; cần `slides[]` với `title/subtitle/button/alignment` per-slide + `autoRotate`/`rotateInterval`.
  - **GAP-2 `products-grid`** — không có filter/sort; cần group `filterConfig` (enableFilter + brand/category/price/variant + enableSort + sortDefault).
  - Handover doc: `plans/260611-1131-migrate-template/dev-handover-v2-block-gaps.md`. Unblock = cả 2 gap merge staging + verify editor → mở khoá Transform/Load.
- 🚧 **Scope mở rộng Tier 0 + Tier 1** — epic [#1194](https://github.com/primeproduction/ech-prime-web-v2/issues/1194). Tier 1 (brand-identity, BẮT BUỘC đợt này): #1195 (store info) · #1196 (typography) · #1197 (mega-menu) · #1198 (footer) · #1199 (header toggle). Tier 2 hoãn (V2.1/V2.2, default ON). Đối chiếu: `plans/260611-1131-migrate-template/blocker-vs-spec-reconciliation.md`.

## F37 (US-01) — Local Business Data Model

- ⚠️ **SEO Health score rewire (US-F37-04)** — replace the legacy F37 engine with the approved 20/35/15/30 scorecard, then replace existing `SeoHealth` contents with the single unified score + max 3 actions. See F37 PRD §5 and §12.3.

## QC test backfill (post-merge)

- [x] **F37-03 TC-ID registry resolved (2026-07-30)** — `docs/qa/F37-local-seo.md` now owns unique `TC-F37-03-01..52` mappings for route, middleware, Dashboard, Playwright project configuration, documentation, and advertised-link regression coverage. Shared workflows remain unchanged; `/api/users/me?include=site-status` returns hydrated active tenants plus their minimal site-status summary so fixture selection is independent of the public endpoints under test. A single-site account-backed local run passed setup plus TC-28 and TC-29 with guarded status-only state changes verified and restored on 2026-07-31; TC-52 awaits an active custom domain, and authenticated TC-30 remains pending. Exact 9/5/1 score evidence remains with #1312.
- [ ] **F37-03 multi-site disambiguation** — `Sites.ts` permits multiple sites per tenant without a unique constraint. Sitemap and llms select the oldest published site deterministically, but a tenant with 2+ published sites still needs host/domain-to-site resolution rather than a tenant-first fallback; robots intentionally applies tenant-level crawler policy and does not select a site. **Confirmed with PM (2026-07-09): no current product flow creates 2+ published sites per tenant.** Revisit if multi-site-per-tenant becomes supported; this is deferred and not a regression from F37-03.
- [ ] **Auto-meta feature-guard tenant mismatch (outside F37-03)** — the retired `ai-crawlers-toggle` route no longer exists. Its sibling `auto-meta-toggle` still checks ownership against any user tenant while `withFeatureGuard` validates entitlement against `tenants[0]`. **Confirmed with PM (2026-07-09): current product reality is one tenant per user.** Track this shared/multi-tenant entitlement gap with the auto-meta owner if multi-tenant-per-user becomes supported; it is not part of the platform-managed crawler contract.
- [ ] **GH-1519 TC-ID registry** — PR #1580 (API HTTP-status fixes for load test) uses provisional TC-GH1519-01 through 05 test IDs (all passing, ready for registry). These span 4 features so no single `docs/qa/F*.md` fits — QC to backfill official TC-IDs into the matching F-files before next sprint:
  - **TC-GH1519-01** → `src/__tests__/unit/api/is-not-found-error.test.ts` — `isNotFoundError` NotFound-detection pure function (name `NotFound`/`NotFoundError`, `status:404`, anchored `^not found$` message; rejects ValidationError/generic → stays 500).
  - **TC-GH1519-02** → `src/__tests__/api/notifications.test.ts` → **F16 notification-center** — `GET /api/notifications` status contract: missing/valid/epoch `since` → 200; unparseable/malformed `since` → 400; non-numeric `limit`/`offset` → 200 (clamp, not 500); Payload NotFound / `status:404` → 404.
  - **TC-GH1519-03** → `src/__tests__/api/templates-preview.test.ts` → **F07 template-gallery** — `GET /api/templates/preview` status contract: missing `id` → 400; valid → 200 HTML; non-existent id / Payload NotFound → 404 (was 500).
  - **TC-GH1519-04** → `src/__tests__/api/pages-patch.test.ts` → **F04/F05 builder** — NotFound detection for `PATCH /api/sites/:siteId/pages/:pageId`: NotFound/NotFoundError/`status:404` → 404 (keeps `failures[]` envelope); non-NotFound/ValidationError → 500.
  - **TC-GH1519-05** → `src/__tests__/api/domain-primary.test.ts` → **F19 store-configuration** — `GET /api/domain-primary` status contract: missing/empty `host` → 400 with `error` key; valid host / no-primary / non-existent domain / Payload error (failsafe) → 200.

## Phase 2 (v1.1) prerequisites

- [ ] v1.0 staging stable (< 10 errors/day sustained for 7 days)
- [ ] Coverage baseline measured + catch-up plan if < 70%
- [ ] Stripe production credentials provisioned
- [ ] MY shipping partner API access confirmed

## Related

- Timeline + priority: `docs/PROJECT_ALIGNMENT.md`
- Changelog: `docs/CHANGELOG.md`
- GitHub milestones: [v1.0](https://github.com/primeproduction/ech-prime-web-v2/milestone/8), [v1.1](https://github.com/primeproduction/ech-prime-web-v2/milestone/9)
