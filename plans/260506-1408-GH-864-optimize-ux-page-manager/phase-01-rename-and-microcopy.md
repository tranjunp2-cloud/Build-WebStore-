# Phase 01 — Rename panel + micro-copy + remove search

**Status:** pending
**Effort:** 0.5h
**Owns:** `src/components/editor/PageManagerPanel.tsx`, `src/i18n/locales/{en,ms}.json`

## Overview

Issue #864 §1: rename "Page Manager" → "Page Library", add explanatory micro-copy under title, delete the search input that's not useful given F05's 100-page cap.

## Files to modify

- `src/components/editor/PageManagerPanel.tsx` — strip search state + JSX
- `src/i18n/locales/en.json` — update `editor.pageManagerPanel.title` value, add `microcopy` key
- `src/i18n/locales/ms.json` — same shape

## Files to read for context

- `src/components/editor/PageManagerPanel.tsx:75-102` (searchQuery state + filter)
- `src/components/editor/PageManagerPanel.tsx:241-251` (header block)
- `src/components/editor/PageManagerPanel.tsx:295-304` (search Input)
- `src/i18n/locales/en.json:2768-2775`

## Implementation steps

1. **i18n keys** — in `en.json` and `ms.json`, under `editor.pageManagerPanel`:
   - `title`: change value `"Page Manager"` → `"Page Library"` (and Vietnamese display value matched to issue: `"Thư viện trang"` if site uses vi-via-en convention — confirm w/ PM, see plan §Unresolved Q1).
   - ADD `microcopy`: `"Các trang ở đây dùng để biên tập nội bộ. Để đưa lên website, hãy add chúng vào Menu Settings bên phải."` (issue verbatim).
   - REMOVE keys that become unreferenced after this phase: none (search uses `t.editor.pageManager.searchPlaceholder` which stays for now — phase 02 cleans up).

2. **PageManagerPanel.tsx — header block (~L241-251):**
   ```tsx
   <p className="text-sm font-semibold text-white">{t.editor.pageManagerPanel.title}</p>
   <p className="mt-1 text-xs text-gray-500">{t.editor.pageManagerPanel.description}</p>
   ```
   Replace `description` with `microcopy`. Keep description fallback only if other consumers exist (grep first — none expected).

3. **Remove search:**
   - Delete state: `const [searchQuery, setSearchQuery] = useState('')` (~L75)
   - Simplify `useMemo` (~L83-102): drop `normalizedQuery` + `matchesQuery`. `regularPages` becomes `visiblePages.filter(p => !SYSTEM_PAGE_SLUGS.has(p.slug))`. `page404` stays.
   - Delete the `<Search />` icon import (still needed elsewhere? grep — only used here, drop it).
   - Delete the search `<Input>` block (~L295-304) and its wrapper `<div className="relative">`.

4. **Cleanup:**
   - Run `npx tsc --noEmit` on the file or `npm run typecheck`.
   - Visually confirm in `npm run dev` that header now reads "Page Library" + micro-copy and search is gone.

## Acceptance criteria

- [ ] Header text = "Page Library" (or vi equiv per PM)
- [ ] Micro-copy appears directly below title in `text-xs text-gray-500` size
- [ ] No search input renders in panel
- [ ] No TS errors / unused imports
- [ ] Existing `pageManagerPanel.test.tsx` still passes (or fails only on title assertion — fix in P5)

## Risk

| Risk | Mitigation |
|------|-----------|
| Other consumers reference `searchQuery` or `searchPlaceholder` | Grep — only `PageManagerPanel.tsx` uses them. Safe. |
| Layout collapses without search input height | Spacer kept by `space-y-3` parent; visually verify. |
