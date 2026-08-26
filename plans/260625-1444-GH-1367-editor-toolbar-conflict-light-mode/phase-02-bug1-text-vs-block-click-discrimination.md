# Phase 02 — Bug 1: Text-vs-block click discrimination

## Context Links
- Issue: #1367 (Bug 1, AC1/AC2)
- File: `src/components/editor/PreviewScripts.tsx`
  - `validTags` (line 30) — includes `'DIV'` (the core defect)
  - `onTextClick()` (lines 310–377) — walk-up loop 324–327, innerText check 349–350
  - `onClick()` block-select (line 433; posts `BLOCK_CONTAINER_CLICKED` line 526)
  - Listener registration: `onTextClick` line 1106 BEFORE `onClick` line 1110 (both on `document`)
- Parent handlers: `PreviewFrame.tsx` `TEXT_EDITING_STARTED` (581), `BLOCK_CONTAINER_CLICKED` (548)

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** Clicking a block's background (a wrapper DIV that has text descendants) makes `onTextClick` walk up to that DIV (in `validTags`) and post `TEXT_EDITING_STARTED`. Because `onTextClick` is registered before the block-select `onClick`, the text message wins and the wrong toolbar shows. Fix = only activate text editing when the click actually landed on a real text node.

## Key Insights
- Two independent issues compound: (a) `'DIV'` in `validTags` lets background wrappers qualify; (b) the innerText check only rejects EMPTY elements, not text-wrapping containers.
- **Discriminator:** `document.caretRangeFromPoint(x, y)` (Chromium/Safari) / `caretPositionFromPoint(x, y)` (Firefox) returns the caret position under the cursor. If the click landed on real rendered text, `range.startContainer.nodeType === Node.TEXT_NODE`. If it landed on padding/background/empty area, the container is an ELEMENT node (or null) → not a text hit → let block selection handle it.
- This is exactly the desired AC1/AC3 behavior: clicking inside an `<h2>`'s padding (not on glyphs) → NOT a text hit → falls through to block toolbar.
- **Minimal combined fix (recommended):** keep removing the structural reliance on DIV by NOT treating a bare DIV as editable UNLESS the caret hit confirms a text node inside it. Concretely: (1) remove `'DIV'` from `validTags`; (2) add a caret text-hit guard at the top of `onTextClick` so even valid inline tags only activate when the cursor is over actual text.
- `caretRangeFromPoint`/`caretPositionFromPoint` are NOT used elsewhere in the file → no collision.

## Why both changes (trade-off analysis — KISS vs safety)
- **Remove `'DIV'` alone?** Insufficient: legit editable text is sometimes a bare DIV; removing DIV could drop valid edits, AND text wrappers that are `<p>`/`<span>` containing nested block text still slip through. Also doesn't fix padding-click-on-h2.
- **Caret guard alone?** Sufficient for most cases but leaves `'DIV'` in `validTags`, so a wrapper DIV whose caret happens to resolve to a descendant text node could still wrongly activate on the *wrapper* (walk-up resolves to DIV, not the text leaf).
- **Both (recommended):** caret guard handles the padding/background case (AC1/AC3); the walk-up still finds the nearest inline text element. Removing `'DIV'` ensures the activated element is a genuine inline/text element, not a layout wrapper — so `contenteditable` is applied to the right node. Safest minimal combination.
- Bare-DIV editable text risk: audit shows editable text in blocks is authored as `h1–h6/p/span/a/button/li/label`. If a bare editable DIV exists, it must carry `data-text-editable` (already an existing opt-in at line 332) — note this as the migration path, not a blocker.

## Requirements
**Functional**
- Click on rendered text glyphs (heading/paragraph/button label, incl. clicks on nested `<b>/<i>/<u>`) → text toolbar (unchanged).
- Click on block background / padding / empty area → block toolbar, NO text toolbar.
- Empty blocks (Logo Cloud, Image Gallery, Spacer, Divider) → any click → block toolbar.

**Non-functional**
- Firefox fallback via `caretPositionFromPoint`.
- No regression to: footer field inline edit (FOOTER channel, line 437), InlineEdit blocks (`whatsapp-button`, `cartWidget` in `noTextEditBlockTypes`), image-placeholder (`data-image-index`, line 334), table wrappers (line 337).

## Architecture
Add a single early-guard helper inside `onTextClick`, before the walk-up loop, using the original `MouseEvent` coordinates.

```
onTextClick(e):
  ... existing closest('[data-editor-control]') / blockContainer / excluded / noTextEdit guards ...
  + isTextHit = clickLandedOnTextNode(e.clientX, e.clientY)   // NEW
  + if (!isTextHit) return        // background/padding click → block selection takes over
  ... existing walk-up loop (now over text tags only, no DIV) ...
  ... existing rejections (data-no-text-edit, image-index, table, innerText) ...

clickLandedOnTextNode(x, y):
  if (document.caretRangeFromPoint):
    r = document.caretRangeFromPoint(x, y)
    return !!r && r.startContainer?.nodeType === Node.TEXT_NODE
  if (document.caretPositionFromPoint):                       // Firefox
    p = document.caretPositionFromPoint(x, y)
    return !!p && p.offsetNode?.nodeType === Node.TEXT_NODE
  return true   // ultra-rare no-support fallback → preserve old behavior (don't break editing)
```

Data flow: `onTextClick` returns early on non-text hits → only `onClick` (block-select) posts → parent shows `BlockActionBar`. On text hits → `TEXT_EDITING_STARTED` posts as before. No parent-side tie-break needed (the iframe now emits exactly one of the two intents). Registration order becomes irrelevant for this case.

## Related Code Files
**Modify**
- `src/components/editor/PreviewScripts.tsx`
  - Line 30: remove `'DIV'` from `validTags` → `[...'H1'..'H6','P','SPAN','A','BUTTON','LI','LABEL']`.
  - In `onTextClick` (after line 319 guards, before walk-up at 321): add `if (!clickLandedOnTextNode(e.clientX, e.clientY)) return`.
  - Add `clickLandedOnTextNode` helper inside the `useEffect` scope (near other helpers).

**Create / Delete:** none.

## Implementation Steps
1. Remove `'DIV'` from `validTags` (line 30).
2. Add `clickLandedOnTextNode(x, y)` helper (caretRangeFromPoint → caretPositionFromPoint → `true` fallback) inside the effect scope.
3. Insert the `if (!clickLandedOnTextNode(...)) return` guard in `onTextClick` AFTER the existing `blockContainer`/`excludedBlockTypes`/`noTextEditBlockTypes` guards (so excluded blocks short-circuit first) and BEFORE the walk-up loop.
4. Do NOT touch `onClick` block-select, FOOTER channel, image-index, or table logic.
5. Compile check `npx tsc --noEmit`.
6. Manual matrix: click heading glyph → text toolbar; click heading padding → block toolbar; click empty Logo Cloud → block toolbar; click `<b>` inside paragraph → text toolbar; click button label → text toolbar; footer field still inline-edits; image placeholder still opens image replace.

## Todo List
- [ ] 02-1 Remove `'DIV'` from `validTags`
- [ ] 02-2 Add `clickLandedOnTextNode` helper (Chromium/Safari + Firefox fallback)
- [ ] 02-3 Add early-return guard in `onTextClick` before walk-up loop
- [ ] 02-4 Verify FOOTER / image-index / table / InlineEdit paths untouched
- [ ] 02-5 Compile check passes
- [ ] 02-6 Manual click matrix (text glyph / padding / empty block / nested b-i-u / button label)

## Success Criteria
- AC1: text node click → text toolbar; background click → block toolbar. ✔
- AC2: empty blocks → any click → block toolbar. ✔ (no text node under cursor → guard returns false).
- No regression: footer inline edit, image replace, table layout, whatsapp/cart InlineEdit all behave as before.
- `npx tsc --noEmit` clean.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `caretRangeFromPoint` unsupported in some browser | Low | Med | `caretPositionFromPoint` Firefox fallback; final `true` fallback preserves legacy editing (never worse than today). |
| Clicking near glyph edge / line-gap resolves to ELEMENT node → text not editable on a real text click | Med | Med | Caret API resolves to nearest text node for clicks within a text line box; padding-only clicks resolve to element. Acceptable per AC3 (padding = block intent). Validate in manual matrix; if too strict, accept clicks where `startContainer` is the target text element itself. |
| Removing `'DIV'` drops a legit bare-DIV editable | Low | Med | Existing `data-text-editable` opt-in (line 332) is the migration path; audit found no bare-DIV editables in current blocks. Document as follow-up if discovered. |
| Click on `<b>/<i>/<u>` inside text returns text node of the child | Low | Low | Desired — caret resolves to the text node; walk-up still finds the nearest valid inline ancestor. |
| Button label click (BUTTON has text node) | Low | Low | BUTTON retained in validTags; caret hits its text node → text toolbar as before. |

## Security Considerations
- `clickLandedOnTextNode` uses only client coordinates from the trusted same-origin event; no new postMessage surface. No `contenteditable` applied unless text confirmed — reduces accidental edit surface.

## Backwards Compatibility / Rollback
- No schema, no persisted data, no message-contract change (same `TEXT_EDITING_STARTED` / `BLOCK_CONTAINER_CLICKED` payloads). Pure client behavior.
- Rollback = revert the 3 edits in `PreviewScripts.tsx`. No cascading impact; phase 01 is independent.

## Next Steps
Feeds phase 03 tests (TC-EDIT-01..05, 09).
