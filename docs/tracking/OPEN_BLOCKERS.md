---
owner: PM
last_updated: 2026-07-02
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

- [ ] **F37-03 TC-ID registry** — US-F37-03 "AI Crawler Permissions & llms.txt" uses provisional TC-F37-03-01 through 46 test IDs. QC must create `docs/qa/F37-local-seo.md` and backfill official TC-IDs before next sprint (46 tests all passing, ready for registry). Start with acceptance criteria from `docs/stories/F37-local-seo-stories.md` US-F37-03 as scaffold.
- [ ] **F37-03 multi-site disambiguation** — `Sites.ts` schema explicitly allows "one or more websites" per tenant with no unique constraint on `sites.tenant`; the `robots.txt`/`llms.txt` site lookup now sorts by `createdAt` for determinism (fixed 2026-07-09), but still isn't the *correct* site if a tenant genuinely runs 2+ published sites — `aiCrawlersEnabled` is a per-site opt-out while the route resolves per-tenant, so one site's compliance opt-out could silently not apply if a sibling site is picked. **Confirmed with PM (2026-07-09): no current product flow creates 2+ published sites per tenant** — so this is not reachable today, but it's a best-effort mitigation, not a guarantee, given the schema permits it. Revisit with a real domain-based per-site resolution across all 3 routes (`robots.txt`, `llms.txt`, `sitemap.xml` — same latent pattern) if/when multi-site-per-tenant becomes supported. Found during adversarial review, deferred (not a regression from this PR).
- [ ] **F37-03 feature-guard tenant mismatch** — `ai-crawlers-toggle` (and sibling `auto-meta-toggle`) ownership check accepts any tenant in the user's full list, while `withFeatureGuard` only validates entitlement against `tenants[0]` — a user with multiple tenants could bypass the plan-entitlement gate for a tenant that lacks it. **Confirmed with PM (2026-07-09): current product reality is 1 tenant per user** — no DB/app constraint enforces this, but the multi-tenant-per-user scenario isn't actively exploitable today. Low priority; revisit if/when multi-tenant-per-user becomes a supported configuration (needs a coordinated fix across both toggle routes, or the shared guard, at that point). Found during adversarial review, deferred (pre-existing in `auto-meta-toggle`, not new to this PR).
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
