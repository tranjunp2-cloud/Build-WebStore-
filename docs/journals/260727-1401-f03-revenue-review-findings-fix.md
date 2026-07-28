---
date: 2026-07-27
session: f03-revenue-review-findings-fix
---

# F03 Revenue review findings fix

## Context

Follow-up review found release-confidence gaps in the PostgreSQL regression schema, Revenue component TC-ID traceability, and completed plan wording. A later review rejected shared remote-database test configuration as unnecessary scope.

## What Happened

- Replaced `text` status/event/currency columns in the TEMP query schema with session-local PostgreSQL enums matching production labels.
- Added an integration assertion that fails if those TEMP columns drift back to non-enum types.
- Kept the dashboard PostgreSQL regression intentionally scoped to the fixed local URI supplied by its dedicated CI step, while preserving the single connection required by TEMP tables.
- Removed the unnecessary shared PostgreSQL test-config helper and its unit test, and restored the unrelated Payload schema integration to its original configuration.
- Clarified that the no-schema/environment/route release gate applies to the Revenue scope, not predecessor changes already present on the shared branch.
- Corrected PostgreSQL evidence from 1/1 to 2/2 and replaced unsupported workspace `.next` and dev-server health claims with observed isolated-builder results.
- Split the enum-schema test markers into explicit Arrange, Act, and Assert sections.
- Restricted the Revenue component test labels to TC-F03.55, the scenario its assertions actually cover.
- Reframed stale plan validation text as historical pre-implementation findings and recorded the implemented outcome.

## Reflection

Using a real PostgreSQL engine is not enough when the test substitutes permissive column types. Mirroring enum semantics and asserting the TEMP schema protects the same binding/operator class that production uses. Supporting remote database URI variants was not required for that regression and created avoidable parser risk. TC-ID labels are executable traceability claims and must remain narrower than their assertions. Release evidence must also distinguish scoped changes from the full shared branch and claim only outcomes directly demonstrated by recorded commands.

## Decisions

- Keep the production Revenue query and database schema unchanged; the defect was in regression-test fidelity.
- Keep the dashboard PostgreSQL regression optional for local runs without `DATABASE_URI` and mandatory in its dedicated CI step, which always supplies the local test URI.
- Treat isolated-builder success as build evidence only; do not infer workspace `.next` stability or dev-server health without separate observations.
- Keep unrelated, pre-existing TC-ID drift outside this fix scope.

## Validation

- Focused Revenue unit regressions: **9/9 passed**.
- Dashboard PostgreSQL regression with an explicit local test URI: **2/2 passed**.
- Restored, unrelated Payload schema integration: **3/3 passed**.
- PostgreSQL-backed integration total: **5/5 passed**.
- TypeScript, lint, and `git diff --check`: passed; lint reported existing warnings only.
- Isolated Docker builder: exit 0, compiled successfully, and generated **113/113** pages; a non-fatal local PostgreSQL `ECONNREFUSED` log appeared during page generation.
- Post-fix scoped review scored **10/10** with no actionable findings.

## Next

- Local dashboard PostgreSQL runs must export an explicit `DATABASE_URI`; the dedicated CI step supplies its own isolated URI.
- Run credentialed responsive browser QA and representative read-only `EXPLAIN ANALYZE` during operational handoff.
- Do not commit without explicit user approval.
