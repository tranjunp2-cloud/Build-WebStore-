# Phase 03 — Component Library: Scope Tags & Tooltips

## Context
- Issue: GH-1023 Problem 4
- BlockMeta interface: `src/blocks/types.ts:114-145`
- Registry: `src/blocks/registry.ts`
- 50+ block configs under `src/blocks/*/config.ts`
- Editor UI: BlockLibraryPanel (locate exact path via Grep)

## Overview
- Priority: P2
- Status: completed
- Add `scope: 'global' | 'page'` + `scopeTooltip?: string` to BlockMeta; populate for global widgets only (default `'page'` elsewhere); render badge + tooltip in Component Library editor panel.

## Key Insights
- BlockMeta already has `isSystem?: boolean` and `category?` — `scope` slots into the same metadata layer.
- Default `'page'` keeps the migration trivial: only ~5 blocks need explicit `scope: 'global'`.
- Global = `cartWidget`, `socialWidget`, `whatsapp-button`, `navigation` (header), `footer`. Everything else = `'page'`.
- Badge UI is read-only; doesn't change drag-drop or block behavior.

## Requirements
**Functional**
- BlockMeta gains optional `scope: 'global' | 'page'` (default `'page'` if omitted).
- BlockMeta gains optional `scopeTooltip?: string` for hover hint.
- Component Library list renders a badge per block: 🌐 Global (accent color) OR 📄 Page (muted). Hover shows tooltip.
- Filter/sort UI: optional grouping by scope (nice-to-have, NOT required).

**Non-functional**
- Single source of truth: scope lives in `{block}/config.ts`, NOT duplicated in UI.
- TypeScript-enforced: union type, no string drift.

## Architecture
```
src/blocks/types.ts
  BlockMeta { scope?: 'global'|'page'; scopeTooltip?: string }   ← NEW

src/blocks/cart-widget/config.ts          CartWidgetMeta.scope='global'
src/blocks/social-widget/config.ts        SocialWidgetMeta.scope='global'
src/blocks/whatsapp-button/config.ts      WhatsAppMeta.scope='global'
src/blocks/navigation/config.ts           NavigationMeta.scope='global'
src/blocks/footer/config.ts               FooterMeta.scope='global'
[all other blocks default to 'page']

BlockLibraryPanel (editor UI)
  ├─► reads registry.getAllMeta()
  └─► renders <ScopeBadge scope={meta.scope ?? 'page'} tooltip={meta.scopeTooltip} />
```

## Related Code Files
**Modify**
- `src/blocks/types.ts` — add 2 fields to `BlockMeta`
- `src/blocks/cart-widget/config.ts` — `scope: 'global'`
- `src/blocks/social-widget/config.ts` — `scope: 'global'`
- `src/blocks/whatsapp-button/config.ts` — `scope: 'global'`
- `src/blocks/navigation/config.ts` — `scope: 'global'`
- `src/blocks/footer/config.ts` — `scope: 'global'`
- BlockLibraryPanel UI file (locate via `grep -rn "BlockLibraryPanel" src/`)

**Create**
- `src/components/editor/scope-badge.tsx` — small badge component (or inline in BlockLibraryPanel if trivial)

**Read for context**
- All other `src/blocks/*/config.ts` — confirm `'page'` default acceptable (no explicit scope needed)
- `src/blocks/registry.ts` — confirm `getAllMeta()` or equivalent exists

## Implementation Steps
1. Add to `BlockMeta` in `src/blocks/types.ts`:
   ```ts
   /** Editor-only metadata: 'global' = rendered once site-wide, 'page' = per-page block. */
   scope?: 'global' | 'page'
   /** Tooltip text shown on hover over scope badge in Component Library. */
   scopeTooltip?: string
   ```
2. Update the 5 global block configs (cartWidget, socialWidget, whatsapp-button, navigation, footer):
   ```ts
   export const CartWidgetMeta: BlockMeta = {
     // ...existing fields,
     scope: 'global',
     scopeTooltip: 'Hiển thị trên toàn bộ site khi đã bật. Chỉ cần cấu hình 1 lần.',
   }
   ```
   Use Vietnamese tooltips (project convention per user memory).
3. Locate BlockLibraryPanel: `grep -rn "BlockLibraryPanel\|block-library" src/components src/app/(builder) 2>/dev/null`
4. Inside the library item template, render badge:
   ```tsx
   <span
     title={meta.scopeTooltip ?? (meta.scope === 'global' ? 'Global block' : 'Page block')}
     className={meta.scope === 'global' ? 'badge-global' : 'badge-page'}
   >
     {meta.scope === 'global' ? '🌐 Global' : '📄 Page'}
   </span>
   ```
   Styling: use existing badge component from shadcn/ui if available (`Badge` variant `secondary`/`outline`).
5. Verify registry exposes `meta` via `getAllMeta()` (or equivalent). If only `getComponent()` exists, add `getMeta(blockType)`.
6. TypeScript build → no errors.
7. Visual smoke: open editor → Component Library panel → cart/whatsapp/social/nav/footer show 🌐 Global badge with VN tooltip on hover; all others show 📄 Page.

## Todo List
- [x] Add `scope` + `scopeTooltip` to BlockMeta interface
- [x] Set `scope: 'global'` on 5 widgets (cart, social, whatsapp, nav, footer) + VN tooltips
- [x] Verify all 45+ other configs default-to-page (no edits required)
- [x] Locate BlockLibraryPanel
- [x] Render badge + tooltip in library item
- [x] TS build passes
- [x] Visual smoke in editor

## Success Criteria
- Component Library shows badges
- Hover reveals VN tooltip
- TypeScript catches typos (`scope: 'pag'` fails compile)
- Zero behavior change to drag-drop / block ops

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| BlockLibraryPanel not found at expected path | Med | Med | Grep first; if multiple panels exist, update all |
| Some configs use object literal not typed as BlockMeta | Med | Low | TS catches; add `satisfies BlockMeta` cast if needed |
| Badge color clashes with theme | Low | Low | Use shadcn Badge variants which inherit theme tokens |
| Translation gaps (only VN, no EN fallback) | Low | Low | English fallback when tooltip undefined |

## Security Considerations
- Editor-only UI; no auth surface change.
- Static strings only; no injection vector.

## Next Steps
- Phase 05 — test coverage
