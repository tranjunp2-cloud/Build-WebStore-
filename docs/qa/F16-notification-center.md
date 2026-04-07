# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F16 - Notification Center
> **Phiên bản:** 1.0 (Kiểm thử chức năng Trung tâm thông báo) | **Cập nhật:** 2026-04-06 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F16-notification-center.md`), User Stories (8 USs), Báo cáo Phân Tích Hiện Trạng
> **Kỹ năng ứng dụng:** Kiểm thử Tự động (BDD Gherkin), Kiểm thử Luồng gián đoạn mạng, RBAC, Trải nghiệm Mobile UX, Chống gián đoạn dịch vụ hiệu năng cao.

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case này được xây dựng nhằm đảm bảo chất lượng toàn diện cho tính năng Notification Center. Mục tiêu cốt lõi là đạt độ phủ (Coverage) 100% cho 8 User Stories, bao quát chính xác mọi Acceptance Criteria (ACs).
Tài liệu chú trọng đánh giá các giới hạn biên (Boundary/Equivalence), quy tắc bảo mật theo vai trò (RBAC), tối ưu hiệu năng trước thao tác lạm dụng (Spam/DDoS), và trải nghiệm UI/UX đa nền tảng.

---

## 2. Thông Tin Môi Trường (Test Environment)

| Thông số | Yêu cầu kiểm thử |
|---|---|
| Môi trường | Staging / Pre-Production |
| Trình duyệt | Chrome (v110+), Firefox (v105+), Safari, Edge (Kiểm tra PWA Web Push) |
| Kích thước | Màn hình Desktop (1920x1080), Giao diện Mobile (375px) |
| Chuyên biệt | Kịch bản bắn thông báo tự động tốc độ cao (50 sự kiện/giây), phân quyền 3 Role khác biệt, lưu trữ dữ liệu DB > 30 ngày. |

---

## 3. Ma Trận Kịch Bản Kiểm Thử (Traceability Matrix)

### US-F16-01 & US-F16-06: Unread Badge & Realtime Toast (Boundary & Stress)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F16.01** | `US-01/AC-1` | `Boundary`| **[Positive]** Phân tích giá trị biên hiển thị Unread Badge (0, 1, 99, 100) | 1. Cập nhật hệ thống số lượng thông báo chưa đọc theo giá trị biên: `0, 1, 99, 100, 150`.<br>2. Làm mới trang quan sát Icon chuông báo. | - Bằng 0: Ẩn Badge.<br>- Từ 1-99: Hiển thị đúng số đếm.<br>- Từ 100 trở lên: Hiển thị giới hạn `"99+"`, bố cục badge không bị tràn/móp. | High | [ ] |
| **TC-F16.02** | `US-06/AC-2` | `Perf` | **[Negative]** Kiểm thử sức chịu tải khi hệ thống nhận thông báo với tần suất cao (Spam) | 1. Cấu hình Backend tự động gửi 50 sự kiện đơn hàng/1 giây xuống Websocket của User Online. | - Hệ thống tự động gom nhóm Toast (vd: "Có 50 thông báo mới"), không hiển thị riêng lẻ 50 toast gây crash trình duyệt.<br>- Badge "Chưa đọc" cập nhật tăng ngay lập tức. | Blocker | [ ] |
| **TC-F16.03** | `US-06/AC-1` | `UI` | **[Positive]** Thời gian hiển thị chuẩn của Toast Thông báo góc màn hình | 1. Kích hoạt 1 thông báo từ Server xuống User.<br>2. Chờ Toast hiển thị. | - Toast hiển thị tại góc phải dưới, không che lấp Input thao tác làm việc của hệ thống (Z-index lớn nhất).<br>- Toast tự động ẩn mượt mà (Fade-out) sau độ trễ 5-7 giây. | Medium| [ ] |

### US-F16-02 & US-F16-08: Giao diện Dropdown và Mobile View

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F16.04** | `US-02/AC-1` | `Limit` | **[Positive]** Phân trang giao diện Danh sách và Trạng thái hiển thị | 1. Thêm mới 30 thông báo (20 chưa đọc, 10 đã đọc) vào hệ thống.<br>2. Click Icon Chuông mở Panel thả xuống. | - Query hệ thống lấy chính xác giới hạn 20 thông báo mới nhất hiển thị trước.<br>- Phân bậc UI: Chưa đọc bằng văn bản chữ in đậm và Dot màu Xanh nổi bật; Đã đọc sử dụng màu chữ xám, mờ Dot chìm. | High | [ ] |
| **TC-F16.05** | `US-08/AC-1` | `Mobile`| **[Positive]** Định dạng luồng hiển thị Bottom Sheet trên thiết bị Di động | 1. Thiết lập Viewport mô phỏng nền tảng Mobile (375x812px).<br>2. Chọn Icon Chuông từ Header di động. | - UI thả nổi Dropdown cũ bị loại bỏ. Thay thế bằng bố cục kéo Bottom Sheet rộng lên ôm hết thân màn hình.<br>- Mục tương tác có kích thước cảm ứng tốt. Hiển thị lớn rõ nút "Mark All As Read". | Blocker| [ ] |

### US-F16-03 & US-F16-04: Điều hướng liên kết Component & Nút "Mark All As Read"

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F16.06** | `US-03/AC-1` | `Func` | **[Positive]** Tương tác nhấp điều hướng thông báo Đơn Hàng (Actionable Links) | 1. Click trực tiếp vào Item "Đơn Hàng Mới #999" (Unread màu xanh). | - Hệ thống kích hoạt Routing điều hướng sang thẻ `orders/999`.<br>- API `mark-read` chuyển Item thành Đã Đọc.<br>- Icon Badge tự động trừ đi 1 đơn vị Chưa đọc. | Blocker| [ ] |
| **TC-F16.07** | `US-03/AC-2` | `Func` | **[Edge]** Phân giải ngoại lệ Tin thông báo tĩnh, không chứa Link đích (No target Route) | 1. User chạm click vào Item Tin Tức Hệ Thống chỉ bao gồm Nội dung thuần túy. | - Chuyển sang "Đã đọc", Badge trượt lùi giảm trừ 1.<br>- Màn hình làm việc phía dưới giữ nguyên tĩnh, không Reload Web toàn trang hoặc bị Redirect gây mất phiên công việc đang lỡ tay chừng. | Medium| [ ] |
| **TC-F16.08** | `US-04/AC-1` | `Func` | **[Positive]** Cập nhật trạng thái "Mark All As Read" toàn bộ Unread | 1. Setup Data chứa 15 tin unread trong Inbox Notification.<br>2. Clic chọn phần tử hành động "Mark All As Read" ở khu vực Header của Panel Notification. | - Triệt tiêu nhanh hiển thị dấu Xanh chấm, biến chuỗi 15 thành phần về thiết lập Xám Read.<br>- Huy hiệu Badge đỏ tắt hoàn toàn. | High | [ ] |
| **TC-F16.09** | `US-04/AC-1` | `Logic` | **[Negative]** Khoá chặn Cụm Button thao tác thừa (Badge Unread = 0) | 1. Thiết lập Số Notification chưa đọc Badge = 0.<br>2. Khui màn Dropdown và tiến hành Inspect CSS Nút. | - Nút "Mark all as read" cấu hình Disabled Xám mờ (`Pointer-events: none`).<br>- Chặn Request spam vô nghĩa hướng Server API `mark-read`. | Low | [ ] |

### US-F16-07: Browser Native Web-Push Notifications Cấp Hệ Điều Hành (OS Base)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F16.10** | `US-07/AC-1` | `Flow` | **[Positive]** Cấp quyền Notification Trình duyệt thiết bị (OS Opt-in Tab Permission) | 1. Đặt trắng Permission Cache Browser hiện tại.<br>2. Tab đăng nhập lần đầu bắn Modal Xin Chặn quyền OS. | - Trình duyệt xin Quyền "antigravity.app wants to show notifications".<br>- Nếu chọn Allow: Bật Server Flag PUSH `true`. Lên Database cờ người dùng.<br>- Nếu Block: Từ chối dằn mặt, Không hiện bất kỳ Push Background nào nữa. | High | [ ] |
| **TC-F16.11** | `US-07/AC-2` | `Func` | **[Edge]** Trải nghiệm Web-Push cảnh báo lúc Tab Web ở dưới gầm thu bé (Background App Run) | 1. Permission WebPush báo True. Tab Chrome thu nhỏ thanh Taskbar Background (Idle App).<br>2. Thao tác bắn 1 thông báo tới tài khoản đó thông qua Postman Của Admin. | - Card báo Native của Windows/MacOS hiện nổi lên từ phía cạnh góc Màn Hình thiết bị.<br>- Click vào Khung Card, Window tự Lật tab kéo Browser Chrome chứa Web Antigravity lấy trạng thái Focus ánh sáng bật lên để User thao tác mượt mà. | Blocker| [ ] |

### Kiểm Lỗi Phân Quyền (RBAC Leakage) & Dọn Dẹp Cơ Sở Dữ Liệu Crontab DB

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F16.12** | `BR-01` | `Sec` | **[Negative]** Chống rò rỉ rào quyền hiển thị Dữ Liệu Dựa Theo Vai Trò (RBAC Bypass Limit) | 1. Duy trì Account Nhân Viên Content (Không có quyền module Orders).<br>2. Thông qua Backend, tạo một Order phát sinh tin báo mới trong tổ hợp cùng hệ thống. | - Dựa trên Filter Role, Notification của Order này Bị Chặn. Chuông tài khoản NV Content hiện Badge 0, Dropdown hoàn toàn sạch sẽ, Toast không bung.<br>- Rò rỉ Data Đơn chéo sang quyền NV nội bộ bị khóa 100%. | Blocker| [ ] |
| **TC-F16.13** | `US-05` | `Func` | **[Positive]** Tiếp nhận luồng bắn Notification nội bộ từ quản trị viên bậc cao Cấp F15 (Broadcast Tool) | 1. Quản Trị Hệ Thống Root F15 kích hoạt Broadcast System: "Bảo Trì Định Kỳ".<br>2. Account Merchant đang mở Website tiến hành giám sát Notification Nhấn. | - Dữ kiện thông báo đổ vào Inbox Thành công với Biểu Tượng Loa Hoặc "System/Announcement".<br>- Màu sắc hoặc Icon được phân mảng rõ ràng so với Event Transactional như tạo Sản phẩm, đơn hàng. | High | [ ] |
| **TC-F16.14** | `BR-02` | `DB` | **[Negative]** Tối ưu dọn rác System Storage Backend Cronjob (Hủy Tin Rác Cũ Quá 30 Ngày) | 1. Trực tiếp tiêm DB Table, cấy dòng Event Data tuổi đời Age Limit > 31 Days Read Status.<br>2. Chạy Lệnh Execute Script Cron Job Backend Daily. | - Bảng SQL Notification Delete cứng thông báo già cỗi để giải phóng Table Size. Tăng khả năng Load Mượt Index API Hệ Thống Tổng DB. | Medium | [ ] |
| **TC-F16.15** | `Empty` | `Logic` | **[Edge]** Tạo hình Bố Cục UI khi Không chứa Thông báo nào trong Database. | 1. Thiết lập 1 Tài khoản Database Trắng tinh phần Notification Component List Array.<br>2. Kích chuột hiển thị List Hòm Dropdown. | - Component giữ nguyên Border bao Layout.<br>- Khu vực chính cung cấp văn bản "You have no new notifications" - Đảm bảo Không vỡ mốc hay Render Crash White Screen Empty Array Của React. | Medium | [ ] |

### Hành Vi Sự Cố Nâng Cao (Hidden Edge Cases & Localization)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F16.16** | `US-02` | `Func` | **[Positive]** Cuộn trang phân luồng xử lý Fetch Dữ liệu Đáy (Infinite Scroll List) | 1. Dữ liệu chứa 30 bản tin chờ.<br>2. Mở List Dropdown Panel Notification, kéo thanh lướt Cuộn Scroll sát đáy Mốc 20 Tin. | - Backend móc Offset 20 tự gọi AJAX tiếp lô nội dung mới đổ Render dồn Mượt mà thêm 10 Tin còn lại. Tránh Block nghẽn Limit Tin Chặn. | High | [ ] |
| **TC-F16.17** | `WebPush` | `Edge` | **[Negative]** Tự động khôi phục luồng tin nhỡ Rớt Websocket Connection Ngầm (Re-polling Buffer) | 1. Cúp tạm ngắt mạng Network Interface, chờ 30 giây rụng kết nối Websocket.<br>2. Khôi Phục Kết nối mạng lại. Đồng thời, lúc rụng Server xả 2 Đơn Order ra Hòm. | - Dữ liệu luồng Web tự động kích hoạt Socket Reconnect bắt Polling Load trọn vẹn lại 2 Order lặn ngầm nhỡ hụt mất mạng, cập nhật Badge nhảy thông báo Chồng mượt. | Blocker | [ ] |
| **TC-F16.18** | `Logic` | `Sync` | **[Edge]** Cơ chế đồng độ Thông Báo Đa Cửa Sổ Trình Duyệt (Multi-Tab Ghost Syncing) | 1. Bật Trình Duyệt Mở Tab A và Tab B Trỏ Vào Giao diện của Đáy Dashboard (Unread = 5).<br>2. Ở màn Hình Tab A, Lệnh Execute "Mark All As Read". | - Thông điệp Cấu Hình React Store bắn qua Tab B bắt buộc thay đổi Unread = 0 (tự Động tắt màu Đỏ) mà không Bắt Người Dùng Gõ F5 Tải lại trang. Giảm thiểu báo ảo "Phantom Badges Lỗi". | High | [ ] |
| **TC-F16.19** | ` यूएस-05` | `Sec` | **[Negative]** Bảo vệ phòng chống tấn công Code độc hại XSS HTML Code Injection | 1. Xuyên từ cổng Root F15 soạn thông báo Broadcast System Script: `<script>alert('Fail')</script>`.<br>2. Người dùng Mở hòm Notification Ra List Độc Hạ. | - Parser Browser mã hóa chữ thô encode tuyệt đối các cú pháp tag lạ này. Rendering Text thô.<br>- Alert Hành Động Hack DOM JS Bị Tắt Im (Security Escape an Toàn 100%). | Blocker | [ ] |
| **TC-F16.20** | `PRD` | `Locale` | **[Positive]** Mapping giao diện Hệ ngôn ngữ Internationalization (Đa ngôn ngữ VI/EN/BM) | 1. Setting Config Language đổi Ngôn ngữ sang Bahasa Melayu (Mã BM).<br>2. Load Mảng Thông Báo có Dữ liệu Rỗng vào màn Hình Xem xét các Label Cứng. | - Các dòng Status Label như Text Nút cứng (Ví dụ "Mark all as read" -> "Tandai...") thay đổi phù hợp JSON file. Server Local Data Bám đúng Language Root. | High | [ ] |

### Hệ Thống Super Edge Cases (CSS Text Tràn, Giờ Timezone & Hoàn tác Cứng Chặn Optimistic)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F16.21** | `UI` | `Limit` | **[Negative]** Giới hạn phá lỗi vỡ Layout Dropdown List Tiêu Đề Cực Dài Text Tràn | 1. Input Thông Báo Quá Kích Cỡ có cấu trúc từ > 500 ký tự (Chấm không dải cách chữ).<br>2. Trưng Bày Đấu Form Panel UI Trên Header App View Bóp. | - CSS Layout List Chặt đứt giới hạn `text-overflow: ellipsis` chặn vỡ (Line clamp). Giữ cho Thông tin Badge TimeAgo Không móp Đè Khuất mắt dưới lốt văn bản chữ quá to che. | High | [ ] |
| **TC-F16.22** | `Logic` | `Sync` | **[Positive]** Xử lý luồng Múi Giờ Timezone Thời Gian Thực Local (TimeAgo Relative Display Offset) | 1. Chỉnh Múi giờ thiết bị cá nhân sang chuẩn Kuala Lumpur UTC+8. Database nhận Giờ UTC Mốc.<br>2. Kiểm Báo Bốc thời gian lúc Gửi Notification. | - Frontend Script Auto Convert Dịch Khung Time Về lại múi giờ Người Trải Nghiệm (Hiển thị "Just now"). Không Render sai lệch hiển thị lệch Giờ Tương lai Lỗi Hệ Thống Lệch Khung +8 Hours Xưa Sai Nhịp Vớ Vẩn. | High | [ ] |
| **TC-F16.23** | `UI/UX` | `Perf` | **[Negative]** Phục dựng giao diện ảo chặn Optimistic Update Fail Alert Rollback API | 1. Throttle Tool Block API `/mark-read` cấu hình HTTP Code báo 500 Fall Lỗi.<br>2. Client Bấm Button "Mark All". | - API chấn lỗi. Bắt buộc Cơ Chế FrontEnd Update Roll-Back lại nguyên UI trạng thái lúc cũ như lúc 15 Chuông chưa Gạt. Nổ lỗi Toast Báo Thử Lại. Không Lưu Nhầm Ảo Giả Dối Status Đã Đọc Mà Thực Chất DB vẫn chưa Sạch Cỏ Được. | Blocker | [ ] |
| **TC-F16.24** | `DB` | `Edge` | **[Negative]** Đụng trùng lặp Khóa Primary Component (Key Collision Duplicate React ID React Warning) | 1. Giả Hệ Thống Backend nhả nhầm Bắn List Notification Data JSON có 2 item Gống Điển ID 1 (VD `[id:1, id:1]`).<br>2. Bốc Render Danh Sách. | - Chạm Giới hạn Code Trải Nghiệm React Map báo Unique. Hệ Filter Lọc Data Trùng chặn 1 dòng. Danh sách Panel Chỉ Bày 1 Component 1 Card tin 1. Lọc Drop Lỗi Cứng Sụp Màn Hình White List Error Xuyên. | Blocker | [ ] |
| **TC-F16.25** | `Sec` | `WSS` | **[Negative]** Rò rỉ Kẽ chặn Lỗ hỏng Bức Tường Lửa WebSocket API Kết Cấu Chui Lệnh Vượt Rào (UnAuth Bypass Server Sub) | 1. Post Script Trọc Script Lộ Websocket `wss://api.antigravity.app/rt` nhưng Gửi Đề Không Nạp Xác Thực Authorization Token Nằm Gắn Root Session.<br>2. Giả Subscribe Kênh Notification Vủa Kẻ Shop Khác Quăng Giờ Đọc Tin Nội Bộ Nhỏ Ra Ngoài. | - Chóp Firewall Hand-shakes Kết Cấu Websocket Đóng Lụi Reject HTTP/WSS status Lửa (Code `401 Unauthorized`). Khóa Vạch Không Nhả Tí Lượng Payload Data Shop Thông Qua Ra Bên Ngoài Băng Rút Mất Trắng Dòng Transaction Vực DB Của App Vọt Đi. | Blocker | [ ] |
| **TC-F16.26** | `UX` | `OSPush` | **[Negative]** Giới hạn chống Rác Spam Alert Native (Collapse Desktop Pushes Gom Dồn 1 Nhịp Dồn Text Hú Âm Dội Cứng Áp Màng OS) | 1. API nhả lệnh dội 50 Event Liên Hồi.<br>2. Lướt Xem Màng Hệ Điều Hành Win/Mac Nắm Rút Loa Chuông Bắn Về Tải Tiếc Báo Push Đâm Giao Trận Tới Liên Hoàn Tiết Nhịp Cực Kỷ Gây Quán Spam Thính Cơn Giội Chối. | - Chuẩn Cờ API Browser Push tag System Collapse. Chỉ Pop-up Thông báo Ngọn Độc Lập Nắm Đuôi Card Gom Móc "You have X new notifications", Hủy Spam Chặn Dội 50 Card Đè Kín Bít Tab Cứng Native Góc Kích Rối CPU Lấp Nhấn Nháy Báo. | High| [ ] |
| **TC-F16.27** | `Flow` | `Nav` | **[Edge]** Hành Vi Lỗi Chạm Luồng Thông báo Hỏng Điều Hướng Link Sang Target Bị Xóa Mất DB Rác Cũ Tồn Trong Drawer List Notification Chết URL 404 Cảm Rỗng Ràng Lạc Lối Nháp Thường Tích Hợp Error Boundary. | 1. Action Bấm Chuông Chọn 1 Event Tạo Sản Phẩm Lưới `Prod A`.<br>2. Đồng Sự Trong Kho F08 Thao Tác Vào Bảng F14 Drop `Prod A` DB Dứt Nét Căn Bãi.<br>3. Điều Hướng Sẽ Bắn Nát Target Khóa Cứng Rỗng Trơn Mảng View Xoay React Crash Chết Nổi? | - Điều Hướng Tuyệt Đối Mượt Về `/products/NotFound` Hiện Trang Phủ Text "Mục Nay Không Tồn Tại Bốc Lướt 404 Mềm". Đồng Thời Status API Nhận Xả Notification Dòng Nháy Kia Đã Đổi Read Mark Đọc Lướt Bảng Drop Panel (Tuyệt Không Nhấn Đi Cùng Quái Loading Giữa Màn Lạc Crash Tree Độc Trắng Đáy Xuyên Tức Thấm Bug Dập Node Lệch System App Lỗi). | Medium | [ ] |

---

## 4. Hành trình Trải nghiệm Cơ Sở (E2E UAT Flow)
_Mô tả hoạt động quản trị của Merchant khi kiểm soát trạng thái Notification._

1. **[E2E Flow - Quản Lý Phiên Đa Công Việc]:** Hệ thống nhận luồng thông báo Realtime đơn hàng (1 Toast xuất hiện). Chủ Shop đang mở giao diện Mobile Web và giao diện Desktop mở trang song song. Ngay trên PC Desktop, User mở Dropdown List để click Đọc Dòng Đơn.
2. **[E2E Flow - Xóa Dấu "Phantom"]:** Tại điểm click, hệ API báo trạng thái `"mark-read"`, Badge nhảy con số trả 0. Cơ chế Sync chạy kết nối Polling báo hiệu về trang Mobile song song cùng thời điểm tự trượt giảm Badge = 0 tự động, chấm lại chu trình Notification một cách thống nhất trên đa luồng thiết bị.
3. **[E2E Flow - OS Background App Limit]:** Khi trình duyệt lặn chạy dưới gầm Background, OS Web-push tự kích nổ Box thông báo của Hệ điều hành. Khi Host nhấp vào, giao diện tự bung focus sáng bật tab Chrome đang đứng trên Console Quản trị App PrimeWeb.

---

## 5. Tiêu chí Đánh giá Chất lượng Đo Lường Cuối Cùng (Quality Gates)

| Nhóm Đánh Giá (Criteria) | Trạng Thái | Yêu Cầu Chốt Release |
|---|---|---|
| **1. Trải Nghệm UX Limits/Mobile** | [ ] Not Run | Icon/Badge Layout Mobile View 375px Cân Xứng, Load Infinite Scroll ổn định. |
| **2. Tường Lửa Bảo Mật (RBAC / Websocket)** | [ ] Not Run | Phân quyền DB Role Đọc Chặn Khóa. Cấm Connection WSS Bypass Token Giám Sát Realtime Khống. (Vượt Pass Bắt Buộc) |
| **3. Luồng Quản Lý Timeout Đứt Đoạn Lưới Socket** | [ ] Not Run | Retry Logic Web-push Socket Lấp Đầy Vực 30s. Offline Thử Thách Thành Cáo Lỗi Và Load Bù. |
| **4. Các Kẽ Phân Tách Nghẽn Spam Traffic (Spam Limits)** | [ ] Not Run | Debounce/Group Lại API Toast Nhá Hàng. Chống System DDoS Client Xả Card Đè Vỡ Chrome DOM Gây Tàn Đột. Gạc Lọc Cache Optimistic Render Đèn Xanh Lướt Vội Của Phím Bấm Chặn Limit Xoáy Đáy Bằng Tích "Đã Đọc Báo Giả". |
| **5. E2E UAT Phủ Phê Duyệt** | [ ] Not Run | Sign-off P0 Blockers cho Dòng Redirect Xóa Links Hụt Tận Và Phantom Badge Tabs. |

> **Khuyến Nghị Release Đối Vấn Đề Q.A Report**: Tính Năng Websocket Là Cơ Sở Gây Đội RAM Nhịp Đập Vượt Limit Socket Backend. Test Focus Case Phá Mã Connection Kẽ Hở (TCP Auth) Chặn Khách Hút Trộm Tải Đơn Notification Nhịp Không Quyền. Phân Loại Tích Tick Xanh Các Mức "Blocker" DB Socket Cho Qua Là Trái Tim Đúc Release Version Center Thông Số Này!
