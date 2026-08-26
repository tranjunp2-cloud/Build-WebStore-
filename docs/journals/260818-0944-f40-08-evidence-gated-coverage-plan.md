---
date: 2026-08-18
session: f40-08-evidence-gated-coverage-plan
---

# Journal: 2026-08-18 — F40-08 evidence-gated coverage plan

## Context

Plan US-F40-08: expand QA Control Center targeted testing across the CMS catalog while retaining the F40 dispatch safety boundary.

## What Happened

- Confirmed the catalog contains 67 CMS targets, while the execution registry currently admits only four real Smoke packs: Product Grid variants, Product variants, Order payment verification, and Checkout.
- Confirmed the dispatcher already blocks a target without an active pack; this is the correct baseline and must not be replaced with a generic fallback or synthetic pass.
- Planned a checked-in coverage matrix plus certification gate before adding packs. Each executable row needs QA-approved TC IDs, a real automated test, resettable fixture/test account, preflight, registry/workflow parity, and safe terminal evidence.
- Kept Regression separate from Smoke: no profile relabeling and no execution until it has its own test/spec/fixture/contract.

## Reflection

The apparent gap is not “missing a Run all button”; it is missing certified evidence for 63 catalog targets. Treating catalog visibility as permission to execute would make the QA signal unreliable and broaden staging authority. The plan therefore expands in auditable batches and preserves visible blocked states with a recovery owner.

## Decisions Made

| Decision | Rationale | Impact |
| --- | --- | --- |
| Use one coverage matrix and shared certification resolver | Prevent Health, manual preflight, dispatch, and workflow allow-lists from disagreeing | Coverage status and execution authority stay consistent |
| Certify targets in risk order: Critical, Checkout, Payments, Orders | Addresses production-impacting flows first while keeping each batch reviewable | Later domains remain explicitly blocked until evidence exists |
| Make registry and workflow updates atomic and parity-tested | A registered pack that workflow cannot run—or vice versa—is unsafe | Exact target, version, PR/SHA, lease, and evidence bindings remain enforced |
| Keep Regression a separate future contract | Smoke evidence does not prove broader regression behavior | UI shows it unavailable until independently approved |

## Next Steps

- Execute the plan’s matrix inventory and certification gates; do not admit a target based on metadata alone.
- Create child batch PRs only after QA approves the target-specific TC, fixture, preflight, and test evidence.
- Next command: `$ck:cook plans/260818-0935-f40-08-expand-targeted-qa-coverage/plan.md`
