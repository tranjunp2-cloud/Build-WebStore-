# Investigation Report — GH-899: Announcement Bar Bugs

**Branch:** `feat/F05-899-announcement-bar-cta`
**Date:** 2026-05-07
**Issue:** https://github.com/primeproduction/ech-prime-web-v2/issues/899

---

## Files Audited

| File | Role |
|------|------|
| `src/blocks/announcement-bar/config.ts` | Schema + meta |
| `src/blocks/announcement-bar/index.tsx` | React component |
| `src/components/editor/SettingsPanel.tsx` | Editor settings panel |
| `src/components/site-renderer/SiteRenderer.tsx` | Block rendering + spacing |
| `src/app/api/preview/renderers/sections.ts` | Studio preview renderer |
| `src/lib/admin/block-preview-demo-content-part2.ts` | Demo content |

---

## Bug 1: CTA fields missing from SettingsPanel

**Root cause:** Field name mismatch.

`config.ts:4` defines `linkText` / `linkUrl`. SettingsPanel's generic CTA section (line 1436) renders when `block.ctaLabel !== undefined || block.ctaUrl !== undefined`. Since announcement-bar uses `linkText`/`linkUrl` naming, those conditions never match.

Additionally, `message` (the main bar text) doesn't map to any generic field SettingsPanel renders (headline, body, subtext, tagline, etc.). So announcement-bar has **zero editable fields** in SettingsPanel — only the variant switcher works.

**Evidence:**
```bash
grep -n "linkText\|linkUrl\|announcement" src/components/editor/SettingsPanel.tsx
# → (no output)
```

**Fix needed:** Add dedicated `bt === 'announcement-bar'` section in SettingsPanel with:
- `message` textarea (announcement text)
- CTA toggle (show/hide link group)
- `linkText` input → label for the link
- `linkUrl` input → URL / internal page select
- `backgroundColor` color picker

---

## Bug 2: Variant style mismatch

Two layers to this bug:

**2a — Preview renderer ignores variant (`sections.ts:154-157`)**
```ts
if (bt === 'announcement-bar') {
  return '<div style="background:' + t.primary + ';...>' + message + '</div>'
}
```
Renders solid `t.primary` background regardless of variant. The studio preview for `gradient` and `minimal` look identical to `solid`.

**2b — Component supports only one `backgroundColor` for gradient**
`index.tsx:17-24`: gradient uses `backgroundColor || CSS_VARS.primary` for Color 1 and hardcodes `CSS_VARS.secondary` for Color 2. User cannot control Color 2. Issue asks for two independent color pickers for gradient.

**Config schema** (`config.ts:4`) only has `backgroundColor?: string` — missing `backgroundColor2` for gradient.

**Fix needed:**
- Add `backgroundColor2?: string` to `AnnouncementBarConfigSchema`
- Update component to use `backgroundColor2 || CSS_VARS.secondary` for gradient Color 2
- Fix `sections.ts` preview to branch on variant:
  - `gradient` → linear-gradient
  - `solid` → solid background
  - `minimal` → transparent/border only

---

## Bug 3: Padding slider has no effect (FLOATING_BLOCK_TYPES)

**Root cause:** `SiteRenderer.tsx:25`
```ts
const FLOATING_BLOCK_TYPES = new Set(['socialWidget', 'whatsapp-button', 'cartWidget', 'announcement-bar'])
```

Floating blocks get `spacingStyle = {}` (empty), so `blockSpacing.paddingTop/paddingBottom` is never applied as wrapper padding. But SettingsPanel shows the padding sliders anyway (excludes only `navigation` and `footer` at line 1284).

User drags the slider → value saves to store → SiteRenderer ignores it → no visual change AND potentially confusing/broken UX when user expects the bar height to change.

The component internally hardcodes `py-3 px-6` in `index.tsx:36`.

**Fix needed:** Either:
- Option A (simple): Exclude announcement-bar from the Layout & Spacing sliders in SettingsPanel (add to the `bt !== 'navigation' && bt !== 'footer'` condition). Bar height is controlled internally via padding field in the component.
- Option B (full): Make announcement-bar respond to blockSpacing by passing it as inline style to the inner `div`, and remove from FLOATING_BLOCK_TYPES (or keep it floating but handle spacing differently). The component needs a `paddingY` field or reads from `block.blockSpacing`.

**Recommendation:** Option A for now — announcement-bar is a top banner, fixed compact height makes sense. Add a dedicated internal `paddingY` slider (mapped to a new schema field) if needed.

---

## Summary of Changes Needed

| File | Change |
|------|--------|
| `src/blocks/announcement-bar/config.ts` | Add `backgroundColor2`, `ctaEnabled` toggle to schema |
| `src/blocks/announcement-bar/index.tsx` | Use `backgroundColor2` for gradient Color 2; respect `ctaEnabled` |
| `src/components/editor/SettingsPanel.tsx` | Add announcement-bar section (message, CTA toggle, linkText, linkUrl, color pickers); hide padding sliders for this block |
| `src/app/api/preview/renderers/sections.ts` | Branch on variant for announcement-bar preview |
| Tests | New TCs for CTA render, variant styles, gradient dual-color |

---

## Acceptance Criteria Map

| AC | Root cause(s) | Fix |
|----|---------------|-----|
| AC1: message + ctaLabel editable independently | Bug 1 | SettingsPanel section |
| AC2: link clickable, redirects correctly | Bug 1 | linkText/linkUrl fields + CTA toggle |
| AC3: empty ctaLabel → link disappears | Bug 1 | ctaEnabled toggle or empty-string guard |
| AC4: variant change → correct style | Bug 2a + 2b | sections.ts + backgroundColor2 |
| AC5: padding slider no UI breakage | Bug 3 | Hide sliders OR make them functional |

---

## Questions

1. Should `linkText`/`linkUrl` be renamed to `ctaLabel`/`ctaUrl` to match SettingsPanel's existing generic CTA section? (Would need data migration check for existing sites.)
2. For Bug 3: does the bar need user-controlled height? If yes, Option B (blockSpacing responds). If fixed height is acceptable, Option A (hide sliders) is sufficient.
3. Internal page selection (vs external URL) — is there a page picker component already in the codebase, or use plain text input for now?
