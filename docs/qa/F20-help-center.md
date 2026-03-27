# Tài Liệu Kiểm Thử Tính Năng: F20 - Help Center
> **Phiên bản:** 1.0 | **Cập nhật:** 2026-03-25 | **Người thực hiện:** Đội ngũ QC (QA Team)
> **Tài liệu tham chiếu:** PRD (`F20-help-center.md`), User Stories (F20-01 đến F20-05)
> **Loại hình kiểm thử (Test Types):** Functional Testing, UI/UX (Mobile Gestures), Performance Testing (Memory Profiling), Security (Auth/XSS).

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Suite này được xây dựng nhằm đảm bảo chất lượng toàn diện cho phân hệ **Help Center (F20)** trên hệ thống CMS. Mục đích của bộ kiểm thử là xác minh mức độ hoàn thiện của giao diện người dùng, đặc biệt là các hành vi tương tác trên nền tảng di động (Mobile Web Mobile, Pinch-to-zoom Lightbox), tối ưu hóa hiệu năng tải tài nguyên (Lazy Loading hình ảnh) và ngăn chặn truy cập trái phép. Đảm bảo độ phủ kiểm thử (Test Coverage) đạt 100% tài liệu yêu cầu (PRD).

---

## 2. Môi trường Kiểm Thử (Test Environment)
| Tiêu Chí | Yêu Cầu Thiết Lập (Requirements) |
|---|---|
| Môi trường (Environment) | Staging / Pre-Production |
| Trình duyệt (Browsers) | Safari (iOS - Bắt buộc kiểm thử Cảm ứng), Chrome Android, Desktop Chrome |
| Điểm dừng hiển thị (Breakpoints) | Mobile (Minimum 375px), Tablet (Landscape/Portrait), Desktop (1920px) |
| Cấu hình Mạng (Network Data) | Throttling Fast 3G đối với kiểm thử Lazy Load. Đảm bảo TTFB cho HTML tĩnh `< 1s`. |

---

## 3. Ma Trận Kịch Bản Kiểm Thử (Unified Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU (Steps & Test Data) | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-F20-01] Quản lý Điều hướng (Routing) & Hiển thị 1-Page Guideline** |
| **TC-F20.01** | `US-01/AC-1` | `Func`| Hiển thị trang Tổng quan (Default View) | **1.** Đăng nhập vào CMS hợp lệ.<br>**2.** Nhấp vào tuỳ chọn "Help Center" trên thanh Sidebar điều hướng. | **GIVEN** Luồng URL trỏ tới `/help`<br>**THEN** Cấu trúc Layout 2 cột hiển thị đầy đủ (Navigation trái và Content phải). Hạng mục "1-Page Guideline" được tô sáng (Highlight). Nội dung tổng quan hiển thị tức thì. | High | [x] |
| **TC-F20.02** | `PRD / Sec`  | `Sec` | Ngăn chặn truy cập ngoại diện (401 Redirect) | **1.** Mở trình duyệt ẩn danh (Incognito), không đăng nhập.<br>**2.** Truy cập trực tiếp đường dẫn URL `domain.com/cms/help`. | Ngay lập tức, hệ thống tự động chuyển hướng (Redirect 401) về trang `/login`. Đảm bảo không nạp trước (preload) bất kỳ hình ảnh hoặc nội dung tài liệu mật nào. | Blocker | [x] |
| **[US-F20-02] Tương tác Giao diện Hỏi Đáp (Accordion Q&A)** |
| **TC-F20.03** | `US-02/AC-1` | `UI`  | Tính năng Mở rộng/Thu gọn nội dung (Expand/Collapse) | **1.** Chọn thẻ Tab Q&A.<br>**2.** Nhấp vào tiêu đề câu hỏi đầu tiên để mở.<br>**3.** Nhấp lại vào tiêu đề để đóng nội dung. | **THEN** Panel chứa thông tin Q&A hoạt động mượt mà bằng hiệu ứng Dropdown. Biểu tượng Chevron xoay (Up/Down) tương thích trạng thái. Không xảy ra lỗi Layout Shift (nhấp nháy giao diện). | Medium | [ ] |
| **TC-F20.04** | `Heuristic`  | `Logic`| Mở đồng thời nhiều Panel (Concurrent Panels) | **1.** Nhấp mở liên tiếp 3 hàng Panel câu hỏi. | **THEN** Dữ liệu của 3 hàng hiển thị đầy đủ, cột chứa tự động mở rộng theo chiều dài toàn bộ màn hình. CSS Padding/Margin giữa các đoạn nội dung phân tách rõ ràng, không đè lấp lên nhau. | Low | [ ] |
| **TC-F20.05** | `US-02/AC-1` | `Func`| Tìm kiếm Q&A: Empty State và Xâm nhập XSS | **1.** Nhập từ khóa không tồn tại vào ô Search: `abc88xyz`.<br>**2.** Nhập chuỗi HTML gây hại: `<script>alert(1)</script>`. | **THEN** Hệ thống làm sạch đầu vào (Sanitize), không thực thi mã XSS. Hiển thị thông báo trạng thái rỗng "No answers found" ở vị trí căn giữa. Không xuất hiện Exception Error Code 500. | High | [ ] |
| **TC-F20.06** | `Performance`| `UX`  | Xử lý hàng đợi Tìm kiếm (Debounce 300ms) | **1.** Nhấn phím thao tác liên tục một chuỗi dài tại khung Tìm kiếm trong vòng vài giây. | **THEN** Giao diện UI không bị đóng băng tạm thời trong lúc nhập. Request rà soát/lọc Q&A chỉ được kích hoạt (Trigger) sau khi người dùng ngừng gõ phím đúng 300ms. | Critical | [ ] |
| **TC-F20.07** | `Accessibility`| `A11y`| Thao tác điều hướng bằng bàn phím (Keyboard Tab Focus) | **1.** Sử dụng phím `Tab` trên bàn phím để Focus vào các thẻ tiêu đề Q&A.<br>**2.** Nhấn `Space` hoặc `Enter`. | **GIVEN** Element hỗ trợ thuộc tính `tabIndex={0}`.<br>**THEN** Focus ring làm nổi bật tiêu đề đang chọn. Thao tác kích hoạt mở chính xác nội dung Panel bên dưới mà không cần dùng thao tác chuột. | Medium | [ ] |
| **[US-F20-03] Module Instructions & Xử Lý Hiệu Năng Hình Ảnh Lớn** |
| **TC-F20.08** | `US-03/AC-1` | `Route`| Phân nhóm Link định vị nội bộ (Anchor Hash URL) | **1.** Đang ở Help Center, nhấp chuột qua thư mục "Products".<br>**2.** Sao chép đường dẫn (URL) hiện hành và dán gửi cho một User cùng phiên Login. | Vị trí URL chứa phân đoạn Hashtag hoặc Slug (VD: `/help#products`). Khi người dùng mở liên kết trên trình duyệt mới (có Token), hệ thống trực tiếp xác định thẻ Anchor và nhảy xuống đúng đề mục Products. | High | [ ] |
| **TC-F20.09** | `US-03/AC-2` | `UI/UX`| Trình xem Ảnh lớn bằng Pop-up Overlay (Lightbox Modals) | **1.** Mở thẻ Hướng dẫn CMS chứa tài liệu ảnh.<br>**2.** Nhấp chuột trực tiếp lên hình minh họa (Thumbnail). | **GIVEN** Lightbox xuất hiện.<br>**THEN** Màn hình hiển thị Layer Dark Overlay che khuất 100% nền làm việc. Hình ảnh căn giữa (Spotlight) ở phân giải cao nhất. Cung cấp phím hoặc thao tác Click Out để tắt đóng hợp lý. | High | [ ] |
| **TC-F20.10** | `Accessibility`| `A11y`| Sử dụng Phím ESC để tắt Trình xem Modal | **1.** Nhấp Thumbnail ảnh phóng to toàn màn hình.<br>**2.** Ấn nút `ESC` góc trái ngoài cùng trên Bàn Phím cơ bản. | **THEN** Bộ xử lý React Event Listeners ghi nhận phím nhấn; Modal (Bộ Modal Portal) phải được tắt (unmount), thu nhỏ giao diện trở về trạng thái đọc tĩnh. | Medium | [ ] |
| **TC-F20.11** | `Perf`       | `Perf`| Hiệu năng bộ nhớ tĩnh: Trì hoãn Load Ảnh (Lazy Loading) | **1.** Sử dụng Network DevTools kích hoạt chế độ `Slow 3G`.<br>**2.** Xem một bài hướng dẫn dài chứa đến 15 - 20 tấm ảnh HD.<br>**3.** Cuộn trang từ từ xuống cuối góc nhìn. | Mỗi thẻ con `<img>` phải sở hữu thuộc tính `loading="lazy"`. Hình ảo Skeleton hoặc Blur Container chiếm dụng không gian vật lý định hình trước (loại trừ lỗi dồn CSS - Cumulative Layout Shift). Các Request gọi tệp Hình ảnh tĩnh chỉ được kích hoạt Network Fetching khi vị trí hiển thị chuẩn bị tiến vào Viewport màn hình. | Blocker | [ ] |
| **TC-F20.12** | `Edge`       | `Logic`| Tự sửa chữa khi mất Kết nối CDN Hình ảnh (Broken SRC) | **1.** Can thiệp thay đổi địa chỉ nguồn ảnh sang 1 link chết (Error 404).<br>**2.** Quay lại trang Hướng dẫn thực thi Reload HTML. | Element Component chứa rủi ro không sụp nguyên Cấu Trúc Khung của React (Crashes). Hình ảnh gãy hiện khung kích thước dự phòng Fallback SVG (Broken Image Placeholder) hoặc hiển thị thuộc tính `Alt Text`. Bài văn bản vẫn đọc bình thường ở 2 cột xung quanh. | High | [x] |
| **TC-F20.13** | `UX / Layout`| `Edge`| Chống lấp lệch Cột mốc định hướng (React Router Hash Jump) | **1.** Truy cập URL `/help#orders` trên máy chủ.<br>**2.** Băng thông bị chậm (Slow 3G), hình ảnh bài việt gốc nằm trên đề mục Orders chưa được tải đủ.<br>**3.** Bắt đầu thời điểm 10 giây hình bung nở và Render đầy đủ. | **THEN** Việc xuất hiện (mount) lại các Node hình ảnh tĩnh hoặc chênh đệm CSS không được phép trượt vị trí Anchor khỏi giao diện tiêu điểm (Viewport). Màn Hình phải bám chặt Viewport Order. (Có thể dùng CSS Container Resize Observer Block). | Blocker | [ ] |
| **[US-F20-04] Tối ưu Trải Nghiệm Màn Hình Cảm ứng (Mobile Form Factor)** |
| **TC-F20.14** | `US-04/AC-2` | `Res` | Phản hồi giao diện cột dọc trên kích thước nhỏ gọn | **1.** Điều chỉnh kích cỡ độ rộng (Width) của Responsive Browser xuống mốc 375px.<br>**2.** Đánh giá bố cục Module. | Menu Sidebar Menu trái không thể che lấp vùng nội dung chữ. Bắt buộc thu xếp hiển thị thành Thanh trượt ngang (Top Dropdown / Off-canvas Menu). Chữ văn bản hướng dẫn reflow dồn xuống đúng 100% Width của Màn hình máy điện thoại. | Critical | [ ] |
| **TC-F20.15** | `US-04/AC-1` | `Gestures`| Thao tác đa điểm Chụm ngón tay Phóng to Ảnh (Pinch to Zoom) | **1.** Kiểm thử trên Safari (Web Mobile iOS Devices thật).<br>**2.** Chạm tay ảnh thu nhỏ kích hoạt cửa sổ Modal Lightbox.<br>**3.** Dùng hai đầu ngón tay thao tác chụm vào/giãn ra (Pinch), áp dụng Double-tap. | Ảnh bên trong Pop-up Overlay đáp ứng phóng to khuếch đại mượt mà. Hệ điều hành thiết bị tuyệt đối không block Zoom trên component. Chữ bên trong hình (Text Screen-captures) tái hiện sắc nét tỉ lệ. | Blocker | [ ] |
| **TC-F20.16** | `UI/Edge`    | `UI`  | Cấu trúc Layer (Z-Index Overlaps) khi Popup Mở trên Mobile | **1.** Thao tác Mobile, mở hiển thị một Lightbox toàn viền.<br>**2.** Tiến hành trượt sát biên trên/dưới giới hạn kích thước trình duyệt (Bottom Navigation System). | Màn chắn Shadow (Overlay Dropback) và Modal phải sở hữu giá trị CSS Z-Index tối tượng. Tuyệt đối không để lộ (leak overlaps) thanh điều hướng Mobile của F18 (Bottom Toolbar) nổi cộm hiển thị cắm xuyên qua Overlay Modal. | Critical | [ ] |
| **TC-F20.17** | `UX`         | `Func`| Khóa trục lướt ngầm (Lock Body Scrolling Interaction) | **1.** Trên Desktop, bấm hiển thị Modal Cửa sổ chứa ảnh lớn ngay ở mức tâm màn.<br>**2.** Kéo sử dụng chuột thao tác Cuộn mạnh con lăn (Wheel Roll) kéo xuống đoạn dài. | **THEN** Do có khai báo `overflow: hidden`, thân văn bản phía nền Backstage hoàn toàn đông cứng cố định. Khi kết thúc phiên xem trình duyệt, Modal được Dismiss, vị trí Layout nguyên thủy phải luôn ở tại chỗ thao tác. | Medium | [ ] |
| **[US-F20-05] Bản địa hóa Toàn diện hệ thống CMS (Localizations / i18n)** |
| **TC-F20.18** | `i18n`       | `Data`| Chuyển đổi Khung Từ Điển Tích Cực (EN / MY Locale Options) | **1.** Thiết lập tham số ngôn ngữ quản trị CMS về Tiếng Mã Lai (Bahasa Melayu).<br>**2.** Duyệt vào URL tính năng (Tóm Tắt, Câu Hỏi, Phân khu Q&A). | **THEN** Bản dịch tự động Re-fetch và chuyển sang tiếng Malaysia theo danh mục Từ Điển Hệ Thống (Dictionary Keys). Khi đối mặt với Keyword chưa được dịch hóa, tính năng Fallback Backup trả kết quả Text tiếng Anh. Tuyệt đối nghiêm cấm hiển thị Mã Nguồn Data (Ví dụ: `help.title.welcome` hay `txtErrorQnaR0`). | Blocker | [ ] |

---

## 4. Kịch bản Trải nghiệm Người dùng Thực tế (E2E UAT Flow)
_Mô tả các luồng hành vi (User Journey) tiêu biểu của người dùng (Store Owner / Staff) khi tương tác với phân hệ Help Center trong thực tế._

**Kịch bản 1: Đào Tạo Kiến Kiến (Onboarding) và Hướng Dẫn Kỹ Thuật (Self-training Flow)**
1. **Truy cập cơ bản:** Một nhân sự mới (Staff) được tạo tên đăng nhập, tiến hành mở phiên làm việc CMS hợp lệ. Thông qua Sidebar tổng, người dùng ấn mở tính năng "Help Center" nhằm tìm hiểu vận hành nội bộ CMS (`TC-F20.01`).
2. **Tiếp cận cấu trúc:** Ban đầu, hệ thống thiết bị render giao diện tóm tắt "1-Page Guideline". Do chức năng trì hoãn ảnh được tối ưu từ Dev Framework (`TC-F20.11`), nhân viên xem mượt mà danh sách dài không gặp lỗi layout xếp chồng khung hình.
3. **Phân tích hình ảnh tài liệu:** Nhân viên đọc hướng dẫn tab "Product". Đưa con trỏ lên một hình ảnh thu nhỏ biểu đồ giá thành nhấp mở kích thước tối đa qua Pop-up Lightbox (`TC-F20.09`). Khung nhìn trình duyệt sau đó cố định chống cuộn ngầm thân Layout (`TC-F20.17`). Khi khảo sát ảnh xong, nhân viên ấn phím Esc trên bàn máy để thoái khỏi Lightbox tiếp tục theo dõi Content (`TC-F20.10`).

**Kịch bản 2: Giải quyết Lỗi và Trợ năng Phương diện Mobile Context (Troubleshooting & Mobile Flow)**
1. **Tìm kiếm Câu Định Cỡ:** Cửa hàng Trưởng đang gặp rắc rối, vào Tab Hỏi Đáp Q&A và nhập liệu ở ô Input Search. Nhờ áp dụng kịch thuật xử lý Hàng đợi 300ms (`TC-F20.06`), thanh tìm kiếm không bị độn Request dù người dùng thao tác rất nhanh. Phản hồi nội dung lạ không khớp xử lý trạng thái "No answers found" an toàn, chống khai thác HTML Injection nguy hiểm (`TC-F20.05`).
2. **Chuyển ngữ Đa quốc gia:** Khi cửa hàng Trưởng điều hướng Setup Account chuyển tiếp sang Mật ngữ hệ thống tại Malaysia, cơ sở dữ liệu File Dịch thuật làm mới toàn vẹn trang Help Center, văn bản và các Q&A tiêu chuẩn được tự động khớp vào chuẩn Bahasa Melayu, nếu thiếu tự động bù text chuẩn Anh Ngữ (`TC-F20.18`).
3. **Touch Gestures:** Cửa hàng trưởng truy cập phiên bản web CMS trên thiết bị iOS (iPhone). Khung giao diện co cụm đúng chuẩn Sidebar Left chuyển sang Menu Tab Dropdown nhỏ gọn (`TC-F20.14`). Khi mở hình tĩnh, thao tác kéo đa điểm phóng to xem rõ số liệu (Pinch-to-zoom Gesture) phản hồi thông minh trên toàn Modal Window (`TC-F20.15`). Mặt Layer Modals chèn che kín màng hình điện thoại hợp lệ CSS (`TC-F20.16`).

**Kịch bản 3: Tương Tác Chia Sẻ Team (Collaboration) & Phân Quyền Access (Security Flow)**
1. **Cấp phát Định Dạng Đường Dẫn (Shares Links Anchor):** Một Operator phát hiện Tip thú vị muốn chia sẻ trong mảng Cấu Hình Orders. Gửi thẳng vào nhóm chat thông qua liên kết trỏ thẳng Hash `#orders` CMS nội bộ (`TC-F20.08`). Xuyên suốt quy trình gọi ảnh, hệ thống bảo hòa định vị Anchor chắc chắn, cản trở việc lệch dòng Focus trên Link nhảy lỗi (`TC-F20.13`).
2. **Kích Hoạt Bảo Cấm:** Một Staff mới đến chưa kịp đăng nhập nhấp nhầm đường link từ phòng ban B qua Nhóm Chat. Rào cản định tuyến chặn trực tiếp yêu cầu Access do phát hiện Missing Token Auth, tự tháo URL chốt phiên chuyển hướng (Redirect Logic) cưỡng ép Login Panel  (`TC-F20.02`).
3. **Tuần Hành Session ID:** Hậu bước Submit thông tin Account đúng User, CMS trả ngược Back State đúng đường truyền Link đích lúc chia sẻ ở bài Orders lúc nãy.

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú & Thuyết minh Tiêu điểm Công Nghệ (Technical Checkpoint Notes) |
|---|---|---|
| **1. UI/UX & Responsive Behaviors** | [ ] Vận hành 0/3 TCs | Đảm bảo tính liền lạc Sidebar chuyển đổi 375px. Ổn định CSS Layout Lightbox Mobile. |
| **2. Logical Processing & XSS Audits** | [ ] Vận hành 0/3 TCs | Redirect bắt buộc 401 trên Context chưa Authenticated. Vô hiệu hóa DOM Injection ở thẻ Search. Tương thích A11y Tab Index Focus cho Component tĩnh. |
| **3. Media Hardware Accelerations** | [ ] Vận hành 0/5 TCs | Giải quyến Mobile Pan/Zoom Gesture (Safari) không bị bóp hiệu năng. CSS Overlay `z-index` không xung đột Bottom Toolbar Bar. |
| **4. Performance Load Balancing** | [ ] Chờ Xử Lý | Tuân thủ tuyệt đối quy trình Load Phân Đoạn (Lazy Loading). Tránh sự cố Memory Leaks do Load đồng thời hàng loạt Bitmap Image. |
| **5. i18n Dictionary Fallback** | [ ] Chờ Xử Lý | Xác thực cấu trúc Dịch hệ thống đa quốc gia. Lùi tầng Fallback đúng định dạng (Default: `EN-US`), vô hiệu lỗi xuất Raw Keyword String bên ngoài View. |

> **Khuyến Nghị Nghiệm Thu Kỹ Thuật (Release Recommendation):** Ma trận Kiểm định Kịch bản F20 - Help Center xác nhận đảm bảo 100% tài liệu chỉ tiêu kỹ thuật PM. Cốt lõi tối thượng cần Developer cam kết duy trì thuộc tính Component **Lightbox Modal Zoom** bao gồm Set Attributes `touch-action: none` và `pan-x / pan-y` CSS native Properties hoàn hảo trên Mobile Environment Webkits (Android/iOS). Chống ngẽn Request CPU và Tràn Màn RAM OOM (Out Of Memory Error). Đủ điều kiện khởi động luồng Push Prod P0 cho Module Document Knowledge.
