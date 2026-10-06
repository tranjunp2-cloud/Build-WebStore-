# Phase 03 — Migration Inspector evidence UX

## Goal

Move Commerce/Settings from demo-first to a clear evidence path: choose run →
choose Store → inspect mapping and issues. Demo remains visible only for UI review.

## Files

- Modify: `src/app/studio/qa/migration-diff/ReconciliationInspector.tsx`
- Modify: `src/app/studio/qa/migration-diff/MigrationDiffClient.tsx`
- Create: `src/app/studio/qa/migration-diff/MigrationRunSelector.tsx`
- Create: `src/app/studio/qa/migration-diff/MigrationIssuesPanel.tsx`
- Modify: `tests/studio-migration-diff.spec.ts`

## Implementation steps

1. Add run selector showing state, mapping version, completed timestamp and Store scope.
2. Add summary cards for mapped, unresolved, failed/blocked and exception counts.
3. Add mapping filters for entity/state, safe ID search and cursor pagination.
4. Add an issue drawer with severity, safe error code, lifecycle and next action.
5. Real-provider errors show `Chưa xác minh`; they never silently fall back to demo or
   catalog mock.
6. Verify loading, empty, error, keyboard and 375px responsive states.

## Success criteria

- Tester distinguishes verified mapping, failed migration and unverified data.
- Existing Block Comparison and Field Diff workflows do not regress.
