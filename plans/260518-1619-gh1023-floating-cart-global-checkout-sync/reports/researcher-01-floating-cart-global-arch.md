# GH-1023 Research: Floating Cart & Global Component Architecture

## Summary
FloatingCart (cartWidget) is a **per-page block**, not a globally-rendered component. Global components (Header/Footer) use a **site-level config** pattern (`site.headerBlock`, `site.footerBlock`) merged into each page's block array at render time. WhatsApp button shares the same per-page block pattern. No commerce detection hook exists yet.

---

## 1. FloatingCart Component

**Location:** `/src/blocks/cart-widget/`

**Definition:**
- Component: `CartWidgetBlock` (imported in `src/blocks/registry.ts:26`)
- Config schema: `CartWidgetConfigSchema` with variants `['floating', 'inline']` (default: 'floating')
- Meta (`src/blocks/cart-widget/config.ts:18-29`):
  - Type: `'cartWidget'` (camelCase, not kebab)
  - Default variant: `'floating'`
  - Icon: 🛒
  - Category: `'commerce'`

**Visibility Control:**
- **NOT globally rendered** — only renders when explicitly added to a page's block array
- No automatic floating behavior for all pages
- Must be added per-page or via a global site-level config (like header/footer)

---

## 2. Global Component Rendering Pattern

**Architecture:** Site-level blocks injected into EVERY page's block array.

**Files:**
- Site config: `site.headerBlock`, `site.footerBlock` stored in Payload CMS
- Injection logic: `src/components/site-renderer/SiteRenderer.tsx` (lines 80-110+)

**Pattern:**
```typescript
// SiteRenderer.tsx normalizeBlocksForLayout()
const siteHeaderBlock = site.headerBlock as PreviewBlock | null
const siteFooterBlock = site.footerBlock as PreviewBlock | null

if (siteHeaderBlock?.blockType === 'navigation') {
    // Replace or inject header into page blocks
    normalizedHeader = { ...siteHeaderBlock, blockType: 'navigation', __editorBlockIndex: -1 }
}
if (siteFooterBlock?.blockType === 'footer') {
    // Replace or inject footer into page blocks
    normalizedFooter = { ...siteFooterBlock, blockType: 'footer', __editorBlockIndex: -1 }
}
```

**Result:** Every page rendered via SiteRenderer gets Header/Footer prepended/appended automatically via block array mutation.

---

## 3. WhatsApp & Social Floating Components

**Location:** 
- WhatsApp Button: `src/blocks/whatsapp-button/config.ts:8`
- Social Widget: `src/blocks/social-widget/` (inferred from registry)

**WhatsApp Config (`config.ts:8`):**
```typescript
variants: ['floating', 'inline'],
defaultVariant: 'floating',
editableFields: ['phoneNumber', 'countryCode', 'message', 'label', 'position']
```

**Key Finding:** Like cartWidget, WhatsApp is a **per-page block**, not global. The `'floating'` variant is just a component variant option, not auto-rendering behavior.

---

## 4. Website Schema & Pages Data Structure

**Block Registry Pattern** (`src/blocks/registry.ts:121-174`):
```typescript
const REGISTRY: Record<string, BlockRegistryEntry> = {
    cartWidget: { component: CartWidgetBlock, schema: CartWidgetConfigSchema, meta: cartWidgetMeta },
    navigation: { ... },
    footer: { ... },
    'whatsapp-button': { ... },
    socialWidget: { ... },
}
```

**Page Blocks Array:**
- Each page stores `blocks: Array<{ blockType: string, config: unknown, __editorBlockIndex: number }>`
- Block types are keys in REGISTRY (e.g., `'cartWidget'`, `'whatsapp-button'`)
- Config validated against `schema` for that blockType

**Site-Level Schema** (Payload collection):
- `site.headerBlock`: Full block config (typically navigation type)
- `site.footerBlock`: Full block config (typically footer type)
- No field for global `cartWidget` or `whatsappButton` (these remain per-page)

---

## 5. Commerce Detection Hook

**Status:** Does NOT exist.

**Evidence:** No grep results for `useGlobalCommerceCheck`, `useCommerceContext`, `useCheckoutSync`, etc.

**What exists:**
- `src/store/cartStore.ts` — Zustand cart state
- Cart visible/state managed by block presence + client-side Zustand
- No server-side or context-level commerce flag

---

## Architectural Gap (for GH-1023)

**Current state:** 
- FloatingCart renders only on pages where it's explicitly added
- No per-site global toggle to show cart on all pages
- No checkout-sync hook to update cart globally when order completes

**To achieve "global floating cart with checkout sync":**
1. Add `globalCartWidgetConfig?: CartWidgetConfig` to Payload site schema
2. In `SiteRenderer.normalizeBlocksForLayout()`, inject cartWidget block if `site.globalCartWidgetConfig` exists
3. Create `useGlobalCommerceCheck()` hook to detect checkout completion + refresh cart state
4. Trigger hook on success page or via webhook listener

---

## File Paths Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/blocks/registry.ts` | Block component/schema registry | 26, 80, 143 |
| `src/blocks/cart-widget/config.ts` | CartWidget config & meta | 1-32 |
| `src/blocks/whatsapp-button/config.ts` | WhatsApp config (variants) | 8 |
| `src/components/site-renderer/SiteRenderer.tsx` | Global header/footer injection | 80-110 |
| `src/app/(frontend)/layout.tsx` | Frontend layout (uses AppShell) | 1-19 |
| `src/components/AppShell.tsx` | Frontend-only style wrapper | 135-141 |
| `src/store/cartStore.ts` | Zustand cart state | — |

---

**Status:** DONE
**Summary:** FloatingCart is a per-page block (not global); Header/Footer use site-level config injected at render time. Commerce detection hook does not exist and must be created for checkout-sync feature.
