---
title: "AI Model Optimization — replace gpt-4o with gpt-4.1-mini"
description: "Swap hardcoded gpt-4o on site-gen + edit-block to gpt-4.1-mini via Vercel AI Gateway — ~85% cost cut with equal/better JSON fidelity."
status: in-progress
priority: P1
effort: 9h
branch: feat/F01-ai-gen-variety-fix
tags: [ai, cost-optimization, site-generation, edit-block, vercel-ai-gateway]
created: 2026-04-14
---

## Progress (2026-04-14)

| Phase | Status | Commit |
|---|---|---|
| 01 Eval harness | ✅ done | `e08a937a` |
| 02 Activate selectModel | ✅ done | `e08a937a` |
| 03a Flip site-gen default | ✅ done | `56adabe0` |
| 03b Strict json_schema + max_tokens tuning | ⏸ deferred | — |
| 04 Fix cost leaks edit-block + bulk-parse | ✅ done | `9ccea6b7` |
| 05a Cost logging (ai_usage_logs + helper) | ✅ done | `8f4cd4b3` |
| [05b Admin dashboard /dashboard/ai-usage](./phase-05b-admin-dashboard.md) | 📋 planned | — |
| 05c Vercel AI Gateway migration | ⏸ not-yet-scoped | — |
| 05d OpenAI bill reconciliation | ⏸ not-yet-scoped | — |

## Câu hỏi gốc của a

> "Phân tích lại model đang dùng là gì và có phù hợp không. Cần tối ưu thì nên dùng `gpt-4o-mini` cho luồng này được không, hay em có suggest nào khác?"

## Trả lời ngắn (TL;DR)

**KHÔNG nên dùng `gpt-4o-mini`.** Nên dùng **`gpt-4.1-mini`** (với `gpt-5.4-mini` làm fallback), route qua **Vercel AI Gateway**, và migrate `response_format` từ `json_object` sang `json_schema` strict mode. Lý do:

1. **`gpt-4o-mini` là model cũ (2024)** — kém `gpt-4.1-mini` cả về chất lượng lẫn giá. Không có lý do gì chọn mini-4o trong 2026.
2. **`gpt-4.1-mini` rẻ hơn `gpt-4o` ~12.5×** ($0.20/$0.80 vs $2.50/$10 per 1M), nhưng IFEval benchmark **CAO hơn** gpt-4o (87.4 vs 81.0). Dev community report "nearly always valid on 30K+ calls" cho nested JSON — đúng use case site-gen của mình.
3. **Tránh `gpt-5-mini`** — community reports regression về nested JSON schema. `gpt-5.4-mini` OK nhưng đắt hơn 4.1-mini 5×, nên chỉ dùng làm fallback.
4. **`gpt-4o` hiện tại KHÔNG dùng structured outputs strict** — chỉ `json_object` loose mode, parse lỏng → dễ break. Migration là correctness win độc lập với việc đổi model.

**Tiết kiệm kỳ vọng**: ở scale 1K site-gen + 10K edit-block/tháng → từ **~$278/mo → ~$22/mo** (80-92% cut). Chưa kể cost leak hiện có sẽ được fix luôn.

## Phân tích hiện trạng (từ 2 research reports)

### 2 luồng dùng `gpt-4o` hardcoded (đắt)
| File | Line | Task | Vấn đề |
|---|---|---|---|
| `src/lib/ai/openai-generator.ts` | 65 | **Site generation** (AI builder từ URL) | `gpt-4o`, `temp 0.7`, `max_tokens 8000`, `json_object` (loose). Flow core tạo website — 4K in / 8K out = ~$0.09/call |
| `src/app/api/ai/edit-block/route.ts` | 172 | **Edit block** (chat edit) | `gpt-4o`, `temp 0.7`, `max_tokens 2000`, `json_object`. Edit 1 block không cần flagship — **cost leak** |

### Cost leak thứ 3
| File | Line | Task | Vấn đề |
|---|---|---|---|
| `src/app/api/ai/products-bulk-parse/route.ts` | 99 | **Bulk product parse** | `gpt-4o` cho parse input → `gpt-4.1-nano` dư sức |

### Dead code
- `src/lib/ai/config.ts` có hàm `selectModel(task)` định tuyến giữa `gpt-4o`/`gpt-4o-mini` **nhưng KHÔNG được import ở bất kỳ đâu** (trừ test file). Thiết kế tốt nhưng chưa bao giờ activate.
- `RATE_LIMITS` theo tier (free/starter/pro/business) cũng chỉ là declaration — runtime dùng flat limit 20/hr ở `rateLimit.ts`.

### Đã OK sẵn
- 8/10 endpoints đã dùng `gpt-4o-mini` rồi (generate-meta, product-description, seo-generate, rewrite-text, extract-from-url, generate-blog, seo/fix). Không cần đụng — khi đi chung tier sẽ auto nâng cấp lên `gpt-4.1-mini` theo `selectModel()`.

## Bảng so sánh model (tham khảo report-01)

| Model | Input | Output | IFEval | Cost site-gen 4K/8K | Ghi chú |
|---|---|---|---|---|---|
| `gpt-4o` (hiện tại) | $2.50 | $10.00 | 81.0 | **$0.090** | baseline, 2024 flagship |
| `gpt-4o-mini` | $0.15 | $0.60 | ~74 | $0.0054 | rẻ nhưng yếu — SKIP |
| **`gpt-4.1-mini`** 🏆 | **$0.20** | **$0.80** | **87.4** | **$0.0072** | **PRIMARY recommendation** |
| `gpt-4.1-nano` | $0.05 | $0.20 | ~79 | $0.0018 | cho task đơn giản (bulk-parse) |
| `gpt-5.4-mini` | $0.75 | $4.50 | ~88 | $0.039 | FALLBACK, có reasoning |
| `gpt-5-mini` | $0.125 | $1.00 | ~85 | $0.0085 | ⚠️ nested JSON regression — avoid |

## Implementation phases

| # | Phase | Effort | Status |
|---|---|---|---|
| 01 | [Eval harness — A/B validate model choice](./phase-01-eval-harness.md) | 2h | pending |
| 02 | [Activate `selectModel()` + env-driven model config](./phase-02-activate-selectmodel.md) | 1.5h | pending |
| 03 | [Migrate site-gen to gpt-4.1-mini + strict json_schema](./phase-03-migrate-site-gen.md) | 3h | pending |
| 04 | [Fix cost leaks — edit-block + bulk-parse](./phase-04-fix-cost-leaks.md) | 1h | pending |
| 05 | [Vercel AI Gateway routing + fallback + cost logging](./phase-05-gateway-observability.md) | 1.5h | pending |

## Decisions (đã confirm với anh 2026-04-14)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Primary model | ✅ **`gpt-4.1-mini`** |
| 2 | Routing layer | ✅ **Vercel AI Gateway** (zero markup, auto fallback, dashboard) |
| 3 | Strict json_schema cho site-gen | ⏸ Dependency-check — land plan-2156 phase-06 trước, phase-03 rebase sau |
| 4 | Eval harness phase-01 | ✅ **Chạy phase-01** (no yolo) — cần data so sánh 4.1-mini vs 4o trước khi flip prod |
| 5 | Rollout strategy | ✅ **Canary via env override**: deploy code với default giữ `gpt-4o` → set `AI_MODEL_SITEGEN=gpt-4.1-mini` ở staging → QA 2-3 ngày → set env ở prod. Rollback instant bằng cách xóa env var (không redeploy). |

## Dependency & sequencing

**✅ UNBLOCKED (2026-04-14)** — plan-2156 phase-06 đã land:
- `9bf02d4` feat(f01): unify fallback path with template composer (phase-06)
- `fc0020d` fix(f01): drop unsupported blocks + social-widget link platform bug
- `90f8f69a` fix(f01): apply unsupported-block filter to fallback path

Giờ `src/lib/ai/openai-generator.ts` đã refactor clean:
- `enforceMinContent` + `VARIANT_MIN_CONTENT` → `variant-validation.ts`
- fallback path → `composeFallbackResult` qua `fallback-adapter.ts`
- `isUnsupportedBlock` helper đã có sẵn để áp dụng cho AI happy path lẫn fallback

**Ready to cook** — plan-0914 phase-03 sẽ modify `generateSiteWithAI` (line 64-93) mà không đụng code fallback (line 249+). Zero conflict risk.

## Related work (không conflict)
- `plans/260412-2300-design-quality-rules/` — rules block variety/design tokens (độc lập)
- `plans/260414-0837-ai-gen-test-harness/` — structural harness AI output (phase-01 có thể tận dụng assertion logic)
- `plans/260414-0840-fallback-composer-unify/` — fallback composer (overlap với plan-2156 phase-06, cùng scope)

## Research citations
- [research/researcher-01-openai-models-2026.md](./research/researcher-01-openai-models-2026.md) — model landscape, pricing, benchmarks, recommendations
- [research/researcher-02-codebase-audit.md](./research/researcher-02-codebase-audit.md) — inventory 10 endpoints, cost leaks, dead code
