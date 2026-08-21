# Phase 04 — Harden cron retry worker

## Context links

- Parent: [Plan](./plan.md)
- Cron route: [process-sso-steps](../../src/app/api/cron/process-sso-steps/route.ts)
- Cron schedule: [vercel.json](../../vercel.json)
- Retry tests: [process-sso-steps-cron.test.ts](../../src/__tests__/api/process-sso-steps-cron.test.ts)
- Vercel cron limits: [usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [managing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

## Overview

- Priority: P1
- Status: Completed
- Effort: 6h
- Keep the one-minute schedule, but use bounded concurrency so queue throughput improves without turning SSO slowness into a Vercel timeout. This phase must finish before browser/staging acceptance.

## Key Insights

- Vercel Pro supports a once-per-minute schedule, but cron timing is not an exact SLA.
- Vercel does not automatically retry a failed cron invocation.
- The current worker claims up to 20 rows and processes them sequentially. Two sequential 30-second outbound timeouts leave almost no headroom before `maxDuration = 60`, while one event per minute caps throughput at 60 events/hour.
- `FOR UPDATE SKIP LOCKED`, the five-minute stuck-row reclaim, and idempotent SSO writes already protect against duplicate processing; preserve them.

## Requirements

- Keep `*/1 * * * *` unless measured queue volume proves a different cadence is needed.
- Replace the unbounded worst-case `20 × sequential event` behavior with a **50-second internal deadline**, claim at most 2 events, and process them with bounded concurrency of 2.
- Use separate cron-specific SSO timeouts: **20 seconds for login** and **25 seconds for PATCH**, leaving approximately 10 seconds for DB finalization and response generation. Do not use a single 15-second timeout for both requests.
- Treat delivery as at-least-once: a client timeout may occur after SSO Hub committed the idempotent `step-status=1`; retry is expected and safe.
- Add retry fairness/backoff using existing `retry_count` and `updated_at` so a failing event does not monopolize the queue. No new schema is required.
- Never leave more claimed rows in `processing` than the reclaim/timeout model can safely recover.
- Preserve `MAX_RETRIES`, `last_error`, `processing` reclaim, `SKIP LOCKED`, and race guards.
- Add a structured summary containing `processed`, `succeeded`, `failed`, `raced`, `deferred`, `reclaimed`, `remaining`, oldest pending age, and effective concurrency without secrets. Do not introduce a new metrics system in this issue.
- Define operational thresholds: investigate when oldest `pending`/`processing` age exceeds 10 minutes or when `failed` events reach `MAX_RETRIES`; document that the signal is checked in Vercel logs until a project-wide alert sink exists.

## Architecture

```text
every-minute cron
  -> authenticate CRON_SECRET
  -> claim bounded work under SKIP LOCKED
  -> process within explicit runtime budget
  -> completed / pending / failed per event
  -> reclaim stale processing after 5 minutes
  -> expose counters + queue age for operations
```

The design must tolerate two cron invocations overlapping. A duplicate invocation may run, but it must not finalize another worker's newer state.

## Related code files

### Modify

- `src/app/api/cron/process-sso-steps/route.ts` — bounded batch/runtime and operational logging.
- `src/lib/sso/sso-api-client.ts` — accept separate cron login/PATCH timeout options; preserve the default user-triggered timeout contract and idempotent retry behavior.
- `src/__tests__/api/process-sso-steps-cron.test.ts` — batch bound, stale reclaim, retry exhaustion, and race behavior.
- `docs/qa/F-SSO-PW2.md` — add cron resilience TC-IDs if needed.

### Read-only reference

- `src/lib/sso/sso-api-client.ts` — per-request timeout contract and idempotency assumptions; modify as part of this phase.
- `scripts/db-setup.js` — existing indexes; no migration expected.
- `vercel.json` — retain once-per-minute schedule.

### Create/delete

- None unless the chosen observability integration requires a small existing metrics/log adapter.

## Implementation steps

1. Measure normal/timeout behavior and confirm the SSO Hub `step-status=1` operation is idempotent.
2. Implement a 50-second worker deadline with separate 20-second login and 25-second PATCH timeouts.
3. Claim at most 2 rows and process them with concurrency 2; ensure unfinished rows remain safely reclaimable.
4. Add retry fairness/backoff using `retry_count` and `updated_at` without a schema change.
5. Preserve CAS finalization, stale reclaim, retry exhaustion, and overlap race guards.
6. Add queue-age/outcome/concurrency counters and document the 10-minute/`MAX_RETRIES` thresholds.
7. Add deterministic tests for concurrency cap, separate timeout propagation, timeout-after-remote-success retry, backoff ordering, stale reclaim, max retry, unauthorized access, and concurrent finalization.
8. Verify the cron remains registered at `*/1` and document production-only behavior.

## Todo

- [x] Confirm the 50-second deadline, 20s/25s split, and concurrency-2 default.
- [x] Add separate SSO client timeout options and safe claim/finalization behavior.
- [x] Add retry fairness/backoff without schema change.
- [x] Add queue-age/outcome/concurrency observability and document log-based thresholds.
- [x] Add cron regression tests and QA IDs for concurrency, timeout semantics, reclaim, and overlap.
- [x] Verify no secret/token appears in logs.
- [x] Run targeted tests, typecheck, and lint.

## Success criteria

- A slow or unavailable SSO service cannot make an invocation exceed its 60-second budget because of oversized claimed work.
- The worker stops starting new work at 50 seconds; each event gets 20s login/25s PATCH budgets with enough headroom to finalize or reclaim state.
- A timeout after remote success is safely retried and converges because the SSO step update is idempotent.
- Pending events are eventually retried; permanently failed events remain inspectable with `last_error`.
- Concurrent cron invocations do not clobber newer completed/pending states.
- The one-minute schedule remains active and documented as best-effort timing.

## Risk assessment

- Concurrency 2 approximately doubles theoretical throughput to 120 events/hour but increases SSO load. Raise concurrency only after production queue-age and Hub latency measurements justify it.
- A client timeout can be ambiguous (remote success vs. no response); at-least-once retry and idempotency are deliberate correctness requirements.
- Vercel can still terminate a function at the platform limit; stale-row reclaim remains a safety net, not a replacement for a runtime budget.
- Alerting without a clear owner can create noise; use queue age and retry exhaustion thresholds rather than per-event alerts.

## Security considerations

- Continue requiring `Bearer CRON_SECRET`.
- Do not log bearer tokens, decrypted passwords, SSO response bodies, or raw credentials.
- Keep SQL parameterized and retain `SKIP LOCKED`/status guards.

## Next steps

After this phase passes, execute Phase 03 browser/staging acceptance and then request code review.
