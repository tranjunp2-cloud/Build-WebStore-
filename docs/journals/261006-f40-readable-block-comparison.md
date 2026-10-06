---
date: 2026-10-06
status: browser-preview-pending
scope: F40 local UI trial
---

# F40 readable block comparison

## Context

User cannot interpret raw JSON in F40 block comparison. Approved trial: readable paired cards, direct image previews, short differences, collapsed developer evidence. Work stays in current local worktree, not standalone staging branch.

## What changed

- `BlockComparisonPanel.tsx` replaces live F42 block table only; sample comparison mode unchanged.
- Columns explicitly **Kỳ vọng F42** and **PW2 hiện tại**. PW1 source content remains separate disclosure, avoiding false provenance.
- Original block numbering survives filtering; cards separate fields needing attention from collapsed matching fields.
- Primitive text highlights changed segment. Arrays pair items by position, with mixed-type fallback; nested rendering bounded at 20 items/properties and depth 5.
- Missing evidence shown distinctly from empty content. Technical JSON remains available to developers.
- Image previews use Next Image without optimizer proxy, no referrer, safe URL validation, failure message, accessible enlargement dialog.
- Local-only MinIO exception: browser app on localhost/127.0.0.1, image on exactly same hostname with HTTP port 9000 and `/primeweb-media/` path, no credentials/query/hash. Arbitrary other loopback services remain blocked.

## Reflection and decisions

- No API, database, migration-generation or automatic verdict algorithm changes.
- Existing effective status helpers reused with no image-check payload: images can be shown as unverified, never declared wrong solely because URLs differ.
- This compares evidence content, not screenshot equality or complete migration certification.
- Independent review caught mixed array/scalar rendering and inherited dictionary-key hazards; implementation corrected both before final verification.

## Verification and next

- Independent static review: no remaining blockers reported.
- Focused tests: 41/41 passed (15 new block comparison tests including 6 local-media boundary cases, 26 existing tests).
- `tsc --noEmit --incremental false` passed (exit 0). Final scoped ESLint on 3 files passed (exit 0; legacy configuration deprecation only).
- Real-browser verification blocked: sandbox browser launch failed; escalation attempt was aborted and not retried. No screenshot or browser-pass claim.
- Tester owns QA convention/TC documentation; no overlapping edits here.
- No commit, push, PR update or staging deployment requested/performed for this trial.
- Next: record actual test outcomes, user previews local **So Sánh Khối**, then decide further UI refinement.

## User-approved follow-up: simplify disclosures

- User requests only comparison and technical details, no additional dropdowns.
- All fields now render inline in original order, including matching fields. Block filter/count/status behavior unchanged.
- Removed matching-fields and PW1-source disclosures. One **Chi tiết kỹ thuật** disclosure retains entire block JSON, including sourceContent; intro points to that location.
- Follow-up verification: independent static review passed; 42/42 focused tests passed (16 component + 26 existing); scoped lint on 3 files passed (legacy configuration warning only); `tsc --noEmit --incremental false` passed (exit 0). E2E selectors/assertions updated but browser run remains unverified after prior aborted permission.
- Still local-only; no commit or push.

## User-approved follow-up: banners and attention button

- Confirmed root cause: header checkbox changed filter state, but live iframe never applied the filter. It looked inert although state changed.
- Replaced with accessible **Lỗi / cần xem** pressed button with visible active border/check. Enabling live mode selects block comparison; nonlive field comparison retains its functional filter. Disabling stays on current tab.
- Removed only the long catalog evidence explanation and safe-source iframe CSP explanation. Real loading/error, missing source URL and homepage-mismatch warnings preserved.
- No iframe security policy, API, authorization, status or migration changes. Local work only, no commit/push.
- Independent static review passed. Latest automated verification: 43/43 tests passed (17 component/integration + 26 existing migration tests), including actual MigrationDiffClient header toggle from iframe to filtered blocks, toggling off and banner removals.
- `tsc --noEmit --incremental false` passed (exit 0). Scoped lint on 4 files passed with 0 errors and 7 existing hook warnings.
- Browser E2E flow updated but not executed; user/browser preview remains pending. No new browser permission request and no push.

## User-approved follow-up: compact comparison header

- Identity text truncates with title tooltip; domain moves to a short separate line. Header actions retain bounded horizontal scrolling and close remains fixed in header corner.
- Page selectors and comparison modes have separate bounded horizontal scrolling rows, avoiding page-level overflow and wrapped button labels.
- Live preview removes duplicate source/current-page/audit badges. One closed **Thông tin đối chiếu** disclosure holds source, homepage limitation and audit details; switching page resets it closed.
- PW1 **Trang chủ** remains explicit outside disclosure. PW2 address includes selected page name. Missing safe URL has a concise visible message. Actual iframe URLs and safeguards unchanged.
- Attention button's pressed state reflects whether current view actually applies its filter; clicking from an iframe still enables filtering and opens block comparison.
- Reviewer found image enlargement below the outer modal; raised only its overlay/content z-index above the comparison modal. No fetch/security changes.
- Newest scope verification: independent static review passed; 44/44 tests passed (18 component/integration + 26 existing migration); `tsc --noEmit --incremental false` passed; scoped lint 0 errors, 7 existing hook warnings.
- Real-client component tests confirm selected PW2 page URL changes, unchanged PW1 homepage, disclosure content/interaction, QC/Escape/filter behavior and enlargement layering classes. This is not real-browser responsive validation; no screenshot captured and browser preview remains unverified.
- QA TC LIVE14 added by tester. No commit or push.

## Review fixes and per-slide comparison

- Tester captured 9 failing regressions before production edits (18 prior component tests remained green).
- Textual values now preserve raw `text()` serialization; only known structured fields decode JSON. Literal null, exponential/numeric and quoted text retain exact displayed values.
- Missing array positions use explicit undefined handling, distinct from intentionally empty content.
- Image URL policy rejects controls/backslashes before parsing and canonicalizes relative paths against a fixed origin. Root review found a second-stage dot-segment path producing `//host`; normalized protocol-relative paths are also rejected. Existing narrow MinIO boundary unchanged.
- Per-slide status/tint and nested-field highlighting use existing canonical comparison/effective-image helpers; metadata IDs/timestamps do not create differences and image equality is not certified without evidence.
- Two-column cards and one technical disclosure remain unchanged. No backend/schema/migration verdict mutation.
- Final regression run and independent review pending after the last normalized-path guard; browser validation still unavailable. No push.

### Additional URL-policy review

- After normalized-path fix: 55/55 tests passed, typecheck and scoped lint passed.
- Stage-3 review then found local DNS names with a trailing dot bypassing restricted-host checks (`localhost.` family).
- Tester recorded 4/4 new cases failing before edit. Minimal fix strips trailing DNS dots from canonical hostname before classification; local MinIO exception unchanged.
- Final verification after hostname guard: 59/59 tests passed (33 component/integration + 26 existing migration); final scoped component/test lint 0 errors; `tsc --noEmit --incremental false` passed (exit 0).
- 13 regressions demonstrated red-to-green (9 initial and 4 trailing-DNS-dot); 2 normalized-path regressions also passed. Independent review stages 1/2/3 passed with no accepted blockers.
- Browser/user preview remains unverified. No browser run, commit or push.

### F40-only staging PR preparation

- Isolated branch from staging `f173f1dd0`; ported only reviewed UI/tests/docs, preserving standalone missing-source handling and LIVE-12.
- Fresh focused tests: 59/59 passed; TypeScript passed; scoped lint: 0 errors, 7 pre-existing hook warnings.
- Browser QA remains pending. No F42 migration implementation, backend/schema change or merge included.
