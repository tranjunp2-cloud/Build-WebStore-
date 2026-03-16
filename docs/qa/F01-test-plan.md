# Test Plan: AI Chat Builder (F01)

> **Feature:** F01 — AI Chat Builder  
> **Ref:** US-002, US-003, US-004, US-005

| ID | Scenario | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TC-01.01 | Tạo website mới bằng prompt hợp lệ | 1. Tới `/builder/new` <br> 2. Nhập "Tiệm bánh handmade quận 3, mở 2020" <br> 3. Click Gửi | AI stream response < 2 giây. Live preview update realtime. Bảng tiến độ hiển thị đúng text "Đang tạo...". Toàn bộ website hoàn thành < 60 giây. | High |
| TC-01.02 | AI yêu cầu bổ sung thông tin | 1. Tới `/builder/new` <br> 2. Nhập prompt thiếu ngành nghề (VD: "Làm web cho mình") <br> 3. Click Gửi | AI hỏi lại tối đa 2 câu rõ ràng, sau đó phải tự generate với giả định hợp lý. | Medium |
| TC-01.03 | Lưu Draft khi refresh/back | 1. Bắt đầu generate site <br> 2. Đang tạo giữa chừng thì F5 hoặc Back. <br> 3. Vào lại `/builder/new` | Browser load lại state cũ dạng Draft, tiến trình tiếp tục không mất progress / context. | High |
| TC-01.04 | Lỗi AI Service / Timeout | 1. Ngắt kết nối mạng hoặc giả lập HTTP 500 từ AI endpoint. <br> 2. Gửi prompt. | Xuất hiện toast đỏ "Không thể tạo website. Thử lại". Nút thử lại không bắt thay prompt cũ. | High |
| TC-01.05 | Setup qua luồng Chat (Onboarding) | 1. Tại `/onboarding`, chọn "Tạo bằng AI" <br> 2. Khai báo Tên và Ngành qua chat | Dữ liệu lưu xuống DB trường `site.aiContext` và redirect thẳng qua /builder/new. Không hiện Form nhập liệu. | High |
| TC-01.06 | Auto-generate Hero Image (DALL-E) | 1. Gửi prompt tạo site "kedai baju kurung, warna pink pastel" <br> 2. Chờ web render | Ảnh Hero phải load thành công với style fashion pastel. Ảnh auto-upload vào tab Media CMS. Hiện text "AI Generated ✨". | Medium |
| TC-01.07 | One-click Publish Store | 1. Tới giao diện Editor sau khi generate <br> 2. Click "Publish" trên toolbar | Trang chuyển trạng thái sang Publish < 30s. Subdomain `{slug}.primeweb.app` live. Toast màu xanh success báo link. | High |
