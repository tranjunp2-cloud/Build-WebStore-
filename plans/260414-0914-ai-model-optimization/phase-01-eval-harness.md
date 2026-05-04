# Phase 01 — Eval harness to A/B validate model choice

## Context
- Parent: [plan.md](./plan.md)
- Depends on: none (standalone, preflight check before flipping model)
- Related: `plans/260414-0837-ai-gen-test-harness/` (structural assertion harness — can reuse)
- Research: [researcher-01 §9 Unresolved Q1](./research/researcher-01-openai-models-2026.md)

## Overview
- Date: 2026-04-14
- Description: Run cùng 1 input qua 4 models (`gpt-4o`, `gpt-4.1-mini`, `gpt-5.4-mini`, `gpt-4o-mini`) x 10 times/model và so sánh: (1) JSON schema validity rate, (2) block combo diversity, (3) copy uniqueness, (4) p95 latency, (5) actual token cost.
- Priority: P1 — gate cho việc flip production model
- Implementation: pending
- Review: pending

## Key insights
- **KHÔNG có public benchmark** so sánh creative variety của 4o vs 4.1-mini vs 5.4-mini trên task "tạo website". Phải tự đo.
- Community report gpt-5-mini regress về nested JSON — cần verify 5.4-mini không bị tương tự trên schema 10-15 block của mình.
- Kết quả eval sẽ quyết định: flip 4.1-mini toàn bộ (kỳ vọng), hay 5.4-mini site-gen + 4.1-mini everywhere else (safe mode), hay giữ 4o tạm (worst case).

## Requirements
- [ ] Script chạy được standalone (node) hoặc qua `pnpm exec tsx` — không block trên dev server.
- [ ] Dùng OPENAI_API_KEY thật (nạp credit trước), không mock.
- [ ] Output: JSON report + Markdown summary vào `reports/eval-<date>.md`.
- [ ] Metric threshold: JSON validity ≥ 95%, diversity (unique block combos) ≥ 6/10, p95 latency < 30s.

## Architecture
- Test inputs: 3 business types (restaurant Malaysia, tech startup VN, fashion boutique EN) × 1 prompt/type = 3 canonical inputs (reuse từ `plans/260414-0837-ai-gen-test-harness/` nếu có)
- Per input: 10 generations/model × 4 models = 120 calls (~$2-3 total eval cost)
- Capture: raw JSON response, parsed blocks array, schema validation result, tokens usage, latency
- Diff: compute block combo Jaccard similarity giữa 10 runs, copy uniqueness qua cosine similarity trên heading text
- Script: `scripts/ai/eval-models.ts`

## Related code files
- `src/lib/ai/openai-generator.ts` — reference cho cách call site-gen
- `src/lib/ai/system-prompt.ts` / `buildSystemPrompt()` — reuse prompt gốc
- `src/blocks/registry.ts` — schema validation
- `plans/260414-0837-ai-gen-test-harness/phase-02-structural-assertions.md` — có sẵn assertions logic?

## Implementation steps
1. Define canonical inputs (3 businesses, stable seed).
2. Build `scripts/ai/eval-models.ts` — loop 4 models × 3 inputs × 10 runs.
3. Capture metrics to JSONL: `{model, input_id, run, valid, blocks, combo_hash, tokens, cost, latency}`.
4. Compute aggregates: validity%, unique_combos, copy_similarity, avg_latency, total_cost per model.
5. Generate Markdown report với recommendation: "model X passes thresholds, go".
6. Run eval locally, commit report to `plans/260414-0914-ai-model-optimization/reports/eval-2026-04-14.md`.

## Todo
- [ ] Check nếu harness của plan 0837 đã có assertions reusable → tránh duplicate
- [ ] Confirm với anh: 3 inputs đủ hay cần nhiều hơn?
- [ ] Decide threshold số: validity ≥95% có hợp lý không, hay cần 98%+?
- [ ] Script location: `scripts/ai/eval-models.ts` vs `src/__tests__/eval/` (không phải unit test nên để `scripts/`)
- [ ] Cost budget cho eval: ~$3, OK nạp credit trước

## Success criteria
- [ ] Report Markdown sinh ra với số liệu 4 model × 3 input × 10 run
- [ ] Rõ recommendation: primary + fallback model
- [ ] A sign-off vào plan.md "Critical decisions" #1 dựa trên data

## Risk
- **Rủi ro 1**: gpt-4.1-mini fail threshold → phải downgrade sang 5.4-mini hoặc giữ 4o → phase-03 thay đổi target model, plan vẫn đi tiếp.
- **Rủi ro 2**: strict json_schema migration (phase-03) phức tạp hơn expect do dynamic block types → phase-03 effort có thể tăng 3h → 6h.
- **Rủi ro 3**: OPENAI_API_KEY hết quota (đang bị hôm 2026-04-14) → eval không chạy được → cần nạp credit hoặc chuyển BYOK qua Vercel AI Gateway trước.

## Security
- Không commit OPENAI_API_KEY vào report.
- Report không chứa raw generated HTML/code (chỉ metric + hash) — tránh leak user-facing content.

## Next steps
Sau khi eval pass → phase-02 (activate selectModel abstraction).
