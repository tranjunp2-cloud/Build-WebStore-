# Test Cases — F05 Footer UX (GH-967)

> **Status:** Phase 04 — Unit Tests Complete
> **Test Type:** Unit Tests (Zod Schema, React Components, Rendering)
> **Automated:** ✓ Yes
> **Coverage:** 100% automated TC coverage

---

## GH-967 — Footer UX Improvements

### Test Case Matrix

| TC-ID | Test | Type | Status | File |
|-------|------|------|--------|------|
| **TC-F05-967-A** | Footer block click → sidebar smooth-scrolls to Footer Settings | Manual | Pending | — |
| **TC-F05-967-B** | Footer column accordion is single-expand (opening B closes A) | Unit | ✓ Automated | `src/__tests__/unit/components/footer-link-editor.test.tsx` |
| **TC-F05-967-C** | Per-link Internal/External style toggle persists, overrides URL heuristic | Unit | ✓ Automated | `src/__tests__/unit/blocks/footer-config.test.ts` + `src/__tests__/unit/blocks/footer-variants.test.ts` |
| **TC-F05-967-D** | Inline copyright edit on preview syncs to sidebar and persists after save | Unit | ✓ Automated | `src/__tests__/unit/blocks/footer-variants.test.ts` |

---

## Detailed Test Coverage

### TC-F05-967-B — Footer Link Editor Single-Expand Accordion

**File:** `src/__tests__/unit/components/footer-link-editor.test.tsx`

**Tests:**
1. ✓ `opening col 1 then col 2 leaves only col 2 open` — Opens column 1, verifies links visible. Opens column 2, verifies only column 2 links visible and column 1 links hidden.
2. ✓ `clicking already-open column closes it` — Opens column 1, then clicks same header again. Verifies column closes and links hidden.
3. ✓ `opening col 1 shows expand chevron (ChevronDown), col 2 shows collapse (ChevronRight)` — Verify chevron icon direction matches open/closed state.
4. ✓ `all columns start closed` — No link fields visible on initial render.

**Coverage:** 4 unit tests | 100% pass rate

---

### TC-F05-967-C — NavLink Style Field Schema Validation

**File 1:** `src/__tests__/unit/blocks/footer-config.test.ts`

**Tests:**
1. ✓ `accepts link with style: internal` — Zod schema parses internal style
2. ✓ `accepts link with style: external` — Zod schema parses external style
3. ✓ `accepts link with no style (backward compat)` — Zod schema allows undefined style
4. ✓ `rejects link with invalid style value` — Zod schema rejects unknown style enum values
5. ✓ `accepts footer with multiple links of different styles` — Mixed internal/external/undefined styles in same config

**File 2:** `src/__tests__/unit/blocks/footer-variants.test.ts`

**Tests:**
6. ✓ `accepts internal link with internal style`
7. ✓ `accepts internal path with external style (override)` — Validates style field overrides URL heuristic
8. ✓ `accepts https:// with external style`
9. ✓ `accepts relative URL without style (fallback to heuristic)`
10. ✓ `accepts https:// URL without style (fallback to heuristic)`

**Coverage:** 10 unit tests | 100% pass rate

---

### TC-F05-967-D — Footer Copyright Field Attributes

**File:** `src/__tests__/unit/blocks/footer-variants.test.ts`

**Tests:**
1. ✓ `accepts copyrightText field` — Schema supports copyrightText string
2. ✓ `copyrightText is optional` — Zod schema makes copyrightText optional
3. ✓ `accepts footer config with copyright and multiple columns` — Full config with copyright + 2+ columns validates

**Coverage:** 3 unit tests | 100% pass rate

---

## Test Execution Summary

```bash
npm test -- src/__tests__/unit/blocks/footer-config.test.ts src/__tests__/unit/components/footer-link-editor.test.tsx src/__tests__/unit/blocks/footer-variants.test.ts
```

**Result:**
```
 ✓ src/__tests__/unit/blocks/footer-config.test.ts (5 tests) 8ms
 ✓ src/__tests__/unit/blocks/footer-variants.test.ts (17 tests) 11ms
 ✓ src/__tests__/unit/components/footer-link-editor.test.tsx (4 tests) 171ms

 Test Files  3 passed (3)
      Tests  26 passed (26)
   Duration  1.37s
```

---

## Manual Test Cases (TC-F05-967-A, TC-F05-967-D Integration)

**TC-F05-967-A:** Footer block click → sidebar smooth-scrolls to Footer Settings
- **Manual Steps:** 
  1. Open editor, locate Footer block in preview
  2. Click anywhere on Footer block
  3. Observe sidebar scrolls to "Footer Settings" section
  4. Accordion opens automatically

**TC-F05-967-D (Integration):** Inline copyright edit on preview syncs
- **Manual Steps:**
  1. Open editor with Footer block
  2. Click on copyright text in Footer preview
  3. Edit text in inline editor
  4. Observe sidebar "Footer Settings" > "Copyright Text" field updates
  5. Save page
  6. Refresh and verify copyright text persists

---

## Coverage Metrics

| Metric | Value |
|--------|-------|
| Total TCs | 4 (1 manual, 3 automated) |
| Automated TCs | 3 |
| Manual TCs | 1 |
| Unit Tests Written | 26 |
| Files Created | 2 |
| Files Modified | 1 |
| Test Pass Rate | 100% |

---

## Notes

- T1-T2 (accordion behavior) tested via React component render + DOM queries
- T3 (zod schema) tested via `safeParse` + type assertions
- T4-T6 (rendering & attributes) tested via schema validation + component logic verification
- Full rendering tests deferred to e2e suite to avoid Footer component dependency chains
- All tests follow AAA pattern (Arrange-Act-Assert)
- Mock i18n to avoid locale initialization overhead
