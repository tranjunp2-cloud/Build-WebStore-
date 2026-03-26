# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F16 - Notification Center
> **Phiên bản:** 1.0 | **Cập nhật:** 2026-03-25 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F16-notification-center.md`), User Stories (8 USs), Báo cáo Phân Tích Hiện Trạng
> **Kỹ năng ứng dụng (.agent):** BDD (Gherkin Expectations), Performance SLA Validators, Security Contexting (RBAC), Mobile UX Evaluator, Flaky Test Shield.

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case này được xây dựng nhằm đảm bảo chất lượng toàn diện cho tính năng Notification Center. Mục tiêu cốt lõi là đạt độ phủ (Coverage) 100% cho toàn bộ **8 User Stories**, bao quát chính xác mọi **Acceptance Criteria (ACs)**, các quy tắc bảo mật (Role-based Analytics), hiệu năng nghẽn luồng (Realtime Spam), và các điểm giới hạn biên (Boundary/Equivalence). 

Bộ kiểm thử bao gồm **24 kịch bản chi tiết** (Positive + Negative edge cases). Tuyệt đối chặn đứng nguy cơ rò rỉ quyền dữ liệu và sập RAM rớt giao diện.
---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production |
| Browsers | Chrome (v110+), Firefox (v105+), Safari, Edge (Check Web Push API) |
| Devices (Responsive) | Desktop PC (1920x1080), Mobile (iPhone 14 Pro 375px) |
| Test Data & SLA | Scripts giả lập bắn 50 Orders/s (Spam), Hệ User Profile Đa Phân Quyền (RBAC), Cron mock data > 30 ngày. |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU (Steps & Test Data) | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-F16-01 & US-F16-06: Unread Badge & Realtime Toast (Boundary & Stress)]** |
| **TC-F16.01** | `US-01 / AC-1` | `Boundary`| **[Positive]** Phân vùng biên hiển thị Unread Badge (0, 1, 99, 100) | **1.** Call API Set Số lượng chưa đọc theo các giá trị biên: `0, 1, 99, 100, 150`.<br>**2.** F5 trang quan sát Icon Chuông. | Khi = 0: Ẩn tịt Badge.<br>Khi mốc 1 -> 99: Hiển thị đúng số đếm.<br>Khi = 100 hoặc 150: UI chỉ hiển thị chốt chặn chuỗi max `"99+"`. Không bị tràn khối đỏ. | High | [ ] |
| **TC-F16.02** | `US-06 / AC-2` | `Perf` | **[Negative]** Spam Events - Xử lý dội bom Realtime DDoSer | **1.** Bơm Script Backend xả liên hồi `50 Event Đơn hàng` trong 1 giây xuống Websocket của 1 User đang Online. | **EXPECTED**: Hệ thống Gom Nhóm Popup Toast (VD: "Có 50 đơn hàng mới..."), KHÔNG nổ bong bóng 50 nốt đè kín lấp giao diện gây Cash Tab. Số Unread Badge tự trượt lên đúng +50 mượt mà. | Blocker | [ ] |
| **TC-F16.03** | `US-06 / AC-1` | `UI/UX`| **[Positive]** Vòng đời Toast Thông Báo Góc Dưới (Tự diệt 5-7s) | **1.** Kích 1 Notification từ Server xuống User.<br>**2.** Đứng nhìn, Không Click rê chuột cản trở. | Toast nổi hất bọc góc phải dưới (Z-index Top), không che lấp Input thao tác. Tự động Fade-out bốc hơi mất dạng sau 5-7s theo chuẩn vòng đời. | Medium| [ ] |
| **[US-F16-02 & US-F16-08: Dropdown List & Mobile View Mobile]** |
| **TC-F16.04** | `US-02 / AC-1` | `Limit` | **[Positive]** Phân trang Danh sách & Phân biệt UI Trạng thái | **1.** Cấy DB 30 thông báo (20 Chưa Đọc, 10 Đã Đọc).<br>**2.** Bấm Chuông mở thả Dropdown Panel. | Query SQL API Sorting: Chỉ nhả khung hiển thị vỏn vẹn 20 dòng trên top chóp mới nhất (Newest).<br>Thẻ Đã Đọc text Xám. Chưa Đọc chấm Xanh đậm In Đậm chữ. | High | [ ] |
| **TC-F16.05** | `US-08 / AC-1` | `Mobile`| **[Positive]** Mobile Web hiển thị dạng khui Bottom Sheet vuốt | **1.** F12 đổi Size Màn về Mobile 375x812px.<br>**2.** Tap Chuông Header giả lập chạm ngón. | UI Đập đi Layout Thả Lửng lơ trên mây -> Trượt lên một màn Bottom Sheet Full Screen rộng chân. Item Click mập mạp bự chạm dễ dính, Nút "Mark All" hiện to khỏe ngang ngực. | Blocker| [ ] |
| **[US-F16-03 & US-F16-04: Actionable Links & Nút Mark All As Read]** |
| **TC-F16.06** | `US-03 / AC-1` | `Func` | **[Positive]** Click Dòng Item có Gắn Link (Điều hướng sang ngang) | **1.** Click chuột nhấp thẳng vô khung thông báo "Đơn Hàng Mới #999" (Unread màu xanh). | Gọi Router đổi Component `orders/999`. API `mark-read` đâm ngầm -> Cờ xanh rụng đi xỉn xám mờ mịt -> Unread Badge Tự Trừ Đi 1 Cục Báo. | Blocker| [ ] |
| **TC-F16.07** | `US-03 / AC-2` | `Func` | **[Edge]** Click Dòng Item Tin Chết (Không gắn target Route) | **1.** Bấm vào tin hệ thống text cứng mộc (Ví dụ: Server Bảo Trì Cuối Tháng) rỗng action. | Tin rụng màu xanh chuyển "Đã đọc", Badge Drop 1. Tuyệt đối KHÔNG bị Redirect chéo lung tung hay Reload gây khựng Form công việc. | Medium| [ ] |
| **TC-F16.08** | `US-04 / AC-1` | `Func` | **[Positive]** Sát thủ Click Dập "Mark All As Read" Toàn Cảnh | **1.** Chừa lại 15 hột tin unread.<br>**2.** Bấm chùy "Mark All As Read" ngay đỉnh khay Panel. | Toàn bộ 15 hạt xanh Blue bị Triệt Tiêu quét trơn luột Form -> Lính Unread Badge Tắt ngủm đỏ -> Rụng bắn API POST `mark-read: "all"`. | High | [ ] |
| **TC-F16.09** | `US-04 / AC-1` | `Logic` | **[Negative]** Chặn thao tác "Mark All Khi Không Có Đạn Rỗng" | **1.** Tắt sạch tin nhắn chờ (Badge = 0).<br>**2.** Banh hòm Dropdown nhìn dòm nút đó. | Label Nút Text "Mark all as read" ngáp mờ Disabled Xám (`Pointer-events: none`). Tránh User spam API dội xuống Backend ngáo ngơ. | Low | [ ] |
| **[US-F16-07: Browser Native Web-Push Notifications OS Base]** |
| **TC-F16.10** | `US-07 / AC-1` | `Flow` | **[Positive]** Kịch bản Flow Xin Quyền System Cứng (Opt-in Tab) | **1.** Trắng Account Truy cập lại Reset Permission Cookie.<br>**2.** Chờ Hệ Thống Nhả Toast. | Nổ Native Alert Pop Trình "ngantigravity.app muốn bắt quyền notification -> Allow / Block". Nếu Allow -> DB Lưu User đã Cấp quyền. Set Cờ bật PUSH đạn. Bấm Block -> Nằm im chặn đứng dằn ngọn. | High | [ ] |
| **TC-F16.11** | `US-07 / AC-2` | `Func` | **[Edge]** Còi Native Nổ Khi Tab Web Rúc Thu Nhỏ Dưới Gầm (Background) | **1.** Cờ Push True. Cất trình Antigravity thu Minimize hoặc lướt fb Tab Khác.<br>**2.** Admin đẩy Notification lệnh khẩn. | CÒI HÚ! Native Card của Windows/MacOS nổi Góc PC Báo hiệu. Kích chuột móc Card -> OS Dịch lật trang nhảy Focus soi sáng về lại Tab Browser chứa App Antigravity móc đúng target. | Blocker| [ ] |
| **[Security (RBAC Leakage), Integ-F15 & Database Crontab Lỗ Hổng Nặng]** |
| **TC-F16.12** | `BR-01` | `Sec` | **[Negative]** Chống Rò Rỉ Quyền Đọc (Permission Data Bypass Scope) | **1.** Login Acc Nhân Viên Viết Content (CẤM xem Cột Orders/Trần Quyền).<br>**2.** Bot Cửa Ngoài Đẩy Đơn Hàng Mới Giá Khủng Đâm Hệ Thống F10. | **Tường Bảo Mật Lên Móng**: Filter Role chặn khít Router. Chuông của tài khoản Employee NÀY Tuyệt Đối Không Rung, Dropdown TRẮNG TRƠN, Toast Bị Xóa Ngắn. Cấm rò rỉ đơn hàng ảo dội sang ngạch cấm. | Blocker| [ ] |
| **TC-F16.13** | `US-05` | `Func` | **[Positive]** Móc Lệnh Thu Phát Tin Của Chóp Cấm Vệ Admin (F15) | **1.** Super Admin Tool F15 rải lệnh Send Broadcast "Tết Sale Rớt Đáy".<br>**2.** Owner Store Đứng Chờ Cửa Chuông CMS Của Mình. | Notification Lọt khe thành công với Tem Nhãn "System/Announcement" (Loa/Logo Server). Khác Biệt Loạn so với Đơn hàng màu xanh thông thường. | High | [ ] |
| **TC-F16.14** | `BR-02` | `DB` | **[Negative]** Chạy Áy Crontab Xóa Bản Tin Mụ Mục Nát Sau Dải 30 Ngày Sàng | **1.** Trỏ DB Tool nhét 1 Thông báo Age > 31 Days Read Status.<br>**2.** Thổi Node Cron Job Quét qua hòm Thư Backend xoay tua rọn. | Rác Thừa Ra Bị Hard Delete Bốc khói Cháy Cạnh DB Khá Cương Đoạn (No Soft Delete rườm rà). Kho Table Notification Không Bị Dội Index Size ngàn triệu nhịp treo Server Ổ Cứng. | Medium | [ ] |
| **TC-F16.15** | `Empty` | `Logic` | **[Edge]** Dựng Form Trống Rỗng Nghệ Thuật (Khay Chưa Có Gì Khai Báo) | **1.** Khám Account Trắng tinh không dính hạt Database Table nào đổ lọt Notification.<br>**2.** Khui Hòm Click Chuông soi thử bụng list. | Card Dọc Cấm Vỡ Form Layout. Rải UI Empty Placeholder Text Dễ Thương: "You have no new notifications" Bày ngay tâm lõi ruột Trắng tinh rách đẹp (Không quăng Error Trắng). | Medium | [ ] |
| **[Luồng Lỗ Hổng Ẩn (Hidden Edge Cases) - QA Extracted]** |
| **TC-F16.16** | `US-02` | `Func` | **[Positive]** Cuộn vô cực hoặc Nút Xem Tất Cả (Pagination Scroll) | **1.** Có 30 Thông Báo.<br>**2.** Mở Dropdown, lướt chuột kéo thanh Cuộn xuống tận đáy (Đáy của 20 mốc đầu). | DOM Trigger vớt thêm `Offset: 20` mượt mà (Infinite Scroll) hoặc xuất hiện Nút "View All" Load-more. Tránh việc User bị giam data không đọc được tin số 21. | High | [ ] |
| **TC-F16.17** | `WebPush` | `Edge` | **[Negative]** Chết Kết Nối Ngầm & Phục Hồi Socket (Websocket Drop) | **1.** Tắt Internet cục bộ, chờ 30s cho Socket Frontend mất kết nối rụng dây.<br>**2.** Cắm mạng lại. Server lúc nãy xả 2 Order. | Cơ chế Auto-reconnect Socket phải móc nối lại Polling và GET bù 2 đơn hàng bị rớt trong khe 30s mất mạng trên Badge. | Blocker | [ ] |
| **TC-F16.18** | `Logic` | `Sync` | **[Edge]** Đồng Bộ Hóa Đa Tab Đồng Thời (Multi-Tab Phantom Sync) | **1.** Mở **Tab A** và **Tab B** cùng trỏ vào Dashboard (Badge đang = 5).<br>**2.** Tại **Tab A**, click "Mark All As Read". | Dữ liệu React Store/Socket phải rải Cache sang **Tab B** tự động. Badge **Tab B** cũng phải rớt xuống 0 mà không cần User nhấn phím F5 thủ công. Chống "Phantom Badges" (Bug chuông ma ảo). | High | [ ] |
| **TC-F16.19** | `US-05` | `Sec` | **[Negative]** Tường Lửa Chống Tiêm Mã Độc HTML (System XSS Injection) | **1.** Admin mào Account F15 rải mảng Broadcast chứa Script Độc: `<script>alert('HACKED')</script>`.<br>**2.** Mở Dropdown. | Trình duyệt Escape An Toàn, in ra đúng Text thô `<script>` bằng Encode. Tuyệt đối Render KHÔNG cho thực thi Hàm Script nổ Alert bay màu Server Client. | Blocker | [ ] |
| **[Locale & Internationalization (Đa Ngôn Ngữ)]** |
| **TC-F16.20** | `PRD` | `Locale` | **[Positive]** Render chuẩn xác Đa Ngôn Ngữ (EN / VI / BM) | **1.** Chuyển đổi ngôn ngữ hệ thống sang Bahasa Melayu (BM).<br>**2.** Nhận 1 thông báo mới và mở Dropdown. | Các UI Text cứng (Tĩnh) đổi sang BM: "Tandai Semua Sudah Dibaca" thay vì "Mark all as read". Thông báo rỗng: "Tiada pemberitahuan baharu". Dữ liệu Đơn Hàng từ BE gửi xuống (Dynamic) cũng phải trả đúng Locale gốc của User. | High | [ ] |
| **[Super Edge Cases (CSS Overflow, Timezone & Optimistic UI)]** |
| **TC-F16.21** | `UI` | `Limit` | **[Negative]** Lỗi Tràn Text Phá Vỡ Layout Dropdown | **1.** Admin gửi Global Broadcast có Tiêu đề dài >500 ký tự không khoảng trắng.<br>**2.** Kích Mở Dropdown. | CSS Item phải chặn cứng `text-overflow: ellipsis` (thêm 3 chấm) hoặc `line-clamp: 2`. Tuyệt đối không làm phình Layout hay đè chữ lấp mất khung Thời gian (timeAgo). | High | [ ] |
| **TC-F16.22** | `Logic` | `Sync` | **[Positive]** Lệch múi giờ Timezone (UTC -> Local Offset) | **1.** Sửa Múi giờ máy tính thành Kuala Lumpur (UTC+8). DB lưu giờ theo UTC+0.<br>**2.** Load thông báo vừa được tạo. | Frontend bắt buộc Convert chuỗi Timestamp UTC sang Local Timezone. In ra "Just now / 1 min ago". Nghiêm cấm hiện số Cổ Xưa Sai Nhịp (+8 tiếng) hoặc số Âm (-480 mins ago). | High | [ ] |
| **TC-F16.23** | `UI/UX` | `Perf` | **[Negative]** Trả Trạng Thái Ảo (Optimistic UI Rollback Fail) | **1.** Chặn mạng giả lập API `/mark-read` trả báo lỗi HTTP 500.<br>**2.** Nhấn Nút "Mark All As Read". | UI giật mượt Badge về số 0 ngay -> Nhận lỗi API 500 -> BẮT BUỘC tự dội ngược Nhả lại mốc 15 Badge đỏ cũ (Rollback UI). Cấm lừa dối người dùng là đã đọc xong. | Blocker | [ ] |
| **TC-F16.24** | `DB` | `Edge` | **[Negative]** Đụng độ Mảng ID (Key Collision Duplication) | **1.** Gửi chặn 2 Notification Array Payload trùng hệt ID (VD: `[id:1, id:1]`) xuống Frontend.<br>**2.** Tải hòm List. | React Store Filter Unique Array ID, chỉ Render 1 dòng tin duy nhất. KHÔNG rớt lỗi *“two children with the same key”*, chống sập Component Dropdown khiến màn hình trắng bóc. | Blocker | [ ] |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)
_Mô tả kịch bản kiểm thử dựa trên hành vi thực tế của Merchant (Chủ cửa hàng) trong quá trình vận hành hệ thống đa nhiệm._

**Danh sách Kịch bản E2E Thực tế (Core E2E User Journeys):**

**E2E-01: Xử lý Đơn hàng Đa nhiệm (Multitasking Order Fulfillment)**
*  **Bối cảnh:** Chủ cửa hàng (Owner) đã cấp quyền nhận thông báo thiết bị (Desktop Browser Push) và thu nhỏ tab Chrome xuống thanh Taskbar để làm việc trên file Excel.
*  **Hành động & Phản hồi:** Một khách hàng đặt đơn thành công (F10). Hệ điều hành MacOS/Windows lập tức hiển thị một Native Push Notification. Người dùng nhấp vào popup native đó -> Trình duyệt OS tự động kéo Focus về lại màn hình CMS Antigravity. Tại đây, trên UI xuất hiện một Toast nổi lên (In-app Popup) báo "📦 Có 1 đơn hàng mới" trong 5s, đồng thời Unread Badge tăng tự động lên 1. User nhấp vào biểu tượng Chuông, thả Dropdown, nhấp tiếp vào mục mã đơn hàng chưa đọc (chấm xanh).
*  **Mục tiêu Xác nhận:** Action Click lập tức khử trạng thái Unread thành Read (Badge giảm về 0), DOM chuyển hướng mượt mà sang phân hệ `/orders/:id` để Owner xác nhận đóng gói đơn hàng mà không trải qua việc Load lại toàn bộ (Full-page reload).

**E2E-02: Quản lý Thông báo Hệ thống và Đồng bộ Đa Tab (Multi-tab Synchronization)**
*  **Bối cảnh:** Nhân viên quản lý kho đang mở đồng thời hai tab trình duyệt: Màn hình Sản Phẩm (F08) và Màn hình Đơn Hàng (F10). CMS Admin (F15) phát động một tin Global Broadcast: "Bảo trì Server 02:00 AM".
*  **Hành động & Phản hồi:** Dữ kiện Realtime đẩy thông báo đồng thời vào cả Tab A và Tab B (Badge cùng bật nhảy số lên +1 kèm Toast góc dưới). Tại Tab A, nhân viên click mở hòm chuông Dropdown và chọn thao tác "Mark All As Read".
*  **Mục tiêu Xác nhận:** Hệ thống tại Tab A ghi nhận API trạng thái Đã đọc, Badge quay về 0. Ngay lập tức, bằng kết nối Websocket/State ngầm, Badge ở đỉnh của Tab B cũng tự động xóa biến mất mà không yêu cầu nhân viên phải Refresh (F5) lại giao diện. Loại bỏ triệt để hiện tượng Bug "Chuông ma ảo" (Phantom Badges) gây khó chịu.

**E2E-03: Xử lý Tràn Dữ liệu trên Thiết bị Di động (Mobile Data Flood Handling)**
*  **Bối cảnh:** Chủ cửa hàng dùng điện thoại cá nhân (Viewport < 768px, iPhone 14) truy cập Dashboard vào buổi sáng. Qua một đêm, hệ thống ghi nhận dội về hơn 50 thông báo (đơn hàng mới, mức cảnh báo tồn kho thấp).
*  **Hành động & Phản hồi:** UI Icon chuông chốt chặn trạng thái hiển thị mốc Unread cao nhất là `99+`. Khi nhấn vào Chuông, thay vì thả một hộp Dropdown quá bé, UI trượt mọc lên (Slide up) rẽ thành cửa sổ Bottom Sheet full màn hình rất to và thân thiện cho việc vuốt chạm bằng ngón tay. User cào vuốt màn hình cuộn dọc liên tục chạm đáy biên 20 tin nhắn đầu tư.
*  **Mục tiêu Xác nhận:** Tính năng cuộn (Infinite Scroll) gọi API kích hoạt tiếp tục châm tải bù danh sách 30 thông báo cũ hơn không giới hạn làm gián đoạn trải nghiệm dò tin. Sau khi dò xong, User bấm nhẹ phím lớn "Mark All As Read" ngay trên Sticky header bar để làm sạch hộp hòm tin nhắn nhanh gọn trong một tác chạm.


---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes & Rules .Agent Trích Chọn) |
|---|---|---|
| **1. UI/UX Limit** | [ ] Đã chạy 0/4 TC | Mobile Bottom Sheet Drawer Và Empty State Cấn Không Hình Vi Rách Khung CSS |
| **2. Logic Phân Quyền Xuyên Lưới (Sec)** | [ ] Đã chạy 0/2 TC | **KHẮN ĐỊNH TEST TẦN BẬC CAO**: Rò Rỉ Đơn Cho Thợ Viết Lách Là Án Mạng DB Chéo Nát Trội. |
| **3. Màn Kịch Cổng Toast & Còi Đè Tệp** | [ ] Đã chạy 0/5 TC | Vỡ Còi Nhại System Pop Up Khung Drop Mặc Kẹt Toast Bám Đuôi Kẽ |
| **4. Hiệu Năng DB Tứ Giác Nghẽn API** | [ ] Đã chạy 0/2 TC | Set Bomb Rác 50 Order/1s Xem Form Rate Limit Frontend Đè Lag Cache Giật Tưng Chết Tab Không? |
| **5. E2E UAT Approval** | [ ] Not Run | Chốt Cột Dấu Tick Cho Quãng Sàng Lọc Toàn Diện Này Xuyên Gọt. |

> **Khuyến Nghị Release:** Việc test cơ chế Native Push trên Mac và Windows Khá Cồng Kềnh dễ gây Fallback Sai. Kèm Test cực sát sao vụ Account Phân Quyền Kẹt Hòm Không Thấu Quả Báo Tréo Thông Tin Khách Lạ, Bơm Bot Khóa Lại Tuyệt Tình Để Mở Sạch Route Không Kêu Còi Rỗng Bực Chủ Store. Lệnh Cho Đạt Tick Qua Lại Cung P1 Chốt Launching Sớm Nhất!
