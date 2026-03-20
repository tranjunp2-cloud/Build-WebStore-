# User Stories: Undo/Redo (F11)

> **Feature:** F11 — Undo/Redo
> **Wave:** 3 | **Priority:** P0 | **Ref PRD:** [F11-undo-redo.md](../prd/F11-undo-redo.md)

---

## US-F11-01: Undo / Redo All Changes Including AI

**Wave 3** | **P0** | **M** | **Status:** Draft

### Story

```
As a   store owner đang experiment với AI edits
I want undo bất kỳ thay đổi nào — kể cả AI-generated
So that tôi experiment thoải mái mà không sợ break store
```

### Acceptance Criteria

#### AC-1: Happy Path — Undo via Keyboard

```gherkin
GIVEN I have made 5 changes (mix of manual + AI)
WHEN  I press Ctrl+Z (or Cmd+Z on Mac)
THEN  the most recent change is reverted
  AND the preview updates within 200ms
  AND the chat panel shows the reverted action greyed out với "Undone" label
```

#### AC-2: Redo — Re-apply Reverted Change

```gherkin
GIVEN I have undone a change
WHEN  I press Ctrl+Y (or Cmd+Shift+Z on Mac)
THEN  the previously undone change is re-applied
  AND preview updates within 200ms
```

### Additional Criteria

- [ ] Undo/Redo supports up to 50 history states per editor session
- [ ] Undo/Redo buttons in toolbar show count: "Undo (3)" indicating available steps
- [ ] History persists within same browser session — cleared on page refresh
- [ ] AI generation of entire store là 1 single undoable action — one Ctrl+Z reverts full generation

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] AI generation reverts thành 1 action duy nhất

---

## US-F11-02: Mobile Web UX — Touch-Accessible Undo/Redo

**Wave 3** | **P1** | **S** | **Status:** Ready

### Story

```
As a   mobile user (Store Owner)
I want prominent Undo/Redo buttons since I cannot use keyboard shortcuts (Ctrl+Z)
So that I can quickly fix mistakes while editing on my phone
```

### Acceptance Criteria

#### AC-1: Persistent Mobile Icons

```gherkin
GIVEN the user is on the AI Editor on a mobile device (< 768px)
WHEN  they make a change
THEN  Undo and Redo icons are pinned to a persistent toolbar (Top or Bottom)
  AND the tap targets are at least 44x44px to prevent misclicks
```

#### AC-2: Visual & Haptic Feedback

```gherkin
GIVEN the user taps "Undo" on their phone
WHEN  the action is reverted
THEN  the icon visually flashes or briefly changes color
  AND if supported by the browser, a subtle haptic feedback (vibration) is triggered to confirm the action
```

### Definition of Done

- [ ] 9-Point Checklist pass.


