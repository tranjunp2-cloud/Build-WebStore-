# Bộ Test Case: F10 — Quản lý Đơn hàng (Orders Management)
> **Cập nhật:** 2026-03-25 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F10-orders-management.md`), User Stories.

---

## 1. Mục Tiêu (Objective)
Cung cấp bộ Test Suite ngắn gọn, dễ hiểu để kiểm thử tính năng Quản lý Đơn hàng (F10). Bộ kịch bản đảm bảo bao phủ 100% User Stories, bao gồm xử lý State Machine, Concurrency (đồng thời), Restock tồn kho tự động, i18n và UI Mobile. 

---

## 2. Thông Tin Chung (Test Environment)
| Thông số | Diễn giải |
|---|---|
| Môi trường | Staging / Localhost với dữ liệu lớn (> 5.000 đơn hàng). |
| Tham gia | Khách mua (Guest), Quản trị viên, Nhân viên cửa hàng. |
| Thiết bị | Mobile (320px, 375px), Tablet, Desktop. |
| Timezone | Khách đặt ở UTC-5, hệ thống Quản trị hiển thị ở UTC+8. |

---

## 3. Ma Trận Kịch Bản Kiểm Thử (Traceability Matrix)

| ID | LOẠI | KỊCH BẢN (Scenario) | CÁC BƯỚC THỰC HIỆN | KẾT QUẢ MONG ĐỢI (EXPECTED) | MỨC ĐỘ |
|:---|:---|:---|:---|:---|:---:|
| **[US-F10-01] Quản lý Đơn hàng & Trạng thái** ||||||
| **TC-F10.01** | `Perf`| Nhận thông báo đơn hàng realtime | Khách đặt hàng. Cửa hàng đang mở trang Orders. | Đơn mới xuất hiện đầu danh sách < 15 giây, không cần reload web. Có hiện Toast notification. | Critical |
| **TC-F10.02** | `Logic`| Xử lý xung đột (Concurrency) | Nhân viên A duyệt đơn. Nhân viên B hủy đơn cùng lúc. | Trả lỗi HTTP 409 Conflict. Chỉ lưu thao tác gửi tới Server đầu tiên. | Blocker |
| **TC-F10.03** | `UI` | Giao diện Empty State | Truy cập Orders bằng cửa hàng chưa có đơn hàng. | Hiện Icon Lập phương và chữ "No orders found" đúng Mockup. | Low |
| **TC-F10.03b**| `UI` | Chuyển trang SPA | Chuyển qua lại giữa Dashboard và Orders. | Layout Header / Sidebar giữ nguyên. Không tải lại toàn trang (No White Flash). | High |
| **TC-F10.04** | `UX` | Xem hóa đơn thanh toán | Bấm phóng to ảnh hóa đơn Bank QR. | Ảnh mở lớn dạng popup Lightbox có nút đóng. Không bị lỗi thanh cuộn. | High |
| **TC-F10.05** | `Time` | Hiển thị theo Timezone | Khách ở múi giờ Mỹ (UTC-5) đặt đơn. Shop xem ở UTC+8. | Thời gian đặt đơn tự convert về mốc giờ máy của Shop (UTC+8). | High |
| **TC-F10.06** | `UI` | Thống kê số lượng đơn | Kiểm tra 4 thẻ thống kê số lượng Orders ở đầu trang. | Hiện chuẩn 4 màu & Icon: Pending, Ready to Ship, Confirmed, Shipped. Dữ liệu khớp DB. | High |
| **TC-F10.07** | `Bulk` | Nút thao tác Hàng loạt (Bulk) | Chọn 1 ô checkbox của Đơn Hàng bất kỳ. | Nút Bulk Action sáng lên kèm số liệu đã chọn "(1)". | Medium |
| **TC-F10.08** | `Bulk` | Xác nhận Đơn Hàng Loạt | Chọn 5 đơn Pending. Bấm nút Confirm. | Lưu 5 đơn thành Confirmed cùng lúc. Gửi 5 Email thông báo. | Blocker|
| **TC-F10.09** | `Sec` | Chặn quy trình hoạt động sai | Gọi API chuyển Đơn "Shipped" lùi về "Pending". | API báo lỗi 400 Bad Request. Chỉ được đi tới, không được lùi trạng thái. | Blocker|
| **TC-F10.10** | `Func` | Vô hiệu hóa Nút Refund | Chọn Đơn Hàng đang ở trạng thái "Pending". | Nút Hoàn Tiền (Refund) bị mờ (Disabled). Không bấm được. | High |
| **TC-F10.10b**| `Func` | Mở chức năng Refund | Chọn Đơn Hàng đã hoàn tất "Shipped/Completed". | Nút Refund sáng lên kích hoạt. Khi bấm sẽ mở bảng form Refund. | High |
| **[US-F10-02] Thanh toán của Khách (Customer Checkout)** ||||||
| **TC-F10.11** | `E2E` | Thanh toán ẩn danh (Guest) | Khách dùng chế độ ẩn danh, Đặt hàng COD. | Lưu đơn thành công. Hệ thống gửi Email xác nhận vào Email do Khách điền. | Critical|
| **TC-F10.11b**| `UI` | Trang tóm tắt đơn hàng | Đặt hàng thành công bằng mọi phương thức. | Chuyển sang URL `/order/{id}/confirm`. Hiện đầy đủ: Sản phẩm, Giá, Địa chỉ, Ngày giao. | High |
| **TC-F10.11c**| `UI` | Giao diện thanh toán Mobile | Checkout trên Mobile width tự chỉnh 375px. | Form trượt thành chiều dọc Column. Không bị lỗi thanh cuộn ngang 화면. | High |
| **TC-F10.12** | `Edge` | Hết hàng (Out of stock) | Kho còn 1 món. Khách A và B bấm Pay cùng 1 giây. | Khách chậm tay hơn nhận thông báo Lỗi "Out of Stock". Giỏ hàng được giữ nguyên. | High |
| **TC-F10.13** | `Sec` | Validate ảnh hóa đơn Bank QR | Khách mua qua QR Bank nhưng Không đính kèm Ảnh. | Nút Checkout bị khóa hoặc báo lỗi đỏ. Không cho bấm thanh toán. | Blocker|
| **TC-F10.13b**| `UI` | Hiển thị mã QR Cửa hàng | Nhấn chọn phương thức thanh toán Chuyển khoản QR. | Màn hình hiển thị đúng Hình Mã QR cá nhân của Chủ Shop để Khách dùng app Quét ảnh. | High |
| **TC-F10.14** | `Limit`| Giới hạn định dạng, dung lượng | Upload file quá hạn mức 2MB hoặc file PDF, EXE. | Website cảnh báo lỗi "Kích thước quá giới hạn" / "Sai định dạng file". Không cho phép up. | High |
| **[US-F10-03] Luồng Hủy Đơn & Cập Nhật Tồn Kho** ||||||
| **TC-F10.15** | `UI` | Hộp thoại Xác nhận Hủy | Nhấn nút "Cancel Order". | Hiện popup có tiêu đề "Confirm Cancel". Nút xác nhận có màu Đỏ cảnh báo. | High |
| **TC-F10.16** | `Func` | Bắt buộc nhập lý do Hủy | Để trống ô Nhập Lý Do Hủy, bấm Submit. | Cảnh báo Màu Đỏ Error "Lý do là bắt buộc". Không cho Submit lệnh Hủy về DB. | High |
| **TC-F10.16b**| `E2E` | Quy trình Hủy Đơn hoàn chỉnh | Điền lý do hợp lệ và bấm gửi lệnh Hủy. | Trạng thái chuyển Cancelled. Khách hàng nhận được Email thông báo hủy kèm lý do chi tiết. | Critical|
| **TC-F10.17** | `Func` | Chặn Hủy đơn đã Giao xong | Truy cập Đơn hàng đã ở mốc trạng thái "Completed". | Nút Cancel hoàn toàn bị ẩn đi. Quản trị không thể bấm hủy đơn nữa. | Blocker|
| **TC-F10.18** | `Data` | Tự động trả tồn kho (Restock) | Tồn kho (60). Khách mua (5) còn (55). Sau đó bị Hủy đơn. | DB chạy Job Tồn kho cộng lại (+5). Lưu Inventory về đúng mức (60) gốc. | Critical|
| **TC-F10.19** | `Crash`| Hủy Đơn chứa Hàng đã bị xóa | Hủy đơn chứa Sản phẩm Z. Lúc này SP Z đã bị xóa khỏi DB. | Quá trình Hủy chạy bình thường bỏ qua SP Z. Không gây lỗi HTTP 500 trắng trang (Crash app). | Blocker|
| **[US-F10-04] Data Lọc và Tìm kiếm (Queries Engine)** ||||||
| **TC-F10.20** | `Query`| Tìm kiếm Encoding Unicode | Nhập tìm kiếm tên chứa Emoji hoặc Unicode đặc biệt. | Trả kết quả chính xác cho chuỗi Unicode. Server API không bị crash lỗi Decode. | Medium |
| **TC-F10.21** | `UI` | Giao diện Menu bộ lọc | Bật Menu Dropdown Lọc Filter theo Trạng Thái / Theo Ngày. | Nhãn hiển thị chính xác như Mockup Figma (All Dates, This Week, Pending, Confirmed...). | High |
| **TC-F10.22** | `UI` | Màu sắc khối Trạng thái (Pill)| Xem các khối Test (Badge) trong cột Status lưới Order. | Bo góc chuẩn và hiển thị chuẩn màu: Pending (Cam), Confirmed (Xanh), đúng với Figma. | High |
| **TC-F10.22b**| `Query`| Lọc kết hợp (Multi-Filters) | Gõ "Nguyễn" vào hộp Search và Chọn Lọc Date = "Today". | Trả đúng đơn do người tên "Nguyễn" MUA vào "Hôm Nay" (AND logic). Lọc sai ngày sẽ bỏ qua. | High |
| **TC-F10.23** | `Sort` | Sắp xếp giá tiền Int | Click tiêu đề cột "Total" để sắp xếp theo Giảm Dần. | Sort đúng theo Giá trị Số Học. (10M > 2). Không bị dính lỗi Sort theo Text trong JS ("2" > "10"). | High |
| **TC-F10.24** | `UI` | Phân trang lưới (Pagination) | Bảng Orders đang có hơn 50 dòng. Chuyển qua trang 2. | Render Trang mới ngay lập tức. Nội dung thay đổi không làm Load (nháy trắng) màn hình gốc. | Medium |
| **[US-F10-05] Thiết bị Responsive và Giao diện Đa ngôn ngữ** ||||||
| **TC-F10.25** | `Res` | Giao diện Mobile Frame 320px| Chạy Device Emulator iPhone SE kích thước siêu hẹp 320px. | Bảng Table List Đơn hàng Lập Tức Chuyển hóa Lặp Form Card Dạng Stack. Giấu thanh cuộn ngang. | Blocker |
| **TC-F10.26** | `Res` | Popup Mobile vs Drawer PC | Nhấn mở Chi Tiết một Đơn Hàng dưới điện thoại (<= 768px).| Hệ thống mở Full-screen Popup Modal tiện lợi thay vì kiểu Cửa Sổ Kéo (Drawer) nhỏ như ở Desktop. | High |
| **TC-F10.27** | `UX` | Thanh ActionBar dính mép dưới| Cuộn nội dung Modal chi tiết Khách Dài trên Điện Thoại. | Các nút hành động (Confirm, Ship, Cancel) bị ghim dính ở cuối màn hình để dễ chạm ngón tay. | Critical |
| **TC-F10.28** | `i18n` | Map nội dung Đa ngôn ngữ | Đổi hệ thống sang ngôn ngữ Tiền Định "Malay (MY)". | Tất cả các dòng Text kể cả Empty State, Trạng Thái, Modal Dịch qua mã Malaysia hoàn chỉnh 100%. | Blocker |

---

## 4. Biên Bản Kiểm Định QC (10-Point Checklist)
> Các bước bắt buộc phải vượt qua trước khi ký Release PR.

1.  **[ ] Bỏ qua lỗi Xóa sản phẩm:** Hủy đơn chứa sản phẩm đã xóa không bị sụp web HTTP 500.
2.  **[ ] Đồng bộ Timezone:** Ngày giờ đơn tự convert khớp hệ thống duyệt Web của người quản trị (Merchant).
3.  **[ ] Bảo mật hệ thống tải file:** Khóa form File QR Hạn mức > 2MB hoặc file giả mạo định dạng.
4.  **[ ] Ràng buộc quy trình đơn:** Chặn lỗi Backend API cập nhật đi lùi trạng thái đơn hàng (Forward-Only).
5.  **[ ] Tối ưu Mobile Layout:** Stack Card Framework tự thích ứng được ngay cả viewport ngặt nhèo 320px.
6.  **[ ] i18n Dictionary:** App Frontend đã dịch map ngôn ngữ động React. Không bị lưu đoạn text tiếng Anh Hard-code.
7.  **[ ] Thiết kế Empty State Validation:** Render Icon Layout Đơn trống rỗng khớp UI Component Mockup Figma 100%.
8.  **[ ] Validation Required Lý do Hủy:** Form chặn Red Error Fields nếu bấm Submit Hủy thiếu dòng Text Nguyên Nhân.
9.  **[ ] Disable Refund Button Logic:** Nút Hoàn Tiền bị làm mờ, chặn click khi Status Đơn chưa Đạt cấp độ Hoàn Tất Giao.
10. **[ ] SPA Routing Performance:** Menu Navigation không Refresh, API Component Load êm ả không chớp giao diện Web Layout.

---
