# Phase 4: QA Handoff and PR Delivery

## Context

Parent: [plan.md](./plan.md)

Automated validation proves dictionary integrity. QA still needs representative visual and content review across product surfaces.

## Local Smoke Matrix

Check EN and MS for:

| Surface | Focus |
|---|---|
| Auth | Labels, placeholders, validation copy |
| Dashboard | Navigation, tables, destructive confirmations |
| Editor | Toolbar, panels, AI prompts |
| Storefront checkout | Payment/shipping text and concatenated labels |
| Landing pages | 29 updated string arrays and long Malay copy |
| Help | Existing object-array content remains structured |
| Email settings/templates | `{time}` interpolation and HTML copy |

Use 375px and desktop widths for representative long Malay strings. Log layout defects separately unless caused directly by the approved copy.

## PR Preparation

- Rebase or merge latest `staging`.
- Rerun deterministic check, focused tests, full Vitest, and typecheck.
- Review `git diff --word-diff` for both locale files.
- Confirm no loader, API, schema, component, or unrelated plan files are included.
- Title: `fix(i18n): apply approved English and Malay UI copy`.
- Description: summary, reconciliation counts, validation evidence, QA matrix, and `Relates to #1701`.

## QA Handoff

Ask tester to verify:

- EN/MS content on the smoke matrix.
- No raw keys, `[object Object]`, missing placeholders, or broken HTML.
- Long Malay copy does not overflow at 375px.
- Landing list item boundaries are correct.
- Removed/obsolete UI is not reintroduced.

## Checklist

- [ ] Local smoke matrix complete
- [ ] Latest staging integrated
- [ ] Final automated gates pass
- [ ] Diff contains only approved scope
- [ ] PR format follows project rules
- [ ] Tester handoff includes known preserved/skipped rows
