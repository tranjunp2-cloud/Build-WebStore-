# Phase 01: Add hasUnpublishedChanges Flag

## Context
- Parent: [plan.md](./plan.md)
- Research: [editor flow](./research/researcher-01-editor-flow.md)

## Overview
- **Date**: 2026-04-12
- **Priority**: P1
- **Implementation status**: pending
- **Review status**: pending

## Key Insights
- `hasUnsavedChanges` = "content changed but not saved to DB"
- Need `hasUnpublishedChanges` = "content saved to DB but not published to live site"
- Both flags independent: save clears unsaved, publish clears unpublished

## Related Code Files

| File | Line | Change |
|------|------|--------|
| `src/store/editorStore.ts` | 65 | Add `hasUnpublishedChanges: boolean` to state type |
| `src/store/editorStore.ts` | 176 | Init `hasUnpublishedChanges: false` |
| `src/store/editorStore.ts` | 206 | Reset in `init()` |
| `src/store/editorStore.ts` | 452 | After `markSaved()` in `performSave()`, set `hasUnpublishedChanges: true` if site is published |
| `src/store/editorStore.ts` | 482 | Add `markPublished: () => set({ hasUnpublishedChanges: false })` |
| `src/components/editor/EditorToolbar.tsx` | 305 | Change condition to `(hasUnsavedChanges \|\| hasUnpublishedChanges)` |
| `src/app/(editor)/editor/[siteId]/page.tsx` | 586 | Call `markPublished()` after successful publish |

## Implementation Steps

### Step 1: Update editorStore.ts

```typescript
// In EditorState type (line ~65)
hasUnpublishedChanges: boolean

// In initial state (line ~176)
hasUnpublishedChanges: false,

// In init() (line ~206)
hasUnpublishedChanges: false,

// In markSaved() (line ~482) — update to also set unpublished flag
markSaved: () => {
  const { site } = get()
  set({
    hasUnsavedChanges: false,
    lastSavedAt: Date.now(),
    saveStatus: 'saved',
    // If site is published, saving creates unpublished changes
    hasUnpublishedChanges: site?.status === 'published',
  })
},

// Add markPublished action
markPublished: () => set({ hasUnpublishedChanges: false }),
```

### Step 2: Update EditorToolbar.tsx

```typescript
// Line 305: Change condition
{(hasUnsavedChanges || hasUnpublishedChanges) && (
    <Button onClick={onRepublish} ...>
        {hasUnsavedChanges ? 'Save & Update' : 'Update'}
    </Button>
)}
```

Add `hasUnpublishedChanges` to props interface and destructuring.

### Step 3: Update editor/[siteId]/page.tsx

```typescript
// In handlePublish (line ~586), after successful publish:
markPublished()

// Pass hasUnpublishedChanges to EditorToolbar
<EditorToolbar hasUnpublishedChanges={hasUnpublishedChanges} ... />
```

## Todo
- [ ] Add `hasUnpublishedChanges` to store state type
- [ ] Initialize and reset in init()
- [ ] Update `markSaved()` to set flag when published
- [ ] Add `markPublished()` action
- [ ] Update toolbar button condition
- [ ] Pass flag to toolbar component
- [ ] Call `markPublished()` on publish success
- [ ] Test: edit published site → save → "Update" button stays
- [ ] Test: click Update → button disappears after publish

## Success Criteria
- After editing + saving published site → "Update" button visible
- Click "Update" → content appears on subdomain → button disappears
- Draft sites: no change in behavior (Publish button as before)
- Auto-save doesn't break flow

## Risk Assessment
- **Low risk** — adding new flag, not changing existing behavior
- Edge case: site status changes while editing (e.g. another user unpublishes)
  - Mitigated: `markSaved()` reads current `site.status` from store
