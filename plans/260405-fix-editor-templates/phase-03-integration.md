---
parent: plan.md
status: pending
priority: P1
depends_on: [phase-01, phase-02]
---

# Phase 3: Integration — Connect modal to editor

## Context
Wire up EditorTemplateModal vào Editor page, thay toast placeholder.

## Related Files
- `src/app/(editor)/editor/[siteId]/page.tsx` (line 667)

## Implementation Steps

### 1. Add state to EditorPage
```typescript
const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
```

### 2. Replace toast handler (line 667)
```typescript
// Before:
onOpenTemplates={() => toast.info('Template gallery will be connected in the next step.')}

// After:
onOpenTemplates={() => setIsTemplateModalOpen(true)}
```

### 3. Add modal render
```tsx
<EditorTemplateModal
    isOpen={isTemplateModalOpen}
    onClose={() => setIsTemplateModalOpen(false)}
    siteId={siteId}
    onApplied={() => {
        setIsTemplateModalOpen(false)
        // Reload editor data
        window.location.reload() // simple approach
        // OR: re-fetch via loadData() for smoother UX
    }}
/>
```

### 4. After template applied
- Reload editor data (blocks + theme from server)
- Refresh preview iframe
- Show success toast

## Success Criteria
- [ ] Templates button opens modal (not toast)
- [ ] After applying template, editor shows new blocks/theme
- [ ] Preview iframe reflects new template
- [ ] Save state resets (no "unsaved changes" for fresh template)

## Risk
- State sync: editorStore may still have old blocks → need to re-init store after apply
