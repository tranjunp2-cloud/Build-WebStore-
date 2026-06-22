# Regression Test Report — GH-1269: onEvent must NOT forward internal 'done' events

**Date:** 2026-06-22  
**Test ID:** TC-F01-EVT.01  
**Issue:** GH-1269  
**Tester:** QA Agent  

## Summary

Added a regression test for GH-1269 bug fix in `src/lib/ai/openai-generator.ts`. The bug was that the `onEvent` callback was forwarding ALL SSE events including the internal `done` event, causing the client to receive duplicate `done` events. The fix filters out `done` events from the forwarded stream (line 104 of openai-generator.ts).

**Status:** DONE ✓

## Test Details

**File:** `src/__tests__/unit/lib/ai/openai-generator.test.ts`

**Test Name:** "does NOT forward internal done event via onEvent [TC-F01-EVT.01]"

**Added After:** "skips unknown block types" test (around line 277)

### Test Structure (AAA Pattern)

**Arrange:**
- Mock OpenAI to return valid AI response with 1 block
- Create callback to capture all events via onEvent
- Set GEN_MODE=ai-first to test OpenAI path

**Act:**
- Call generateSiteWithAI with the onEvent callback
- Capture both internal events array and forwarded events via callback

**Assert:**
1. Internal events array CONTAINS 'done' events (1 or more)
2. Forwarded events via onEvent DO NOT include 'done' 
3. Forwarded events DO include other events (theme_set, step, etc.)

### Coverage

✓ Happy path: AI generation succeeds, events are emitted correctly  
✓ onEvent callback integration: Real-time event forwarding works  
✓ Event filtering: Internal 'done' is blocked while other events pass through  
✓ Test fails without fix: Would fail if line 104 condition removed

## Test Results

```
✓ src/__tests__/unit/lib/ai/openai-generator.test.ts > 
  generateSiteWithAI — OpenAI path [TC-F01.08] > 
  does NOT forward internal done event via onEvent [TC-F01-EVT.01] 1ms
```

**Test execution:** 1.41s (all 21 tests in file)  
**Pass rate:** 21/21 (100%)  
**Failed tests:** 0

## Implementation Details

### Bug Context
- **Root cause:** The `events.push` override (line 99-106) forwarded all items via onEvent without filtering
- **Impact:** Clients received duplicate 'done' events (internal + authoritative from route.ts)
- **Why it matters:** Duplicate 'done' events trigger completion UI twice, confusing users and breaking timing expectations

### Fix Applied
Line 104 in `src/lib/ai/openai-generator.ts`:
```typescript
// Before:
items.forEach(e => onEvent(e))

// After:
// Do not forward internal 'done' — route.ts sends authoritative done
// after image pipeline + DB writes with correct siteId, pageId, siteName.
items.forEach(e => { if (e.event !== 'done') onEvent(e) })
```

### Test Validation

The test verifies:
1. **Regression prevented:** If fix removed, test fails when checking `forwardedDoneCount === 0`
2. **No over-filtering:** Other events still forwarded (assertion: `forwardedEvents.some(e => e !== 'done')`)
3. **Integration complete:** onEvent parameter passed through function signature properly
4. **Real-world scenario:** Uses actual OpenAI mock like production code

## Assertions Breakdown

```javascript
// Verify internal events contain done
const internalDoneCount = internalEvents.filter(e => e.event === 'done').length
expect(internalDoneCount).toBeGreaterThan(0)  // ✓ Passes (=1)

// Verify forwarded events do NOT contain done (core regression test)
const forwardedDoneCount = forwardedEvents.filter(e => e === 'done').length
expect(forwardedDoneCount).toBe(0)  // ✓ Passes

// Verify other events ARE forwarded (no over-filtering)
const hasOtherEvents = forwardedEvents.some(e => e !== 'done' && e !== '')
expect(hasOtherEvents).toBe(true)  // ✓ Passes
```

## TC-ID Reference

**TC-F01-EVT.01** — Events subsystem regression test for onEvent filtering  
Category: F01 (AI Builder) — Events (EVT)  
Related: GH-1190 (event forwarding feature), GH-1269 (this bug fix)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Test too strict (brittle) | Uses flexible `.toBeGreaterThan(0)` and `.some()` for event counts |
| Mock doesn't match real OpenAI | Uses same pattern as other tests in file; matches real SSE structure |
| onEvent callback timing | Events captured at push time, not after async calls (synchronous capture) |

## Unresolved Questions

None. Test is complete and all assertions pass.

## Recommendations

1. **Merge:** Test is ready for merge to staging
2. **Future:** Consider adding test for onEvent with fallback path (when OpenAI unavailable) to ensure filter works there too
3. **Monitoring:** Monitor GH-1269 issue on staging/production for any duplicate 'done' event reports after merge

## Files Modified

- `src/__tests__/unit/lib/ai/openai-generator.test.ts` — Added TC-F01-EVT.01 test (55 lines)

## Test Command

```bash
npm test -- src/__tests__/unit/lib/ai/openai-generator.test.ts -t "does NOT forward"
```

Or run full suite:
```bash
npm test -- src/__tests__/unit/lib/ai/openai-generator.test.ts
```

---

**Test Author:** QA Tester Agent  
**Status:** Ready for Code Review  
**Next Step:** Commit with fix to staging branch
