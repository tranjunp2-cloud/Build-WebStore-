# PRD — F22: Tracking & Analytics Integration (Store Config Sub-feature)

> **Document Status:** Draft
> **Feature Code:** F22
> **Target Release:** TBD
> **Epic:** Store Setup & Configuration (Child of F19)

## 1. Context & Problem Statement
Merchants tạo cửa hàng qua PrimeWeb cần công cụ để đo lường chuyển đổi từ quảng cáo và hiểu hành vi khách truy cập. Hiện tại, chưa có tính năng nào cho phép người bán tự liên kết các loại Pixel (Google Analytics 4, Facebook Pixel, TikTok Pixel) mà không cần can thiệp kỹ thuật hoặc sửa code template.

## 2. Business Goals & Metrics
- **Goal:** Cung cấp công cụ giao diện trực quan cho Seller để cấu hình mã theo dõi liên kết với các chiến dịch Marketing.
- **Goal:** Nâng cao sức cạnh tranh của PrimeWeb platform nhờ tính năng Plug-and-Play Pixel, giúp Seller tối ưu chỉ số ROI.
- **Metric:** Tỷ lệ Store có cài đặt ít nhất 1 loại Tracking ID.

## 3. Scope
**In Scope:**
- Component UI nhập Tracking ID: Hỗ trợ cấu hình tích hợp Google Measurement ID (GA4), Facebook Pixel ID, TikTok Pixel ID. Màn hình sẽ nằm chung bên trong các Tab Settings của Store (cùng nhánh F19).
- Tự động Validate ID: Kiểm tra cú pháp cơ bản cho từng loại mã (VD chữ `G-` đối với GA4).
- Tự đống Render Tracking Scripts tương ứng vào Frontend (Storefront Client-side).

**Out of Scope:**
- Server-side Tracking events (Conversion API).
- Tích hợp Ecommerce Tracking Events (view_item, add_to_cart, purchase) tại phase 1 (chủ yếu cung cấp base tracking - PageView trước).
- Custom Cookie Consent Banner (quản lý rủi ro GDPR/CCPA sẽ được tính sau hoặc dựa trên một solution dùng chung).

## 4. Target Audience
- **Store Owners / Admins:** Các Seller bán hàng chạy quảng cáo trên MXH/Google, không am hiểu về IT code, cần giao diện siêu đơn giản (Nhập dãy số -> Bật -> Lưu).

## 5. Functional Requirements

| Req ID | Requirement | User Story Ref |
|--------|-------------|----------------|
| REQ-F22-01 | **Tracking Settings UI:** Hệ thống hiển thị 1 tab hoặc mục dành riêng cho Tracking & Analytics trong trang Cài đặt (Admin CMS). | US-F22-01 |
| REQ-F22-02 | **Tracking Config Inputs:** Hệ thống cho phép Merchant nhập và lưu các mã ID theo dõi bao gồm: GA4 (Measurement ID), Facebook Pixel ID, TikTok Pixel ID. Mỗi loại có switch để Bật/Tắt độc lập. | US-F22-01 |
| REQ-F22-03 | **Format Validation:** Form cần có validator tối thiểu khi lưu (VD: ID của GA4 phải bắt đầu bằng chữ "G-", Pixel ID chỉ chứa số) để tránh Merchant nhập lỗi, và thông báo cho họ. | US-F22-01 |
| REQ-F22-04 | **Global Script Inject:** Khi các ID được lưu và ở trạng thái "Bật", ứng dụng Storefront phải tự động load (render) các file thẻ script js base tương ứng (gtag, fbq, ttq) vào trong cấu trúc HTML của template khách hàng xem. | US-F22-02 |
| REQ-F22-05 | **Script Security & Optimization:** Script load ở Storefront không được gây lỗi XSS và cần được tối ưu hóa tải trang (VD qua cơ chế next/script: afterInteractive). | US-F22-02 |
| REQ-F22-06 | **Setup Instructions (UX Helper):** Dưới mỗi ô nhập ID, giao diện phải cung cấp dòng text hướng dẫn siêu liên kết (Ví dụ: "Cách lấy ID") giúp Seller biết cách tìm "Measurement ID" hoặc "Pixel ID" từ trình quản lý Google/Meta/TikTok. | US-F22-03 |

## 6. Non-Functional Requirements
- **Performance:** Khi kích hoạt nhiều Tracking script, Storefront cần xử lý script injecting một cách Non-blocking/async, đảm bảo không làm Core Web Vitals (FCP, LCP) giảm sút sâu.
- **Security:** ID string sẽ không parse các dấu nháy kép hoặc thẻ `<` `>`, tránh người dùng spam script rác.

## 7. Assumptions & Constraints
- Tính năng Tracking này sẽ dùng chung màn hình Settings (Store Configurations) của F19 cho mặt UI Layout để cho Seller quen luồng thao tác.

## 8. Open Questions
- Với Next.js Storefront, có nên dùng Next.js Thirt-Party Library `(@next/third-parties/google)` để optimize GA4 không?
- Chúng ta có nên tính phí/Upgrade Plan để mở khoá tính năng nhập Facebook Pixel/TikTok Pixel không? Hay mặc định bật cho gói Miễn phí?

## 9. Screen Layout

*Lưu ý: Component UI nằm bên trong Layout của Store Settings (F19).*

### 9.1. Settings Tab: Tracking & Analytics Component
- **Mô tả:** Form điền các thông số Tracking kèm theo hướng dẫn (Helper text) cho Merchant.
- **Components chính:**
  - GA4 Block: `Label: Google Analytics 4`, Input `G-XXXXXXXXXX`, Toggle Switch `Enable/Disable`. Phía dưới Input xuất hiện dòng chú thích mờ: *"Bạn chưa rõ cách lấy ID? [Xem hướng dẫn lấy mã G-]"* (Link ra Tab mới).
  - FB Pixel Block: `Label: Facebook Pixel`, Input `123123123123`, Toggle Switch `Enable/Disable`. Có Helper Text: *"Xem hướng dẫn Copy 15 số ID Pixel Meta."*
  - TikTok Pixel Block: `Label: TikTok Pixel`, Input `CXXXXXXXXXXX`, Toggle Switch `Enable/Disable`. Có Helper Text: *"Xem hướng dẫn khởi tạo TikTok Pixel."*
  - Nút `Save Changes` hiển thị dạng Floating ở dưới/trên cùng.
- **Các trạng thái:**
  - Valid: Nhập sai hiện error text màu đỏ dưới field Input. 
- **Design / Wireframe:**
  - [Link tới file wireframe bổ sung]
