---
title: "SSO step sync for EasyParcel onboarding"
description: "Notify SSO Hub step 2 after a successful EasyParcel activation in PWv2."
status: in-progress
priority: P1
effort: 11h
issue: 1724
branch: fix/gh-1724-sso-step-sync
tags: [bugfix, easyparcel, sso, onboarding, api, regression]
blockedBy: []
blocks: []
created: 2026-08-06
---

# SSO step sync for EasyParcel onboarding

## Overview

Issue #1724: EasyParcel can be connected, enabled, and configured with a pickup address in PWv2, while SSO Hub still shows “Setup Shipping Fee” as incomplete. The existing SSO client and retry queue are reusable; the missing piece is a step-2 trigger in the EasyParcel save path.

## Scope

- Add an asynchronous SSO step-2 notification after authenticated EasyParcel `enabled=true` persistence succeeds.
- Preserve the existing validation, tenant authorization, row lock, and fire-and-forget behavior.
- Add route regression coverage and a browser acceptance path where the SSO fixture is available.
- Do not add schema, migration, environment variables, or a new SSO client.

## Cross-Plan Dependencies

GH-1293 is the logical predecessor and its SSO client/retry infrastructure is already present in source; it is not a blocking dependency. GH-1652 is an active EasyParcel QA plan, but no overlapping SSO trigger ownership was found. Before staging acceptance, verify the affected SSO user has `keyString`; missing key material must remain pending/retryable rather than be recorded as completed.

## Phases

| Phase | Name | Status | Effort |
|---|---|---|---:|
| 1 | [Add EasyParcel SSO trigger](./phase-01-add-easyparcel-sso-trigger.md) | Completed | 1.5h |
| 2 | [Add regression tests and QA mapping](./phase-02-regression-tests-and-qa.md) | Completed | 2h |
| 3 | [Run browser acceptance and verification](./phase-03-browser-acceptance-and-verification.md) | Completed locally; staging fixture pending | 1.5h |
| 4 | [Harden cron retry worker](./phase-04-harden-cron-retry-worker.md) | Completed | 6h |

## Dependencies

- Existing `notifyStepComplete(payload, user.id, 2)` contract in `src/lib/sso/sso-api-client.ts`.
- Existing `sso_step_events` retry table and `/api/cron/process-sso-steps` cron.
- SSO Hub step contract: `PATCH /api/v1/product/8/step-status` with `{ step2_status: 1 }`.
- Credentials/configuration already present in staging and production env examples.
- Vercel Pro supports a once-per-minute cron, but timing is not an exact SLA and failed invocations are not automatically retried.
- Phase 4 has established the optimized bounded-concurrency retry-worker contract; Phase 3 staging/browser acceptance is now unblocked.

## Timing & Throughput Budget

- Cron schedule: every 1 minute (`*/1 * * * *`).
- Worker deadline: 50 seconds per invocation.
- Claim/process limit: 2 events per invocation, with concurrency capped at 2.
- Cron-specific SSO budgets: 20 seconds for login and 25 seconds for PATCH, up to 45 seconds per event; the remaining ~5 seconds are reserved for DB finalization and the response.
- Delivery is asynchronous after EasyParcel persistence; Save & Activate does not wait for the SSO response.
- A timeout after remote success is retried safely because the SSO step update is idempotent.
- Theoretical maximum throughput is approximately 120 events/hour; monitor queue age and Hub latency before increasing concurrency.

## Success Criteria

- Successful EasyParcel Save & Activate causes SSO Hub step 2 to complete asynchronously.
- SSO failure does not fail the EasyParcel save response and is retryable through the existing queue.
- Invalid, unauthorized, disconnected, disabled, and failed saves do not emit a completion event.
- Existing Flat Rate shipping behavior and tenant isolation remain unchanged.
- A slow SSO outage cannot cause the retry worker to exceed its 60-second function budget for the claimed work; overlapping invocations remain safe and observable.
- The retry worker has a documented 50-second internal deadline, processes up to two events concurrently, and uses separate login/PATCH timeouts with idempotent at-least-once retry semantics.
