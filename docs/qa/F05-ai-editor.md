# Test Cases: AI Editor (F05)

**Feature:** F05 — AI Editor (Split Screen)
**Reference:** US-004, US-005, US-006, US-007

---

## 1. Functional & Validation (Chức năng & Kiểm soát dữ liệu)

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-05.01 | Verify chat điều chỉnh giao diện (Change Color) | User ở `/editor/:siteId`, load xong Preview | 1. Nhập mô tả vào Box Chat.<br>2. Gửi lệnh. | `prompt`: "Đổi màu nút chính thành màu tím" | AI phản hồi giải pháp. Iframe Preview cập nhật real-time Component Button thành màu tím. | High |
| TC-05.02 | Verify tính năng Hoàn tác và Tiến tới (Undo / Redo) | Thực hiện xong TC-05.01 | 1. Bấm tổ hợp phím `Ctrl+Z` (Undo).<br>2. Bấm `Ctrl+Y` (Redo). | Lịch sử DOM | Undo: Màu UI trở về như cũ trước lệnh đổi màu. Redo: Tiến hành tới lại bản màu tím mượt mà. Đảm bảo DB sync block state. | High |
| TC-05.03 | Verify thao tác tạo trang Web mới thành công | Ở tab Settings/Pages | 1. Bấm Thêm trang, điền tên.<br>2. Bấm Save. | `Page Name`: "Khuyến mãi 2026" | Tạo page thành công, sinh slug `khuyen-mai-2026`. Điều hướng iframe qua trang trống mới. | High |
| TC-05.04 | Verify Admin: Thao tác Sao chép (Duplicate) Component Block | Ở Iframe Editor Chính | 1. Trỏ vào 1 Block (VD: Hero Section).<br>2. Bấm Icon 2 hình chồng File (Duplicate). | Node Component | Ngay lập tức nhân bản ra 1 Block Hero y hệt nằm ngay bên dưới Block gốc. Data Update lưu mảng JSON. | Medium |
| TC-05.05 | Verify báo lỗi trùng lắp Slug của Page (Duplicate Slug) **[Negative]** | CMS đang có sẵn trang `/about` | 1. Tạo thêm 1 trang mới cùng tên.<br>2. Bấm Save. | `Page Name`: "About" | UI báo lỗi "Đường dẫn URL đã tồn tại trong Hệ thống". API trả 400 Bad Request. | High |
| TC-05.06 | Verify vô hiệu Gửi Regex khi Prompt rỗng tại Popup Inline Edit **[Negative]** | Đang rê chuột vào 1 Text Typography | 1. Nhấp nút "✨ Edit with AI".<br>2. Khung hiện ra, để trống TextBox.<br>3. Bấm "Gửi". | `prompt`: "" (Rỗng) | Nút Gửi bị Disable. Không tạo ra Request API gửi lên Server để giảm lãng phí tài nguyên. | High |
| TC-05.07 | Verify từ chối thao tác Xóa Trang Home mặc định **[Negative]** | Trình Editor hiển thị danh sách Pages | 1. Hover chuột vào Trang "Trang chủ" (`/`).<br>2. Bấm Icon Thùng rác (Xóa). | `Page Name`: "Home" | Menu UI ẩn nút Thùng Rác hoặc Báo lỗi Error: "Không thể xóa trang chủ mặc định của Website". Data giữ nguyên. | Khẩn |

---

## 2. UI/UX, Edge Cases & Compatibility

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-05.08 | Verify Viền Xanh (Highlight Border) dẫn hướng trực quan khi Hover Block **[UX Empathy]** | Chuột di vào Iframe Preview Trang | 1. Lướt chuột qua từ Text, Ảnh, tới Block Hero. | Hover Event Pointer | Phần tử nào đang được chỉa vào sẽ sáng viền xanh (Blue Box-shadow/Border) để người dùng biết họ chuẩn bị thao tác trên thẻ nào. Rất quan trọng cho Builder. | High |
| TC-05.09 | Verify Nút (Bong Bóng) Quick Action nổi lên mượt mà theo Con Trỏ **[UX Empathy]** | Chuột Hover Viền Xanh 1 Bức Ảnh | 1. Dừng trỏ 0.5s ở Image Component. | DOM Floating Bubble | Xuất hiện thanh Toolbar mini nổi chứa: Icon Sửa Ảnh Cùng AI, Nút Xóa, Nút Cài Đặt. Click vào là trích mở Sidebar Right. Giảm số vòng Click lằng ngoằng của User. | High |
| TC-05.10 | Verify Check Cảnh Báo Nếu Có Thay Đổi (Dirty State) Khi Rời Trang Chóng Vánh **[UX Empathy]** | Vừa kéo thả 2 Component Mới, Web Chưa Auto-save. | 1. Cố Tình Click Gắt Cạnh Close Tab (Dấu X To Trình Duyệt). | `isDirty`: true | Trình HTML5 Bật Báo Thoại Native Xác Nhận: "Thay Đổi Của Bạn Chưa Được Lưu Kịp, Cẩn Thận Thoát". Cứu cánh User Lơ Đễnh. | High |
| TC-05.11 | Verify cơ chế tự động lưu Auto-save Debounce | Mở Editor và tương tác kéo Block | 1. Gõ văn bản trên Iframe liên tục 10s.<br>2. Ngừng gõ 3s. | Continuous Keystrokes | Trong lúc gõ không phát sinh API Calling. Chỉ hiện Badge "Đang lưu..." khi ngừng cứng qua 3 giây (Debounce React). | High |
| TC-05.12 | Verify Sync Offline khi thiết bị Mất Mạng **[Negative]** | Đang thao tác Editor | 1. Tắt Wifi/Network Adapter.<br>2. Kéo thả Block/Chỉnh Text.<br>3. Bật Internet. | `Network Status`: Offline > Online | Lúc mất mạng hiện Bar Cảnh Báo Đỏ "Vui lòng không tắt Tab. Đang mất Internet". Lúc Online lại tự động Sync background đẩy State JSON lên CMS lưu Data. | High |
| TC-05.13 | Verify hiển thị Layout Split-screen nhỏ không bị đè vỡ Dom | Màn hình hẹp (Mac 13 inch) | 1. Co nhỏ Cửa Sổ Trình Duyệt < 1024px rộng.<br>2. Thực hiện Drag n Drop thả Component Toolbar vào Giữa Iframe Layout. | Resize Window | Khung Sidebar Trái/Phải có Min-width. Iframe Ở Gữa trượt ScrollBar mà không vỡ CSS, tọa độ Drop Zone Item chính xác 100%. | Medium |
| TC-05.14 | Verify chuyển trang Context Sidebar thay đổi mượt mà | Đang trỏ Navbar | 1. Click menu chuyển sang một trang bất kì bên trong Iframe. | Hook Router Push | State Sidebar Panel Tự Cập nhật Cấu hình Settings và tên Khớp sang Context của Trang Website đang được trỏ. | High |
| TC-05.15 | Verify tương tác Kéo Thả (DnD) trên iPad Touch | Browser Safari iPad OS | 1. Dùng Finger (Ngón tay) ấn giữ và Rê Component Toolbar. | Touch Events | Kéo thả hoạt động giống thiết bị Mouse, Event Hook không bị Conflict làm Safari Back Page. | Medium |

---

## 3. Performance & Security

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-05.16 | Verify chống sửa Website (IDOR) trái phép chéo Tenant **[Negative]** | Login tài khoản Demo Tenant A | 1. Biết được ID API của Site thuộc Tenant B.<br>2. Bắn Request PATCH `sites/:uuid/save` qua REST Client | Target `SiteId`: Của Tenant Khác | Check Middleware Auth phát hiện sai Quyền Sở Hữu. Trả mã Code HTTP 403 Forbidden. Từ chối Ghi Đè Database. | Khẩn |
| TC-05.17 | Verify vô hiệu hóa XSS Injection trực tiếp vào Block Content **[Negative]** | Gọi POST Tool | 1. Insert payload JSON XSS vào thuộc tính nội dung đoạn Văn Bản API Cập Nhật UI Block. | `content`: `<img src=x onerror="alert(document.cookie)">` | DB nhận chuỗi String Bẩn nhưng Lúc Render React tự động Sanitize mã Nguồn Độc Hại. Không có Hộp thoại Alert (Javascript thi hành). | Khẩn |
| TC-05.18 | Verify ổn định Iframe DOM phức tạp (Memory Leak/FPS Test) | Site có quá nhiều Element Nodes | 1. Chèn hơn 50 Sections/Blocks lớn.<br>2. Kéo cuộn chuột và Drag thêm 5 Component liên rập. | `>= 50 Component Blocks` | Iframe Memory Snapshot không Leak. Thao tác Drag ko tụt Drop FPS dưới mức 20 frames/sec. Hành vi DOM update React Reflection Delay < 200ms. | Medium |
| TC-05.19 | Verify phân tách Dữ Liệu Versioned Draft vs Published | Có Khách Lạ đang Load Web ngoài Storefront HTTP Cũ | 1. Admin Edit Sửa Text thành "Khuyến Mãi Khủng".<br>2. Lưu Auto-save.<br>3. Check Web Khách mặt Tiền. | Saved Content trên DB | Khách Mặt Tiền Không thể nhìn thấy thay đổi mới nhất cho tới khi Admin click nút "PUBLISH". Phân vùng Cấu Trúc Data Draft chuẩn xác. | High |

---

## 4. Quality 10-Point Checklist Summary

| Hạng mục (10-Point) | Trạng thái | Ghi chú / Test Case Bao Phủ |
|---|---|---|
| 1. Happy Path | [ ] Untested | TC-05.01, TC-05.02, TC-05.03, TC-05.04 |
| 2. UI/UX (UX Empathy) | [ ] Untested | TC-05.08, TC-05.09, TC-05.10, TC-05.14 |
| 3. Validation | [ ] Untested | TC-05.05, TC-05.06, TC-05.07 |
| 4. Boundary | [ ] Untested | TC-05.06 |
| 5. Data | [ ] Untested | TC-05.19 |
| 6. Performance | [ ] Untested | TC-05.18 |
| 7. Security | [ ] Untested | TC-05.16, TC-05.17 |
| 8. Navigation | [ ] Untested | TC-05.14 |
| 9. Interruption | [ ] Untested | TC-05.12, TC-05.10 |
| 10. Compatibility | [ ] Untested | TC-05.13, TC-05.15 |
