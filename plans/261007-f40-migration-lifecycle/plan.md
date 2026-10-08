# F40 migration lifecycle overview

Status: Implementation, focused testing and adversarial review complete.
Scope: F40 overview cards, table, filters, read-only catalog API. No F42 migration execution, DB schema changes, commits or pushes.

## Approved product direction

Five cards: Tổng website / Chưa migration / Đang migration / Migration thành công / Migration thất bại.
Card selection and table filters share website-generation lifecycle; content comparison and manual QC remain separate.

## Implementation plan

1. Establish authoritative current F42 source/target scope from available binding evidence. Count distinct source store identities within that scope, not every import run across rehearsal namespaces. If ambiguous, show an explicit unavailable/scope message rather than guessed totals.
2. Include source IDs registered in F42 batch selected_store_ids even without child import rows or website generation rows. Explicitly label catalog coverage; this is not a promise to enumerate PW1 sources never registered with F42. Retain legitimate website-ledger entries in the established scope without double counting.
3. Derive one generation status: absent/pending = not migrated; running = running; completed = successful generation; failed = failed generation. Import VERIFIED, publication, comparison percentage and manual QC do not alter this classification.
4. Return lifecycle totals and source-only rows from the existing authorized API. Preserve auth and input validation, safe pagination/search and evidence scoping. Do not load per-site comparison details for source-only rows.
5. Render the five cards in agreed order; use identical lifecycle labels in filter tabs and migration column. Preserve publish as secondary information and content comparison/QC in separate columns.
6. Source-only rows use verified source names where available, otherwise Website PW1 #ID. No invented PW2 URLs; show Chưa có website PW2, and disable comparison/QC actions until a valid mapped site exists.
7. Review and test: pure status classifier tests plus real-browser existing F40 E2E extended for counts, filters, source-only rows, namespace collisions and failed loads. Check type safety and regression in detailed comparisons.

## Acceptance criteria

- Four lifecycle counts sum to source total for the same scope and snapshot.
- Every source identity counted once across repeated imports.
- Clicking a card shows only rows with that lifecycle state; search/pagination preserve the filter.
- Completed with audit errors remains migration successful; errors stay in comparison column.
- Pending/absent sources are visible as not migrated, with no false links or enabled comparison action.
- Missing/ambiguous source scope or failed API is never shown as a successful empty catalog.
- Existing report exports/untracked files and stash remain untouched.

## Review gates

- Human implementation-plan approval required by ck:cook before code changes.
- Code review, tester/debugger verification and UI review before completion.
- Document limitations and test results; do not push without separate user authorization.

## Implementation checkpoint

- Implemented lifecycle classifier, five overview cards, corresponding filters and table labels.
- Implemented registered-source catalog union, namespace validation, scoped field evidence and disabled unmapped-site actions.
- Added catalog version/duplicate checks while loading paginated results.
- `npm run typecheck -- --incremental false`: passed.
- `git diff --check`: passed.
- Focused unit/component verification: 103/103 passed across five files, including 12 lifecycle cases. Existing block-comparison fixture updated for the catalog-version contract after reproducing its failure.
- Real authenticated browser LIVE-10/LIVE-16: 1 passed (25.8s), covering lifecycle cards, filters, search and source-only disabled actions without API mocks or database writes.
- Real PostgreSQL catalog regression: 11 scenarios passed and independently rerun, using temporary tables with rollback. Covers namespace/provenance boundaries and deduplication. Red/green evidence reproduced acceptance of noncanonical `0`/`01` source IDs; canonical validation now rejects both.
- Final adversarial fix review: PASS, no additional blocker reported.
- Limitations: full application build and separate missing-schema browser scenario were not run. The latter requires its dedicated fixture rather than the normal local fixture.
- No migrations, schema changes, commits or pushes performed. Existing reports preserved.
