# User Stories: Media Management (F48) — Phần 3 (US-F48-11..13)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F48 — Media Management
> **Sprint:** S4 Vòng đời | **Priority:** P0/P1 | **PRD:** [F48-media-management-overview.md](../prd/F48-media-management-overview.md) | **Architecture:** [F48-media-management.md](../architecture/F48-media-management.md) | **Design:** [F48-media-management-design.md](../design/F48-media-management-design.md) | **QA:** [F48-media-management.md](../qa/F48-media-management.md) | **Mục lục + persona:** [F48-media-management-stories.md](./F48-media-management-stories.md)

---

## US-F48-11: "Đang dùng ở đâu" + chặn/cảnh báo khi xoá + bộ lọc "Chưa dùng"
**Sprint S4** | **P0** | **M** | **Status:** Draft
### Story
```
As a   chủ shop
I want biết mỗi ảnh đang được dùng ở sản phẩm, bài viết hay trang nào trước khi xoá, và lọc ra ảnh không dùng
So that tôi dọn thư viện mà không làm vỡ ảnh trên website đang bán hàng
```
### Acceptance Criteria
#### AC-1: Xem nơi đang dùng
```gherkin
GIVEN ảnh M là ảnh SP "Tudung Bawal", là cover blog "Promo Raya", và nằm trong block gallery trang Home
WHEN  chủ shop mở chi tiết M
THEN  mục "Đang dùng ở" liệt kê 3 nơi, mỗi nơi có loại (Sản phẩm / Blog / Trang – block) và liên kết mở đúng màn sửa
```
#### AC-2: Quét đủ mọi kiểu tham chiếu
```gherkin
GIVEN M được tham chiếu qua FK (28 field upload), qua block mới { mediaId }, và qua URL string trong block cũ, rich text, custom-html
WHEN  findMediaUsages(M) chạy
THEN  trả đủ mọi nơi (kể cả đơn hàng, D29), không trùng lặp
  AND chỉ quét dữ liệu thuộc tenant của M
  AND với page chỉ tính bản chính + bản nháp mới nhất (`_pages_v` latest/autosave); version cũ hơn không tính (D48)
```
#### AC-3: Xoá media đang dùng bị chặn mặc định
```gherkin
GIVEN M đang được dùng ở ≥ 1 nơi
WHEN  staff có quyền `media` hoặc owner bấm xoá M
THEN  API trả 409 "MEDIA_IN_USE"; hộp thoại liệt kê nơi dùng, nút mặc định là "Huỷ"
  AND chỉ owner thấy nút "Vẫn xoá" (từng file, D28); staff gọi force → 403 "MEDIA_FORCE_DELETE_OWNER_ONLY"
```
#### AC-4: Owner "Vẫn xoá"
```gherkin
GIVEN owner chọn "Vẫn xoá" M
WHEN  xác nhận
THEN  trong 1 transaction: các FK trỏ M được đặt null, dòng ảnh gallery SP trỏ M bị gỡ (M2), URL trong block/rich text giữ nguyên
  AND trước COMMIT có deletion intent bền vững; COMMIT xoá row + giảm quota đúng một lần, rồi mới DeleteObject exact key cũ theo guard (D87)
  AND S3 lỗi/timeout giữ intent để GC retry, không hồi sinh row/quota; upload cùng bytes tạo key UUID mới không bị DeleteObject cũ ảnh hưởng
  AND thông báo kết quả liệt kê các nơi sẽ hiển thị ảnh vỡ để owner sửa
```
#### AC-5: Bộ lọc và nhãn "Chưa dùng"
```gherkin
GIVEN thư viện có 40 media, 12 không được dùng ở đâu
WHEN  bật bộ lọc "Chưa dùng" / "Tidak digunakan"
THEN  hiện đúng 12 media, mỗi ô có nhãn "Chưa dùng"
  AND chọn tất cả rồi xoá không cần qua hộp thoại cảnh báo nơi dùng
```
#### AC-6: Xoá nhiều có media đang dùng
```gherkin
GIVEN chủ shop chọn 20 media, 4 đang dùng
WHEN  xoá
THEN  16 media chưa dùng bị xoá, 4 media đang dùng được giữ lại với danh sách lý do
  AND owner có thể mở từng media giữ lại để "Vẫn xoá" (không có "Vẫn xoá" hàng loạt)
```
#### AC-7: Media không thuộc tenant / private
```gherkin
GIVEN media global (tenant null) hoặc biên lai private đính kèm đơn hàng
WHEN  merchant xem hoặc gọi API xoá
THEN  không xoá được (404 hoặc không xuất hiện), biên lai gắn đơn không bao giờ bị "Vẫn xoá"
GIVEN media M được đơn hàng tham chiếu (ảnh item snapshot hoặc biên lai)
WHEN  owner chọn "Vẫn xoá"
THEN  bị từ chối 409 "MEDIA_FORCE_DELETE_FORBIDDEN" (D44); hộp thoại chỉ hiển thị nơi dùng, không có nút "Vẫn xoá"
GIVEN media M đang là QR chuyển khoản của phương thức thanh toán đang bật (D78)
WHEN  owner chọn "Vẫn xoá"
THEN  bị từ chối 409 "MEDIA_FORCE_DELETE_FORBIDDEN", QR giữ nguyên (không set NULL); tooltip `mediaLibrary.deletePaymentQrLocked` hướng dẫn thay QR ở Payments trước
```

### Additional Criteria
- [ ] NFR-03: quét usage 1 media p95 < 1,5 s trên tenant cỡ p90 (≈ 31 media, vài chục trang/SP).
- [ ] `GET /api/media/library/:id/usages`: id tenant khác → 404; staff không có quyền mở picker (vd chỉ `orders`) → 403 `MEDIA_FORBIDDEN`; chưa đăng nhập → 401 (TC-F48-11-16).
- [ ] Bộ lọc "Chưa dùng" dùng cột `unused_since` hoặc tính sẵn, không quét toàn bộ JSON mỗi lần mở trang.
- [ ] Hộp thoại cảnh báo dùng được bằng bàn phím, focus mặc định ở "Huỷ"; 375px hiển thị dạng bottom sheet cuộn được.

### Market Notes
- PW1 cho xoá mà không kiểm tra nơi dùng → merchant từng làm vỡ ảnh SP đang bán; đây là lý do mặc định chặn.

### Definition of Done
- [ ] TC-F48-11-01..07 ↔ AC-1..7; TC-F48-11-15 (QR đang bật, D78) pass; fixture bao phủ cả 3 kiểu tham chiếu (FK, `{mediaId}`, URL string).
- [ ] FR-28..FR-30 có Story Ref US-F48-11; FK đặt null khi "Vẫn xoá" có test DB thật (không chỉ mock).

---

## US-F48-12: Dọn rác tự động có dry-run + dọn khi regenerate
**Sprint S4** | **P1** | **M** | **Status:** Draft
### Story
```
As a   super-admin (vận hành bởi hệ thống cron)
I want media do AI/stock/seed tạo ra mà không còn được dùng được tự dọn, có chế độ chạy thử trước khi xoá thật
So that chi phí lưu trữ không tăng mãi sau mỗi lần tạo/regenerate site, mà không bao giờ đụng file của merchant hay PW1
```
### Acceptance Criteria
#### AC-1: Dry-run là mặc định
```gherkin
GIVEN cron hằng ngày, MEDIA_GC_ENABLED thiếu/false, có ứng viên GC và pending allocation/merchant/gc/orphan intent
WHEN  job chạy không có dryRun=1
THEN  báo cáo JSON private có mode=gc-dry-run: không xoá row ứng viên hoặc object nguồn gc/orphan; cleanup allocation/merchant và allocation watch mọi prefix vẫn chạy theo D87
  AND cleanup chỉ dọn exact key không row, không sửa row/quota; watch giữ source allocation kể cả late Put khi GC tắt
WHEN  job chạy với dryRun=1 bất kể flag
THEN  báo cáo mode=dry-run cho toàn worker; media/quota không đổi, không DeleteObject/ack intent hoặc tiến cursor cleanup thật
  AND chỉ MEDIA_GC_ENABLED=true không có dryRun=1 mới mode=enabled, cho phép xoá ứng viên/retry gc/orphan (D33/D87), không qua UI merchant
```
#### AC-2: Tiêu chí ứng viên
```gherkin
GIVEN media có createdVia ∈ {ai, stock, seed}, không còn được dùng ở đâu, unused_since > 30 ngày
WHEN  job chạy ở chế độ xoá thật
THEN  row và object bị xoá, dung lượng tenant giảm tương ứng
  AND media createdVia ∈ {upload, import-url, system} không bao giờ bị tự xoá, dù không dùng
```
#### AC-3: Chỉ đụng prefix PW2 (NFR-05)
```gherkin
GIVEN ứng viên có key không nằm dưới `pw2/` (vd media seed có key phẳng = filename, hoặc row trỏ object PW1)
WHEN  job xử lý ở đợt đầu
THEN  không xoá object đó, ghi "skipped-foreign-prefix" vào báo cáo (D46: nhánh key phẳng D21b chỉ mở sau 4 báo cáo dry-run sạch liên tiếp)
  AND test bắt buộc chứng minh 0 object ngoài `pw2/` bị xoá trong mọi nhánh của job
  AND flagged exact key vẫn bị chặn sau xoá row cuối/intent, nhiều sweep và restart tới explicit Ops clearance; metadata unknown thì không xoá mọi prefix (D87 §8.7)
```
#### AC-4: Kiểm lại ngay trước khi xoá
```gherkin
GIVEN media X là ứng viên lúc quét
WHEN  trước lúc xoá, merchant vừa gắn X vào sản phẩm
THEN  job kiểm lại usage ngay trước khi xoá và bỏ qua X, unused_since của X được xoá
```
#### AC-5: Regenerate site đánh dấu media cũ
```gherkin
GIVEN chủ shop regenerate site, các page cũ bị thay
WHEN  regenerate hoàn tất
THEN  media AI/stock/seed của lần tạo trước không còn được dùng được đặt unused_since = thời điểm regenerate
  AND media merchant tự upload không bị đánh dấu xoá (chỉ hiện nhãn "Chưa dùng" ở US-F48-11)
```
#### AC-6: File tạm và multipart dở dang
```gherkin
GIVEN lifecycle rule bucket cho prefix `pw2/tmp/` (đặt từ S1, D36; ops QA sau 48h, không chặn release S1, D45)
WHEN  object tmp quá 1 ngày hoặc multipart upload bị bỏ dở
THEN  DO Spaces tự xoá/abort
  AND rule đã được kiểm thật trên DO (không chỉ cấu hình), không ảnh hưởng prefix khác
```
#### AC-7: Lỗi và chạy chồng
```gherkin
GIVEN job đang chạy, hoặc S3 trả lỗi khi xoá một object
WHEN  lần chạy thứ hai bắt đầu, hoặc lỗi xảy ra
THEN  lần thứ hai thoát nhờ khoá Redis TTL; lease tenant theo D77, mỗi row vẫn dùng hash/key lock chung với register (D87); Redis lỗi ⇒ bỏ lượt
  AND deletion intent đã ghi bền vững trước COMMIT xoá row/quota; S3 lỗi/timeout sau đó giữ intent retry exact key cũ, không giữ/khôi phục row và không cộng lại quota
  AND intent ghi lỗi/chưa xác nhận trước COMMIT thì rollback giữ row/quota; crash sau COMMIT trước DeleteObject vẫn được worker độc lập D66 tìm/dọn
  AND báo cáo tách row/quota đã giải phóng, object đã dọn, object đang chờ retry và lỗi; retry không trừ quota lần hai
```

### Additional Criteria
- [ ] Mỗi lượt có ngân sách 45 s, xử lý theo tenant (quét usage 1 lần/tenant), lưu checkpoint `tenants.media_gc_checked_at`, lượt sau chạy tiếp; đầu lượt chỉ chọn bằng SQL các tenant có ứng viên (sweep đến hạn / media mới / site đổi sau checkpoint), tenant sạch bỏ qua, mọi tenant có ứng viên được xử lý ≤ 7 ngày (D66, NFR-S4-05, TC-F48-12-19); circuit breaker theo tỉ lệ (> 50% media tenant hoặc > 3× trung bình 4 lượt trước) → dừng + Sentry (D61). Trước khi bật xoá thật chạy audit key bất thường (D62).
- [ ] TC-F48-12-20..22 pass cho key phiên bản, timeout/crash + durable retry, orphan tenant 0 row (D87); không tái sử dụng key/không chờ Ops khi upload mới.
- [ ] Báo cáo JSON giữ 8 bản gần nhất (D41); Sentry chỉ để cảnh báo lỗi, không làm nơi lưu báo cáo (D47). Không có UI merchant.
- [ ] GC quét thêm object `pw2/t/` không có row và cũ > 1 ngày (D39) — "có row" so trên key ghép đầy đủ `[prefix, _objectKey, filename]` (D64, TC-F48-12-18); không bao giờ xoá media còn được đơn hàng tham chiếu (D29).

### Definition of Done
- [ ] TC-F48-12-01..07 ↔ AC-1..7; test NFR-05 với bucket mock chứa object PW1 + PW2 lẫn lộn.
- [ ] FR-31, FR-32 có Story Ref US-F48-12; cột `unused_since` có entry MIGRATIONS.
- [ ] Bằng chứng lifecycle rule trên DO (staging) đính kèm PR; ≥ 2 lần dry-run trên staging được rà trước khi bật xoá thật nhánh `pw2/`; 4 lần sạch liên tiếp trước khi mở nhánh key phẳng (D46).

---

## US-F48-13: Quota dung lượng theo gói + đồng hồ dung lượng
**Sprint S4** | **P1** | **M** | **Status:** Draft — số quota: soft launch `UNLIMITED`, PO chốt sau báo cáo dung lượng S4 (D88)
### Story
```
As a   chủ shop
I want biết mình đã dùng bao nhiêu dung lượng media so với hạn mức của gói
So that tôi chủ động dọn ảnh hoặc nâng gói trước khi bị chặn upload
```
### Acceptance Criteria
#### AC-1: Đồng hồ dung lượng
```gherkin
GIVEN gói của tenant có media_storage_mb = 2048 và đã dùng 1.2 GB
WHEN  mở /media hoặc picker
THEN  thấy "1.2 of 2 GB used" / "1.2 daripada 2 GB digunakan" (`mediaLibrary.storageUsed`, design S6) kèm thanh tiến trình
  AND ≥ 80% đổi màu cảnh báo + gợi ý dọn "Chưa dùng"; ≥ 100% hiển thị trạng thái đầy + liên kết nâng gói
```
#### AC-2: Chặn upload khi vượt quota
```gherkin
GIVEN tenant còn 3 MB
WHEN  upload ảnh mà dung lượng sau xử lý là 4 MB
THEN  register từ chối 413 "MEDIA_QUOTA_EXCEEDED" ("Storage full" / "Storan penuh"), object tmp bị xoá, không tạo row
  AND media tạo bởi AI/seed vẫn được đếm nhưng không bị chặn (D36)
  AND client cũng chặn sớm khi biết chắc file vượt phần còn lại
```
#### AC-3: Đếm chính xác, không vượt khi upload song song
```gherkin
GIVEN tenant còn 5 MB, 3 upload 2 MB register đồng thời
WHEN  cả 3 hoàn tất
THEN  tối đa 2 upload thành công, upload còn lại bị từ chối
  AND `tenants.media_bytes_used` cập nhật trong cùng transaction với tạo/xoá row (không dùng `settings.storageUsed`, D53)
  AND upload trùng hash (US-F48-04 AC-3) không làm tăng dung lượng
  AND dung lượng tính theo byte lưu sau xử lý, không theo file gốc
```
#### AC-4: Hạ gói khi đang vượt quota
```gherkin
GIVEN tenant dùng 3 GB, hạ từ gói 5 GB xuống 2 GB
WHEN  hạ gói có hiệu lực
THEN  không media nào bị xoá; mọi upload mới bị chặn tới khi dung lượng < hạn mức
  AND ảnh đã có vẫn hiển thị bình thường trên storefront
```
#### AC-5: Biên lai người mua không bị chặn
```gherkin
GIVEN tenant đã đầy quota
WHEN  người mua upload biên lai chuyển khoản
THEN  upload thành công (biên lai private không tính vào quota merchant, D24)
  AND luồng thanh toán không bao giờ hỏng vì quota merchant
```
#### AC-6: Cấu hình gói và đối soát
```gherkin
GIVEN super-admin sửa PlanFeatures media_storage_mb của một gói
WHEN  lưu
THEN  hạn mức mới áp dụng ngay cho tenant thuộc gói đó
GIVEN gói chưa có bản ghi media_storage_mb
THEN  dùng hạn mức của gói free, không coi là không giới hạn (D25)
GIVEN media_bytes_used lệch so với tổng filesize thực tế
WHEN  super-admin chạy đối soát
THEN  giá trị được tính lại từ các row media của tenant (không tính row private và row PW1 migrate `filename` null — M6)
```

### Additional Criteria
- [ ] Đề xuất số (PO chốt sau báo cáo dung lượng S4, D88): free 500 MB, starter 2 GB, pro 5 GB, business 20 GB; per-file giữ theo US-F48-04 AC-4. Soft launch seed `media_storage_mb = UNLIMITED`: đếm + hiển thị, chưa chặn, tới khi PO chốt số (D53).
- [ ] Thanh dung lượng là `Progress` với `role="progressbar"` (một role duy nhất, không dùng `meter`) + `aria-valuenow/min/max`, chữ đọc được; 375px hiển thị gọn trên đầu thư viện ("1.6 of 2 GB used").
- [ ] Định dạng dung lượng theo design §4: thập phân 1 chữ số, dấu chấm cho cả en và ms, thống nhất với F21 — en "1.2 of 2 GB used", ms "1.2 daripada 2 GB digunakan"; UNLIMITED (D53) → "{used} used" / "{used} digunakan".
- [ ] Đối soát xong mọi tenant trước khi bật chặn; mọi đường xoá trừ quota đúng 1 lần: Local API trong `afterDelete`, SQL trực tiếp (force, GC) trong cùng transaction, không trừ đôi (M6, D67, TC-F48-13-11).

### Market Notes
- Ảnh mới được chuẩn hoá WebP (giảm ≥ 50% byte, NFR-04) → quota thực dùng thấp; mẫu local trung bình ~600 KB/file PNG trước xử lý.
- PW1: median 7 file/store, max 298 → gói free 500 MB đủ cho phần lớn SME nếu ảnh đã chuẩn hoá.

### Definition of Done
- [ ] TC-F48-13-01..06 ↔ AC-1..6; test đồng thời (AC-3) chạy trên Postgres thật; authz `GET /api/media/quota` (tenant theo session, staff không quyền picker 403) có TC-F48-13-12.
- [ ] FR-33 có Story Ref US-F48-13; cột `tenants.media_bytes_used` + bản ghi `plan_features` có entry MIGRATIONS.
- [ ] S4 nộp báo cáo dung lượng thực theo gói → PO chốt số quota (D9, D88).
