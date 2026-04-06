# F05 Editor Edit Page — Scenario Report

Generated: 2026-04-05 | Dimensions: 10/12 | Total: 45 scenarios

## Dimensions analyzed
Input Extremes, Timing, State Transitions, Scale, Error Cascades, Authorization, Data Integrity, Business Logic, Integration, Environment

## Dimensions skipped
- Compliance: no PII in block data
- User Types: all users are authenticated site owners (single role)

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|-----------|----------|----------|-------------------|
| 1 | Data Integrity | Block image is full media object instead of integer ID | Critical | normalizeUploadField() extracts .id |
| 2 | Data Integrity | Block _id from builder store sent to Payload | Critical | Strip _id, let Payload auto-generate |
| 3 | Input Extremes | Block headline is undefined/null | High | Set headline = '' |
| 4 | Input Extremes | Nav link missing label | High | Fallback: label='Link' |
| 5 | Input Extremes | Footer column links is null | Medium | Guard Array.isArray before .map() |
| 6 | Data Integrity | Nested array items have stale id | High | stripNestedIds() removes id/_id |
| 7 | Input Extremes | Block image is external URL string | High | normalizeUploadField() returns null |
| 8 | Data Integrity | socialWidget with malformed config | Medium | normalizeSocialWidgetConfig() sanitizes |
| 9 | State Transitions | Preview dedup modifies block array vs store | Critical | REMOVED dedup — arrays must match |
| 10 | State Transitions | Site headerBlock differs from page nav | High | Store init uses same fallback logic |
| 11 | Timing | Iframe postMessage after page switch | Medium | Guard siteId match |
| 12 | Business Logic | Click nav/footer in preview | Medium | excludedBlockTypes filter |
| 13 | State Transitions | Block deleted, iframe has old DOM | High | Iframe refresh after delete |
| 14 | State Transitions | init() with nav+footer + separate headerBlock | High | Keep blocks as-is for index consistency |
| 15 | State Transitions | reset() mid-save, timer orphaned | Medium | reset() clears autoSaveTimer |
| 16 | Timing | pushBatch during undo | Critical | isAIStreaming guard |
| 17 | State Transitions | pushBatch with 0 blocks | Medium | Still updates store |
| 18 | Scale | History exceeds maxHistory(50) | Low | Oldest trimmed |
| 19 | Input Extremes | Create page with duplicate slug | High | Slug uniqueness check |
| 20 | Input Extremes | Delete homepage | Critical | Guard homepage deletion |
| 21 | State Transitions | Soft-delete + undo within 5s | Medium | deletedAt toggle |
| 22 | Timing | Create page + immediate switch | Medium | Optimistic UI |
| 23 | Input Extremes | Page title XSS | High | Sanitize on save |
| 24 | Timing | SSE stream interrupted | High | try/catch JSON.parse |
| 25 | Timing | 2nd AI instruction while streaming | Medium | isProcessing guard |
| 26 | Integration | OpenAI invalid action type | Medium | Default switch case |
| 27 | Input Extremes | AI add_block unknown blockType | High | Registry validation + fallback |
| 28 | Error Cascades | OpenAI 429 rate limit | Medium | User-friendly message |
| 29 | Timing | Auto-save + manual save simultaneous | High | isSaving flag check |
| 30 | Error Cascades | Save fails 3 times + new edits | High | Re-read current state on retry |
| 31 | Timing | Auto-save after page switch | Critical | Use latest currentPageId |
| 32 | Error Cascades | Save 401 JWT expired | High | Stop retry, show login |
| 33 | Input Extremes | Inline edit to empty string | Medium | Set field to '' |
| 34 | Data Integrity | Two blocks with identical text | High | Scope search by blockIndex |
| 35 | Input Extremes | Paste HTML with script tags | Critical | Sanitize pasted content |
| 36 | State Transitions | Drag block past nav/footer | High | Exclude from draggable |
| 37 | Timing | Drop with stale layouts | Medium | Recalculate on drag start |
| 38 | State Transitions | Drag to same position | Low | Skip if from===to |
| 39 | Input Extremes | Invalid hex color | Medium | Validate format |
| 40 | State Transitions | Theme change + rapid refresh | Low | Debounce |
| 41 | State Transitions | Publish with unsaved changes | Critical | Force save first |
| 42 | Timing | Double-click publish | Medium | isPublishing guard |
| 43 | Error Cascades | Publish API fails | High | Only update after success |
| 44 | Environment | Mobile bottom sheet | Low | Overlay dismiss |
| 45 | Environment | Slow network save | Medium | Timeout message |

## Summary
- Critical: 8
- High: 16
- Medium: 16
- Low: 5
- Total: 45 scenarios across 10 dimensions
