---
status: approved
feature: F41
story: US-F41-03
title: Safe website retry
branch: feat/F41-03-safe-website-retry
base: feat/F41-02-prioritize-generation-attention
issue: 1851
---

# US-F41-03 — Retry website an toàn

## Decision

Use PostgreSQL as the durable recovery-job store and an authenticated Vercel
Cron worker to claim jobs with a lease. This reuses existing `CRON_SECRET` and
cron patterns; no new vendor, credentials or inline long-running API work.
The retry API only creates durable state and returns `202`.

## Scope

- Add retry lineage and recovery-job persistence with additive, idempotent SQL.
- Add Super Admin `POST /api/admin/generations/:id/retry` with UUID
  `Idempotency-Key`, one active child guard and safe domain errors.
- Run a cron worker that atomically claims a queued job, creates an isolated
  draft recovery site from frozen structured input, persists progress, and
  finalizes child/job/parent policy.
- Add list/drawer confirm UX. No raw legacy rerun, no parent/site/page mutation,
  no auto-publish/swap and no end-user retry.

## Phases

1. Extend `AiGenerationRecords` with source, parent/root lineage, retryAttempt
   and recoveredSite; add `generation_recovery_jobs` collection and matching
   safe migration/indexes including active-job/idempotency guards.
2. Extract/implement retry policy service and transactional API. Same key returns
   canonical child; different key with active child returns safe conflict.
3. Implement `/api/cron/process-generation-recovery` secured by CRON_SECRET,
   lease/heartbeat/claim semantics and isolated draft worker orchestration.
4. Add confirm action to the safe Operations listing/drawer, disabling duplicate
   submission and showing monitor state after `202`.
5. Cover TC-F41-01, 09–13, 18–19, 25 plus twice-run migration and concurrency.

## Guardrails

- Never call legacy `/rerun`, parse `promptText`, update/delete parent pages,
  overwrite parent evidence, or run generation inline in retry API.
- Child always uses a new trace, frozen snapshot, draft site and explicit tenant.
- Dispatch/claim failure terminalizes child/job safely and parent becomes
  ticket-eligible; never return false `202` success.
- All routes dynamic and `maxDuration <= 60`.
