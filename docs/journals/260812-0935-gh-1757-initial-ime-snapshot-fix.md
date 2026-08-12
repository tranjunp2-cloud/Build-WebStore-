---
title: GH-1757 Local Business UI fixes
date: 2026-08-12
issue: 1757
branch: fix/gh-1757-local-business-ui
---

# GH-1757 Local Business UI Fixes

## Scope

- Fix the confirmed Extract and coordinate-success contrast failures.
- Restrict manual coordinates to valid numeric syntax and geographic bounds.
- Make completed and incomplete Local SEO checklist states distinct and readable.
- Guard individual-day Opening Hours saves against incomplete custom ranges and address the confirmed modal readability follow-ups.
- Add regression coverage for the existing SEO OG-image normalization fix.

The reported broad Opening Hours batch layout/state behavior was not reproduced and was excluded after product confirmation. Bug 5 production normalization was already present on the staging baseline, so this branch adds regression coverage rather than another runtime implementation.

## Key decisions

- Use explicit light/dark palettes whose computed foreground/background ratios meet WCAG AA.
- Keep native number inputs, bounds and browser validation while rejecting exponent, plus and alphabetic entry through keyboard, paste, `beforeinput` and `input` defenses.
- Preserve server-provided coordinates during the first non-cancelable IME event by snapshotting the current value on focus.
- Keep Opening Hours changes local to the individual-day modal; do not change batch utilities, save queues, API contracts or persistence architecture.
- Run browser acceptance read-only: GET response overlays expose deterministic visual states, while every non-read API request is aborted and recorded.

## Regression evidence

- TC-F37-10-01 checks Extract and coordinate-success palettes and AA contrast in both themes.
- TC-F37-10-02 covers native bounds, keyboard, clipboard, `insertText`, malformed-number blur errors and first-interaction CDP IME preservation.
- TC-F37-10-03 checks completed/incomplete semantic palettes, AA contrast and checkmark/dot distinction.
- TC-F37-10-04 verifies a hydrated Payload media relation is normalized to its raw ID during Search verification save.
- TC-F37-10-05 covers incomplete-range save prevention plus Opening Hours modal geometry, borders and palettes in both themes.

## Verification

- Four-file focused Vitest gate: **73/73 passed**.
- Exact authenticated localhost GH-1757 suite: **4/4 passed**.
- Full Vitest: **726 files / 11,908 tests passed**, with one file and three tests skipped.
- Typecheck and lint passed; lint retained repository baseline warnings only.
- Clean production build generated **112/112** static pages.
- No changes to workflows, collections, migrations, environment examples, APIs or package manifests.
- Browser results are localhost/read-only evidence; no staging, backend-state or persistence E2E result is claimed.
