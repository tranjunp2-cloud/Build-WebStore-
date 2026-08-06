# Phase 1: Pin Source and Reconcile Exceptions

## Context

Parent: [plan.md](./plan.md)

The CSV is valid RFC-style CSV with quoted commas and multiline records. Line-based parsing is unsafe. Current locale files have moved since the reviewed snapshot.

## Requirements

- Download the latest attachment from the issue body, not the older comment attachment.
- Verify SHA-256, 3,386 records, expected 12 headers, no duplicate paths, and no empty required fields.
- Commit the exact file as `docs/translation-dev-view.csv`.
- Reconcile by JSON path, source usage, and Git history. Copy text may inform human review but cannot identify a target.

## Reconciliation Work

### Existing Scalar Rows

- Review the 52 rows whose current EN value differs from CSV `en_copy`.
- Confirm the same key still represents the same UI contract.
- Apply approved suggestions unless a newer runtime requirement supersedes the reviewed snapshot.
- Record any superseded row with commit evidence and reason.

### Missing Paths

Classify all 55 rows:

1. **Renamed:** same live consumer, new path. Map to the proven path.
2. **Moved:** same live contract, new namespace. Map to the proven path.
3. **Obsolete:** consumer removed. Do not recreate.

Known clusters:

- Discount form/list restructuring.
- AI bulk-create redesign.
- Editor add-section prompt removal.
- Profile single-page/SSO redesign.
- Checkout shipping coverage changes.
- Removed blog breadcrumb/customer/profile display keys.

### Arrays

- For 29 string arrays, create explicit EN/MS item arrays with the same intended item count.
- Do not split blindly on comma; many approved items contain commas.
- For 4 help `steps` object arrays, preserve current nested objects and classify the CSV values as unusable source data unless corrected structured copy is supplied.

### Runtime Contracts

- Restore `{time}` in Malay `dashboard.settings.emailTemplates.lastEdited`.
- Verify placeholder multisets for every scalar.
- Verify HTML opening/closing tag multisets.
- Review edge whitespace consumers:
  - `dashboard.settings.payments.uploadError`
  - `help.overview.needHelpDesc`
  - `storefront.checkout.payNow`
  - `dashboard.sites.lastEdited`
- Review newline behavior for `dashboard.blog.categoryModal.removeConfirmMsg`.

## Deliverables

- `docs/translation-dev-view.csv`
- `docs/translation-dev-view-reconciliation.md`
- `scripts/i18n/issue-1701-reconciliation.json`

## Result

- Revalidated against staging commit
  `76793a02cb3a02846b30857d7f4ee06b1f5385b2` on 2026-08-05.
- Source pinned at SHA-256 `85c0bc5829ed256e390393879b5d31dddf02dd67f00edfa7dbf839614e2bc0dd`.
- 52 scalar drift keys fully classified: 14 same-context, 15 changed-context, 23 branding conflicts.
- 55 missing paths fully classified: 30 obsolete removals and 25 superseded contracts.
- 28 string arrays have explicit item mappings.
- 1 string array needs business confirmation because four expected items contain five Malay semantic lines.
- 4 object arrays preserve current content because the CSV contains only `[object Object]`.
- All five CSV-relevant staging changes are covered by existing hold/preserve
  decisions; no additional semantic remapping was required.
- Phase 2 applied all unambiguous rows and preserved every unresolved decision
  listed in `docs/translation-dev-view-reconciliation.md`.

## Checklist

- [x] Source hash and record count recorded
- [x] 52 drift rows reviewed
- [x] 55 missing paths classified
- [ ] 29 string arrays mapped item-by-item (28 mapped, 1 awaiting confirmation)
- [x] 4 object arrays explicitly preserved because source is unusable
- [x] Placeholder/HTML/whitespace/newline exceptions documented
- [x] Every unresolved decision is explicitly held before Phase 2

## Risks

- Mapping stale paths to semantically different current keys.
- Splitting Malay prose into the wrong number of array items.
- Reintroducing removed UI through orphan locale keys.
