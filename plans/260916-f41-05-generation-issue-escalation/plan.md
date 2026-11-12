---
title: "Generation issue escalation"
description: "Create one safe, deduplicated Dev issue from a non-recoverable generation incident."
status: pending
priority: P1
effort: 7h
issue: 1853
branch: feat/F41-05-generation-issue-escalation
tags: [feature, backend, frontend, database, api]
blockedBy: [260916-f41-07-structured-generation-incident]
blocks: []
created: 2026-09-16
---

# US-F41-05 — Escalate lỗi không recovery được

## Outcome

Tracker bấm **Tạo ticket Dev** trên generation `ticket_required`/`exhausted`.
Server tạo hoặc trả lại đúng một issue nội bộ, chứa snapshot incident đã sanitize;
listing/detail chuyển CTA thành **Mở ticket**.

## Decision

- Không dùng generic `POST /api/admin/issues`: client không được tự gửi title,
  description hay technical data.
- Thêm endpoint chuyên biệt `POST /api/admin/generations/:id/issue`.
- Dedupe key là deterministic theo retry-root generation + normalized incident
  signature. Do đó double-click, refresh và retry-child failed cùng incident chỉ
  có một issue; lỗi khác vẫn tạo issue riêng.
- Unique index DB là source of truth; query-before-create chỉ tối ưu UX, không
  thay thế xử lý race `23505`.

## Dependency

| Relationship | Plan | Status |
|---|---|---|
| Blocked by | [Structured incident diagnosis](../260916-f41-07-structured-generation-incident/plan.md) | PR #1884 in review |

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Safe escalation contract and persistence](./phase-01-contract-persistence.md) | Pending |
| 2 | [Endpoint and operator actions](./phase-02-api-ui.md) | Pending |
| 3 | [Automated and manual verification](./phase-03-verification.md) | Pending |

## Non-goals

- Không tạo GitHub ticket hay ticket external.
- Không retry component/page; retry toàn website vẫn thuộc F41-03.
- Không expose raw form, prompt, provider payload, stack, token/header hoặc PII.
- Không thay đổi trạng thái issue ngoài việc tạo/trả lại issue mở hiện hữu.
