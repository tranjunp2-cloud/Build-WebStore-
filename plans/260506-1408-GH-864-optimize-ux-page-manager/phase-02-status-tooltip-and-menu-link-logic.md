# Phase 02 — Status badge tooltip + menu-link logic

**Status:** pending
**Effort:** 1.5h
**Owns:** `src/components/editor/PageManagerPanel.tsx`, `src/lib/menu-page-links.ts` (NEW), `src/app/(editor)/editor/[siteId]/page.tsx`

## Overview

Issue #864 §2:
- Hover tooltip on Live/Draft badge with explanatory text
- Live badge requires page to be linked from the active menu structure
- Draft when page is new, never added to menu, OR removed from menu

## Files to create

- `src/lib/menu-page-links.ts` — pure helper

## Files to modify

- `src/components/editor/PageManagerPanel.tsx` — extend `getStatusBadge`, wrap badge in Tooltip
- `src/app/(editor)/editor/[siteId]/page.tsx` — pass `menuLinks` prop to `PageManagerPanel`
- `src/i18n/locales/{en,ms}.json` — add `tooltipLive`, `tooltipDraft`

## Files to read for context

- `src/components/editor/NavigationEditor.tsx:27-66` (NavLinkItem type, normalizePageOptionUrl)
- `src/components/editor/SettingsPanel.tsx:277-288` (how editor resolves nav links from headerBlock)
- `src/components/editor/PageManagerPanel.tsx:39-57` (current getStatusBadge)
- `src/app/(editor)/editor/[siteId]/page.tsx:1120-1129` (PageManagerPanel mount)

## Implementation steps

### 1. Create `src/lib/menu-page-links.ts` (pure module, ≤60 LoC)

```ts
import type { NavLinkItem } from '@/components/editor/NavigationEditor'

type PageLite = { id: string; slug: string; isHomepage?: boolean }

/** Strip leading slash + lowercase for stable comparison */
function normalizeSlug(s: string): string {
    if (!s) return ''
    const trimmed = s.trim().toLowerCase()
    return trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
}

/** Walk nav tree and collect page-type link slugs (normalized) */
function collectLinkedSlugs(links: NavLinkItem[]): Set<string> {
    const out = new Set<string>()
    const walk = (items: NavLinkItem[]) => {
        for (const link of items) {
            if (link.type === 'page' && link.url) {
                out.add(normalizeSlug(link.url))
            }
            if (link.children?.length) walk(link.children)
        }
    }
    walk(links)
    return out
}

/**
 * Returns set of page IDs that are referenced by the menu tree.
 * Homepage pages are ALWAYS treated as linked (root "/" implicitly in nav).
 */
export function collectMenuPageIds(
    links: NavLinkItem[],
    pages: PageLite[],
): Set<string> {
    const linkedSlugs = collectLinkedSlugs(links)
    const ids = new Set<string>()
    for (const page of pages) {
        if (page.isHomepage) {
            ids.add(String(page.id))
            continue
        }
        if (linkedSlugs.has(normalizeSlug(page.slug))) {
            ids.add(String(page.id))
        }
    }
    return ids
}
```

### 2. Update `PageManagerPanel.tsx`

a. Add prop:
```ts
interface PageManagerPanelProps {
    // ...existing
    menuPageIds?: Set<string>  // ids of pages linked in menu tree
}
```

b. Extend `getStatusBadge`:
```ts
function getStatusBadge(
    page: PageData,
    labels: { live: string; draft: string; tooltipLive: string; tooltipDraft: string },
    siteStatus?: string,
    menuPageIds?: Set<string>,
) {
    const inMenu = page.isHomepage || menuPageIds?.has(String(page.id)) || false
    const isPageLive =
        page.status === 'published' &&
        siteStatus === 'published' &&
        inMenu

    if (isPageLive) {
        return { label: labels.live, className: '...green...', dotClassName: 'bg-[#00c950]', tooltip: labels.tooltipLive }
    }
    return { label: labels.draft, className: '...gray...', dotClassName: '', tooltip: labels.tooltipDraft }
}
```

c. Wrap badge in Tooltip (use existing `@/components/ui/tooltip`):
```tsx
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

// At panel root, wrap with <TooltipProvider delayDuration={150}>...</TooltipProvider>

// Replace existing <span ...>{statusBadge.label}</span> with:
<Tooltip>
  <TooltipTrigger asChild>
    <span className={...}>{statusBadge.dotClassName ? <span /> : null}{statusBadge.label}</span>
  </TooltipTrigger>
  <TooltipContent side="top">{statusBadge.tooltip}</TooltipContent>
</Tooltip>
```

### 3. Wire `menuPageIds` from editor page

In `src/app/(editor)/editor/[siteId]/page.tsx`:
- Use `headerBlock.links` (already in store) → fallback to nav block in current page (mirroring `SettingsPanel.tsx:277-288`).
- Compute `useMemo(() => collectMenuPageIds(menuLinks, pages), [menuLinks, pages])`.
- Pass to `<PageManagerPanel menuPageIds={menuPageIds} ... />`.

### 4. i18n keys

Add under `editor.pageManagerPanel`:
- `tooltipLive`: `"Trang đã được add vào Menu và đã publish."`
- `tooltipDraft`: `"Trang mới tạo, chưa được add vào menu hoặc đã bị xóa khỏi menu."`

## Acceptance criteria

- [ ] Badge tooltip renders on hover with correct copy for each state
- [ ] Page in menu + published + site published → "Live"
- [ ] Page in menu but page is `draft` → "Draft"
- [ ] Page published but NOT in menu → "Draft"
- [ ] Page in menu, then removed via `NavigationEditor` → re-render switches to "Draft"
- [ ] Homepage always treated as linked (cannot be removed from menu by design)
- [ ] No new TS errors; `collectMenuPageIds` 100% unit-tested in P5

## Risk

| Risk | Mitigation |
|------|-----------|
| Slug normalization mismatch (e.g. `/about` vs `about`) | `normalizeSlug` handles both. Unit tests in P5. |
| `headerBlock.links` shape diverges from `NavLinkItem[]` | Reuse `normalizeNavLinkItems` if needed (already imported in `SettingsPanel.tsx`). |
| Re-render cost on every menu edit | `useMemo` keyed on `menuLinks` ref + `pages`. Editor already re-renders on these. |
