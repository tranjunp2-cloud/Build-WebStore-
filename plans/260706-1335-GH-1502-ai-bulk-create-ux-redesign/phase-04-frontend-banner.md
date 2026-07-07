# Phase 04 — Frontend banner: auto-grow textarea + suggestion pills + Sparkles button

## Context Links
- Scout §Frontend, §Reusable UI patterns
- `src/app/(dashboard)/products/page.tsx` — banner L330-363: `<Input>` L340-348, `<Button>` L350-360, `aiPrompt` state L112, `handleCreateAi` L233-235
- Auto-resize pattern: `src/components/editor/AIChatPanel.tsx` L176-185
- `MAX_TEXTAREA_HEIGHT` — see AIChatPanel (constant to mirror; pick a sensible cap e.g. 160px)

## Overview
- **Priority:** High
- **Status:** completed
- Replace the single-line `<Input>` with an auto-growing `<textarea>`, add ≥3 clickable suggestion pills, rename/re-icon the submit button, and switch submit to Cmd/Ctrl+Enter (plain Enter inserts newline).
- **Blocked by:** Phase 03 (i18n keys).
- **Shares `page.tsx` with Phase 05 → run Phase 04 FIRST, then Phase 05. Never parallel.**

## Key Insights
- `handleCreateAi()` already just opens the modal (`setShowBulkCreate(true)`); the modal auto-parses `initialPrompt`. So the banner only needs to (a) collect the prompt into `aiPrompt` and (b) call `handleCreateAi()`. Confirm the modal mount passes `initialPrompt={aiPrompt}` (check L941-949 in Phase 05 scope).
- Extract auto-resize into a small reusable hook `useAutoResizeTextarea` (DRY: identical logic already inline in AIChatPanel; the banner is the second consumer). Keep it ~15 lines — do not over-abstract (YAGNI). Adopting it inside AIChatPanel is optional and OUT OF SCOPE (avoid touching the editor).
- Pills = plain `<button>`s styled with existing Tailwind tokens (no cmdk). Click sets `aiPrompt` to the suggestion text and focuses the textarea.
- Keep the existing gradient banner container + AI icon; only swap the input row + add a pills row.

## Data Flow
```
user types / clicks pill → setAiPrompt(text) → textarea auto-resizes via hook
⌘/Ctrl+Enter or button click (aiPrompt.trim()) → handleCreateAi() → modal opens with initialPrompt=aiPrompt → existing parse flow
```

## Requirements
- Multi-line textarea, auto-grows to a max height then scrolls internally.
- Plain Enter = newline; Cmd/Ctrl+Enter = submit. Button also submits.
- ≥3 suggestion pills below the textarea; clicking fills the textarea.
- Button label from `aiChatBtn` (now "Generate Drafts"), icon `Sparkles` (replace `Plus`).
- All strings via i18n (Phase 03 keys). No hardcoded copy.

## Related Code Files
- **Create** `src/hooks/use-auto-resize-textarea.ts` — hook returning a ref (or accepting ref + value) that resizes on value change; mirror AIChatPanel L178-185 logic + a `maxHeight` param.
- **Modify** `src/app/(dashboard)/products/page.tsx`:
  - Imports: replace `Plus` with `Sparkles` from `lucide-react` (verify `Plus` not used elsewhere before removing); import the new hook; ensure `Input` import removed only if unused elsewhere (grep — likely still used by search box, so keep).
  - Banner block L337-361: swap `<Input>`→`<textarea>` with `ref`, `onKeyDown` (Ctrl/Meta+Enter submit), styled to match design-system input tokens.
  - Add pills row (maps `aiChatSuggestion1..3`), each a button calling `setAiPrompt(...)` + refocus.
  - Update the `<Button>` icon to `<Sparkles/>`.

## Implementation Steps
1. Create `use-auto-resize-textarea.ts`:
   ```ts
   import { useEffect, type RefObject } from 'react'
   export function useAutoResizeTextarea(ref: RefObject<HTMLTextAreaElement | null>, value: string, maxHeight = 160) {
     useEffect(() => {
       const el = ref.current
       if (!el) return
       el.style.height = 'auto'
       const next = Math.min(el.scrollHeight, maxHeight)
       el.style.height = `${next}px`
       el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
     }, [ref, value, maxHeight])
   }
   ```
2. In `page.tsx`, add `const aiTextareaRef = useRef<HTMLTextAreaElement>(null)` and call `useAutoResizeTextarea(aiTextareaRef, aiPrompt)`.
3. Replace `<Input>` with `<textarea ref={aiTextareaRef} value={aiPrompt} onChange rows={1} onKeyDown={...}>`; onKeyDown: `if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && aiPrompt.trim()) { e.preventDefault(); handleCreateAi() }`. Keep placeholder = `aiChatPlaceholder`, resize-none, matching input styles.
4. Add pills row under the textarea:
   ```tsx
   <div className="flex flex-wrap gap-2">
     {[t...aiChatSuggestion1, ...2, ...3].map((s, i) => (
       <button key={i} type="button" onClick={() => { setAiPrompt(s); aiTextareaRef.current?.focus() }}
         className="rounded-full border border-[hsl(var(--primary))]/25 bg-[hsl(var(--background))]/50 px-3 py-1 text-[12px] text-foreground/80 hover:bg-[hsl(var(--primary))]/10 transition-colors">
         {s}
       </button>
     ))}
   </div>
   ```
   Optionally a small `aiChatSuggestionsLabel` above; optional `aiChatHint` helper text.
5. Swap button icon `Plus`→`Sparkles`; keep `variant="dashPrimary" size="dash"` and `aiChatBtn` label.
6. `npm run typecheck` + `npm run lint`; manual smoke: textarea grows, plain Enter newlines, Cmd+Enter opens modal, pill fills textarea.

## Todo List
- [x] Create `use-auto-resize-textarea.ts`
- [x] Textarea replaces Input; auto-resize wired
- [x] Cmd/Ctrl+Enter submits, plain Enter = newline
- [x] 3 suggestion pills fill the textarea on click
- [x] Button icon → `Sparkles`, label via `aiChatBtn`
- [x] typecheck + lint pass

## Success Criteria
- Banner no longer looks like a search box; multi-line entry works.
- Pills visibly populate the textarea; button + Cmd/Ctrl+Enter both open the modal with the prompt.
- No hardcoded strings; icon is Sparkles.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Plain Enter still submits (regression to old UX) | Med | Med | Explicit modifier check + `e.preventDefault()` only on modifier; unit/manual test |
| Removing `Plus` import breaks other usage | Low | Low | Grep `Plus` in page.tsx before removing |
| Textarea height jump / SSR mismatch (`'use client'` page) | Low | Low | Page already client; hook runs in effect post-mount |
| Pills overflow on mobile | Low | Low | `flex-wrap` + small text |

## Security Considerations
- Suggestion text is static i18n; prompt still sanitized server-side in the existing parse route. No new surface.

## Next Steps
- Phase 05 (same file) adds the list dot + tab auto-switch and the modal `onSuccess` change. Do Phase 05 after this to avoid `page.tsx` edit collisions.
