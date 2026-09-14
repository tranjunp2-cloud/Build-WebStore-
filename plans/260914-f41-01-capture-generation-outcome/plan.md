---
status: pending
feature: F41
story: US-F41-01
title: Capture end-to-end generation outcome
branch: feat/F41-01-capture-generation-outcome
issue: 1849
---

# US-F41-01 — Capture end-to-end generation outcome

> **Decision source:** [F41 Generation Recovery Engineering Contract](../../docs/architecture/f41-generation-recovery-contract.md)
> **Acceptance Criteria:** [US-F41-01](../../docs/stories/F41-studio-generation-recovery-stories.md#us-f41-01-capture-end-to-end-generation-outcome)
> **QA source:** [F41 QA Plan](../../docs/qa/F41-studio-generation-recovery.md), TC-F41-01 through TC-F41-05.

## 1. Goal and bounded scope

Make `ai-generation-records` a durable, truthful record of a **website-generation attempt**. A run must not become terminal success until the route has persisted its site and every attempted page. For a partial persistence failure, the record must preserve what succeeded, what failed, and safe evidence for Operations.

This story creates the data and finalization foundation only. It does **not** implement the recovery queue, retry endpoint, Needs Attention UI, full-page detail, ticket creation, or end-user status page. Those are US-F41-02 through US-F41-06.

## 2. Current-state evidence

| Location | Current behavior | Problem addressed by this story |
|---|---|---|
| `src/collections/AiGenerationRecords.ts` | Stores legacy `status: running/success/failed`, prompt, capped `outputSnapshot`, selected blocks and generic error log. | Cannot represent lifecycle/outcome/recovery separately or page-level persistence outcome. |
| `src/lib/ai/openai-generator.ts` | Calls `startCapture()` and several `finishCapture({ status: 'success' })` paths immediately after composition/template selection. | AI composition can be marked successful before `generate-site` writes the site/pages. |
| `src/app/api/ai/generate-site/route.ts` | Has `generationRequestId`, `createdPages`, `pageFailures`, timing and a final route-level catch. | The useful persistence evidence is not linked to or finalized into an AI generation record. |
| `scripts/db-setup.js` | Has baseline `ai_generation_records` migration and `selected_blocks` array table. | Every F41 schema field/array needs a safe, idempotent migration. |

## 3. Decisions locked for US-F41-01

### 3.1 State and legacy compatibility

Add the new independent axes exactly as in the contract:

```ts
type Lifecycle = 'queued' | 'running' | 'terminal'
type Outcome = 'succeeded' | 'partial_failed' | 'failed' | 'cancelled' | null
type RecoveryStatus =
  | 'none' | 'eligible' | 'retrying' | 'exhausted'
  | 'ticket_required' | 'ticket_created' | 'stale_running'
```

Keep legacy `status` in this story because existing Studio/API readers use it. During the compatibility period, the only writer maps terminal states as follows:

| New state | Legacy `status` |
|---|---|
| `queued` or `running` | `running` |
| `terminal / succeeded` | `success` |
| `terminal / partial_failed`, `failed`, or `cancelled` | `failed` |

Existing records are read as `lifecycle = terminal` when `completedAt` exists, otherwise `running`; their unknown outcome/evidence remains unknown. Do not backfill a guessed page outcome, error code, user relation, or site relation.

### 3.2 Ownership and finalization invariant

`src/app/api/ai/generate-site/route.ts` owns the capture lifecycle for website generation because it alone observes real site/page persistence. `src/lib/ai/openai-generator.ts` returns composition data and must not terminalize the website record.

The route creates the record only after request parsing, authentication, subscription/rate-limit/safety validation, tenant resolution, and frozen-input normalization. It transitions to `running` immediately before AI work. It updates heartbeat around long persistence phases. A single idempotent finalizer is invoked from both JSON and SSE pipeline paths, including `catch`/`finally`, after all page persistence attempts have settled.

**Terminal invariant:** only the finalizer writes `lifecycle='terminal'`, `outcome`, `terminalAt`, legacy terminal `status`, `pageSummary`, recovery status, and terminal evidence. No compose-only branch may write `success` for a website-generation capture.

### 3.3 Durable model for this story

Extend the existing root `AiGenerationRecords` collection rather than creating retry/job/ticket collections early. Use Payload fields with snake-case DB columns.

| Field | Payload shape / persistence | US-F41-01 purpose |
|---|---|---|
| `traceId` | indexed text | Store the normalized request ID and join logs/evidence. |
| `inputSnapshot` | JSON, bounded/sanitized structured normalized form data | Frozen source for later recovery; not the mutable prompt. |
| `inputSchemaVersion` | text, default current version | Makes future snapshot migration explicit. |
| `inputHash` | indexed text | Stable hash of normalized snapshot. |
| `lifecycle`, `outcome`, `recoveryStatus` | indexed selects | New state axes; initial recovery status is `none`, then finalizer applies the existing policy resolver/temporary safe default. |
| `pageSummary` | group: `expected`, `persisted`, `failed` | Fast, truthful aggregate based on attempted persistence. |
| `userSafeMessage` | text | Friendly status copy, never raw provider error. |
| `startedAt`, `terminalAt`, `lastHeartbeatAt` | dates | Timing and stale-monitor foundation; preserve legacy `completedAt` during transition. |
| `pageOutcomes` | array | One outcome per expected/attempted page: key/title/slug/status and optional component counts/error reference. |
| `generationErrors` | array | Bounded normalized evidence: phase/location/code/category/retryability reason/operator and user-safe messages/sanitized technical text/signature. |

Do not treat `outputSnapshot` as the source of truth. It remains the existing capped preview. Do not introduce `parentGeneration`, `retryRootGeneration`, `recoveredSite`, `RecoveryJob`, or `IssueLink` in this PR, because they are consumed by US-F41-03/05 and have no writer yet.

### 3.4 Evidence normalization and privacy

Add a focused helper under `src/lib/ai/` for:

- stable trace/input hashes;
- size-capped serializable `inputSnapshot` and evidence fields;
- mapping known thrown/persistence errors to a normalized code, phase and safe messages;
- deriving `succeeded`, `partial_failed`, or `failed` only from site/page persistence outcomes;
- building one final payload for `AiGenerationRecords`.

Its input is route-owned structured data, never raw request headers or an arbitrary error object. The helper must strip absolute paths, stack traces, provider payloads, tokens and request headers. `operatorMessage` may be more diagnostic than `userSafeMessage`, but must remain sanitized and bounded. Unknown component data remains absent/`null`, never fabricated.

## 4. Implementation phases

### Phase 1 — Define capture types, normalizer and terminal finalizer

**Files to create/change**

- Modify `src/lib/ai/capture-generation.ts`
- Create `src/lib/ai/generation-outcome.ts`
- Create `src/__tests__/unit/ai/generation-outcome.test.ts`

**Work**

1. Replace the website-specific `FinishCaptureInput.status: 'success' | 'failed'` call pattern with typed lifecycle/finalization input while retaining a small legacy adapter for `generate-meta.ts` and other non-site callers.
2. Export explicit types for frozen input, per-page persistence outcome, normalized error and finalization result. Do not use `any`.
3. Implement a pure `finalizeGenerationOutcome()` reducer that accepts expected pages, persisted pages, page failures and terminal route error. It returns:
   - `succeeded` when all expected pages persisted and there is no terminal site failure;
   - `partial_failed` when at least one page persisted and at least one expected/attempted page failed;
   - `failed` when no page/site persistence succeeded;
   - `pageSummary`, normalized bounded errors and a safe user message.
4. Implement `finalizeCapture()` as the sole database writer for a terminal website run. It must be safe to call twice: an already terminal record returns without mutating evidence/outcome. It always applies the legacy status mapping in Section 3.1.
5. Keep `startCapture()` best-effort for non-F41 callers, but add a strict route-owned website mode whose failures are observable and cannot silently produce an untracked false-success run. Decide the exact behavior in implementation using existing route error conventions; do not let an untracked run be reported as tracked success.

### Phase 2 — Extend Payload schema and idempotent SQL migration

**Files to change**

- Modify `src/collections/AiGenerationRecords.ts`
- Modify `scripts/db-setup.js`
- Regenerate `src/payload-types.ts` using the repository's Payload type-generation command, then include only its expected generated diff.
- Create `src/__tests__/integration/f41-ai-generation-records-schema.test.ts`

**Work**

1. Add the fields in Section 3.3 using Payload groups/arrays/selects and admin descriptions that explain the terminal invariant.
2. Preserve existing fields and `status` options. Do not rename/drop a legacy column or make newly introduced fields required at schema level, because existing rows must remain readable.
3. Add migration entries after the existing `AiGenerationRecords` migration block. Every root/group field gets `ALTER TABLE IF EXISTS ai_generation_records ADD COLUMN IF NOT EXISTS ...` using the corresponding snake-case name.
4. Create one table per new Payload array. Each table must use exactly the project-required array shape:

```sql
CREATE TABLE IF NOT EXISTS ai_generation_records_<array_name> (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  _order integer NOT NULL DEFAULT 0,
  _parent_id integer NOT NULL REFERENCES ai_generation_records(id) ON DELETE CASCADE,
  _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
  ...
);
```

5. Add `CREATE INDEX IF NOT EXISTS` for fields used by later list/filter lookups: trace ID, lifecycle/outcome/recovery status, terminal time, plus each array parent ID. Group fields are root columns named `<group>_<field>` and therefore need their own `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` entries.
6. Never use `DROP TABLE`, destructive backfill, a serial array ID, or a non-idempotent index/table change. Migration must work both if Payload schema already created the table and if the database is blank.

### Phase 3 — Move website capture ownership to the persistence route

**Files to change**

- Modify `src/lib/ai/openai-generator.ts`
- Modify `src/app/api/ai/generate-site/route.ts`
- Modify/add route tests in `src/__tests__/api/` or `src/__tests__/integration/` following the nearest generate-site route pattern

**Work**

1. Remove/deactivate `site-generator` terminal capture calls inside `generateSiteWithAI()` so fallback/template/AI composition only returns its generated result and selected-block metadata to the route. Keep capture behavior for `generate-meta.ts` unchanged.
2. In `POST /api/ai/generate-site`, after all validation/authorization/tenant setup and before composition, build a versioned frozen snapshot from the already normalized business input and resolved generation options. Capture `generationRequestId` as `traceId`, caller user ID, tenant context if supported by the root record, and initial `queued/running` state.
3. Thread the capture handle/context through `runGenPipeline`. After site persistence, attach the actual `site` relation. After every page persistence result, append/update a page outcome. Convert existing `createdPages` and `pageFailures` into structured values without leaking raw errors.
4. On pipeline success, call the finalizer after all page persistence and non-fatal page failures have been collected. The HTTP/SSE response may be returned only after the finalizer has been awaited or its failure has been handled according to the strict tracking decision in Phase 1.
5. On all route/SSE failures, normalize the active phase and call the same finalizer in `finally`. Preserve existing site `generationStatus` recovery behavior, but do not allow it to determine `AiGenerationRecords.outcome`.
6. Ensure SSE stream cancel/late enqueue failure cannot skip finalization. Terminal event emission remains a later F41 event-contract task; this story must at minimum persist a terminal record exactly once.
7. Do not modify the legacy admin rerun route, its in-place page deletion behavior, queue strategy, retry policy endpoint, list/detail UI or Vercel duration in this story. Record this existing `maxDuration = 300` conflict for US-F41-03, where the approved async worker is introduced.

### Phase 4 — Verify, migrate safely and hand off

**Files to change**

- Modify only the tests introduced/updated in Phases 1–3, plus generated `src/payload-types.ts` if needed.

**Work**

1. Run migration-only twice against an isolated local/test PostgreSQL database. Inspect `scripts/db-setup.js` diff to ensure every collection field has its matching SQL migration.
2. Run targeted unit/integration tests, then typecheck/lint relevant to modified files.
3. Manually exercise a deterministic partial failure fixture in a test tenant only, and verify database record: old `status`, new axes, site relation, frozen snapshot/hash, page counts/outcomes and sanitized evidence agree with the actual persistence result.
4. Add a PR note that retry/UI work remains intentionally deferred to US-F41-02/03/04/05/06.

## 5. Test plan and required mapping

| QA case | Automated coverage to add | Expected assertion |
|---|---|---|
| TC-F41-01 | API/integration authorization/capture setup test, where applicable to this story | Capture is associated with authenticated website generation; non-admin readers are still protected by collection access. |
| TC-F41-02 | `generation-outcome.test.ts` + route integration with site persistence failure | Compose success plus site persistence failure finalizes `terminal/failed`, never legacy success, with normalized site-persist error. |
| TC-F41-03 | Reducer + route integration fixture for 4 persisted pages and 1 failure | `terminal/partial_failed`, summary expected 5/persisted 4/failed 1; failed page and code stored; no component result invented. |
| TC-F41-04 | Serializer/normalizer unit test | Missing relations remain explicit unknown/null; input/evidence/output snapshot are bounded and stack/path/header/provider-sensitive content is removed. |
| TC-F41-05 | Schema/migration integration test | `scripts/db-setup.js --migrate-only` succeeds twice from clean DB; group columns and array tables follow UUID/order/parent/uuid shape; no destructive SQL. |

All test titles/describes must cite their TC ID and follow Arrange/Act/Assert. Put mocks at the top of test files, import real helpers from source, and do not call OpenAI, send email, or use real tenant/user data.

## 6. Commands to execute during implementation

```bash
# Inspect changed schema/migration before running tests
git diff -- src/collections/AiGenerationRecords.ts scripts/db-setup.js src/lib/ai/capture-generation.ts src/lib/ai/generation-outcome.ts src/app/api/ai/generate-site/route.ts

# Payload types: use the package script discovered in package.json before writing code.
pnpm payload generate:types

# Isolated migration idempotency, twice. Use the repository-supported test DB setup.
node scripts/db-setup.js --migrate-only
node scripts/db-setup.js --migrate-only

# Targeted tests, then the normal CI-equivalent quality gates.
pnpm vitest run src/__tests__/unit/ai/generation-outcome.test.ts src/__tests__/integration/f41-ai-generation-records-schema.test.ts
pnpm lint
pnpm typecheck
git diff --check
```

Before executing, confirm the exact package-manager script names from `package.json`; substitute the repository's real command if `pnpm payload generate:types`, `pnpm lint` or `pnpm typecheck` are named differently.

## 7. Risks, guardrails and rollback

| Risk | Guardrail | Rollback / containment |
|---|---|---|
| Finalizer accidentally marks success before persistence | Compose module has no website terminal writer; only route finalizer may set terminal outcome. | Revert route/capture changes as one PR; legacy `status` and additive columns leave old readers functional. |
| Schema migration breaks production DB | Additive idempotent SQL only; validate twice on blank/test DB first. | Stop rollout before deploy; no `DROP`/destructive reversal required. |
| Existing generic meta generation regresses | Keep legacy adapter and test `generate-meta` behavior separately. | Restore only non-site legacy adapter; website route remains route-owned. |
| Snapshot/evidence leaks PII or raw provider data | Allowlist structured snapshot; sanitize/cap all messages and never serialize arbitrary `Error`. | Disable detail exposure in later USs; records remain admin-only and can be redacted with a targeted data repair. |
| Capture DB failure silently reintroduces false confidence | Website route treats capture persistence as an explicit tracked failure/alert per Phase 1 decision. | Return a safe failure and retain server log trace; do not claim completed generation. |
| Partial page persistence is miscounted | Derive summary from concrete per-page writes/failures and test 4/5 fixture. | Compare stored evidence to site/pages DB for affected trace IDs before enabling Operations views. |

## 8. Definition of Done

- [ ] `AiGenerationRecords` contains additive F41 lifecycle/outcome/recovery, trace, frozen input, timing, page summary, page outcome and normalized evidence fields.
- [ ] Every new collection field/table has an idempotent matching entry in `scripts/db-setup.js`; array tables satisfy UUID, `_order`, `_parent_id`, `_uuid` requirements and no migration uses `DROP TABLE`.
- [ ] Website generation capture starts after validation/auth and terminalizes exactly once after site/page persistence, for JSON and SSE success/failure paths.
- [ ] AI composition cannot write a website-generation success state by itself.
- [ ] `succeeded`, `partial_failed` and `failed` derive from actual persistence; legacy `status` remains compatible.
- [ ] Frozen structured input, page results and evidence are bounded/sanitized; no raw prompt/provider error/stack/header is stored in newly introduced evidence.
- [ ] TC-F41-01 through TC-F41-05 have mapped, passing automated tests, including a twice-run migration test.
- [ ] Targeted tests, repository type/lint checks and `git diff --check` pass.
- [ ] PR description uses `Relates to #1849`, has a conventional title with story ID, and does not include unrelated changes.
