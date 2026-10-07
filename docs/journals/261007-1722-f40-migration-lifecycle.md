---
date: 2026-10-07
session: f40-migration-lifecycle
---

# F40 migration lifecycle verification

## Context

Separate website generation progress from content parity and manual QC in the F40 overview.

## What happened

Five lifecycle cards and matching filters include registered source-only websites. Catalogs require proven F42 source/target identity and reject ambiguous scope. Unmapped sources expose no PW2 link or comparison/QC action.

## Reflection

The catalog-version guard correctly rejected an outdated component-test fixture; updating its response contract restored the existing comparison regression. Successful generation still does not mean audit or QC Pass.

## Decisions

Keep provenance failures explicit and preserve audit/QC as separate evidence. Verification passed: 103 focused tests, typecheck, diff check, and one real authenticated lifecycle browser test (25.8s), with no API mocks or database writes in that browser flow.

Adversarial review found accepted noncanonical source IDs `0`/`01`; both SQL validation fields now enforce canonical IDs. Red/green regression captured the rejection change. Eleven real PostgreSQL scenarios passed with temporary fixtures rolled back, including an independent rerun. Final fix review passed without another blocker.

## Next

The [plan](../../plans/261007-f40-migration-lifecycle/plan.md) is complete for implementation, focused tests and review. Full application build and the separate missing-schema browser scenario were not run. No persistent migration/schema changes, commits or pushes performed.
