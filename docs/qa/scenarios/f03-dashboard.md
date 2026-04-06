# Scenario Report: F03 Dashboard Suite

**Generated:** 2026-04-05
**Dimensions analyzed:** 11/12 (skipped: Compliance — no PII stored)
**Total scenarios:** 52

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|-----------|----------|----------|-------------------|
| 1 | User Types | New user with 0 sites visits /dashboard | Medium | Show DashboardEmptyState with CTA to /onboarding |
| 2 | User Types | User with multiple sites (3+) visits /dashboard | Medium | Show all recent sites, metrics scoped to active tenant |
| 3 | User Types | User with site but 0 analytics visits /dashboard/analytics | Medium | Show AnalyticsEmptyState |
| 4 | User Types | Staff member with viewer-only role | High | Dashboard visible but no customize/fix actions |
| 5 | User Types | Bot/crawler hitting /dashboard pages | Low | Server-side auth check returns 401/redirect |
| 6 | Input Extremes | Period query param = invalid "99d" | High | parsePeriod() falls back to '7d' |
| 7 | Input Extremes | Period query param = empty string | Medium | Falls back to '7d' default |
| 8 | Input Extremes | Period param = SQL injection attempt | Critical | ORM parameterizes queries |
| 9 | Input Extremes | SEO title > 60 chars from AI | High | truncateSeoTitle() clips to 60 |
| 10 | Input Extremes | SEO description > 160 chars from AI | High | truncateSeoDescription() clips to 160 |
| 11 | Input Extremes | Keyword with unicode/emoji | Medium | Accept or validate |
| 12 | Input Extremes | Add 6th keyword when 5 exist | High | canAddKeyword() returns false |
| 13 | Timing | Two concurrent Fix All requests | High | isFixing guard blocks second |
| 14 | Timing | Navigate away during SSE Fix All | Medium | Fetch abort/cleanup |
| 15 | Timing | Analytics still aggregating during load | Medium | Stale data acceptable |
| 16 | Timing | Rapid period switching | Medium | Latest navigation wins |
| 17 | Scale | 0 analytics docs in current period | Medium | Empty state, metrics all 0 |
| 18 | Scale | 10,000+ analytics docs (hardcoded limit) | Critical | Data silently truncated |
| 19 | Scale | 500+ unique URLs in Top Pages | Medium | mapToTopList() limits to 10 |
| 20 | Scale | 0 pages in SEO analysis | Medium | Empty breakdown shown |
| 21 | Scale | All 4 widgets hidden via customize | High | Empty grid |
| 22 | State Transitions | First time opening customize modal | Medium | Defaults applied |
| 23 | State Transitions | Save customize, reload, verify persistence | High | Saved to tenant.settings |
| 24 | State Transitions | Apply AI fixes, Ctrl+Z undo | Critical | Reverts via backup data |
| 25 | State Transitions | Apply fixes, close browser, undo lost | High | In-memory only |
| 26 | State Transitions | Deselect all fixes, click Apply | Medium | Button disabled |
| 27 | Environment | Mobile 375px stat cards layout | High | Should be 2x2 grid (currently 3-col) |
| 28 | Environment | Mobile customize modal Up/Down | Medium | ArrowUp/Down shown |
| 29 | Environment | RTL locale | Low | May break layouts |
| 30 | Environment | Screen reader on SEO score SVG | Medium | Missing aria-label |
| 31 | Error Cascades | /api/seo/analyze returns 500 | High | Error state with Retry |
| 32 | Error Cascades | /api/seo/fix-all returns 504 | High | Timeout-specific toast |
| 33 | Error Cascades | /api/sites fetch fails on SEO page | High | Toast error, empty state |
| 34 | Error Cascades | /api/seo/apply-fixes fails after generation | High | Toast error, modal stays |
| 35 | Error Cascades | Analytics page payload.find throws | High | Unhandled — hits error boundary |
| 36 | Authorization | Unauthenticated user hits /dashboard | Critical | Redirect to /login |
| 37 | Authorization | Cross-tenant analytics access | Critical | tenantId server-validated |
| 38 | Authorization | Expired JWT during Fix All | High | API 401, no graceful catch |
| 39 | Data Integrity | Unknown event type in analytics | Medium | Counted as "view" |
| 40 | Data Integrity | Duplicate analytics events | Medium | No dedup, counter inflated |
| 41 | Data Integrity | Page deleted between fix generate and apply | High | Should handle missing target |
| 42 | Data Integrity | Malformed referrer URL | Medium | extractReferrerDomain handles |
| 43 | Integration | OpenAI API down during Fix All | High | Error caught in handleFixAll |
| 44 | Integration | Malformed POST to /api/analytics/track | Medium | Should validate, return 400 |
| 45 | Integration | Sitemap for 0 published pages | Medium | Return pageCount: 0 |
| 46 | Business Logic | calcDelta with prev=0, current=0 | Medium | Returns 0 |
| 47 | Business Logic | calcDelta with prev=0, current=500 | Medium | Returns 100 |
| 48 | Business Logic | SEO score boundary: 50, 80 | Medium | 50=warning, 80=good |
| 49 | Business Logic | "revenue" in preferences, no STAT_CARDS key | Medium | Renders null |
| 50 | Business Logic | formatCompactNumber boundary: 999/1000 | Low | 999="999", 1000="1.0K" |
| 51 | Business Logic | Fix All with 0 fixable issues | Medium | toast.info early return |
| 52 | Business Logic | Period "today" timezone edge | High | Server/client mismatch possible |

## Summary

- **Critical:** 5
- **High:** 17
- **Medium:** 23
- **Low:** 4
- **Total:** 52 scenarios across 11 dimensions
