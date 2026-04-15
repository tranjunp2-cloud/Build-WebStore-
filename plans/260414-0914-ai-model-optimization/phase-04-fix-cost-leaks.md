# Phase 04 — Fix cost leaks (edit-block + products-bulk-parse)

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase-02 (selectModel wired)
- Research: [researcher-02 §Cost Leaks](./research/researcher-02-codebase-audit.md)

## Overview
- Date: 2026-04-14
- Description: 2 endpoint đang dùng `gpt-4o` hardcoded mà không cần thiết. Switch sang `gpt-4.1-mini` (edit-block) và `gpt-4.1-nano` (bulk-parse). Thường xuyên hơn phase-03 nhưng low risk vì task đơn giản.
- Priority: P1
- Status: pending

## Key insights
- **edit-block**: instruction → modify 1 block. Task nhỏ (~1.5K in / 1.5K out). gpt-4.1-mini dư sức, 12.5× cheaper.
- **bulk-parse**: parse CSV/paste → product list. Pure extraction, low creativity. gpt-4.1-nano (50× cheaper) đủ.
- Cả 2 flow đã có `json_object` response format — migrate sang strict schema đơn giản hơn site-gen (schema nhỏ, không dynamic union).

## Requirements
- [ ] `src/app/api/ai/edit-block/route.ts:172` → `selectModel('chat-edit')`
- [ ] `src/app/api/ai/products-bulk-parse/route.ts:99` → dùng `selectModel('url-extraction')` hoặc thêm task mới `'bulk-parse'`
- [ ] `DEFAULT_MODELS['chat-edit'] = 'gpt-4.1-mini'` (bump từ 4o-mini → 4.1-mini)
- [ ] `DEFAULT_MODELS['bulk-parse'] = 'gpt-4.1-nano'` (mới)
- [ ] Temperature giảm từ 0.7 → 0.3 cho edit-block (fidelity > variety)
- [ ] Optional: migrate sang strict json_schema cho edit-block (schema đơn giản, low risk)
- [ ] Retry logic: nếu primary fail → fallback `gpt-4.1-mini` cho bulk-parse (vì nano có thể yếu)

## Architecture
Chỉ đổi 2 call site, không cần file mới:

```ts
// edit-block/route.ts:171
const completion = await openai.chat.completions.create({
  model: selectModel('chat-edit'),           // gpt-4.1-mini
  messages: [...],
  temperature: 0.3,                           // was 0.7
  max_tokens: 2000,
  response_format: { type: 'json_object' },   // optional: upgrade to json_schema
})

// products-bulk-parse/route.ts:99
const completion = await openai.chat.completions.create({
  model: selectModel('bulk-parse'),           // gpt-4.1-nano
  messages: [...],
  temperature: 0.2,                           // keep low
  max_tokens: 3000,
  response_format: { type: 'json_object' },
})
```

## Related code files
- `src/app/api/ai/edit-block/route.ts` (modify line 171-180)
- `src/app/api/ai/products-bulk-parse/route.ts` (modify line 99+)
- `src/lib/ai/config.ts` (add 'bulk-parse' task if chosen)

## Implementation steps
1. Add `'bulk-parse'` vào `AITask` union + `DEFAULT_MODELS` + `ENV_KEY` (nếu tách riêng)
2. Flip `DEFAULT_MODELS['chat-edit']` từ `gpt-4o-mini` → `gpt-4.1-mini`
3. Update 2 route files, replace hardcode với `selectModel()`
4. Lower temperature ở edit-block xuống 0.3
5. Manual test edit-block: mở builder, chat edit 1 block, verify changes apply
6. Manual test bulk-parse: paste CSV 10 products, verify parse đúng
7. Monitor staging log 24h

## Todo
- [ ] Tách `'bulk-parse'` thành task riêng hay reuse `'url-extraction'`? Em nghiêng về tách.
- [ ] Test case "edit-block creative request" ("make this hero more playful") — verify nano không bị chọn → escape route khi user cần creativity
- [ ] Rate limit `bulk-parse`: bulk import có thể spawn nhiều call → verify rate limit config match nhu cầu

## Success criteria
- [ ] Edit-block cost /call: $0.01875 → $0.0015 (12.5× cheaper)
- [ ] Bulk-parse cost /call: $0.015 → $0.0003 (50× cheaper)
- [ ] E2E test pass: edit 1 block thành công, bulk import 10 products parse đúng fields
- [ ] No regression trong tests hiện có

## Risk
- **Risk 1**: gpt-4.1-nano parse CSV sai → fallback gpt-4.1-mini → effort +0.5h cho retry logic
- **Risk 2**: Temperature thấp làm edit-block phản hồi quá khô → bump 0.3 → 0.5 nếu user feedback

## Security
- Input đã validate qua zod schema (`editBlockSchema` + `parseRequest`) — không thay đổi

## Next steps
→ phase-05 (observability + gateway routing)
