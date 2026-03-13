# User Stories: Undo/Redo (F14)

> **Feature:** F14 — Undo/Redo  
> **PRD:** [F14-undo-redo.md](../prd/F14-undo-redo.md)  
> **Source:** Adapted from ECH Webstore v2 PRD (US-009)

---

## US-009 — Undo / Redo All Changes Including AI

**As a** store owner experimenting with AI edits  
**I want to** be able to undo any change — including AI-generated ones  
**So that** I can experiment freely without fear of breaking my store

### Acceptance Criteria

**AC-1: Undo Keyboard Shortcut**
```gherkin
GIVEN I have made 5 changes (mix of manual + AI)
WHEN  I press Ctrl+Z (or Cmd+Z on Mac)
THEN  the most recent change is reverted
  AND the preview updates within 200ms
  AND the chat panel shows the reverted action greyed out with "Undone" label
```

### Additional Criteria

- [ ] Undo/Redo supports up to 50 history states per editor session
- [ ] Undo/Redo buttons in toolbar show count: "Undo (3)" indicating available steps
- [ ] History persists within the same browser session — cleared on page refresh
- [ ] AI generation of entire store is a single undoable action — one Ctrl+Z reverts the full generation
