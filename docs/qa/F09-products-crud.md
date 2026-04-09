# Test Cases: Products CRUD (F09)

**Feature:** F09 — Products CRUD (Dashboard)
**Reference:** US-007

---

## 1. Functional & Validation (Chức năng & Kiểm soát dữ liệu)

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-09.01 | Verify thêm sản phẩm cơ bản thành công (Happy Path) | Có quyền Quản trị, `/dashboard/products` | 1. Nhập đủ thông tin Tên, Giá RM, Stock.<br>2. Bấm nút Submit. | `name`: "Baju Pink"<br>`price`: 189<br>`stock`: 50 | Lưu DB thành công (UUIDv4). Giao diện List hiển thị record với format giá `RM 189.00`. | High |
| TC-09.02 | Verify Thao tác thao tác Xóa Mềm một Sản Phẩm (Soft Delete) | Có 1 SP Đang Mở Bán | 1. Chọn SP.<br>2. Bấm Đưa vào Thùng Rác. | `ProductStatus`: Active -> Archived | Database cập nhật `deletedAt` (Soft delete). Khách ngoài Storefront Không thể truy vấn, mất mục này khỏi API list. | High |
| TC-09.03 | Verify Thao tác Admin: Sửa nhanh Giá và Tồn Kho (Quick Edit) trực tiếp | Ở màn hình Danh sách Sản Phẩm | 1. Nhấp đúp vào ô Tồn kho của 1 SP.<br>2. Nhập số lượng mới và ấn Enter. | `stock_old`: 10<br>`stock_new`: 150 | UI cập nhật số 150 màu xanh lá nháy nhẹ. API Patch ngầm lưu vào DB ngay lập tức mà không cần mở form Edit tổng. | High |
| TC-09.04 | Verify Thao tác Admin: Xóa hàng loạt nhiều sản phẩm (Bulk Delete) | Ở màn hình Danh sách Sản Phẩm | 1. Tích chọn checkbox 5 sản phẩm.<br>2. Nhấn nút "Xóa các mục đã chọn". | Mảng `IDs` của 5 SP | 5 sản phẩm đồng loạt biến mất khỏi List. Toast thông báo "Đã Xóa Thành Công 5 Sản Phẩm". DB chuyển trạng thái Soft Delete. | High |
| TC-09.05 | Verify chặn Giá Trị Âm / Sai Định Dạng Field Numeric **[Negative]** | Form Thêm/Sửa Sản Phẩm | 1. Cố ý nhập giá trị vi phạm.<br>2. Nhấn Lưu Ngay. | `price`: -50<br>`stock`: "abc" | Báo lỗi màu đỏ ngay dưới Field: "Giá không được nhỏ hơn 0". Zod Schema nổ HTTP 400. Không lưu Data rác. | Khẩn |
| TC-09.06 | Verify chặn Tên Sản Phẩm Rỗng Không Nhập **[Negative]** | Form Thêm Theo Mới | 1. Để trống Tên SP hoặc toàn Kí tự trắng (Spaces).<br>2. Bấm Save. | `name`: "   " | Frontend khóa form (Disable Submit) / React Hook Form nhảy Lỗi "Không được bỏ trống". Hành vi gọi fetch API bị chặn tuyệt đối. | High |
| TC-09.07 | Verify chặn Upload File Sai Định Dạng Ảnh / Chứa Virus Trà Trộn **[Negative]** | Form Tải Hình Đại Diện | 1. Bấm Chọn Hình Ảnh.<br>2. Upload File Extension không hợp lệ. | File: `invoice.PDF` (Đổi đuôi thành JPG) | File Dropzone phát hiện Magic Bytes sai, Từ chối file. Không trigger Upload Endpoint lên Cloud. Toast Báo Lỗi File. | High |
| TC-09.08 | Verify Đồng bộ Giá Storefront Tự Động SSR Revalidation | Khách Đang Nhìn Storefront | 1. Admin Edit Giá từ RM 189 -> 150.<br>2. Khách Mới Bấm F5 Hoặc Add to Cart. | `Price`: 189 -> 150 | Giá mặt tiền Thay Đổi Khớp Răng Rắc `RM 150.00`. Quá trình Next.js Revalidate API gọi xóa Invalidate Cache cũ triệt để. | High |

---

## 2. UI/UX, Edge Cases & Compatibility

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-09.09 | Verify Tự động focus ô "Tên SP" & Label Tooltip mượt mà **[UX Empathy]** | Mở trang Thêm Sản Phẩm Mới | 1. Hành vi Mở URL /new. | Load Form Load DOM | Trỏ chuột Autofocus chớp sẵn trong trường "Tên Sản Phẩm" đầu tiên (Không tốn thêm click). Các Label có ToolTip rõ ràng. Đạt chuẩn UX Friction Test. | Medium |
| TC-09.10 | Verify sinh mô tả sản phẩm bằng AI Streaming | Bỏ trống Box Nội dung mô tả | 1. Bấm nút "✨ AI Viết Text". | `Product Name`: "Tudung Basic Muslimah" | Khoá nút Lưu Tạm Thời. Hiện Khung AI Response Nhảy ra từng Chữ Mượt. Text Chuẩn Fashion, xong xuôi Mở Khóa Nút. | High |
| TC-09.11 | Verify hiển thị Condition Fields Chứng Nhận Thực Phẩm (JAKIM Halal) | Tab Cấu hình Sản Phẩm | 1. Check vào ô Checkbox "Halal". | Cờ bool: `isHalal`: true | Xuất hiện thêm Block Buộc Nộp File Hình Chứng Nhận (Required) động Dropzone đi Kèm. Storefront Ánh Xạ Icon Halal Tốt. | High |
| TC-09.12 | Verify Auto-scroll nhảy tới trường Lỗi khi Form quá dài **[UX Empathy]** | Form cấu hình SP rất dài (SEO, Meta) | 1. Để trống Giá tiền (Tuốt dưới cùng màn hình).<br>2. Cuộn lên đỉnh bấm Lưu. | Error Validate Event | UI tự động cuộn (Scroll-smooth) xuống đúng dòng Input Giá đang bị Bo viền Đỏ để Admin kịp thời nhận diện. Giao diện UX rất tốt. | High |
| TC-09.13 | Verify Tìm kiếm SP bằng mã SKU không phân biệt chữ hoa/thường | Thanh Search Box Danh Sách SP | 1. Gõ mã SKU bằng chữ thường.<br>2. Gõ lại bằng chữ hoa. | `SKU`: "sp-a01" và "SP-A01" | Khung List Front-End Data DB API trả ra rành mạch chính xác cùng 1 sản phẩm đó (Case-insensitive Regex search). | High |
| TC-09.14 | Verify Lưu bộ lọc tìm kiếm tuỳ chỉnh (Save Custom Filter) | Đang filter "Tồn kho < 10" và "Đang bán" | 1. Bấm "Lưu bộ lọc".<br>2. Đặt "Products Sắp Hết". | Data Array JSON Filter | Có Header Button Nhãn Mới "Products Sắp Hết". Lần sau mở máy Panel List bấm Nút Auto Điền đầy đủ bộ lọc, giảm tải thao tác UX Admin. | Medium |
| TC-09.15 | Verify Đường Menu Breadcrumbs / Navigation Lưu Trạng Thái Search | Đang Dùng Filter Lọc "Hết Hàng" | 1. Click Chi Tiết Xem 1 Món.<br>2. Chạm Icon Back Hoặc Click BreadCrum. | Router Next.js Link Query | Trình Web Trở Lại Page List 1. Vẫn Đang Ở Trạng Thái Checked Filter "Hết Hàng". UX Cực Kì Thân Thiện. | Medium |
| TC-09.16 | Verify Tính tương thích Render Icon Ảnh Mới (HEIC/WebP) | User up Ảnh từ iPhone File Gốc | 1. Upload ảnh chụp màn Hình / iPhone `*.HEIC`. | Node Binary `Image.HEIC` | Trình Xử Lý Ảnh Chạy Node Parse Lớn Không Chết (Crash App). Máy tự Crop Resize Convert WebP Nhẹ Render Chuẩn, không Lỗi Broken Image. | Medium |

---

## 3. Performance & Security

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-09.17 | Verify Xâm Nhập Dữ Liệu Chéo IDOR (Xóa Lậu Product Bên Khác) **[Negative]** | Login Tài Khoản Tenant Store "A" | 1. Thay Tham Số Tham Chiếu ID SP Của Tenant Store "B".<br>2. Bắn Request DELETE bằng FETCH lậu. | `TargetId`: Object ID Hàng B | API Không tìm Thấy Auth Payload Thuộc Sở Hữu JWT `tenant_id` Khớp. Báo Lỗi ngắt Code HTTP 403 Forbidden. Cấm Can thiệp Tới Query Xóa DB. | Khẩn |
| TC-09.18 | Verify Tường Lửa Ngăn Lệnh Stored XSS Scripting Dữ Liệu **[Negative]** | Box Nhập Rich Text Mô Tả Sản Phẩm | 1. Nhồi nhét Inject Script Mã HTML Độc `<script>alert(...)` qua Postman xuyên Form Frontend. | Đoạn Payload DOM JS Hack Alert | Module XSS Filters Sẽ Sanitize Nhặt Sạch Sành Sanh DOM Script. Không Chạy Bật Poup Nào Gây Nguy Hại. | Khẩn |
| TC-09.19 | Verify Tải Danh Sách Phân Trang (Pagination Performance) | Cơm 1000 Thẻ Record Của Cửa Hàng Load Mặc Định Lên Mongo Table. | 1. User Trỏ Chuột Paging Lướt Tới Trang Kế Mở Filter Số Lượng Hàng. | Limit Chỉnh Block Trả 50 item | Index Mongodb SQL Cover Tuyệt Vời Chỉ Lôi Ra Khối Quét Khớp ID Dòng Nhỏ Li ti - Time Trả TTFB Rất Nhanh < 300 ms Tốc Độ Cao. | Medium |
| TC-09.20 | Verify Timeout Hook Bảo Vệ Sốc Mạng Khi Cúp Rớt Network Connection **[Negative]** | Khách Form Up Data Ảnh Kẹp Form Đang Giao Get Tới Node. | 1. Kéo Request Network Vòng Hoặc Rút Cầu Chì Modem Máy Test.<br>2. Xem Nút Spinner Đang Chở | Thả Cho Mốc Giờ Tối Hạn Expire Connection Timer Timeout | Trình Báo Error Rõ Form Bắt Khung Try Catch Phía Của UI React "Không Thể Lưu Kết Nối Máy Chủ". Rút Thoát Hoàn Phục Spinner Về Phím Button Đen Mở Bình Thường | High |

---

## 4. Quality 10-Point Checklist Summary

| Hạng mục (10-Point) | Trạng thái | Ghi chú / Test Case Bao Phủ |
|---|---|---|
| 1. Happy Path | [ ] Untested | TC-09.01 |
| 2. UI/UX (UX Empathy) | [ ] Untested | TC-09.09, TC-09.12, TC-09.10, TC-09.14 |
| 3. Validation | [ ] Untested | TC-09.06, TC-09.07 |
| 4. Boundary | [ ] Untested | TC-09.05, TC-09.07 |
| 5. Data | [ ] Untested | TC-09.02, TC-09.03, TC-09.04, TC-09.08 |
| 6. Performance | [ ] Untested | TC-09.19 |
| 7. Security | [ ] Untested | TC-09.17, TC-09.18 |
| 8. Navigation | [ ] Untested | TC-09.15, TC-09.12 |
| 9. Interruption | [ ] Untested | TC-09.20 |
| 10. Compatibility | [ ] Untested | TC-09.16 |
