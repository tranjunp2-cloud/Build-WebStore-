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

- ⚠️ **Technical Health signals measurement (US-F37-04 blocker)** — Phase 05 hardcoded assume-passing values for 3 signals: coreWebVitals (80), mobileResponsive (true), httpsEnabled (true). No real Lighthouse/CWV measurement infrastructure. Flagged for PM decision before US-F37-04 dashboard ships: (1) keep hardcoding (status quo, no cost but overstates score), (2) implement real Lighthouse measurement (adds dependency, accurate), (3) apply PRD §13.8 "earned/applicable" normalization (reweight buckets per-site). See `docs/architecture/F37-local-seo.md` § "Known limitation" for full context.

## Phase 2 (v1.1) prerequisites

- [ ] v1.0 staging stable (< 10 errors/day sustained for 7 days)
- [ ] Coverage baseline measured + catch-up plan if < 70%
- [ ] Stripe production credentials provisioned
- [ ] MY shipping partner API access confirmed

## Related

- Timeline + priority: `docs/PROJECT_ALIGNMENT.md`
- Changelog: `docs/CHANGELOG.md`
- GitHub milestones: [v1.0](https://github.com/primeproduction/ech-prime-web-v2/milestone/8), [v1.1](https://github.com/primeproduction/ech-prime-web-v2/milestone/9)
