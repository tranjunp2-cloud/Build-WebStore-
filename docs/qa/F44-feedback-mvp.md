# F44 Feedback MVP — QA Plan

> **Story source:** [F44 stories](../stories/F44-feedback-mvp-stories.md) · **Spec:** [PRD §10.4, §13.4–13.5, §15](../prd/MIG-UX-direct-cutover.md) · **Copy:** [copy deck §6](../prd/MIG-UX-direct-cutover-copy.md)
> **Mục tiêu:** user gửi được phản hồi trong khoảng 30/10–15/11/2026 MYT, Support nhận đủ trên Lark Base, user được báo khi trạng thái đổi. Release 29/10/2026.

## 1. Rủi ro cần chặn

| Rủi ro | Hậu quả | Cách test |
|---|---|---|
| Nút/API mở ngoài khoảng 30/10–15/11 | Nhận phản hồi khi không có người xử lý | Giả lập giờ server trước/trong/sau khoảng (TC-01, 02) |
| Upload ảnh vượt giới hạn Vercel / ảnh public | Gửi lỗi với ảnh lớn; lộ dữ liệu khách | Test 9 ảnh × 5 MB, truy cập URL ảnh khi chưa đăng nhập (TC-08, 09) |
| Spam / gửi trùng | Bảng Lark rác | Rate limit + Idempotency-Key (TC-11, 12) |
| Lark lỗi làm user thấy lỗi | Mất phản hồi, trải nghiệm xấu | Tắt Lark khi gửi (TC-21) |
| Webhook giả / gửi lại | Thông báo sai hoặc trùng | Sai chữ ký, gửi lại cùng event (TC-22, 23) |
| Ghi chú nội bộ lộ ra V2 | Lộ thông tin nội bộ | TC-17 |

## 2. Test data

| Fixture | Dữ liệu | Dùng cho |
|---|---|---|
| `e2e-f44-migrated` | Store `migrationStatus = migrated`, 1 Owner + 1 Staff | Loại Data mismatch, thông báo Owner |
| `e2e-f44-new` | Store mới (không chuyển từ V1), 1 Owner | Chỉ 2 loại |
| Ảnh | 9 PNG/JPG ≤ 5 MB, 1 ảnh 6 MB, 1 file PDF đổi đuôi `.png` | Upload |
| Lark | Bảng **Prime Web Feedback (Staging)** + app Staging (PRD §13.5) | Sync 2 chiều |

Không dùng bảng Lark Production. Dọn bản ghi có store prefix `e2e-f44-` sau test.

## 3. Coverage

| Story | Test cases |
|---|---|
| US-F44-01 Gửi phản hồi | 01–14 |
| US-F44-02 Thông báo in-app | 15–18 |
| US-F44-03 Đồng bộ Lark Base | 19–24 |

## 4. Test cases

| ID | Loại | Mức | Ưu tiên | Arrange · Act · Assert |
|---|---|---|---|---|
| TC-F44-01 | [ ] AUTO | API + UI | Critical | **A:** giờ server 30/10/2026 00:00 MYT và 15/11/2026 23:59:59 MYT. **A:** mở CMS, gọi `GET /api/v1/feedback/availability`. **A:** nút hiện ở header mọi trang, `enabled=true`. |
| TC-F44-02 | [ ] AUTO | API + UI | Critical | **A:** giờ server 29/10/2026 23:59:59 và 16/11/2026 00:00 MYT. **A:** mở CMS, `POST /api/v1/feedback`. **A:** nút ẩn, API trả 403. |
| TC-F44-03 | [ ] MANUAL | UI | High | **A:** viewport 375px. **A:** mở header, bấm icon. **A:** chỉ icon + tooltip; form là popup căn giữa (lề 16px, tự cuộn, nút Gửi luôn thấy), 3 nhãn loại nằm 1 dòng. |
| TC-F44-04 | [ ] AUTO | UI | Critical | **A:** store `e2e-f44-migrated`, rồi `e2e-f44-new`. **A:** mở form. **A:** migrated thấy 3 loại; store mới chỉ thấy Report a problem · Suggestion. Không có trường "Mã tham chiếu". |
| TC-F44-05 | [ ] AUTO | UI | Critical | **A:** form mở (EN và BM). **A:** chọn loại, tick 3 tính năng, nhập mô tả 20 ký tự, gửi. **A:** màn thành công "Feedback sent" / "Maklum balas dihantar", **không** có mã phản hồi, không có thời hạn xử lý. |
| TC-F44-06 | [ ] AUTO | UI | High | **A:** dropdown Tính năng. **A:** mở, tick/bỏ tick, bấm ✕ trên tag. **A:** đúng 10 mục theo thứ tự PRD; chọn nhiều được; tag rút gọn "+N"; gửi khi chưa chọn → lỗi "Please choose at least one feature." |
| TC-F44-07 | [ ] AUTO | UI | High | **A:** store migrated, Dashboard có banner. **A:** bấm "Báo cáo sai lệch dữ liệu". **A:** form mở với Data mismatch chọn sẵn, đổi được; hộp xanh hiện; đổi loại khác thì hộp ẩn. |
| TC-F44-08 | [ ] AUTO | API + UI | Critical | **A:** 9 ảnh ≤ 5 MB. **A:** thêm 9 ảnh rồi gửi; thử thêm ảnh thứ 10. **A:** gửi thành công (không lỗi 413 do giới hạn body); đủ 9 thì ẩn ô thêm; quá 9 báo "You can add up to 9 images." |
| TC-F44-09 | [ ] AUTO | API | Critical | **A:** ảnh 6 MB, file PDF đổi đuôi `.png`. **A:** upload. **A:** cả hai bị từ chối (viền đỏ + lỗi), ảnh hợp lệ khác giữ nguyên; URL ảnh đã upload không mở được khi chưa đăng nhập. |
| TC-F44-10 | [ ] AUTO | UI | High | **A:** form trống / mô tả 9 ký tự / 2001 ký tự. **A:** gửi. **A:** lỗi cạnh từng trường, focus trường lỗi đầu tiên, dữ liệu giữ nguyên; không quá 2000 ký tự. |
| TC-F44-11 | [ ] AUTO | API | Critical | **A:** cùng 1 user. **A:** gửi 6 phản hồi trong 15 phút. **A:** lần 6 trả 429 + `Retry-After`; form banner vàng, giữ nội dung; sau khi cửa sổ 15 phút trôi qua gửi lại được. |
| TC-F44-12 | [ ] AUTO | API | Critical | **A:** cùng `Idempotency-Key`. **A:** gửi 2 request đồng thời. **A:** chỉ 1 bản ghi, 1 bản ghi Lark; lần lặp không tính vào rate limit. |
| TC-F44-13 | [ ] MANUAL | UI | Medium | **A:** chặn mạng khi bấm gửi. **A:** gửi. **A:** banner đỏ, nội dung + ảnh giữ nguyên, gửi lại được. |
| TC-F44-14 | [ ] AUTO | UI | Medium | **A:** đã nhập 1 trường / form trống. **A:** bấm ✕. **A:** có nhập → hỏi Keep editing / Discard; trống → đóng ngay. |
| TC-F44-15 | [ ] AUTO | Service | Critical | **A:** phản hồi đã sync Lark. **A:** đổi Trạng thái sang In progress, Resolved, Closed. **A:** mỗi lần 1 thông báo "Your feedback about {feature} ({date}) …" đúng ngôn ngữ user; không có mã phản hồi; `{feature}` = tính năng đầu + "+N". |
| TC-F44-16 | [ ] AUTO | Service | High | **A:** Support điền "Trả lời cho user" dài 300 ký tự. **A:** đổi sang Resolved. **A:** thông báo có dòng "Reply: …" tối đa 2 dòng, cắt bằng "…". |
| TC-F44-17 | [ ] AUTO | Service | Critical | **A:** Support điền "Ghi chú nội bộ". **A:** đổi trạng thái. **A:** ghi chú không xuất hiện ở DB public field, thông báo hay API V2. |
| TC-F44-18 | [ ] AUTO | Service | High | **A:** Staff của store migrated gửi phản hồi. **A:** gửi + đổi trạng thái. **A:** Owner nhận "{name} sent feedback about {feature}." và thông báo đổi trạng thái; bấm thông báo chỉ đánh dấu đã đọc; không có email. |
| TC-F44-19 | [ ] AUTO | Integration | Critical | **A:** app + bảng Staging. **A:** gửi phản hồi có 2 ảnh, 3 tính năng. **A:** trong 1 phút có bản ghi Lark đủ trường §13.4; Tính năng là multi select; ảnh là attachment. |
| TC-F44-20 | [ ] MANUAL | Integration | High | **A:** env staging. **A:** kiểm tra Vercel scope. **A:** đủ 6 biến `LARK_FEEDBACK_*` ở staging + Preview; không biến nào nằm trong git / log. |
| TC-F44-21 | [ ] AUTO | Integration | Critical | **A:** sai `LARK_FEEDBACK_APP_SECRET` (hoặc Lark down). **A:** gửi phản hồi. **A:** user vẫn thấy thành công; `lark_sync_status = failed`; đẩy lại thủ công thành công khi sửa cấu hình. |
| TC-F44-22 | [ ] AUTO | API | Critical | **A:** payload webhook sai chữ ký / sai token. **A:** gọi `/api/v1/integrations/lark/feedback-webhook`. **A:** bị từ chối, không đổi DB, không tạo thông báo. |
| TC-F44-23 | [ ] AUTO | API | Critical | **A:** cùng `lark_event_id`. **A:** gửi webhook 2 lần. **A:** chỉ 1 lần cập nhật, 1 thông báo. |
| TC-F44-24 | [ ] MANUAL | Integration | High | **A:** staging hoàn chỉnh. **A:** chạy 6 bước kiểm thử chấp nhận PRD §13.5. **A:** cả 6 pass. |

## 5. Còn mở

- GAP-D12 / D14: chưa có bảng Lark + app Staging → TC-19 → 24 chưa chạy được.
- GAP-D13: nơi lưu ảnh chưa chốt → TC-09 (ảnh không public) phụ thuộc quyết định này.
