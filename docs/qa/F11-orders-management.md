# Test Cases: Orders Management (F11)

**Feature:** F11 — Orders Management & Webhooks
**Reference:** US-012, US-013

---

## 1. Functional & Validation (Chức năng & Kiểm soát dữ liệu)

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-11.01 | Verify tạo Order qua cổng Stripe khi thanh toán thành công (Happy Path) | Thêm SP vào Cart | 1. Nhập Form Checkout test card. Xác Nhận Gửi | `card`: Stripe Test Card | Cổng Nhẩy Hoàn Thành, Redirect `/order/[id]/confirm`. Webhook Đẩy CMS trạng thái Status `paid`. Gắn Log Transaction ID. | High |
| TC-11.02 | Verify Thao tác Khách: Hủy Thanh Toán (Cancel) Đầu Cổng Trả Tồn Kho | Màn Hình Checkout Stripe | 1. Khách Đổi Ý Không Mua Nữa, Bấm Phím Trở Về. | Cancel Action Native | Phiên Bị Giải Tán. App Về Lại Rổ Mua Sắm Rỗng Cọc, Lệnh Cầm Hàng Hoàn Kho DB. Hóa đơn Xóa Trắng Khỏi Drop Tồn. | High |
| TC-11.03 | Verify Khách Cập Nhật Địa Chỉ Shipping Xong CMS Label Update | Khách Checkout Lệnh Chờ | 1. Báo Lỗi Nhắn Sửa Đổi Form Addr. Admin Đổi Ngay Địa Chỉ Chuyển Giao Hàng Xong Chốt Vận. | Form Sửa Address | Trạng Thái Lưu DB Nhận Form Address Mới. Render Label Tracking Lô Hàng Khớp Số Nhà Chỉnh. | High |
| TC-11.04 | Verify Admin Hoàn Tiền Thẻ Một Phần Qua Stripe (Partial Refund) | Gói Order `paid` Đang Khiếu Mất | 1. Chủ Shop Bấm Nút Detail.<br>2. Chọn Option Refund & Gõ Tiền `RM 30`. | Text Tiền `30` | Data Request Gửi Stripe Refund Một Khối Nhỏ Đóng Vô Tài Khoản Trực Thuộc. CMS Cập Nhật Order: `Partially Refunded` Hiển Rõ. | Khẩn |
| TC-11.05 | Verify Tính Toán Giỏ Hàng Sai Lệch JS Client Check **[Negative]** | Giỏ Hàng Mua | 1. Bơm Lệnh Sửa Value Giá Frontend F12 Thành `0.1` Rm Bắn Lụi. | JS Tampering Price | Server Phỏng Quét Query CMS Lookup Giá Thật Product Lại Bằng ITEM_ID. Trả ZOD Validation Hoặc 400 Bad Logic Error Ra Client. Từ chối Pay. | Khẩn |
| TC-11.06 | Verify Dò Nén Chặn CheckForm Thiếu Dữ Liệu Form Missing Address/Email **[Negative]** | Cart Checkout Bước 2 | 1. Gõ Rỗng Địa Chỉ Email Đăng Kí. Click Mua Pay! | `email`: "   " | Form DOM Lock Sự Kiện Pay Block Vội Tức Thì. Báo Form Vành Mép Bo Viền Bôi Khung Yêu Cầu Text Warning Rõ Dễ Thấy. | High |
| TC-11.07 | Verify Mất Lượt Thanh Toán Quá Hạn Cổng Gateway Delay Decline **[Negative]** | Ném Link API | 1. Lâu Đợi 1 Tiếng Timeout / Thẻ Có Bank Nhậu Limit Bị Hõm Phí Cắt Cước Trả Về `Declined`. | Stripe Status `card_declined` | Mã Order Xây Lệnh Update Thẻ Failed Thất Bại Lối Status Lên App Màn. Kẹt Inventory Tồn Kho Rút Chốt Hoàn Thả Trở Lại Cửa Sổ Bán. | High |
| TC-11.08 | Verify Ngăn Nhập Mã Promocode Giảm Giá Hết Lượt / Hết Hạn **[Negative]** | Nhập Promo Cột | 1. Khách Điền Thẻ Khuyến Mãi Mã SUMMER2026 Code Lố Code Khuya Rỗng Quá 0. | Code Hết Hạn, Lượng | Validation Y/C Giải Thích Mã: Báo ToolTip Này Lỗi Expired Cấp Ưu. Trạng Thái Tổng Order Giữ Giá Cũ Tiền Max. | High |
| TC-11.09 | Verify Đối Soát Tính Toán Decimal Số Phết Động Tax% Hạn Lẻ Cents | Đơn Mua Vat 6% Kẹp Combo % Khấu | 1. Build Cục Giá Lẻ Động `234.33` Áp Mã Sâu Khấu Gắt | Double Cents Floating Num | Bộ Thư Viện Decimal System Sẽ Làm Việc. Nếu Phép Trừ Ra 2.01 Không Báo Node 2.00000001. DB Chứa Đúng Giá Chuẩn Format (INTEGER SEN). | Khẩn |

---

## 2. UI/UX, Edge Cases & Compatibility

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-11.10 | Verify Auto-focus Nhập Thẻ & Label Checkout Friendly **[UX Empathy]** | Customer Load Checkout Web | 1. Nhanh Chóng Mở Trang Thanh Toán. | Trang Thanh Toán | Khách tự động được Focus thẳng vào ô "Số Điên Thoai". Label và Helper text ở nút "Thanh Toán" có in RÕ RÀNG Tổng Số Tiền để tránh nhầm UX Friction. | High |
| TC-11.11 | Verify Push Real-Time SSE Thông Báo Đơn Tới Mới Trên Admin Desktop | Chrome Dashboard Dựng Treo On | 1. Khách Giao Dịch Thành Công Cọc Thẻ.<br>2. Chủ Store Cắm Máy Ngồi Nhìn Order List | User Action Checkout | Màn hình Chủ Store Tự Động SSE/Poll Push Popup Notification Toast Chớp Xuất Hiện Đơn Mới Đầu Bảng. | High |
| TC-11.12 | Verify Gắn Cò Kích Sống Gửi Mail Alert Phái Cho Khách Giao Hàng | Tình trạng Order Hiện Đạt `New` | 1. Chủ Đơn Chuyển Combo Đổi Mode Qua "Đang Vận Chuyển" (Shipped).<br>2. Check InBox Mail Nhận. | `Status`: `processing` -> `shipped` | Email Có Flow Layout Chuyên Nghiệp Bay Vô Mail Người Mua (Template Khớp, Tracking Rõ Chữ, Không Chết Mốc Lỗi Biến Undefined). | Khẩn |
| TC-11.13 | Verify In Hàng Loạt Batch Cục Mass Lệnh Label Bưu Phiếu Shipping Khách Chọn Mảng Chọn | Lọc Danh Sách Sẵn Phí Paid Tới Giờ Bốc Kho | 1. Chọn Lưới Hàng Loạt 20 Orders List Phía Cột.<br>2. Bấm In Batch PDF. | Mảng `ids` | PDF Print Dialog Window Native Khớp Tải Tool Hợp Khối 20 Tờ Render Data Label Kéo Không Sốc Đơ App Rách Form Ảnh Củ. | Medium |
| TC-11.14 | Verify Hành Vi Nút Bulk Action Đảo Mode Nhiều Item Quản Lý Tool Batch | Bảng Admin Đầy List Đơn Chờ Cũ | 1. Khóa Chốt Check Box 5 Hóa Đơn Khác Nét Liền.<br>2. Combo Chọn Trạng Thái Done Apply. | Patch Nhiều Record Rows ID | Tốc Form Đẩy Gọn 5 Rows Chuyển Trạng Xong F5 Update Load Cache Gọn Bẫy Báo Đơn 1 Dòng Success Vỏn Vẹn Tránh Toast Lắc Gào 5 Đáy Sốt Chét UI Dội. | Medium |
| TC-11.15 | Verify Modal Lướt Dữ Liệu Ngoại Xem Đơn Không Đổ Trang Context Web **[UX Empathy]** | List Admin Danh Sách Order Mới Lọc Tay | 1. Chạm Table Cell Order ID Link View.<br>2. Đọc Ngay Content Lòng Bên Trái. | UI Click Drawer Hook | Nhả Panel Trượt Ngang Right SideModal Mở Rộng Trang Đơn. Giữ Form Filter Gốc Trái Xếp Đội Sau Đẹp Đóng Là Xem Lại List Cũ. | High |
| TC-11.16 | Verify Iframe Checkout WebView Trình Cũ Tương Thích Tốt FB Khách Quét | Nền iOS 11 Cũ Kể Tới App Bật | 1. Khách Nhấp Link Mua Qua InApp Browser Facebook Chat Messenger. Bấm Thanh Toán. | Meta WebView Component | Responsive Stripe Checkout Vẫn Không Xòe Xô Lệch Button. Input Type Số Điện Thoại Gõ Lên Bình Thường Chuyển Bảng Số. | Medium |

---

## 3. Performance & Security

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-11.17 | Verify Race Conditions Sale Sốc Xung Đột Đạp Cướp Hàng Nền Rối **[Negative]** | Số Lượng Tồn Kho Khống Chỉ Duy Nhất Có = `1` Kiện | 1. Bắn Tool Giả Lập Nhồi 10 Threads POST API Tạo Đơn Hàng Một Lúc Trúng Ngay Millisecond Timestamp Cho Em Món Ấy Bị Flash Sale Chộp Tiền. | Requests Song Song | Khóa Database Locking Mongoose/Postgres Payload Xử Lý Ràng Buộc Hủy Nổ Lệnh Báo Code 409 Conflict. Chỉ Duy Nhất Nhận 1 Winner Thread Cầm Token Mua. | Khẩn |
| TC-11.18 | Verify Bịt Sửa Giả Fake WebHook Stripe Bypass Fake Ký Lệnh Rổng **[Negative]** | Endpoint Nhận Báo Thông Báo Status `/webhooks/stripe` Mở | 1. Trích Xuất File Chữ Ký Body Cũ Payload JSON Chế Số Tiền Post Lên WebHook Kênh Đóng Vai Bắt Chước Webhook Giả. | Header Signature Fake Ngắn | Core Stripe API Token Móc Test Chữa Webhook Kiểm Chứng Trượt Quả Signature So Khớp Nhau. Đá Lệnh Quăng Response Thùng Rác Error DB Không Lưu Đơn Tiền "Ảo". | Khẩn |
| TC-11.19 | Verify Nắm Gỡ Tồn Auto Sweep Kẹt Rỏ Mua Release Stock Giữ Rỏ Bỏ Xó Timeout CronJobWorker Lẻ Trôi | 1 User Mở Checkout Hold Vứt Booking Xong Sang Tab Mở Web Khác 40 Phút Mới Tắt. | 1. Query Data Stock Bị Reserve Cầm Số Liệu "Reservation Lock".<br>2. Xem Cung Trục Cron Phá Hủy TTL Session Này. | Session Hold 30 Mins Over | Stock Database Sẽ Phát Nổ Xóa Biến Hoàn Trả 1 Mặt Hàng Available Lên Form Kho Tồn DB Do CronJob Chạy. Tránh Tổn Thất Do Nghẽn Khống (Leak Slot). | Khẩn |

---

## 4. Quality 10-Point Checklist Summary

| Hạng mục (10-Point) | Trạng thái | Ghi chú / Test Case Bao Phủ |
|---|---|---|
| 1. Happy Path | [ ] Untested | TC-11.01 |
| 2. UI/UX (UX Empathy) | [ ] Untested | TC-11.10, TC-11.11, TC-11.15 |
| 3. Validation | [ ] Untested | TC-11.06 |
| 4. Boundary | [ ] Untested | TC-11.08 |
| 5. Data | [ ] Untested | TC-11.04, TC-11.03, TC-11.09 |
| 6. Performance | [ ] Untested | TC-11.19 |
| 7. Security | [ ] Untested | TC-11.17, TC-11.18, TC-11.05 |
| 8. Navigation | [ ] Untested | TC-11.02, TC-11.15 |
| 9. Interruption | [ ] Untested | TC-11.02, TC-11.07 |
| 10. Compatibility | [ ] Untested | TC-11.16 |
