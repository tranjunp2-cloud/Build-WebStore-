# User Stories: Feedback MVP trên CMS V2 (F44)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F44 — Feedback MVP (nút Send feedback trên header, Lark Base, thông báo in-app)
> **Wave:** 8 | **Priority:** P0 | **Ref PRD:** [MIG-UX-direct-cutover.md](../prd/MIG-UX-direct-cutover.md)
> **Release:** 29/10/2026 · nút hiện 30/10/2026 00:00 → 15/11/2026 23:59:59 MYT · **Copy:** [copy deck §6](../prd/MIG-UX-direct-cutover-copy.md) · **QA:** [docs/qa/F44-feedback-mvp.md](../qa/F44-feedback-mvp.md)
> **Figma:** file [Untitled](https://www.figma.com/design/Ni2MSoBtONKqMJjfgNF1g7/Untitled?node-id=0-1) (frame VI/EN/BM 00–12) · trường Tính năng: [TM_Prime-Web-V2.0 node 35028-968](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=35028-968). Figma còn ô "Mã tham chiếu" và mã phản hồi → **làm theo doc**.
> Thay cho US-MIGX-11, 19, 20 trong [MIG-UX-direct-cutover-stories.md](./MIG-UX-direct-cutover-stories.md) (đổi ID để Story Sync tạo issue).

**Ngoài phạm vi (PO chốt 27/10):** trang "Phản hồi của tôi", trang chi tiết, trạng thái "Cần thêm thông tin", lối vào từ V1 archive, mục trong sidebar, email, cam kết SLA.

---

## US-F44-01: Gửi phản hồi từ nút Send feedback trên header

**Wave 8** | **P0** | **L** | Status: Ready

### Story

```
As a   Owner hoặc Staff đang dùng CMS V2 trong giai đoạn chuyển đổi
I want gửi báo lỗi, báo sai lệch dữ liệu hoặc góp ý ngay trên header
So that vấn đề đến đúng đội xử lý mà không phải mô tả lại cửa hàng
```

### Acceptance Criteria

#### AC-1: Nút chỉ hiện trong khoảng chuyển đổi

```gherkin
GIVEN user (Owner hoặc Staff) đăng nhập CMS V2
WHEN  giờ server nằm trong [30/10/2026 00:00, 15/11/2026 23:59:59] MYT
THEN  header ở mọi trang có nút "Send feedback" / "Hantar maklum balas"
  AND dưới 768px nút chỉ còn icon, có tooltip
  AND ngoài khoảng này nút ẩn và POST /api/v1/feedback trả 403
```

#### AC-2: Gửi phản hồi hợp lệ

```gherkin
GIVEN form đang mở
WHEN  user chọn Loại, chọn ít nhất 1 Tính năng, nhập Mô tả 10–2000 ký tự rồi bấm gửi
THEN  phản hồi được lưu, màn thành công hiện "Feedback sent" + câu báo sẽ thông báo qua biểu tượng chuông + nút Close
  AND KHÔNG hiện mã phản hồi, KHÔNG có câu cam kết thời gian xử lý
```

#### AC-3: Trường của form

```gherkin
GIVEN form đang mở
THEN  có Loại phản hồi* (Report a problem · Data mismatch · Suggestion), Tính năng* (chọn nhiều), Mô tả chi tiết* (bộ đếm /2000), Ảnh chụp màn hình (tuỳ chọn)
  AND "Data mismatch" chỉ hiện với cửa hàng chuyển từ V1 (Tenants.migrationStatus = migrated)
  AND KHÔNG có trường "Mã tham chiếu"
  AND dòng nhắc không nhập mật khẩu / dữ liệu khách luôn hiện dưới ô mô tả
```

#### AC-4: Tính năng chọn nhiều

```gherkin
GIVEN dropdown Tính năng mở
THEN  có 10 mục: Sản phẩm & tồn kho · Đơn hàng · Khách hàng · Khuyến mãi · Giao diện & trang · Thanh toán · Vận chuyển · Tên miền · Tài khoản & nhân viên · Khác
  AND user tick được nhiều mục (checkbox), mục đã chọn hiện dạng tag, bấm ✕ trên tag để bỏ, nhiều tag thì rút gọn "+N"
WHEN  gửi mà chưa chọn mục nào
THEN  hiện lỗi "Please choose at least one feature." cạnh trường
```

#### AC-5: Data mismatch từ banner Dashboard

```gherkin
GIVEN cửa hàng chuyển từ V1, Dashboard V2 có banner "Báo cáo sai lệch dữ liệu"
WHEN  user bấm nút trên banner
THEN  mở cùng form, Loại chọn sẵn = Data mismatch (user vẫn đổi được)
  AND hiện hộp xanh nhắc so sánh dữ liệu cùng thời điểm; placeholder mô tả gợi ý ghi giá trị V1 và V2
```

#### AC-6: Ảnh chụp màn hình

```gherkin
GIVEN user thêm ảnh
THEN  nhận tối đa 9 ảnh PNG/JPG, mỗi ảnh ≤ 5 MB; đủ 9 ảnh thì ẩn ô thêm ảnh
WHEN  chọn quá 9 ảnh
THEN  chỉ nhận 9 ảnh đầu và báo "You can add up to 9 images."
WHEN  một ảnh sai định dạng hoặc > 5 MB
THEN  ảnh đó viền đỏ + thông báo lỗi, các ảnh hợp lệ vẫn giữ
```

#### AC-7: Validation, gửi lỗi, gửi quá nhiều

```gherkin
WHEN  bấm gửi khi thiếu trường bắt buộc hoặc mô tả < 10 ký tự
THEN  lỗi cạnh từng trường, focus trường lỗi đầu tiên, giữ dữ liệu đã nhập
WHEN  request đang chạy
THEN  khoá trường và nút, hiện "Sending… Please don't send it again."; Idempotency-Key chặn gửi trùng
WHEN  lỗi mạng / server
THEN  banner đỏ, giữ nội dung + ảnh, gửi lại được
WHEN  user gửi phản hồi thứ 6 trong 15 phút (cửa sổ trượt, kiểm tra ở server)
THEN  API trả 429 + Retry-After, form hiện banner vàng, giữ nội dung, không khoá form
```

#### AC-8: Đóng form khi đang nhập dở

```gherkin
GIVEN user đã nhập ít nhất 1 trường hoặc thêm ảnh
WHEN  bấm ✕ hoặc Cancel
THEN  hỏi "Discard what you've entered?" với 2 nút Keep editing / Discard
  AND form trống thì đóng ngay, không hỏi
```

### Additional Criteria

- [ ] Server tự gắn context (không hiện trên UI ngoài tên cửa hàng): tenant, user, role, isMigratedStore, URL trang, app version, ngôn ngữ, user agent.
- [ ] Mã phản hồi `FB-{YY}-{6 số}` sinh ở server, chỉ dùng nội bộ (Lark, Support, dedupe).
- [ ] Ảnh tải lên riêng từng ảnh (Vercel giới hạn body ~4.5 MB), form chỉ gửi danh sách id ảnh; ảnh không gắn với phản hồi sau 24 giờ thì xoá; kiểm tra magic-byte ở server; ảnh không public (GAP-D13).
- [ ] Mobile 375px: form full-screen.

### Market Notes

- Chỉ EN / BM (CMS chỉ có locale `en`, `ms`); key trong copy deck §6, thêm vào `src/i18n/locales/en.json` + `ms.json`.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Collection `feedback_reports` (+ bảng tính năng select-hasMany, ảnh) có entry trong `scripts/db-setup.js` `MIGRATIONS`
- [ ] TC-F44-01 → TC-F44-14 pass

---

## US-F44-02: Thông báo in-app khi phản hồi được cập nhật

**Wave 8** | **P0** | **S** | Status: Ready

### Story

```
As a   Owner hoặc Staff đã gửi phản hồi
I want được báo trong chuông thông báo khi phản hồi của tôi đổi trạng thái
So that tôi không phải hỏi Support
```

### Acceptance Criteria

#### AC-1: Thông báo khi đổi trạng thái

```gherkin
GIVEN phản hồi của user có trạng thái Received
WHEN  Support đổi trạng thái trên Lark Base sang In progress / Resolved / Closed
THEN  user nhận thông báo trong chuông: "Your feedback about {feature} ({date}) is in progress." (và các biến thể resolved / closed)
  AND {feature} = tính năng đầu tiên đã chọn + " +N" nếu chọn nhiều; {date} = ngày gửi dd/MM theo giờ MYT
  AND không hiện mã phản hồi
```

#### AC-2: Trả lời của Support

```gherkin
GIVEN Support điền "Trả lời cho user" trên Lark Base
WHEN  thông báo được tạo
THEN  có thêm dòng "Reply: …" (tối đa 2 dòng, cắt bằng "…")
  AND "Ghi chú nội bộ" không bao giờ hiện
```

#### AC-3: Người nhận

```gherkin
GIVEN người gửi là Staff
WHEN  Staff gửi phản hồi hoặc phản hồi đổi trạng thái
THEN  Owner cũng nhận thông báo ("{name} sent feedback about {feature}." khi Staff gửi)
```

### Additional Criteria

- [ ] Dùng collection `Notifications` (F16): thêm type `FEEDBACK_UPDATE`, `FEEDBACK_SUBMITTED` (cột `varchar`, không cần ALTER TYPE); `dedupeKey` = `FEEDBACK:{code}:{lark_event_id}` → Lark gửi lại cùng sự kiện không tạo thông báo trùng.
- [ ] Bấm thông báo chỉ đánh dấu đã đọc (MVP chưa có trang chi tiết). Không gửi email.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] TC-F44-15 → TC-F44-18 pass

---

## US-F44-03: Đồng bộ phản hồi 2 chiều với Lark Base

**Wave 8** | **P0** | **M** | Status: Ready

### Story

```
As a   Support
I want mọi phản hồi vào Lark Base kèm đủ ngữ cảnh, và đổi trạng thái trên Lark Base tự báo về Prime Web
So that tôi xử lý ở một nơi duy nhất
```

### Acceptance Criteria

#### AC-1: V2 → Lark Base

```gherkin
GIVEN user gửi phản hồi thành công
WHEN  V2 lưu phản hồi vào DB
THEN  đẩy sang Lark Base bất đồng bộ, có retry, trong vòng 1 phút
  AND bản ghi có đủ trường PRD §13.4 (Tính năng là Multi select, ảnh là attachment)
  AND Lark lỗi thì user vẫn thấy gửi thành công; lark_sync_status = failed, Ops đẩy lại được
```

#### AC-2: Lark Base → V2

```gherkin
GIVEN Support đổi Trạng thái hoặc điền "Trả lời cho user" trên Lark Base
WHEN  Lark gửi sự kiện tới POST /api/v1/integrations/lark/feedback-webhook
THEN  V2 xác thực bằng LARK_FEEDBACK_ENCRYPT_KEY + LARK_FEEDBACK_VERIFICATION_TOKEN, cập nhật DB và tạo thông báo (US-F44-02)
  AND sự kiện sai chữ ký bị từ chối; cùng lark_event_id chỉ xử lý 1 lần
```

### Additional Criteria

- [ ] Thiết lập Lark + 6 biến `LARK_FEEDBACK_*` theo PRD §13.5 (2 app + 2 bảng: Staging / Production). Chặn: GAP-D12 / D14 — cần người phụ trách xong A1–A4 trước 28/10.
- [ ] Phương án dự phòng nếu webhook không kịp: cron 5 phút (PRD §13.5), PO chọn.

### Definition of Done

- [ ] 6 bước kiểm thử chấp nhận PRD §13.5 pass trên staging
- [ ] TC-F44-19 → TC-F44-24 pass
