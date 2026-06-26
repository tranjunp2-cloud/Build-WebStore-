# Phase 02 — Contact empty formFields fallback

**Status:** completed · **Priority:** P1 · **Effort:** 20m · **Owns:** `src/blocks/contact/index.tsx`

## Overview

Contact block can render with zero input fields — only a Submit button shows. AI generation produces `formFields: []` (schema default `[]`), and `ContactForm` does `formFields.map(...)` → 0 fields. Fix: fall back to English default fields when `formFields` is empty.

## Validated decisions

- **Labels:** English-only hardcode — consistent with `phoneLabel = 'Phone'`, `addressLabel = 'Address'`, `emailLabel = 'Email'` at line 325. No storefront block calls `getBlockStrings` at render time; labels are i18n-aware at AI generation time, not render time.
- **Fields:** 4 — name (required), email (required), phone (optional), message (required)
- **API verified:** `/api/contact-submit/route.ts` Zod schema has `name`/`email`/`phone`/`message` — all 4 match. Phone is optional.

## Root cause

`src/blocks/contact/index.tsx` — `ContactForm` (line 168) consumes `formFields` directly in two places:
- `requiredFieldNames` (line 169): `formFields.filter(...)`
- render (line 205): `formFields.map(...)`

Empty array → both produce empty output. Saved/old data and AI output both hit this.

## Changes

File: `src/blocks/contact/index.tsx` only. No new imports needed.

**1. Add constant** after `ContactFormProps` type (ends line 156), before the JSDoc/function:
```ts
const DEFAULT_FORM_FIELDS: FormField[] = [
    { fieldName: 'name', label: 'Name', fieldType: 'text', required: true },
    { fieldName: 'email', label: 'Email', fieldType: 'email', required: true },
    { fieldName: 'phone', label: 'Phone', fieldType: 'phone', required: false },
    { fieldName: 'message', label: 'Message', fieldType: 'textarea', required: true },
]
```

**2. Add fallback** inside `ContactForm`, immediately after signature (line 168):
```ts
const fields = formFields.length > 0 ? formFields : DEFAULT_FORM_FIELDS
```

**3. Repoint the two consumers** from `formFields` → `fields`:
- Line 169: `formFields.filter(f => f.required)` → `fields.filter(f => f.required)`
- Line 205: `formFields.map((field, i) => {` → `fields.map((field, i) => {`

## FormField type (config.ts:4)

```ts
type FormField = { label: string; fieldName: string; fieldType?: string; placeholder?: string; required?: boolean }
```

`DEFAULT_FORM_FIELDS` entries satisfy required `label` + `fieldName`; `fieldType`/`required` optional but set.

## Safety — info-only variant

`info-only` variant early-returns at line 483 and never calls `ContactForm` → no risk of injecting default fields into info-only layouts. Fallback scoped entirely inside `ContactForm`.

## Implementation steps

1. Insert `DEFAULT_FORM_FIELDS` constant after line 156.
2. Insert `const fields = formFields.length > 0 ? formFields : DEFAULT_FORM_FIELDS` after line 168.
3. Change line 169 `formFields.filter` → `fields.filter`.
4. Change line 205 `formFields.map` → `fields.map`.
5. Compile check: `npx tsc --noEmit` — `FormField` already imported, expect 0 errors.

## Todo

- [x] Add `DEFAULT_FORM_FIELDS` constant
- [x] Add `fields` fallback line
- [x] Repoint `.filter` (line 169)
- [x] Repoint `.map` (line 205)
- [x] Confirm no other `formFields` use inside `ContactForm` remains
- [x] Compile check passes

## Success criteria

- Contact block with `formFields: []` renders Name/Email/Phone/Message fields.
- Explicit `formFields` still wins (fallback only when empty).
- `requiredFieldNames` validation matches rendered fields (both read `fields`).
- `info-only` variant unaffected.
- Phone shows as optional (required: false).

## Risk

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Missed a third `formFields` reference inside function → validation/render desync | Low | Med | Grep `formFields` within `ContactForm` body after edit; only props destructure + 2 consumers should remain |
| `FormField` not in scope for constant | Very Low | Low | Already imported via `ContactFormProps`; tsc confirms |

## Completion Results

**Completed:** 2026-06-26 · **QA:** Code review 9.5/10, 0 critical issues · **Compile:** tsc --noEmit ✅

- Added `DEFAULT_FORM_FIELDS` constant with 4 fields (name/email/phone/message)
- Added `fields` fallback: `const fields = formFields.length > 0 ? formFields : DEFAULT_FORM_FIELDS`
- Updated `requiredFieldNames` to use `fields` instead of `formFields`
- Updated form render map to use `fields` instead of `formFields`
- No TypeScript errors; all success criteria met
- Contact block with empty `formFields` now renders default fields
- Explicit `formFields` still takes precedence when populated
- `info-only` variant unaffected (early return before form render)

## Rollback

`git checkout src/blocks/contact/index.tsx` — additive, single-file. No schema/data change.
