# Phase 03 — Preview + Selection UX

## Context
- `src/components/frontend/TemplatePreviewModal.tsx` — da co full preview modal voi iframe
- `src/components/frontend/TemplateCard.tsx` — card voi hover preview
- `src/components/editor/EditorTemplateModal.tsx` — co hover preview pattern (line 42-44)
- GET `/api/templates/preview?id=X` — render template HTML cho iframe

## Overview
Polish UX cho template picker: click card mo preview modal, selected state highlight, cho phep thay doi truoc khi generate.

## Key Insights
- `TemplatePreviewModal` da co "Use Template" + "Back" buttons — can adapt label cho builder context
- `TemplateCard` da support `onPreview` callback — reuse
- Hover preview (desktop) da implemented trong EditorTemplateModal — co the reuse pattern
- Preview URL: `/api/templates/preview?id={templateId}` render full HTML

## Requirements
- [x] Click template card -> full preview modal
- [x] "Use this template" button trong preview modal
- [x] "Back to Gallery" button
- [x] Selected template highlighted (blue ring) trong grid
- [x] Cho phep thay doi template (click card khac = deselect cu, select moi)
- [x] Selected template summary hien o header khi da chon
- [x] Loading state cho iframe preview

## Implementation Steps

### 1. Adapt TemplatePreviewModal cho builder
**File:** `src/components/builder/BuilderTemplatePicker.tsx`
- Import `TemplatePreviewModal` tu `@/components/frontend/TemplatePreviewModal`
- State: `previewTemplate: Template | null`
- onClick card: `setPreviewTemplate(template)`
- TemplatePreviewModal props: `onUseTemplate` -> set selectedTemplate + close preview
- Button labels: "Use This Template" (primary), "Back to Gallery" (secondary)

### 2. Selected state UI
**File:** `src/components/builder/BuilderTemplatePicker.tsx`
- Track `selectedTemplateId` from builderStore
- Card wrapper: `cn('border-2 border-transparent', selectedTemplateId === template.id && 'border-blue-500 ring-2 ring-blue-500/30')`
- Show checkmark badge on selected card (top-right corner)
- "Selected" label replace "Use Template" on selected card

### 3. Selected template summary bar
**File:** `src/components/builder/BuilderTemplatePicker.tsx`
- Khi da chon template: hien sticky bar o bottom
- Content: template thumbnail (small) + name + "Continue" button + "Change" link
- "Continue" -> `setStep('info')`
- "Change" -> `setSelectedTemplate(null)` scroll to grid

### 4. Loading + empty states
**File:** `src/components/builder/BuilderTemplatePicker.tsx`
- Loading: grid of skeleton cards (6 items, pulse animation)
- Empty (no match): "No templates found" + "Try a different category" message
- Error: retry button + toast

### 5. Premium template gate
**File:** `src/components/builder/BuilderTemplatePicker.tsx`
- Check user plan (pass as prop or fetch)
- Premium templates: show lock icon overlay, disable "Use Template"
- Click premium -> toast "Upgrade to Pro to use premium templates" + link

## Related Code Files
- `src/components/frontend/TemplatePreviewModal.tsx` — reuse component
- `src/components/frontend/TemplateCard.tsx` — card component
- `src/components/builder/onboarding/BuilderStepScreen.tsx` — layout wrapper

## Todo
- [ ] Wire preview modal vao BuilderTemplatePicker
- [ ] Implement selected state highlight
- [ ] Build bottom summary bar (sticky)
- [ ] Add skeleton loading state
- [ ] Add empty/error states
- [ ] Premium template gate logic
- [ ] Test: select -> preview -> change -> continue flow

## Success Criteria
- Click card -> preview mo full-width voi iframe
- "Use Template" trong preview -> card highlighted, bottom bar hien
- "Continue" -> chuyen sang info step voi template da chon
- Co the thay doi template bat ky luc nao truoc khi continue
- Premium templates locked cho free users
