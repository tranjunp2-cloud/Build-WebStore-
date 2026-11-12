# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F12 - Auto-Save & Draft
> **Phiên bản:** 1.0 (Kiểm thử chức năng lưu nháp tự động) | **Cập nhật:** 2026-04-06 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F12-auto-save-draft.md`), User Stories (3 ACs), Figma Design
> **Kỹ năng ứng dụng:** Kiểm thử Tự động (BDD Gherkin), Kiểm thử Luồng gián đoạn mạng (Network Exceptions), Kiểm tra Bảo mật Phiên (Session Limits) & Cấu trúc Dữ liệu Payload CMS.

---

## 1. Mục Tiêu (Objective)
Tài liệu cung cấp bộ kịch bản kiểm thử toàn diện cho hệ thống **Auto-Save & Draft (Lưu nháp tự động)**. Mục tiêu là phủ 100% cho 3 User Stories theo chuẩn Acceptance Criteria (ACs) đã quy định.

Trọng tâm kiểm thử đặc biệt nhắm đến các rủi ro hệ thống: đứt gãy kết nối mạng, nghẽn băng thông API (Rate Limit), mất đồng bộ dữ liệu giao diện (State Stale), và thao tác chỉnh sửa đồng thời trên nhiều thiết bị hoặc giao diện Tab khác nhau. Độ phủ bao gồm 17 kịch bản chi tiết.

---

## 2. Thông Tin Môi Trường (Test Environment)

| Thông số | Yêu cầu kiểm thử |
|---|---|
| Môi trường | Staging / Pre-Production (Áp dụng cho mọi tính năng thời gian thực) |
| Trình duyệt | Chrome (v110+), Firefox (v105+), Safari |
| Kích thước | Màn hình Desktop (1920x1080), Giao diện Mobile (375px) |
| Chuyên biệt | Network Throttling (3G/Offline), Tần suất nhập liệu cao (High Typing Rate) |

---

## 3. Ma Trận Kịch Bản Kiểm Thử (Traceability Matrix)

### US-F12-01: Bộ Đệm Thời Gian 3s (Debounce) & Tính Năng Lưu Thủ Công (5 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F12.01** | `US-01/AC-1` | `Func` | **[Positive]** Hệ thống kích hoạt lưu tự động sau 3 giây dừng thao tác | 1. Mở giao diện AI Editor.<br>2. Chỉnh sửa nội dung văn bản (đặt cờ trạng thái `isDirty = true`).<br>3. Dừng thao tác hoàn toàn trong 3 giây. | - Icon trạng thái chuyển từ tĩnh sang Loading "Saving...".<br>- Hệ thống gọi hàm API PATCH cập nhật dữ liệu.<br>- Khi hoàn tất, Label thông báo "Saved just now". | Blocker | [ ] |
| **TC-F12.02** | `US-01/AC-1` | `Perf` | **[Negative]** Chặn yêu cầu API chồng chéo khi nhập liệu liên tục | 1. Thực hiện kịch bản nhập liệu nội dung văn bản liên tục không ngừng nghỉ trong 30 giây.<br>2. Quan sát băng thông API qua thẻ Network. | - Hệ thống đình chỉ các yêu cầu cập nhật API trong quá trình nhập liệu.<br>- Gửi đi đúng **01 yêu cầu duy nhất** sau khi đã dừng thao tác hơn 3 giây. | High | [ ] |
| **TC-F12.03** | `US-01/AC-2` | `Func` | **[Positive]** Thao tác lưu thủ công bỏ qua thời gian đệm | 1. Chỉnh sửa một phân đoạn văn bản.<br>2. Trong vòng 1 giây, nhấn ngay tổ hợp phím thủ công `Ctrl+S` (Windows) hoặc `Cmd+S` (Mac). | - Bộ đếm giờ tự động 3 giây lập tức bị vô hiệu hóa.<br>- API cập nhật được gọi ngay về Backend.<br>- Hệ thống hiển thị rõ thông báo Toast "Saved!". | High | [ ] |
| **TC-F12.04** | `US-01/AC-2` | `Perf` | **[Negative]** Ngăn ngừa tình trạng spam quá tải bằng nút Lưu thủ công | 1. Liên tục kích hoạt tổ hợp phím `Ctrl+S` 10 lần với tốc độ cao trong 2 giây. | - Trình điều phối (Back-pressure) tự động loại bỏ 9 yêu cầu trùng lặp.<br>- Chỉ duy nhất 01 tín hiệu lưu được chuyển giao xuống hệ API Backend. | Medium | [ ] |
| **TC-F12.05** | `FR-08` | `Logic` | **[Edge]** Chặn đóng Tab trình duyệt đột ngột khi tiến trình lưu chưa kết thúc | 1. Kích hoạt thay đổi mới lên giao diện Editor.<br>2. Lập tức ấn `(X)` trên thẻ Tab Chrome lúc trạng thái vẫn ghi nhận "Saving...". | - Trình duyệt kích hoạt cảnh báo sự cố Native Dialog: "Leave Site? Changes you made may not be saved".<br>- Ngăn rủi ro thoát sai làm hụt dữ liệu đầu vào. | Blocker | [ ] |

---

### US-F12-02: Phục Hồi Lưu Nháp Từ Máy Chủ (Draft Recovery) (2 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F12.06** | `US-02/AC-1` | `Func` | **[Positive]** Phục dựng trạng thái bản Draft mới nhất khi đóng phiên làm việc nửa chừng | 1. Phát sinh thay đổi và nhận thông báo "Saved just now".<br>2. Không thực hiện việc "🚀 Publish", trực tiếp đóng hẳn trình duyệt.<br>3. Mở lại đường dẫn cấu hình trang `/editor/:siteId`. | - Backend tiếp nhận và đọc trả bản thảo lưu trữ dựa trên trạng thái `isDraft = true`.<br>- Bố cục trang giữ nguyên trạng thái chưa hoàn thiện trước lúc đóng mạng. | Blocker | [ ] |
| **TC-F12.07** | `BR-02` | `Logic` | **[Negative]** Thu hồi vòng đời Bản Nháp (Draft Limit) vượt quá hạn mức 24H | 1. Giả lập Backend mang một mẩu dữ liệu Bản Draft quá hạn lớn hơn 26 giờ đồng hồ.<br>2. Thực hiện truy cập Editor Board từ phía Client. | - Quy chuẩn Backend từ chối lấy Draft đã hết hạn.<br>- Hệ thống trình bày Bản cuối cùng đã Phát hành (Published State) thay vì cấu trúc soạn thảo rủi ro hỏng thời điểm cũ. | Medium | [ ] |

---

### US-F12-03: Trải Nghiệm Thanh Công Cụ Mobile UX Kích Thước Nhỏ (2 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F12.08** | `US-03/AC-1` | `UI` | **[Positive]** Tự động thu gọn cấu trúc hiển thị trạng thái (< 768px) | 1. Mở Cửa Sổ Trình Duyệt thu hẹp Viewport xuống 375px cực bé.<br>2. Chỉnh thay đổi khối ảnh. | - Văn bản label trạng thái "Saved just now" hoặc "Saving..." bị ẩn đi hoàn toàn.<br>- Trên Navbar chỉ hiện diện độc lập biểu tượng Icon Checkmark/Spin báo hiệu. | Medium | [ ] |
| **TC-F12.09** | `US-03/AC-1` | `UI` | **[Negative]** Khoanh vùng bố cục hiển thị tránh xô lệch biểu tượng xung quanh | 1. Giả lập nghẽn Delay Load nhằm neo Cụm Icon Spin xoay liên tục.<br>2. Test View 325px soi các nút hành động kề cận. | - Dữ kiện Toolbar Navbar ổn định.<br>- Icon không đẩy các Nút Lệnh CTA khác chênh dòng làm giao diện bị đùn biến dạng. | High | [ ] |

---

### Xử Lý Ứng Cứu Ngoại Lệ: Sập Kết Nối & Phiên Hết Hạn (Network Timeout) (5 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F12.10** | `FR-05` | `Edge` | **[Negative]** Tự động thực hiện lại lệnh (Retry) khi phát hiện mất kết nối API | 1. Vào bảng Network set mức `Offline` ngay tại giây tiến trình Gọi mạng `Auto-save` xuất kích.<br>2. Để yên không thao tác và quan sát. | - Giao diện hiển thị Alert Icon Lỗi đỏ "⚠️ Not saved".<br>- Hệ thống Editor tự lặp lại tiến trình Gửi Yêu Cầu (Retry) ở 2 mốc đệm: Trễ 5 giây và Trễ 10 giây. | Blocker | [ ] |
| **TC-F12.11** | `FR-06` | `UI` | **[Negative]** Treo báo hiệu cảnh báo sau khi thất bại hơn 3 mốc Retry | 1. Vô Mốc Offline cố định không dây.<br>2. Để luồng gọi vượt quá mức 3 Nhịp cho chót lỗi. | - Trình Client đình chỉ các chuỗi gọi Retry tiếp theo đè lên Database.<br>- Thả mảng Alert Header thông báo bền cứng: "Changes not saved. Check connection." Yêu cầu khách can thiệp. | High | [ ] |
| **TC-F12.12** | `Sec` | `Sec` | **[Boundary]** Xử lý luồng Error Token Phiên Làm Việc (401 Unauthorized) | 1. Tại Tab 1 Đang Chỉnh Sửa Dở Giang trang.<br>2. Tại Tab 2 Mở trang chủ rồi Bấm Nút Đăng Xuất Account.<br>3. Chờ Lệnh Auto-Save tại Tab 1 chớp xử lý chạy ngầm. | - Máy chủ Ngăn Quyền báo lỗi HTTP 401.<br>- UI tuyệt đối cấm xả vòng lặp Retry khống. Cần kích hoạt khung cảnh báo lớn: "Phiên đăng nhập hết hạn", yêu cầu Mật khẩu Ngay tại Vị trí Màn, Không Cho Browser f5. | Blocker | [ ] |
| **TC-F12.13** | `Data`| `Logic`| **[Negative]** Định hình gửi luồng Data Payload Trống rỗng (Blank Components) | 1. Xóa toàn bộ Data Blocks thuộc giao diện Editor (`Ctrl+A` > `Delete`).<br>2. Dừng tay chờ hệ thống bắt Timer Save Ghi nhận. | - API không văng bắt lỗi Validation Block trống. Backend thu nạp thông tin Payload Rỗng và đồng ý Save Layout "Trang Trắng Nguyên Sơ" cho User. | High | [ ] |
| **TC-F12.14** | `Logic`| `Flow` | **[Edge]** Chống Deadlock xung đột Auto-Save và Thủ Công cùng chạm vạch | 1. Mạng Throttled Chậm chờ 3s API Auto-Save văng lưới Chậm lửng lơ Request.<br>2. Không dừng chờ, tiếp tục tay Nhấn Cứng Nút Thủ công `Ctrl+S`. | - Cơ Chế Axios Cancellation tự nhận dạng vứt bỏ Request Tương Trùng Điển Hình. Lọc chỉ 1 Tiến Vào Backend Tránh Lưu DB Hỏng Cấp Version 2 Hướng Song Song. | Blocker | [ ] |

---

### Kháo Sát Luồng Chạy Liên Kết & Xung Đột Nhiều Tab (Concurrency Limit) (2 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F12.15** | `Flow`| `Flow` | **[Positive]** Auto-Save Đồng Biên Cùng Hành Động Undo F11 | 1. Khách Hàng chọn tính năng Lùi Nội Dung (Undo) trên một Card UI Hình ảnh.<br>2. Buông thao tác Chuột nằm đợi tĩnh 3 giây. | - Hành vi Lùi Về Undo bắt buộc Kích Hoạt Cờ thay đổi `isDirty=true`. Hệ Auto-Save phải Nhận và Push Dữ data Mốc Sau Undo này Ghi Vào Database để Không Trôi Quên Cấu trúc. | Blocker | [ ] |
| **TC-F12.16** | `Sec` | `Edge` | **[Negative]** Chặn quyền ghi đè Dữ liệu Cũ khi Người Dùng xử lý nhiều Tab cùng Mở | 1. Tại Cửa Sổ Trình Duyệt Chrome mở Song Ngang 2 Tab A và Tab B vô chung Phòng Edit Page Cũ.<br>2. Dùng Tab A gõ Dày Chữ, Quá Trình Load Lưu Chốt Bảng Vàng Hoàn Tất.<br>3. Chuyển Qua Màn Tab B Tĩnh (Giao diện Version Cũ Lạc Hậu) gõ Nhè 1 Chữ. | - Trình Mạng Tự Động Push Của Tab B Chạm DB Backend Bị Cảnh báo (Version Mismatch). Phương Tiện Request Chặn Đứng Khóa Quyền Sửa Khống. Bật Thông Báo: "Trang Của Bạn Thiết Cập Thay Đổi Phiên Làm Khác, Tiến Hành Refresh". | Critical | [ ] |
| **TC-F12.17** | `Flow` | `Edge` | **[Positive]** Undo xong sửa inline lại vẫn được lưu (GH-2084) | 1. Sửa inline tiêu đề Hero (A) → đợi Saved.<br>2. Bấm Undo (canvas reload).<br>3. Sửa inline lần nữa (B) → click ra ngoài → đợi Saved.<br>4. Reload editor. | - Payload lưu sau Undo luôn gửi `localeContent` (kể cả `{}`) để xoá bản ngôn ngữ cũ của A trong DB.<br>- Sau reload thấy B, không quay về A. | Blocker | [x] AUTO |
| **TC-F12.18** | `Flow` | `Negative` | **[Negative]** Edit inline không khớp field nào → báo lỗi, không hiện Saved (GH-2084) | 1. Canvas hiển thị nội dung khác với store (lệch bản).<br>2. Sửa inline rồi click ra ngoài. | - Toast lỗi "Couldn't save your edit"; không gọi lưu; canvas reload lại từ DB; trạng thái không chuyển "Saved". | Critical | [x] AUTO |


### Phân Quyền API Lưu / Xuất Bản (Role Check, #2092) (5 Cases)

| TC-ID | Ref | Loại | Tình huống | Các bước | Kết quả mong đợi | Mức độ | AUTO |
|---|---|---|---|---|---|---|---|
| **TC-F12.17** | `Sec` | `Sec` | **[Negative]** `PATCH /api/sites/:id/save` bị 403 khi staff role `custom` thiếu quyền `builder` | 1. Staff `custom` chỉ có quyền Orders, membership `active`.<br>2. Gọi PATCH save. | - 403 `Forbidden`, không ghi DB (`payload.update` không được gọi). | Critical | [x] AUTO |
| **TC-F12.18** | `Sec` | `Sec` | **[Negative]** `PATCH /api/sites/:id/publish` bị 403 khi thiếu quyền `builder` | 1. Như TC-F12.17.<br>2. Gọi PATCH publish. | - 403 `FORBIDDEN`, site không được publish. | Critical | [x] AUTO |
| **TC-F12.19** | `Sec` | `Sec` | **[Negative]** `DELETE /api/sites/:id/publish` (unpublish) bị 403 khi thiếu quyền `builder` | 1. Như TC-F12.17.<br>2. Gọi DELETE publish. | - 403 `FORBIDDEN`, site vẫn `published`. | Critical | [x] AUTO |
| **TC-F12.20** | `Sec` | `Sec` | **[Negative]** Membership `pending` / không thuộc tenant bị 403 ở cả 3 API | 1. Staff có membership `status: pending`.<br>2. Gọi save / publish / unpublish. | - 403, không ghi DB. | Critical | [x] AUTO |
| **TC-F12.21** | `Sec` | `Flow` | **[Positive]** Regression: owner / admin / editor / viewer / `custom` + `builder` (active) vẫn lưu & xuất bản được | 1. Đăng nhập các role trên.<br>2. Gọi save / publish / unpublish. | - Hành vi cũ không đổi (không 403 do role). | Critical | [x] AUTO |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)
_Trải nghiệm khách hàng cốt lõi cho vòng đời lưu trữ An Toàn._

1. **[E2E Luồng Tiêu Chuẩn]:** Người dùng tiến hành cập nhật Background Image trang Web. Hệ thống ghi nhận thay đổi (isDirty = true). Người dùng buông tay tìm ý tưởng mới trong 3 giây. Thanh trạng thái chuyển mượt từ "Saving..." sang "Saved just now".
2. **[E2E Xử Lý Cắt Rút Mạng]:** Sau quá trình chỉnh sửa, thiết lập môi trường Client mất mạng (Wifi Drop). Ngay khi bộ đếm hệ thống nạp request lên CMS báo Time-out, thanh Toolbar nhấp nháy Đỏ. Tiến hành chức năng Auto-Retry phục hồi trong mốc 5s và 10s. Nếu vượt mức kiên nhận, Panel đỏ hiển thị cảnh cáo người dùng trực diện.
3. **[E2E Lưu Lẫn Phiên Bản Tab Ngầm]:** Mở 1 trang Web khác song song và chỉnh sửa lỗi, hệ thống từ Server gửi luồng từ chối bảo vệ tệp DB đã Save vững trước đó tránh bị rác Tab ngầm ghi đè phiên bản lạc hậu.
4. **[E2E Bảo Toàn Load Nháp]:** Tắt ngang Browser nóng, hai ngày sau mở lại tài khoản, DB nạp trạng thái `isDraft = true` Load chuẩn Layout không mất dữ kiện Text nào.

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái | Ghi chú Trọng tâm |
|---|---|---|
| **1. Trải Nghệm Thao Tác Cơ Sở** | [ ] Not Run | Xác thực bộ đếm Debounce 3s, Hotkey Manual Crtl+S, Browser Dialog Prevent Close |
| **2. Layout Compact Mép Di Động** | [ ] Not Run | Auto Hide Văn Bản Label 325px, Giữ Vững CTA Buttons. |
| **3. Cứu Nạn Trục Trặc Đứt Quãng Lưới** | [ ] Not Run | Retry Backoff SLA 3 Lần (5s, 10s, Drop). Warning Label Đỏ Đạt Yêu Cầu. |
| **4. Các Kẽ Xung Đột Concurrency** | [ ] Not Run | Cross-Tab Edit Version Control, Hóa Nhịp Kịch Đuổi Session Hết Hạn HTTP 401 |
| **5. E2E UAT Phủ Phê Duyệt** | [ ] Not Run | Sign-off P0 Blockers cho luồng Timeout & Draft Recovery. |

> **Khuyến Nghị Release:** Các kịch bản P0 quan trọng nhất là việc Hệ thống cần khóa cứng (stale closure lock) khi Phát Sinh Hành Vi Sửa Đổi Đồng Thời Ở Cùng Một Mốc Hoặc 2 Cửa Sổ Trình Duyệt Cùng Lệnh Auto-Save (TC.16). Cần đảm bảo Version Data Update trên Backend là phiên bản lạc quan được chấp thuận cuối cùng.
