# Research: Editor Save/Publish Flow

## Current Flow

```
User edits → hasUnsavedChanges=true → auto-save (3s) → markSaved() → hasUnsavedChanges=false
                                                                        ↓
                                                              "Update" button DISAPPEARS
                                                              (but changes NOT published!)
```

## Key Code Locations

| File | Line | Logic |
|------|------|-------|
| `EditorToolbar.tsx` | 305 | `{hasUnsavedChanges && <Button onClick={onRepublish}>Update</Button>}` |
| `editorStore.ts` | 482 | `markSaved: () => set({ hasUnsavedChanges: false })` |
| `editorStore.ts` | 413 | `handleContentChange()` sets `hasUnsavedChanges: true` |
| `editorStore.ts` | 448 | `performSave()` sends `isDraft: true` always |
| `editor/page.tsx` | 314 | `handleSave()` sends `isDraft: true` |
| `editor/page.tsx` | 325 | Calls `markSaved()` on success |
| `editor/page.tsx` | 573-576 | `handlePublish()` auto-saves first if unsaved |
| `publish/route.ts` | 57-64 | Sets `status: 'published'`, updates `publishedAt` |
| `publish/route.ts` | 86-91 | `revalidateTag('site-${siteId}')` + `revalidateTag('tenants')` |

## Bug

`hasUnsavedChanges` tracks save state, NOT publish state. After auto-save:
- Flag = false → "Update" button hidden
- But draft saved, NOT published → public site shows old content
- No way to re-publish without making another edit
