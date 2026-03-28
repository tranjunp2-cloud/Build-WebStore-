# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F11 - Undo/Redo Engine & AI Editor (Tích hợp F05)
> **Phiên bản:** 2.0 | **Cập nhật:** 2026-03-25 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F11-undo-redo.md`), F05 PRD (`F05-ai-editor.md`), User Stories (F11-01, F11-02, F05-01 tới F05-14)
> **Kỹ năng ứng dụng (.agent):** End-User E2E Flow, BDD (Gherkin Expectations), Locator Healer, Memory Boundaries Customization.

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case phiên bản 2.0 mở rộng độ phủ lên 100% bằng cách đặt F11 Undo/Redo vào bối cảnh người dùng thực tế đang sử dụng **F05 AI Editor**. Mục tiêu là phát hiện mọi rủi ro khi Undo tác động lên các hành vi phức tạp: Sửa Inline, Kéo thả Widget, Đổi cấu hình Global, Auto-save và xử lý AI Chat liên hoàn.

Bộ kiểm thử được thiết kế theo đúng chuẩn Template Ma trận, với sự kết hợp chặt chẽ `GIVEN/WHEN/THEN` và kết quả mong đợi sát với góc nhìn Backend/Frontend.

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Localhost. (Không test Offline Mode vì Undo/Redo là Local-State). |
| Browsers | Chrome (v110+), Safari (Mobile iOS). Test đặc biệt với phím ảo trên Ipad. |
| Devices | Desktop rộng > 1024px, Mobile iPhone chuẩn Width 375px. |
| Test Data & SLA | Text đầu vào > 500 ký tự (Giới hạn F05), Image test > 2MB. Tốc độ Undo DOM `< 200ms`. |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-F11-01] Hoàn Tác Mọi Thay Đổi - Tương tác Thao tác Thủ công (Tham chiếu F05-06)** |
| **TC-F11.01** | `F05-06` | `UI/Func` | Undo sửa chữ nội tuyến (Inline ContentEditable) | **1.** Click đúp vào tiêu đề "Shop Ban".<br>**2.** Gõ lại thành "Shop Táo". Xóa focus (Blur).<br>**3.** Bấm Undo (Ctrl+Z). | **GIVEN** Giao diện đã blur mốc State lưu lại chữ mới.<br>**WHEN** User nhấn Undo<br>**THEN** Trữ lượng hiển thị "Undo(1)". Tiêu đề trả về chữ cũ "Shop Ban" trong nháy mắt `< 200ms`. | Blocker | [x] |
| **TC-F11.02** | `F05-06` | `UI` | Undo định dạng chữ (Formatting Floating Toolbar) | **1.** Bôi đen chữ "Táo".<br>**2.** Chọn công cụ bôi đậm (B) và nghiêng (I) từ Toolbar.<br>**3.** Ctrl+Z hai lần. | **THEN** Chữ tước bỏ định dạng (B), sau đó tước bỏ định dạng (I). Lùi từng bước độc lập. HTML Markup không bị vỡ. Nút Redo nháy sáng. | High | [ ] |
| **TC-F11.03** | `F05-08` | `Logic` | Undo thay ảnh tự động Compress (>2MB) | **1.** Click vào Hero Image.<br>**2.** Up file ảnh 5MB. Quá trình Compress nén thành 200KB và render.<br>**3.** Bấm Ctrl+Z. | **GIVEN** Ảnh mới đã vẽ ra màn hình<br>**WHEN** Bấm Undo<br>**THEN** Thẻ `<img src>` cũ lập tức trở lại. Không load lại vòng chéo Network chặn băng thông. Cấu trúc Width/Height Banner không bị sụp lún. | High | [ ] |
| **[US-F11-01] Hoàn Tác Mọi Thay Đổi - Kéo Thả & Component Library (Tham chiếu F05-05, F05-08)** |
| **TC-F11.04** | `F05-08` | `E2E/UI` | Undo chèn Block mới từ Panel (Library) | **1.** Mở tab Components.<br>**2.** Kéo thả 1 khối "Product List" vào giữa iFrame.<br>**3.** Nhấn Undo. | **GIVEN** Trạng thái DOM đã chèn thêm 1 Component lớn<br>**THEN** Cả cụm Component đó và Placeholder Data (hàng ảo) bốc hơi sạch sẽ. Iframe thu lại Layout như cũ. Nút Redo có số 1. | Blocker | [x] |
| **TC-F11.05** | `F05-05` | `Func` | Undo/Redo Hoán đổi Vị trí (Reordering) | **1.** Hover lấy Drag Handle (⠿).<br>**2.** Kéo Testimonial xuống dưới Footer.<br>**3.** Undo -> Sau đó bấm Redo. | **WHEN** Bấm Undo **THEN** Testimonial quay lại trên Footer. **WHEN** Bấm Redo **THEN** Nhảy thụt lại vị trí dưới cùng. UI Auto-Scroll bám theo Block. | High | [ ] |
| **[US-F11-01] Hoàn Tác Mọi Thay Đổi - AI Chat "Gom Cụm" & Nút Hoàn Tác Phụ (Tham chiếu F05-01)** |
| **TC-F11.06** | `F05-01` | `E2E` | Hoàn tác Gom Cụm Lệnh Gen Giao Diện Lớn (AI Single Action) | **1.** Gõ lệnh: "Đổi màu nền đen, thêm 3 cột giá, xóa thẻ About".<br>**2.** AI Gen liên hoàn 3 thay đổi.<br>**3.** Bấm Undo. | **GIVEN** Cột trạng thái đã nhận 1 Giao Dịch AI cực lớn<br>**THEN** Toàn bộ 3 mục (Màu, 3 Cột, thẻ About) đồng thời phục hồi 100% trong 1 click. TUYỆT ĐỐI không chia nhỏ ra 3 nhịp lắt nhắt bắt User Undo mỏi tay. | Blocker | [ ] |
| **TC-F11.07** | `F05-01` | `UI` | Nút "Hoàn Tác" nội trú trong Lịch sử Chat AI | **1.** Xem lại khung Left Panel (Chat History).<br>**2.** Các message AI trả về "Đã đổi thành màu mint xanh".<br>**3.** Click nút "Hoàn Tác" ngay trong thẻ chat. | **THEN** Tác dụng giống hệt như bấm Nút Undo trên thanh công cụ. Message chat đó bị gạch ngang mờ (Greyed out) kèm nhãn "Undone". Nhấn Redo trên Toolbar sẽ hồi sinh lại. | High | [ ] |
| **TC-F11.08** | `F05-03` | `Logic` | Undo Mini Edit Popup (Click ✨) | **1.** Hover Text 200ms -> Nhấn ✨ Edit.<br>**2.** Mở Input ngắn gõ "Sửa giọng văn hài hước".<br>**3.** Chữ nhảy -> Bấm Ctrl+Z. | **GIVEN** Chỉ Component bị thu hẹp thao tác<br>**THEN** Nội dung lùi về dạng trước lệnh chat mini. Dữ liệu lệnh nội bộ được đưa vào chung 1 Stack Tổng (Master History) của hệ thống. | Medium | [ ] |
| **[US-F11-01] Hoàn Tác Mọi Thay Đổi - Global Settings, Data-Binding, SEO (Tham chiếu F05)** |
| **TC-F11.09** | `F05-07` | `Data` | Undo Dropdown Menu Đa Cấp (Nested) | **1.** Click Header.<br>**2.** Panel Setting phải mở.<br>**3.** Kéo Sub-menu 2 nhét vô Level 1.<br>**4.** Ctrl+Z. | **THEN** Cấu trúc Menu Panel nhả Sub-Menu về bậc ngang hàng. Đồng thời Iframe Live Preview Navbar bung xòe ra như cũ một cách realtime rực rỡ. | High | [x] |
| **TC-F11.10** | `F05-12` | `Data` | Đảo Undo Số điện thoại / Contact Binding Tức thì | **1.** Nhấn click ra nền trắng ngoài Iframe.<br>**2.** Mở Tab Cấu hình Liên Hệ. Đổi SĐT 091 thành 099.<br>**3.** Bấm biểu tượng ↩ trên top. | **GIVEN** Data được truyền vào Redux/Zustand Global<br>**THEN** Dữ liệu SĐT Input Panel đảo về 091. Tất cả Footer / Header Widget đang bind (gắn) với Data này ĐỒNG LOẠT giật nhảy về "091" nhanh như cắt. | Blocker | [ ] |
| **TC-F11.11** | `F05-13` | `Func` | Undo Metadata AI Generate (Page-Level SEO) | **1.** Nhấn nút "✨ Tự động Tối ưu SEO".<br>**2.** Input Meta Title / Desc tự nhảy đầy chữ.<br>**3.** Bấm Ctrl+Z. | **THEN** Dữ liệu input trả dội lại chuỗi cũ. Không thực hiện Update database lén lút (Cho đến khi debounce AutoSave 3s quét). | Medium | [ ] |
| **[US-F11-01] Cơ Chế Lõi Cắt Khúc Lịch Sử & Xử Lý Debounce (Tham chiếu AC-2, AC-3)** |
| **TC-F11.12** | `Logic` | Băm Nát Trục Redo (Branch Cut-Off) | **1.** Sửa 5 mục A,B,C,D,E.<br>**2.** Ctrl+Z về B.<br>**3.** Bật chức năng HIDE Page (Toggle Visibility F05-02). | **GIVEN** Rẽ nhánh hoạt động (Action C,D,E thành dĩ vãng)<br>**WHEN** Phát sinh Save state F mới<br>**THEN** Ngay lập tức Nút Redo Xám Xịt (Count = 0). History `redoStack` Tẩy Trắng. Tránh User click Y để đè Data hỏng bét lên Layout mới F. | Critical | [x] |
| **TC-F11.13** | `Perf` | Debounce API với Spam Click Undo (Nghẽn Mạng Xã Hội 429) | **1.** Nhấn đè dính phím Ctrl+Z (Spamming tốc độ bàn thờ) để lùi 20 nấc trong 1.5 giây. | **GIVEN** Hoạt động Undo chỉ ở Client Context Zustand<br>**THEN** DOM giật nhảy lùi 20 trạng thái cực nhanh. Hệ thống API Auto-Save (Patch State F05) chỉ được gọi duy nhất 1 lần (Chờ 3s im lặng). DB không dính bão Request lỗi 429. | Blocker | [ ] |
| **[US-F11-01] Cơ Chế Lõi Phân Lập Môi Trường Kín & Giới Hạn Tối Đa (Tham chiếu AC-4)** |
| **TC-F11.14** | `Func` | Xóa Page Quản Lý Tách Biệt Store Component (Cách ly Undo) | **1.** Sửa Text (Undo+1).<br>**2.** Click biểu tượng Xóa Mềm 1 Trang khác.<br>**3.** Bấm Ctrl+Z. | **GIVEN** User hối hận vì xóa Trượt Trang.<br>**THEN** Ctrl+Z không cứu được Trang bị Soft-delete. (Form Page Manager có chức năng Undo riêng Toast Popup báo vàng 5 giây `US-F05-02`). Độc lập tuyệt đối! | High | [ ] |
| **TC-F11.15** | `Mem` | Tràn Chảo Bộ Đệm FIFO (50 Tối Đa) | **1.** Liên tục chạy Script bấm Nút "Thêm Text" đếm đúng 51 Lần. (Từ nấc Text 1 -> Text 51).<br>**2.** Nhắp mỏ neo Undo kéo lùi 51 cái. | **THEN** Màn hình đứng im lại ở nấc Text 2. Nấc Text 1 mất tích vĩnh cữu khỏi bộ nhớ của Client JS để tránh Quá tải RAM. Nút mũi tên gập lùi tắt lịm đi. | Critical | [x] |
| **TC-F11.16** | `Sec` | Phân Hóa Session F5 (Tái Tải Tẩy Trắng)| **1.** Đổi Theme Website thành Hồng.<br>**2.** Nhấn F5 Window.<br>**3.** Render xong gõ Ctrl+Z. | **THEN** Màu dính cứng chết ở màu Hồng (Lưu theo DB), bộ nhớ Zustand Undo trống hoắc rỗng trơn. Nút hông xám xịt ảm đạm. Không Persist LocalStorage chống đụng Cache. | Medium | [ ] |
| **[US-F11-02] Tối ưu Trải nghiệm Mobile UX & Đặc Thù Đụng Chạm** |
| **TC-F11.17** | `Res` | Toolbar Đính Đáy Mobile Adaptive (F05-14) | **1.** Rút khung Viewport Console Chrome xuống 375px. Kéo cuộn sờ ngón.<br>**2.** Quan sát chỗ đặt Nút Lùi/Tiến. | **THEN** Cụm Icon chắp cánh rời Top Nav phễu xuống Bottom FAB Toolbar (Bottom Sheet). Lướt tới đoạn Footer nút vẫn Nằm Ghim cứng đó cho tay ấn. Diện tích bắt Tap `>= 44px`. | Critical | [ ] |
| **TC-F11.18** | `E2E/UX` | Haptic Rung Mát - Chống Zoom Chập Nhanh Màn (Mống tay Lớn) | **1.** Test trực tiệp iOS/Safari.<br>**2.** Type chữ, bấm lùi lùi lùi lùi (Spam Tab). | **THEN** OS chạy Cục rung đàm ứng Haptic nhẹ (`navigator.vibrate`). Lệnh `touch-action: manipulation` chặn hiện tượng chớp nháy Panning Zoom phiền phức trên Browser Điện Thoại khi Touch nhanh. | Low | [ ] |
| **[NHÓM 8] Các Kịch Bản Bắt Lỗi Mù (Blind Spot / Concurrency / UX Edge Cases)** |
| **TC-F11.19** | `Logic` | Xung đột Native Undo của Trình duyệt (Browser vs Zustand) | **1.** Click đúp vào thẻ H1 để mở `<div contentEditable>`.<br>**2.** Gõ chữ "Hello", CHƯA bấm Enter hay Blur click ra ngoài.<br>**3.** Bấm Ctrl+Z. | **GIVEN** Focus vẫn còn nằm kẹt bên trong Text Input<br>**THEN** Hành động Ctrl+Z KIỂM SOÁT BỞI TRÌNH DUYỆT (Native Browser Undo) => Chỉ xóa chữ "Hello". KHÔNG ĐƯỢC lùi trạng thái Zustand Array (Prevent app-level Undo misfire). | Blocker | [ ] |
| **TC-F11.20** | `E2E` | Bóp cò Undo khi AI đang Streaming (Race Condition Crash) | **1.** Chat: "Đổi toàn bộ giao diện thành giáng sinh".<br>**2.** AI Bắt đầu nhích DOM đổi nền (Đang loading quay quay).<br>**3.** User mất kiên nhẫn, Bấm Nút Undo trên thanh Top. | **GIVEN** Promise Streaming chưa hoàn thành<br>**THEN** Hệ thống chặn 100% không nhận thao tác Undo (Nút bị Xám / Disabled) cho tới khi End Stream. Nếu không sẽ dính Bug Rách DOM (Half-baked State) tràn RAM gãy Web. | Blocker | [ ] |
| **TC-F11.21** | `UI/Mobile` | Bàn Phím Ảo (Virtual Keyboard) Khóa Chèn Nút | **1.** Dùng Mobile (Nút Undo nằm bẹp dưới đáy).<br>**2.** Nhấn vào thẻ Input Text để gõ -> Bàn phím ảo bật lên che nửa màn hình dưới. | **THEN** Thanh Toolbar BottomToolbar chứa nút Undo/Redo phải BỊ ĐẨY nổi hẳn lên trên đỉnh của Bàn Phím Ảo, HOẶC tàng hình tạm thời. Không bị Bàn phím vật lý đè mất dấu (Z-index issue). | High | [ ] |
| **[ĐẶC NHIỆM: KỊCH BẢN BẮT LỖI REACT JS & BẤT ĐỒNG BỘ NGUY HIỂM NHẤT]** ||||||
| **TC-F11.22** | `Logic` | Lỗi Bắt Dính Khối Lệnh Cũ (React Stale Closure Override) | **1.** Sửa Text thành "A". <br>**2.** Vài tích tắc sau Sửa Text thành "B". <br>**3.** Bấm NGAY LẬP TỨC Ctrl+Z Lùi về "A" trước khi cơ chế AutoSave 3s kịp chớp.<br>**4.** Đợi Auto-save Submit Network. | **GIVEN** Auto-save dùng React Hook/Closure bọc setTimeout 3s.<br>**THEN** Rất nhiều Dev Dởm bị dính `Stale State`. Bắt buộc Payload bắn lên API phải chứa chuỗi "A" (Current State). Tuyệt đối cấm bắn trạng thái tương lai Tạm "B" lên DB hủy hoại công sức lùi Undo của User! | Blocker | [ ] |
| **TC-F11.23** | `Perf`  | Undo Đổi Khung CSS Kéo Sụp Iframe (FOUC Reload Edgecase) | **1.** Global Settings -> Đổi Màu Nền Web sang Đỏ.<br>**2.** Ctrl+Z Đảo về Xanh. | **GIVEN** Màu sắc chi phối bằng Custom CSS Variables. <br>**THEN** Trang web Iframe đảo màu mềm mượt `< 200ms` theo biến in-memory. Cấm Tuyệt Đối trình trạng Load Chớp Trắng/FOUC (Flash of Unstyled Content) Tải Lại Tree DOM từ đầu vì Undo! | High | [ ] |
| **[ĐẶC NHIỆM: BÓC LỖI TƯƠNG QUAN VỚI WIREFRAME ĐỒ HOẠ (F05 DESIGN)]** ||||||
| **TC-F11.24** | `UI/UX` | Fix Lỗ Hổng Design Mobile (Floating Pinned Undo) | **1.** Soi Wireframe F05 Mobile không thấy Nút Undo đâu.<br>**2.** Test bắt buộc Dev phải đính (Pin) Cụm nút Undo/Redo Nổi (Floating) ngay trên góc màn hình Canvas. | **THEN** Không chôn giấu nút Undo vào sâu trong Menu Hamburger hay Bottom Sheet (cực kỳ vướng tay khi Edit). Tuân thủ nghiêm ngặt chuẩn PRD F11 v1.1. | Blocker | [ ] |
| **TC-F11.25** | `Flow`  | Kháng Xoá Bộ Nhớ Khi Bấm "🚀 Publish" (Action Survival) | **1.** Chỉnh sửa chán chê xong bấm Nút Publish lên Live.<br>**2.** Modal Publish báo Success.<br>**3.** Quay qua test Nút Undo (Ctrl+Z). | **GIVEN** Mệnh lệnh xuất bản không làm tháo rời Session.<br>**THEN** Cây Lịch sử (Undo Stack) CHẮC CHẮN PHẢI ĐƯỢC BẢO TOÀN (Không tàng hình!). User có cơ hội lập tức bấm Undo và Publish lại nếu thấy Layout vừa Live bị cấn. | Critical | [ ] |

---

## 4. Biên Bản Kiểm Định QC & Chống Tái Lỗi (Sanity Check List)
> Khung này phải được Auto QC tích xanh trước bản Release Cứng.

1.  **[ ] Tích 1 Cụm AI Đơn Lập:** Hủy kết quả khối chat của AI bắt buộc rút dọn 100% sự đống nát của lệnh Gen, không tách rời rác component rụng sót mảng.
2.  **[ ] Bóp Debounce Save API:** Liên thoanh Phím Tắt Undo/Redo KHÔNG ĐƯỢC sinh ra hàng ngũ Loading đếm 3s dồn dập dội bom API backend. Auto-save bắt trọn cục thay đổi cuối cùng.
3.  **[ ] Cây Độc Lập Page-State:** Hoàn Tác Nội Diện Preview Iframe không nhảy dây sang can thiệp Delete Trang (Page Manager).
4.  **[ ] Kéo Thả Khôi Phục Liền Mạch:** Thả Widget Lệch Vị Trí bấm Hoàn Tác nhảy lại Cũ không nháy trắng Iframe.
5.  **[ ] Touch Pinned Size:** Size bấm chuẩn luật Quốc Tế > 44px (Khoanh vòng CSS Padding lớn chống hụt tay mờ viền).
6.  **[ ] Vô Hiện Input Field Rỗng:** Gõ xong gắp Undo (Backspace) nhả Empty, Form Field required không văng Error đỏ chặn Nấc Đỗ nếu không thực bấm Save Cứng.

---
**PHÊ DUYỆT BỞI:** QA Team ETE  
**NGÀY:** ___ / ___ / 2026