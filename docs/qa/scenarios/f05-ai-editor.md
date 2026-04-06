# Scenario Report: F05 AI Editor Split Screen

**Generated:** 2026-04-05
**Dimensions analyzed:** 11/12 (skipped: Compliance)
**Total scenarios:** 60

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|-----------|----------|----------|-------------------|
| 1 | User Types | New user with freshly generated site opens editor | Medium | 3-panel layout loads, initial snapshot created |
| 2 | User Types | Staff with viewer role tries to edit | High | Read-only or restricted save/publish |
| 3 | User Types | User opens editor in 2 tabs simultaneously | High | Last write wins, no corruption |
| 4 | User Types | Bot/scraper hits /editor/:siteId | Low | Auth redirect to /login |
| 5 | Input Extremes | Page name = empty string | High | Validation blocks submission |
| 6 | Input Extremes | Page name = 61 chars | High | Validation blocks (max 60) |
| 7 | Input Extremes | Page slug with unicode diacritics | High | slugifyPageTitle normalizes |
| 8 | Input Extremes | AI prompt > 500 chars | High | Should enforce limit |
| 9 | Input Extremes | XSS in chat prompt | Critical | Sanitized before rendering |
| 10 | Input Extremes | Image upload > 10MB | High | Reject with error |
| 11 | Input Extremes | Invalid image format (.exe) | High | Reject with error |
| 12 | Input Extremes | Slug with special chars | Medium | slugifyPageTitle strips |
| 13 | Input Extremes | Empty chat input submitted | Medium | Early return guard |
| 14 | Timing | AI SSE stream + Undo attempt | Critical | isAIStreaming blocks undo |
| 15 | Timing | 6+ AI requests in 1 minute | High | Rate limit should throttle |
| 16 | Timing | Auto-save during manual save | Medium | isSaving guard prevents double |
| 17 | Timing | Edit → auto-save timer → edit again | Medium | Debounce restarts |
| 18 | Timing | SSE connection drops mid-stream | High | handleAIError catches |
| 19 | Timing | Navigate page while save pending | High | siteId guard + timer cleared |
| 20 | Scale | Site with 0 blocks | Medium | Empty preview, can add blocks |
| 21 | Scale | Site with 100 pages (max) | High | Creation should be blocked |
| 22 | Scale | Undo history at max (50) | Medium | Oldest entry shifted |
| 23 | Scale | 50+ blocks page | Medium | JSON.parse/stringify perf concern |
| 24 | Scale | 0 pages in Page Manager | Medium | Empty state shown |
| 25 | State Transitions | Init → edit → undo → redo | Critical | History navigation works |
| 26 | State Transitions | AI pushBatch → undo → manual edit | Critical | Branch cut-off |
| 27 | State Transitions | Save error → retry backoff | High | 5s, 10s, 20s delays |
| 28 | State Transitions | Save 401 → no retry | Critical | Error set, no retry |
| 29 | State Transitions | Page soft delete → undo toast | High | PATCH restores |
| 30 | State Transitions | Delete undo toast expired | Medium | Page stays deleted |
| 31 | State Transitions | Switch page → modal state stale | Medium | State reset on change |
| 32 | State Transitions | Network offline → auto-save fails | High | BR-07 offline fallback NOT implemented |
| 33 | Environment | Mobile 375px editor layout | High | FAB chat, bottom sheets |
| 34 | Environment | Ctrl+Z / Cmd+Z keyboard | Medium | useUndoRedo hook handles |
| 35 | Environment | Screen reader on iframe | Low | iframe title exists |
| 36 | Environment | Slow network (3G) + AI | Medium | SSE works, timeout risk |
| 37 | Error Cascades | /api/ai/edit-block 500 | High | handleAIError in chat |
| 38 | Error Cascades | /api/ai/rewrite-text empty response | High | Throws, toast error |
| 39 | Error Cascades | /api/sites/:id/save 500 | High | Retry with backoff |
| 40 | Error Cascades | /api/sites/:siteId/pages POST fails | High | Toast error, reset |
| 41 | Error Cascades | /api/media upload 500 | High | Toast error, reset |
| 42 | Error Cascades | iframe postMessage from malicious origin | Critical | Should validate origin |
| 43 | Authorization | Unauthenticated user | Critical | Redirect to /login |
| 44 | Authorization | Cross-tenant site access | Critical | 403/404 response |
| 45 | Authorization | Expired JWT during AI stream | High | SSE drops, error |
| 46 | Data Integrity | Concurrent block updates same index | High | Zustand sync prevents race |
| 47 | Data Integrity | Circular ref in block data | Critical | JSON.stringify throws |
| 48 | Data Integrity | Duplicate page slugs concurrent | High | Server enforces unique |
| 49 | Data Integrity | Deleted page in header nav | Medium | Handle missing refs |
| 50 | Integration | OpenAI API down | High | Error in chat |
| 51 | Integration | Media upload URL mismatch | Medium | Fallback partial match |
| 52 | Integration | Unknown iframe message type | Low | Silently ignored |
| 53 | Business Logic | Homepage cannot be hidden/deleted | Critical | Guards in PageManager |
| 54 | Business Logic | 404 page: slug read-only | High | SYSTEM_PAGE_SLUGS guard |
| 55 | Business Logic | Editor sandbox blocks external links | High | iframe sandbox attr |
| 56 | Business Logic | Unpublish → 503 maintenance | High | Site-level toggle |
| 57 | Business Logic | Publish flow: draft → published | High | PrePublishModal + API |
| 58 | Business Logic | Revenue vs engagement metric | Low | No conflict |
| 59 | Business Logic | Auto-save 3s debounce | Medium | setTimeout 3000ms |
| 60 | Business Logic | Hover 200ms → Edit with AI | Medium | 180ms clear timer |

## Summary

- **Critical:** 9
- **High:** 22
- **Medium:** 19
- **Low:** 4
- **Total:** 60 scenarios across 11 dimensions
