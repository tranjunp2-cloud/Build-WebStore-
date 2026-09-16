---
status: proposed
feature: F41
story: US-F41-04
issue: 1852
title: Full generation debug context
branch: feat/F41-04-generation-debug-context
base: staging
---

# US-F41-04 — Xem đầy đủ context để debug

## Mục tiêu và quyết định

Thay drawer detail 720px hiện tại bằng trang full-page, shareable
`/studio/generations/{id}`. Chỉ Super Admin đọc một detail serializer mới,
explicit allowlist; không trả raw prompt, request header, stack trace hay toàn
bộ Payload record. Listing vẫn dùng summary API hiện tại.

## Acceptance checklist

| AC #1852 | Cách đáp ứng |
|---|---|
| preview/live URL, user identity | Header + Website & User section từ detail read model |
| input summary + Xem form đầy đủ | 5 field safe mặc định; disclosure chỉ hiển thị field allowlist cần cho debug |
| pages/result/tree | pageSummary + pageOutcomes; component chỉ khi captured, thiếu data ghi `Không xác định` |
| timeline/retry history/evidence | Derived safe timeline từ timestamps/lineage/job, evidence collapsed mặc định |

## Phase 1 — Safe detail read model và API

1. Thay `GET /api/admin/generations/:id` đang trả raw Payload document bằng
   `serializeAdminGenerationDetail(record)`: identity, URL state, allowlisted
   frozen form, page outcomes, normalized error/recovery/retry lineage và
   sanitized technical evidence.
2. Validate numeric ID; giữ `withSuperAdmin`; trả 404 an toàn, không leak
   record cho non-Super-Admin.
3. Hydrate quan hệ có giới hạn, không N+1; URL chỉ preview/live đã tồn tại.
   Không thêm schema/migration nếu fields F41-01/03 đã đủ.
4. Unit/API test: RBAC, 404, raw prompt/stack secret redaction, missing
   relation/site, all detail sections.

## Phase 2 — Full-page detail UX

1. Add route `src/app/studio/generations/[id]/page.tsx` with
   `dynamic = 'force-dynamic'` + Super Admin guard.
2. Detail client fetches safe API, renders loading/empty/error/retry states.
   Listing `Xem` navigates to full route; back returns prior queue/query.
3. Implement exact design hierarchy: header actions; Website & User; collapsed
   Input; Result; Attention/recovery; Pages; Timeline; collapsed Evidence.
   Reuse F41-03 `GenerationRetryAction`; no ticket CTA (US-F41-05 owns it).
4. Keyboard/mobile 375px: focusable disclosure, nút quay lại giữ queue trước
   đó khi mở từ listing, links labelled, no color-only meaning. Không có Copy
   link theo quyết định UX đã duyệt.

## Phase 3 — Timeline/retry context

1. Define deterministic derived timeline using `submittedAt`, `startedAt`,
   `completedAt/terminalAt`, recovery job timestamps and parent/child lineage.
2. Show retry history with explicit unknown when event/page/component capture
   is absent; never fabricate a component tree.
3. Preserve parent/child distinction and expose child/recovery draft link only
   where record exists and role is authorized.

## Phase 4 — Tests, QA and handoff

1. Map unit/API/component tests to TC-F41-14/15/16/20 and add Playwright
   full-page flow with Super Admin fixture.
2. Run targeted tests, typecheck, lint, `git diff --check`, and code review.
3. Manual QA: 1440/1024/768/375, keyboard/Escape/back, raw-evidence privacy,
   missing site/user and retrying parent/child cases.

## Non-goals / guardrails

- Không làm Create ticket, dedupe issue hay end-user status (US-F41-05/06).
  Detail chỉ có thể điều hướng sang Issues & feedback, không tạo/mutate ticket.
- Không retry component/page; retry whole website only.
- Không expose `promptText`, raw provider errors, request headers or stack trace.
- Không mutate parent/site/pages from detail view.
