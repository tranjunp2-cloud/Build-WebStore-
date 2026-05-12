---
owner: Dev
last_updated: 2026-05-07
---

# Project Changelog

Curated per-release notes. Seeded 2026-04-19 from v1.0 kickoff (commit `6c06d015`, 2026-03-13) through 2026-04-19. Maintained per-release going forward — see `docs/PROJECT_ALIGNMENT.md` for priorities.

Source: `git log main --since=2026-03-13 --merges --first-parent` (~370 merges, filtered to `feat:` + `fix:` only).

For full architectural decisions + incident post-mortems: see `docs/journals/`.

---

## [Unreleased] — Staging

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
