# Phase 05 — Vercel AI Gateway routing + fallback + cost logging

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase-03 + phase-04 done
- Research: [researcher-01 §7](./research/researcher-01-openai-models-2026.md), [researcher-02 §Missing Instrumentation](./research/researcher-02-codebase-audit.md)

## Overview
- Date: 2026-04-14
- Description: Route tất cả OpenAI call qua Vercel AI Gateway (zero markup, multi-provider fallback, observability). Thêm cost logging per-call vào Payload collection mới `ai_usage_logs`. Optional: migrate từ direct `openai` SDK sang Vercel AI SDK `generateObject()` + Zod.
- Priority: P2 — nice-to-have nhưng unblocks multi-provider + monitoring
- Status: pending

## Key insights
- **Vercel AI Gateway zero markup** — không đắt hơn gọi direct OpenAI, nhưng auto-fallback khi provider outage + dashboard sẵn.
- **Automatic fallback chain**: `providerOptions.gateway.models: ['gpt-4.1-mini', 'gpt-5.4-mini', 'gpt-4o-mini']` — thử tuần tự, model 2 chỉ call khi model 1 fail.
- **`generateObject()` + Zod**: type-safe, strict schema tự động, retry built-in. Tránh viết boilerplate JSON parse + validate.
- **Cost logging**: hiện không có dữ liệu actual spend — không biết key hết quota vì user nào/endpoint nào. Phải log: `{timestamp, user_id, endpoint, model, tokens_in, tokens_out, cost_usd, duration_ms}`.

## Requirements
- [ ] Install `ai` + `@ai-sdk/openai` + `@ai-sdk/gateway` (nếu chưa có)
- [ ] Enable Vercel AI Gateway trong Vercel dashboard + add `VERCEL_AI_GATEWAY_KEY` env
- [ ] Migrate `openai-generator.ts` + `edit-block/route.ts` sang `generateObject()` với Zod schema
- [ ] Fallback chain config: site-gen (4.1-mini → 5.4-mini → 4o), edit-block (4.1-mini → 4.1-nano)
- [ ] New Payload collection `ai_usage_logs` + migration trong `scripts/db-setup.js` (follow `CLAUDE.md` naming convention)
- [ ] Middleware/helper `logAiUsage()` wrap mọi call
- [ ] Admin dashboard page `/admin/ai-usage` — table với filter theo user + model + date

## Architecture
```ts
// src/lib/ai/client.ts (new)
import { openai } from '@ai-sdk/openai'
import { gateway } from '@ai-sdk/gateway'
import { generateObject } from 'ai'
import { selectModel } from './config'

export async function generateSiteObject(params: {...}) {
  const start = Date.now()
  const result = await generateObject({
    model: gateway('openai/' + selectModel('site-generation')),
    schema: siteGenSchema,
    prompt: userPrompt,
    system: systemPrompt,
    providerOptions: {
      gateway: {
        models: [
          'openai/gpt-4.1-mini',
          'openai/gpt-5.4-mini',
          'openai/gpt-4o',
        ],
      },
    },
  })
  
  await logAiUsage({
    endpoint: 'site-gen',
    model: result.response.modelId,
    tokens_in: result.usage.promptTokens,
    tokens_out: result.usage.completionTokens,
    duration_ms: Date.now() - start,
    cost_usd: estimateCost(result.response.modelId, result.usage),
  })
  
  return result.object
}
```

```js
// scripts/db-setup.js — new migration
{
  name: 'ai_usage_logs.create_table',
  sql: `CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id serial PRIMARY KEY,
    created_at timestamp DEFAULT NOW(),
    user_id integer,
    tenant_id integer,
    endpoint varchar NOT NULL,
    model varchar NOT NULL,
    tokens_in integer,
    tokens_out integer,
    cost_usd numeric(10, 6),
    duration_ms integer,
    success boolean DEFAULT true,
    error_msg text);`,
},
{
  name: 'ai_usage_logs.idx_created_at',
  sql: `CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at DESC);`,
},
```

## Related code files
- `src/lib/ai/client.ts` (new) — centralized client
- `src/lib/ai/log-usage.ts` (new) — logAiUsage helper
- `src/lib/ai/openai-generator.ts` (migrate)
- `src/app/api/ai/edit-block/route.ts` (migrate)
- `scripts/db-setup.js` (new migration entry)
- `src/collections/AiUsageLogs.ts` (new Payload collection, optional)
- `src/payload.config.ts` (register collection)
- `src/app/(admin)/admin/ai-usage/page.tsx` (new, optional)

## Implementation steps
1. Enable Vercel AI Gateway + set `VERCEL_AI_GATEWAY_KEY` env (dashboard + GitHub secrets)
2. Install AI SDK packages
3. Create `src/lib/ai/client.ts` với `generateSiteObject()` + `generateEditAction()`
4. Add `ai_usage_logs` collection + migration (follow CLAUDE.md Drizzle convention)
5. `logAiUsage()` fire-and-forget pattern (`.catch()` không block request)
6. Migrate site-gen call → `generateObject()`
7. Migrate edit-block call → `generateObject()`
8. Add admin page `/admin/ai-usage` (filterable table)
9. Deploy preview → verify gateway routes tokens, logs hit DB
10. Validate dashboard show correct spend cho 3 canonical inputs

## Todo
- [ ] Vercel AI Gateway có BYOK không? Nếu có → set BYOK để charge direct OpenAI → tránh double-billing
- [ ] Cost estimate function per-model (hardcode pricing table hay pull from API?)
- [ ] Log retention policy: 90 ngày? Cron cleanup?
- [ ] PII: user prompt không log raw → chỉ log endpoint + model + usage, không log content

## Success criteria
- [ ] Gateway routing works (verify qua Vercel dashboard hoặc log response headers)
- [ ] Fallback kicks in khi simulate 429 (manual test: set `AI_MODEL_SITEGEN=gpt-nonexistent` → should fallback)
- [ ] `ai_usage_logs` table có data sau 3 canonical E2E tests
- [ ] Admin page render correct aggregates (total spend, by model, by user)
- [ ] Cost tracking match OpenAI dashboard ±5%

## Risk
- **Risk 1**: AI SDK `generateObject()` khác shape response → migrate phức tạp hơn expect → effort +1h → OK vì phase-05 là P2
- **Risk 2**: Log write fail block request → `.catch()` pattern đã handle (fire-and-forget)
- **Risk 3**: Gateway add latency ~50ms p95 → acceptable vs giá trị fallback
- **Risk 4**: Collection migration phải follow Drizzle naming convention CLAUDE.md — `serial` id cho non-array, không dùng `DROP TABLE` — CI check-migrations sẽ block PR nếu sai

## Security
- `VERCEL_AI_GATEWAY_KEY` là secret → chỉ env var, không commit
- `ai_usage_logs` không lưu prompt content — chỉ metadata
- Admin page behind `withAuth` + role check (super_admin)
- Cost data sensitive → không expose endpoint public

## Next steps
Plan hoàn tất. Sau phase-05: monitor 1 tuần staging → promote production → retire feature flag (`AI_MODEL_*` env override stays cho khả năng emergency rollback).
