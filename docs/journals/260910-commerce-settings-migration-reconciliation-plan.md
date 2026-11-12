---
date: 2026-09-10
topic: commerce-settings-migration-reconciliation
---

# Commerce và Settings migration reconciliation plan

## Decision

- Tester cần UI đơn giản: Đúng, Thiếu, Lệch, Trùng, Chưa xác minh.
- Scope gồm toàn bộ lịch sử Product, Order, Discount, Customer và một tab Settings.
- Settings gồm profile, team, email template, payment, delivery, domain và app integration.

## Critical dependency

PW2 chưa có contract/link truy vết PW1 ID → PW2 ID. Không được triển khai logic certify migration trước khi migration team chốt mapping evidence và backfill dữ liệu cũ. Fallback bằng SKU/email/order number chỉ là `Chưa xác minh`.

## Required support

Plan ghi rõ input cần từ Migration/Data, PW1/PW2 DBA, Product/Finance, Operations và Security; handoff tối thiểu là mapping export mẫu, quy tắc status/tài chính, quyền read-only cấu hình ngoài ticket và baseline QA.

## Plan

`plans/260910-commerce-settings-migration-reconciliation/plan.md` tách foundation → Commerce/Settings → UI/test.

Tracking issue: #1839.
