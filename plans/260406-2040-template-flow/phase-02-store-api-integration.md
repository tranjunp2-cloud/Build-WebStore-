# Phase 02 — Store + API Integration

## Context
- `src/store/builderStore.ts` — Zustand store, persist to localStorage
- `src/lib/validations/ai.ts` — Zod schema cho generate-site (line 3-15)
- `src/app/api/ai/generate-site/route.ts` — POST handler, goi `generateSiteWithAI()`
- `src/lib/ai/openai-generator.ts` — GPT-4o generation, `buildSystemPrompt()` + `buildUserPrompt()`
- `src/lib/ai/system-prompt.ts` — prompt builder

## Overview
Extend store them selectedTemplate state. Extend API nhan templateId, fetch template blocks tu DB, inject vao AI prompt de giu layout structure.

## Key Insights
- Template `defaultBlocks` la JSON field chua array of block configs (Templates.ts:79-83)
- Template `defaultTheme` la group field voi colors + fonts (Templates.ts:68-76)
- `generateSiteWithAI()` nhan `extraInstructions` string — co the inject template context qua day
- Hoac tot hon: tao param rieng `templateBlocks` de AI biet ro day la structure can giu

## Requirements
- [x] `selectedTemplate` trong builderStore (id, name, blocks, theme)
- [x] `templateId` optional trong generateSiteSchema
- [x] API fetch template tu DB khi co templateId
- [x] AI prompt inject template blocks lam structure reference
- [x] Fallback: ko co template = blank flow (unchanged)

## Implementation Steps

### 1. Extend builderStore
**File:** `src/store/builderStore.ts`
```typescript
// Them vao BuilderState (line 38):
selectedTemplate: {
  id: string | number
  name: string
  blocks: Record<string, unknown>[]
  theme: { primaryColor: string; secondaryColor: string; fontHeading: string; fontBody: string; colorMode: string }
} | null

// Them vao BuilderActions (line 64):
setSelectedTemplate: (template: BuilderState['selectedTemplate']) => void

// Them vao INITIAL_STATE (line 94):
selectedTemplate: null

// Them action impl (line 133):
setSelectedTemplate: (template) => set({ selectedTemplate: template })

// Them vao partialize (line 191) de persist:
selectedTemplate: state.selectedTemplate
```

### 2. Extend Zod schema
**File:** `src/lib/validations/ai.ts` line 3
```typescript
export const generateSiteSchema = z.object({
  // ...existing fields...
  templateId: z.union([z.string(), z.number()]).optional(),  // NEW
})
```

### 3. Update generate-site route
**File:** `src/app/api/ai/generate-site/route.ts`
- Sau line 81 (destructure data): them `templateId`
- Khi `templateId` co gia tri:
  - Fetch template: `payload.findByID({ collection: 'templates', id: templateId })`
  - Extract `defaultBlocks` va `defaultTheme`
  - Build `templateContext` string mota block structure
  - Pass vao `generateSiteWithAI()` nhu param moi
- Increment `usageCount` cua template

### 4. Update openai-generator
**File:** `src/lib/ai/openai-generator.ts`
- Extend `generateSiteWithAI()` signature: them `templateBlocks?: Record<string, unknown>[]`
- Khi co templateBlocks: pass vao `buildUserPrompt()` de inject context

### 5. Update system prompt
**File:** `src/lib/ai/system-prompt.ts`
- Them section trong `buildUserPrompt()`:
```
TEMPLATE STRUCTURE (use this as layout reference):
- Keep these block types in this order: [blockType list]
- Replace all placeholder content with business-specific content
- You may adjust colors/fonts to match the business brand
```

### 6. Pass templateId tu client
**File:** `src/app/(builder)/builder/new/AIBuilderPageClient.tsx`
- Trong `handleGenerate` function: doc `selectedTemplate` tu store
- Them `templateId: selectedTemplate?.id` vao request body

## Related Code Files
- `src/lib/ai/system-prompt.ts` — prompt builder (can xem buildUserPrompt)
- `src/lib/ai/content-brief.ts` — contentBriefToReferencePrompt (pattern tuong tu)
- `src/collections/Templates.ts` — schema reference

## Todo
- [ ] Extend builderStore voi selectedTemplate
- [ ] Extend generateSiteSchema voi templateId
- [ ] Update route handler fetch template + pass to generator
- [ ] Update openai-generator nhan template blocks
- [ ] Update system prompt voi template context section
- [ ] Update client pass templateId trong request
- [ ] Test: generate voi template vs without template

## Success Criteria
- Chon template -> generate -> AI output giu layout structure cua template
- Content duoc replace hoan toan bang business info (ko con placeholder)
- Theme co the blend giua template theme va AI suggestion
- Skip template -> flow chay nhu cu, ko regression
