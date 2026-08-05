# Phase 2: Apply Approved Copy Deterministically

## Context

Parent: [plan.md](./plan.md)

Phase 1 produces complete decisions. This phase applies them without manual search-and-replace.

## Tooling

Per user direction, Phase 2 uses an external one-off mapper rather than
installing application tooling or dependencies in the repository.

- The mapper ran from `/tmp` and used Python's standard `csv` parser.
- No parser, application script, package dependency, or lockfile change remains
  in the repository.
- Required headers, 3,386 records, duplicate paths, empty values, path types,
  placeholders, HTML tags, array shape, and EN/MS structural parity were
  validated before writing locale files.
- The exact Phase 1 manifest controlled all holds and array mappings.

## Application Rules

1. Load current EN/MS dictionaries.
2. Validate their pre-change path/type parity.
3. For each scalar row:
   - Resolve `key_or_element`.
   - Apply `suggested_en_copy` and `suggested_bahasa_copy`.
   - Apply only documented contract-preserving overrides.
4. For each array row:
   - Load explicit item values from the reconciliation manifest.
   - Assert current type, shape, and intended item count.
5. For missing rows:
   - Apply an explicitly proven replacement path, or
   - Record and skip as obsolete/unusable.
6. Revalidate EN/MS structure and runtime contracts.
7. Write only `en.json` and `ms.json`.

## Guardrails

- Never create a path implicitly.
- Never convert arrays or objects to strings.
- Never apply `[object Object]`.
- Never infer array boundaries from raw comma count.
- Never drop interpolation tokens to match proposed prose.
- Never update loaders, locale codes, or UI components in this phase.

## Checklist

- [x] External parser/tooling selected
- [x] Preview and write workflow completed outside the repository
- [x] Reconciliation manifest consumed exhaustively
- [x] Locale files updated with stable formatting
- [x] Mapper reports 3,386 accounted rows
- [x] No production/runtime dependency added

## Result

- Revalidated against staging commit
  `76793a02cb3a02846b30857d7f4ee06b1f5385b2` on 2026-08-05.
- Accounted source records: `3,386 / 3,386`
- Scalar rows changed: `2,147`
- Scalar rows already matching approved copy: `1,112`
- String arrays mapped: `28`
- Context-changed scalar rows held: `15`
- Branding-conflict scalar rows held: `23`
- Missing obsolete/superseded rows held: `55`
- Ambiguous string array held: `1`
- Unusable object-array rows held: `4`
- Runtime placeholder conflict held: `1`
- Contract-preserving overrides pass: trailing whitespace for
  `dashboard.settings.payments.uploadError`, locale-specific formatting for
  `dashboard.blog.categoryModal.removeConfirmMsg`, and `{time}` retention for
  `dashboard.settings.emailTemplates.lastEdited`.
- EN/MS key and value-type structure parity passes after application.

Only `src/i18n/locales/en.json` and `src/i18n/locales/ms.json` were updated
by the external mapper. The held cases remain unchanged for product review.

## Risks

- A formatter may rewrite entire JSON files and hide meaningful changes. Preserve current indentation/order.
- Current branch may receive new locale keys from staging. Rebase and rerun from a clean baseline.
