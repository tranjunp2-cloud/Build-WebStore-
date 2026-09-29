# F41 Generation Recovery — Engineering Contract

> **Status:** Proposed, implementation source of truth after approval
> **PRD:** [F41 Studio Generation Recovery](../prd/F41-studio-generation-recovery.md)
> **Scope:** Retry toàn website trong MVP. Không retry page/component độc lập.

## 1. Quyết định không được tự diễn giải

| Câu hỏi | Quyết định MVP |
|---|---|
| Retry thực hiện ở đâu? | Background job/queue được Engineering phê duyệt trước khi code. API chỉ enqueue và trả `202`; mọi route `maxDuration <= 60`. Repo hiện chưa có queue recovery dùng lại được. |
| Retry dùng dữ liệu nào? | Frozen `inputSnapshot` đã normalize ở generation gốc, không dùng form hiện tại hoặc prompt parse lại. |
| Có ghi đè run cũ? | Không. Retry tạo child generation, parent/evidence immutable. |
| Có tạo duplicate site? | Retry luôn tạo **isolated draft recovery site** (`recoveredSiteId`) cho child. Tuyệt đối không gọi generator in-place với `siteId` của parent, vì luồng hiện tại có thể xóa pages cũ. Không auto-publish hoặc swap site trong MVP. |
| Ai retry/tạo ticket? | Chỉ Super Admin. End user không tự retry trong MVP. |
| Khi nào tạo ticket? | Lỗi `retryable=false` ngay lập tức, hoặc retry website đã fail/hết quota. |
| UI quyết định action từ đâu? | Chỉ từ `recoveryPolicy` do server trả về, không parse error text ở client. |

## 2. State model

Không dùng một enum cho tất cả trạng thái. Một generation có bốn trục độc lập:

```ts
type Lifecycle = 'queued' | 'running' | 'terminal'
type Outcome = 'succeeded' | 'partial_failed' | 'failed' | 'cancelled' | null
type RecoveryStatus =
  | 'none' | 'eligible' | 'retrying' | 'exhausted'
  | 'ticket_required' | 'ticket_created' | 'stale_running'
type TicketStatus = 'none' | 'open' | 'resolved'
```

### 2.1 Operational-status mapping (source of truth)

`outcome` is immutable history of the original generation. The two Studio
screens use separate operational workflows; a Dev ticket can never by itself
complete the affected user's support flow.

| Screen | Stored status | Owner | Meaning / permitted next action |
|---|---|---|---|
| Issues & Feedback | `backlog` | Dev team | New report has not been accepted. Move freely to any ticket column. |
| Issues & Feedback | `reopen` | QA/operator | Retest failed; return work to Dev. |
| Issues & Feedback | `in_progress` | Dev team | Dev is investigating or implementing a fix. |
| Issues & Feedback | `dev_fixed` | Dev team | Code fix is ready for verification. |
| Issues & Feedback | `testing` | QA/operator | The fix is being verified. |
| Issues & Feedback | `done` | QA/operator | Ticket work is accepted. A related generation enters operator verification; this is not user completion. |
| User Generations | `eligible` | Operator | Safe automatic recovery is available; operator can enqueue retry. |
| User Generations | `retrying` | System | Recovery child is queued/running; operator monitors only. |
| User Generations | `ticket_required` / `exhausted` | Dev team | Automatic recovery is unavailable; create or work the Dev ticket. |
| User Generations | `ticket_created` | Dev team | Related Dev ticket exists and is not yet accepted by the operator. |
| User Generations | `ticket_verification_required` | Operator | Dev/QA marked the ticket Done; operator must start a user-facing verification. |
| User Generations | `operator_verifying` | Operator | Operator is testing the repaired website/generation. Choose completion or report failure. |
| User Generations | `operator_resolved` | Operator | Operator confirmed the user can use the repaired website. Excluded from Needs Attention but retained in history/audit. |

Transition rules: operator starts verification from `ticket_verification_required`;
pass sets `operator_resolved` and keeps the original failure outcome immutable;
failure returns the generation to `ticket_created` and moves the related issue
to `reopen`, so the UI reopens the existing ticket rather than offering a duplicate.
No workflow-order restriction applies to the Issue board, but only
the operator completion action can resolve a user generation.

`outcome` chỉ có giá trị khi `lifecycle='terminal'`. `succeeded` chỉ được set sau khi site và mọi page persistence đã terminal, không phải khi AI compose xong.

| Điều kiện | Lifecycle / outcome | Recovery | Owner chuyển state |
|---|---|---|---|
| Request hợp lệ đã lưu snapshot | `queued / null` | `none` | generate/retry API |
| Job đang xử lý | `running / null` | `none` | worker |
| Tất cả page persist | `terminal / succeeded` | `none` | worker finalizer |
| Có page thành công và ít nhất một page lỗi | `terminal / partial_failed` | `eligible` hoặc `ticket_required` | worker finalizer + policy resolver |
| Không có page/site persist | `terminal / failed` | `eligible` hoặc `ticket_required` | worker finalizer + policy resolver |
| Retry được chấp nhận | parent không đổi | parent `retrying`; child `queued` | retry API transaction |
| Child job kết thúc | child `terminal / *` | parent `none` nếu child success, `ticket_required` nếu child fail/exhausted | worker finalizer |
| Ticket tạo xong | terminal outcome không đổi | `ticket_created` | ticket API transaction |
| Không heartbeat quá SLA | `running / null` | `stale_running` | monitor job |

**SLA stale:** `lastHeartbeatAt` quá 10 phút và job không terminal. Monitor chỉ đánh dấu/reconcile job; không tự retry trừ khi policy cho phép explicit auto-retry. Event terminal đến muộn hơn stale phải thắng và xóa `stale_running`.

## 3. Dữ liệu bền vững

`AiGenerationRecords` tiếp tục là root record. `outputSnapshot` chỉ là preview debug đã cap 50KB, không phải event store/source of truth.

```ts
GenerationRecord {
  id, tenantId, traceId, source: 'user_submit' | 'ops_retry',
  parentGenerationId?: string, retryRootGenerationId: string, retryAttempt: number,
  userId?: string, siteId?: string, recoveredSiteId?: string,
  inputSnapshot: Json, inputSchemaVersion: string, inputHash: string,
  lifecycle: Lifecycle, outcome: Outcome, recoveryStatus: RecoveryStatus,
  pageSummary: { expected: number | null, persisted: number, failed: number },
  userSafeMessage: string, startedAt, terminalAt?, lastHeartbeatAt?, staleAt?
}

PageOutcome {
  generationId, pageKey, title, slug,
  status: 'pending' | 'generated' | 'persisted' | 'failed',
  componentSummary?: { expected: number | null, persisted: number, failed: number },
  errorId?: string
}

GenerationError {
  id, generationId, phase: 'validate' | 'compose' | 'site_persist' |
  'page_persist' | 'component_persist' | 'publish' | 'job',
  locationType: 'input' | 'site' | 'page' | 'component' | 'unknown',
  locationKey?: string, locationLabel?: string,
  validationRule?: 'required' | 'format' | 'min_length' | 'max_length' |
    'unsupported_value' | 'contract_mismatch',
  observedState?: 'missing' | 'invalid_format' | 'too_short' | 'too_long' |
    'unsupported' | 'unknown',
  normalizedCode: string, category: string, retryabilityReason: string,
  operatorMessage: string, userSafeMessage: string,
  sanitizedTechnicalMessage?: string, signature: string
}

RecoveryJob {
  id, sourceGenerationId, childGenerationId, requestedBy,
  idempotencyKey, status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled',
  queuedAt, startedAt?, finishedAt?
}

IssueLink { generationId, issueId, signature, status: 'open' | 'resolved', createdBy, createdAt }
```

`locationLabel`, `validationRule` và `observedState` là dữ liệu vận hành
allowlist do server tạo, không lấy text tự do từ provider. Không lưu giá trị
field lỗi, prompt, token hoặc stack trace. Khi pipeline cũ không capture đủ
vị trí, serializer trả `Unknown` rõ ràng thay vì suy đoán page/component/field.

**Migration rule:** mọi field/table mới phải có migration idempotent trong `scripts/db-setup.js`; array table dùng UUID `id varchar`, `_order`, `_parent_id`, `_uuid`; không `DROP TABLE`.

## 4. Retry and ticket policy

```ts
RecoveryPolicy {
  action: 'retry_website' | 'create_ticket' | 'monitor' | 'none'
  retryScope: 'website' | 'none'
  retryable: boolean
  reasonCode: string
  maxAttempts: number // MVP: 1
  attemptsUsed: number
  nextEligibleAt?: string
  requiresConfirmation: true
  activeChildGenerationId?: string
}
```

| Preconditions | Action |
|---|---|
| terminal + `retryable` + attempts `< maxAttempts` + no active child | `retry_website` |
| `retryable=false` | `create_ticket` |
| retry child failed or attempts exhausted | `create_ticket` |
| active child queued/running | `monitor` |
| ticket link open | `none`, show `Mở ticket` |

Retry transaction creates at most one active child per parent. Unique guard: active child/recovery job by `sourceGenerationId`; idempotency key is scoped to `sourceGenerationId + retryAttempt`. Same key returns the canonical job/child. Different concurrent key returns `409 RETRY_IN_PROGRESS` plus canonical IDs.

**P0 safety gate:** không tái sử dụng `POST /api/admin/generations/:id/rerun` làm recovery. Endpoint cũ parse prompt phẳng, chạy synchronous và có thể update/xóa pages của site hiện hữu. F41 chỉ dùng `POST .../:id/retry` + worker cô lập.

Ticket dedupe key is server-computed: `tenantId + normalizedCode + phase + affectedScope + templateVersion + openStatus`. Request body never supplies technical evidence. A resolved ticket does not suppress a new occurrence.

## 5. HTTP API contract

All admin routes require Super Admin and tenant-isolated query. Error envelope is always safe:

```json
{ "error": { "code": "RETRY_IN_PROGRESS", "message": "Website đang được gen lại.", "details": { "childGenerationId": "gen_child" } } }
```

| Method/path | Purpose | Response |
|---|---|---|
| `GET /api/admin/generations?view=needs_attention&cursor=&status=&search=` | Summary list, stable `prioritySortKey,submittedAt,id` cursor | `200 {items,nextCursor}` |
| `GET /api/admin/generations/:id` | Full admin-safe detail | `200 GenerationDetail` |
| `POST /api/admin/generations/:id/retry` | Enqueue full website retry | `202 RetryAccepted` |
| `POST /api/admin/generations/:id/tickets` | Create/open deduped Issue & Feedback ticket | `201/200 TicketAccepted` |
| `GET /api/admin/generations/:id/events?afterSequence=` | Reconcile polling/SSE events | `200 {items,nextSequence}` |
| `GET /api/generations/:id/status` | End-user-safe own-generation status only | `200 UserGenerationStatus` |

`POST retry` request:

```http
Idempotency-Key: UUID
Content-Type: application/json
{ "reason": "ops_manual_retry" }
```

```json
{ "jobId":"job_123", "parentGenerationId":"gen_1", "childGenerationId":"gen_2", "recoveryStatus":"retrying", "userSafeMessage":"Đang hoàn thiện lại website của bạn.", "idempotent":false }
```

`POST tickets` response:

```json
{ "ticketId":"issue_412", "ticketUrl":"/studio/issues/issue_412", "created":true, "recoveryStatus":"ticket_created" }
```

Expected failure codes: `403 FORBIDDEN`, `404 NOT_FOUND`, `409 RETRY_IN_PROGRESS`, `409 RETRY_LIMIT_REACHED`, `422 NOT_RETRYABLE`, `422 TICKET_NOT_ELIGIBLE`, `429 QUEUE_BUSY`. Never return provider raw error, prompt or stack trace.

## 6. Read models and privacy

List response exposes only ID/time/user+site label (including explicit missing relation), page counts, affected scope, normalized safe error summary, lifecycle/outcome/recoveryPolicy, child/ticket reference. Detail adds frozen input schema/version/hash, preview/live URL state, page outcomes, retry history and sanitized technical evidence.

| Data/action | Super Admin | Admin/non-admin | End user |
|---|---|---|---|
| List/detail full input/evidence | Allow | `403` without record-existence leak | Never |
| Retry/ticket/export | Allow | `403` | Never |
| Own status | N/A | N/A | Allow only own generation, safe message/progress |
| Raw prompt, raw provider error, request headers | Never in UI/CSV | Never | Never |

Use separate serializers: `serializeAdminGeneration()` and `serializeEndUserGeneration()`. CSV uses an explicit allowlist, never spreads record JSON.

## 7. Event and job contract

Each event includes `generationId`, `rootGenerationId`, optional `parentGenerationId`, monotonically increasing `sequence`, server `occurredAt`, `lifecycle`, `outcome`, `recoveryStatus`, page counts and safe message.

`generation.created`, `phase.changed`, `page.persisted`, `page.failed`, `component.failed` (only when captured), `retry.requested`, `retry.started`, `retry.completed`, `retry.failed`, `ticket.created`, `stale.detected`, `generation.terminal`.

List polls every 10 seconds and detail reads events after `sequence`; out-of-order/duplicate events are ignored by sequence. Every job must emit/finalize `generation.terminal`.

## 8. Orchestration pseudocode and code touchpoints

```ts
// generate-site route / recovery worker
record = createGeneration({ frozenInput, traceId, lifecycle: 'queued' })
enqueue(record.id)

worker(record.id):
  markRunningAndHeartbeat()
  try:
    createIsolatedDraftRecoverySite()
    composeAndPersistSiteAndPages()
    persistPageOutcomeAfterEveryPage()
    finalizeFromPersistenceOutcomes() // sets terminal + policy atomically
  catch (error):
    persistNormalizedError(error)
    finalizeFromPersistenceOutcomes() // never leave running
  finally:
    emitTerminalEventIfNeeded()
```

Implementation starts from:

- `src/collections/AiGenerationRecords.ts`: root fields/relations.
- `src/lib/ai/capture-generation.ts`: create/finalize helpers; add structured snapshot and terminal invariant.
- `src/app/api/ai/generate-site/route.ts`: persist page outcomes/events and invoke finalizer after persistence.
- `src/app/api/admin/generations/route.ts`, `[id]/route.ts`, `export/route.ts`: read serializers/filter/redaction.
- `src/app/api/admin/generations/[id]/rerun/route.ts`: deprecate/replace with policy-safe `retry` contract, không parse flattened prompt hoặc chạy recovery inline.
- `src/app/studio/generations/*`: list/detail render from server policy only.

## 9. Required tests before rollout

Service/API: transition reducer, terminal-after-persistence, partial results, policy resolution, idempotency/two concurrent retry calls, ticket dedupe, serializers/redaction and tenant RBAC.

E2E: Needs Attention default, retry from list/detail, child progress/terminal, non-retryable ticket, input/evidence visibility and end-user-safe status. Staging: transient failure, nonretryable failure, missing site/user, stale job then late terminal, two browser retry race.
