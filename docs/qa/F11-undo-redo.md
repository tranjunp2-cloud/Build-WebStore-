# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F11 - Undo/Redo Engine & AI Editor
> **Phiên bản:** 2.0 | **Cập nhật:** 2026-04-06 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F11-undo-redo.md`), F05 PRD (`F05-ai-editor.md`)
> **Kỹ năng ứng dụng:** End-User E2E Flow, BDD (Gherkin Expectations), Locator Healer, Memory Boundaries Customization.

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case phiên bản 2.0 mở rộng độ phủ lên 100% bằng cách đặt F11 Undo/Redo vào bối cảnh người dùng thực tế đang sử dụng **F05 AI Editor**. Mục tiêu là phát hiện mọi rủi ro khi Undo tác động lên các hành vi phức tạp: Sửa Inline, Kéo thả Widget, Đổi cấu hình Global, Auto-save và xử lý AI Chat liên hoàn.

---

## 2. Test Environment (Môi trường Kiểm thử)

| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Localhost. (Không test Offline Mode vì Undo/Redo là Local-State). |
| Browsers | Chrome (v110+), Safari (Mobile iOS). Test đặc biệt với phím ảo trên iPad. |
| Devices | Desktop rộng > 1024px, Mobile iPhone chuẩn Width 375px. |
| Test Data & SLA | Text đầu vào > 500 ký tự (Giới hạn F05), Image test > 2MB. Tốc độ Undo DOM `< 200ms`. |

---

## 3. Unified Test Cases (Traceability Matrix)

### US-F11-01: Hoàn Tác Mọi Thay Đổi — Thao tác Thủ công (3 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F11.01** | `F05-06` | `UI/Func` | **[Positive]** Undo sửa chữ nội tuyến (Inline ContentEditable) | 1. Click đúp vào tiêu đề "Shop Ban".<br>2. Gõ lại thành "Shop Táo".<br>3. Xóa focus (Blur) ra ngoài.<br>4. Nhấn Undo (Ctrl+Z). | - Số lượng Undo hiển thị "Undo(1)".<br>- Tiêu đề trả về chữ cũ "Shop Ban" ngay lập tức (< 200ms). | Blocker | [x] |
| **TC-F11.02** | `F05-06` | `UI` | **[Positive]** Undo định dạng chữ (Formatting Floating Toolbar) | 1. Bôi đen chữ "Táo".<br>2. Chọn công cụ Bôi đậm (B) và Nghiêng (I).<br>3. Nhấn Ctrl+Z hai lần. | - Chữ lần lượt tước bỏ định dạng (B), sau đó (I).<br>- Lùi từng bước độc lập, HTML Markup không bị vỡ.<br>- Nút Redo nháy sáng. | High | [ ] |
| **TC-F11.03** | `F05-08` | `Logic` | **[Positive]** Undo thay ảnh tự động Compress (> 2MB) | 1. Click vào Hero Image.<br>2. Upload file ảnh 5MB, nén thành 200KB và render.<br>3. Nhấn Ctrl+Z. | - Thẻ `<img src>` cũ lập tức trở lại.<br>- Không load lại toàn bộ Network gây nghẽn băng thông.<br>- Kích thước thẻ bao bọc (Width/Height) không bị sụp lún. | High | [ ] |

---

### US-F11-01: Hoàn Tác Mọi Thay Đổi — Kéo Thả & Component Library (2 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F11.04** | `F05-08` | `E2E/UI` | **[Positive]** Undo chèn Block mới từ Panel | 1. Mở tab Components.<br>2. Kéo thả 1 khối "Product List" vào giữa iFrame.<br>3. Nhấn Undo. | - Cụm Component đó và Placeholder Data ảo biến mất sạch sẽ.<br>- Iframe thu lại Layout như cũ.<br>- Nút Redo hiện có số (1). | Blocker | [x] |
| **TC-F11.05** | `F05-05` | `Func` | **[Positive]** Undo/Redo Hoán đổi Vị trí (Reordering) | 1. Hover lấy Drag Handle (⠿) của Testimonial.<br>2. Kéo thả xuống dưới Footer.<br>3. Nhấn Undo.<br>4. Nhấn Redo. | - **Undo**: Testimonial quay lại trên Footer.<br>- **Redo**: Testimonial nhảy lại vị trí dưới cùng.<br>- UI Auto-Scroll bám theo Block. | High | [ ] |

---

### US-F11-01: Hoàn Tác Mọi Thay Đổi — AI Chat Góc Màn Hình (3 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F11.06** | `F05-01` | `E2E` | **[Positive]** Hoàn tác cụm AI Gen lớn (Single AI Action) | 1. Chat: "Đổi màu nền đen, thêm 3 cột giá, xóa About".<br>2. AI tự động thực hiện 3 thay đổi.<br>3. Nhấn Undo trên Toolbar. | - Cả 3 mục thay đổi phục hồi đồng thời trong **1 click**.<br>- Tuyệt đối không xé lẻ ra 3 lần Undo. | Blocker | [ ] |
| **TC-F11.07** | `F05-01` | `UI` | **[Positive]** Dùng nút "Hoàn Tác" ngay trong khung Chat AI | 1. Gửi AI đổi một section.<br>2. AI trả lời "Đã đổi thành màu mint xanh".<br>3. Click nút "Hoàn Tác" trong bong bóng chat AI. | - Chức năng tương đương nút Undo trên Navbar.<br>- Message chat đó bị gạch ngang và xám mờ (Undone).<br>- Nhấn Redo trên Navbar khôi phục lại (nếu cần). | High | [ ] |
| **TC-F11.08** | `F05-03` | `Logic` | **[Positive]** Undo nội dung từ Mini Edit Popup (✨) | 1. Hover vào Text nào đó, nhấn ✨ Edit.<br>2. Nhập prompt "Sửa giọng văn hài hước".<br>3. Text nhảy nội dung mới, sau đó bấm Ctrl+Z. | - Dữ liệu nội dung lùi về dạng nguyên bản.<br>- Lịch sử thao tác (History Stack) của Mini Edit được gộp chung vào Master Stack của hệ thống. | Medium | [ ] |

---

### US-F11-01: Hoàn Tác Mọi Thay Đổi — Global Settings & SEO Binding (3 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F11.09** | `F05-07` | `Data` | **[Positive]** Undo Dropdown Menu (Nested Array) | 1. Click cấu hình Header.<br>2. Ở Menu Panel, kéo Sub-menu 2 nhét vào Level 1.<br>3. Bấm Ctrl+Z. | - Cấu trúc Menu trên Panel nhả về bậc ngang hàng.<br>- Iframe Live Preview cập nhật Navbar xòe ra như cũ realtime. | High | [x] |
| **TC-F11.10** | `F05-12` | `Data` | **[Positive]** Undo Global Data Binding (Số điện thoại) | 1. Mở Cấu hình Liên Hệ (Global Setting).<br>2. Đổi đuôi SĐT `091` thành `099`.<br>3. Nhấn nút ↩ Undo. | - Panel cập nhật ngược về `091`.<br>- Tất cả các widget trên Footer/Header đang liên kết với SĐT đồng loạt cập nhật nội dung thành `091` tức thì. | Blocker | [x] |
| **TC-F11.11** | `F05-13` | `Func` | **[Positive]** Undo Metadata AI Generate (Page SEO) | 1. Nhấn nút "✨ Tự động Tối ưu SEO" cho Page.<br>2. Meta Title/Desc tự chèn text.<br>3. Nhấn Ctrl+Z. | - Dữ liệu input nhả về chuỗi rỗng/cũ.<br>- Backend không update lừa (cho tới khi Auto-Save trigger 3s sau đó). | Medium | [ ] |

---

### US-F11-01: Branching & Giới Hạn Hoạt Động Cốt Lõi (3 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F11.12** | `Logic`| `Func` | **[Edge]** Băm nát trục Redo (Branch Cut-Off) | 1. Sửa 5 mục A, B, C, D, E vào History.<br>2. Nhấn Undo lùi về B.<br>3. Bật thêm tính năng HIDE Page (phát sinh state F). | - Nút Redo xám xịt (Count=0). Stack `redoStack` tự xóa trắng.<br>- Các Action Tương lai (C, D, E) biến mất, tránh tình huống user Redo làm hỏng State F hiện tại. | Critical | [x] |
| **TC-F11.13** | `Perf` | `Perf` | **[Negative]** Tránh đụng độ bão API khi Spam Undo Undo | 1. Nhấn đè dính Ctrl+Z (spam Undo) lùi 20 trạng thái trong 1.5 giây. | - DOM giật nhảy 20 state rất mượt.<br>- **API Debounce**: Lệnh update PATCH API chỉ gọi **duy nhất 1 lần khép lại** sau khi xả phím 3s, tránh dội DB HTTP 429 Limit. | Blocker | [ ] |
| **TC-F11.14** | `Func` | `Flow` | **[Negative]** Chức năng Undo không xen vào thao tác Page Manager | 1. Sửa đoạn Text ở Homepage.<br>2. Đi ra phần Page Quản Lý, xóa (Soft-delete) một trang tên "About".<br>3. Vào lại trang Home, nhấn Ctrl+Z. | - Ctrl+Z chỉ rút lại đoạn text chỉnh sửa.<br>- Hành động Undo hoàn toàn không khôi phục lệnh xóa Trang (việc đó là luồng độc lập). | High | [ ] |

---

### US-F11-01: Giới Hạn Tối Đa Môi Trường Kín & Session Lifecycle (2 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F11.15** | `Mem` | `Logic` | **[Boundary]** Giới hạn nhớ 50 bước FIFO (Max Stack) | 1. Dùng lệnh tự động thêm text lần lượt đúng 51 bước.<br>2. Nhấn lùi Undo 51 lần liên tiếp. | - Sẽ bị kẹt dừng ở mốc 2.<br>- Item Text thứ nhất (đầu tiên) đã bị đánh rơi ra khỏi bộ nhớ (Max 50) để chống quá tải RAM. Mũi tên lùi không hoạt động nữa. | Critical | [x] |
| **TC-F11.16** | `Sec` | `Func` | **[Negative]** Session tàn lụi khi F5 trình duyệt | 1. Đổi Navbar thành màu Hồng.<br>2. Nhấn F5 trình duyệt (Reload window).<br>3. Nhấn Ctrl+Z. | - Background màu Hồng lưu chặt ở lại Server.<br>- History Client rỗng, Nút tắt ngòm (xám xịt).<br>- Không đụng Cache cũ lưu Persistence lỏng lẻo. | Medium | [ ] |

---

### US-F11-02: Mobile UX & Xung Đột Đặc Thù Giao Diện (5 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F11.17** | `Res` | `UX` | **[Positive]** Toolbar Undo ghim đáy (Bottom FAB) Mobile | 1. Chuyển thiết bị sang kích thước Mobile 375px.<br>2. Cuộn trang lên xuống dọc nội dung Iframe. | - Cụm nút Undo/Redo tước khỏi TopNav, di chuyển bám đáy dạng Bottom Sheet (hoặc Floating Button).<br>- Size Click Target `>= 44px`. | Critical | [ ] |
| **TC-F11.18** | `E2E/UX`| `Func` | **[Positive]** Tránh Zoom Mobile loạn xạ khi Double/Tap nhanh | 1. Mở Editor trên Chrome Mobile vật lý / Safari.<br>2. Chạm Tap-tap-tap nhanh tục Nút Undo. | - Bấm liên hoàn mượt.<br>- Thiết bị có Haptic Rung nhẹ, nhưng màn hình **Không tự Panning/Zoom** to phình ra do Safari mặc định khi tap lẹ. | Low | [ ] |
| **TC-F11.19** | `Logic`| `Flow` | **[Negative]** Phân biệt Native Browser Undo và App Undo | 1. Click vô thẻ Heading ContentEditable, gõ "Hello" (đang focus, con trỏ nháy).<br>2. Không nhấn đi đâu, gõ thẳng Ctrl+Z. | - Trình duyệt Browser sẽ dùng Native Undo (xóa chữ).<br>- App không ghi đè History Stack cấp độ System Zustand.<br>- Không lỗi nhảy Mảng dữ liệu lung tung. | Blocker | [x] |
| **TC-F11.20** | `E2E` | `Flow` | **[Negative]** Chặn thao tác Undo khi AI đang Streaming | 1. Gõ Lệnh Cho AI Edit giao diện.<br>2. Đang loading bốc bong bóng xoay chờ mượt.<br>3. Cố tình nhấn Undo Toolbar dội lại. | - Nút Undo bị Disable cấm chỉ hoàn toàn (Click vô dụng).<br>- Server Promise Stream chạy XONG HOÀN TOÀN thì mới mở cờ cho user lùi (Chống Half-baked DOM Data rác sập app). | Blocker | [ ] |
| **TC-F11.21** | `UI` | `Mob` | **[Negative]** Xung đột che lấp Bàn Phím Ảo (Virtual Keyboard) | 1. Dùng Ipad / Điện thoại bấm vô 1 thẻ Form.<br>2. Bàn phím QWERTY ảo nhảy bốc lên dưới đáy. | - Nút Toolbar chứa Undo/Redo phải tránh nằm chôn chung đáy bị che khuất mà không với ấn được.<br>- Phải tự neo lên đỉnh của mép Bàn Phím. | High | [ ] |

---

### Các Kịch Bản Bug Nâng Cao (React Edge Cases) (4 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F11.22** | `Logic`| `Sec` | **[Negative]** Lỗi Stale Closure (Lưu đứt đoạn sai Data) | 1. Sửa text thành "A".<br>2. Ngay lập tức đổi "B".<br>3. Trong nháy mắt chưa kịp AutoSave (3s timer), bấm Undo lại thành "A".<br>4. Chờ 3s quan sát Network Payload bắn đi. | - Khi API Patch Auto-save kích hoạt, nó **Bắt Buộc Bắn Data "A"**. Tuyệt đối cấm găm mảng Cache Closure chui của React Hook lén mang chữ "B" đi đè ghi lại hư nát kho của User! | Blocker | [ ] |
| **TC-F11.23** | `Perf` | `UI` | **[Negative]** Lỗi Chớp Trắng Giao diện do Re-mount Style | 1. Vào Đổi Giao Diện Màu Background Dark Mode.<br>2. Nhấn Undo lùi dội lại Light Mode. | - Các thẻ CSS Node đổi Variables `< 200ms` mượt mà.<br>- Không re-load nguyên cục JS Iframe Component gây FOUC Flash chớp giật mắt trắng Layout. | High | [ ] |
| **TC-F11.24** | `UI/UX`| `Flow` | **[Negative]** Kẽ hở Wireframe thiếu nút Mobile | 1. Soi bộ Wireframe F05 có thể bị vẽ thiếu Nút Hover Undo đỏ trên Ipad View.<br>2. Verify Team Frontend đắp đúng thiết kế nổi Pinned Redo/Undo riêng biệt. | - Không giấu nút vào chung menu Hamburger hay Drawer ẩn. | Blocker | [ ] |
| **TC-F11.25** | `Flow` | `Logic`| **[Positive]** Nhấn Publish (Lên sóng) thì Cây Undo được duy trì | 1. Sửa Web 5 bước, nhấn nút 🚀 Publish để Launch website ra trần đời.<br>2. Xong việc tắt Modal đi, sau đó bấm Ctrl+Z lùi Layout. | - Luồng Launch Publish hoàn toàn tách biệt. Session Cây Undo Stack KHÔNG bị Clear trống tẩy bẩn.<br>- User vừa thấy "Oops nhầm", lùi lại UI rồi nhấp Publish Cập Nhật Sóng Vàng cứu hộ lẹ tay được. | Critical | [ ] |

---

## 4. Biên Bản Kiểm Định QC & Chống Tái Lỗi (Sanity Check List)
> Khung này phải được Auto QC tích xanh trước bản Release Cứng.

| # | Tiêu Chí Kiểm Tra (Sanity) | Trạng Thái |
|:---:|:---|:---:|
| 1 | **Tích 1 Cụm AI Lớn:** AI Gen nguyên cục (Màu, Layout, Content), Undo phát phải thu về tròn vẹn đủ 3 thứ, không rụng rớt rời rạc. | [ ] |
| 2 | **Chặn Debounce Dội Bão API:** Bấm phím tắt lùi Undo chục lần thì API AutoSave không được bắn ra liên hồi chục Nhịp, chờ 3s chỉ gom ném Cục cuối cùng! | [ ] |
| 3 | **Cách Ly Dữ Liệu Trang Tĩnh:** Hoàn Tác Nội Dung Page Iframe A tuyệt đối không khơi dậy lại Xóa Lấp Mất Trang Giao Diện Page B. | [ ] |
| 4 | **Bấm Đặt Drag Gọn Gàng:** Thả Widget Lệch, bấm Hoàn Tác nhảy lại Cũ không nháy màn hình (Render mượt Local DOM CSS Node). | [ ] |
| 5 | **Target Icon Mobile Lớn Nét:** Size bấm trên UI iPhone cho Button này > 44px (Khoanh vòng lớn, khó nhấn hụt nhầm ngón bè). | [ ] |
| 6 | **Form Field Gõ Xóa Trống Hoàn Đẹp:** Dùng Delete hay Backslash lùi nhả Contentedittable về Empty (""), Form không Văng Toast đỏ Chặn Đóng khi chưa Mới lưu! | [ ] |

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử | Trạng Thái | Ghi chú |
|---|---|---|
| **1. Trải Nghiệm Mượt UI** | [ ] Đã chạy 0/8 TC | Phục Trạng, Băm Tree, Pinned Khóa Tránh Nền |
| **2. Logic Function Core** | [ ] Đã chạy 0/10 TC | Redo Stack Cutoff, FIFO Limited Bộ, Native Browser Text Focus Chặn |
| **3. API Auto Save Synergy** | [ ] Đã chạy 0/4 TC | Debounce Đúp Click, Stale React Closure Bugs |
| **4. AI Xuyên Flow Gắn Bọt** | [ ] Đã chạy 0/3 TC | Button Float Chat Hộp Nhắn Nhỏ Góc Dưới Của Ngăn Panel Trái |

> **Khuyến Nghị Release:** Lỗi Tối Quan Trọng Nhất Để Thả Website Trôi Live Là Sụp Nghẽn React Cây Đứt Layout Đoạn **Nhịp Save Đè Phủ Closure Cuối (Bug số 22)**. Developer phải móc Log Debug Rõ Chống React Lấy Biến Giá Trị Cũ Nát Trả Về. Mảnh Khác Ổn.