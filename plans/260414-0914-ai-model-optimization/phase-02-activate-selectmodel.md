# Phase 02 — Activate `selectModel()` + env-driven model config

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase-01 eval results
- Research: [researcher-02 §Dead Code](./research/researcher-02-codebase-audit.md)

## Overview
- Date: 2026-04-14
- Description: `src/lib/ai/config.ts` đã có `selectModel(task)` nhưng chưa được import ở đâu. Phase này: (1) thêm model mới (4.1-mini, 5.4-mini, 4.1-nano) vào `AIModel` type, (2) env-var override (`AI_MODEL_SITEGEN`, `AI_MODEL_EDIT`, `AI_MODEL_FALLBACK`), (3) wire vào 2 call site `openai-generator.ts` + `edit-block/route.ts`. Chưa đổi model primary — vẫn để default là `gpt-4o` (flip ở phase-03).
- Priority: P1
- Status: pending

## Key insights
- Tách quyết định "dùng model nào" (phase-03) khỏi thao tác "wire abstraction" (phase-02) → đỡ conflict code review.
- Env var override cho phép A/B theo environment (staging test 4.1-mini, production giữ 4o) mà không deploy code mới.
- `AIModel` type hiện tại chỉ có 2 giá trị — phải mở rộng nhưng vẫn giữ backwards compat.

## Requirements
- [ ] `AIModel` type mở rộng: `'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'gpt-4.1-nano' | 'gpt-5.4-mini'`
- [ ] `selectModel(task)` đọc `process.env.AI_MODEL_<TASK>` trước khi fallback sang default
- [ ] Default map giữ nguyên hành vi hiện tại (site-gen → 4o) để phase-02 không phải là breaking change
- [ ] 2 call site đang hardcode `'gpt-4o'` được thay bằng `selectModel('site-generation')` / `selectModel('chat-edit')`
- [ ] Test `src/__tests__/unit/lib/ai/ai-config.test.ts` update để cover env override path
- [ ] `.env.staging.example` và `.env.production.example` thêm placeholder cho 4 env vars mới
- [ ] `scripts/check-env-vars.js` không fail (vì là optional override)

## Architecture
```ts
// src/lib/ai/config.ts (new)
export type AIModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1-mini' | 'gpt-4.1-nano' | 'gpt-5.4-mini'

const DEFAULT_MODELS: Record<AITask, AIModel> = {
  'site-generation': 'gpt-4o',        // flip in phase-03
  'chat-edit': 'gpt-4o-mini',
  'inline-edit': 'gpt-4o-mini',
  // ...
}

const ENV_KEY: Record<AITask, string> = {
  'site-generation': 'AI_MODEL_SITEGEN',
  'chat-edit': 'AI_MODEL_EDIT',
  // ...
}

export function selectModel(task: AITask): AIModel {
  const override = process.env[ENV_KEY[task]] as AIModel | undefined
  if (override && isValidModel(override)) return override
  return DEFAULT_MODELS[task]
}
```

## Related code files
- `src/lib/ai/config.ts` (modify)
- `src/lib/ai/openai-generator.ts:65` (wire selectModel)
- `src/app/api/ai/edit-block/route.ts:172` (wire selectModel)
- `src/__tests__/unit/lib/ai/ai-config.test.ts` (add env override tests)
- `.env.staging.example`, `.env.production.example` (placeholders)

## Implementation steps
1. Extend `AIModel` type + add `isValidModel()` guard
2. Add `DEFAULT_MODELS` + `ENV_KEY` maps + refactor `selectModel()` để đọc env
3. Import `selectModel` vào 2 call site, thay hardcode
4. Update unit tests — thêm case "env override returns gpt-4.1-mini", "invalid override falls back to default"
5. Update `.env.*.example` + add to docs
6. Run `pnpm tsc --noEmit` + `pnpm test src/__tests__/unit/lib/ai/ai-config.test.ts`

## Todo
- [ ] Confirm naming convention env vars (`AI_MODEL_SITEGEN` vs `AI_MODEL_SITE_GENERATION`)
- [ ] Quyết định có expose `AIModel` type ra consumer hay keep internal
- [ ] Nếu phase-03 có fallback chain → cần `selectModel` return array? hoặc thêm `selectFallback()` riêng?

## Success criteria
- [ ] TS clean
- [ ] Unit tests pass (config test + 2 new env override tests)
- [ ] Manual test: set `AI_MODEL_SITEGEN=gpt-4.1-mini` trong `.env.local` → run site-gen → observe model in logs is gpt-4.1-mini
- [ ] Production default không đổi (site-gen vẫn là gpt-4o)

## Risk
- **Rủi ro 1**: env override typo → silent fallback sang default, user tưởng đang test model mới → `isValidModel()` guard + log warning khi override invalid.
- **Rủi ro 2**: OpenAI SDK reject model string không biết → run a smoke call ngay sau wire để catch.

## Security
- Env vars không chứa secret, chỉ model name — OK commit vào `.env.*.example`.
- Không để user-controlled input vào model string (no header/body injection).

## Next steps
→ phase-03 flip DEFAULT_MODELS['site-generation'] sang `gpt-4.1-mini` sau khi eval pass.
