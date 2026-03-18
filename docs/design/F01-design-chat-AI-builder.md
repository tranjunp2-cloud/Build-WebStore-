# F01 AI Chat Builder Design

- **Prototype Link**: [Figma Prototype](https://www.figma.com/make/Y48xuOh2gMCid2UmqOAFys/F01-ai-chat-builder-demo?fullscreen=1&t=iwM7PR5a2viApvbg-1&preview-route=%2Fsignin)
- **Figma Design Link**: [Figma Design](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30607-16452&t=fkzJdMXzmQQr0ppW-1)

---

## Luồng tính năng (Feature Flow)

Dựa trên prototype, luồng tính năng "Tạo website bằng AI" (AI Builder) được thiết kế theo dạng Step-by-step Wizard, bao gồm các bước sau:

### 1. Authentication (Đăng nhập / Đăng ký)
- Người dùng được yêu cầu đăng nhập (**Sign in**) để tiếp tục. 
- Màn hình hỗ trợ nhập Email / Password và có các tuỳ chọn Social Sign-in (**Google**, **WhatsApp**).
- Cho phép người mới tạo tài khoản (**Sign up**) với form thu thập First Name, Last Name, Email, Password.

### 2. Step 1/3 — Business Information (Cung cấp thông tin doanh nghiệp)
- Hệ thống thu thập dữ liệu đầu vào thông qua form chi tiết:
  - **Business Name (*)**: Nhập tên doanh nghiệp / cửa hàng.
  - **Industry (*)**: Chọn ngành nghề kinh doanh (Restaurant, Shop/Fashion, Tech/SaaS, Health, Real Estate, Portfolio,...).
  - **Products / Services (*)**: Mô tả ngắn gọn về sản phẩm/dịch vụ cốt lõi.
  - **Target Audience (Optional)**: Tệp khách hàng mục tiêu hướng đến.
  - **Style**: Chọn phong cách giao diện (Modern & Clean, Classic & Elegant, Bold & Vibrant, Minimal & Simple).
- Nhấn **Continue** để AI bắt đầu quá trình tạo website.

### 3. Step 2/3 — AI Generates Content & Design (Tiến trình xử lý của AI)
- Màn hình chờ Loading hiển thị minh bạch các bước AI đang thực hiện theo thời gian thực (real-time feedback):
  - *Analyzing business information...* (Phân tích dữ liệu)
  - *Generating content & design...* (Tạo bố cục và nội dung)
  - *Preparing preview...* (Chuẩn bị bản xem trước)
  - *Building your website...* (Phác thảo giao diện)

### 4. Step 3/3 — Preview & Action (Xem trước và Tuỳ chỉnh)
- Hiển thị màn hình báo cáo thành công: **Website has been created successfully!** kèm tóm tắt nhanh hiệu suất (ví dụ: *+7 sections generated*).
- Cung cấp các nút điều hướng chính:
  - **Website Preview**: Xem hình ảnh trực quan của website AI vừa tạo.
  - **Chuyển đổi giao diện (Toggle)**: Xem trước Website trên phiên bản **Desktop** hoặc **Mobile**.
  - **Open Editor / Dashboard**: Truy cập vào builder/editor để điều chỉnh chi tiết các block theo ý muốn.
