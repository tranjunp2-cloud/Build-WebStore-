---
parent: plan.md
status: pending
priority: P1
depends_on: []
---

# Phase 2: UI — EditorTemplateModal component

## Context
Tạo modal picker template cho editor. Reuse TemplateCard + TemplatePreviewModal hiện có.

## Related Files
- `src/components/frontend/TemplateCard.tsx` — reuse
- `src/components/frontend/TemplatePreviewModal.tsx` — reuse
- `src/app/(frontend)/templates/page.tsx` — reference pattern

## Implementation Steps

### 1. Create `src/components/editor/EditorTemplateModal.tsx`

```
EditorTemplateModal
├── Props: isOpen, onClose, siteId, onApplied
├── State: templates[], search, activeCategory, previewTemplate, isApplying
├── Fetch: /api/templates/list on mount
├── UI:
│   ├── Dialog overlay (z-50)
│   ├── Header: "Choose a Template" + close button
│   ├── Filters: category tabs + search input
│   ├── Grid: TemplateCard[] (2-3 columns)
│   ├── Footer: cancel button
│   └── Nested: TemplatePreviewModal (on preview click)
├── Actions:
│   ├── Preview → open TemplatePreviewModal
│   └── Use → confirmation dialog → POST apply-template with siteId
└── After apply: onApplied() callback → refresh editor
```

### 2. Confirmation Dialog
Before applying template, show:
```
"Apply [Template Name]?"
"This will replace your current page layout and theme. This action cannot be undone."
[Cancel] [Apply Template]
```

### 3. Styling
- Dark theme to match editor (bg-[#0B1120])
- Use shadcn/ui Dialog component
- Responsive: full-screen on mobile, centered modal on desktop
- Template cards: 2 columns on md, 3 on lg

## Success Criteria
- [ ] Modal opens/closes properly
- [ ] Templates load and display in grid
- [ ] Search and category filter work
- [ ] Preview modal works (nested)
- [ ] Confirmation before apply
- [ ] Loading state during apply
- [ ] Close after successful apply
