---
status: in_review
feature: F41
story: US-F41-07
issue: 1882
title: Structured generation incident diagnosis
branch: feat/F41-07-structured-generation-incident
base: staging
blockedBy: [US-F41-04]
blocks: []
---

# US-F41-07 — Chẩn đoán sự cố generation có cấu trúc

## Outcome

Mỗi generation failed/partial_failed có một incident snapshot an toàn, đủ để
Tracker/QA/Dev trả lời cùng bốn câu hỏi: lỗi gì, ở đâu, ảnh hưởng gì, làm gì
tiếp theo. Detail và ticket dùng cùng read model; UI không suy diễn từ copy.

> **Dependency note (2026-09-16):** phần contract, migration, normalizer và
> test độc lập có thể triển khai trên branch này. `IncidentPanel` và serializer
> detail chỉ được tích hợp sau khi US-F41-04 merge vào `staging`; không
> cherry-pick F41-04 vào PR này để giữ nguyên nguyên tắc một US/một PR.

## Scope và quyết định

- Mở rộng `generationErrors` bằng `locationLabel`, `validationRule`,
  `observedState`; `locationKey` là stable key. Không lưu raw field value.
- Error normalizer là nơi duy nhất map code/phase sang taxonomy và safe label.
- Detail thay alert/card trùng lặp bằng một `IncidentPanel`; technical evidence
  là disclosure chỉ render khi có sanitized message hoặc duration hữu ích.
- `page/component` chỉ hiển thị khi capture tồn tại. Legacy trả Unknown rõ ràng.
- US-F41-05 tiêu thụ snapshot này khi tạo/dedupe ticket, nhưng API ticket vẫn
  là scope riêng; không tạo ticket giả trong F41-07.

## Phase 1 — Durable incident contract và migration

**Status: complete (2026-09-16).**

1. Cập nhật `AiGenerationRecords.generationErrors` và
   `scripts/db-setup.js` migration idempotent cho array columns mới.
2. Define allowlist enum: input/page/component/system/quota labels, validation
   rules và observed states. Reject/sanitize free-form provider values.
3. Update capture/finalizer/recovery worker để preserve incident fields qua
   original/retry child, với Unknown cho nguồn legacy.
4. Tests TC-F41-26: migration chạy hai lần, no DROP, raw form value không vào
   durable error record.

## Phase 2 — Safe serializer và ticket snapshot boundary

**Status: complete (2026-09-16; integrated after US-F41-04 merged).**

1. Extend `serializeAdminGenerationDetail` trả `incident` structured read model:
   `kind`, `location`, `cause`, `impact`, `recovery`, `owner`, `nextAction`,
   `developerEvidence`.
2. Server derives recovery/owner only from recovery policy; never client parse.
3. Explicit redaction: no prompt/raw form value/token/header/stack; Super Admin
   only and tenant isolation unchanged.
4. Extract safe ticket snapshot builder for US-F41-05; it has no mutation API
   in this story.
5. Tests TC-F41-27 + TC-F41-29 serializer privacy/equivalence fixtures.

## Phase 3 — Detail redesign

**Status: complete (2026-09-16; integrated after US-F41-04 merged).**

1. Add `IncidentPanel` as the one visible source of truth: error category,
   affected location, plain-language cause, impact, retryability/owner/CTA.
2. Render the top status compactly; avoid duplicated message/action.
3. Render a compact legacy warning only for failed/partial legacy records with
   missing capture; no alert fatigue for queued/succeeded runs.
4. `Thông tin Dev` is keyboard-accessible `<details>`, only when useful
   evidence exists. Never render schema/hash as operational evidence.
5. Update the F41 HTML wireframe and responsive visual checks (1440/1024/375).

## Phase 4 — QA, observability and handoff

**Status: complete for this story's contract/UI scope (2026-09-16).**

1. Add fixtures: input required/format, page, component, quota/system, legacy.
2. Add component/API privacy tests, keyboard disclosure and ticket snapshot
   handoff contract test. (No new route was introduced; existing route tests
   cover the read contract.)
3. Verify `db-setup.js --migrate-only` twice, targeted tests, typecheck,
   lint and diff check. Local smoke test verified authenticated listing; the
   local DB had no generation fixture available to open a real detail record.

## Non-goals and guardrails

- No independent page/component retry; F41 retry remains whole website only.
- No ticket creation/dedupe API in this story; US-F41-05 owns mutation.
- No raw input value, prompt, provider payload, stack trace or secret in DB,
  API, UI, export or issue snapshot.
- If no evidence exists, state Unknown; never fabricate a field/component.
