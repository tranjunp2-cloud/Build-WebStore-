# Template Flow — Tich hop template vao AI Builder

```yaml
status: pending
priority: P1
effort: 2d
created: 2026-04-06
branch: feat/F01-template-flow
```

## Problem

Hien tai co 2 path rieng biet: "Build with AI" (blank) va "Choose Template" (raw copy, no AI).
User phai chon 1 trong 2 — khong the dung template LAM NEN TANG roi de AI generate content.

## Solution

Merge template picker vao builder flow: `template` -> `info` -> `chat` -> `completion`.
AI nhan template blocks lam structure, generate content tu business info.

## Architecture Decision

- **Reuse** `EditorTemplateModal` logic (fetch, filter, categories) — extract thanh shared hook `useTemplateList`
- **Extend** `builderStore` them `selectedTemplate` state (ko tao store moi)
- **Extend** `generateSiteSchema` them `templateId` optional field
- **Modify** `openai-generator.ts` — khi co templateId, inject template blocks vao system prompt de AI giu layout
- **Giu nguyen** blank flow — templateId = null thi chay nhu cu

## Phase Table

| Phase | Name | Effort | Dependencies |
|-------|------|--------|-------------|
| 01 | Template Picker UI trong Builder | 4h | None |
| 02 | Store + API Integration | 4h | Phase 01 |
| 03 | Preview + Selection UX | 3h | Phase 01 |
| 04 | Onboarding Update | 1h | Phase 01-03 |
| 05 | Testing | 4h | Phase 01-04 |

## Key Files (se thay doi)

| File | Change |
|------|--------|
| `src/store/builderStore.ts` | Them `selectedTemplate`, `setSelectedTemplate`, update step type |
| `src/app/(builder)/builder/new/AIBuilderPageClient.tsx` | Them template step rendering |
| `src/lib/validations/ai.ts` | Them `templateId` vao `generateSiteSchema` |
| `src/app/api/ai/generate-site/route.ts` | Fetch template blocks, pass to generator |
| `src/lib/ai/openai-generator.ts` | Nhan template blocks, modify prompt |
| `src/lib/ai/system-prompt.ts` | Them template-aware prompt section |
| `src/app/(frontend)/onboarding/_components/WelcomeScreenClient.tsx` | Don gian hoa options |

## Files Moi

| File | Purpose |
|------|---------|
| `src/components/builder/BuilderTemplatePicker.tsx` | Template grid + filter trong builder context |
| `src/lib/hooks/use-template-list.ts` | Shared hook fetch + filter templates (extract tu EditorTemplateModal) |

## Risk

- Template blocks structure co the khong match voi AI output format -> can normalize layer
- Premium template gate: check user plan truoc khi cho chon
- Template list load time: can skeleton loading + lazy iframe
