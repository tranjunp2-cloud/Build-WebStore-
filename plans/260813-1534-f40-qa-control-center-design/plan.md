---
title: "F40 QA Control Center — approved design convergence"
description: "Align the staging QA Control Center with the approved three-tab UX and integrate the targeted manual-run lifecycle."
status: in_progress
priority: P1
branch: feat/f40-qa-control-center-design
tags: [f40, qa-control-center, ui-ux, manual-runs, accessibility]
created: 2026-08-13
---

# Implementation plan

## Goal

Bring `/studio/qa` into conformance with `docs/design/F40-qa-control-center-demo.html` and `docs/design/qa-control-center-ux.md`: exactly three primary tabs, action-first Inbox, evidence-led Health, and the bounded targeted manual-run lifecycle.

## Non-negotiable boundaries

- Preserve F40-06 Finding Review functionality, but expose it from Inbox/deep links rather than a fourth primary tab.
- Reuse F40-07's server-owned allow-list, preflight, lease, cancellation, and safe-evidence API contract; never add Run All, free commands, raw artifact URLs, or browser-owned test selection.
- Use Studio semantic tokens and accessible dialogs; preserve 44px controls and dark mode.
- All schema/API changes are additive and require matching migration and browser E2E coverage.

## Phases

| #   | Phase                                 | Outcome                                                                                                            | Status      |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------- |
| 01  | Reconcile delivery branches/contracts | Integrate F40-07 implementation on top of staging F40-06 without regressing finding review.                        | completed   |
| 02  | Three-tab information architecture    | Inbox/Health/Runs only; Finding review reachable from Inbox and deep links.                                        | completed   |
| 03  | Runs and manual-run experience        | Target picker, server preflight, single confirmation, active/cancelled history, evidence-safe detail, URL filters. | in_progress |
| 04  | Health/detail and responsive polish   | Domain hierarchy, coverage/freshness/known bugs, mobile bottom sheets and keyboard states.                         | in_progress |
| 05  | AC-mapped E2E and review              | Desktop/mobile/browser acceptance, migration/type checks, code review.                                             | pending     |

## Acceptance trace

| Approved UX contract                                              | Delivery phase |
| ----------------------------------------------------------------- | -------------- |
| 3 top-level tabs only; Inbox owns finding workflow                | 02             |
| Targeted-only test selection, preflight, confirmation; no Run All | 01, 03         |
| Default 7-day Runs, filters/deep links, cursor, safe evidence     | 03             |
| Health hierarchy/detail, no false-green, known-bug context        | 04             |
| Mobile bottom-sheet filters, focus/keyboard and tokens            | 02–04          |
| Browser evidence for valid/blocked/dispatch/cancel/filter/detail  | 05             |

## Delivery sequence

1. Bring the already-built F40-07 code onto this branch with a controlled merge, resolving overlap in `ProjectHealthClient` and the local E2E fixture against staging F40-06.
2. Replace the current four-tab navigation with the approved three-tab model and connect Finding Review to Inbox.
3. Mount the F40-07 `ManualRunPanel` as the Runs surface, then integrate its URL/deep-link state with the Studio QA shell.
4. Address remaining design gaps in Health and Feature Detail, without inventing data that is not persisted.
5. Add browser tests at desktop and 375px; run typecheck, focused API/unit, Playwright, migrations, and `ck:code-review` before any PR.

## Fidelity follow-up (2026-08-14)

The first implementation established the product contract, but visual review against the approved HTML revealed remaining structural differences. Phases 03–04 stay in progress until the following are complete:

- Inbox owns the monitoring banner and a single divided QC queue; Health owns its metrics and domain rail.
- The dispatch flow presents domain/screen/target selection plus server-backed pack/preflight information in the two-column modal.
- Runs retains one visible title, a compact table-card toolbar/footer, and a safe detail dialog.
- Desktop and mobile layouts are verified against the supplied reference without inventing demo packs, counts, or evidence.
