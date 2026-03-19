# F15 Admin Management (Super Admin System)
> **Status:** Draft (Proposal) | **Created:** 2026-03-17 | **Agent:** `Antigravity BA/PO Copilot`

## 1. Feature Framing & Context
- **Problem/Opportunity**: Chuyển đổi sang mô hình kinh doanh SaaS (Software as a Service) với nhiều cấp độ gói cước đòi hỏi đội ngũ nội bộ cần một hệ thống quản trị trung tâm (Super Admin Panel) mạnh mẽ. Hệ thống này giúp quản lý tập trung toàn bộ khách hàng, gói cước, doanh thu và cấu hình hệ thống.
- **Target Users**: Internal Team của nền tảng (Super Admin, System Admin, Sales/Support Staff).
- **Business Objective**: 
  1. Theo dõi sức khỏe kinh doanh SaaS (MRR, Churn rate, LTV).
  2. Vận hành, hỗ trợ và quản lý phân cấp người dùng (Owner vs Employee) một cách rõ ràng.
  3. Quản lý linh hoạt các gói Subscription (Freemium, Starter, Standard, Professional) và các chiến dịch Khuyến mãi (Promotion/Coupon).
- **Assumptions**: Hệ thống thanh toán (Payment Gateway) đã được tích hợp (F15) để xử lý recurring billing cho SaaS.
- **Risks/Dependencies**: Cần định nghĩa rõ ranh giới phân quyền: Quyền của System Admin (truy cập toàn hệ thống) vs Quyền của Workspace Owner (chỉ trong cửa hàng của họ).

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## 2. Proposed Modules & Prioritization

Dưới đây là các Epic được đề xuất, phân loại theo độ ưu tiên **Mid** (Cần thiết cho vận hành cơ bản SaaS) và **Low** (Tính năng nâng cao, có thể bổ sung ở Phase sau).

### Epic 1: SaaS Analytics Dashboard (Priority: Mid)
*Focus: Cung cấp "trung tâm chỉ huy" (command center) cho Admin với các chỉ số kinh doanh sống còn.*
- **Tính năng chính**: Biểu đồ MRR, số lượng Active Workspaces, tỉ lệ Conversion (từ Freemium lên Paid), Churn rate.

### Epic 2: Advanced User & Workspace Management (Priority: Mid)
*Focus: Quản lý danh sách khách hàng, theo dõi phân cấp.*
- **Tính năng chính**: Danh sách Workspaces; Xem chi tiết một Workspace gồm danh sách Users bên trong (hiển thị rõ dạng cây phân cấp Owner -> Staff); Quản lý trạng thái Active/Ban của user.
- **✨ Tính năng đề xuất thêm**: **Impersonate Account** (Đăng nhập dưới tư cách Owner để debug/hỗ trợ kĩ thuật trực tiếp mà không cần xin mật khẩu).

### Epic 3: Subscription & Promotion Management (Priority: Mid)
*Focus: Trái tim của mô hình SaaS kinh doanh.*
- **Tính năng chính**: Cấu hình limit/feature cho 4 tier (Freemium, Starter, Standard, Pro); Quản lý mã giảm giá (Discount/Voucher) áp dụng linh hoạt theo tier (ví dụ coupon chỉ dành cho gói Pro); Theo dõi lịch sử nâng cấp/hạ cấp/hủy gói.
- **✨ Tính năng đề xuất thêm**: **Trial Extension** (Admin có quyền gia hạn thêm X ngày trial cho một khách hàng tiềm năng cụ thể).

### Epic 4: System Audit Logs (Priority: Low)
*Focus: Bảo mật và truy vết.*
- **✨ Tính năng đề xuất thêm**: Lưu lại toàn bộ lịch sử thao tác của System Admin (Ai đã đổi cấu hình gói cước, ai đã ban user X) để đảm bảo tính minh bạch.

### Epic 5: Global Notifications & Broadcast (Priority: Low)
*Focus: Giao tiếp với khách hàng.*
- **✨ Tính năng đề xuất thêm**: Gửi in-app banner alert cho toàn bộ hệ thống hoặc theo tệp khách hàng (vd: "Hệ thống bảo trì 2h sáng" hoặc "Giảm 50% khi nâng cấp gói Pro tháng này").

### Epic 6: Automated Campaigns & Multi-channel Messaging (Priority: Mid)
*Focus: Tự động hóa tiếp thị và chăm sóc khách hàng qua đa kênh.*
- **Tính năng chính**: Tạo chiến dịch (Campaigns) tự động gửi mã khuyến mãi dựa trên hành vi (VD: Đăng ký mới, Sắp hết hạn Trial, Abandoned Cart); Tích hợp gửi thông báo qua Email (SendGrid/Mailchimp, SES) và Social Media (Zalo ZNS, Facebook Messenger/WhatsApp).


---

## 3. User Stories

### Epic 1: SaaS Analytics Dashboard
#### US-F15-01: Xem tổng quan các chỉ số SaaS
```text
AS A System Admin
I WANT TO xem dashboard tổng quan với các chỉ số MRR, số user active, tỉ lệ upgrade
SO THAT tôi nắm được tình hình kinh doanh tổng thể theo thời gian thực.
```
- **Acceptance Criteria:**
  - Hiển thị các card metric: Total Revenue, Total Active Workspaces, Paid Workspaces.
  - Hiển thị biểu đồ phân bổ user theo 4 gói: Freemium, Starter, Standard, Pro.
  - Có thể filter dữ liệu theo thời gian (Today, Last 7 days, This Month, Last Month, YTD).

### Epic 2: Advanced User & Workspace Management
#### US-F15-02: Quản lý danh sách và phân cấp tài khoản
```text
AS A System Admin
I WANT TO xem danh sách tất cả các workspaces và tài khoản thuộc workspace đó
SO THAT tôi có thể quản lý, phân loại và theo dõi hoạt động của họ.
```
- **Acceptance Criteria:**
  - Bảng danh sách Workspace hiển thị: Tên store, Gói hiện tại, Tình trạng (Trạng thái thanh toán), Ngày tạo.
  - Khi click vào 1 Workspace, hiển thị danh sách Users thuộc workspace đó, UI thể hiện rõ badge phân cấp "Owner" và "Staff".
  - Admin có quyền Disable/Ban một workspace nếu vi phạm điều khoản.

#### US-F15-03: Đăng nhập giả lập (Impersonation) - [Suggested]
```text
AS A System Admin (Support Role)
I WANT TO đăng nhập vào hệ thống dưới góc nhìn của một User/Workspace cụ thể
SO THAT tôi có thể trực tiếp kiểm tra lỗi hoặc hỗ trợ cấu hình mà không cần hỏi mật khẩu.
```
- **Acceptance Criteria:**
  - Có nút "Impersonate" tại trang chi tiết Workspace.
  - Khi click, hệ thống tạo một phiên đăng nhập ảo và có banner mốc chú ý: "You are viewing as [Store Name]. Click here to exit."
  - Mọi thao tác ghi log phải hiển thị là Admin A act as User B.

### Epic 3: Subscription & Promotion Management
#### US-F15-04: Cấu hình gói Subscription
```text
AS A System Admin
I WANT TO quản lý và chỉnh sửa giới hạn (limits/features) của 4 tier SaaS
SO THAT tôi có thể linh hoạt thay đổi chính sách kinh doanh mà không cần hard-code.
```
- **Acceptance Criteria:**
  - Giao diện cho phép edit thông số của Freemium, Starter, Standard, Professional.
  - Có thể bật/tắt các feature-flags hoặc thay đổi định mức (ví dụ: Gói Starter tối đa 100 sản phẩm, Pro không giới hạn).
  - **Security (Yêu cầu mật khẩu):** Khi Admin nhấn Lưu (Save) hoặc Thêm gói/Thay đổi cấu hình, hệ thống bắt buộc hiển thị modal yêu cầu nhập lại Mật khẩu Admin để xác nhận hành động này. Thao tác chỉ được thực thi khi mật khẩu đúng.
  - **Dynamic Sync:** Khi cấu hình gói thay đổi, giao diện và chức năng phía User (thuộc gói đó) ngay lập tức phải bị block/unblock các giới hạn tương ứng mà không cần User đăng nhập lại.

#### US-F15-05: Quản lý Khuyến mãi (Promotion/Voucher) cho Subscription
```text
AS A System Admin
I WANT TO tạo mã giảm giá áp dụng theo từng gói subscription
SO THAT tôi có thể chạy các chiến dịch marketing thúc đẩy upsell.
```
- **Acceptance Criteria:**
  - Form tạo Promotion Code gồm: Mã code, % giảm / Số tiền giảm, Thời hạn, Giới hạn lượt dùng.
  - Field "Áp dụng cho gói": Cho phép checklist chọn [Freemium, Starter, Standard, Pro]. VD coupon chỉ áp dụng khi mua gói Pro.

### Epic 4: System Audit Logs (Low Priority)
#### US-F15-06: Theo dõi Audit Logs của hệ thống
```text
AS A Super Admin
I WANT TO xem lịch sử thao tác của các nhân viên System Admin khác
SO THAT tôi đảm bảo an toàn hệ thống và dễ dàng truy vết khi có lỗi sai sót dữ liệu.
```
- **Acceptance Criteria:**
  - Bảng Audit log hiển thị: Timestamp, Admin Name, Action category, Target ID, IP Address.

### Epic 5: Global Notifications & Announcements (Low Priority)
#### US-F15-07: Gửi In-app Broadcast & Release Notes
```text
AS A System Admin
I WANT TO soạn và đẩy notification, feature release notes bằng công cụ soạn thảo trực quan
SO THAT tôi có thể thông báo cập nhật, gói mới hoặc khuyến mãi kèm hình ảnh/text sinh động.
```
- **Acceptance Criteria:**
  - Form tạo notification sử dụng **Rich Text Editor / Block Editor** (cho phép chèn Text có format, Hình ảnh banner, Nút kêu gọi hành động - Call to Action).
  - Có tuỳ chọn phân loại tin: Release Update, Promotion, System Alert.
  - Target audience: theo phân loại gói (All, Free plan, Paid plan).
  - User sẽ thấy popup/banner đẹp hoặc trang Release Notes ngay trên hệ thống của họ tuỳ theo tuỳ chọn hiển thị.

### Epic 6: Automated Campaigns & Multi-channel Messaging
#### US-F15-08: Tạo chiến dịch tự động (Automated Campaigns)
```text
AS A Marketing/System Admin
I WANT TO thiết lập các quy tắc tự động gửi khuyến mãi thông báo dựa trên trigger (hành vi khách hàng)
SO THAT tôi có thể tối ưu tỷ lệ chuyển đổi (conversion rate) mà không cần thao tác tay.
```
- **Acceptance Criteria:**
  - Form tạo Campaign có các Trigger options: `On Trial Signup`, `Trial Expiring in 3 days`, `Cart Abandoned`, `Plan Downgraded`.
  - Admin đính kèm mã Promotion/Voucher vào logic của Campaign.
  - Có trang thống kê Campaign Performance: Số lượng tin đã gửi, Tỷ lệ Mở (Open rate), Tỷ lệ Sử dụng coupon (Redemption rate).

#### US-F15-09: Tích hợp Đa kênh (Email & Social Apps)
```text
AS A System Admin
I WANT TO cấu hình kết nối với hệ thống Email và Mạng xã hội (Zalo ZNS, Facebook Messenger)
SO THAT hệ thống kết nối với các contact channel của khách hàng để push promotion tự động.
```
- **Acceptance Criteria:**
  - Giao diện Admin có "Integrations Settings" để nhập API Key, Secret/Token cho: Email provider (Postmark, SendGrid) và Social Apps (Zalo OA, Facebook Page).
  - Khi thiết lập Campaign (US-F15-08), Admin có thể chọn 1 hoặc nhiều Channel: `Email`, `Zalo`, `Messenger` và soạn message template/nội dung tương ứng cho từng kênh.

### Epic 7: Mobile Responsiveness
#### US-F15-10: Mobile Web UX — Responsive SaaS Dashboard
```text
AS A System Admin on the go
I WANT TO quản lý hệ thống trên điện thoại di động
SO THAT tôi có thể xử lý các sự cố khẩn cấp (ban account, check doanh thu) khi không ngồi máy tính.
```
- **Acceptance Criteria:**
  - Overview Metrics (MRR, Users) form horizontally scrollable cards or stack vertically on mobile (< 768px).
  - Complex data tables (List of Workspaces) transform into individual Cards or collapse secondary columns, making primary actions (Impersonate, Edit) highly accessible via touch.

---

## 4. Open Questions & Next Steps
1. **Phân quyền nội bộ Admin:** Chúng ta có cần chia nhỏ role trong nội bộ System Admin không? (Ví dụ: `Super Admin` toàn quyền, `Support Staff` chỉ được xem user và impersonate nhưng không được tạo Promotion, `Marketing` chỉ được tạo Promotion/Campaign?).
2. **Billing cycle:** Hệ thống SaaS sẽ thu phí theo chu kỳ Tháng (Monthly) hay có thêm chu kỳ Năm (Yearly)?
3. **Thanh toán:** Chúng ta sử dụng cổng thanh toán nào cho recurring billing? (Stripe, VNPay, PayPal...?).
4. **Third-party Services (Social/Email):** Ngân sách/phân loại nhà cung cấp nào ưu tiên tích hợp trước? (VN thường dùng Zalo ZNS thay vì SMS).

> **BƯỚC TIẾP THEO:**
> Nếu PO/BA đồng ý với đề xuất và scope này, tôi sẽ tiến hành tạo file `F15-admin-management.md` chi tiết theo chuẩn `PRD_TEMPLATE`.
