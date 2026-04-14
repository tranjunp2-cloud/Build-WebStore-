# Phase 03 — Migrate site-gen to gpt-4.1-mini + strict json_schema

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase-01 (eval pass) + phase-02 (selectModel wired)
- Related: `plans/260412-2156-ai-gen-website-audit/phase-06-*` — đừng conflict
- Research: [researcher-01 §4 §8](./research/researcher-01-openai-models-2026.md)

## Overview
- Date: 2026-04-14
- Description: Flip `DEFAULT_MODELS['site-generation']` từ `gpt-4o` → `gpt-4.1-mini`. Đồng thời migrate `response_format` từ `{type:'json_object'}` (loose) → `{type:'json_schema', strict: true, schema: <site-gen-schema>}` (validated). Đây là phase ăn tiết kiệm chính (~$0.083/call saved).
- Priority: P0 — blocks ra trước khi team dùng hết token lần nữa
- Status: pending

## Key insights
- **Strict json_schema là correctness win độc lập** — kể cả không đổi model, chuyển từ loose → strict sẽ giảm parse error, retry, empty blocks.
- **Dynamic block types**: mình có 16 block types, mỗi type có variants khác nhau. Strict mode cần schema cố định → phải dùng `oneOf` union hoặc **two-phase generation** (phase A: outline blockType list, phase B: fill content theo schema của từng block). Report-01 flag đây là unresolved Q4.
- **gpt-4.1-mini context**: 1M tokens — dư sức. `max_tokens: 8000` output giữ nguyên.
- **Temperature**: giữ 0.7 cho variety. Nếu eval report diversity drop → bump lên 0.8-0.9.
- **Fallback rule-based generator** (`generateBlocks()` ở line 10 import) — keep as-is, trigger khi cả AI path lẫn validation đều fail.

## Requirements
- [ ] Build `siteGenSchema` (JSON Schema) match `GenerationResult` type
- [ ] Option A: single `oneOf` schema covering all 16 block types → 1 call
- [ ] Option B: two-phase (outline → fill) → 2 calls per site-gen (cost: +60% calls nhưng stability+) — PICK ONE
- [ ] Update `openai-generator.ts:64-73` để dùng strict schema
- [ ] `selectModel('site-generation')` returns `'gpt-4.1-mini'` (flip default)
- [ ] Preserve fallback path: nếu strict call throws → catch → retry with `json_object` loose → retry với rule-based → error
- [ ] Smoke test: chạy 3 canonical inputs qua site-gen, verify generated JSON valid + blocks render
- [ ] E2E test: mở `/builder/new` trên localhost:3003, submit form, confirm site được tạo

## Architecture
```ts
// src/lib/ai/site-gen-schema.ts (new)
import { z } from 'zod'
import { blockRegistry } from '@/blocks/registry'

// Option A: oneOf union
export const siteGenSchema = z.object({
  category: z.string(),
  theme: z.object({ ... }),
  pages: z.array(z.object({
    slug: z.string(),
    title: z.string(),
    blocks: z.array(z.discriminatedUnion('blockType', [
      heroBlockSchema,
      featuresBlockSchema,
      // ... 16 total
    ])),
  })),
})

// Convert to JSON Schema for OpenAI:
export const siteGenJsonSchema = zodToJsonSchema(siteGenSchema, { strictUnions: true })
```

Chain in `openai-generator.ts`:
```ts
model: selectModel('site-generation'),   // → gpt-4.1-mini
response_format: {
  type: 'json_schema',
  json_schema: {
    name: 'site_generation',
    strict: true,
    schema: siteGenJsonSchema,
  },
},
```

## Related code files
- `src/lib/ai/openai-generator.ts` (modify line 64-93)
- `src/lib/ai/generate-blocks.ts` (GenerationResult type — source of truth)
- `src/blocks/registry.ts` (block schema → extract for union)
- `src/lib/ai/system-prompt.ts` (có thể simplify prompt vì schema đã enforce — giảm token in)
- `src/lib/ai/content-rules.ts` (validateBlockContent — giữ post-validation)

## Implementation steps
1. Audit block registry → list 16 blockTypes + Zod schemas
2. Build `siteGenSchema` Zod (option A union first, fall back option B if too deep)
3. Install `zod-to-json-schema` nếu chưa có — convert sang draft-07 JSON Schema
4. Test schema conversion local — verify `strict: true` accept shape
5. Update `openai-generator.ts`: flip model + response_format + wrap try/catch 3-tier fallback
6. Run phase-01 eval script với new config để verify pass same thresholds
7. Smoke test localhost:3003 với 3 canonical inputs
8. Deploy preview (staging) + A/B via `AI_MODEL_SITEGEN` env override trước
9. Monitor error rate + cost dashboard 24h → promote to default

## Todo
- [ ] Quyết định Option A vs B (single call vs two-phase) — depend on OpenAI chấp nhận `oneOf` depth không
- [ ] Check `zod-to-json-schema` đã có trong deps chưa
- [ ] Token accounting: tính input tokens mới sau khi simplify system prompt (schema giảm redundancy)
- [ ] Logging: capture `model`, `finish_reason`, `validation_errors` để debug
- [ ] Fallback chain: 3-tier đủ hay 2-tier?

## Success criteria
- [ ] Eval script chạy lại với config mới → JSON validity ≥ 98% (cao hơn threshold phase-01 vì schema strict)
- [ ] Cost per site-gen từ ~$0.09 → ~$0.007 (verified qua logged usage)
- [ ] E2E: tạo 3 website từ 3 canonical inputs, không có block nào empty/stub
- [ ] Latency p95 không regress quá 10% vs gpt-4o baseline
- [ ] No schema parse errors trong staging log 24h đầu

## Risk
- **Risk 1**: `oneOf` union với 16 discriminated blocks → schema quá deep, OpenAI reject với "schema too complex" → fallback two-phase generation (outline → fill), effort +2h
- **Risk 2**: Variety drop — gpt-4.1-mini đồng dạng hơn gpt-4o → eval catch được, bump temperature hoặc fallback sang gpt-5.4-mini
- **Risk 3**: Schema không match actual block types (drift) → runtime 400 error từ OpenAI → hard-coded fallback kicked in, user vẫn có site nhưng mất variety → CI test phải có assertion schema stay in sync với block registry
- **Risk 4**: Conflict với `plans/260412-2156-ai-gen-website-audit/` đang modify `openai-generator.ts` → phase-03 rebase sau khi 260412-2156 merge

## Security
- Schema public, không chứa secret
- Input validation phase không đổi — giữ `validateBlockContent()` + `sanitizeBlockData()` sau parse
- Rate limit giữ nguyên (Upstash)

## Next steps
→ phase-04 (fix 2 cost leak còn lại: edit-block + bulk-parse)
