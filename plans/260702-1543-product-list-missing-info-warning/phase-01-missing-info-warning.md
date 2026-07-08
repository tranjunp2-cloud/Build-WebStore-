# Phase 01 — Missing-info warning (helper + indicator + desktop & mobile + i18n)

## Context Links

- Issue: GH-1457 (F09, P1, area:frontend)
- Target file: `src/app/(dashboard)/products/page.tsx`
- i18n: `src/i18n/locales/en.json`, `src/i18n/locales/ms.json` (keys under `dashboard.products.list.*`)
- Tooltip primitives: `src/components/ui/tooltip.tsx`
- TooltipProvider mount (already present): `src/app/(dashboard)/layout.tsx:85` (`delayDuration={300}`)
- Design token: `--warning` (globals.css light `#D97706` / dark `#F59E0B`; `tailwind.config.js:107` → `warning: hsl(var(--warning))`)

## Overview

- **Priority:** P1
- **Status:** completed
- **Description:** Add soft, read-only warning UI (icon + left border + hover tooltip) to Product List desktop table rows and mobile cards for products missing ALT text and/or category. No warning UI for complete products. No behavior/schema change.

## Key Insights

- Two independent render paths for the same list: desktop table (lines 697-782) and mobile card (lines 791-901). Both must get the indicator + border → share logic via one helper + one component (DRY).
- **`AlertTriangle` is NOT imported** — line 8 imports `AlertCircle, RefreshCw, SearchX, Pencil, Trash2, Plus, Tag`. Add `AlertTriangle` to that line (no duplicate import).
- **Tooltip not imported** — add `import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'`. Do NOT add/wrap `TooltipProvider` — it is already mounted in the dashboard layout.
- **Preflight is OFF** (table.tsx header comment): Tailwind `border-*` utilities render invisible. The left-warning-border MUST be inline full CSS shorthand (`borderLeft: '2px solid hsl(var(--warning))'`), never `border-l-2 border-warning`.
- **Desktop `<tr>` borders are unreliable under `border-collapse`** (`.dash-table`). Apply the desktop left border to the **first `TableCell`** (thumbnail cell, line 711) via inline style, not to `TableRow`. Mobile card applies it to the card wrapper div (line 798-802), which is a normal block box.
- The `Product` type (lines 56-75) already has `category?: (Category|string)[]` and `images?: Array<{image; alt?}>` — no type change.
- Locales are **English + Malay** (`en.json`, `ms.json`) — add keys to both.
- Data already available: `getProductsAction` fetches `depth:1`; `images[].alt` and `category` present in list payload. Pure display feature.

## Requirements

**Functional**
- Product missing ALT and/or category → `AlertTriangle` icon (warning color) next to product name + warning left border on its row (desktop) and card (mobile).
- Hover the icon → tooltip listing exactly which of the two fields are missing (dynamic per product).
- Product with both present → no icon, no border, no tooltip.
- Existing interactions unchanged: click row/card → quickview, status toggle, edit/delete, SKU display.

**Non-functional**
- No hardcoded colors (use `text-warning` / `hsl(var(--warning))`).
- Tooltip adapts to light/dark via existing CSS vars (no `dark:` classes).
- Icon click must NOT trigger row/card click-to-quickview (stopPropagation on the tooltip trigger wrapper).

## Architecture

**Updated 2026-07-02 per plan validation — see plan.md `## Validation Summary`:**
- `getMissingFields` + `MissingField` type move to a new shared file `src/lib/products/missing-fields.ts` (not local to `page.tsx`), so `SEOView.tsx`/`OverviewView.tsx`'s existing `productMissingAltCount` concept can reuse it later without touching this issue's scope today.
- `MissingInfoIndicator` moves to a new shared component file `src/components/dashboard/MissingInfoIndicator.tsx`.
- Tooltip trigger is a focusable `<button type="button" aria-label={...}>` (not a plain `<span>`), so the tooltip is reachable via Tab/focus, not hover-only. Radix `Tooltip` shows on focus by default for a focusable trigger under `asChild`.

Data flow (read-only):
```
getProductsAction (depth:1) → paginatedProducts[]
  → getMissingFields(product): MissingField[]        (pure fn, src/lib/products/missing-fields.ts)
      → [] (complete)  → render nothing, no border
      → ['alt'|'category', ...] → <MissingInfoIndicator missing t/> + inline left border
```

- `getMissingFields(product: Product): MissingField[]` — pure fn in `src/lib/products/missing-fields.ts`, exported alongside `MissingField` type. Returns subset of `['alt','category']`. No `t` dependency. `page.tsx` imports it; the `Product` type used by the fn can be a minimal structural type (`{ images?: {alt?:string}[]; category?: unknown[] }`) to avoid a circular/heavy import from `page.tsx`.
- `MissingInfoIndicator({ missing, t })` — presentational component in `src/components/dashboard/MissingInfoIndicator.tsx`. Renders `null` when `missing` empty; else `Tooltip` wrapping a focusable `AlertTriangle` trigger + `TooltipContent` bulleted list. `t` typed as `ReturnType<typeof useI18n>`.
- Both render paths (desktop + mobile, in `page.tsx`) compute `const missing = getMissingFields(product)` once at the top of their `.map` callback (alongside existing `imgUrl`/`inv` consts), pass to the indicator, and use `missing.length > 0` for the inline border.

Indicator sketch (for reference — implementer writes final):
```tsx
// src/lib/products/missing-fields.ts
export type MissingField = 'alt' | 'category'
export function getMissingFields(p: { images?: { alt?: string }[]; category?: unknown[] }): MissingField[] {
  const m: MissingField[] = []
  if (!p.images?.length || !p.images[0]?.alt) m.push('alt')
  if (!p.category?.length) m.push('category')
  return m
}
```
```tsx
// src/components/dashboard/MissingInfoIndicator.tsx
import { AlertTriangle } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { MissingField } from '@/lib/products/missing-fields'
import type { useI18n } from '@/i18n'

export function MissingInfoIndicator({ missing, t }: { missing: MissingField[]; t: ReturnType<typeof useI18n> }) {
  if (!missing.length) return null
  const label = (k: MissingField) =>
    k === 'alt' ? t.dashboard.products.list.missingAlt : t.dashboard.products.list.missingCategory
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t.dashboard.products.list.missingInfoTitle}
          onClick={e => e.stopPropagation()}
          className="inline-flex shrink-0 cursor-help items-center justify-center"
        >
          <AlertTriangle className="w-4 h-4 text-warning" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium mb-1">{t.dashboard.products.list.missingInfoTitle}</p>
        <ul className="list-disc pl-4">
          {missing.map(k => <li key={k}>{label(k)}</li>)}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}
```

Desktop wiring:
- First `TableCell` (thumbnail, line 711): add inline `style={{ borderLeft: missing.length ? '2px solid hsl(var(--warning))' : undefined }}`.
- NAME cell (lines 718-729): wrap the name `<span>` and the indicator in a flex row (`<div className="flex items-center gap-1.5 min-w-0">`), keeping the existing `truncate` on the name span and putting `<MissingInfoIndicator />` after it (shrink-0 so it never truncates).

Mobile wiring:
- Card wrapper div (798-802): add inline `style={{ borderLeft: missing.length ? '2px solid hsl(var(--warning))' : undefined }}` (div already has rounded/overflow-hidden — left border renders fine).
- Name block (line 812-814): place `<MissingInfoIndicator />` next to the name; wrap name text + indicator in `flex items-center gap-1.5 min-w-0`, keep `truncate` on the name.

## Related Code Files

**Modify**
- `src/app/(dashboard)/products/page.tsx` — import `getMissingFields` + `MissingInfoIndicator`; desktop first-cell border + name-cell indicator; mobile card border + name-block indicator.
- `src/i18n/locales/en.json` — add `dashboard.products.list.{missingInfoTitle,missingAlt,missingCategory}`.
- `src/i18n/locales/ms.json` — same keys, Malay.

**Create**
- `src/lib/products/missing-fields.ts` — `MissingField` type + `getMissingFields()` pure fn.
- `src/components/dashboard/MissingInfoIndicator.tsx` — presentational component (focusable button trigger + Tooltip).

**Delete**: none.

## Implementation Steps

1. Create `src/lib/products/missing-fields.ts` — `MissingField` type + `getMissingFields()` pure fn (see Architecture sketch).
2. Create `src/components/dashboard/MissingInfoIndicator.tsx` — imports `AlertTriangle` from `lucide-react`, `Tooltip`/`TooltipTrigger`/`TooltipContent` from `@/components/ui/tooltip`, `MissingField` from the new lib file. Trigger is a focusable `<button type="button" aria-label>` (keyboard-accessible), `onClick` stops propagation.
3. In `page.tsx`: import `getMissingFields` and `MissingInfoIndicator` from the new files (no need to add `AlertTriangle`/`Tooltip` imports directly to `page.tsx` — they live in the new component).
4. Add i18n keys to `en.json`: `missingInfoTitle: 'Missing information'`, `missingAlt: 'Image alt text'`, `missingCategory: 'Category'`.
5. Add i18n keys to `ms.json`: `missingInfoTitle: 'Maklumat tidak lengkap'`, `missingAlt: 'Teks alt imej'`, `missingCategory: 'Kategori'`.
6. Desktop map (line 697): add `const missing = getMissingFields(product)`; add inline `borderLeft` to first `TableCell`; refactor NAME cell to flex row with `<MissingInfoIndicator missing={missing} t={t} />` after the name span.
7. Mobile map (line 791): add `const missing = getMissingFields(product)`; add inline `borderLeft` to card wrapper div; add indicator next to name in the name block.
8. Run `npx tsc --noEmit` (or project typecheck/lint) — fix any type errors (esp. `t` typing).
9. Manual/visual check per Success Criteria.

## Todo List

- [x] Create `src/lib/products/missing-fields.ts` (`getMissingFields` + `MissingField`)
- [x] Create `src/components/dashboard/MissingInfoIndicator.tsx` (focusable button trigger, renders null when complete, stopPropagation)
- [x] i18n keys in `en.json` (3)
- [x] i18n keys in `ms.json` (3)
- [x] Desktop: first-cell inline left border + name-cell indicator (flex, keep truncate)
- [x] Mobile: card-wrapper inline left border + name-block indicator (flex, keep truncate)
- [x] Typecheck/lint clean

## Success Criteria

- Product missing ALT and/or category shows warning icon + left border on desktop row AND mobile card.
- Hovering the icon shows a tooltip whose bullets match exactly the missing fields for that product (verify a category-only-missing, an alt-only-missing, and a both-missing product).
- Product with both fields present renders no icon, no border, no tooltip.
- Clicking the icon does NOT open quickview; row/card click, status toggle, edit/delete unchanged.
- Tooltip legible in both light and dark; no hardcoded hex/amber literal in the diff.
- `tsc --noEmit` and lint pass.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Desktop `<tr>` inline border invisible under `border-collapse` | High | Med | Apply border to first `TableCell`, not `TableRow` (per plan); if still faint, fallback `boxShadow: inset 2px 0 0 hsl(var(--warning))` on the cell |
| Tailwind `border-*` utility renders nothing (preflight off) | High | Med | Use inline full CSS shorthand for the border; icon color uses `text-warning` (color utility, unaffected) |
| Icon click bubbles to row → opens quickview | Med | Med | `onClick={e => e.stopPropagation()}` on tooltip trigger wrapper |
| Long product name pushes icon off / truncates icon | Med | Low | Name span keeps `truncate min-w-0`; indicator `shrink-0` outside the truncation |
| i18n key added to only one locale → runtime undefined | Low | Med | Add all 3 keys to both `en.json` and `ms.json` in same phase; typecheck if i18n is typed |
| `TooltipProvider` missing on this route | Low | High | Confirmed already mounted in dashboard layout (line 85) — no action, just do not double-wrap |

## Security Considerations

- Read-only display feature; no new inputs, no data mutation, no new network calls.
- Product name/category rendered as React text nodes (auto-escaped) — no XSS surface introduced.
- No auth/permission change (same page, same data already authorized).

## Next Steps

- After implementation: `tester` (component render logic + missing-field matrix), then `code-reviewer`, then `git-manager` (`feat(products): soft-warn products missing alt/category`, `Relates to #1457`, PR → staging). These run post-`/cook` per `.claude/rules/workflow.md` — not part of this plan doc.
- Docs impact: minor/none — display-only; docs-manager can note in CHANGELOG if desired.
