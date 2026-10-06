---
title: F40 readable block comparison trial
status: in-progress
---

# F40 readable block comparison trial

## Approved design

Replace only live F42 block JSON table with readable comparison cards. Keep original block numbering, show expected F42 versus current PW2 values, thumbnails and individual list items. Collapse matching fields and raw technical evidence. Original PW1 source is a separate disclosure, not mislabeled expected data.

## Review

Presentation-only scope: no API, schema, migration or automatic verdict changes. Existing effective status helpers distinguish image checks from URL differences. This screen has no image check/review payload: pass empty evidence explicitly and show unverified rather than claiming image failure. Image failure is a display failure, not migration failure. Browser image fetches use validated HTTP(S)/relative URLs, no optimizer proxy and no referrer. No fake block screenshots.

## Steps

- [x] Implement cards, filter, friendly values, source/technical disclosures.
- [x] Wire live visual stream without affecting sample mode.
- [x] Independent review, focused tests and lint/typecheck.
- [ ] User preview; no commit/push requested.

### Verification progress

- Independent static review: no remaining blockers reported.
- Focused tests: 41/41 pass (15 new including 6 local-media boundary cases, 26 existing); typecheck pass (exit 0).
- Final scoped lint passed (3 files, exit 0). Browser launch failed in sandbox; escalation aborted, not retried. No screenshot captured.
- User preview remains pending; do not treat this trial as fully verified.

## Dependencies and success criteria

- Existing F42 detail payload only. No new backend or migration dependencies.
- Expected F42 label distinct from separately disclosed PW1 source; no claim of visual equality.
- Keep original block numbers after filtering. Show missing values distinct from empty content.
- Preview images without same-origin optimizer proxy or referrer leakage. Local development exception only for matching localhost/127.0.0.1 hostname, HTTP port 9000, `/primeweb-media/`, no credentials/query/hash.
- Automated component checks complete; real-browser QA and user preview pending. Implementation is not yet a fully verified release.

## User-approved refinement: comparison and technical details only

Reviewed scoped refinement: all comparison fields render inline in original order, including matching values. Remove matching-field and PW1-source dropdowns. Keep exactly one disclosure per block, **Chi tiết kỹ thuật**, containing full block JSON including original sourceContent. Intro explains source location. No status, filtering, API or mapping changes; tests and static review must rerun for this refinement.

- [x] Implement inline fields and one technical disclosure.
- [x] Rerun focused tests and review; user preview remains pending.

Follow-up results: independent static review passed; 42/42 tests passed (16 component + 26 existing), scoped lint on 3 files passed; `tsc --noEmit --incremental false` passed (exit 0). Browser/user preview still pending; no push.

## User-approved follow-up: concise banners and working attention toggle

Diagnosis: header checkbox updates showOnlyErrors, but live iframe branch never consumes this filter. Enabling it appears inert despite state changing. Fix: explicit accessible pressed button; enabling on live mode switches to block comparison, where the same filter is applied. Nonlive field comparison retains its functioning filter; other nonlive views switch to block comparison. Disabling stays on current tab.

Remove only long catalog evidence explanatory banner and safe-URL iframe CSP banner. Keep real loading/error, missing-source URL and homepage-mismatch warnings. No iframe security, API, catalog authorization, migration or status algorithm changes.

- [x] Implement scoped banners/toggle refinement.
- [x] Independent review and automated regression verification.

Latest scope verification: independent static review passed. 43/43 tests passed (17 component/integration + 26 existing migration tests), including actual client iframe-to-filtered-block navigation, toggling off and removed banners. `tsc --noEmit --incremental false` passed. Scoped lint on 4 files: 0 errors, 7 existing hook warnings. Browser E2E updated but not run; user preview remains pending. No push.

## User-approved compact comparison header

Reviewed design: shorten header identity with truncation/tooltips; keep device, refresh, QC and close stable. Page tabs and comparison modes each get bounded local horizontal scrolling. For live preview move source/audit/homepage explanation into one accessible **Thông tin đối chiếu** disclosure. Keep PW1 **Trang chủ** and current PW2 page explicit in respective address bars; unsafe/missing URL remains concise and visible. No iframe, URL-policy, backend, or QC logic changes. Attention button appears active only on views applying its filter; enabling elsewhere still opens block comparison.

- [x] Implement compact header and preview details.
- [x] Independent static review and automated regression verification; user preview pending.

Adjacent preview fix: image enlargement overlay/content now above the outer comparison modal (1000002/1000003 versus 999999). Previous layering made the trial enlargement inaccessible behind its parent. No image source policy change.

Latest compact-header verification: static review passed; 44/44 tests passed (18 component/integration + 26 existing migration); `tsc --noEmit --incremental false` passed; scoped lint 0 errors, 7 existing hook warnings. Integration checks selected PW2 page URLs, unchanged PW1 homepage, information disclosure, QC/Escape/filter and image layering classes. Browser not executed; no screenshot or visual responsive-verification claim. User preview remains pending.

## Approved review fixes and per-slide differences

Diagnosis: indiscriminate JSON parsing changes raw string values emitted by `text()`; absent array indexes are rendered like intentional empty values; relative preview URLs bypass canonical URL validation; nested slides inherit whole-field highlighting instead of showing which item/subfield differs.

Reviewed implementation scope: preserve literal textual field values; decode only known structured fields. Represent absent positions explicitly. Reject control characters before URL parsing, canonicalize root-relative URLs against a fixed origin and retain existing remote/local-media policy. Render per-item and nested-field differences using existing comparison canonical rules (metadata ignored); image evidence remains unverified without image checks. Keep two-column cards and single technical disclosure. Presentation only, no API/schema/automatic verdict changes.

- [x] Capture failing regressions before production edits (9 newly failing tests, previous 18 component tests passed).
- [x] Implement three review fixes and per-item comparison.
- [x] Independent review and automated checks; browser/user preview pending.

Root review additionally found normalized root-relative path becoming `//host` after dot-segment resolution; now explicitly rejected before returning browser src. Fresh regression and full focused verification pending for this final guard.

Latest verification before additional review: 55/55 tests passed (29 component + 26 migration), typecheck and scoped lint passed. Stage-3 review found DNS trailing-dot local hostnames bypassing restricted-host classification. Same URL-policy scope; tester must capture red cases before minimal hostname normalization fix. Browser validation remains pending.

Final review-fix verification: 59/59 tests passed (33 component/integration + 26 migration), final scoped component/test lint 0 errors, final `tsc --noEmit --incremental false` passed (exit 0). 13 red-to-green regressions (9 initial + 4 trailing-DNS-dot), plus 2 normalized-path regressions. Independent review stages 1/2/3 passed with no accepted blockers; hostname guard resolved. Real-browser/user preview still unverified; no push.

## F40-only staging PR preparation

Ported only the reviewed UI, regression tests and documentation onto staging `f173f1dd0` in an isolated worktree. Preserved standalone F42-unavailable handling and LIVE-12 coverage; excluded F42/storefront/backend changes. Fresh clean-branch verification: 59/59 tests passed, TypeScript passed, scoped lint passed with 7 pre-existing hook warnings. Real-browser validation remains pending; no merge performed.
