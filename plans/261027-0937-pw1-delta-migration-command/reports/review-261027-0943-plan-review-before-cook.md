# Review plan `migrate:pw1:delta` trước khi cook — 27/10

Đối chiếu plan với code thật. Kết luận: **chưa nên cook nguyên trạng**. Có 4 lỗ hổng làm checksum hoặc trạng thái lệch. 1 trong số đó cần user chọn hướng.

## Lỗ hổng nghiêm trọng

### R1. "Copy 15 dòng điều phối exporter" là sai — logic thật dài và có bước liên-store
- `export-master.ts:160-260`: ngoài 6 mapper còn có
  - lọc schema;
  - gỡ `items.product` của order khi product bị loại;
  - `excludeInvalidBlogs`;
  - chặn store khi `tenants/sites != 1`.
- Sau vòng lặp còn có các bước **liên-store**:
  - `quarantineProductCollisions(stores…)`;
  - `collectUserActors`;
  - vòng `operationalIssues` loại store đến khi khép kín tham chiếu.
- Phía importer, `artifact.ts:249` còn lọc bằng `createSelectedSourceScope(actors, …)`, dùng `user-actors.json` và cờ theo `mappingHash`.
- Nếu chỉ map lại các store bị ảnh hưởng thì bỏ sót các bước trên → checksum lệch, gate phase 03 sẽ fail hàng loạt hoặc cho ra dữ liệu sai.

### R2. Checksum phụ thuộc tham số của lần import cũ — plan chưa ghi
- `buildEntities(store, configs, namespace, actorRefs, preserveInvalidUserEmails, delegateRawPageContent, delegateRawModelSettings)` (`runner.ts:249`).
- `namespace = sourceInstance:snapshotId` (`runner.ts:214`) đi vào id các dòng con (`projection.ts:192` `stableChildId`). Đổi snapshotId thì mọi product có variant/ảnh đều thành CHANGED.
- Bắt buộc dùng đúng namespace, actorRefs và 3 cờ của run 07/10, lấy từ manifest/artifact cũ.

### R3. `--as-of` mới làm lệch trạng thái
- `identity-lifecycle.ts:27-63`: user `status=1` có `expired_at <= asOf` sẽ thành `suspended`.
- Nếu asOf = 28/10, user/tenant hết hạn trong khoảng 18/09–28/10 sẽ bị đổi trạng thái **chỉ ở store bị ảnh hưởng**. Store không đổi dữ liệu thì giữ trạng thái cũ, nên kết quả không nhất quán.
- Đề xuất: **giữ asOf của config cũ (2026-09-18)** và bỏ tham số `--as-of`. Delta chỉ phản ánh thay đổi dữ liệu thật (ban, gia hạn, đổi status đều nằm trong CSV). Hạn dùng để runtime PW2 xử lý.

### R4. Phát hiện GONE qua ledger không làm được như plan viết
- `migration_entity_map` **không có cột store** (`scripts/pw1-migration-schema.js:255`), nên không lấy được "claim của store X".
- Sửa: GONE = entity có trong output map của `--old` nhưng không có trong output của `--new`, cùng store. Ledger chỉ dùng để tìm `target_id`.

## Thiếu sót trung bình

### R5. Dữ liệu đã bị sửa trong PW2 sau import (QA hoặc người dùng sửa trên dev) sẽ bị ghi đè
- Ledger có `target_checksum = checksum(resolved data)` (`writer.ts:340`).
- Trước khi update: so projection hiện tại của target với `target_checksum`. Khác → `PW2_EDITED_CONFLICT`, không ghi, đưa vào `conflicts.json`.

### R6. Dùng lại helper sẵn có
- `user-auth.ts` (`PW1_APP_KEY`, env đã có).
- `targetProjectionMatches` / `projectionMatches` (`projection.ts:301,320`).
- Không tự viết lại phần giải mật khẩu và so projection.

### R7. Bảng ledger delta
- Repo đặt DDL ledger migration trong module riêng `scripts/pw1-migration-schema.js`, được `db-setup.js:22-23` gọi.
- Theo pattern này: tạo `scripts/pw1-delta-migration-schema.js` và gọi từ db-setup, thay vì nhét SQL thẳng vào MIGRATIONS. Cần kiểm lại `check-migrations.js` có chấp nhận cách này không.

### R8. Tiến độ
- Plan có 6 phase trong khoảng 1,5 ngày, rủi ro cao.
- Đề xuất MVP: NEW + CHANGED cho tenants/users/sites/plan-subscriptions/categories/products/customers/orders/blogs. GONE chỉ đổi trạng thái product/blog/tenant.
- Discount, email template, usages: chỉ báo cáo.

## Quyết định cần user chọn (ảnh hưởng R1)

**A. Gọi nguyên `exportMaster(inputDir, configPath, outDir)` như thư viện** cho `--new` (và `--old`, hoặc dùng master cũ có sẵn), ghi master vào `--out`. Sau đó đọc bằng loader artifact cũ và chạy `buildEntities`.
- Ưu điểm: giống lần import cũ 100%, không phải viết lại logic liên-store, GONE ra tự nhiên.
- Không sửa file cũ, không đụng DB.
- Nhược điểm:
  - đây chính là "chạy lại exporter cũ" mà user từng gạt (như thư viện, không qua script);
  - mỗi lần chạy phải export toàn bộ ~2,9k store;
  - phải tạo config mới với sha256 của file `--new` (`csv-loader.ts:218` kiểm hash).

**B. Giữ hướng hiện tại (map lại theo store)**, nhưng chép thêm khoảng 100 dòng điều phối và các bước liên-store. Nguy cơ lệch cao, gate dễ fail, tốn thời gian.

Khuyến nghị: **A**. Lý do: phần code dùng lại vẫn là cùng các hàm cũ, chỉ khác là gọi nguyên khối thay vì chép từng mảnh. Độ đúng cao hơn hẳn và ít code mới hơn.

## Câu hỏi mở
1. Chọn A hay B?
2. Đồng ý bỏ `--as-of` và giữ 2026-09-18 không?
3. Có ai đã sửa dữ liệu trên DB dev sau import không (ảnh hưởng mức nghiêm trọng của R5)?
