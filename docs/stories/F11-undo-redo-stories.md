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
- [ ] 50 history states supported
- [ ] AI generation reverts thành 1 action duy nhất
