# Session Wrap-up — feat/F01-ai-gen-variety-fix

**Date**: 2026-04-14
**Session type**: /cook interactive
**Duration**: ~6h (phase-06 fallback unify + plan-0914 phases 01–05a)
**Branch state**: 56 commits ahead of origin/staging, ~46k insertions / 4.4k deletions across 219 files

## Work shipped this session

### Part 1: Phase-06 fallback path unify (plan-2156)

| Commit | Purpose |
|---|---|
| `9bf02d4c` feat(f01): unify fallback path with template composer | 7 sub-steps: extract variant-validation.ts, new font-pairings.ts (19 pairings), composer-category-resolver.ts (14 categories + VN tokens), fallback-adapter.ts (composer → GenerationResult), rewire generateWithFallback, smoke script |
| `90f8f69a` fix(f01): apply unsupported-block filter to fallback path | Regression fix after fc0020d: extract drop list to unsupported-blocks.ts, apply to both happy + fallback paths |

+45 unit tests, smoke script across 5 categories.

### Part 2: Plan-0914 AI model optimization

| Commit | Phase | Purpose |
|---|---|---|
| `4cbe20f8` docs(f01): plan + research | docs | Plan + 2 research reports |
| `e08a937a` feat(f01): eval harness + select-model | 01+02 | 120-call eval ($1.47) + selectModel abstraction with env override |
| `56adabe0` feat(f01): flip site-gen default to gpt-4.1-mini | 03a | One-line flip, validated by eval |
| `9ccea6b7` feat(f01): fix cost leaks on edit-block + bulk-parse | 04 | 7 tasks bumped, edit-block temp 0.7→0.3, bulk-parse gpt-4o hardcode → 4.1-nano |
| `8f4cd4b3` feat(f01): ai usage cost logging | 05a | New ai-usage-logs collection + migration + logAiUsage helper + 3 call sites wired |

+16 unit tests (ai-config env override 8, log-usage 8).

## Eval results (plan-0914 phase-01)

Full report: `plans/260414-0914-ai-model-optimization/reports/eval-2026-04-14.md`

| Model | Validity | Avg blocks | Diversity | Avg latency | p95 latency | Cost/run |
|---|---|---|---|---|---|---|
| gpt-4o | 100% | 22.9 | 30/30 | 33s | 44.5s | $0.04273 |
| gpt-4.1-mini | 100% | 22.8 | 30/30 | 57s | 99.6s | $0.00431 |
| gpt-4o-mini | 100% | 16.6 | 30/30 | 60s | 84.3s | $0.00211 |
| gpt-5.4-mini | 0% ❌ | — | — | — | — | — |

**Key findings:**
1. gpt-4.1-mini quality parity with gpt-4o (22.8 vs 22.9 blocks, 100% valid, 100% unique combos) at 9.9× lower cost
2. gpt-4.1-mini latency worse than gpt-4o (both hit 8k max_tokens cap, 4.1-mini serialization slower) — deferred tuning
3. gpt-4o-mini sparse content (16.6 blocks vs 22.9) — rejected
4. gpt-5.4-mini errored 30/30: API breaking change `max_tokens` → `max_completion_tokens`. Need re-eval to validate fallback.

## Final state of plan-0914

| Phase | Status | Commit |
|---|---|---|
| 01 Eval harness | ✅ done | e08a937a |
| 02 Activate selectModel | ✅ done | e08a937a |
| 03a Flip site-gen default | ✅ done | 56adabe0 |
| 03b Strict json_schema + max_tokens tuning | ⏸ deferred | — |
| 04 Fix cost leaks | ✅ done | 9ccea6b7 |
| 05a Cost logging | ✅ done | 8f4cd4b3 |
| 05b Vercel AI Gateway + admin page | ⏸ deferred | — |

5/7 phases complete, cost win locked in, 2 polish phases deferred.

## Cost impact (expected monthly)

Estimate at 1k site-gens + 10k edits + 100k bulk rows per month:

| Flow | Before | After | Savings |
|---|---|---|---|
| site-gen | $43 | $4.30 | 9.9× cheaper |
| edit-block | ~$15 | ~$1.50 | 10× cheaper (+ quality) |
| bulk-parse | ~$1500 | ~$30 | 50× cheaper |
| seo/product-desc/url-extract | ~$15 | ~$4 | 4× cheaper |
| **TOTAL** | **~$1573/mo** | **~$40/mo** | **~97% reduction** |

## Rollback plan (instant, env override, no redeploy)

```
AI_MODEL_SITEGEN=gpt-4o
AI_MODEL_EDIT=gpt-4o-mini
AI_MODEL_BULK_PARSE=gpt-4o-mini
```

Set env var at environment scope in Vercel dashboard. Takes effect on next request. Works per-task independently.

## Observability live

- New Payload collection `ai-usage-logs` (super-admin read only)
- Every AI call writes row: endpoint, model, tokensIn, tokensOut, costUsd, durationMs, success, errorCode
- Fire-and-forget pattern via `src/lib/ai/log-usage.ts` — never blocks AI request
- Dynamic payload import to avoid cold-start penalty

Admin view URL (after deploy):
- Local: `http://localhost:3003/admin/collections/ai-usage-logs`
- Staging: `https://web-v2.dev.ecommercehub.my/admin/collections/ai-usage-logs`
- Production: `https://<prod-domain>/admin/collections/ai-usage-logs`

Sample query (raw SQL on Neon):
```sql
SELECT endpoint, model, COUNT(*) as calls, SUM(cost_usd) as total_cost,
       AVG(duration_ms) as avg_latency_ms
FROM ai_usage_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY endpoint, model
ORDER BY total_cost DESC;
```

## Risks + open items

- **p95 latency regression** — gpt-4.1-mini slower than gpt-4o at 8k max_tokens (99s vs 44s). Accepted tradeoff, tune in phase-03b.
- **Strict json_schema migration** — still using loose json_object mode. Phase-03b.
- **Vercel AI Gateway migration** — still raw openai SDK. Phase-05b next session.
- **gpt-5.4-mini fallback unvalidated** — eval script bug, need re-eval with max_completion_tokens (~$0.10, 3 min).
- **Admin dashboard `/admin/ai-usage`** — not built, phase-05b. Current admin view is Payload's built-in collection list.

## Shipping readiness

**HIGH.** 5/7 phases done, tests green (749/749 AI+builder scope), regression testing done, rollback trivial. Defer-able work is polish.

**Deploy recipe:**
1. Merge PR #555 to staging
2. `scripts/db-setup.js` auto-runs on Vercel build — creates `ai_usage_logs` table
3. Grant super-admin users access to new collection
4. Observe `/admin/collections/ai-usage-logs` 24h → verify cost drop matches ~97% prediction
5. If regression: set env override in Vercel dashboard for instant rollback

---
Generated via /watzup 2026-04-14 by cook session.
