# Code Review — ClaudeKit Rules + Docs Refactor

## Summary

Refactor is structurally sound: `CLAUDE.md` 296→113 lines, 8 rule files + 6 canonical docs, all YAML frontmatter parses, owner fields correct per spec. Fact preservation from original is ~100% for the 5 anchor facts — each lives in exactly one authoritative file (rule) + one pointer (CLAUDE.md overrides block). Critical blocker: `docs/codebase-summary.md` hallucinates several paths that don't exist in the repo (`src/lib/stripe/`, `src/lib/storage/`, `src/store/builder-store.ts`, `src/app/(admin)/`, `src/app/(site)/`, `/api/v1/**` API surface). Since this doc is meant to be the authoritative orientation map for future AI agents, the drift will mislead new agents and must be corrected before merge. All 5 anchor duplicate-fact checks pass. All referenced files (except one pre-existing stale plan link) resolve.

## Critical (blockers)

1. **`docs/codebase-summary.md` contains multiple false paths (hallucination).** Fix before merge — this is an authoritative map.
   - Line 27 `src/lib/stripe/` — actual path is `src/lib/payment/` (stripe.ts lives there).
   - Line 28 `src/lib/storage/` — does not exist. S3 upload code lives in `src/lib/images/` / via `payload.config.ts` S3 plugin.
   - Line 44 `src/app/(admin)/page.tsx` — no `(admin)` route group. Actual groups: `(auth)`, `(builder)`, `(dashboard)`, `(editor)`, `(frontend)`, `(payload)`, `(preview)`.
   - Line 45 `src/app/(site)/[...slug]/page.tsx` — no `(site)` route group. Storefront rendering entry is `src/app/sites/[slug]/[[...path]]/page.tsx`.
   - Line 46 `src/app/api/v1/**` — only `src/app/api/v1/sso/` exists under v1. All other ~30 API routes are directly under `src/app/api/*` (e.g. `src/app/api/products/`, `src/app/api/orders/`). Architecture doc claim at `docs/system-architecture.md:24` (`src/app/api/v1/**`) has the same bug.
   - Line 64 `src/store/builder-store.ts` — actual file is `src/store/builderStore.ts` (camelCase). Stores listed (`builder-store`, `auth-store`) include a non-existent `auth-store`. Real stores: `builderStore`, `cartStore`, `editorStore`, `notificationStore`.

2. **`docs/code-standards.md` §API Design endorses `/api/v1/*` versioning** (line 71) which contradicts the actual repo (only 1 v1 route). Either document reality, or note v1 as an aspirational standard with current migration status.

## Major (should fix)

1. **Stale plan reference `plans/260413-1126-vercel-deploy-blocked/`** appears in both `CLAUDE.md:91` and `.claude/rules/vercel-deploy.md:58`. Plan dir never existed in git history. Pre-existing in original CLAUDE.md — refactor preserved rather than cleaned up. Either create the plan dir retroactively or remove references.

2. **`.env*` glob redundancy in `env-vars.md` frontmatter.** Line 6 has `.env*` which already matches `.env.example`, `.env.staging.example`, `.env.production.example` — redundant explicit entries on lines 8-10.

3. **`env-vars.md` internal duplicate of "GitHub Secrets only for..." rule** — appears verbatim on line 14 and line 77. One should become a cross-reference.

4. **`sync-do-envs.py` description drift.** `env-vars.md:32` says "Will remove in cleanup PR" but the file was already deleted from `.github/scripts/` (only `collect-metrics.js`, `generate-changelog.js`, `parse-stories.js` remain). Update to past tense or remove the sentence.

5. **Coverage target fact drift.** `testing.md:31-34` states 70/70/70 (raised 2026-04-19) but `docs/TEST_CONVENTION.md` (authoritative per frontmatter path reference) was not verified. If TEST_CONVENTION still says 60/50/50, two sources disagree. Run `grep -n "coverage" docs/TEST_CONVENTION.md` before merge.

## Minor (nice-to-have)

1. **CLAUDE.md §"Key files" (lines 77-91) duplicates the files already referenced across rule frontmatter.** Fine as an at-a-glance table but adds maintenance burden when rules drift. Consider trimming.

2. **`orchestration.md` delegation template hardcodes user-specific absolute path `/Users/ngotuannhan/Claude Code/...`** (lines 29-31). Portability concern — other teammates on other machines would copy this wrong.

3. **`docs/codebase-summary.md:44-47` "Entry points" table** should probably live closer to "Top-level structure" or be labeled "Key entrypoints — verify against `src/app/` before relying".

4. **`workflow.md` uses `/ck:fix --auto`** (line 35) and other `/ck:` commands without asserting they exist in this project's skill catalog. If a reader doesn't have ClaudeKit installed, these are dead references. Add a note linking to ClaudeKit install guide.

## Duplicate-fact grep results

In-scope files only (CLAUDE.md + `.claude/rules/*.md` + 6 canonical docs):

| Anchor | Files | Verdict |
|--------|-------|---------|
| `git.deploymentEnabled` | 2 (CLAUDE.md pointer + vercel-deploy.md authoritative) | PASS |
| `VERCEL_TOKEN` | 6 (CLAUDE.md pointer + vercel-deploy.md + env-vars.md + system-architecture.md CLI example + development-roadmap.md history + project-changelog.md narrative) | PASS — all distinct context, not duplication |
| `commitlint` | 2 (CLAUDE.md pointer + git-flow.md authoritative) | PASS |
| `_parent_id` | 2 (CLAUDE.md pointer + database-schema.md authoritative) | PASS |
| `Relates to #N` | 2 (CLAUDE.md pointer + git-flow.md authoritative) | PASS |

## Fact-loss audit

Compared `git show HEAD:CLAUDE.md` (296 lines) vs current set. All 10 top-level sections accounted for:

| Original section | New location | Status |
|------------------|--------------|--------|
| Database Schema Changes (L5-50) | `.claude/rules/database-schema.md` | OK (plus legacy context appended) |
| Vercel Deploy Architecture (L52-92) | `.claude/rules/vercel-deploy.md` | OK — 1:1 |
| Legacy Docker Standalone (L94-101) | `database-schema.md` §"Why this exists" + `CLAUDE.md` §Legacy notes | OK |
| Email/SMTP (L103-108) | `.claude/rules/email-smtp.md` | OK |
| Environment Variables & Secrets (L110-193) | `.claude/rules/env-vars.md` | OK |
| Git Flow (L195-211) | `.claude/rules/git-flow.md` | OK |
| PR Rules (L213-249) | `.claude/rules/git-flow.md` §PR Rules | OK |
| Commit Rules (L251-262) | `.claude/rules/git-flow.md` §Commit Rules | OK |
| Testing (L264-276) | `.claude/rules/testing.md` | OK |
| Key Files (L278-295) | `CLAUDE.md` §Key files | OK |

No facts lost. One fact upgraded: testing coverage target 60/50/50 → 70/70/70 (flagged in Major).

## Hallucination check

Verified synthesized doc claims against repo:

| Claim | File:line | Verdict |
|-------|-----------|---------|
| 19 Payload collections | codebase-summary.md:53 | CONFIRMED (19 `.ts` files under `src/collections/`) |
| Gold-standard test files exist | codebase-summary.md:65, testing.md:25-27 | CONFIRMED — all 3 exist |
| tsconfig `strict: true`, target ES2017, module esnext, paths `@/*` | code-standards.md:13-16 | CONFIRMED |
| `@upstash/ratelimit` + `@upstash/redis` in deps | system-architecture.md:37 | CONFIRMED |
| `@tanstack/react-query` in deps | system-architecture.md:17 | CONFIRMED |
| `SiteRenderer` exists | system-architecture.md:77 | CONFIRMED (used in 5 files) |
| `src/lib/stripe/` | codebase-summary.md:27 | FALSE — actual: `src/lib/payment/` |
| `src/lib/storage/` | codebase-summary.md:28 | FALSE — no such dir |
| `src/app/(admin)/page.tsx` | codebase-summary.md:44 | FALSE — no `(admin)` group |
| `src/app/(site)/[...slug]/` | codebase-summary.md:45 | FALSE — actual: `src/app/sites/[slug]/` |
| `/api/v1/**` canonical surface | codebase-summary.md:46, system-architecture.md:24 | FALSE — only `sso` lives under v1 |
| `src/store/builder-store.ts` + `auth-store` | codebase-summary.md:64 | FALSE — actual: `builderStore.ts`; no auth-store |
| 14 feature areas in Phase 1 scope | project-overview-pdr.md:41 | lists 17 features but header says 14 — count mismatch |

## Verdict

APPROVE_WITH_FIXES — structure, YAML frontmatter, owner fields, and all 5 anchor-fact deduplication checks pass. Block on correcting the 6 false paths in `docs/codebase-summary.md` + `/api/v1/**` claim before the doc goes live (it will be loaded by future AI agents as authoritative orientation). Majors 1-5 are merge-soon polish; Minors are nice-to-have.

## Unresolved questions

1. Is the `/api/v1/*` versioning standard aspirational or active? If aspirational, code-standards.md should note migration plan + link to the one existing v1 route as exemplar.
2. Should `plans/260413-1126-vercel-deploy-blocked/` be created retroactively (restore history) or removed from CLAUDE.md/vercel-deploy.md references?
3. Did `docs/TEST_CONVENTION.md` actually get updated to 70/70/70 on 2026-04-19, or did only `testing.md` get the new target? (Risk of drift if not both.)
4. Should `.github/scripts/sync-do-envs.py` block be removed entirely (file is gone) or retained as historical pointer?

**Status:** DONE_WITH_CONCERNS
**Summary:** Refactor structurally solid (fact preservation 100%, dedup 5/5, YAML valid, owners correct) but `docs/codebase-summary.md` has 6 hallucinated paths that will mislead AI agents — must fix before merge.
