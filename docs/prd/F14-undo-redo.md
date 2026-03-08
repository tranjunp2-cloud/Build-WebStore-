# PRD: Undo/Redo System (F14)
> **Version:** 1.0 | **Created:** 2026-03-08 | **Agent:** `project-planner`  
> **Priority:** P0 | **Wave:** 3 | **Size:** M  
> **Depends on:** F05 AI Editor | **Integrated into:** editorStore (Zustand)

---

## 1. Problem Statement

When users make edits (via AI chat, inline edit, or drag-drop), mistakes are irreversible. There's no undo/redo, so any unwanted AI change requires manual reversal. This is a critical UX gap for an editor.

## 2. User Story

```
AS A site owner editing my website
I WANT TO undo/redo any change (AI or manual)
SO THAT I can safely experiment without fear of breaking my site
```

## 3. Acceptance Criteria

### AC-1: Keyboard Shortcuts
```gherkin
GIVEN user is in /editor/:siteId
WHEN  presses Ctrl+Z (or Cmd+Z on Mac)
THEN  last change is undone
AND   preview updates immediately

WHEN  presses Ctrl+Shift+Z (or Cmd+Shift+Z)
THEN  last undone change is redone
```

### AC-2: Toolbar Buttons
```gherkin
GIVEN undo stack has items
THEN  Undo button in toolbar is enabled (not greyed)
AND   clicking it undoes last action

GIVEN undo stack is empty
THEN  Undo button greyed out + disabled
```

### AC-3: AI Change = One Undo Group
```gherkin
GIVEN AI chat response applies 3 changes (theme + hero text + CTA)
WHEN  user clicks Undo
THEN  ALL 3 changes revert as one action (not 3 separate undos)
```

### AC-4: Max History
```gherkin
GIVEN undo stack has 50 items (max)
WHEN  new change is made
THEN  oldest item dropped from stack
AND   new change added
```

## 4. Technical Requirements

### State (in `editorStore`)
```typescript
type UndoAction = {
  id: string
  timestamp: number
  source: 'ai_chat' | 'inline_edit' | 'manual' | 'theme_change'
  label: string // "Changed hero title"
  changes: BlockChange[]
  reverseChanges: BlockChange[]
}

// Rules:
// - New change → clear redoStack
// - Undo → pop undoStack, push to redoStack, apply reverseChanges
// - Redo → pop redoStack, push to undoStack, apply changes
// - Max 50 items in undoStack
```

## 5. 9-Point Done Checklist

- [ ] Loading State — N/A
- [ ] Empty State — Undo/Redo buttons greyed when stacks empty
- [ ] Error State — N/A
- [ ] Form Validation — N/A
- [ ] Button States — Greyed out when unavailable
- [ ] Toast Feedback — Optional: "Undone: [action label]"
- [ ] Auth Redirect — N/A (part of editor)
- [ ] Mobile 375px — Toolbar buttons accessible
- [ ] TypeScript Clean
