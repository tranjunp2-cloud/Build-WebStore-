---
title: "GH-1701 approved English and Malay UI copy"
description: "Apply 3,386 reviewed translation records without breaking locale structure, placeholders, HTML, arrays, or newer runtime contracts."
status: pending
priority: P2
effort: 14h
issue: 1701
branch: codex/issue-1701-i18n-copy
tags: [bugfix, frontend, localization, i18n]
blockedBy: []
blocks: []
created: 2026-07-30
---

# GH-1701 Approved English and Malay UI Copy

## Overview

Apply the business-approved English and Malay copy from `translation-dev-view.csv` to the runtime locale dictionaries. Use JSON dot paths as identity, preserve all runtime contracts, and document every row that cannot be applied directly.

No loader, locale code, page, API, database, or production runtime logic change.

## Source Baseline

Source attachment: issue #1701 body, file ID `30530246`.

| Measure | Result |
|---|---:|
| CSV records | 3,386 |
| CSV columns | 12 |
| Duplicate `key_or_element` paths | 0 |
| Missing key / EN suggestion / MS suggestion | 0 |
| Existing scalar paths | 3,298 |
| Existing array paths | 33 |
| Missing current paths | 55 |
| EN scalar values that would change | 1,751 |
| MS scalar values that would change | 2,092 |
| Existing EN/MS recursive primitive leaves | 4,129 each |
| Existing EN/MS path/type mismatches | 0 |

Baseline revalidated against staging commit
`76793a02cb3a02846b30857d7f4ee06b1f5385b2` on 2026-08-05.

### Known Exceptions

- 29 string-array rows are flattened into ambiguous comma-delimited text. They require explicit item mapping against the current array length.
- 4 object-array rows contain only `[object Object]`. They cannot supply approved nested copy and must remain unchanged unless a corrected source is provided.
- 55 paths no longer exist. They must be classified as renamed, moved, or obsolete; never recreate them without a live consumer.
- 52 existing scalar rows have drifted from the CSV `en_copy` snapshot. Review recent Git history before replacing newer product-specific behavior.
- `dashboard.settings.emailTemplates.lastEdited` loses `{time}` in the proposed Malay copy. Preserve the placeholder.
- Four current strings use edge whitespace in concatenation/display. Verify consumer behavior before removing it.
- One confirmation string changes newline formatting. Keep deliberate multiline behavior compatible across EN/MS.

## Decisions

1. **Path identity only:** never locate targets by matching old copy text.
2. **Deterministic tooling:** use an external one-off CSV mapper and keep only
   its reviewable decision manifest in the repository.
3. **Explicit exception manifest:** record missing-path decisions, array item values, and contract-preserving overrides in one reviewable file.
4. **No orphan keys:** an unresolved row is skipped unless Git history and a live source consumer prove its replacement path.
5. **No project dependency:** use the external mapper's standard CSV library;
   do not add a package, script entry, or lockfile change.
6. **Source remains auditable:** commit the exact issue attachment at `docs/translation-dev-view.csv`.
7. **Contract takes precedence:** approved wording may be minimally adjusted only to retain placeholders, HTML, intentional whitespace, or multiline formatting required by the UI.

## Phases

| Phase | Name | Effort | Status |
|---|---|---:|---|
| 1 | [Pin Source and Reconcile Exceptions](./phase-01-source-and-reconciliation.md) | 4h | Completed - review required |
| 2 | [Apply Approved Copy Deterministically](./phase-02-deterministic-application.md) | 5h | Completed - review required |
| 3 | [Contract Tests and Regression](./phase-03-contract-tests-and-regression.md) | 3h | Pending |
| 4 | [QA Handoff and PR Delivery](./phase-04-qa-handoff-and-delivery.md) | 2h | Pending |

Delivery order: `Phase 1 -> Phase 2 -> Phase 3 -> Phase 4`.

## Expected Files

| Action | File | Purpose |
|---|---|---|
| Add | `docs/translation-dev-view.csv` | Exact reviewed source attachment |
| Add | `docs/translation-dev-view-reconciliation.md` | Human-readable reconciliation and re-audit log |
| Add | `docs/issue-1701-phase2-qa-matrix.csv` | Old/new copy matrix for local review and QA |
| Add | `scripts/i18n/issue-1701-reconciliation.json` | Machine-readable array and missing-path decisions |
| Modify | `src/i18n/locales/en.json` | Approved English copy |
| Modify | `src/i18n/locales/ms.json` | Approved Malay copy |
| Add | `src/__tests__/unit/localization/issue-1701-approved-copy.test.ts` | Locale structure and runtime-contract gates |
| Modify | `docs/qa/F21-localization.md` | Add TC-GH1701 validation cases |

## Cross-Plan Review

Existing localization-related plans overlap only at locale dictionary files. None blocks GH-1701:

- `260724-1034-locale-safe-generation-performance` changes dynamic generation behavior, not EN/MS runtime dictionary contracts.
- `260717-1552-gh-1652-easyparcel-qa-audit` already landed its locale tree; GH-1701 updates copy while preserving that tree.
- Other pending feature plans may later add keys. GH-1701 must rebase immediately before final validation, but does not wait on them.

## Success Criteria

- All 3,386 source rows are accounted for as applied, mapped, preserved-with-contract, or documented obsolete/unusable.
- No undocumented missing path and no newly invented orphan key.
- EN/MS retain identical key and value-type structures.
- All existing arrays retain their intended type, item count, and nested shape.
- Placeholder multisets and HTML tag contracts match between EN/MS.
- Intentional newline and edge-whitespace consumers remain correct.
- Both locale files parse.
- Relevant localization tests, full Vitest regression, and TypeScript typecheck pass.
- PR title: `fix(i18n): apply approved English and Malay UI copy`.
- PR description uses `Relates to #1701`.

## Out of Scope

- New locales or locale-code changes.
- i18n loader, switcher, fallback, interpolation, or API refactors.
- Copy changes outside the reviewed CSV.
- Rewriting help object arrays from `[object Object]` without corrected business input.
- UI redesign or responsive fixes discovered during copy QA.
