# PRD: Undo/Redo System (F11)
> **Version:** 1.1 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P0 | **Sprint:** Wave 3 | **Size:** M
> **Depends on:** F05 AI Editor | **Integrated into:** editorStore (Zustand)

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F11-01 | Undo / Redo All Changes Including AI | [F11-undo-redo-stories.md](../stories/F11-undo-redo-stories.md) | Draft |

---

## 1. Problem Statement

Khi user thực hiện edit (qua AI chat, inline edit), mistakes không thể revert. Không có undo/redo — mọi AI change không mong muốn phải sửa thủ công. Đây là critical UX gap cho editor.

---

## 2. Target User

- Site owner đang experiment với AI edits
- Cần tự tin experiment mà không sợ break site

---

## 3. Solution Overview

Undo/Redo system tích hợp vào `editorStore` (Zustand). Keyboard shortcuts (Ctrl+Z/Y), toolbar buttons với count badge, max 50 history states. AI generation = 1 single undoable action.

---

## 4. Scope

### In Scope
- Ctrl+Z Undo / Ctrl+Y (Ctrl+Shift+Z) Redo (US-F11-01)
- Toolbar buttons với count: "Undo (3)" (US-F11-01)
- Max 50 history states (US-F11-01)
- AI generation = single undoable action (US-F11-01)
- History persists within browser session (US-F11-01)

### Out of Scope
- Persistent undo history across page refresh
- Named undo steps (history panel)
- Collaborative undo (multi-user)

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Undo/Redo usage | > 30% sessions | PostHog |
| Preview update after undo | < 200ms | Timing |

---

## 6. User Story Summary

```
AS A   store owner đang experiment với AI edits
I WANT undo bất kỳ thay đổi nào — kể cả AI-generated
SO THAT tôi experiment thoải mái mà không sợ break store
```

> Source: [US-F11-01](../stories/F11-undo-redo-stories.md#us-f14-01)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Ctrl+Z (Cmd+Z Mac) → revert most recent change | US-F11-01 | P0 | < 200ms |
| FR-02 | Ctrl+Y (Cmd+Shift+Z Mac) → redo reverted change | US-F11-01 | P0 | |
| FR-03 | Toolbar Undo/Redo buttons với count badge | US-F11-01 | P0 | "Undo (3)" |
| FR-04 | Buttons greyed + disabled khi stack empty | US-F11-01 | P0 | |
| FR-05 | Max 50 history states — oldest dropped khi new change added | US-F11-01 | P0 | |
| FR-06 | AI generation (toàn bộ) = 1 single undoable action | US-F11-01 | P0 | |
| FR-07 | History cleared on page refresh | US-F11-01 | P0 | Session only |

---

## 8. Business Rules

- **BR-01:** New change → clear redoStack
- **BR-02:** AI response grouping: 1 chat response = 1 UndoAction (dù thay đổi nhiều block)
- **BR-03:** undoStack max = 50 — FIFO drop oldest khi đầy

---

## 9. User Flow

```
User makes change (AI chat, inline, theme)
  → undoStack.push(UndoAction)
  → redoStack.clear()
  ↓
Ctrl+Z
  → undoStack.pop() → apply reverseChanges → preview updates < 200ms
  → redoStack.push(action)
  ↓
Ctrl+Y
  → redoStack.pop() → apply changes
  → undoStack.push(action)
```

---

## 11. Acceptance Criteria

> AC được copy từ `F11-undo-redo-stories.md`. Không tự thêm AC không có trong story.

### AC-1: Undo via Keyboard
> 📌 Source: [US-F11-01](../stories/F11-undo-redo-stories.md) — AC-1

```gherkin
GIVEN I have made 5 changes (mix of manual + AI)
WHEN  I press Ctrl+Z (or Cmd+Z on Mac)
THEN  the most recent change is reverted
  AND the preview updates within 200ms
  AND the chat panel shows the reverted action greyed out với "Undone" label
```

### AC-2: Redo
> 📌 Source: [US-F11-01](../stories/F11-undo-redo-stories.md) — AC-2

```gherkin
GIVEN I have undone a change
WHEN  I press Ctrl+Y (or Cmd+Shift+Z on Mac)
THEN  the previously undone change is re-applied
  AND preview updates within 200ms
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | Preview update after undo < 200ms | |
| **Memory** | Max 50 states — oldest dropped | |

---

## 13. Technical Architecture

```typescript
type UndoAction = {
  id: string
  timestamp: number
  source: 'ai_chat' | 'inline_edit' | 'manual' | 'theme_change'
  label: string          // "Changed hero title"
  changes: BlockChange[]
  reverseChanges: BlockChange[]
}

// In editorStore:
// Undo: pop undoStack → push redoStack → apply reverseChanges
// Redo: pop redoStack → push undoStack → apply changes
// Max 50 items in undoStack
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F05 AI Editor (editorStore) | ⬜ | Implement Zustand store first |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — N/A
- [ ] Empty State — Undo/Redo buttons greyed khi stack empty
- [ ] Error State — N/A
- [ ] Form Validation — N/A
- [ ] Button States — Greyed out khi unavailable
- [ ] Toast Feedback — Optional: "Undone: [action label]"
- [ ] Auth Redirect — N/A (part of editor)
- [ ] Mobile 375px — Toolbar buttons accessible
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] User Story approved và linked ở Section 0
- [ ] F05 AI Editor (editorStore) designed

---

## 19. Definition of Done

- [ ] All FR implemented
- [ ] All AC pass
- [ ] 50 history states supported
- [ ] AI generation = 1 undoable action verified
