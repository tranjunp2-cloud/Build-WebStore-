# Phase 05 — Tests

**Status:** completed
**Effort:** 1.25h
**Owner files:**
- New: `src/__tests__/unit/blocks/announcement-bar.test.tsx`
- Extend: `src/__tests__/unit/blocks/new-blocks.test.ts` (existing TC-F04-NEW-48~51)
**Blockers:** Phase 01-04

## Goal

Achieve full coverage of new behavior. All tests in TC-ID format per `docs/TEST_CONVENTION.md`.

## Test cases

### TC-F05-899-01 — Component renders gradient with default Color 2
Given block `{ variant: 'gradient', message: 'Hi' }` → rendered inline style contains `linear-gradient(135deg,` and falls back to `CSS_VARS.secondary`.

### TC-F05-899-02 — Component renders gradient with custom Color 2
Given `backgroundColor2: '#ff0000'` → inline style contains `#ff0000`.

### TC-F05-899-03 — Component renders solid variant
Given `variant: 'solid', backgroundColor: '#000'` → no `linear-gradient` in style; `backgroundColor: '#000'`.

### TC-F05-899-04 — Component renders minimal variant
`variant: 'minimal'` → `backgroundColor: 'transparent'`, has `borderBottom`.

### TC-F05-899-05 — CTA hidden when linkText empty
`linkText: '   ', linkUrl: '/x'` → no `<a>` in DOM.

### TC-F05-899-06 — CTA visible and clickable
`linkText: 'Shop', linkUrl: '/shop'` → `<a href="/shop">` exists, text contains `Shop`.

### TC-F05-899-07 — paddingY applied
`paddingY: 24` → inner div inline style has `paddingTop: 24px`, `paddingBottom: 24px`.

### TC-F05-899-08 — paddingY default = 12
No `paddingY` field → inline style `paddingTop: 12px`.

### TC-F05-899-09 — dismissible: false hides close button
`dismissible: false` → no `aria-label="Dismiss announcement"` button.

### TC-F05-899-10 — Schema parses new optional fields
Zod parse with all new fields valid; no fields = defaults applied.

### TC-F05-899-11 — Schema rejects out-of-range paddingY
`paddingY: 100` → parse fails (max 32).

### TC-F05-899-12 — Preview renderer gradient branch
`sections.ts` exported function with variant gradient → output contains `linear-gradient(`.

### TC-F05-899-13 — Preview renderer solid branch
Variant solid → output does not contain `linear-gradient`.

### TC-F05-899-14 — Preview renderer minimal branch
Variant minimal → output contains `background:transparent`.

### TC-F05-899-15 — Preview renderer empty linkText
`linkText: ''` → output does not contain `<a `.

## Test infrastructure

- React Testing Library for component (`render`, `screen`, `getByRole`).
- Direct function call for `sections.ts` (string assertion).
- Schema tests use `.safeParse()` on `AnnouncementBarConfigSchema`.

## Acceptance

- [ ] All 15 TCs pass: `npx vitest run src/__tests__/unit/blocks/announcement-bar.test.tsx`
- [ ] Existing `new-blocks.test.ts` (TC-F04-NEW-48~51) still pass
- [ ] No mocks for component logic — import from source per testing rule
- [ ] TC-IDs documented in test file headers

## Risks

- `CSS_VARS.secondary` resolves to a CSS variable string — assert via inclusion of `var(--brand-secondary)` not literal hex.
