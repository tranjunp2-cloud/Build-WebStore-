# GH-1733 Scout Findings

## Observed

- Staging reports success, but the Product row is absent from the database and Sentry has no event.
- Local behavior is normal; the reporter cannot run privileged staging checks.

## Code and History

- `BulkCreateModal.handleSave` counts a returned ID as success.
- GH-1410 added explicit tenant handling, `disableTransaction:true`, independent read verification, and error UI.
- GH-1588 later routed AI save through a custom Drizzle/Payload session and skipped the independent verification for that path.
- The immediately preceding category-lock implementation held `FOR KEY SHARE` on one connection while the Product auto-committed on another; category delete used the conflicting lock and shared mutation gate.
- The mutation gate has no acquisition deadline, and current unit tests mock Payload/transaction boundaries.
- Staging `TC-F08-04-101` failed during category fixture creation and never reached Product persistence.

## Scope Decision

- Restore the prior two-connection category lock so AI save reuses GH-1410 auto-commit behavior, then independently verify exact Draft invariants.
- Add only the known mutation-gate timeout; avoid client cancellation and general DB resilience work.
- Carry one server generation ID from parse through save attempts and expose per-save reference IDs with PII-safe telemetry.
- Fix the existing focused Playwright scenario and use CI bot staging; do not build new PostgreSQL/CI infrastructure for this urgent issue.
- Exactly-once applies to retries retaining the same mounted preview UUID. Reload/reparse persistence is a separate design problem.
