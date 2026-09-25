---
title: "US-F40-14 — Đối soát migration Commerce và Settings PW1 → PW2"
description: "Bổ sung đối soát dữ liệu lịch sử Products, Orders, Discounts, Customers và Settings theo trạng thái đơn giản cho Tester."
status: pending
priority: P1
effort: 18-24h
issue: 1839
branch: feat/F40-1839-commerce-settings-reconciliation-shell
tags: [f40, migration, commerce, settings, qa, pw1, pw2]
blockedBy: []
blocks: []
created: 2026-09-10
---

# US-F40-14 — Đối soát migration Commerce và Settings

## Overview

Mở rộng Migration Inspector để Tester đối soát toàn bộ lịch sử dữ liệu PW1 → PW2 theo hai phần:

1. **Commerce:** Product, Order, Discount, Customer.
2. **Settings:** Account profile, Team members/roles, Email templates, Payment, Delivery, Web address/domain, App integrations.

UI không dùng thuật ngữ kỹ thuật làm kết luận chính. Mỗi record/hạng mục chỉ có: **Đúng**, **Thiếu**, **Lệch**, **Trùng**, **Chưa xác minh**. Chi tiết PW1/PW2 chỉ hiện khi Tester mở dòng.

## Scope lock

- Toàn bộ lịch sử theo từng store; không chỉ dữ liệu active/gần đây.
- Read-only audit. Không sửa PW1/PW2, không tự ghép record mơ hồ, không tự sửa lỗi migration.
- PII che mặc định; secret/password/API token/MFA secret không được đọc, so sánh hoặc trả về browser.
- Không thay thế #1838: #1838 xử lý evidence block/render; plan này xử lý entity Commerce và Settings.

## Prerequisite bắt buộc

Migration team phải chốt contract định danh PW1 → PW2: `source_entity`, `source_id`, `target_collection`, `target_id`, `site/tenant`, `migration_run`, `mapped_at`. Không có mapping này, fallback chỉ được trả trạng thái **Chưa xác minh**, không được certify pass.

## Phạm vi build trước — có thể thực hiện ngay

Build trước **Migration Reconciliation Shell**: hai tab Commerce/Settings, summary, filter, bảng phân trang, detail panel PW1/PW2, masking PII, Super Admin guard, API/type contract và E2E. Dữ liệu chưa có evidence thật luôn trả `Chưa xác minh`.

Để tích hợp không phải làm lại khi mapping được bàn giao, server sẽ nhận một DTO/adapter versioned (ví dụ `MappingEvidenceProvider`) thay vì UI đọc trực tiếp bảng mapping. Contract tối thiểu là các trường trong phần Prerequisite, cùng `status/confidence` và version. Team có thể lưu mapping ở bảng sidecar, collection Payload hoặc output migration job; chỉ adapter server biết cách đọc nguồn đó. Nếu contract đổi trường hoặc semantics, phải version DTO và cập nhật adapter + test contract — UI/table/detail không đổi.

## Team support bắt buộc

| Team / owner | Cần cung cấp hoặc chốt | Block nếu thiếu |
|---|---|---|
| Migration / Backend | Contract mapping PW1 ID → PW2 ID; nơi lưu, schema, owner ghi dữ liệu, versioning và mapping confidence | Không thể kết luận record đã migrate/thiếu một cách đáng tin cậy |
| Migration / Data | Backfill mapping cho toàn bộ website đã migrate; migration run ID, thời điểm chạy, kết quả/lỗi từng run | Chỉ audit được migration mới; lịch sử cũ là `Chưa xác minh` |
| PW1 owner / DBA | Read-only access, schema/table chính thức và khóa nghiệp vụ của Product, Order, Discount, Customer, Settings | Không thể đọc đủ nguồn hoặc so sánh đúng field |
| PW2 Backend / DBA | Xác nhận collection/field PW2 chuẩn, quan hệ tenant/site và index phục vụ query audit | Có nguy cơ query sai tenant/chậm trên dữ liệu lịch sử lớn |
| Product / Finance | Bảng quy đổi order/payment/status, currency/rounding, tax/shipping/refund và mức lỗi P0/P1 | Lệch trạng thái/tiền có thể là false positive hoặc bỏ sót P0 |
| Business Operations | Chính sách migrate toàn bộ lịch sử: dữ liệu nào bắt buộc, retention, expected counts và tiêu chí cutover pass/fail | Không có chuẩn để báo store pass migration |
| Security | Allow-list field Settings; masking PII; xác nhận không migrate/không trả về password, token, MFA secret, API key | Rủi ro lộ credential hoặc PII trong QA API/UI |

### Handoff tối thiểu để bắt đầu code

1. Một sample mapping export của ít nhất một store thật gồm Product, Order, Discount, Customer và Settings.
2. Mapping/status matrix đã được Product/Finance duyệt.
3. Read-only credential/env của PW1 và quyền đọc PW2 staging đã được cấu hình bởi team owner; không gửi secret trong ticket/PR.
4. Danh sách store/migration run dùng cho QA và expected count/tổng tiền baseline.

## UX decision

Trong Migration Inspector thêm hai tab: **Đối soát Commerce** và **Đối soát Settings**. Mỗi tab dùng cùng khung: tổng quan counts → filter lỗi → bảng phân trang → side panel PW1/PW2.

## Phases

| # | Phase | Status | Depends |
|---|---|---|---|
| 01 | [Foundation: mapping, snapshot và contract](./phase-01-foundation-mapping-snapshot.md) | Blocked — chờ contract | — |
| 02 | [Commerce: Product, Order, Discount, Customer](./phase-02-commerce-reconciliation.md) | Pending | 01 |
| 03 | [Settings: cấu hình và team](./phase-03-settings-reconciliation.md) | Pending | 01 |
| 04 | [Tester UI, security và validation](./phase-04-ui-testing-validation.md) | Pending | 02, 03 |

## Success criteria

- Tester biết ngay store có pass migration hay không và lỗi thuộc nhóm nào.
- Không có trạng thái pass dựa trên preview/suy đoán hoặc fallback mapping.
- Counts, record diff và aggregate tài chính có evidence snapshot + timestamp.
- PII/secret không lộ qua API hoặc UI.

## Coordination note — 2026-09-17

Importer #1886 đang có [kế hoạch tiếp nối](../260916-1617-pw1-local-json-import/plan.md) để nhận artifact exporter mới. Hai plan không chặn toàn bộ nhau: UI shell vẫn có thể build với trạng thái Chưa xác minh, importer local không cần UI này. Khi nhận shared-ledger evidence, adapter cần phân biệt businessCREATE với external creator binding SKIP/non-owning và consumer dependencies; không suy active source claim là User đã được tạo hoặc Store sở hữu actor. Đây là handoff cần xác minh sau implementation, chưa phải schema/evidence đã triển khai.
