# Phase 05 — Testing

## Context
- Test convention: `docs/TEST_CONVENTION.md`
- Gold standard: `src/__tests__/unit/builder/builder-store.test.ts`
- Existing tests: `src/__tests__/unit/builder/builder-form-validation.test.ts`
- API tests: `src/__tests__/api/ai.test.ts`
- TC-ID source: `docs/qa/F01*.md` (Builder feature)

## Overview
Unit tests cho store changes, component tests cho template picker, integration test cho generate-site voi templateId, E2E cho full flow.

## Key Insights
- Builder store test da co (`builder-store.test.ts`) — extend them selectedTemplate cases
- API test da co (`ai.test.ts`) — extend them templateId param
- Component test dung React Testing Library + vi.mock
- E2E dung Playwright — co the base tren existing builder E2E

## Requirements
- [x] Unit: builderStore selectedTemplate state management
- [x] Unit: generateSiteSchema validation voi templateId
- [x] Component: BuilderTemplatePicker render + interactions
- [x] Integration: generate-site API voi templateId
- [x] E2E: full onboarding -> template -> info -> generate flow

## Implementation Steps

### 1. Unit — builderStore template state
**File:** `src/__tests__/unit/builder/builder-store-template.test.ts`
```
TC-IDs: TC-F01-TPL-01 through TC-F01-TPL-05
- setSelectedTemplate stores template data
- setSelectedTemplate(null) clears selection
- reset() clears selectedTemplate
- step flow: template -> info -> chat -> done
- persist: selectedTemplate survives rehydration
```
- Follow pattern tu `builder-store.test.ts`
- Import `useBuilderStore` tu source, ko re-implement

### 2. Unit — schema validation
**File:** `src/__tests__/unit/lib/validations/ai-template-validation.test.ts`
```
TC-IDs: TC-F01-TPL-06 through TC-F01-TPL-08
- generateSiteSchema accepts templateId string
- generateSiteSchema accepts templateId number
- generateSiteSchema valid without templateId (backward compat)
```

### 3. Component — BuilderTemplatePicker
**File:** `src/__tests__/unit/builder/builder-template-picker.test.tsx`
```
TC-IDs: TC-F01-TPL-10 through TC-F01-TPL-18
- Renders loading skeleton initially
- Renders template grid after fetch
- Category filter shows matching templates
- Search filters by name
- Click "Skip" calls setStep('info')
- Click template card opens preview
- "Use Template" sets selectedTemplate + highlights card
- Premium template shows lock for free users
- Empty state when no templates match
```
- Mock fetch `/api/templates/list` voi fixture data
- Mock `useBuilderStore` cho state assertions

### 4. Integration — generate-site with templateId
**File:** `src/__tests__/api/ai-template.test.ts`
```
TC-IDs: TC-F01-TPL-20 through TC-F01-TPL-23
- POST with templateId fetches template from DB
- Template blocks injected into AI prompt
- POST without templateId runs blank flow (no regression)
- Invalid templateId returns 404
```
- Mock payload.findByID, generateSiteWithAI
- Verify prompt contains template block structure

### 5. E2E — Full template builder flow
**File:** `src/__tests__/e2e/builder-template-flow.spec.ts`
```
TC-IDs: TC-F01-TPL-30 through TC-F01-TPL-33
- Navigate /builder/new -> see template grid
- Select template -> fill info -> generate -> see preview
- Skip template -> fill info -> generate -> see preview (blank flow)
- Change template selection before generating
```
- Playwright test, login truoc, intercept API calls
- Assert: template picker visible, info form visible after select, generation starts

## Related Code Files
- `src/__tests__/unit/builder/builder-store.test.ts` — pattern reference
- `src/__tests__/api/ai.test.ts` — API test pattern
- `docs/TEST_CONVENTION.md` — rules
- `docs/qa/F01*.md` — TC-ID source (can them section cho template flow)

## Todo
- [ ] Write TC-IDs vao `docs/qa/F01-template-flow.md`
- [ ] Unit tests builderStore template state
- [ ] Unit tests schema validation
- [ ] Component tests BuilderTemplatePicker
- [ ] Integration tests generate-site + templateId
- [ ] E2E test full flow
- [ ] Verify coverage > 80% cho new code

## Success Criteria
- All unit tests pass (`vitest run`)
- Component tests cover: render, filter, select, skip, premium gate
- Integration test confirm template blocks reach AI prompt
- E2E test: onboarding -> template -> info -> generate works end-to-end
- No regression on existing builder tests
