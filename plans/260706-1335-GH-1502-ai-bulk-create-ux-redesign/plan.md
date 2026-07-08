---
title: "GH-1502 (F08) — Redesign AI Chat bulk-create UX on Products page"
description: "Textarea + suggestion pills + draft-preview wording + AI-review pulse dot; new aiReviewPending flag cleared on edit/activate."
status: completed
priority: P2
effort: 8.5h
branch: feat/GH-1502-ai-bulk-create-ux-redesign
tags: [F08, products, ai, ux, i18n, migration]
created: 2026-07-06
---

# GH-1502 — AI Chat bulk-create UX redesign

> Issue: https://github.com/primeproduction/ech-prime-web-v2/issues/1502
> Scout: `plans/reports/scout-260706-1327-GH-1502-ai-bulk-create-ux.md`
> Branch: create `feat/GH-1502-ai-bulk-create-ux-redesign` off `staging` (do NOT reuse current `fix/GH-1479-*`).

## Goal

Make the `/products` "AI Chat" section unambiguous and low-fear: multi-line textarea (not a search box), suggestion pills, draft-preview wording, and a persistent "AI-created, needs review" pulse dot on generated drafts that clears on manual edit or activation. Backed by a new `aiReviewPending` boolean column.

## Phases

| # | Phase | Status | Owns (files) | Blocked by |
|---|-------|--------|--------------|-----------|
| 1 | [DB schema field + migration](phase-01-db-schema-ai-review-pending.md) | done | `src/collections/Products.ts`, `scripts/db-setup.js` | — |
| 2 | [Backend actions: set + clear flag](phase-02-backend-actions-flag-lifecycle.md) | done | `src/app/(dashboard)/products/actions.ts`, `src/components/dashboard/BulkCreateModal.tsx` | 1 |
| 3 | [i18n keys EN + MS](phase-03-i18n-strings.md) | done | `src/i18n/locales/en.json`, `src/i18n/locales/ms.json` | — |
| 4 | [Frontend banner: textarea + pills + button](phase-04-frontend-banner.md) | done | `src/app/(dashboard)/products/page.tsx` (banner), `src/hooks/use-auto-resize-textarea.ts` NEW | 3 |
| 5 | [Frontend list: pulse dot + auto-switch tab](phase-05-frontend-list-indicator.md) | done | `src/app/(dashboard)/products/page.tsx` (type/list/mount), `src/components/dashboard/AiReviewIndicator.tsx` NEW | 1, 3, 4 |
| 6 | [Tests: update + new lifecycle](phase-06-tests.md) | done | test files only | 1, 2, 4, 5 |

## Dependency graph

```
1 ─┬─> 2 ──────────┐
   └─> 5 ──┐       │
3 ─┬─> 4 ──┤       │
   └─> 5 ──┴─> 6 <─┘
```

- P1 unblocks P2 (actions write the column) and P5 (list reads `Product.aiReviewPending`).
- P3 (i18n) unblocks P4 and P5 — UI references new `t.*` keys; typecheck fails if keys absent, so i18n lands first.
- **P4 and P5 both edit `page.tsx` → MUST run sequentially (P4 then P5). Never parallelize these two.**
- New files (`use-auto-resize-textarea.ts`, `AiReviewIndicator.tsx`) are cleanly isolated.

## Key decisions (locked by user — do not re-litigate)

- Field is `aiReviewPending` boolean checkbox (NOT a `source` select). Follows `hasVariants`/`halalCertified`.
- Clear flag (`false`) on BOTH manual save (`saveProductAction` update path) AND status→`active` (`updateProductFieldAction`).
- Remove `router.refresh()` in `BulkCreateModal.handleSave`; rely on `onSuccess()` → parent `loadProducts()` + `setFilterStatus('draft')`.
- Suggestion pills = simple custom buttons from existing `ui/` primitives (no cmdk/Command dependency).
- Auto-resize extracted to a small shared hook `useAutoResizeTextarea` (used by banner; AIChatPanel adoption optional/out-of-scope).
- Pulse dot = plain Tailwind `bg-emerald-400 animate-pulse` + existing `ui/tooltip.tsx`. `--ai-glow` var NOT required.

## Migration / backward-compat

- Column added `DEFAULT false` → all existing rows non-flagged; no dot on legacy products. No data backfill.
- `NEVER DROP` — `ADD COLUMN IF NOT EXISTS`. Rollback = leave column (harmless) or drop manually; no code depends on it once reverted.

## Success criteria (observable)

1. `node scripts/check-migrations.js origin/staging` passes.
2. Bulk-created drafts show emerald pulse dot + tooltip; dot disappears after Save-edit or toggling Active.
3. After Generate → list auto-switches to Draft tab, no full-page reload, new drafts on top.
4. Button reads "Generate Drafts" (EN) / MS equiv with Sparkles icon; textarea multi-line, Cmd/Ctrl+Enter submits.
5. `npm run typecheck`, `npm run lint`, `npm test` all green; no hardcoded UI strings.

## Validation Summary

**Validated:** 2026-07-06
**Questions asked:** 4

### Confirmed Decisions
- **Sort order on auto-switch:** Force-reset to `sortBy='Latest'` (state at `page.tsx` L113, setter `setSortBy`) together with `setFilterStatus('draft')` in the modal `onSuccess` — guarantees new drafts land on top regardless of the merchant's prior sort choice. (Overrides Phase 05's original "out of scope" call.)
- **TC-ID numbering:** Confirmed by reading `docs/qa/F08-product-crud.md` — highest existing ID is `TC-F08-04-33` (plus `TC-F08-04-32b`). Proposed `TC-F08-04-34..41` in Phase 06 are free/non-colliding — use as-is, no renumbering needed.
- **Suggestion pill copy:** Use the EN/MS wording exactly as drafted in `phase-03-i18n-strings.md` — no further review needed.
- **TooltipProvider risk — resolved, not just accepted:** Verified `src/app/(dashboard)/layout.tsx:85` already wraps the entire dashboard route group (incl. `/products`) in `<TooltipProvider delayDuration={300}>`. `AiReviewIndicator` (Phase 05) does **not** need its own `TooltipProvider` wrapper — matches how `MissingInfoIndicator` already works unwrapped. Phase 05's risk table entry for this is downgraded from "Med likelihood" to confirmed-safe.

### Action Items
- [ ] Phase 05: in modal `onSuccess` (L941-949), add `setSortBy('Latest')` alongside `setFilterStatus('draft')`.
- [ ] Phase 05: update risk table — remove/downgrade the "Tooltip has no Provider" risk row (confirmed present at `layout.tsx:85`); no wrapping code needed.
- [ ] Phase 06: proceed with `TC-F08-04-34..41` as final IDs (confirmed non-colliding).
