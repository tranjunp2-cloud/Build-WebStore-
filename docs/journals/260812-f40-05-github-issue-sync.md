---
date: 2026-08-12
component: F40 QA Control Center
issue: 1744
status: completed
---

# F40-05 — GitHub Issue Sync and Confirmed Target Mapping

## Context

US-F40-05 connects known GitHub bugs to the F40 Project Health catalog. Its boundary is deliberately narrow: Studio mirrors safe issue metadata and GitHub remains the source of truth for issue bodies and comments. Historical issues without an explicit, confirmed CMS target must remain Unknown rather than changing feature health from a title-keyword guess.

## Completed work

- Added the server-owned GitHub issue mirror and target-mapping persistence needed to retain issue number, URL, title, state, labels, severity, GitHub update time, and mapping metadata.
- Added idempotent synchronization and reconciliation so repeated deliveries update the same mirrored issue rather than creating duplicates.
- Added super-admin-only mapping confirmation with actor and timestamp audit data.
- Extended Project Health so a confirmed, open P1 issue makes only its mapped target `Critical` and exposes the GitHub issue link. Closing or remapping an issue removes the old target's issue evidence deterministically.
- Kept suggested mappings non-authoritative: they can help triage but cannot affect health until confirmation.

## Verification

- Covered the required issue states: unmapped, confirmed mapped-open, and mapped-closed/remapped.
- Covered idempotent sync/reconciliation behavior and calculator precedence for confirmed open P1 issues.
- Preserved QA route authorization and server-only GitHub credential handling; GitHub installation tokens are never returned to the browser.

## Decisions

- Use an exact, explicit P1 classification for the `Critical` health rule; labels and title keywords are not a substitute for confirmed mapping.
- Give a confirmed open P1 issue precedence over passing run evidence, because it represents a known active product defect.
- Do not persist GitHub issue body, comments, raw CI logs, or credentials in Payload.
- Keep the change scoped to US-F40-05; finding promotion/manual GitHub ticket creation remains US-F40-06.

## Deferred P1 rollout gates / next

1. Configure and validate the GitHub App installation credentials in staging before enabling scheduled synchronization.
2. Confirm the repository-wide severity-label convention and monitor label drift; only the approved P1 signal should drive `Critical`.
3. Run staging reconciliation against historical open and recently closed issues, then review Unknown mappings with QA Lead Ary before confirming targets.
4. Add operational monitoring for GitHub pagination, rate limiting, and retry failures before broadening sync cadence.
