---
status: pending
feature: F41
title: Studio Generation Recovery & Operations
branch: feat/F41-studio-generation-recovery-operations
---

# F41 Implementation Plan

## Phase 1 — Data contract and migration

- Extend generation run summary and add durable outcome/event/retry lineage model.
- Add matching safe SQL migration in `scripts/db-setup.js`; no destructive migration.
- Define normalized error code, retry policy and privacy allowlist.

## Phase 2 — Capture and terminalization

- Start capture after request validation/auth with structured input and trace ID.
- Persist site/page final outcomes from generate-site orchestration.
- Ensure every path terminalizes capture in `finally`; distinguish completed/partial/failed.

## Phase 3 — Website retry recovery

- Replace lossy prompt-parsing re-run with a short-lived job/request model using stored input snapshot.
- Create child generation and draft/site result without overwriting parent.
- Enforce retry policy, idempotency and Vercel duration limits.

## Phase 4 — Studio UX

- Implement Needs Attention + All Generations list, status/action rules and confirm retry.
- Replace generation detail modal with full-page detail per design spec.
- Add safe issue handoff and linked issue state.

## Phase 5 — QA and rollout

- Add TC-F41 automated API/component/E2E coverage and manual staging gates.
- Validate migration, RBAC, privacy/export, retry idempotency and user-facing copy.
- Roll out behind operational monitoring; inspect first recovery runs before broad enablement.

## Delivery gates

- Product approves PRD/stories/design.
- Migration reviewed before schema code merges.
- Retry never overwrites original evidence.
- No raw prompt/error leakage.
- Re-run/recovery obeys Vercel `maxDuration <= 60` or uses an approved async job.
