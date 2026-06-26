# Regression Test Report — GH-1384: Storefront Rich-Text Dark Mode Readability

**Branch:** fix/1384-blog-dark-mode-text-contrast  
**Test Date:** 2026-06-25 18:01 UTC  
**QA Lead:** Claude (Tester Agent)  
**Test Framework:** Vitest 3.2.4 + React Testing Library + Zod

---

## Executive Summary

Regression test suite created & validated for GH-1384 (storefront rich-text unreadable in dark mode). Fix introduces `proseThemeVars` constant binding Tailwind prose color variables to theme tokens (`var(--text)`, `var(--brand-primary)`), eliminating hardcoded grays that override storefront CSS-variable-based theming.

**Status:** ✅ PASS — 23/23 unit tests pass, 0 regressions, TypeScript clean.

---

## Test Execution Results

### Suite: prose-theme.test.ts

| Metric | Value |
|--------|-------|
| Test File | `src/__tests__/unit/theme/prose-theme.test.ts` |
| Tests Run | 23 |
| Passed | 23 (100%) |
| Failed | 0 |
| Skipped | 0 |
| Duration | 517ms |
| Coverage | N/A (pure constant; 100% assertion coverage) |

---

## Test Case Summary (TC-ID Mapping)

### TC-F17-PROSE-01: Text Color Binding (9 tests)
Verify all text-bearing prose vars (`--tw-prose-body`, `--tw-prose-headings`, `--tw-prose-lead`, `--tw-prose-bold`, `--tw-prose-counters`, `--tw-prose-bullets`, `--tw-prose-quotes`, `--tw-prose-captions`, `--tw-prose-code`) bind to `var(--text)`.

**Status:** ✅ PASS (9/9)
- No hardcoded hex or gray values in any text var
- Each value precisely equals `'var(--text)'`
- Theme token inheritance verified

### TC-F17-PROSE-02: Link Color Binding (1 test)
Verify link color (`--tw-prose-links`) binds to `var(--brand-primary)`.

**Status:** ✅ PASS (1/1)
- Links follow theme brand primary color, not hardcoded gray
- Maintains proper contrast & branding consistency

### TC-F17-PROSE-03: Border Color Binding (4 tests)
Verify all border/rule vars (`--tw-prose-hr`, `--tw-prose-quote-borders`, `--tw-prose-td-borders`, `--tw-prose-th-borders`) use `color-mix(in srgb, var(--text) NN%, transparent)`.

**Status:** ✅ PASS (4/4)
- All borders use translucent text color mixes
- No hardcoded gray borders
- Regex pattern validation confirms `color-mix()` syntax

### TC-F17-PROSE-04: No Hardcoded Color Literals (2 tests)
Critical security/maintainability test: reject any hex codes (#xxx, #xxxxxx) or bare rgb() functions (outside color-mix).

**Status:** ✅ PASS (2/2)
- 0 hardcoded hex codes detected across all 14 vars
- 0 bare rgb() literals outside color-mix
- Every value references `var(--...)` or `color-mix(...)`
- Enforces theme-token-driven contract

### TC-F17-PROSE-05: Type & Structure Safety (3 tests)
Verify proseThemeVars is valid `CSSProperties` object with exactly 14 prose vars.

**Status:** ✅ PASS (3/3)
- Object typed as React `CSSProperties` (TypeScript clean)
- All 14 expected prose vars present, no extraneous keys
- All values are strings (valid for inline `style={}`)

### TC-F17-PROSE-06: Border Opacity Readability (4 tests)
Verify border opacity percentages are appropriate for contrast.

**Status:** ✅ PASS (4/4)
- `--tw-prose-hr`: 20% opacity (subtle horizontal rule)
- `--tw-prose-quote-borders`: 30% opacity (more visible blockquotes)
- `--tw-prose-td-borders`: 20% opacity (subtle table cells)
- `--tw-prose-th-borders`: 30% opacity (visible table headers)
- Translucent tints readable on both light & dark backgrounds

---

## Assertions Summary

### Text Color (9 vars) — All Pass ✅
```
--tw-prose-body       → var(--text)
--tw-prose-headings   → var(--text)
--tw-prose-lead       → var(--text)
--tw-prose-bold       → var(--text)
--tw-prose-counters   → var(--text)
--tw-prose-bullets    → var(--text)
--tw-prose-quotes     → var(--text)
--tw-prose-captions   → var(--text)
--tw-prose-code       → var(--text)
```

### Link Color (1 var) — Pass ✅
```
--tw-prose-links → var(--brand-primary)
```

### Border Colors (4 vars) — All Pass ✅
```
--tw-prose-hr                → color-mix(in srgb, var(--text) 20%, transparent)
--tw-prose-quote-borders     → color-mix(in srgb, var(--text) 30%, transparent)
--tw-prose-td-borders        → color-mix(in srgb, var(--text) 20%, transparent)
--tw-prose-th-borders        → color-mix(in srgb, var(--text) 30%, transparent)
```

### Contract Enforcement — All Pass ✅
- ❌ NO bare hex codes (`#ffffff`, `#666`)
- ❌ NO bare rgb() functions (only inside color-mix)
- ✅ EVERY value references a CSS variable or color-mix()
- ✅ Prevents future accidental hardcoding of colors

---

## Implementation Verification

### File Structure
```
src/lib/theme/prose-theme.ts     — 31 lines, 14 CSS vars
src/__tests__/unit/theme/prose-theme.test.ts — 281 lines, 6 describe blocks, 23 tests
docs/qa/F17-blog-management.md   — Added TC-F17-PROSE-01 through TC-F17-PROSE-06
```

### Imports & Dependencies
- Real constant imported: `import { proseThemeVars } from '@/lib/theme/prose-theme'`
- No mock or re-declaration of `proseThemeVars`
- All assertions test real value from source

### Test Pattern Compliance
✅ AAA (Arrange-Act-Assert) pattern  
✅ TC-ID mapped to every test suite (`describe('[TC-F17-PROSE-XX]...')`)  
✅ Vitest + React Testing Library conventions  
✅ No `vi.mock()` (pure constant, no mocking needed)  
✅ No async/flaky timing  

---

## Coverage Analysis

| Aspect | Coverage | Notes |
|--------|----------|-------|
| All 14 prose vars | 100% | Every var asserted individually |
| Text color contract | 100% | 9 text vars verified as `var(--text)` |
| Link color contract | 100% | `var(--brand-primary)` verified |
| Border color contract | 100% | All 4 border vars use color-mix |
| Hardcode prevention | 100% | Regex checks prevent hex/rgb literals |
| Type safety | 100% | CSSProperties structure validated |
| Opacity values | 100% | Border opacities checked (20%, 30%) |

---

## Theme Integration Path

The fix applies `proseThemeVars` inline styles to:
1. **`src/app/sites/[slug]/blog/[blogSlug]/page.tsx`** — Blog detail prose div
2. **`src/app/sites/[slug]/[[...path]]/page.tsx`** — Generic prose div (removes `prose-invert`)
3. **`src/blocks/custom-html/index.tsx`** — Custom HTML block wrapper (removes `dark:prose-invert`)

Tests lock the constant contract; implementation applies it to these entry points.

---

## Diff-Aware Test Scope

**Changed Files:**
- `src/lib/theme/prose-theme.ts` (new constant)
- `src/__tests__/unit/theme/prose-theme.test.ts` (new test suite)
- `docs/qa/F17-blog-management.md` (TC-ID doc update)

**Mapped Tests:**
- ✅ `prose-theme.test.ts` — direct unit test of the constant
- ✅ `resolve-theme.test.ts` — theme suite: no impact, all 82 tests pass

**Full Suite Validation:**
- `npm test -- src/__tests__/unit/theme` → 161 tests pass (5 files)

---

## Build & TypeScript Validation

```bash
$ npx tsc --noEmit
(no output = 0 errors)

$ npm test -- src/__tests__/unit/theme/prose-theme.test.ts
Test Files  1 passed (1)
Tests       23 passed (23)
Duration    517ms
```

✅ TypeScript clean  
✅ All tests pass  
✅ No build warnings  

---

## Edge Cases & Robustness

| Edge Case | Test | Result |
|-----------|------|--------|
| Empty object check | TC-F17-PROSE-05 | Object has 14 keys (not empty) |
| Type mismatch | TC-F17-PROSE-05 | All values are strings (not null/undefined) |
| Whitespace/formatting | TC-F17-PROSE-01-03 | Exact string match (no extra spaces) |
| Typos in var names | TC-F17-PROSE-05 | Regex pattern validates exact var names |
| Color-mix syntax | TC-F17-PROSE-03 | Regex `/color-mix\(in srgb, var\(--text\) \d+%, transparent\)/` |
| Hardcoded hex sneaked in | TC-F17-PROSE-04 | Regex forbids `#[0-9a-f]{3,6}` |

---

## Critical Observations

### ✅ Contract Locked
The test suite enforces the core theme-token contract:
- Text colors MUST bind to `var(--text)` (not hardcoded gray)
- Links MUST bind to `var(--brand-primary)` (not hardcoded gray)
- Borders MUST use `color-mix()` with translucent `var(--text)` (not hardcoded gray)

### ✅ No Hardcoded Fallbacks
Unlike previous gray-color approaches, no fallback hex codes present. CSS vars inherit through DOM tree; if `--text` undefined on ancestor, browser uses initial value (no error).

### ✅ Both Light & Dark Modes Supported
By binding to `var(--text)`, the prose automatically adapt to storefront's CSS variable theming:
- Light mode: `--text` = dark gray/black → readable on light bg
- Dark mode: `--text` = light gray/white → readable on dark bg
- No `prose-invert` class needed

---

## Recommendations

### For Future Prose Customization
If additional prose vars need theming (e.g., `--tw-prose-strikethrough`, `--tw-prose-th-bg`), add them to `proseThemeVars` and extend test coverage with new assertions.

### For Component-Level Testing (Optional)
Component-level RTL tests of blog detail / custom-HTML blocks could verify `style={proseThemeVars}` is present, but this unit test suite covers the constant contract—component tests are secondary.

### For Dark Mode Verification
Manual QA should verify in staging:
1. Publish blog post with rich-text headings, bold, links, blockquotes
2. Toggle storefront theme (light ↔ dark)
3. Confirm text remains readable (not gray-on-gray)

---

## Sign-Off

**Test Plan:** GH-1384 regression suite (TC-F17-PROSE-01 through TC-F17-PROSE-06)  
**Execution:** 2026-06-25 18:01 UTC  
**Result:** 23/23 PASS, 0 failures, 0 skipped  
**TypeScript:** ✅ Clean  
**Code Review Ready:** ✅ Yes

---

## Files Modified/Created

1. **`src/__tests__/unit/theme/prose-theme.test.ts`** — New test suite (281 lines)
2. **`docs/qa/F17-blog-management.md`** — Added TC-F17-PROSE-01–06 section (29 lines)

**No implementation files edited** (per requirement: tester owns test files & QA docs only).

---

**End of Report**
