---
status: approved
feature: F41
story: US-F41-02
title: Prioritize generations needing attention
branch: feat/F41-02-prioritize-generation-attention
base: feat/F41-01-capture-generation-outcome
issue: 1850
---

# US-F41-02 — Prioritize generation cần xử lý

## Goal

Make `/studio/generations` open on an Operations queue, not a raw activity log.
Only Super Admin can read the queue. Each row must make the affected user/site,
page progress, safe failure summary and the *server-derived* next action clear
without exposing prompt, input snapshot, raw provider errors or stack traces.

## Locked scope

- Add a pure recovery-policy/priority resolver. Client UI must never infer
  retryability by parsing error text.
- Replace the raw Payload list response with an allowlisted admin-list
  serializer and stable cursor pagination.
- Default Studio Generations to `needs_attention`; retain an `all` view and
  filters for status, time, user, site and generation ID.
- Update the existing listing UI for the new response and safe queue states.
- Render the server policy as a status/action hint and keep the existing
  detail navigation. Do **not** call retry or ticket mutation APIs here:
  US-F41-03 owns isolated queued retry and US-F41-05 owns issue creation.

## Non-goals

- No retry job, child lineage, confirmation dialog or mutation endpoint.
- No ticket creation, dedupe, detail-page redesign, end-user status endpoint
  or new persistence schema.
- Do not change the legacy admin rerun endpoint.

## Implementation phases

### 1. Pure policy and list serializer

Create `src/lib/ai/generation-recovery-policy.ts` with typed, pure helpers:

- derive a safe `RecoveryPolicy` from lifecycle/outcome/recovery status and
  normalized, already-sanitized evidence;
- map records to priority buckets: `cannot_recover`, `retryable`,
  `retry_failed`, `retrying`, `stale_running` and `history`;
- expose exactly one display action (`view_detail`, future retry/ticket hint,
  or monitor), never a client-side mutation permission;
- serialize only list fields: ID/time, nullable user/site labels, page summary,
  affected scope/code, safe summary, lifecycle/outcome/recovery and policy.

Unknown relation/evidence must be explicit (`Unknown`/`null`), not fabricated.

### 2. Super Admin list API

Refactor `src/app/api/admin/generations/route.ts`:

- validate `view`, filters, `limit <= 100` and an opaque cursor;
- keep `withSuperAdmin` as the access boundary and return safe 403 behavior;
- query/filter on the server, apply deterministic priority order for
  `needs_attention`, and latest-first for `all`;
- return `{ items, nextCursor }` plus compatible summary metadata if required
  by the existing client migration;
- never spread raw Payload documents, `promptText`, `inputSnapshot`,
  `outputSnapshot`, `errorLog` or technical evidence.

### 3. Studio listing

Update `page.tsx`, `generation-types.ts` and `generations-live-feed.tsx`:

- server-render/fetch the Needs Attention default;
- use queue/all tabs, priority badge, user/site fallback labels, page progress,
  normalized safe error and policy hint;
- add filters and 10-second polling while preserving selection only when still
  present;
- clicking a row still opens the existing detail UI. No retry/ticket button is
  enabled until its owning story provides the safe API.

### 4. Verification

- Unit: policy ordering/action/no error-text inference (TC-F41-08).
- API: Super Admin RBAC/non-leak, ordering, combined filters/cursor, missing
  relations and redaction (TC-F41-01, TC-F41-06, TC-F41-07).
- Component: default Needs Attention rows/badges/policy display (TC-F41-08).
- E2E: Super Admin opens `/studio/generations` and sees actionable failures
  before success history (TC-F41-17).
- Run targeted tests, typecheck, lint and `git diff --check`.

## Risks and guardrails

| Risk | Guardrail |
|---|---|
| UI exposes prompt/raw errors | Server allowlist serializer; no raw Payload document to client. |
| UI offers unsafe retry | F41-02 renders policy only; F41-03 owns the queue/idempotency endpoint. |
| Wrong priority from text matching | Pure resolver consumes state/code only, never message text. |
| Missing relation looks like valid data | Explicit `Unknown` labels. |
| F41-01 dependency not merged | Develop from F41-01; rebase this branch onto staging before its PR/merge. |

## Definition of done

- Needs Attention is the default Super Admin view and success history cannot
  displace actionable records.
- Every row carries safe user/site/progress/error/policy data.
- Filters and cursor results are stable; unauthorized users cannot enumerate
  records.
- No retry/ticket mutation or raw diagnostic data is introduced.
- TC-F41-01/06/07/08/17 mapping is covered and quality gates pass.
