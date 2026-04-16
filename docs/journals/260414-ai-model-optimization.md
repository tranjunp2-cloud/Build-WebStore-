---
date: 2026-04-14
branch: feat/F01-ai-gen-variety-fix
pr: '#555'
commits: [e08a937a, 56adabe0, 9ccea6b7, 8f4cd4b3, 40d37d43]
tags: [ai, cost-optimization, observability, gpt-4.1-mini, select-model]
plan: plans/260414-0914-ai-model-optimization/
---

# 2026-04-14 — AI model optimization: gpt-4o → gpt-4.1-mini

## Problem

Team hit OpenAI quota cap on the shared project key mid-day. Staging `ai-gen-variety-fix` branch couldn't test. Investigation showed:

1. **Site-gen hardcoded `gpt-4o`** in `openai-generator.ts:65` — ~$0.043/call at 4k in / 8k out
2. **`selectModel()` function existed in config.ts but was dead code** — never imported, never called. The abstraction was built but never wired.
3. **2 extra cost leaks** on `gpt-4o` hardcoded: `edit-block/route.ts:172` + `products-bulk-parse/route.ts:99`
4. **No cost tracking** anywhere — couldn't see which endpoint was eating budget, couldn't verify any future savings
5. Team had been using `gpt-4o-mini` as the "cheap" fallback — but research showed gpt-4o-mini is a 2024 model already beaten by gpt-4.1-mini on benchmarks

Root question: "cần tối ưu thì dùng `gpt-4o-mini` cho luồng này được không?" — answer turned out to be no, gpt-4.1-mini is strictly better.

## Decision

Pivot to `gpt-4.1-mini` as primary for complex tasks, `gpt-4.1-nano` for lightweight. Keep gpt-4o path via env override for instant rollback. Ship observability alongside the flip so we can verify the saving land in production.

5 locked decisions from interview with user:
1. Primary model: **gpt-4.1-mini** (not gpt-4o-mini, not gpt-5.4-mini)
2. Routing: **Vercel AI Gateway** — approved in principle, deferred to phase-05c
3. Strict `json_schema` migration: do it (original phase-03) — later split out as phase-03b after eval showed loose mode was already working
4. Eval harness: **run** — no yolo, need data before flipping production
5. Rollout: **canary via `AI_MODEL_SITEGEN` env override**, not feature flag lib

## Implementation

### Phase-01: Eval harness (`e08a937a` part 1)
- `scripts/ai/eval-models.ts` — 120 calls, 4 models × 3 inputs × 10 runs, $1.47 total
- Results: gpt-4o 100% valid 22.9 blocks, gpt-4.1-mini 100% valid 22.8 blocks, **quality parity at 9.9× lower cost**
- gpt-5.4-mini errored 30/30 — API breaking change `max_tokens` → `max_completion_tokens`. Research-01 was outdated. Fallback still unvalidated.
- gpt-4.1-mini p95 latency 99s vs gpt-4o 44s — both hit 8k max_tokens cap. Accepted tradeoff, tune in phase-03b.

### Phase-02: Activate selectModel (`e08a937a` part 2)
- Extended `AIModel` union from 2 → 6 models (added gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-5.4-mini)
- Extracted `DEFAULT_MODELS` + `ENV_KEY` maps, refactored `selectModel()` to read `process.env[ENV_KEY[task]]` first, fallback to default, warn on invalid
- Added `isValidModel()` type guard so typos don't silently downgrade
- New `'bulk-parse'` AITask
- Wired `selectModel` into `edit-block` route (site-gen already wired via earlier commit)
- `.env.*.example` placeholders: `AI_MODEL_SITEGEN`, `AI_MODEL_EDIT`, `AI_MODEL_BULK_PARSE`
- 8 new unit tests (env override happy path, invalid fallback + warn, empty string no-op, 8-task coverage)

### Phase-03a: Flip site-gen default (`56adabe0`)
- **1-line change**: `DEFAULT_MODELS['site-generation']` = `'gpt-4o'` → `'gpt-4.1-mini'`
- Docstring captures eval validation + rollback instructions
- Phase-03b (strict `json_schema` migration + `max_tokens` tuning) deferred — discovered that max_tokens reduction causes truncation without also lowering block count target in system prompt, adding scope

### Phase-04: Fix cost leaks (`9ccea6b7`)
- Bumped 7 `DEFAULT_MODELS`:
  - `chat-edit`, `inline-edit`: `gpt-4o-mini` → `gpt-4.1-mini` (better IFEval)
  - `seo-generation`, `content-rewrite`, `product-description`, `url-extraction`, `bulk-parse`: → `gpt-4.1-nano` (4× cheaper)
- Wired `selectModel('bulk-parse')` into `products-bulk-parse/route.ts` — hardcoded `gpt-4o` was a 50× overspend on structured CSV parsing
- Lowered `edit-block` temperature 0.7 → 0.3. User request "change hero headline to X" was getting creative rephrasings. Fidelity > variety for chat edits.

### Phase-05a: Cost logging (`8f4cd4b3`)
- New Payload collection `ai-usage-logs` (super-admin read only, serial id, 3 indexes on `created_at DESC`, `(endpoint, model)`, partial on `user_id`)
- Migration added to `scripts/db-setup.js` MIGRATIONS array — `CREATE TABLE IF NOT EXISTS`
- `src/lib/ai/log-usage.ts` — `estimateCostUsd()` pure function + `logAiUsage()` fire-and-forget helper with dynamic payload import (avoid cold-start penalty)
- Wired into 3 call sites (site-gen, edit-block, bulk-parse) — try/catch around the OpenAI call, log success or error case
- 8 new unit tests for cost estimation including date suffix stripping and phase-03a savings ratio proof (`> 9×`)

### Phase-05b: Admin dashboard plan only (`40d37d43`)
- File `phase-05b-admin-dashboard.md` — detailed scope for `/dashboard/ai-usage` page
- 4 SQL query sketches (24h totals, 7d breakdown, 30d daily chart, recent errors)
- Component breakdown, Recharts stacked line chart, super-admin guard, SSR `force-dynamic`
- NOT implemented in this session. Deferred because session already 6h+ and Payload collection's built-in view is sufficient for initial verification.
- Updated `plan.md` to split deferred work into 05c (Gateway) + 05d (bill reconciliation)

## Outcome

**5/7 phases shipped** (01, 02, 03a, 04, 05a). 2 phases deferred (03b, 05b) + 2 not-yet-scoped (05c, 05d).

### Expected cost impact (monthly, 1k site-gen + 10k edit + 100k bulk rows)

| Flow | Before | After | Ratio |
|---|---|---|---|
| site-gen | $43 | $4.30 | 9.9× |
| edit-block | ~$15 | ~$1.50 | 10× |
| bulk-parse | ~$1500 | ~$30 | 50× |
| seo/product-desc/url-extract | ~$15 | ~$4 | 4× |
| **TOTAL** | **~$1573/mo** | **~$40/mo** | **~97% reduction** |

### Tests
- 749/749 AI + builder scope green after each phase
- +16 new unit tests (ai-config env override 8, log-usage 8)
- `pnpm tsc --noEmit` clean on all touched files

### Rollback plan (instant, no redeploy)
Set env var at environment scope in Vercel dashboard:
```
AI_MODEL_SITEGEN=gpt-4o
AI_MODEL_EDIT=gpt-4o-mini
AI_MODEL_BULK_PARSE=gpt-4o-mini
```
Works per-task independently. Canary-to-production path uses the same mechanism.

### Observability
- `ai-usage-logs` collection writes on every AI call (site-gen, edit-block, bulk-parse wired; other endpoints TODO in future commits)
- Payload built-in view at `/admin/collections/ai-usage-logs` (super-admin only)
- Raw SQL aggregates via Neon SQL editor — example queries in `session-wrap-up-2026-04-14.md`

## Decisions worth remembering

1. **gpt-4o-mini is a trap**. It looks cheap but content sparsity (16.6 vs 22.9 blocks on identical prompt) makes AI output feel thin. Always prefer gpt-4.1-mini for structured generation unless eval proves otherwise.
2. **`max_tokens` reduction is NOT a free latency win**. Lowering the cap without also lowering the system prompt's target block count causes mid-JSON truncation → parse errors. If latency is the goal, tune both together.
3. **Strict `json_schema` migration is independent of model swap**. Eval showed quality parity at loose `json_object` mode → don't couple correctness improvement with cost migration. Separate commits, separate PRs.
4. **Env override > feature flag lib for AI model canary**. `process.env.AI_MODEL_SITEGEN` needs zero new infrastructure, survives redeploys, works per-environment, rolls back instantly. Avoided bringing in a feature-flag SDK.
5. **Fire-and-forget logging is the right default for observability**. If the log write fails, the AI request must still succeed. Never `await` the log helper.
6. **OpenAI API schema drifts between model families**. `gpt-5.x` family silently requires `max_completion_tokens` not `max_tokens`. Research docs lagged. Always probe the API with 1 call before trusting community docs.

## Followups

- **phase-03b** (latency tuning): only if p95 causes real user complaints. Needs system prompt update + max_tokens reduction + re-eval. ~3h.
- **phase-05b** (admin dashboard): planned in phase-05b-admin-dashboard.md. ~2-3h. Can run next session with fresh context.
- **phase-05c** (Vercel AI Gateway migration): full `openai` SDK → `@ai-sdk/openai` + `@ai-sdk/gateway`. Enables multi-provider fallback + native observability. Separate planning session. ~3h.
- **phase-05d** (OpenAI bill reconciliation): cron that pulls OpenAI admin API usage + compares with local `ai_usage_logs`, alerts on ±10% drift via smart-notify. Needs OpenAI Admin API key. ~2h.
- **Re-eval gpt-5.4-mini fallback**: fix `max_tokens` → `max_completion_tokens` in `scripts/ai/eval-models.ts`, run 10 calls. ~$0.10, 3 min. Needed before claiming gpt-5.4-mini is a viable fallback.

## Related files

- Plan: `plans/260414-0914-ai-model-optimization/plan.md`
- Eval report: `plans/260414-0914-ai-model-optimization/reports/eval-2026-04-14.md`
- Session wrap-up: `plans/260414-0914-ai-model-optimization/reports/session-wrap-up-2026-04-14.md`
- Research: `plans/260414-0914-ai-model-optimization/research/researcher-01-openai-models-2026.md`, `researcher-02-codebase-audit.md`
- Key code: `src/lib/ai/config.ts`, `src/lib/ai/log-usage.ts`, `src/collections/AiUsageLogs.ts`
