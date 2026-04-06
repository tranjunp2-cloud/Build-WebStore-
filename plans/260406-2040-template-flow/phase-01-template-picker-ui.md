# Phase 01 — Template Picker UI trong Builder

## Context
- `src/components/editor/EditorTemplateModal.tsx` — da co logic fetch, filter, category tabs (250+ lines)
- `src/components/frontend/TemplateCard.tsx` — card component voi iframe preview
- `src/components/frontend/TemplatePreviewModal.tsx` — full preview modal
- Builder step hien tai: `'info' | 'chat' | 'done'` (builderStore.ts:44)

## Overview
Tao `BuilderTemplatePicker` component — step dau tien trong builder flow. Reuse logic tu EditorTemplateModal nhung UI khac (full page, ko modal).

## Key Insights
- EditorTemplateModal fetch `/api/templates/list?limit=50&sort=sortOrder` — reuse endpoint nay
- CATEGORIES array da co 11 categories + "All" (EditorTemplateModal.tsx:10-23)
- TemplateCard da support iframe preview — reuse truc tiep
- Builder dang dung `BuilderStepScreen` wrapper cho moi step (BusinessInfoForm.tsx:13)

## Requirements
- [x] Grid template cards voi category filter tabs
- [x] Search by name
- [x] "Skip — de AI tu chon" button (prominent)
- [x] "Use this template" action tren moi card
- [x] Mobile responsive (3 cols -> 2 cols -> 1 col)
- [x] Loading skeleton khi fetch
- [x] Premium badge + lock cho premium templates (user free plan)

## Implementation Steps

### 1. Extract shared hook `use-template-list.ts`
**File:** `src/lib/hooks/use-template-list.ts`
- Extract fetch + filter + search logic tu `EditorTemplateModal.tsx:46-77`
- Return: `{ templates, isLoading, error, searchInput, setSearchInput, activeCategory, setActiveCategory, filteredTemplates }`
- Dung TanStack Query thay vi raw useState/useEffect

### 2. Tao `BuilderTemplatePicker.tsx`
**File:** `src/components/builder/BuilderTemplatePicker.tsx`
- Import `useTemplateList` hook
- Layout: `BuilderStepScreen` wrapper (giong BusinessInfoForm)
- Header: "Choose a starting template" + subtitle
- Category tabs: horizontal scroll (reuse CATEGORIES array — extract thanh constant)
- Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- Moi card: `TemplateCard` + "Use Template" button overlay
- Bottom: "Skip — Let AI design from scratch" button (secondary style)
- Selected state: blue border ring khi chon

### 3. Update builder step type
**File:** `src/store/builderStore.ts` line 44
```
step: 'info' | 'chat' | 'done'  ->  step: 'template' | 'info' | 'chat' | 'done'
```
- Update `INITIAL_STATE.step` tu `'info'` -> `'template'`

### 4. Wire vao AIBuilderPageClient
**File:** `src/app/(builder)/builder/new/AIBuilderPageClient.tsx`
- Import `BuilderTemplatePicker`
- Trong render logic (khoang line 137+): them case `step === 'template'` render `BuilderTemplatePicker`
- onSelect: `setSelectedTemplate(template)` + `setStep('info')`
- onSkip: `setStep('info')` (ko set template)

## Related Code Files
- `src/components/editor/EditorTemplateModal.tsx` — source of reuse
- `src/components/frontend/TemplateCard.tsx` — card component
- `src/components/builder/onboarding/BuilderStepScreen.tsx` — step wrapper
- `src/components/builder/fields/*` — builder field components

## Todo
- [ ] Extract `useTemplateList` hook
- [ ] Extract CATEGORIES constant thanh shared file
- [ ] Build `BuilderTemplatePicker` component
- [ ] Update `builderStore` step type
- [ ] Wire vao `AIBuilderPageClient`
- [ ] Test responsive layout

## Success Criteria
- User thay template grid khi vao `/builder/new`
- Co the filter by category, search by name
- Chon template -> chuyen sang info step
- Skip -> chuyen sang info step (blank flow)
- Mobile: single column, horizontal scroll categories
