# PRD: Auto-Save & Draft (F12)
> **Version:** 1.1 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P0 | **Sprint:** Wave 3 | **Size:** M
> **Depends on:** F05 AI Editor | **Integrated into:** editorStore (Zustand)

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file.

> [!NOTE]
> F12 chưa có Story file riêng. Scope được derived từ US-F12-01 (Auto-save AC).
> **Action required:** Tạo `F12-auto-save-stories.md` hoặc merge vào F05 stories nếu scope nhỏ.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F12-01 | AI Editor — Auto-save AC | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |

> ⚠️ Auto-save là sub-feature của F05. Story riêng cho F12 chưa tồn tại.

---

## 1. Problem Statement

Users lose work when they close the browser, navigate away, or experience a network issue. There's no auto-save mechanism, no draft recovery, and no visual indicator of save status.

---

## 2. Target User

- Site owner đang edit website
- Không muốn lo về mất data khi đóng tab

---

## 3. Solution Overview

Auto-save debounce 3s, manual save (Ctrl+S), save status indicator (Saved Xs ago / Saving... / ⚠️ Not saved), retry với exponential backoff, draft recovery khi quay lại editor.

---

## 4. Scope

### In Scope
- Auto-save debounce 3s sau mỗi change (US-F12-01)
- Status indicator: Saving... / Saved Xs ago / ⚠️ Not saved
- Retry với backoff: 5s, 10s, 20s (3 lần)
- Manual save Ctrl+S → immediate + toast
- Draft recovery khi return to /editor/:siteId

### Out of Scope
- Persistent version history (Wave 6+)
- Named snapshots
- Collaborative conflict resolution

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Auto-save debounce 3s sau bất kỳ change nào | US-F12-01 | P0 | PATCH /api/pages |
| FR-02 | Status bar: "Saving..." khi đang save | US-F12-01 | P0 | |
| FR-03 | Status bar: "Saved Xs ago" sau success | US-F12-01 | P0 | |
| FR-04 | Status bar: "⚠️ Not saved" khi fail | US-F12-01 | P0 | Warning color |
| FR-05 | Auto-retry: 5s, 10s, 20s backoff (3 attempts) | US-F12-01 | P0 | |
| FR-06 | Persistent banner sau 3 retries fail: "Changes not saved. Check connection." | US-F12-01 | P0 | |
| FR-07 | Manual save: Ctrl+S → immediate save + toast "Saved!" | US-F12-01 | P1 | |
| FR-08 | Browser "unsaved changes" dialog khi navigate away với isDirty = true | US-F12-01 | P0 | |
| FR-09 | Draft recovery: return to /editor/:siteId → load latest saved state | US-F12-01 | P0 | |

---

## 8. Business Rules

- **BR-01:** isDirty = true → block navigation với browser dialog
- **BR-02:** Draft valid nếu saved within 24h
- **BR-03:** Auto-save không spam API — debounce 3s bắt buộc
- **BR-04:** Manual Ctrl+S overrides debounce timer

---

## 13. Technical Architecture

```typescript
// In editorStore
const DEBOUNCE_MS = 3000
const MAX_RETRIES = 3
const RETRY_DELAYS = [5000, 10000, 20000]

// On any state change:
// 1. Set isDirty = true, status = 'unsaved'
// 2. Reset debounce timer
// 3. After DEBOUNCE_MS → call saveToServer()
// 4. On success → isDirty = false, status = 'saved', update lastSaved
// 5. On failure → retry with backoff, status = 'error'

// API: PATCH /api/sites/:id/pages/:pageId { blocks, theme }
```

---

## 17. 9-Point Done Checklist

- [ ] Loading State — "Saving..." indicator
- [ ] Empty State — N/A
- [ ] Error State — "⚠️ Not saved" + retry + persistent banner
- [ ] Form Validation — N/A
- [ ] Button States — Save button spinner during save
- [ ] Toast Feedback — "Saved!" on manual save
- [ ] Auth Redirect — N/A (part of editor)
- [ ] Mobile 375px — Status bar visible in toolbar
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] ⚠️ Story file created (F12 hoặc added to F05)
- [ ] F05 Editor editorStore designed

---

## 19. Definition of Done

- [ ] Auto-save fires 3s after change
- [ ] Retry with backoff: 3 attempts
- [ ] Draft recovery works
- [ ] Mobile status bar visible
