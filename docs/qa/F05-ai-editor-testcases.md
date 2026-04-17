# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F05 - AI Editor (Split Screen)
> **Phiên bản:** 14.0 (Formal Traceability Matrix) | **Cập nhật:** 2026-04-06 | **Thực hiện:** QA Team
> **Tài liệu tham chiếu PRD:** [F05-ai-editor.md](../prd/F05-ai-editor.md) | **User Stories (13 US):** [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md)

---

## 1. Mục Tiêu (Objective)

Tài liệu đạt quy chuẩn **Comprehensive QA Expert**, Coverage 100% rủi ro xuyên suốt 14 User Stories.

**Tổng cộng 155 kịch bản chi tiết** bao phủ: Positive, Negative/Edge cases, UI States, Form Validation, Concurrency, Security, Mobile UX.

---

## 2. Test Environment

| Biến | Yêu cầu |
|---|---|
| Môi trường | Staging / Pre-Production |
| Browsers | Chrome (v110+), Firefox (v105+), Safari |
| Devices | Desktop (1920x1080), Mobile (iPhone 14 Pro 375px) |
| Automation | Playwright (BDD) |
| URL | https://web-cms-v2.dev.ecommercehub.my/ |

---

## 3. Unified Test Cases (Traceability Matrix)

### US-01: AI Editor — Split Screen Chat + Preview (10 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-01-01** | `US-01/AC1` | `UI` | Khởi tạo Layout 3 vùng | 1. Truy cập URL `/editor/:siteId`. | - Hiển thị đầy đủ 3 vùng: Chat, Preview, Settings. | Blocker | [x] |
| **TC-F05-01-02** | `US-01/AC2` | `Func` | Phản hồi giao diện qua luồng SSE | 1. Nhập prompt vào Chat.<br>2. Nhấn Submit. | - Iframe Preview cập nhật qua stream < 3 giây. | Blocker | [x] |
| **TC-F05-01-03** | `US-01/AC3` | `Logic` | Xử lý lệnh Hoàn tác (Undo) | 1. Dùng phím tắt Ctrl+Z hoặc nút Undo trên UI. | - Phục hồi trạng thái gần nhất trong < 200ms. | High | [x] |
| **TC-F05-01-04** | `US-01/AC5` | `Edge` | Auto-save với Throttling | 1. Nhập liên tục trong 5 giây.<br>2. Dừng 3 giây. | - Chỉ gọi API PATCH đúng 1 lần để lưu DB. | High | [x] |
| **TC-F05-01-05** | `US-01/UX` | `UX` | Phím tắt Shift+Enter | 1. Nhấn Shift+Enter tại ô Chat. | - Con trỏ xuống dòng, không Submit lệnh. | High | [ ] |
| **TC-F05-01-06** | `US-01/Val` | `Val` | Xử lý lệnh rỗng (chỉ toàn dấu cách) | 1. Nhập toàn ký tự Space vào Chat.<br>2. Quan sát nút Submit. | - Nút Submit bị Disable.<br>- Không gọi API LLM. | Priority | [x] |
| **TC-F05-01-07** | `US-01/Val` | `Bound` | Giới hạn tối đa ký tự | 1. Dán chuỗi hơn 5,000 ký tự vào Chat. | - Hiển thị lỗi "Vượt quá độ dài tối đa".<br>- Không gọi API. | Blocker | [ ] |
| **TC-F05-01-08** | `US-01/Net` | `Net` | Lỗi ngắt kết nối khi stream đang chạy | 1. Cắt kết nối mạng trong khi SSE đang stream. | - Hiển thị Toast lỗi kết nối.<br>- Iframe phục hồi về dữ liệu cũ. | Blocker | [x] |
| **TC-F05-01-09** | `US-01/Race` | `Race` | Hủy lệnh AI đang thực thi | 1. Nhấn nút Abort (hủy) khi AI đang xử lý. | - Stream dừng ngay lập tức.<br>- Không lưu dữ liệu rác vào state. | High | [ ] |
| **TC-F05-01-10** | `US-01/Con` | `Concu` | Xung đột phiên chỉnh sửa song song | 1. Mở cùng editor trên 2 Tab.<br>2. Thao tác đồng thời trên cả hai. | - Tab thao tác sau nhận HTTP 409 Conflict.<br>- Yêu cầu làm mới trang. | Blocker | [ ] |

---

### US-02: Page Manager (12 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-02-01** | `US-02/AC1` | `UI` | Hiển thị lưới danh sách Page | 1. Mở tab Pages trong Sidebar. | - Danh sách hiển thị: cờ Live/Draft, số block, ngày cập nhật. | High | [x] |
| **TC-F05-02-02** | `US-02/Stt` | `State` | Empty State khi không có trang | 1. Xóa toàn bộ trang trong DB.<br>2. Mở lại tab Pages. | - Hiển thị thông báo "Chưa có trang". | High | [x] |
| **TC-F05-02-03** | `US-02/Stt` | `State` | Loading Skeleton khi đường truyền chậm | 1. Giảm tốc độ mạng.<br>2. Mở tab Pages. | - Skeleton mờ sáng hiển thị cho đến khi dữ liệu tải xong. | Medium | [ ] |
| **TC-F05-02-04** | `US-02/AC2` | `Func` | Thêm trang mới hợp lệ | 1. Nhập tên trang mới hợp lệ.<br>2. Xác nhận tạo. | - Trang được tạo thành công.<br>- Slug định dạng `kebab-case`.<br>- Redirect đúng URL. | Blocker | [x] |
| **TC-F05-02-05** | `US-02/Val` | `Val` | Form Title bị bỏ trống | 1. Nhấn Submit mà không nhập tên trang. | - Chặn Submit.<br>- Hiển thị lỗi Zod "Tên trang là bắt buộc". | High | [x] |
| **TC-F05-02-06** | `US-02/Sec` | `Sec` | XSS Injection vào Form Tên | 1. Nhập chuỗi `<script>` vào ô Tên trang. | - Payload CMS sanitize, loại bỏ XSS.<br>- Tên trang không thực thi script. | Blocker | [x] |
| **TC-F05-02-07** | `US-02/Val` | `Val` | Vượt giới hạn độ dài Title | 1. Nhập chuỗi 300 ký tự vào tên trang. | - Hiển thị lỗi "Tối đa 255 ký tự".<br>- API không được gọi. | Priority | [ ] |
| **TC-F05-02-08** | `US-02/Limit` | `Bound` | Trùng lặp slug | 1. Tạo trang có tên đã tồn tại. | - Hệ thống tự thêm số thứ tự vào slug để tránh trùng (vd: `page-2`). | Medium | [x] |
| **TC-F05-02-09** | `BR-08.1` | `Limit` | Giới hạn số trang tối đa | 1. Tạo vượt quá 100 trang trong một Site. | - Trả về lỗi "Đã đạt giới hạn 100 trang". | Medium | [ ] |
| **TC-F05-02-10** | `US-02/AC3` | `Logic` | Xóa mềm trang (Soft Delete) | 1. Xác nhận lệnh xóa trang. | - Trường `deletedAt` được set.<br>- Trang biến khỏi danh sách. | High | [x] |
| **TC-F05-02-11** | `US-02/Undo` | `Recov` | Hủy thao tác xóa (Undo) | 1. Nhấn "Hoàn tác" ngay tại Toast sau khi xóa. | - `deletedAt` bị xóa.<br>- Trang quay lại đúng vị trí cũ trong danh sách. | Blocker | [x] |
| **TC-F05-02-12** | `US-02/AC4` | `Flow` | Ẩn/Hiện trang (Hide/Unhide) | 1. Dùng Toggle để ẩn trang. | - Trường `isVisible` thay đổi.<br>- Người dùng ngoài truy cập trang nhận lỗi 404. | Blocker | [x] |

---

### US-03: Inline Click-to-Edit Element (6 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-03-01** | `US-03/AC1` | `UX` | Hiển thị nút gọi AI khi hover | 1. Hover chuột lên một Text Block trên Preview. | - Popup "Edit with AI" xuất hiện căn lề chính xác. | Medium | [ ] |
| **TC-F05-03-02** | `US-03/AC2` | `Func` | Chỉnh sửa văn bản Inline bằng AI | 1. Nhập ngữ cảnh sửa nội dung vào popup Inline AI. | - Block nhận thay đổi cục bộ.<br>- Layout CSS không bị lệch. | Blocker | [x] |
| **TC-F05-03-03** | `US-03/Flow` | `Flow` | Hủy soạn thảo Inline | 1. Click chuột ra ngoài vùng popup. | - Popup đóng lại.<br>- Không tạo lịch sử nháp trong State. | Medium | [ ] |
| **TC-F05-03-04** | `US-03/Mob` | `Mob` | Popup Inline tương thích Mobile | 1. Mở editor ở viewport 375px.<br>2. Kích hoạt Inline Edit. | - Popup chuyển thành Bottom Sheet thay vì Floating Box tràn lề. | High | [ ] |
| **TC-F05-03-05** | `US-03/AI` | `Val` | Lỗi kết nối API khi Inline Edit | 1. Ngắt kết nối mạng trong khi đang dùng Inline Edit. | - Text component giữ nguyên nội dung gốc.<br>- Hiển thị Toast lỗi kết nối. | High | [x] |
| **TC-F05-03-06** | `US-03/Limit` | `Bound` | Giới hạn ký tự prompt Inline | 1. Nhập vượt số ký tự cho phép vào ô prompt. | - Hiển thị validation đỏ.<br>- Không cho Submit request. | Medium | [ ] |

---

### US-04: Add New Section via AI (3 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-04-01** | `US-04/AC1` | `Logic` | Khởi tạo Section/Block tự động | 1. Ra lệnh AI tạo một Footer Block mới. | - JSON layout được cập nhật.<br>- Block mới xuất hiện mượt mà trên Preview. | High | [x] |
| **TC-F05-04-02** | `US-04/Hall` | `Edge` | Lệnh ngoài ngữ cảnh (Out of Context) | 1. Gửi lệnh mà LLM trả về cấu trúc block phi chuẩn. | - Hệ thống fallback từ chối render.<br>- Chat thông báo "Không nhận dạng cấu trúc block". | Medium | [ ] |
| **TC-F05-04-03** | `US-04/Lim` | `Bound` | Tràn giới hạn số lượng Block | 1. Yêu cầu AI thêm block vượt quá giới hạn cho phép. | - Hệ thống chặn, không thêm block mới.<br>- Thông báo đã đạt giới hạn. | High | [ ] |

---

### US-05: Drag-and-Drop Block Reorder in Editor (13 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-05-01** | `US-05/AC1` | `DND` | Hoán đổi vị trí Block bằng kéo thả | 1. Kéo Block lên/xuống một vị trí khác trong Preview. | - Index block thay đổi đúng.<br>- Preview trong Iframe cập nhật realtime. | Blocker | [ ] |
| **TC-F05-05-02** | `US-05/AC2` | `Logic` | Undo hoán vị DND | 1. Gọi Undo sau khi kéo thả Block. | - Block quay về vị trí cũ chính xác.<br>- Redo hoạt động đúng. | High | [x] |
| **TC-F05-05-03** | `US-05/Spam` | `Race` | Drag & Drop liên tục (spam) | 1. Kéo thả Block liên tục trong 5 giây. | - Throttling chặn Race Condition.<br>- API chỉ ghi nhận bản cuối cùng. | Blocker | [ ] |
| **TC-F05-05-04** | `US-05/Sec` | `UI` | Thả Block ngoài vùng cho phép | 1. Kéo block ra ngoài phạm vi cửa sổ editor rồi thả. | - Ghost Element bị xóa khỏi DOM.<br>- Layout phục hồi về vị trí an toàn. | Medium | [ ] |
| **TC-F05-05-05** | `US-05/Mob` | `Mob` | Drag & Drop trên Mobile | 1. Thử kéo thả Block trên thiết bị điện thoại. | - Hành động kéo block không xung đột với hành động cuộn trang. | High | [ ] |
| **TC-F05-05-06** | `US-05/AC1` | `UI` | Hiển thị Drag Handle (⠿) khi hover | 1. Hover chuột lên bất kỳ Content Block trong Preview. | - Icon ⠿ xuất hiện cạnh block.<br>- Biến mất khi rời chuột.<br>- Không che nút Edit/Delete. | Blocker | [ ] |
| **TC-F05-05-07** | `US-05/AC1` | `Negative` | Nav/Footer không có Drag Handle | 1. Hover chuột lên Navigation Bar và Footer. | - Không hiển thị icon ⠿.<br>- Cursor giữ `pointer`, không cho kéo thả. | High | [ ] |
| **TC-F05-05-08** | `US-05/AC3` | `API` | Auto-save payload chứa thứ tự mới | 1. Kéo Block A từ vị trí 1 xuống vị trí 3.<br>2. Chờ debounce 3 giây. | - API PATCH được gọi với mảng `blocks[]` đúng thứ tự mới.<br>- Response `200 OK`. | Blocker | [ ] |
| **TC-F05-05-09** | `US-05/AC3` | `UI` | Status Bar "Saved" sau khi drop | 1. Kéo thả Block xong, quan sát Status Bar trong 3–5 giây. | - Status Bar chuyển: rỗng → "Saving..." → "Saved". | High | [ ] |
| **TC-F05-05-10** | `US-05/AC4` | `AI` | AI Chat Undo thao tác Drag-Drop | 1. Kéo thả Block thủ công xong.<br>2. Gõ "Undo that" hoặc "Move it back" trong Chat. | - AI nhận diện context, gọi action undo.<br>- Block quay về vị trí cũ.<br>- History stack cập nhật. | Blocker | [ ] |
| **TC-F05-05-11** | `US-05/Cancel` | `Recov` | Hủy kéo thả giữa chừng bằng ESC | 1. Bắt đầu kéo Block.<br>2. Nhấn ESC hoặc thả ngoài Drop Zone. | - Drag bị hủy hoàn toàn.<br>- Block về vị trí ban đầu.<br>- Không gọi API PATCH.<br>- Không tạo entry Undo history. | High | [ ] |
| **TC-F05-05-12** | `US-05/Con` | `Concu` | Xung đột Drag-Drop trên 2 Tab | 1. Mở 2 Tab cùng editor.<br>2. Kéo block trên cả hai Tab đồng thời. | - Tab thao tác sau nhận HTTP 409 Conflict hoặc version mismatch.<br>- Toast yêu cầu Refresh. | Blocker | [ ] |
| **TC-F05-05-13** | `US-05/A11y` | `A11y` | Keyboard Reorder Block | 1. Focus vào Block bằng Tab.<br>2. Nhấn Alt+↑/↓ để di chuyển. | - Block di chuyển đúng chiều.<br>- Screen Reader thông báo vị trí mới.<br>- State cập nhật tương đương drag chuột. | Medium | [ ] |

---

### US-06: Manual Visual Editing — WYSIWYG Text & Image (15 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-06-01** | `US-06/AC1` | `Func` | Định dạng Bold/Italic | 1. Bôi đen đoạn text.<br>2. Nhấn Bold (B) hoặc Italic (I) trên Toolbar. | - Tag `<b>` hoặc `<i>` được wrap đúng trong Rich Text DB. | High | [x] |
| **TC-F05-06-02** | `US-06/AC2` | `DB` | Bảo vệ khi xóa rỗng Text Block | 1. Xóa toàn bộ nội dung trong ô Text. | - Hiển thị Placeholder Text.<br>- Padding CSS được duy trì, không vỡ layout. | Medium | [ ] |
| **TC-F05-06-03** | `US-06/Img` | `Val` | Nén ảnh tự động khi upload | 1. Upload file ảnh Bitmap > 10MB. | - Frontend tự động resize và nén ảnh.<br>- File nhẹ hơn trước khi gửi lên server. | Blocker | [x] |
| **TC-F05-06-04** | `BR-08.1` | `Limit` | Từ chối file không đúng định dạng | 1. Upload file `.exe` thay vì ảnh. | - Validator chặn, không gọi API upload.<br>- Hiển thị lỗi định dạng không hợp lệ. | High | [ ] |
| **TC-F05-06-05** | `US-06/Sec` | `Sec` | Làm sạch Inline Style khi Paste từ Word | 1. Copy nội dung dài từ Microsoft Word.<br>2. Paste vào Editor. | - DOMPurify loại bỏ Inline Style nguy hiểm.<br>- Định dạng ứng dụng không bị hỏng. | High | [x] |
| **TC-F05-06-06** | `US-06/Sec` | `Sec` | Chặn XSS qua file SVG | 1. Upload file Logo chứa mã XSS trong SVG. | - Server loại bỏ payload XML không an toàn.<br>- Không thực thi script. | Blocker | [x] |
| **TC-F05-06-07** | `US-06/UI` | `UI` | Floating Toolbar hiển thị chuẩn | 1. Bôi chọn (highlight) một đoạn text. | - Floating Toolbar xuất hiện căn lề đúng.<br>- Không che nội dung phía dưới. | High | [ ] |
| **TC-F05-06-08** | `US-06/Race` | `Race` | Giới hạn Undo 50 bước | 1. Nhấn Ctrl+Z hơn 60 lần liên tục. | - Chỉ giữ tối đa 50 bước Undo.<br>- Nút Undo mờ đi khi hết lịch sử.<br>- Không crash memory. | Blocker | [ ] |
| **TC-F05-06-09** | `US-06/AC1` | `Func` | Double-click kích hoạt contentEditable | 1. Double-click vào đoạn text (Heading/Paragraph/Button) trong Preview. | - Text chuyển sang `contentEditable`.<br>- Viền highlight xuất hiện.<br>- Floating Toolbar nổi lên.<br>- Cursor nhấp nháy sẵn sàng nhập. | Blocker | [ ] |
| **TC-F05-06-10** | `US-06/AC1` | `Func` | Format Underline (U) và Canh Lề | 1. Bôi đen text.<br>2. Chọn Underline (U) trên Toolbar.<br>3. Chọn Canh giữa (Center). | - Tag `<u>` wrap đúng text được chọn.<br>- Text-align thay đổi realtime trên Preview.<br>- Kiểm tra cả 4 kiểu: trái, giữa, phải, đều. | High | [ ] |
| **TC-F05-06-11** | `US-06/AC1` | `Func` | Heading Type Selector (H1→H6, Body) | 1. Đặt cursor trong đoạn text.<br>2. Mở dropdown Heading.<br>3. Chọn H2. | - Tag chuyển từ `<p>` sang `<h2>`.<br>- Font-size/weight thay đổi trên Preview realtime.<br>- Kiểm tra H1→H6 và Body. | High | [ ] |
| **TC-F05-06-12** | `US-06/AC1` | `Logic` | Blur/Enter thoát Edit Mode | 1. Đang edit text.<br>2. (a) Click ra ngoài block HOẶC (b) nhấn Cmd+Enter. | - contentEditable tắt.<br>- Floating Toolbar biến mất.<br>- Thay đổi áp dụng vào state.<br>- Auto-save trigger sau 3s debounce. | Blocker | [ ] |
| **TC-F05-06-13** | `US-06/AC2` | `UI` | Image Toolbar hiển thị khi click ảnh | 1. Click vào một hình ảnh trên Preview iframe. | - Toolbar nhỏ xuất hiện với 2 nút: [Thay ảnh] và [✨ Sinh ảnh AI].<br>- Click ra ngoài → Toolbar biến mất. | Blocker | [ ] |
| **TC-F05-06-14** | `US-06/AC2` | `State` | Loading khi upload ảnh thay thế | 1. Click [Thay ảnh].<br>2. Chọn file ảnh 5MB. | - Spinner hiển thị trên vùng ảnh trong lúc upload.<br>- Nút [Thay ảnh] disabled.<br>- Sau upload: ảnh mới render, layout không vỡ, status "Saved". | High | [ ] |
| **TC-F05-06-15** | `US-06/Cancel` | `Recov` | ESC hủy giữa chừng Edit WYSIWYG | 1. Đang edit text, đã thay đổi nội dung.<br>2. Nhấn phím ESC. | - Thoát contentEditable.<br>- Text quay về nội dung gốc (discard changes).<br>- Không tạo entry Undo History.<br>- Không trigger auto-save. | High | [ ] |

---

### US-07: Global Header & Footer Management (12 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-07-01** | `US-07/AC1` | `Func` | Sắp xếp Sub-menu Navigation | 1. Kéo thả để lồng một Menu Item vào trong Item cha. | - Menu cha-con hiển thị đúng trên Global Navigation Bar xuyên suốt các trang. | High | [ ] |
| **TC-F05-07-02** | `BR-08.1` | `Limit` | Giới hạn cấp lồng menu tối đa | 1. Thêm một menu cấp 3 (cháu) vào tree. | - Hệ thống chặn với Toast: "Chỉ hỗ trợ tối đa 1 cấp con". | High | [x] |
| **TC-F05-07-03** | `US-07/AC2` | `Logic` | Tự động sinh Favicon từ Logo | 1. Thay đổi Logo chính (Main Logo). | - Hình ảnh được tự động resize về 32x32px.<br>- Favicon gắn vào thẻ `<link rel="icon">`. | High | [x] |
| **TC-F05-07-04** | `US-07/Val` | `Val` | Validation Menu Link không có URL | 1. Tạo menu item với ô URL để trống. | - Hiển thị lỗi "URL đích là bắt buộc".<br>- Không lưu được menu item. | High | [ ] |
| **TC-F05-07-05** | `US-07/Race` | `Sec` | Giới hạn số lượng Menu Items | 1. Thêm vượt quá 15 menu items. | - Hệ thống chặn, không cho thêm.<br>- Tránh tràn Navigation trên Mobile. | Medium | [ ] |
| **TC-F05-07-06** | `US-07/AC1` | `UI` | Click Header → Focus + dim các Blocks khác | 1. Click vào vùng Header trên canvas Preview. | - Header được focus với viền highlight.<br>- Các blocks khác bị mờ nhẹ.<br>- Panel Settings chuyển sang bộ chỉnh sửa "Navigation Links". | Blocker | [ ] |
| **TC-F05-07-07** | `US-07/AC1` | `Func` | Thêm Link mới vào Navigation | 1. Trong panel Navigation Links, nhấn "Thêm Link mới".<br>2. Nhập Label "Sản Phẩm", chọn đích Internal Page "products". | - Menu item mới xuất hiện trong tree.<br>- Preview Header cập nhật realtime.<br>- Tất cả trang trong siteId đồng bộ. | Blocker | [ ] |
| **TC-F05-07-08** | `US-07/AC1` | `Func` | Đổi Label hiển thị Menu | 1. Click vào menu item "About".<br>2. Sửa Label thành "Về Chúng Tôi".<br>3. Blur hoặc Enter xác nhận. | - Label mới cập nhật realtime trên Preview Header.<br>- Slug/URL đích không bị ảnh hưởng. | High | [ ] |
| **TC-F05-07-09** | `US-07/AC1` | `Func` | Chọn 4 loại Destination | 1. Tạo 4 menu items với đích lần lượt: (1) Internal `/about`, (2) External `https://google.com`, (3) Email `mailto:info@shop.com`, (4) Phone `tel:+84123456789`. | - Internal: navigate cùng domain.<br>- External: mở `_blank`.<br>- Email: trigger mailto client.<br>- Phone: trigger tel dialer. | Blocker | [ ] |
| **TC-F05-07-10** | `US-07/AC1` | `UI` | Dropdown Submenu hiển thị trên Frontend | 1. Tạo menu cha "Shop" → thêm 2 items con (Áo, Quần).<br>2. Publish và truy cập site. | - Hover/Click "Shop" → Dropdown xuất hiện với 2 items con.<br>- Animation mượt, không che content bên dưới. | High | [ ] |
| **TC-F05-07-11** | `US-07/AC2` | `Val` | Logo Auto-Scale theo Header | 1. Upload logo ảnh gốc 500×500px vào Header. | - Logo scale xuống max-height 60px, giữ aspect ratio.<br>- Kiểm tra cả logo ngang và logo vuông. | High | [ ] |
| **TC-F05-07-12** | `US-07/AC2` | `Logic` | Favicon sinh ngầm không chặn UX | 1. Thay đổi Logo mới.<br>2. Tiếp tục thao tác editor bình thường. | - Quá trình sinh Favicon diễn ra ngầm, không chặn UI.<br>- Sau vài giây, favicon mới hiện trên tab trình duyệt. | High | [ ] |

---
### US-08: Drag-and-Drop Component Library (5 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-08-01** | `US-08/UI` | `UI` | Hiển thị danh sách Block Library | 1. Mở panel Component Library trong Sidebar. | - Danh sách đầy đủ các block phân loại Ecommerce / Content tĩnh. | Medium | [ ] |
| **TC-F05-08-02** | `US-08/Stt` | `State` | Fallback khi API Block List lỗi | 1. Ngắt kết nối tới API danh sách Blocks.<br>2. Mở panel Component Library. | - Hiển thị Empty State với nút "Thử lại". | Priority | [x] |
| **TC-F05-08-03** | `US-08/DND` | `DND` | Kéo thả Component vào Iframe | 1. Kéo một block từ Library.<br>2. Thả vào vị trí mong muốn trong Preview. | - Drop indicator hiển thị mượt.<br>- Block được chèn đúng vị trí, không vỡ layout. | Blocker | [ ] |
| **TC-F05-08-04** | `US-08/Mob` | `Mob` | Thêm Block bằng Tap trên Mobile | 1. Xem Preview ở chế độ Mobile.<br>2. Tap vào block trong Library để thêm. | - Mobile hỗ trợ thêm block qua Tap thay vì Drag-Drop. | High | [ ] |
| **TC-F05-08-05** | `US-08/Sec` | `Race` | Chống spam API khi thêm Block liên tục | 1. Tap/Click thêm block liên tục nhiều lần. | - API được throttle, không spam request.<br>- Không gây Race Condition khi spawn block. | High | [ ] |

---

### US-09: Tùy chỉnh Trang 404 (8 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-09-01** | `US-09/AC1` | `Func` | Cập nhật nội dung trang 404 | 1. Mở Editor của trang 404.<br>2. Thêm/sửa nội dung.<br>3. Publish. | - Trang 404 tùy chỉnh hiển thị đúng khi người dùng truy cập URL không tồn tại. | High | [x] |
| **TC-F05-09-02** | `US-09/Val` | `Bound` | Bảo vệ field Slug không cho sửa | 1. Mở Editor trang 404.<br>2. Thử sửa đường dẫn slug `"/404"`. | - Ô Slug bị disabled, không cho chỉnh sửa. | Blocker | [x] |
| **TC-F05-09-03** | `US-09/Flow` | `Flow` | Không cho Unpublish trang 404 | 1. Thử chuyển trang 404 về trạng thái Unpublish. | - Nút Unpublish bị ẩn/disabled cho trang 404 hệ thống. | High | [x] |
| **TC-F05-09-04** | `US-09/AC1` | `Func` | Trang 404 không thể xóa | 1. Mở Page Manager.<br>2. Tìm trang "404 Not Found".<br>3. Thử xóa. | - Nút Delete bị ẩn/disabled.<br>- Không thể xóa trang 404 bằng bất kỳ cách nào. | Blocker | [ ] |
| **TC-F05-09-05** | `US-09/AC1` | `Flow` | Mở trang 404 từ Page Manager vào Editor | 1. Trong Page Manager, click vào trang "404 Not Found". | - Editor mở đúng trang 404 trong Preview.<br>- Đầy đủ công cụ: AI Chat, Components, WYSIWYG, drag/drop.<br>- Slug hiện `/404` và không sửa được. | Blocker | [ ] |
| **TC-F05-09-06** | `US-09/AC1` | `Func` | Thêm nút CTA "Back to Homepage" | 1. Trong Editor trang 404, thêm nút "Back to Homepage" với link về "/". | - Nút CTA hiển thị đúng trên preview.<br>- Click nút navigate về trang chủ.<br>- Auto-save trigger sau 3s. | High | [ ] |
| **TC-F05-09-07** | `US-09/AC2` | `API` | HTTP Status 404 trả đúng khi slug không tồn tại | 1. Publish site.<br>2. Truy cập URL slug không tồn tại (vd: `/this-page-does-not-exist`). | - Response trả về **HTTP 404 Not Found** (không phải 200).<br>- Kiểm tra qua DevTools Network hoặc curl. | Blocker | [ ] |
| **TC-F05-09-08** | `US-09/AC2` | `UI` | Custom 404 hiển thị thay vì trang lỗi mặc định | 1. Publish site.<br>2. Truy cập URL bất kỳ không tồn tại. | - Trang 404 tùy chỉnh của owner hiển thị (không phải "This site can't be reached").<br>- Header/Footer global vẫn render đầy đủ. | Blocker | [ ] |

---

### US-10: Publish & Unpublish Flow (Live & Maintenance) (12 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-10-01** | `US-10/AC1` | `Flow` | Publish site lên subdomain | 1. Nhấn Publish trên Editor toolbar.<br>2. Đợi quá trình deploy hoàn tất. | - Site live trên subdomain trong vòng 30 giây.<br>- DNS trỏ đúng. | Blocker | [x] |
| **TC-F05-10-02** | `US-10/AC2` | `Flow` | Re-Publish sau khi sửa nội dung | 1. Sửa text trên site đã live.<br>2. Nhấn Re-Publish. | - Nội dung mới được cập nhật trên tất cả endpoint.<br>- Cache được xóa. | High | [x] |
| **TC-F05-10-03** | `US-10/AC3` | `Flow` | Unpublish → chuyển Maintenance mode | 1. Nhấn Unpublish site. | - Truy cập site trả về `503 Service Unavailable`.<br>- Hiển thị trang "Đang bảo trì". | Blocker | [x] |
| **TC-F05-10-04** | `US-10/Err` | `Net` | Mất mạng giữa chừng khi Deploy | 1. Cắt kết nối mạng trong khi đang Publish. | - Timeout sau 30 giây.<br>- Hiển thị alert "Lỗi đồng bộ hệ thống".<br>- Site không bị trạng thái nửa vời. | Blocker | [ ] |
| **TC-F05-10-05** | `US-10/Race` | `Race` | Double-click nút Publish | 1. Nhấn nút Publish hai lần liên tiếp nhanh. | - Nút Disabled ngay sau lần click đầu.<br>- Chỉ gọi 1 deploy request. | Blocker | [x] |
| **TC-F05-10-06** | `US-10/UI` | `UI` | Hiển thị badge Live và link mở site | 1. Publish site thành công.<br>2. Quan sát UI trên Editor. | - Badge "Live" màu xanh hiển thị.<br>- Nút "Mở Web" mở site trong tab mới. | Medium | [ ] |
| **TC-F05-10-07** | `US-10/AC1` | `UI` | Pre-publish Checklist trước khi Publish | 1. Click nút "Publish" trên Editor toolbar. | - Modal Pre-publish Checklist hiện: ✅ Có trang Home, ⚠️ SEO score.<br>- Thiếu trang Home → ❌ chặn Publish.<br>- Nếu đủ điều kiện → nút "Publish ngay" active. | Blocker | [ ] |
| **TC-F05-10-08** | `US-10/AC1` | `UX` | Toast thành công sau Publish | 1. Publish site thành công. | - Toast "🎉 Website đã live!" hiển thị kèm link subdomain.<br>- Click link mở subdomain trong tab mới.<br>- Toast tự ẩn sau 5–8 giây. | High | [ ] |
| **TC-F05-10-09** | `US-10/AC2` | `API` | Sitemap tự động cập nhật sau Re-Publish | 1. Publish site → sửa nội dung → Re-Publish.<br>2. Truy cập `/sitemap.xml`. | - File sitemap.xml cập nhật URLs mới nhất.<br>- Timestamp `lastmod` thay đổi.<br>- Tất cả published pages có trong sitemap. | High | [ ] |
| **TC-F05-10-10** | `US-10/AC3` | `API` | HTTP 503 khi Maintenance Mode | 1. Unpublish site.<br>2. Truy cập subdomain từ browser/curl. | - Response trả về **HTTP 503 Service Unavailable**.<br>- Trang "Đang bảo trì" hiển thị. | Blocker | [ ] |
| **TC-F05-10-11** | `US-10/AC4` | `Flow` | Owner vào /editor khi site đang Maintenance | 1. Unpublish site.<br>2. Owner truy cập `/editor/:siteId`. | - Editor load và preview bình thường.<br>- Owner thấy đầy đủ canvas, sidebar, AI Chat.<br>- Không bị redirect ra trang Maintenance. | High | [ ] |
| **TC-F05-10-12** | `US-10/AC4` | `UI` | Notification "Website đang Tạm Ẩn" khi Maintenance | 1. Unpublish site.<br>2. Owner mở Editor. | - Header hiển thị banner màu vàng "Website đang trong trạng thái Tạm Ẩn".<br>- Badge chuyển từ "Live" (xanh) về "Draft" (xám/cam). | High | [ ] |

---

### US-11: Interactive Widgets — Cart & Social Media (14 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-11-01** | `US-11/AC1` | `UX` | Click link Social Media mở đúng tab | 1. Config Social Media block với link Facebook.<br>2. Click icon Facebook trên site đã publish. | - Mở đúng URL trong `target="_blank"`. | Priority | [x] |
| **TC-F05-11-02** | `US-11/Val` | `Val` | Validation khi URL Social rỗng | 1. Để trống ô URL trong Settings.<br>2. Nhấn Save. | - Hiển thị lỗi đỏ "URL không hợp lệ".<br>- Không lưu. | High | [ ] |
| **TC-F05-11-03** | `US-11/AC2` | `Logic` | Hiển thị thông báo khi Cart chưa kích hoạt | 1. Thêm Cart widget khi tài khoản chưa kích hoạt tính năng thương mại. | - Hiển thị Toast "Hãy kích hoạt tính năng ở Dashboard". | Blocker | [x] |
| **TC-F05-11-04** | `US-11/Flow` | `Flow` | Đồng bộ Cart index khi thêm sản phẩm | 1. Thêm sản phẩm vào giỏ hàng từ storefront. | - Số lượng badge trên icon Cart cập nhật mượt mà.<br>- Layout không vỡ. | Medium | [ ] |
| **TC-F05-11-05** | `US-11/AC1` | `Func` | Drag-drop Social Media vào canvas | 1. Kéo component "Social Media" từ Library vào Preview. | - Block Social Media xuất hiện với icons mặc định (FB, WA, IG, LinkedIn, YT).<br>- Auto-save trigger. | Blocker | [ ] |
| **TC-F05-11-06** | `US-11/AC1` | `Func` | Config 5 icons Social Media | 1. Click block Social Media → Settings panel.<br>2. Điền URL cho Facebook, WhatsApp, Instagram, LinkedIn, Youtube. | - Mỗi platform hiển thị đúng icon.<br>- Preview cập nhật realtime.<br>- Save không lỗi. | High | [ ] |
| **TC-F05-11-07** | `US-11/AC1` | `UI` | Icons Social render đúng trên Published site | 1. Publish site.<br>2. Truy cập subdomain, kiểm tra vùng Social Media. | - 5 icons hiển thị đúng logo từng nền tảng.<br>- Click từng icon mở `target="_blank"` đúng URL.<br>- Icons responsive trên mobile. | High | [ ] |
| **TC-F05-11-08** | `US-11/AC1` | `Sec` | XSS injection vào Social URL | 1. Nhập `<script>alert('xss')</script>` hoặc `javascript:alert(1)` vào ô URL. | - Hệ thống sanitize input.<br>- Không execute script.<br>- Không có XSS vector trên published site. | Blocker | [ ] |
| **TC-F05-11-09** | `US-11/AC1` | `Val` | URL rỗng/chỉ khoảng trắng | 1. Để trống hoặc nhập chỉ spaces vào URL Social.<br>2. Save. | - Validation hiện lỗi đỏ "URL không hợp lệ".<br>- Icon tương ứng bị ẩn trên published site. | High | [ ] |
| **TC-F05-11-10** | `US-11/AC2` | `Func` | Drag-drop Cart Button vào canvas | 1. Kéo component "Cart Button" từ Library vào Header hoặc canvas. | - Icon giỏ hàng hiển thị trên preview.<br>- Badge số lượng (0 hoặc ẩn nếu trống).<br>- Layout Header không vỡ. | High | [ ] |
| **TC-F05-11-11** | `US-11/AC2` | `Flow` | Click Cart → xem chi tiết giỏ hàng | 1. Trên published site, click icon giỏ hàng. | - Mở giao diện chi tiết giỏ hàng (popover hoặc redirect `/cart`).<br>- Hiển thị danh sách, số lượng, giá.<br>- Giỏ trống → empty state. | Blocker | [ ] |
| **TC-F05-11-12** | `US-11/AC2` | `Flow` | "Mua hàng" → Checkout redirect | 1. Trong giao diện giỏ hàng, nhấn "Mua hàng". | - Redirect sang trang Checkout.<br>- Thông tin giỏ hàng được truyền đầy đủ. | Blocker | [ ] |
| **TC-F05-11-13** | `US-11/AC2` | `UI` | Cart empty state | 1. Click Cart khi giỏ hàng đang trống. | - Hiển thị "Giỏ hàng trống" với CTA "Tiếp tục mua sắm".<br>- Nút "Mua hàng" disabled/ẩn. | High | [ ] |
| **TC-F05-11-14** | `US-11/AC2` | `Race` | Spam click "Mua hàng" | 1. Click nhanh 3–5 lần vào nút "Mua hàng". | - Nút Disabled sau lần click đầu (loading state).<br>- Chỉ gọi API Checkout 1 lần.<br>- Không tạo duplicate orders. | Blocker | [ ] |

---

### US-12: Global Business Info & Settings Panel (14 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-12-01** | `US-12/AC1` | `UI` | Hiển thị Global Settings Panel | 1. Mở Editor, click vào vùng nền trống (không phải block). | - Panel bên phải hiển thị bộ cài đặt Contact, Social Media, Colors, Fonts. | Medium | [ ] |
| **TC-F05-12-02** | `US-12/AC2` | `DB` | Binding dữ liệu Business Info | 1. Nhập Email và số Hotline vào Business Info.<br>2. Save. | - Dữ liệu được lưu và render đúng lên Header/Footer trên Preview. | Blocker | [x] |
| **TC-F05-12-03** | `US-12/Del` | `State` | Xóa Logo → fallback về tên cửa hàng | 1. Xóa logo hiện tại trong Settings. | - Logo bị xóa.<br>- Tự động fallback hiển thị tên cửa hàng dưới dạng text. | High | [ ] |
| **TC-F05-12-04** | `US-12/Val` | `Val` | Validation Email Contact sai định dạng | 1. Nhập email sai định dạng (vd: `user@@domain`).<br>2. Save. | - Zod bắt lỗi, hiển thị lỗi đỏ.<br>- Không gọi API lưu. | High | [x] |
| **TC-F05-12-05** | `US-12/Alert` | `Safe` | Cảnh báo khi thoát khi chưa lưu | 1. Sửa Email trong Settings.<br>2. Nhấn nút đóng panel hoặc chuyển trang. | - Modal xác nhận "Bạn chưa lưu, thoát không?" xuất hiện. | High | [ ] |
| **TC-F05-12-06** | `BR-08.1` | `Limit` | Giới hạn độ dài Tên Cửa hàng | 1. Nhập tên cửa hàng vượt quá 150 ký tự. | - Input field chặn nhập, không cho vượt giới hạn. | Priority | [ ] |
| **TC-F05-12-07** | `US-12/AC2` | `Val` | Phone format validation | 1. Nhập `0912-abc-!@#` vào field Hotline.<br>2. Save. | - Validation chặn: chỉ chấp nhận số và dấu `-`/space.<br>- Hiển thị lỗi đỏ.<br>- Tối đa 15 ký tự (ITU-T E.164). | High | [ ] |
| **TC-F05-12-08** | `US-12/AC3` | `Val` | Cảnh báo Meta Description > 160 ký tự | 1. Nhập 200+ ký tự vào Meta Description. | - Hiện warning vàng "Quá dài, Google sẽ cắt bớt".<br>- Không block save.<br>- Counter hiện số ký tự đã nhập/160. | Medium | [ ] |
| **TC-F05-12-09** | `US-12/DoD` | `State` | Panel tự chuyển khi focus/unfocus block | 1. Click vào nền trắng → Global Settings hiện.<br>2. Click vào Block → Block Settings hiện.<br>3. Click vào nền trắng lại. | - Panel chuyển mượt mà theo context.<br>- Không bị kẹt ở Block Settings khi click ra ngoài. | Blocker | [ ] |
| **TC-F05-12-10** | `US-12/AC1` | `State` | Accordion giữ trạng thái khi chuyển trang | 1. Mở Accordion "Contact Info" trong Global Settings.<br>2. Chuyển sang page khác.<br>3. Quay lại Global Settings. | - Accordion "Contact Info" vẫn mở.<br>- Dữ liệu đã nhập không bị mất. | High | [ ] |
| **TC-F05-12-11** | `US-12/AC2` | `Sec` | XSS injection vào Business Name/Address | 1. Nhập `<img src=x onerror=alert(1)>` vào Business Name hoặc Address. | - Input được sanitize.<br>- Không execute script trên Preview.<br>- Header/Footer hiển thị text escaped. | Blocker | [ ] |
| **TC-F05-12-12** | `US-12/AC3` | `Val` | Upload file không phải ảnh cho Social Thumbnail | 1. Upload file `.pdf` hoặc `.exe` vào "Social Share Thumbnail". | - Hệ thống từ chối với lỗi "Chỉ chấp nhận JPG, PNG, WebP".<br>- Không upload. | High | [ ] |
| **TC-F05-12-13** | `US-12/AC3` | `API` | SEO meta inject vào `<head>` trên published site | 1. Điền Meta Description + Title trong SEO Settings.<br>2. Publish.<br>3. View Source trang. | - `<head>` chứa `<meta name="description" content="...">` đúng nội dung đã nhập.<br>- `<title>` tag đúng. | Blocker | [ ] |
| **TC-F05-12-14** | `US-12/AC3` | `UI` | OG:image verification | 1. Upload Social Share Thumbnail.<br>2. Publish.<br>3. View Source. | - `<head>` chứa `<meta property="og:image" content="[URL ảnh]">`.<br>- Khi share lên Facebook/Zalo, thumbnail hiển thị đúng.<br>- Kích thước OG image ≥ 1200×630px. | High | [ ] |

---

### US-13: Page-Level SEO & AI Optimization (14 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-13-01** | `US-13/AC1` | `Func` | Nhập Meta Title và Description thủ công | 1. Mở SEO Settings của một page.<br>2. Nhập Meta Title và Description. | - Google preview snippet hiển thị đúng nội dung theo thứ tự: Title, URL, Description. | High | [ ] |
| **TC-F05-13-02** | `US-13/AI` | `AI` | Auto-Gen AI sinh Meta Description | 1. Click "✨ Tự động Tối ưu SEO".<br>2. Quan sát kết quả. | - AI sinh ra Meta Title và Description phù hợp nội dung trang.<br>- Điền tự động vào input fields. | Blocker | [x] |
| **TC-F05-13-03** | `US-13/Lim` | `AI` | Rate Limit khi spam AI generate | 1. Click "✨ Tự động Tối ưu SEO" hơn 15 lần liên tiếp. | - Trả về `429 Too Many Requests`.<br>- Hiển thị thông báo đỏ về giới hạn rate. | Blocker | [x] |
| **TC-F05-13-04** | `BR-08.1` | `Limit` | Cảnh báo Meta Title quá dài | 1. Nhập chuỗi > 60 ký tự vào Meta Title. | - Warning vàng "Quá dài, Google sẽ cắt bớt".<br>- Google preview cắt text với "...".<br>- Không block save. | Priority | [ ] |
| **TC-F05-13-05** | `US-13/Stt` | `State` | Lỗi mạng khi AI đang generate | 1. Cắt mạng trong khi AI đang sinh SEO. | - Input field giữ trống.<br>- Toast thông báo lỗi mạng.<br>- Nút "Tối ưu" enable lại. | High | [ ] |
| **TC-F05-13-06** | `US-13/AC1` | `Val` | Meta Title counter > 60 ký tự | 1. Nhập 80+ ký tự vào Meta Title. | - Counter hiện số ký tự đã nhập/60.<br>- Warning vàng xuất hiện.<br>- Không block save. | Medium | [ ] |
| **TC-F05-13-07** | `US-13/AC1` | `Val` | URL Slug tự động slugify | 1. Nhập "Xin Chào Thế Giới! @#$" vào URL Slug field. | - Tự động chuyển thành `xin-chao-the-gioi`.<br>- Loại dấu cách, đặc biệt, lowercase.<br>- Preview URL cập nhật realtime. | High | [ ] |
| **TC-F05-13-08** | `US-13/AC2` | `State` | AI generate → sửa thủ công → AI lại | 1. Click AI generate → AI điền Meta.<br>2. Sửa thủ công Meta Title.<br>3. Click AI lần 2. | - Modal confirm "Nội dung sẽ bị ghi đè. Tiếp tục?" xuất hiện.<br>- Chọn "Hủy" → giữ nguyên text cũ. | High | [ ] |
| **TC-F05-13-09** | `US-13/AC2` | `State` | Khóa URL Slug sau khi page đã publish | 1. Publish một page.<br>2. Vào SEO Settings, kiểm tra URL Slug field. | - URL Slug field disabled/readonly.<br>- Tooltip "Không thể đổi Slug sau khi đã publish". | Blocker | [ ] |
| **TC-F05-13-10** | `US-13/AC1` | `Sec` | XSS trong Meta Title/Description | 1. Nhập `<script>alert('xss')</script>` vào Meta Title.<br>2. Publish và View Source. | - `<meta>` tag không chứa raw script.<br>- HTML entities escaped đúng. | Blocker | [ ] |
| **TC-F05-13-11** | `US-13/AC2` | `Neg` | AI generate trên trang trống | 1. Tạo page mới trống.<br>2. Click "✨ Tự động Tối ưu SEO". | - Hiện toast/warning "Trang chưa có nội dung. Vui lòng thêm block trước."<br>- Không crash, không trả về chuỗi rỗng. | High | [ ] |
| **TC-F05-13-12** | `US-13/AC2` | `Race` | Spam click "✨ Tự động Tối ưu SEO" | 1. Click nhanh 3–5 lần vào nút AI generate. | - Nút disabled + spinner sau lần click đầu.<br>- Chỉ gọi API 1 lần.<br>- Kết quả điền đúng, không bị ghi đè bởi response chậm. | Blocker | [ ] |
| **TC-F05-13-13** | `US-13/AC1` | `UI` | Google preview snippet cập nhật realtime | 1. Gõ Meta Title + Description từng ký tự. | - Google preview bên dưới cập nhật realtime (không cần save).<br>- Format: Title (xanh dương), URL (xanh lá), Description (xám). | High | [ ] |
| **TC-F05-13-14** | `US-13/AC2` | `UI` | Loading state khi AI đang generate | 1. Click "✨ Tự động Tối ưu SEO". | - Nút chuyển sang loading spinner + "Đang tối ưu...".<br>- Input fields disabled.<br>- Sau khi AI trả về: fields điền data, nút enable lại. | High | [ ] |

---

### US-14: Mobile Web UX — Adaptive Editor Interface (10 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-14-01** | `US-14/AC1` | `Env` | Viewport boundary: 767px → fullscreen preview | 1. Mở Editor ở viewport 768px → thu nhỏ xuống 767px. | - Tại 768px: layout 3-panel bình thường.<br>- Tại 767px: split-screen tắt, Preview chiếm 100%.<br>- FAB AI Chat xuất hiện góc phải dưới.<br>- Không vỡ layout ở ranh giới. | Blocker | [ ] |
| **TC-F05-14-02** | `US-14/AC1` | `Mob` | Landscape orientation trên mobile | 1. Mở Editor trên mobile portrait.<br>2. Xoay ngang sang landscape (667×375). | - Editor vẫn ở mobile mode (short axis < 768px).<br>- Bottom Sheet không tràn.<br>- FAB vẫn hiển thị đúng vị trí. | High | [ ] |
| **TC-F05-14-03** | `US-14/AC1` | `Env` | iOS Safari — FAB không bị che bởi address bar | 1. Mở Editor trên iPhone Safari.<br>2. Cuộn trang để address bar xuất hiện/ẩn. | - FAB luôn hiển thị trên viewport thực tế.<br>- Bottom Sheet không bị đẩy xuống dưới màn hình.<br>- Dùng `dvh` hoặc JS viewport calculation. | High | [ ] |
| **TC-F05-14-04** | `US-14/AC1` | `State` | Resize browser desktop → mobile giữa chừng edit | 1. Đang edit text trên desktop (3-panel).<br>2. Thu nhỏ browser xuống < 768px. | - Layout chuyển sang mobile mode mượt mà.<br>- Dữ liệu chưa save không bị mất.<br>- Preview hiển thị đúng nội dung đang edit. | High | [ ] |
| **TC-F05-14-05** | `US-14/AC2` | `Func` | Tap-to-Add component trên mobile | 1. Mở Component Library trên mobile.<br>2. Tap vào block "Hero". | - Block "Hero" tự động chèn xuống cuối trang.<br>- Màn hình auto-scroll tới block vừa thêm.<br>- Drag-and-drop bị tắt (không có drag handle). | Blocker | [ ] |
| **TC-F05-14-06** | `US-14/AC2` | `Race` | Rapid tap-to-add nhiều blocks liên tục | 1. Tap nhanh 5 lần liên tiếp vào các blocks trong Library. | - Throttle chặn spam.<br>- Blocks thêm tuần tự, không bị trùng lặp.<br>- Auto-scroll tới block cuối cùng được thêm. | High | [ ] |
| **TC-F05-14-07** | `US-14/AC3` | `UX` | Bottom Sheet mở khi tap element | 1. Trên mobile, tap vào một text element trên Preview. | - Bottom Sheet vuốt lên từ dưới (không phải floating popup).<br>- Chứa formatting tools + AI commands.<br>- Backdrop mờ phía sau. | Blocker | [ ] |
| **TC-F05-14-08** | `US-14/AC3` | `State` | Bottom Sheet open → xoay thiết bị | 1. Mở Bottom Sheet bằng cách tap element.<br>2. Xoay device từ portrait sang landscape. | - Bottom Sheet reposition đúng.<br>- Content không tràn.<br>- Input focus được duy trì. | Medium | [ ] |
| **TC-F05-14-09** | `US-14/AC1` | `Net` | AI Chat qua FAB — lỗi mạng | 1. Mở FAB Chat trên mobile.<br>2. Gửi prompt khi mất kết nối. | - Toast lỗi hiển thị trên FAB.<br>- Nội dung chat input được giữ nguyên.<br>- Nút retry xuất hiện. | High | [ ] |
| **TC-F05-14-10** | `US-14/AC2` | `Perf` | Tap-to-Add trên page 50+ blocks | 1. Trang có 50+ blocks.<br>2. Tap thêm 1 block mới. | - Auto-scroll mượt tới vị trí block mới.<br>- Không lag/jank trên mobile.<br>- DOM render trong < 1 giây. | Medium | [ ] |

---

## 4. Hành Trình E2E UAT Flow

| Bước | Hành Động | Kết Quả Mong Đợi |
|:---:|:---|:---|
| 1 | Truy cập Editor với Site ID mới, chat lệnh thay đổi nền website. | Preview cập nhật realtime qua SSE < 3 giây (TC-F05-01-02). |
| 2 | Kéo Cart, Form Contact từ Library vào Iframe. Sửa text bằng Double-Click WYSIWYG. | Layout không vỡ trên mobile, Favicon tự sinh sau khi upload Logo (TC-F05-07-03). |
| 3 | Thêm trang "Khuyến Mãi", xóa trang cũ rồi Undo. | Menu Header cập nhật realtime, Undo Toast hoạt động đúng (TC-F05-02-11). |
| 4 | Kiểm tra Pre-Publish Checklist, Publish site. | Site live trên subdomain < 30 giây, không lỗi CDN/SSL (TC-F05-10-01, 07). |

---

## 5. Tiêu Chí Đánh Giá Chất Lượng Phát Hành (Quality Gates)

| Nhóm Kiểm Thử | Trạng Thái | Ghi Chú |
|---|---|---|
| **1. UI/UX & UI States** | [ ] Not Run | Skeleton, Empty State, Loading Indicator, Toast, Badge. |
| **2. AI Logic & Recovery** | [ ] Not Run | Rate Limit, Token overflow, SSE recovery, Undo/Redo. |
| **3. Negative Form Validation** | [ ] Not Run | Zod validation, XSS injection, file type check, blank fields. |
| **4. E2E UAT Approval** | [ ] Not Run | PO review toàn bộ hành trình publish thành công 100%. |

