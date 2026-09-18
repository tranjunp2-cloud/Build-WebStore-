# Đồng bộ master mapping 1.5.1 — 2026-09-18

## Đầu vào

- Artifact cũ: `prepared-v3-local`, mapping hash `27fbef7ec0fc73e58029295c8fbbe7d276c4d6095e358fe57e3058e1eb4f4567`.
- Publication mới: `/home/liam/data/worktrees/ech-prime-web-v2-worktree-2/.migration/runs/pw1-outcome-fix-20260918/artifact`.
- Exporter1.5.1, mapping hash `049053c41684d888d1d213b029c026666e060afbae09c815f17dd6523870db9c`, khớp master mapping hiện tại.
- Prepare đã thành công tại `/home/liam/migration-data/pw1/local-20260917/prepared-outcome-151-local/import-manifest.json`, có encrypted credential sidecar và binding system user local đã xác minh. Giữ nguyên artifact cũ.

## Điều chỉnh importer

1. Dùng contract mới để áp dụng delegated rich-text fidelity. Không miễn unsafe links hoặc missing media.
2. Master§18.3.6/8: `created_by/created_at/updated_at` trên `product_attributes`/`product_variants` chỉ lưu lịch sử nguồn. Chỉ nhận ngoài phạm vi khi có contribution đúng source/table/store/rule tới Product đã emit và đúng nhánh variant; không miễn unresolved option/FK, unknown fields hoặc ownership lỗi.
3. Master§5.2: warning `PRODUCT_INACTIVE_SKUS_EXCLUDED` hợp lệ theo activeCatalogOnly được APPROVED_POLICY.
4. Master§7.2: warning `ORDER_ITEM_CATALOG_REFERENCE_OMITTED` hợp lệ theo preserveHistoricalOrders được APPROVED_POLICY. Chỉ hai shape exporter đã xác minh; không thay đổi snapshot hoặc tự tạo catalog.
5. Policy phải khớp hash đã duyệt, có Store/source ID, đúng severity/table/field/reason. Không cho phép warning/unknown code tùy ý.

## Kiểm chứng

- 317 migration tests/17files PASS; TypeScript PASS.
- Independent review EAV và policy warning không có finding mở.
- Store205 thực: dry-run PREFLIGHT_PASSED, creates4/reuses0/writes0. Evidence `/tmp/pw1-outcome-151-store205.{stdout,stderr}.log`.
- Full dry-run trước hai policy warning: nhóm1/28 có3539occurrences/54Stores, so với5789occurrences/55Stores của lần dùng artifact cũ. Đây là tổng hiệu quả đổi artifact và sửa EAV, không quy toàn bộ chênh lệch cho một nguyên nhân.
- Final full dry-run: GROUP_BLOCKED nhóm1/28, 3121 occurrences/54 Stores, exit3 sau186.6s. Logs `/home/liam/migration-data/pw1/logs/20260918T064213191Z-31c39c4e-c874-48f4-84f7-5f77dc0ecd71`. Không apply vào DB trong lượt này.

## Các nhóm cần đối soát tiếp ở exporter/nguồn

- EAV không có contribution hoặc option/FK unresolved: cần giải quyết Product/SKU bị cách ly, không chỉ miễn field audit.
- Media/product_images/product_skus không được map: chứng minh dòng thuộc scope loại hay thiếu consumer/quan hệ; không miễn toàn bảng.
- Raw model_settings có contribution nghiệp vụ hoặc thiếu bằng chứng CSV-only: bổ sung disposition đúng ở exporter.
- Trùng SKU/category, giá/stock, author Blog, unsafe link, missing media, Order/refund: giữ blocker khi chưa có bằng chứng khắc phục.
- Không đổi hash manifest cũ; không reset ledger hoặc ép resume qua binding khác. Artifact mới chỉ dùng cho invocation mới.
