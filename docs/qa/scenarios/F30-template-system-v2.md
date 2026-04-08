# Scenario Report: Template System v2

**Feature:** F30 — Template System v2 (4 Sprints)
**Generated:** 2026-04-06
**Source PRDs:** F30-sprint1-foundation.md, F30-sprint2-variants.md, F30-sprint3-industry.md, F30-sprint4-polish.md
**Dimensions analyzed:** All 12 — User Types, Input Extremes, Timing, Scale, State Transitions, Environment, Error Cascades, Authorization, Data Integrity, Integration, Compliance, Business Logic

---

## Scenario Table

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|-----------|----------|----------|-------------------|
| 1.1 | User Types | Free-tier user hits 402 when trying to use a premium industry template | High | Show localized error (EN/MS) explaining upgrade path; never render partial template |
| 1.2 | User Types | Brand-new user with zero sites triggers AI generation — resolveTheme() receives completely empty ThemeConfig | Critical | resolveTheme() must fall back to sensible defaults, not throw or produce invisible text |
| 1.3 | User Types | Existing user with v1 site (only 3 colors, no fontPairingId) opens editor after v2 migration | High | resolveTheme() derives all 7+ tokens from existing primaryColor; site looks identical to pre-migration |
| 1.4 | User Types | Non-technical SMB owner on low-end Android (390px, 2GB RAM) browses template picker with 50+ templates | Medium | Single-column layout, lazy-loaded thumbnails, no jank; hover preview disabled on touch devices |
| 1.5 | User Types | Screen-reader user navigates template picker via keyboard only | Medium | All templates reachable via Tab/Arrow keys, preview announced, selection confirmed audibly |
| 2.1 | Input Extremes | ThemeConfig with primaryColor set to `transparent`, `inherit`, or empty string | Critical | Zod validation rejects invalid color values; resolveTheme() never injects invalid CSS |
| 2.2 | Input Extremes | fontPairingId set to non-existent ID or XSS payload `"xss<script>"` | High | Zod rejects invalid ID; fallback to default font pairing; no XSS via CSS injection |
| 2.3 | Input Extremes | spacingPreset value is `"  COMPACT  "` (extra whitespace, wrong case) | Medium | Zod schema normalizes or rejects; never pass raw string to CSS variable injection |
| 2.4 | Input Extremes | borderRadius `pill` on block with complex nested elements (pricing-table) | Low | All inner elements respect border-radius token; no visual overflow/clipping |
| 2.5 | Input Extremes | Template search query with 500+ chars or special regex chars (`.*+?`) | Medium | Search treats input as literal string; input truncated; no UI freeze |
| 3.1 | Timing | User cancels AI generation at exact moment SSE sends ThemeConfig but before blocks stream | Critical | Form state preserved; no half-written ThemeConfig saved to DB; user can retry without corruption |
| 3.2 | Timing | SSE connection drops at 59s (just before 60s hard timeout), then reconnects | High | AbortController fires at 60s regardless; no zombie SSE connections left open |
| 3.3 | Timing | User rapidly switches between 5 template previews in <1 second (hover debounce race) | Medium | Only last hovered template loads iframe preview; previous cancelled; no memory leak |
| 3.4 | Timing | User double-clicks "Apply Template" button within 50ms | High | Idempotent — template applied exactly once; second click ignored |
| 3.5 | Timing | Seed API called concurrently by two CI runners against same DB | High | Idempotent seed — no duplicate templates; unique constraint or upsert |
| 4.1 | Scale | 50+ templates rendered simultaneously in picker grid on 1280px | Medium | Virtualized list or pagination; DOM nodes <500; no layout thrashing |
| 4.2 | Scale | Single site uses all 38 migrated blocks on one page | High | CSS variable injection <20KB total; no duplicate style tags; render <200ms |
| 4.3 | Scale | Template composer generates theoretical maximum combination of blocks | Medium | Composer caps output at 50+; no exponential blowup in generation time |
| 4.4 | Scale | 100 concurrent users trigger AI generation with SSE simultaneously | High | Server-side SSE pool bounded; excess get 429 with localized message |
| 5.1 | State Transitions | User changes variant on hero (hero-1 → hero-5) — hero has rich content | Critical | All content (text, images, links) preserved after variant swap; only layout changes |
| 5.2 | State Transitions | User changes ThemeConfig while editor has unsaved block content | High | Theme change does not reload page losing unsaved content |
| 5.3 | State Transitions | Switch spacingPreset from `generous` → `compact` on page with 20 blocks | Medium | All blocks re-render with new spacing; no overlaps or truncation; instant (<50ms) |
| 5.4 | State Transitions | User reverts from v2 ThemeConfig (7 colors) back to v1-style (3 colors) via API | High | resolveTheme() backward compat; derived tokens regenerated; no undefined CSS vars |
| 5.5 | State Transitions | Mid-generation SSE: user navigates away, then hits browser Back | Medium | Generation aborted via AbortController; returning shows clean form state |
| 6.1 | Environment | Safari iOS 15 (390px) — CSS `var()` fallback behavior differs from Chrome | High | All 20+ CSS vars have explicit fallback values; no invisible elements |
| 6.2 | Environment | Docker standalone build — SiteRenderer injects 20+ CSS vars at SSR | High | CSS vars in initial HTML (no FOUC); `force-dynamic` export present |
| 6.3 | Environment | Slow 3G (400kbps) — template picker loads 50 thumbnails | Medium | Thumbnails lazy-loaded with skeleton; search/keyboard work before images |
| 6.4 | Environment | RTL text content in Malay with Arabic loanwords mixed with LTR | Low | CSS vars and spacing work regardless of text direction |
| 7.1 | Error Cascades | OpenAI API returns 500 during AI generation → SSE stream breaks mid-token | Critical | Client shows localized 500 error; AbortController cleans up; form state preserved |
| 7.2 | Error Cascades | Playwright thumbnail generation fails for 5/50 templates during seed | High | Seed continues for remaining 45; failed get placeholder thumbnail; error logged |
| 7.3 | Error Cascades | Zod validation fails on ThemeConfig during AI generation | High | Validation caught before DB write; user sees friendly error, not raw Zod |
| 7.4 | Error Cascades | CSS variable injection produces invalid CSS (`--brand-spacing: undefinedpx`) | Critical | SiteRenderer validates tokens before injection; undefined → defaults |
| 7.5 | Error Cascades | Block migration: block has inline `${pc}` AND hardcoded `#hex` in same prop | Medium | Migration replaces only `${pc}`; hardcoded colors intact |
| 8.1 | Authorization | Unauthenticated user accesses SSE generation endpoint directly | Critical | 401 returned immediately; no SSE connection opened |
| 8.2 | Authorization | User A tries to apply template to User B's site via siteId manipulation | Critical | Server validates site ownership; returns 403; no cross-tenant access |
| 8.3 | Authorization | Expired JWT during active SSE generation stream | High | SSE terminates with 401; client redirects to login; partial state cleaned |
| 9.1 | Data Integrity | resolveTheme() called with v1 config missing surfaceColor, mutedColor, accentColor | Critical | Derives missing tokens deterministically from primaryColor; passes Zod |
| 9.2 | Data Integrity | Block variant swap: source has 4 items, target supports max 3 | High | Extra items preserved in data but hidden; switching back restores them |
| 9.3 | Data Integrity | Two browser tabs edit same site's ThemeConfig simultaneously | High | Last-write-wins with optimistic locking; losing tab notified |
| 9.4 | Data Integrity | Seed API run, new block type added, seed again | Medium | Idempotent: existing untouched; new templates added; no duplicates |
| 9.5 | Data Integrity | Font pairing references Google Font that gets removed by Google | Medium | Fallback font stack used; page remains readable |
| 10.1 | Integration | AI → Zod → DB → CSS var injection → visual render (end-to-end) | Critical | No token lost in pipeline; visual matches AI intent |
| 10.2 | Integration | New industry block added to BLOCK_TYPES but missing from db-setup.js | Critical | CI check-migrations.js blocks PR; no runtime crash |
| 10.3 | Integration | Industry block rendered inside SiteRenderer with sharp+compact theme | Medium | Widget respects all design tokens; no hardcoded overrides |
| 11.1 | Compliance | Malaysian content: phone +60, prices MYR (RM), Malaysian postcodes | Medium | Content renders correctly; no auto-formatting corruption |
| 11.2 | Compliance | PDPA: booking-widget collects name, phone, email | High | Data over HTTPS; no client PII logging; privacy notice shown |
| 11.3 | Compliance | Bilingual EN+MS: switching language mid-session on industry template | Medium | All 11 content files have complete MS translations; no mixed-language |
| 12.1 | Business Logic | Template composer assigns doctor-profile block to restaurant template | High | Industry-block affinity rules; medical blocks only in healthcare |
| 12.2 | Business Logic | Free tier user tries template picker for 4th site after hitting limit | High | 402 before generation starts; picker shows upgrade CTA |
| 12.3 | Business Logic | shadowPreset `none` on hero variant that relies on shadow for depth | Low | Hero gracefully degrades to flat design; no invisible elements |
| 12.4 | Business Logic | AI selects decorative fontPairingId for professional medical site | Medium | System prompt has industry font guidance; user can swap |
| 12.5 | Business Logic | 30s SSE warning fires → generation completes at 35s successfully | Low | Warning dismisses on success; success state replaces warning |

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 11 |
| High | 17 |
| Medium | 14 |
| Low | 4 |
| **Total** | **46 scenarios across 12 dimensions** |

### Top 5 Risk Areas

1. **resolveTheme() backward compatibility** (1.2, 1.3, 5.4, 9.1) — Migration 3→7+ tokens highest-risk
2. **SSE generation lifecycle** (3.1, 5.5, 7.1, 8.3) — AbortController + timeout + cancel edge cases
3. **Variant swap content preservation** (5.1, 9.2) — Core Sprint 2 promise; data loss = trust killer
4. **CSS variable injection safety** (2.1, 6.1, 7.4) — Invalid vars can make pages invisible
5. **Cross-tenant authorization** (8.1, 8.2) — Template/SSE endpoints must enforce ownership
