---
date: 2026-08-04
session: GH-1733 AI product persistence planning
plan: plans/260804-1655-gh-1733-ai-product-persistence-hotfix/plan.md
---

# Journal: GH-1733 AI Product Persistence Plan

## Context

Staging reports a successful AI bulk Product save while the Product row is absent from the database and Sentry has no event. Local behavior is normal, and the reporter cannot perform privileged staging checks.

## Findings

- The UI counts a truthy returned Product ID as success.
- The AI path writes through a custom Drizzle transaction registered in Payload's private session map.
- Unlike manual create, the AI path skips the independent read-after-create safeguard restored by GH-1410.
- The mutation gate can wait indefinitely and Product statements run after `lock_timeout` is reset to unlimited.
- Existing unit tests mock Payload and transaction boundaries.
- Playwright `TC-F08-04-101` intends to exercise real persistence, but its latest staging run failed during category fixture setup and never reached Approve.

## Rejected Direction

A schema-heavy proposal added generation columns, an operation collection, and unique indexes. It was rejected for this urgent hotfix because the existing stable slug already provides in-drawer retry identity, while schema work would add rollout risk before the commit defect is characterized.

## Red-Team Corrections

- Do not use a client `Promise.race`: it cannot cancel a Server Action and could cause a duplicate retry after a late commit.
- Do not ship `disableTransaction:true` as a fallback unless a real save-versus-category-delete race proves the GH-1588 invariant. If it cannot, fail/disable Approve rather than leave a committed invalid Product.
- Isolate the PostgreSQL integration suite from default Vitest and give it a dedicated DB-backed CI job.
- Prove empty-database bootstrap and required Product slug uniqueness before claiming exactly-once.
- Treat staging Playwright as post-merge QA/sign-off, not a pre-merge gate; cancelled/setup-failed runs are not evidence.
- Scope exactly-once to retries retaining the same preview ID. Reload/reparse needs durable persisted identity and is not part of this hotfix.
- Provision the E2E category only through the existing secret-guarded endpoint with negative auth/tenant-isolation tests.

## Final Direction

1. Introduce a fail-closed result contract with batch/operation/reference IDs and PII-safe Sentry context.
2. Return success only after a bounded independent post-commit read; bound mutation-gate and database statements.
3. Keep failed/unknown previews in the drawer, show a reference ID, and refresh Drafts only from verified successes.
4. Require real PostgreSQL integration before merge and CI-bot Playwright persistence proof on staging before QA sign-off.

## Dependency

This hotfix blocks completion of `260710-1625-f08-category-integrity` Phase 10 because both rely on the same AI Product/category transaction and staging browser scenario. No source, migration, or environment variable was changed during planning.

## Scope Revision

A second review against issue #1733 found that the initial four-phase plan mainly detected false success after the fact; it did not commit to the change that would restore Product creation.

The revised plan selects the implementation immediately before `a9a721b4e`: hold the active category with a dedicated `FOR KEY SHARE` connection while Product creation uses GH-1410's `disableTransaction:true` auto-commit path, then independently verify the exact Draft before success. This preserves category-delete exclusion without retaining the staging-suspect custom Payload session transaction.

The roadmap is now three phases:

1. Restore verified persistence, bounded category waits, generation/reference telemetry, and safe replay.
2. Make UI success/error/loading states depend only on verified results.
3. Update focused unit regressions and the existing preview → Approve → Draft Playwright flow, executed on staging by CI bot.

New PostgreSQL CI services, Vitest infrastructure, package scripts, empty-schema bootstrap, and workflow hardening were removed as disproportionate to this urgent bug. No source, schema, migration, environment variable, or route was changed during planning.

## Supersession Note — 2026-08-05

The earlier Red-Team/Final Direction requirement for a new real-PostgreSQL
integration gate before merge is superseded by the final issue-scoped roadmap.
The reporter cannot run privileged staging checks, and adding new database/CI
infrastructure is outside GH-1733's urgent hotfix scope. Phase 1 therefore closes
on focused lock/action/UI regressions plus static review; Phase 3 retains the
existing preview → Approve → Draft Playwright proof on staging for the CI bot and
QA sign-off. This does not claim live-staging persistence evidence in Phase 1.

## Phase 2 Implementation — 2026-08-05

### Context

Phase 1 established verified persistence and replay safeguards. Phase 2 aligned the dashboard with that contract so the UI no longer reports success from an ambiguous or legacy-shaped response.

### What Happened

- Settled the Server Action response as a minimal discriminated union: verified success or structured failure.
- Kept explicit retries correlated with the same generation ID, operation ID, and stable slug.
- Added persistent inline failures with copyable reference IDs and retry controls.
- Preserved failed drafts in mixed batches while removing and counting only verified created or replayed products.
- Switched the product page to the Draft tab and refreshed verified results in the background without blocking on category refresh.
- Verified the focused action, modal, and product-page suites: 127/127 tests passed. Diff validation and lint also passed.
- Full typecheck remains blocked by pre-existing missing dependencies in the root-owned local `node_modules`; no dependency workaround was introduced.

### Reflection

The key correction was to make verified persistence—not a truthy ID or completed request—the only success boundary. Keeping failed previews and their stable correlation fields makes retries observable and safe without broadening this hotfix into new schema or CI infrastructure.

### Decisions

- Do not retain compatibility with the legacy full Product response.
- Do not automatically retry ambiguous network or persistence failures.
- Automatically retry only SKU conflicts within the bounded attempt policy; all other retryable failures require explicit user action.
- Count callbacks and refresh Drafts only from verified successes.

### Next

Phase 3 remains the staging Playwright preview → Approve → Draft persistence proof and QA sign-off, executed by the CI bot because the reporter lacks privileged staging access.

## Phase 3 Implementation — 2026-08-05

### Context

Phase 3 closes the issue-scoped automation gap around the real preview → Approve → Draft persistence flow. The staging proof must run through CI because the reporter cannot provision or inspect privileged staging data.

### What Happened

- Reused a fixed, provisioned category owned by the test tenant and added unit coverage for fixture authorization, tenant isolation, and soft-deleted history and concurrent category-creation races.
- Made parse setup deterministic by requiring a returned generation ID.
- Exercised the real Product action while obscuring the first commit acknowledgement, then replayed with the exact same generation ID and operation ID to prove duplicate-safe recovery.
- Made cleanup idempotent so replayed or partially completed runs do not fail teardown.
- Added focused local evidence for the security, race, parse-correlation, replay, and cleanup paths.
- Kept the real staging run URL, Sentry query, and persisted-row evidence as CI/QA gates rather than claiming local execution as staging proof.
- Full repository validation remains constrained by the existing missing local dependencies; no dependency workaround was introduced.

### Reflection

The highest-value Phase 3 assertion is not a second happy-path save. It is recovery from a lost acknowledgement while preserving both correlation identifiers and observing one durable Product. Separating deterministic local checks from privileged staging evidence keeps the claim precise.

### Decisions

- Use only the secret-guarded fixture path and a tenant-owned provisioned category.
- Treat generation ID and operation ID as an indivisible replay identity.
- Require duplicate-safe cleanup for reruns and interrupted CI jobs.
- Keep staging persistence, Sentry, and run-link evidence as explicit sign-off gates.

### Next

Run the Playwright scenario through the staging CI bot, attach the run URL and Sentry evidence, confirm exactly two unique Draft Product rows, and complete QA sign-off. Resolve the missing dependency installation separately from this hotfix if full local validation is required.

## Review Finding Fix — 2026-08-05

### Context

Issue-scope review found that Sentry recorded the reference ID and operation ID only in non-searchable context, preventing support from reliably locating an event using the identifiers shown to the user.

### What Happened

- Added searchable Sentry tags for the reference ID and operation ID while retaining their diagnostic context.
- Removed the unrelated `blockedBy` line from the category-integrity plan.

### Verification

- The new regression test first failed as expected: 91/92 tests passed.
- After the fix, the regression suite passed: 92/92 tests.
- The complete focused suite passed: 142/142 tests.

### Next

## Pre-commit Finding Fixes — 2026-08-05

### Context

The final issue-scoped review found two retry/visibility gaps that could still undermine confidence after a verified save.

### What Happened

- Froze the preview slug base at parse time so an explicit retry after an ambiguous acknowledgement reuses the same full slug and operation correlation even if the merchant edits the Product name.
- Reset search, category, sale, low-stock, and advanced-panel state before refreshing verified AI Drafts so the newly created Draft cannot remain hidden by stale list filters.
- Captured both regressions red before the fixes, then passed the two focused files at 36/36 tests and the complete focused suite at 143/143 tests.
- Lint completed with 0 errors and 1 pre-existing hook warning; diff check was clean; Playwright listed all 12 scenarios.
- Full typecheck remains blocked only by the existing missing local dependencies; no dependency workaround was added.

### Decisions

- Preserve the immutable preview slug base across name edits instead of deriving a new retry identity.
- Clear only filters that can hide a verified Draft; keep the refresh product-only and background-safe.

### Next

Run the privileged staging Playwright proof through CI and attach persistence/Sentry evidence for QA sign-off.
