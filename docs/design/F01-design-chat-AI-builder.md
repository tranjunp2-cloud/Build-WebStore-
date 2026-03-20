# F01 AI Web Builder Design

- **Prototype Link**: [Figma Prototype](https://www.figma.com/make/Y48xuOh2gMCid2UmqOAFys/F01-ai-chat-builder-demo?fullscreen=1&t=iwM7PR5a2viApvbg-1&preview-route=%2Fsignin)
- **Figma Design Link**: [Figma Design](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30607-16452&t=fkzJdMXzmQQr0ppW-1)
- **PRD Reference**: [F01-ai-builder.md](../prd/F01-ai-builder.md) (Version 2.1 — Form-based Input)

---

## Luồng tính năng (Feature Flow)

Dựa trên PRD v2.1, luồng tính năng "Tạo website bằng AI" (AI Builder) được thiết kế theo dạng **Form-based Structured Input** (không còn dạng Chat conversational), bao gồm các bước sau:

### 1. Authentication (Đăng nhập / Đăng ký)
- Người dùng được yêu cầu đăng nhập (**Sign in**) để tiếp tục.
- Nếu chưa có tài khoản → Redirect tới `/register` để tạo tài khoản Owner.
- Sau đăng nhập/đăng ký → Redirect tới `/builder/new`.

### 2. Step 1/3 — Form Input (Cung cấp thông tin doanh nghiệp)
- Hệ thống thu thập dữ liệu đầu vào thông qua **3 trường nhập liệu chính** (không phải chat):
  - **Business Name (*)**: Nhập tên doanh nghiệp / cửa hàng.
  - **Description (*)**: Mô tả ngắn gọn về doanh nghiệp (sản phẩm, phong cách, đặc điểm).
  - **Products / Services (*)**: Liệt kê mặt hàng/dịch vụ cốt lõi.
- **Content Safety**: Hệ thống từ chối input chứa nội dung nhạy cảm/NSFW trước khi gọi AI (BR-06).
- **Form Validation**: Validate required fields trước khi submit (FR-05). Hiển thị inline error.
- **Rate Limit Check**: Free tier chỉ được 1 lần generate (FR-15). Kiểm tra trước khi gọi AI API (BR-03).
- Nhấn **"Tạo Website"** để AI bắt đầu quá trình sinh website.

> **Mobile UX (FR-23):** Form chuyển thành layout dọc (Vertical), font ≥16px chống auto-zoom, nút Submit sticky dính đáy để không bị bàn phím che.

### 3. Step 2/3 — AI Generates Multi-Page Website (Tiến trình xử lý AI)
- **SSE Streaming**: AI stream response block-by-block, Live Preview cập nhật real-time.
- **Bắt buộc 4 trang** (FR-17): Homepage, About Us, Products & Services, Contact Us.
  - Layout thay đổi linh hoạt tùy theo ngành nghề phân tích từ input (FR-18).
  - Navigation menu tự động liên kết tới cả 4 trang.
- **AI Image Generation** (FR-10): Hero banner 1200×400px sinh bằng DALL-E. Nếu lỗi → fallback ảnh stock (FR-11).
- **Ngôn ngữ output** (FR-16): Nội dung site được generate theo ngôn ngữ input (BM / VI / EN). Fallback về EN nếu không hỗ trợ.
- **Auto-save draft** (FR-06): Tự động lưu bản nháp sau khi generate xong. Draft có hiệu lực 24h (BR-05).
- **Session recovery** (FR-07): Quay lại `/builder/new` sẽ hiện draft cũ nếu còn.

> **Mobile UX (FR-24, FR-25):** Khi nhấn "Tạo Website", form trượt đi nhường 100% màn hình cho Live Preview (Immersive mode). Thông báo tiến trình hiển thị dạng Floating Pill cuối màn hình, không che preview.

### 4. Step 3/3 — Preview & Drag-Drop & Action
- Hiển thị website đã generate với Live Preview (iframe sandboxed).
- **Drag-and-Drop block reorder** (FR-21, FR-22):
  - Hover block → hiện Drag handle (⠿) để kéo thả đổi vị trí section.
  - Navigation & Footer không được phép kéo thả.
  - Thay đổi thứ tự được persist vào DB khi confirm/publish.
- **AI Image Regenerate** (FR-12): Cho phép user regenerate ảnh AI cho bất kỳ block nào.
- Cung cấp các nút điều hướng chính:
  - **Publish**: Xuất bản website lên `{slug}.primeweb.app` trong < 30 giây (FR-13).
  - **Open Editor**: Truy cập vào `/editor/:siteId` để điều chỉnh chi tiết.

> **Mobile UX (FR-26):** Màn hình hẹp sử dụng **List Mode** hoặc **nút Up/Down** để reorder block thay vì kéo thả iframe (tránh xung đột scroll).

### 5. Post-Publish Confirmation (FR-19, FR-20)
- Màn hình xác nhận sau khi publish thành công:
  - Hiển thị URL live: `{slug}.primeweb.app` kèm nút **Copy to Clipboard** (Toast "Copied!").
  - Nút **"Go to Admin Dashboard"** → Redirect `/admin` (không cần đăng nhập lại).
  - Nút **"View Website"** → Mở tab mới với URL live.

---

## Business Rules liên quan tới UI/UX

| Rule | Mô tả |
|------|-------|
| BR-01 | Mọi query scope theo tenant — user chỉ thấy sites của mình |
| BR-02 | Soft delete only — không hard delete site record |
| BR-04 | Content AI-generated dán nhãn "AI Generated ✨" trong editor, ẩn trên storefront |
| BR-06 | Từ chối input nhạy cảm/NSFW trước khi gọi AI |
| BR-07 | Nếu generate fail do server/API → User KHÔNG bị trừ quota |
| BR-08 | Tự động nhận diện ngôn ngữ từ form input |

---

## Ghi chú UI Patterns

- **Error handling** (FR-08): Error toast + cho phép retry mà không cần nhập lại form.
- **Skeleton loading**: Hiệu ứng shimmer/pulse cho Preview khi đang generate.
- **Form Input Disabled**: Khi đang gọi AI, form mờ đi 50%, nút submit bị khoá.
- **Draft Recovery Dialog**: Popup "Tiếp tục bản nháp cũ?" khi user quay lại `/builder/new` mà có draft.
- **Rate Limit Paywall**: Nếu Free tier hết lượt → Hiện CTA nâng cấp Pro trong luồng.
