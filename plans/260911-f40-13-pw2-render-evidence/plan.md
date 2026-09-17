---
title: "US-F40-13 Xác minh dữ liệu PW2, hỗ trợ component và hiển thị thực tế"
description: "Thay preview PW2 suy đoán bằng ba nguồn bằng chứng độc lập: bản ghi PW2, registry renderer và kết quả live on-demand."
status: planned
priority: P1
effort: 5d after mapping contract is available
branch: feat/F40-1838-pw2-render-evidence
tags: [f40, qa, migration, payload, renderer, evidence]
created: 2026-09-11
issue: 1838
---

# Kế hoạch triển khai

## Mục tiêu

Làm cho tab **So Sánh Khối** trả lời được ba câu hỏi độc lập, có bằng chứng và không tạo false pass:

1. Dữ liệu block PW1 có tồn tại trong `Pages.layout` PW2 thật hay không?
2. Block PW2 thật đó có renderer trong `blockRegistry` hay không?
3. Website PW2 thật đã được kiểm tra render block đó hay chưa?

Kết quả phải phân biệt rõ **data đã migrate nhưng template/renderer chưa hỗ trợ** với **data chưa migrate**. Cột PW2 chỉ được preview khi evidence xác nhận cả bản ghi PW2 và renderer; không được dùng `pw2Preview` suy đoán như evidence.

## Kết quả khảo sát hiện tại

- `src/lib/admin/qa/pw1-mysql-connector.ts` tạo `pw1Preview` và `pw2Preview` cùng từ dữ liệu PW1. Vì vậy `pw2Preview` không phải dữ liệu Payload/Postgres và không được dùng để kết luận AC-1.
- `src/collections/Pages.ts` lưu block thật trong `pages.layout`; block có `id`, `blockType`, config và thứ tự. Collection hiện không có `legacy_id`/khóa PW1 công khai trong schema.
- `src/blocks/registry.ts` là source of truth để xác định renderer có tồn tại (`blockRegistry.has(blockType)`). `SiteRenderer` dùng chính registry này và hiện bỏ qua silent block lạ.
- Endpoint `/api/qa/migration-diff` đã có `withSuperAdmin`, `dynamic = force-dynamic`, `maxDuration = 60`, nhưng endpoint/DTO hiện tại pha trộn dữ liệu demo/PW1 và không có evidence PW2 thật.
- Không có runner/browser-evidence service đã được xác nhận cho live check. HTTP 200 hay iframe `onLoad` không chứng minh một block đã render, nên không thể dùng thay kết quả live.

## Phạm vi và giới hạn

### Trong phạm vi

- Adapter server-side đọc PW2 Payload/Postgres, mapping versioned và block registry.
- DTO ba lớp bằng chứng, server sanitize/fail-closed, UI badge/placeholder/accordion và live-check on-demand contract.
- Unit/API/E2E theo AC, desktop và 375px.

### Ngoài phạm vi

- Tạo component PW2 thiếu, tự sửa migration/data, hoặc chạy browser check bắt buộc mỗi lần scan.
- Khẳng định live pass từ preview tĩnh, iframe load, HTTP 200, hay `pw2Preview`.
- Lộ raw credentials, payment token, cookie, raw HTML không sanitize, hoặc secrets trong JSON evidence.

## Quy tắc trạng thái (không được suy diễn)

| Lớp | Trạng thái hợp lệ | Khi nào được xanh/đỏ/cam |
| --- | --- | --- |
| Dữ liệu PW2 | `migrated`, `missing`, `mismatch`, `unverified` | Xanh chỉ khi mapping versioned tìm đúng record PW2 thật và so sánh canonical data đạt; đỏ khi missing/mismatch có evidence; cam/xám khi thiếu mapping/evidence. |
| Component | `supported`, `unsupported`, `unverified` | Xanh chỉ khi block PW2 thật có `blockType` và `blockRegistry.has(blockType)`; cam khi không có renderer hay mapping/data chưa xác định. Không làm data badge đỏ. |
| Live render | `rendered`, `not_rendered`, `unverified` | Xanh/đỏ chỉ từ runner evidence có timestamp + evidence ref; xám trước khi QA chạy probe. |

`overall = pass` chỉ khi **cả ba** là `migrated + supported + rendered`. Mọi trạng thái còn lại là `needs_review` hoặc `failed`; UI không hiển thị `KHỚP 100%` nếu `overall !== pass`.

## Phases

| # | Phase | Status | Effort | Dependency |
| --- | --- | --- | --- | --- |
| 01 | Khóa contract mapping và DTO evidence fail-closed | blocked | 1d | Team migration/PW2 ownership |
| 02 | Adapter PW2 thật và renderer registry | pending | 1.25d | Phase 01 |
| 03 | API protected + live-evidence adapter | pending | 0.75d | Phase 01–02 + QA runner decision |
| 04 | UI So Sánh Khối trung thực, responsive | pending | 1d | Phase 02–03 read contract |
| 05 | Test, staging proof và QA handoff | pending | 1d | All |

- [Phase 01](phase-01-mapping-contract-and-evidence-types.md)
- [Phase 02](phase-02-payload-and-renderer-evidence-adapters.md)
- [Phase 03](phase-03-protected-api-and-live-probe-contract.md)
- [Phase 04](phase-04-honest-block-comparison-ui.md)
- [Phase 05](phase-05-ac-tests-rollout-and-handoff.md)

## Acceptance trace

| Issue AC | Phases | Verification |
| --- | --- | --- |
| AC-1 PW2 thật, không suy đoán preview | 01–03 | TC-F40-13-01, 02 |
| AC-2 renderer/template riêng data | 01–02 | TC-F40-13-03 |
| AC-3 placeholder khi data có nhưng renderer không có | 04 | TC-F40-13-04 E2E |
| AC-4 ba badge, không false `100%` | 01, 04 | TC-F40-13-05 |
| AC-5 màu/bằng chứng accordion | 01, 04 | TC-F40-13-06 |
| AC-6 live on-demand, evidence/timestamp | 03–05 | TC-F40-13-07, 08 |

## Blocker bắt buộc trước khi claim AC-1/AC-6 pass

1. **PW1→PW2 mapping owner** cung cấp source of truth versioned, queryable server-side: `store` identity, `pw1_page_component_id`/`legacy_id`, `pw2_site_id`, `pw2_page_id`, `pw2_layout_block_id`, expected `blockType`, `mapping_version`, `mapped_at`, owner. Mapping phải có unique identity, không heuristic theo label/position.
2. **Payload/PW2 owner** xác nhận collection/table và quyền đọc production/staging-safe cho `pages.layout`, cũng như format chính xác của block `id` và `blockType`. Nếu cần thêm mapping collection/field schema, owner phải chốt schema trước; migration SQL additive trong `scripts/db-setup.js` là bắt buộc.
3. **QA platform owner** chốt authoritative live runner contract: runner chỉ nhận store/page/block opaque IDs allow-listed, trả `rendered/not_rendered`, `checkedAt`, safe `evidenceRef` (không raw trace/cookie), và không được client cung cấp arbitrary URL/selector/command.
4. **Template owner** xác nhận component support là registry runtime (`blockRegistry`) hay thêm allow-list per template/site. Nếu template hạn chế subset registry, mapping phải biểu diễn allow-list/version này; global registry có component không đủ để khẳng định template hỗ trợ.

Khi một dependency chưa có, UI vẫn deploy được nhưng phải hiển thị `Chưa xác minh`/`Mapping không xác định`, không mô phỏng PW2 và không cấp QC pass.

## API / DTO contract đề xuất

`GET /api/qa/migration-render-evidence?store_id=<opaque>&page_id=<opaque>` (Super Admin only) trả một snapshot đã sanitize:

```ts
type BlockRenderEvidence = {
  pw1: { componentId: string; legacyId: string; pageId: string; blockType: string; order: number }
  pw2Data: {
    status: "migrated" | "missing" | "mismatch" | "unverified"
    pageId?: string
    layoutBlockId?: string
    blockType?: string
    mappingVersion?: string
    checkedAt: string
    reasonCode: string
    fields?: SafeFieldEvidence[]
  }
  component: {
    status: "supported" | "unsupported" | "unverified"
    registryBlockType?: string
    registryVersion?: string
    reasonCode: string
  }
  liveRender: {
    status: "rendered" | "not_rendered" | "unverified"
    checkedAt?: string
    evidenceRef?: string
    reasonCode: string
  }
  overall: "pass" | "needs_review" | "failed"
}
```

`POST /api/qa/migration-render-evidence/live-check` accepts only validated `store_id`, `page_id`, `legacy_id` and a CSRF-safe Super Admin session; it delegates to the server-owned QA runner. It must not accept URL, CSS selector, JavaScript, credentials or client evidence. If runner is unavailable/times out, persist/return `unverified`, never `not_rendered` or pass.

The API must use Zod safe parsing with bounded opaque IDs, page count/cursor limits, a fixed enum action, `withSuperAdmin`, `dynamic = "force-dynamic"`, and `maxDuration <= 60`. DTO serialization must use an allow-list and redact/drop keys matching `password`, `secret`, `token`, `apiKey`, `authorization`, payment credentials and PII fields not required for block evidence.

## Delivery decision

Implement Phases 01–04 only after the mapping contract is approved. A UI-only scaffold may be split into a separate PR only if it is explicitly labelled **unverified shell**, consumes a typed adapter boundary, and cannot display demo/inferred data as PW2 evidence. It does not satisfy #1838 Definition of Done by itself.
