# Test Cases: AI Chat Builder (F01)

**Feature:** F01 — AI Chat Builder
**Reference:** US-002, US-003, US-004, US-005

---

## 1. Functional & Validation (Chức năng & Kiểm soát dữ liệu)

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-01.01 | Verify sinh website thành công với prompt đầy đủ ngữ cảnh | User đã đăng nhập, truy cập `/builder/new` | 1. Nhập prompt đầy đủ.<br>2. Nhấn nút "Generate / Gửi lệnh" | `prompt`: "Tiệm bánh handmade quận 3, mở năm 2020" | Hệ thống hiển thị thanh tiến trình "Đang tạo...". Website preview render real-time. Hoàn thành < 60s. | High |
| TC-01.02 | Verify AI yêu cầu làm rõ khi prompt quá chung chung | User đang ở `/builder/new` | 1. Nhập prompt chung chung.<br>2. Nhấn nút Gửi lệnh | `prompt`: "Làm web cho mình" | AI trả lời dạng chat, yêu cầu cung cấp thêm thông tin (Ngành nghề, Tên shop). Không tự tạo web sai lệch. | High |
| TC-01.03 | Verify Admin: Có thể Chat hỏi lại (Follow-up) để tinh chỉnh thay vì làm mới hoàn toàn | AI vừa sinh xong Web 1.0 bản nháp | 1. Nhập tiếp lệnh vào ô Chat đang mở: "Đổi màu nút qua cam". | Lệnh Chat liên tục `thread_id` | AI hiểu bối cảnh Chat Context cũ, chỉ Patch (Sửa) UI nút màu Cam lên nền tảng cũ, không Generate lại nguyên 1 Layout mới từ con số 0. | High |
| TC-01.04 | Verify ngăn chặn gửi nội dung prompt rỗng **[Negative]** | User đang ở `/builder/new` | 1. Để trống ô nhập prompt.<br>2. Nhấn nút Gửi lệnh | `prompt`: "" (Rỗng) hoặc "   " | Hiển thị cảnh báo "Vui lòng nhập mô tả website" dưới ô text. Nút Gửi bị Disable hặc chặn Click. | High |
| TC-01.05 | Verify giới hạn độ dài tối đa của Prompt **[Negative]** | User đang ở `/builder/new` | 1. Paste đoạn văn bản dài > 500 ký tự.<br>2. Nhấn Gửi | `prompt`: Đoạn text 501 characters | Backend từ chối với HTTP 400 Bad Request. UI báo lỗi "Mô tả không được vượt quá 500 ký tự". | High |
| TC-01.06 | Verify xử lý lỗi khi AI Service bị Timeout **[Negative]** | Dùng tool proxy chặn API | 1. Giả lập chặn kết nối từ Backend sang AI endpoint.<br>2. Gửi lệnh tạo Site. | Timeout response (HTTP 500) | UI hiển thị Toast lỗi "Máy chủ AI đang bận. Vui lòng thử lại". Không lộ stacktrace. Text input cũ được giữ nguyên. | High |
| TC-01.07 | Verify xử lý lỗi khi Prompt chứa ký tự đặc biệt không hợp lệ **[Negative]** | User đang ở `/builder/new` | 1. Nhập các ký tự toán học/emoji không ra nghĩa.<br>2. Bấm Gửi lệnh | `prompt`: "🤔🤷🏼‍♂️!!! ??? {{}}" | Hệ thống API báo 400 Validation Error "Yêu cầu cung cấp chữ cái hợp lệ" hoặc AI trả lời không hiểu thay vì crash 500. | Medium |

---

## 2. UI/UX, Edge Cases & Compatibility

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-01.08 | Verify Placeholder gợi ý thông minh trong ô Textbox Prompt **[UX Empathy]** | Mở trang `/builder/new` lần đầu | 1. Nhìn vào ô Text Input Prompt. | Giao diện Box trống | Ô nhập liệu có chữ mờ (Placeholder) hướng dẫn trực quan: _"VD: Tôi muốn một website bán hoa cho dịp Valentine, màu hồng phấn..."_. Giúp User biết cấu trúc Promt tốt ntn. | High |
| TC-01.09 | Verify Focus ô nhập liệu ngay khi tải trang **[UX Empathy]** | Mở trang `/builder/new` | 1. Để trang tải xong hoàn toàn. | Dom Context | Con trỏ chuột (Cursor) tự động nhấp nháy ngay tại ô Chat Box. User có thể gõ ngay tức thì mà không cần thao tác click. (Giảm Friction). | Medium |
| TC-01.10 | Verify Vô hiệu hóa Nút Gửi khi trạng thái Đang Load **[UX Empathy]** | Vừa đè lệnh Chat xong gửi đi | 1. Đang trong 60s chờ AI Generate đổ kết quả về. | DOM Disable | Nút Submit mờ xám (Disabled). Khách bấm nhấp đúp (Double/Triple Click) sẽ KHÔNG sinh ra nhiều Request chồng chéo lên API gây rác tài nguyên AI. | High |
| TC-01.11 | Verify tự động lưu nháp dữ liệu khi dở dang | Đang gõ prompt hoặc AI đang generate chưa xong | 1. Nhấn F5 (Refresh) trình duyệt.<br>2. Vào lại trang `/builder/new` | Browser Session | Trạng thái phiên AI Chat cũ, tin nhắn text, layout preview được khôi phục. Tiếp tục tiến trình mà không làm lại từ đầu. | High |
| TC-01.12 | Verify tự động tạo ảnh Hero section thay thế (DALL-E) | Prompt có yêu cầu chi tiết hình thức | 1. Gửi lệnh sinh trang.<br>2. Kiểm tra Element hình đại diện. | `prompt`: "tạo cửa hàng bán áo thun 2 màu trắng đen" | Ảnh banner đầu website load thành công. Tự động upload ảnh vào CMS Media. | High |
| TC-01.13 | Verify thoát ngang khi AI đang tạo trang **[Negative/Interruption]** | AI đang Generate | 1. Click menu chuyển sang Dashboard hoặc bấm phím Back. | N/A | Trình duyệt bật Alert "Bạn có chắc muốn rời đi? Tiến trình sẽ bị gián đoạn". Chặn mất Data do lỡ tay quẹt nhầm Back Nav. | Medium |
| TC-01.14 | Verify tính tương thích trên Mobile Safari | Trình duyệt Mobile (iOS/Android) | 1. Dùng iPhone Safari truy cập `/builder/new`.<br>2. Kích hoạt Keyboard ảo. | N/A | Khung Chat không bị lệch, Keyboard ảo không che khuất Chatbox. Layout preview scale tỷ lệ dọc đúng Mobile. | High |

---

## 3. Performance & Security

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-01.15 | Verify cơ chế Stream Text hiển thị Water-fall | Tốc độ mạng chậm (Slow 3G) | 1. Gửi lệnh sinh website nội dung cực dài.<br>2. Giám sát giao diện Render. | Site Layout >= 10 Blocks | Khối Blocks nhảy ra từ từ dạng Water-fall ngay khi nhận Stream chunks. Không có White Screen of Death > 5s. | Medium |
| TC-01.16 | Verify chống tấn công mã độc Stored XSS **[Negative]** | User đang ở `/builder/new` | 1. Gửi prompt chứa câu lệnh thực thi Javascript.<br>2. Nhấn Gửi lệnh. | `prompt`: `<script>alert('Bị hack')</script>` | Tin nhắn user hiện lên Box Chat hiển thị đúng nguyên văn dạng text (Sanitized HTML). Không bị nổ Alert hộp thoại. | Khẩn |
| TC-01.17 | Verify chống DDoS API (Rate Limiting) **[Negative]** | Có Token Access hợp lệ | 1. Chạy Postman gọi 15 requests tạo Site liên tục trong 5 giây. | 15 Requests HTTP POST | Từ request thứ 11, Backend ngắt luồng và trả HTTP 429 Too Many Requests. Database không lưu File Site rác. | Khẩn |
| TC-01.18 | Verify cấu trúc JSON Mapping được tạo chuẩn xác | Ngay sau khi sinh Site | 1. Query Document `sites` vừa tạo trong Database bằng lệnh SQL/Mongo. | Record Database ID | Chuỗi JSON `blocks` khớp tuyệt đối Schema PayloadCMS, không lệch Field hoặc dư Node rác, `id` mỗi block tồn tại. | High |

---

## 4. Quality 10-Point Checklist Summary

| Hạng mục (10-Point) | Trạng thái | Ghi chú / Test Case Bao Phủ |
|---|---|---|
| 1. Happy Path | [ ] Untested | TC-01.01 |
| 2. UI/UX (UX Empathy) | [ ] Untested | TC-01.08, TC-01.09, TC-01.10, TC-01.11 |
| 3. Validation | [ ] Untested | TC-01.03, TC-01.04 |
| 4. Boundary | [ ] Untested | TC-01.05, TC-01.07 |
| 5. Data | [ ] Untested | TC-01.18, TC-01.03 |
| 6. Performance | [ ] Untested | TC-01.15 |
| 7. Security | [ ] Untested | TC-01.16, TC-01.17 |
| 8. Navigation | [ ] Untested | TC-01.13 |
| 9. Interruption | [ ] Untested | TC-01.06, TC-01.13 |
| 10. Compatibility | [ ] Untested | TC-01.14 |
