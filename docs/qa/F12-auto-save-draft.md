# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F12 - Auto-Save & Draft
> **Phiên bản:** 1.0 | **Cập nhật:** 2026-03-25 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F12-auto-save-draft.md`), User Stories (3 ACs), Figma Design (Toolbar Indicator)
> **Kỹ năng ứng dụng (.agent):** BDD (Gherkin Expectations), Performance SLA Validators, Security Contexting, Automation Locator Healer, Payload CMS DB Assertions.

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case này được xây dựng nhằm đảm bảo chất lượng toàn diện cho tính năng Auto-Save & Draft. Mục tiêu cốt lõi là đạt độ phủ (Coverage) 100% cho 3 User Stories, bao quát chính xác **3 Acceptance Criteria (ACs)** đã định nghĩa tại tài liệu đặc tả và các yêu cầu từ bản thiết kế Figma hiện tại.

Bộ kiểm thử bao gồm **15 kịch bản chi tiết** (Positive + Negative edge cases). Toàn bộ kịch bản được tổng hợp trong Unified Matrix.
---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production |
| Browsers | Chrome (v110+), Firefox (v105+), Safari |
| Devices (Responsive) | Desktop (1920x1080), Mobile (iPhone 14 Pro 375px) |
| Test Data & SLA | Network Throttling, Offline Mode Simulation, Typing Speed Simulation |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU (Steps & Test Data) | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-F12-01: Auto-Save debounce 3s & Manual Save]** |
| **TC-F12.01** | `US-01 / AC-1` | `Func` | **[Positive]** Auto-save ngầm kích hoạt sau 3s dừng thao tác | **1.** Mở Editor.<br>**2.** Gõ thêm text vào khối (isDirty = true) rồi buông tay không sửa nữa. | **GIVEN** Sửa content **WHEN** Đợi 3s không thao tác **THEN** Nhãn UI Status đổi sang "Saving..." kèm Spin -> Gọi API `PATCH /api/pages` -> Trả về mượt "Saved just now". | Blocker | [ ] |
| **TC-F12.02** | `US-01 / AC-1` | `Perf` | **[Negative]** Chặn nghẽn mạng spam API khi gõ text liên tục (Debounce Test) | **1.** Viết Script Bot gõ input text liên tục không ngừng nghỉ suốt 30 giây.<br>**2.** Soi Network Tab. | KHÔNG ĐƯỢC bắn bất kỳ Request API `PATCH` nào lên DB trong 30s. Chỉ gửi đúng 1 lệnh duy nhất sau khi Bot ngưng gõ hoàn toàn 3 giây. | High | [ ] |
| **TC-F12.03** | `US-01 / AC-2` | `Func` | **[Positive]** Lưu thủ công xuyên Timer (Manual Save Override) | **1.** Sửa 1 text block.<br>**2.** Trực tiếp ấn tổ hợp phím `Ctrl+S` (Wind) hoặc `Cmd+S` (Mac) chỉ sau 1s. | **WHEN** Bấm phím lưu **THEN** Override (xóa) timer 3s của Debounce. API chọc NGAY LẬP TỨC lên server. Kèm theo Toast màu xanh nổ lên "Saved!". | High | [ ] |
| **TC-F12.04** | `US-01 / AC-2` | `Perf` | **[Negative]** Hạn chế Spam Bơm nút Manual Save | **1.** Bấm đúp phím `Ctrl+S` chớp nhoáng 10 lần trong vòng 2 giây. | Hệ thống sử dụng Back-pressure Request: Gạt đi 9 nhịp trùng, chỉ cho 1 Request đơn lẻ vượt ống Pống. Frontend không bị sập cứng Đơ màn hình. | Medium | [ ] |
| **TC-F12.05** | `PRD / FR-08` | `Logic` | **[Edge]** Lưới chắn đóng Tab rơi dữ liệu (Browser Dialog `beforeunload`) | **1.** Thêm Image mới (isDirty=true).<br>**2.** ẤN (X) ĐÓNG NÓNG TAB CHROME ngay khi UI chưa hiện "Saved" trong chu kỳ 3s. | Chrome DOM phải lập tức đóng băng, tạt Pop-up rào lại: "Leave Site? Changes you made may not be saved" để giữ tay User khỏi sự cố ngoài ý muốn. | Blocker | [ ] |
| **[US-F12-02: Draft Recovery]** |
| **TC-F12.06** | `US-02 / AC-1` | `Func` | **[Positive]** Khôi phục Load đúng bản Draft mới nhất sau khi ngắt trình duyệt | **1.** Edit nội dung háp -> UI xác nhận "Saved just now".<br>**2.** Tuyệt đối KHÔNG ấn Publish. Đóng hẳn Browser Window Chrome.<br>**3.** Mở lại trình duyệt, vào lại `editor/:siteId`. | **THEN** Backend GET Data dò logic `isDraft = true` khớp mã thời gian gần nhất. Layout ném ra hình hài Edit dở khuyết ban nãy (Giữ trọn vẹn chứ không trượt). | Blocker | [ ] |
| **TC-F12.07** | `PRD / BR-02` | `Logic` | **[Negative]** Giới hạn hiệu lực rụng Draft DB sau 24h vòng đời | **1.** Cài Mock DB lưu Draft từ >26 giờ trước.<br>**2.** User truy cập lại Editor Board. | Logic khắt khe Backend chặn rác -> Xóa / Từ chối Fetch bản nháp rỗng cũ. Trả về đúng bản Published chính thống bảo vệ Integrity trang. Cảnh báo quá hạn. | Medium | [ ] |
| **[US-F12-03: Mobile Web UX — Compact Auto-Save Indicator]** |
| **TC-F12.08** | `US-03 / AC-1` | `UI/UX`| **[Positive]** Hiển thị chế độ CSS Icon-Only gọn trên Mobile (< 768px) | **1.** Bóp Cửa Sổ Trình Duyệt thu hẹp Viewport xuống 375px (iPhone).<br>**2.** Sửa text để Save chạy. | Selector Span Text "Saved just now" rơi thẳng trạng thái ẩn (`display: none`). Toolbar chừa lại duy nhất biểu tượng Icon Mây Checkmark chớp báo mượt. | Trung bình | [ ] |
| **TC-F12.09** | `US-03 / AC-1` | `UI` | **[Negative]** Tránh bể/đùn khối Layout nút Cụm Toolbar | **1.** Ép hiển thị luồng Loading (Icon tròn Spin xoay) trên màn hình 375px cực bé.<br>**2.** Check soi kỹ label CTAs ([Publish], Dropdown). | Bố cục Layout Flex/Grid ổn định tuyệt đối -> Chữ CTAs không bị rớt xuống dòng, che lấp lún text tạo U-gò lởm chởm do diện tích Loading chiếm dụng vô duyên. | High | [ ] |
| **[Network Exceptions \& Error Handling (Retry Backoff)]** |
| **TC-F12.10** | `PRD / FR-05` | `Edge` | **[Negative]** Rớt Mạng Trigger Auto-Retry ngầm hồi sinh (5s, 10s) | **1.** Cài Network Option DevTools: `Offline` ngay khi bộ đếm 3s Save nổ.<br>**2.** Đếm giờ và quan sát Tab Network ném lỗi. | UI Tắt Spinner -> Trả Alert Check đỏ "⚠️ Not saved". Editor tự âm thầm gửi lại gói PATCH API chuẩn xác vào mốc Nhịp +5s và Nhịp +10s sau khi đứt. | Blocker | [ ] |
| **TC-F12.11** | `PRD / FR-06` | `UI` | **[Negative]** Kiên nhẫn Retry vượt mốc bế tắc Limit >3 Lần | **1.** Thả trôi không cắm cáp mạng Offline vĩnh viễn.<br>**2.** Quan sát qua mức cố nhịp Retry 3 (+20s Cuối). | Ngưng rải Retry cứu hộ. Lập tức Drop Cờ -> Rớt hẳn một dải Banner Cứng Dính Nền chữ Đỏ: "Changes not saved. Check connection." Buộc User chú ý thao tác lại. | High | [ ] |
| **[Security & Concurrency Edge Cases (Hiểm họa ngầm)]** |
| **TC-F12.12** | `Sec` | `Sec` | **[Boundary]** Hết hạn Token (401 Unauthorized) khi đang Auto-save | **1.** Đang ở màn hình Editor (isDirty=true).<br>**2.** Mở Tab khác ấn Đăng XUẤT (Hoặc xóa HTTPOnly Token gốc).<br>**3.** Đợi 3s cho Auto-save chạy. | Server từ chối `HTTP 401`. UI KHÔNG ĐƯỢC retry mù quáng để xả DDoS. Phải hiện Popup cản màn hình: "Phiên đăng nhập hết hạn", yêu cầu log-in lại tại chỗ, tuyệt đối không refresh làm mất data. | Blocker | [ ] |
| **TC-F12.13** | `Data` | `Logic` | **[Negative]** Auto-save khối Payload Rỗng (Empty Content) | **1.** `Ctrl + A` hoặc bấm phím DEL xóa SẠCH TOÀN BỘ blocks (Về 0 Component).<br>**2.** Dừng tay 3s cho Auto-save bắt. | Payload `blocks: []` gửi đi thành công mà CMS không nổ bug crash API (Validation). Web chỉ lưu thành 1 trang trống trắng trơn. | High | [ ] |
| **TC-F12.14** | `DB` | `Perf` | **[Edge]** Đụng độ Race Condition 2 luồng Auto và Manual Save | **1.** Set mạng throttled (Slow 3G). Viết text chờ mốc 3s (Auto-Save đang *Pending*).<br>**2.** Lập tức Bấm đúp `Ctrl + S`. | Router nhận Request 2 đánh sập Request 1 (Cancel Token Axios) hoặc Xử lý đồng bộ DB. Không văng lỗi dội Version ID Data Mismatch hay Deadlock Database CMS. | Blocker | [ ] |


---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)
_Mô tả kịch bản kiểm thử dựa trên hành vi tổng thể của Website Owner tham gia hệ thống Editor._

**Kịch bản E2E Cấu Trúc:** 
1. **[E2E Flow] Giữ Tay Chống Văng Không Rớt Mạng - Test Cảnh Quản Khôi Phục Liền Mạch:** User đang Build Web Tưng Bừng -> Thêm chèn cục Header Image (Mọc Cờ isDirty=true) -> Nghỉ Ngơi Gõ Delay Khoảng 3 giây trôi qua để Tool ngầm nhức UI chớp báo Mây "Saved..." -> Đột ngột Rớt Wifi chập chờn -> Tool Toolbar báo đỏ Lập lòe Nháy tự khơi Mào lệnh Retry ngầm 1 Nhịp nhưng Vẫn Mất Kết Nối Rụng 100% -> Chán nản User Cay Cú Rê Chuột (X) Đóng Sập Trình Duyệt Tab Editor Bỏ Đi Nấu Cơm -> DOM Kháng chèn cứng Native Dialog Cảnh báo Rời trang hỏi móc lại: "Leave Site? Bị Rụng Data Ráng Chịu" khiến khách giật mình chọn "Cancel" Ở lại Đợi Mạng. Vài Tuần Sau Quay Trở Lại Truy cập -> Server Đón Lệnh Auth, Móc Nối Bắt Load DB Trả Gọn File Draft Dạng isDraft=true lên lại Ngay Ngắn. Khối Header Image còn kề trên Web Gọn Trơn Ko thiếu 1 dòng mầu HTML, chưa Push Ra Thằng Link Public Chữ Chuyên Báo Cấp Live Gây Sập Khách Lạ Xem.

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes & Rules .Agent Trích Chọn) |
|---|---|---|
| **1. UI/UX Coverage** | [ ] Đã chạy 0/2 TC | Layout Icon Only Mobile Toolbars |
| **2. Logic & Functions** | [ ] Đã chạy 0/5 TC | Khắc Lõi Mở `BDD Cucumber Agent` Gắn Expected luồng Data Cứng |
| **3. Edge Cases & Retry** | [ ] Đã chạy 0/3 TC | Bóc Tách Mock Mạng Ngắt Wifi Kích Retry Auto Dữ Đội Giới |
| **4. Performance SLA** | [ ] Not Run | Kéo `Performance Load Tester Agent` Set Rate Limit Limit Vùng Data |
| **5. E2E UAT Approval** | [ ] Not Run | Chốt Test File Mạch Core Khó Vỡ Này P0 Trước Khi Cho QA Đẩy Bản Prod Ký Xong. |

> **Khuyến Nghị Release:** Các Nhóm Case Timeout Lỗi Mạng (Network Retry Drop Cờ Red Array Backoff) và Tab Hook Khống Chế Điểm Văng Rời Trang (`beforeunload`) vô cùng quan trọng cấm lơi là, Rất dễ Bug đè mất Data khách điên cuồng sinh Ticket chửi rủa Cấp độ nghiêm trọng 1. Yêu cầu QA chạy đủ Auto Suite Mock Tool ngắt mạng không trượt phát nào.
