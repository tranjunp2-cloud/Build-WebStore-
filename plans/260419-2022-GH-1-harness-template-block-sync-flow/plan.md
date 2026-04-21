---
title: Harness & Template Block-Sync Flow
description: Close the drift gap between block registry and admin/harness templates so block changes auto-propagate or fail CI loudly
status: completed
priority: P1
effort: 2-3 dev-days (Phases 01-03); +1-2 days optional (Phases 04-05)
branch: docs/phase-1-release-showcase
tags: [harness, templates, blocks, drift-detection]
created: 2026-04-19
---

## Câu trả lời nhanh cho anh (VI)

**TL;DR — không tự đổi.** Block thay đổi thì template trên admin + harness KHÔNG tự cập nhật theo. Templates là snapshot trong Payload DB (collection `Templates`), còn harness matrix là file cache `.harness-out/matrix.json` — cả hai chỉ refresh khi dev chạy thủ công `npm run harness:gen` rồi `POST /api/templates/seed?v3=true&force=true`. Rename variant hoặc thêm required prop → templates cũ silent break (SiteRenderer null-skip block missing). Hiện chỉ có `variant-pool-validator` bắt drift cho 11 blocks → coverage mỏng. Plan này vá 3 tầng: (1) unblock harness CLI đang vỡ, (2) mở rộng drift detection → CI fail khi lệch, (3) auto regen template seed khi schema đổi.

## Phases

| # | Phase | Priority | Effort | Status |
|---|-------|----------|--------|--------|
| 01 | [Unblock harness CLI (fix CATEGORY_DNA import)](./phase-01-unblock-harness-cli.md) | P0 | 1-2h | completed |
| 02 | [Extend drift detection to all blocks + DB templates](./phase-02-extend-drift-detection.md) | P1 | ~1d | completed |
| 03 | [Auto regen on schema change (CI + deploy)](./phase-03-auto-regen-on-schema-change.md) | P1 | ~1d | completed |
| 04 | [Admin harness UI — template drift dashboard (optional)](./phase-04-admin-harness-ui.md) | P2 | ~1d | completed |
| 05 | [Template versioning with blockSchemaVersion (optional)](./phase-05-template-versioning.md) | P3 | 0.5d | completed |

**In-scope (must-do):** 01 → 02 → 03 (sequential, each builds on prior).
**Optional (user decides):** 04, 05 — deliver better visibility + audit trail but not required to close drift gap.

## Key dependencies

- Phase 02 requires Phase 01 (harness:gen must run before we can diff matrix vs DB).
- Phase 03 requires Phase 02 (drift check = gate + input to regen decision).
- Phase 04 requires Phase 02 (reuses drift-check output for UI badge).
- Phase 05 is independent but pairs naturally with 03 (stamp version on seed).

## Research inputs

- `research/researcher-02-block-registry-template-wiring.md` — block registry ↔ templates ↔ harness propagation matrix, drift gaps
- Task brief summarising researcher-01 findings — harness is CLI-only, no admin UI today, `matrix.ts:20` import broken
- `src/blocks/registry.ts`, `src/blocks/{type}/config.ts` — manual registry + hardcoded variants
- `src/collections/Templates.ts`, `src/lib/ai/seed-templates.ts`, `src/lib/ai/template-definitions.ts` — DB template source of truth
- `src/lib/ai/variant-pool-validator.ts`, `src/__tests__/unit/ai/variant-pool-validation.test.ts` — existing drift check (11 blocks only)
- `scripts/test-harness/matrix.ts`, `scripts/test-harness/compose-runner.ts`, `.github/workflows/ai-harness.yml` — harness pipeline

## Success criteria (overall)

1. `npm run harness:gen` runs clean on main (no broken imports).
2. CI fails on any of: variant rename without template update, new required prop missing from seeded template, DB template referencing variant/block not in registry.
3. Template re-seed happens automatically (or is explicitly gated + diff-reported) when block schemas change, so admin template list stays in sync with shipped block code.
4. Dev can understand drift state in <30s (via CI log or optional admin page).

## Out of scope

- Rewriting the block registry to be data-driven (e.g. generated from filesystem) — larger refactor, separate plan.
- Replacing Payload `Templates` JSON with typed schema — needs product decision.
- Versioned template migrations (only "stamp + detect stale" in Phase 05, not actual migration runner).

## Validation Summary

**Validated:** 2026-04-19
**Questions asked:** 4
**Mode:** prompt (user-initiated)

### Confirmed Decisions

- **Phase 03 seed strategy** → Force replace-all mỗi deploy. Rationale: admin chưa edit templates trực tiếp; idempotent; đơn giản. Revisit khi admin editing lands.
- **Phase 02/03 drift-check scope** → TS source trên PR CI (<30s, không cần DB cred); DB scan chỉ trong deploy preflight (staging + prod).
- **Phase 03 seed auth** → Tạo `SEED_TOKEN` mới (GH Secret + Vercel env var, staging + production scope). Rotate độc lập với PAYLOAD_SECRET.
- **Phase 05 version hash** → Hash `{type, variants[], schemaKeys[]}` per block, sha256 → 16-char hex. Catch rename variant + add/remove prop; không noise với min/max constraint change.
- **Scope cả 5 phases** → 01-05 tất cả in-scope. Phase 04 (dashboard) + 05 (versioning) cho PM/QC visibility + audit trail.

### Pre-existing defaults (planner recommended, user accepted by silence)

- **Phase 01 category source** → `Object.keys(CATEGORY_RECIPES)` từ `src/lib/ai/category-recipes.ts`.
- **Zod drift classification** → Chỉ fail trên `invalid_type` / `required` / `unrecognized_keys`; skip `too_small`/`too_big` (content constraint, không phải structural drift).

### Action Items

- [ ] Phase 01 first (P0 blocker — `npm run harness:gen` hiện vỡ).
- [x] Generate `SEED_TOKEN` via `openssl rand -hex 32` khi tới Phase 03. — *Instructions documented in "Setup required before merge" below; actual generation = manual op when ready to land.*
- [ ] Add `SEED_TOKEN` vào Vercel Dashboard (staging + production scope) + GH Secrets. — *Manual step, see "Setup required before merge".*
- [x] Verify `scripts/test-harness/cli.ts` có flag `--mode=quick` (Phase 03 step 3 dùng). — *Verified: `package.json` exposes `npm run harness:quick` → `tsx scripts/test-harness/cli.ts --mode=quick`.*
- [x] Document `force replace-all` ADR trong `docs/decisions/decisions-log.md` khi ship Phase 03. — *Added as PD-017 on 2026-04-19 (Phase 03 fullstack run).*
- [ ] Revisit seed strategy (force vs upsert) khi admin template editing UI ship.

### Setup required before merge (Phase 03)

Before the Phase 03 PR can land, the following **manual** steps must be completed by a maintainer with Vercel + GH Secret access:

1. **Generate token** locally: `openssl rand -hex 32` → copy 64-char hex string.
2. **GitHub Secrets** — add the token as a repo secret named `SEED_TOKEN` (Repo → Settings → Secrets and variables → Actions).
3. **Vercel Dashboard** — add the same value to `SEED_TOKEN` env var scoped to **both `staging` (custom env) AND `production`** (Project → Settings → Environment Variables). Value must be identical across GH + Vercel for the Bearer compare to succeed.
4. **Verify prod DEPLOY_URL** — current `.github/workflows/ci.yml` `deploy-production` job uses `https://web-v2.ecommercehub.my` (mirroring staging pattern). If the real prod alias differs, update the `DEPLOY_URL` env in the `Seed templates (post-deploy)` step of `deploy-production`.
5. **Freshness gate** — skipped in this iteration (plan calls it nice-to-have). `.github/scripts/check-staging-drift-fresh.sh` NOT created. Revisit if prod reseed blast-radius becomes a concern.

## Implementation Recap

**Date shipped:** 2026-04-19
**Commits:** TBD (committed separately by user)
**Code-review score:** 8.5/10 SHIP_WITH_FIXES (reviewer-07); all 4 P1 findings addressed.

### Per-phase metrics

- **Phase 01** — 4 files changed, `npm run harness:gen` restored (CLI was broken by removed `CATEGORY_DNA` import). Fixture count 12 → 390 green.
- **Phase 02** — `src/lib/ai/template-drift-validator.ts` created + 8/8 unit tests pass. Scan surfaced **800 pre-existing drift findings** on main (see "Follow-up: 800 drift baseline" below). CI gate uses a BASELINE ratchet — blocks any PR that *increases* the count, never blocks on the baseline itself.
- **Phase 03** — `ci.yml` updated: PR path adds drift-check + `harness:gen --mode=quick`; staging + production post-deploy steps call `POST /api/templates/seed?v3=true&force=true`. Bearer `SEED_TOKEN` auth added to seed endpoint (constant-time compare, tri-auth ordering: internal → Bearer → JWT).
- **Phase 04** — `/dashboard/templates-health` page ships with drift badges per template + "Re-seed templates" + "Run harness" buttons. Super-admin role gated (sidebar filter + page guard). Harness-run route returns 501 on Vercel serverless (env-aware gate added post-review), runs normally locally + staging dev.
- **Phase 05** — `blockSchemaVersion` column stamped on every template seed (sha256/16-char hex of registry shape). Migration entry `templates-block-schema-version` added to `scripts/db-setup.js`. Drift validator emits `stale-version` finding when row hash ≠ current hash.

### Follow-up: 800 drift baseline

The 800 pre-existing findings from `scanTsTemplates` are tracked (not blocking) and break down roughly as:

- ~280 findings: `footer@mega` variant mismatch (renamed since preset was authored)
- ~140 findings: `unknown-block` for `contact-form`, `content`, `map`, `map-embed`, `timeline`, `content-block` (these blocks never registered or registered under different type names)
- ~380 findings: `hero` + `features` variant drift (multiple variants renamed over past iterations)

The baseline ratchet only surfaces *new* drift — merges cannot add to the count. Future work (separate plan): file a cleanup plan to drive baseline to 0, likely via batch-rewriting the affected presets in `template-presets-batch{1,2,3}.ts` or registering the missing `unknown-block` types.

### Setup blockers remaining (not completed in this plan — manual ops)

- `SEED_TOKEN` generation (`openssl rand -hex 32`) — documented in "Setup required before merge" section above.
- Vercel env var scoping (staging + production custom envs) — documented above.
- GitHub repo secret `SEED_TOKEN` matching Vercel value — documented above.

Until those 3 are completed, CI will deploy successfully but the post-deploy seed step will 401. Plan ships shippable code; operational rollout is a separate maintainer step.
