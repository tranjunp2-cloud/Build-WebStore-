# PRD: Auto-Save & Draft (F15)
> **Version:** 1.0 | **Created:** 2026-03-08 | **Agent:** `project-planner`  
> **Priority:** P0 | **Wave:** 3 | **Size:** M  
> **Depends on:** F05 AI Editor | **Integrated into:** editorStore (Zustand)

---

## 1. Problem Statement

Users lose work when they close the browser, navigate away, or experience a network issue. There's no auto-save mechanism, no draft recovery, and no visual indicator of save status.

## 2. User Story

```
AS A site owner editing my website
I WANT my changes auto-saved every few seconds
SO THAT I never lose work, even if I close the browser
```

## 3. Acceptance Criteria

### AC-1: Auto-Save Trigger
```gherkin
GIVEN user makes any change (AI, inline, or manual)
WHEN  3 seconds pass without new changes (debounce)
THEN  changes saved to Payload CMS via API
AND   status bar shows "Saved just now"
AND   isDirty flag cleared
```

### AC-2: Save Status Indicator
```gherkin
GIVEN changes are being saved
THEN  status bar shows "Saving..." with subtle spinner

GIVEN save successful
THEN  status bar shows "Saved Xs ago"

GIVEN save failed
THEN  status bar shows "⚠️ Not saved" in warning color
AND   retry automatically in 5s, 10s, 20s (3 retries)

GIVEN all 3 retries failed
THEN  persistent banner: "Changes not saved. Check your connection."
AND   manual "Save" button remains active
```

### AC-3: Draft Recovery
```gherkin
GIVEN user has unsaved changes
WHEN  user closes tab or navigates away
THEN  browser shows "You have unsaved changes" confirmation dialog

GIVEN user returns to /editor/:siteId
WHEN  a draft exists (saved within 24h)
THEN  editor loads the latest saved state
AND   no data loss
```

### AC-4: Manual Save
```gherkin
GIVEN user clicks "Save" button (or Ctrl+S)
WHEN  clicked
THEN  immediate save (ignore debounce)
AND   toast "Saved!"
```

## 4. Technical Requirements

### Implementation
```typescript
// In editorStore
const DEBOUNCE_MS = 3000
const MAX_RETRIES = 3
const RETRY_DELAYS = [5000, 10000, 20000]

// On any state change:
// 1. Set isDirty = true
// 2. Reset debounce timer
// 3. After DEBOUNCE_MS → call saveToServer()
// 4. On success → isDirty = false, update lastSaved
// 5. On failure → retry with backoff
```

### API
- `PATCH /api/sites/:id/pages/:pageId` — Save page blocks + theme

## 5. 9-Point Done Checklist

- [ ] Loading State — "Saving..." indicator
- [ ] Empty State — N/A
- [ ] Error State — "Not saved" warning + retry
- [ ] Form Validation — N/A
- [ ] Button States — Save button shows spinner during save
- [ ] Toast Feedback — "Saved!" on manual save
- [ ] Auth Redirect — N/A (part of editor)
- [ ] Mobile 375px — Status bar visible
- [ ] TypeScript Clean
