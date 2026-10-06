# F40 — Dev handoff: dữ liệu cần bàn giao cho Migration Inspector

> Liên quan: [#1838 — Block/renderer/live render](https://github.com/primeproduction/ech-prime-web-v2/issues/1838), [#1839 — Commerce & Settings](https://github.com/primeproduction/ech-prime-web-v2/issues/1839)
> Tài liệu mapping nền: [PW1 → PW2 master field mapping](https://github.com/primeproduction/ech-prime-web-v2/blob/docs/f41-pw1-pw2-migration-planning/docs/migration/pw1-pw2-master-field-mapping.md)

## Mục tiêu

F40 đã có UI và API boundary. Để QA đối soát dữ liệu migration thật, Dev/Migration cần cung cấp **bằng chứng record PW1 nào tương ứng record PW2 nào**. F40 không được tự suy luận bằng SKU, email hoặc mã đơn.

Master field mapping hiện tại đủ để giải thích cách map/so sánh field, nhưng `_ref`, JSON mẫu và `targetPath` dự kiến **không phải** bằng chứng record PW2 đã được ghi.

## Dev cần bàn giao

| # | Artifact cần có | Nội dung tối thiểu | Ý nghĩa |
|---|---|---|---|
| 1 | **Crosswalk PW1 → PW2** | `source_db`, `source_table`, `source_id`, `pw1_store_id`, `tenant_id`, `site_id`, `target_collection`, `target_id`, `migration_run_id`, `status`, `mapped_at`, `mapping_version`, `reason/error_code` | Điều kiện để F40 kết luận Đúng/Thiếu/Lệch/Trùng bằng data thật. |
| 2 | **Manifest mỗi migration run** | Run ID, thời điểm, importer/mapping version, scope Store/Tenant/Site, count PW1/PW2, migrated/skipped/quarantined/failed và danh sách lỗi | Cho QA biết migration đủ tổng thể hay chưa, không chỉ xem vài record. |
| 3 | **API hoặc JSON read-only** | Trả crosswalk + record PW1/PW2 theo Store/Site/Run, có phân trang và Super Admin auth | F40 thay mock bằng dữ liệu thật mà không phải đổi UI. |
| 4 | **Rule so sánh field** | `source_key`, `target_key`, mapping type, comparison rule, xử lý null/gap/lossy, mapping version | Giải thích chênh lệch là lỗi migrate, transform hợp lệ hay PW2 không hỗ trợ. |
| 5 | **Security allow-list Settings** | Field nào hiện đầy đủ, field nào masking, field nào tuyệt đối không trả về | QA kiểm tra Settings mà không lộ PII/token/password/API key. |

## Format JSON tối thiểu nếu Dev bàn giao file JSON

```json
{
  "migrationRun": {
    "id": "mig-2026-09-15-01",
    "mappingVersion": "2026.09.1",
    "pw1StoreId": "205",
    "tenantId": "pw2-tenant-id",
    "siteId": "pw2-site-id",
    "completedAt": "2026-09-15T03:00:00Z"
  },
  "crosswalk": [
    {
      "sourceDb": "pw1_production",
      "sourceTable": "products",
      "sourceId": "9689",
      "targetCollection": "products",
      "targetId": "pw2-product-id",
      "status": "migrated",
      "mappedAt": "2026-09-15T02:45:00Z",
      "reason": null
    }
  ],
  "summary": {
    "products": { "pw1": 45, "migrated": 43, "quarantined": 1, "failed": 1 }
  }
}
```

JSON dùng được nếu đây là output của migration run thực tế và có `targetId` PW2 thật. Không dùng JSON fixture, chỉ có mapping field, hoặc chỉ có `_ref`/`targetPath` dự kiến.

## Bổ sung riêng cho #1838 — So Sánh Khối

| Cần bàn giao | Ý nghĩa |
|---|---|
| `block_crosswalk`: PW1 page/block/`legacy_id` → PW2 page/layout/block ID, site, template version, run ID | Chứng minh data block đã vào PW2. |
| Component registry: block type/mapping key → component key + `supported` | Phân biệt “data đúng nhưng template không có component”. |
| Live-render result: URL, viewport, checked time, pass/fail, selector/screenshot reference | Xác minh website thật có render hay không. |

Quy tắc UI: chỉ xanh khi **Dữ liệu PW2 + Component + Live render** đều có evidence pass; chưa có evidence phải là `Chưa xác minh`.

## Bổ sung riêng cho #1839 — Commerce & Settings

- Chốt rule Product/SKU/variant, Order/finance, Discount và Customer: status, currency/rounding, tax, shipping, refund, deleted/inactive và dedupe.
- Backfill crosswalk toàn bộ lịch sử của các entity trong scope.
- Settings phải có allow-list/masking được Security duyệt; không trả token DNS, credential payment/integration, password, MFA hoặc API key.

## Xong bàn giao thì làm gì?

Khi có crosswalk + manifest + nguồn đọc dữ liệu thật cho một Store staging, QA/Frontend sẽ cắm adapter vào F40, thay mock bằng evidence thật, chạy E2E và xác nhận kết quả. UI hiện tại không cần thiết kế lại.
