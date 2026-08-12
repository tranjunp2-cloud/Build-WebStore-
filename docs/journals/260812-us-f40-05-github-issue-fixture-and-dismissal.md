---
date: 2026-08-12
session: US-F40-05 GitHub issue fixture and dismissal
---

# Journal: 2026-08-12 — US-F40-05 Fixture and Dismissal

## Context

US-F40-05 needed a resettable QA path to validate confirmed, remapped, and dismissed GitHub-issue mappings without using live GitHub data or a shared administrator account.

## What Happened

- Added an explicit audited dismissal action. Dismissal clears the target, records a required reason, and removes the issue from Project Health impact.
- Added an additive `mapping_dismiss_reason` migration and the corresponding read-only Payload field.
- Added a QC-only seed/reset script that touches only two reserved high-numbered fixture issues and a uniquely named fixture super-admin account.
- Updated browser coverage to authenticate through Payload, confirm a mapping, remap a second issue, dismiss the first issue, and verify the old target has no residual issue link.

## Rollout Notes

- Seed/reset commands require the existing QC environment guard and a `F40_E2E_ADMIN_PASSWORD` supplied only through the environment.
- Live browser evidence remains gated on an explicitly resettable QC database; no fixture or credential is committed.

