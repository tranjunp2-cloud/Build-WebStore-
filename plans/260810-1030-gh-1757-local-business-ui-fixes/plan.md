---
title: "GH-1757 Local Business UI validation and contrast fixes"
description: "Fix the confirmed Local Business Editor UI bugs, prevent incomplete opening-hours saves, and lock the merged SEO 400 fix with focused regressions."
status: completed
priority: P1
effort: 6.5h
issue: 1757
branch: fix/gh-1757-local-business-ui
tags: [bugfix, frontend, accessibility, testing]
blockedBy: []
blocks: []
created: 2026-08-10
---

# GH-1757 Local Business UI Validation and Contrast Fixes

## Overview

Fix issue #1757 Bugs 1–3 and the confirmed Bug 4 incomplete-range edge in the existing Editor without changing API, Payload, database, or save-queue contracts. Preserve the merged Bug 5 `ogImage` normalization and add a populated-media regression. The broad Bug 4 layout claim remains excluded because current batch actions already wrap without overlap.

## Scope Decisions

- Reuse existing Editor theme tokens, `GeoLinkInput` blur validation, strict Zod bounds, and F37 authenticated Playwright setup.
- Use explicit, theme-aware solid color pairs; no new dependency and no broad `globals.css` override.
- Keep `type="number"`; block exponent/plus keyboard and paste paths without intercepting Ctrl/Meta/Alt shortcuts, prove native rejection of ordinary alphabetic input, add input semantics, and preserve server validation.
- Add issue-specific `TC-F37-10-01..05` entries before implementation.
- Limit Opening Hours production work to the modal submission guard and its interaction regressions.
- Treat `TC-F37-10-05` component interaction tests as authoritative for the Bug 4 incomplete-range guard; the browser follow-up covers only modal theme presentation and performs no save.
- Treat the GH-1757 Playwright project as a manual/local gate only; do not claim CI enforcement.
- Retain the existing batch-action `flex-wrap`, `gap`, `shrink-0`, and `whitespace-nowrap` layout; no Opening Hours CSS change without browser reproduction.
- Never modify or propose changes under `.github/workflows/**`.
- Do not change Opening Hours utilities, save queue, schema, API, persistence contracts, or workflow files.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
|---|---|---|
| Context only | [GH-1309 Minimal Business Data](../260727-1025-gh-1309-minimal-business-data/plan.md) | Runtime contract available; no block |
| Context only | [GH-1312 SEO Health](../260804-1114-gh-1312-f37-04-ui-first-seo-health/plan.md) | Existing Editor fixture/deep-link patterns; no block |
| Disjoint pending work | [GH-1367 Editor toolbar light mode](../260625-1444-GH-1367-editor-toolbar-conflict-light-mode/plan.md) | Owns `BlockActionBar`/`PreviewScripts`; no overlapping writes |

## Phases

| Phase | Name | Effort | Status |
|---|---|---:|---|
| 1 | [Lock QA contract and unit regressions](./phase-01-lock-qa-contract-and-unit-regressions.md) | 2.5h | Completed |
| 2 | [Implement Local Business UI fixes](./phase-02-implement-local-business-ui-fixes.md) | 1.75h | Completed |
| 3 | [Add browser regression and close verification](./phase-03-add-browser-regression-and-close-verification.md) | 2.25h | Completed |

Execution order: `Phase 1 red/green contract → Phase 2 implementation → Phase 3 browser and full closeout`.

### Phase 1 Evidence

- Focused suite: **60/68 passed** with exactly **8 expected-red** assertions documenting missing Phase 2 behavior: **5 GeoLinkInput** and **3 Opening Hours**.
- `TC-F37-10-04` populated `ogImage` normalization regression: **passed** on current staging behavior.
- Focused review outcome: **APPROVE**.
- Workflow protection gates: **passed**; no worktree or `staging...HEAD` changes under `.github/workflows/**`.
- At the Phase 1 closeout, Phase 2 and Phase 3 were still pending; the overall plan remained `pending`.

### Phase 2 Evidence

- Focused Vitest: **68/68 passed**; all **8 expected-red** Phase 1 assertions are green.
- Typecheck: **passed**.
- Lint: **passed** with **0 errors** and 142 baseline warnings.
- Debugger verdict: **APPROVE**.
- Code reviewer verdict: **APPROVE**.
- Workflow protection gates: **passed**; `.github/workflows/**` remains untouched.
- At the Phase 2 closeout, Phase 3 and the overall plan intentionally remained `pending`.

### Phase 3 Evidence

- Authenticated localhost setup: **passed**. Exact discovery and the exact manual/local browser suite both passed **4/4** (`TC-F37-10-01`, `02`, `03`, `05`); no CI or staging result is claimed.
- TC-01 caught a transient **4.106** Extract contrast dip and a follow-up **1.62:1** `Coordinates extracted` failure. Production removed the Extract transition and gives coordinate success exact palettes light `#166534`/`#dcfce7`, dark `#86efac`/`#052e16`; all tested states pass AA. The coordinate fixture overlays only latitude/longitude in the successful `editor-data` GET and is never persisted.
- TC-02 passed real keyboard/clipboard rejection, range alerts, and zero API mutation attempts. The screenshot follow-up replaces the empty-value-only false positive with `keyboard.insertText('e'/'1e')` plus `validity.badInput === false`. Final review then proved the snapshot was unseeded for the first IME interaction with a server-provided coordinate; production now seeds on focus, and the CDP regression preserves GET-overlay latitude `3.139` before any fill/input event. Malformed `1-2` and `--` surface associated native `badInput` errors on blur. The read-only guard self-probes a nonexistent POST, blocks all non-read API requests, and requires zero later mutations.
- TC-03 passed exact completed/incomplete semantic palettes and AA contrast in both themes. Its incomplete state uses a controlled `editor-data` GET overlay of only `businessCategory: null` in browser memory; no backend-state or persistence result is claimed.
- TC-05 passed the real authenticated Opening Hours modal in both themes through the Editor UI and restored the initial theme. Screenshot red evidence found an actual 16px checkbox; the first 20px fix still computed border width 0 because Preflight is disabled and global `button { border: 0 }` won. Local `border-solid` fixes the root cause, and the browser requires exact 20×20px/2px geometry with light `#64748b`/`#f8fafc` and dark `#64748b`/`#0f172a`. Cancel/Save are 36px high; disabled Save uses stronger light `#334155`/`#cbd5e1` and dark `#f1f5f9`/`#475569`, visibly distinct from Cancel. Enabled Save also moved from **2.57:1** to AA-safe `#eff6ff`/`#2563eb`. The test fills `09:00–18:00` but never clicks Save; `openingHours: []` is response-only and all non-read API requests are aborted.
- Bug 2 follow-up red proof: the new unit regression failed before the fix because `1e2` was accepted as `100`.
- Focused Vitest after the final Bug 2 follow-up: **73/73 passed**. Typecheck and lint passed; lint reports 0 errors with repository baseline warnings.
- Debugger and independent code reviewer: **APPROVE**. Diff, staged-state, and both `.github/workflows/**` protection gates passed.

## Dependencies

- Repository instructions: `AGENTS.md` supplied for this worktree.
- Test rules: [`docs/TEST_CONVENTION.md`](../../docs/TEST_CONVENTION.md).
- QA registry: [`docs/qa/F37-local-seo.md`](../../docs/qa/F37-local-seo.md).
- `docs/development-rules.md` does not exist; do not invent a replacement.

## Success Criteria

- Enabled and disabled Extract states and the `Coordinates extracted` success message each have computed text/background contrast of at least 4.5:1 in light and dark themes; disabled state also exposes the native `disabled` property.
- Latitude accepts `[-90, 90]`, longitude accepts `[-180, 180]`; `e`, `E`, `+`, and ordinary alphabetic input are rejected while decimal/negative values and Ctrl/Meta/Alt shortcuts remain usable.
- Invalid/out-of-range coordinate blur shows the existing inline error and sends no Local Business save.
- Completed checklist state is visibly green and high contrast in both themes; incomplete state remains neutral and distinct.
- An incomplete custom Opening Hours range cannot be submitted or erase existing rows; a valid save replaces only the selected day and rerenders the exact saved range. Component interaction owns behavior; authenticated TC-05 browser coverage additionally proves exact checkbox geometry/border, 36px actions, distinct disabled/enabled Save, and AA modal palettes in both themes without clicking Save or persisting data.
- Populated Payload `seo.ogImage` objects still normalize to their raw ID before Search verification save.
- Targeted Vitest, typecheck, lint, and manual/local issue-specific Playwright discovery/run pass without any CI-enforcement claim.
- No changes to collections, migrations, environment variables, APIs, Opening Hours layout/utilities, Local Business persistence architecture, or `.github/workflows/**`; both worktree-status and branch-vs-staging workflow gates must pass.

## Red Team Review

### Session — 2026-08-10

**Findings:** 11 deduplicated (8 accepted, 3 rejected)
**Severity:** 1 Critical, 7 High/Medium accepted; 3 rejected as out-of-scope or redundant.

| # | Finding | Severity | Disposition | Applied To |
|---|---|---|---|---|
| 1 | No-save E2E was fail-open on staging | Critical | Accept | Phase 3 fail-closed route interception |
| 2 | Disabled Extract retained globally forced white text | High | Accept | Phase 2 mutually exclusive state classes |
| 3 | Opening Hours browser fixture was nondeterministic | High | Accept, modified | Bug 4 component coverage only |
| 4 | New project is not CI-selected | High | Accept, modified | Manual/local classification; workflows prohibited |
| 5 | Split-shift incomplete range was uncovered | High | Accept | Phase 1 parameterized interaction tests |
| 6 | Synthetic paste assertion could false-pass | High | Accept | Phase 1 canceled-event check + Phase 3 real paste |
| 7 | Setup dependency could mask zero issue tests | High | Accept | Exact `--no-deps` discovery/run |
| 8 | Target/site binding was underspecified | Medium | Accept | Explicit `BASE_URL` and tenant relationship checks |
| 9 | Change global artifact retention policy | High | Reject | Existing cross-project policy; outside issue scope |
| 10 | Add cancel/reopen modal regression | Medium | Reject | No reproduced bug; scope expansion |
| 11 | Add server pre/post snapshots | Medium | Reject | Redundant after fail-closed save interception |

## Handoff

Implementation command: `/ck:cook --auto /home/liam/data/worktrees/ech-prime-web-v2-worktree-1/plans/260810-1030-gh-1757-local-business-ui-fixes/plan.md`
