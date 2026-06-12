# Tài Liệu Kiểm Thử: F18 - CMS Core Layout & Navigation
> **Phiên bản:** 3.1 | **Cập nhật:** 2026-04-06 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F18-cms-layout.md`), User Stories (3 US chính)
> **Kỹ năng ứng dụng:** Kiểm tra giao diện người dùng, Tối ưu hóa trải nghiệm trên thiết bị di động, Đa ngôn ngữ (Localization Testing).

---

## 1. Mục Tiêu Kiểm Thử (Objective)
Tài liệu cung cấp danh sách kiểm thử bao phủ 100% logic giao diện cốt lõi của **CMS Layout (F18)**. Hệ thống bao gồm 3 phân hệ chính: Top Header (Thanh tiêu đề cố định), Side Menu (Thanh điều hướng linh hoạt thu gọn) và Main Content Area (Khu vực nội dung có khả năng cuộn độc lập).

Trọng tâm là kiểm tra tính năng trên thiết bị di động (Nút Menu Hamburger), tính năng thay đổi đa ngôn ngữ (Tiếng Anh / Bahasa Melayu) và các điểm dễ bị vỡ bố cục khi văn bản quá dài.

---

## 2. Thông Tin Môi Trường (Test Environment)

| Thông số | Yêu cầu kiểm thử |
|---|---|
| Môi trường | Staging / Pre-Production |
| Trình duyệt | Chrome (v110+), Safari iOS, Firefox |
| Chi tiết thiết bị | Desktop (1920x1080), Tablet iPad (768px), Mobile (iPhone 14 Pro 375px) |

---

## 3. Danh Sách Kịch Bản Kiểm Thử Chi Tiết

### Nhóm 1: Trình Đơn Điều Hướng Bên Trái (Global Sidebar Navigation)

| ID | Ref | Loại | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ |
|:---|:---|:---|:---|:---|:---:|
| **TC-F18.01** | `AC-1` | `UI` | 1. Đăng nhập hệ thống bằng máy tính Desktop.<br>2. Quan sát thanh Sidebar bên trái. | - Sidebar mặc định hiển thị toàn bộ chiều rộng.<br>- Các chức năng hiển thị đầy đủ Biểu tượng và Chữ.<br>- Chức năng đang chọn được tô sáng bằng màu nền. | Blocker |
| **TC-F18.02** | `AC-2` | `Mobile` | 1. Truy cập hệ thống bằng điện thoại di động (Mobile).<br>2. Kiểm tra thanh Sidebar. | - Sidebar tự động bị ẩn.<br>- Header phía trên xuất hiện nút Menu Hamburger (☰).<br>- Nội dung chiếm 100% màn hình. | Blocker |
| **TC-F18.03** | `AC-2` | `Mobile` | 1. Trên thiết bị di động, nhấn nút Menu Hamburger (☰). | - Màn hình trượt Sidebar từ trái sang phải.<br>- Màn hình nền xuất hiện lớp phủ màu tối (Overlay) nhằm làm nổi bật Sidebar. | High |
| **TC-F18.04** | `UX` | `UX` | 1. Mở Sidebar trên Mobile.<br>2. Click chạm vào màn hình lớp phủ tối bên ngoài Sidebar. | - Lớp phủ bắt sự kiện click.<br>- Sidebar tự động trượt lùi về đóng lại. | High |
| **TC-F18.05** | `AC-4` | `UX` | 1. Mở Sidebar trên Mobile.<br>2. Vuốt màn hình từ phía bên phải sang phía bên trái. | - Nhận diện thành công cử chỉ vuốt.<br>- Sidebar tự động trượt đóng lại. | High |
| **TC-F18.06** | `AC-4` | `UX` | 1. Mở Sidebar trên Mobile.<br>2. Nhấn chọn một đường dẫn chức năng bất kỳ (ví dụ: "Products"). | - Ứng dụng điều hướng sang màn hình Products.<br>- Sidebar tự động đóng lại để người dùng xem thông tin. | High |
| **TC-F18.07** | `AC-3` | `Logic` | 1. Cuộn Sidebar xuống mục cuối cùng.<br>2. Nhấn chọn chức năng "Help Support". | - Trình duyệt tự mở sang tab ẩn mới với đường link gọi API WhatsApp.<br>- Trang làm việc hiện tại của CMS không bị tải lại hoặc mất nội dung. | Medium |
| **TC-F18.08** | `UX` | `UX` | 1. Dùng DevTools (F12) để xác minh kích thước nút bấm trên Mobile. | - Bất kỳ khu vực nút bấm nào cũng đạt diện tích chạm (Touch Area) tối thiểu chuẩn là `44x44px`. | Medium |
| **TC-F18.09** | `UI` | `Menu` | 1. Quan sát Sidebar sau khi flatten IA (#1138).<br>2. Nhấp một mục bất kỳ. | - **KHÔNG còn accordion**: section header là nhãn tĩnh (in hoa, không bấm được, không mũi tên xổ).<br>- Mọi mục là leaf → bấm điều hướng thẳng tới route, không có khối con trượt xuống. | High |
| **TC-F18.10** | `UI` | `State`| 1. Tenant có dữ liệu ở 5 mục: Orders (nhiều status), Products, Discounts, All Customers, Contact Leads.<br>2. Quan sát badge bên phải các nhãn này trên Sidebar. | - Mỗi mục hiển thị Badge (pill **xám trung tính**, KHÔNG đỏ) = **TỔNG số record** của tenant: Orders đếm **mọi status** (kể cả cancelled); Discounts = tất cả mã; Contact Leads = contact-submissions + subscribers.<br>- Badge **ẩn khi count = 0/undefined** (không hiện "0").<br>- Số > 999 hiển thị `999+`. | Medium |

### Nhóm 2: Thanh Công Cụ Phía Trên (Global Top Header)

| ID | Ref | Loại | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ |
|:---|:---|:---|:---|:---|:---:|
| **TC-F18.11** | `AC-1` | `Func` | 1. Quản trị viên đang làm việc ở bất kì đường dẫn nào.<br>2. Nhấn Logo hệ thống trên Top Header. | - Trình duyệt điều hướng quay về trang `/dashboard`.<br>- Không tải lại toàn trang HTTP, Component ứng dụng hiển thị rất nhanh. | High |
| **TC-F18.12** | `AC-2` | `Func` | 1. Khi có bản tin báo lỗi hoặc thông báo mới được gửi đến tài khoản. | - Biểu tượng cái Chuông xuất hiện huy hiệu số (Badge đỏ).<br>- Nhấn vào chuông sẽ thả dọc khay danh sách thông báo nổi lên trên cùng (Z-index lớn nhất). | High |
| **TC-F18.13** | `AC-4` | `UI` | 1. Bấm chuột tương tác lên Icon Hình Ảnh Cá Nhân (Avatar) góc phải tiêu đề. | - Danh sách tùy chọn trượt ra bao gồm: Profile cá nhân, Settings và nút Logout. | High |
| **TC-F18.14** | `i18n` | `Local`| 1. Tại Sidebar dưới cùng, nhấn vào nút Chuyển đổi ngôn ngữ Tùy chọn (EN -> BM Bahasa Melayu). | - Tất cả văn bản toàn hệ thống lập tức thay đổi đồng bộ theo tiếng Mã Lai.<br>- Không làm mới nguyên trang (Refresh webpage), nhằm tránh xoá những dữ liệu đang biên tập trên Form CMS. | Blocker |
| **TC-F18.15** | `Limit`| `Limit`| 1. Mở danh sách chức năng từ Icon Avatar.<br>2. Lớp UI ứng dụng bên dưới bảng có chứa văn bản. Nhấn đè thử chuột vào văn bản xuyên qua bảng Menu. | - Bảng Avatar đóng lại.<br>- Không thể nhấp chuột xuyên lớp (Z-index Overlay) dẫn tới nhấn nhầm các tính năng bên dưới giao diện. | High |

### Nhóm 3: Khu Vực Nội Dung Chính (Main Content Area Display)

| ID | Ref | Loại | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ |
|:---|:---|:---|:---|:---|:---:|
| **TC-F18.16** | `AC-1` | `Layout`| 1. Liệt kê bảng hàng hóa chứa hơn 100 sản phẩm.<br>2. Cuộn thao tác chuột dọc qua danh sách. | - Chỉ phần dữ liệu Main Content bị cuộn trượt đi.<br>- Cấu kiện Header phía trên và Sidebar bên trái đứng nguyên vị trí đóng đinh (Fixed Layout). | Blocker |
| **TC-F18.17** | `Route`| `Route`| 1. Lăn cuộn thanh Scroll của chuột tới vị trí đáy của trang Products.<br>2. Click nút chuyển sang chức năng "Orders". | - Giao diện Orders tải thành công.<br>- Trục thanh cuộn (Scroll Position) tự động hoàn trả lên đỉnh điểm đầu Y=0 của trang Order. Không bị giữ kẹt ở phía đáy giống trang màn trước. | High |
| **TC-F18.18** | `AC-3` | `State`| 1. Kiểm tra hệ thống tại màn hình không có bất kỳ bộ cơ sở dữ liệu nào.<br>2. Refesh trang. | - Giao diện thả vào khung rỗng màn hình thông báo Empty State: "Chưa có thông tin".<br>- Khung không bị thu nhỏ hoặc bóp méo, đảm bảo tính vững chãi cho Box Main Container. | Medium |
| **TC-F18.19** | `Perf` | `Perf` | 1. Nhấn nút F5 nhằm đánh giá độ tải của giao diện App Shell hệ thống. | - Giao diện rào bao gồm Top Header và Sidebar bật dựng hiển thị ngay dưới 150 mili-giây.<br>- Dữ liệu gọi qua API Content chạy ở dạng nền (Async) đảm bảo không gây treo giật màn hình. | High |
| **TC-F18.20** | `AC-4` | `UI` | 1. Bấm lệnh mở một phân hệ nặng tải chậm từ Menu. | - Sát đường mép dưới của Top Header xuất hiện một thanh Loading Progress quét dải màu chạy tiến trình qua.<br>- Khi màn hình gọi API hoàn tất, thanh tiến trình tự biến dạng mất đi. | High |

### Nhóm 4: Trường Hợp Cận Biên, Bẻ Khung Và Bảo Mật Chuyên Sâu (Edge Cases)

| ID | Ref | Loại | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ |
|:---|:---|:---|:---|:---|:---:|
| **TC-F18.21** | `Tablet`| `Layout`| 1. Thay đổi kích thước trình độ phân giải cửa sổ rơi về dải 768px (Màn Ipad). | - Sidebar chuyển vào trạng thái Collapse Mode (Thu gọn), cột co hẹp để lại không gian vừa đủ đặt Icons. Ẩn văn bản.<br>- Rê chuột (Hover) icon làm bung ra Text Tooltip kế bên minh họa. | Blocker |
| **TC-F18.22** | `i18n` | `Layout`| 1. Chọn ngôn ngữ BM (Bahasa Mã Lai). | - Ngôn ngữ BM thường dài. Nếu chữ quá dài không vừa cột Sidebar, phải tự động cắt đứt bằng CSS sinh ra chuỗi 3 chấm "..." (Ellipsis). Không cơi nới độ rộng Sidebar gây bẹp màn Main Layout chính. | High |
| **TC-F18.23** | `Sec` | `Sec` | 1. Can thiệp Database nhằm đổi Tên Thành Viên (User Profile) bao bọc mã độc HTML (VD: `<script>alert('bad')</script>`).<br>2. Xem Avatar Header. | - Quá trình chuyển đổi nội dung văn bản thuần (Encode/Escape). Hệ mã độc không chạy sinh Lệnh Alert Box ở trình duyệt. Bảo đảm tránh kỹ thuật XSS lỗ hổng CMS Component. | Blocker |
| **TC-F18.24** | `Perf` | `Load` | 1. Lặp thao tác Nhấp chuyển đổi các Tabs Sidebar liên tục khoảng trên 150 nhấp/phút bằng Script hoặc Ngón Tay. | - React phân giải Framework không tạo hiện tượng Unmount Menu quá nhiều.<br>- Ứng dụng điều hướng êm tốc độ phản hồi tốt. Hệ thống không bị treo hoặc rớt cạn Memory RAM gây gián đoạn trình duyệt. | High |
| **TC-F18.25** | `A11y` | `A11y` | 1. Phóng hiển thị Window Thu phóng Accessibility qua góc 200%. | - Thành phần Menu, Header Logo phân chia rõ ràng tương ứng. Nút Đăng Xuất và Thông Số Cơ bản không bị chồng lên lệch hoặc lún giấu mất không thể Click được. | Medium |
| **TC-F18.26** | `Sec` | `RBAC` | 1. Truy cập bằng Account Staff (không có quyền cài đặt quản trị Settings F15).<br>2. Nạp Trình Gõ URL cưỡng ép mở Route CMS Settings. | - Sidebar Menu sẽ thu ẩn dòng Settings hoàn toàn.<br>- CMS xuất thẳng tín hiệu Access Denied (Code Lỗi HTTP 403 Ẩn Chỉnh) ra View Content thay vì sụp giao diện Page lỗi. | Blocker |
| **TC-F18.27** | `Logic`| `Route`| 1. Di chuyển bằng Menu: Vào trang Products.<br>2. Bấm nhấn phím Nút BACK (Quay Lại Lịch Sử) của ứng dụng Browser Browser. | - Khi URL thanh địa chỉ lùi trở về Dashboard, Cửa Sáng Highlight tô đánh dấu bên Sidebar cũng tự động nhảy bám màu sáng về Mục Dashboard hoàn toàn chính xác theo State Quản. | High |
| **TC-F18.28** | `UI` | `Layout`| 1. Khai báo Email quản trị cực dài dằng dặc trên 50 kí hiệu ký tự. Nhấp Avatar Cấp Panel Trải Dropdown Menu Cá Nhân Phía Top Header. | - Hộp Dropdown không bị kéo dãn bục giới hạn Box Layout Frame.<br>- Những phần chữ thuộc Email bị dài quá viền được tự định nghĩa thu gọn 3 chấm (Ellipsis) đúng mức, an toàn Responsive Container Component Box Không vỡ móp xô lệ CSS lưới tổng thể diện. | Medium |
| **TC-F18.29** | `Net` | `Net` | 1. Trong thời gian màn hình Mới đang chạy quá trình thanh Progress Bar Load API Route, ngắt hoàn toàn Internet (Timeout Code Lỗi Quá 30s Cắt Đứt). | - Giao diện thanh vệt tiến trình Progress Load Bar sẽ ngưng không đứng chờ mãi mốc 90%.<br>- Hệ điều hướng báo hiển thị Lỗi Network Toast Error nhằm yêu cầu Thử Lại. Hoàn tất cất Thanh Progress Load cho Phép Mở Đi Lại Quãng Route Không Cản Trở Vỡ Ngưng Trình Ứng Dụng Load Chậm Gãy Tab. | High |

### Nhóm 5: Light/Dark Mode Toggle (US-F18-04, Wave 2)

> **Status:** Draft — Wave 2. Test code đã chuẩn bị (TDD). Implementation pending.
> **Source skeleton:** `src/lib/theme/theme-cookie.ts`, `src/components/dashboard/ThemeToggle.tsx`.

| ID | Ref | Loại | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ |
|:---|:---|:---|:---|:---|:---:|
| **TC-F18.30** | `US-F18-04 AC-1` | `UI` | 1. Đăng nhập dashboard desktop ở Light mode.<br>2. Quan sát sidebar footer. | - Toggle button hiển thị ở sidebar footer.<br>- Icon là Moon (biểu thị đang ở Light, click để sang Dark).<br>- `aria-label="Switch to dark mode"`. | Blocker |
| **TC-F18.31** | `US-F18-04 AC-1` | `Mobile` | 1. Resize 375px hoặc dùng mobile device.<br>2. Mở header. | - Toggle button hiển thị ở header mobile (không ở sidebar drawer).<br>- Touch target ≥ 44x44px. | High |
| **TC-F18.32** | `US-F18-04 AC-2` | `Func` | 1. Đang ở Dark mode.<br>2. Click toggle button. | - Toàn dashboard chuyển sang Light mode trong < 200ms.<br>- Background đổi `#0B1120` → `#F8FAFC`, surface `#161E2E` → `#FFFFFF`.<br>- Icon đổi từ Sun thành Moon.<br>- Không flash, transition mượt. | Blocker |
| **TC-F18.33** | `US-F18-04 AC-3` | `Func` | 1. Đang ở Light mode.<br>2. Click toggle button. | - Toàn dashboard chuyển sang Dark mode trong < 200ms.<br>- Color tokens revert về Dark mode theo Design System.<br>- Icon đổi từ Moon thành Sun. | Blocker |
| **TC-F18.34** | `US-F18-04 AC-4` | `Logic` | 1. Chọn Light mode.<br>2. Refresh (F5) hoặc đóng tab và mở lại. | - Dashboard vẫn ở Light mode.<br>- Cookie `ech-theme=light` persist với attributes đúng (Path=/, Max-Age=31536000, SameSite=Lax). | Blocker |
| **TC-F18.35** | `US-F18-04 AC-4` | `Perf` | 1. Set theme = Light. Clear localStorage.<br>2. Hard refresh, quan sát first paint. | - Không có flash Dark → Light trong lúc load (no FOUC).<br>- HTML root nhận `class="light"` ngay từ SSR theo cookie. | High |
| **TC-F18.36** | `US-F18-04 Add` | `A11y` | 1. Tab keyboard tới toggle button.<br>2. Nhấn Enter; lặp với Space. | - Toggle button focusable bằng Tab.<br>- Cả Enter và Space đều trigger toggle thành công. | High |
| **TC-F18.37** | `US-F18-04 Add` | `A11y` | 1. Inspect toggle button trong DevTools ở Light mode, sau đó ở Dark mode. | - Light mode: `aria-label="Switch to dark mode"`.<br>- Dark mode: `aria-label="Switch to light mode"`.<br>- Có `aria-pressed` phản ánh trạng thái hiện tại. | Medium |
| **TC-F18.38** | `US-F18-04 Add` | `Sec` | 1. Set theme = Light ở dashboard.<br>2. Truy cập `/admin` (Payload). | - Payload Admin panel KHÔNG bị ảnh hưởng bởi theme cookie.<br>- Admin giữ nguyên giao diện gốc của Payload. | High |
| **TC-F18.39** | `US-F18-04 Add` | `Mobile` | 1. Mở dashboard ở viewport 375px (iPhone 14 Pro).<br>2. Quan sát header. | - Toggle button không bị che bởi notification bell / avatar.<br>- Không overlap touch target, đủ khoảng cách click. | Medium |

### Nhóm 6: Dashboard Color System (US-F18-05, Wave 2)

> **Status:** Draft — Wave 2. Skeleton: `src/lib/theme/dashboard-theme.ts`.

| ID | Ref | Loại | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ |
|:---|:---|:---|:---|:---|:---:|
| **TC-F18.40** | `US-F18-05 AC-1` | `UI` | 1. Set theme = Light.<br>2. Inspect sidebar background + border. | - Sidebar bg `#FFFFFF`, border-right `#E2E8F0`.<br>- Menu item text `#0F172A`, muted `#64748B`.<br>- Active highlight Primary Blue `#2563EB` subtle. Hover `#F1F5F9`. | Blocker |
| **TC-F18.41** | `US-F18-05 AC-1` | `UI` | 1. Set theme = Dark.<br>2. Inspect sidebar. | - Sidebar giữ nguyên `#0B1120` background (Wave 1 design).<br>- Token map dark mode KHÔNG đổi. | High |
| **TC-F18.42** | `US-F18-05 AC-2` | `UI` | 1. Set theme = Light.<br>2. Inspect card surface. | - Card bg `#FFFFFF`, border `#E2E8F0`, radius `12px`.<br>- Shadow `0 1px 3px 0 rgb(0 0 0 / 0.1)`.<br>- Heading + body text `#0F172A`, muted `#64748B`. | Blocker |
| **TC-F18.43** | `US-F18-05 AC-3` | `UI` | 1. Set theme = Light.<br>2. Focus một input field. | - Input bg `#FFFFFF`, border `#E2E8F0`, placeholder `#64748B`.<br>- Focus ring `#2563EB`.<br>- Disabled opacity 50%. | High |
| **TC-F18.44** | `US-F18-05 AC-4` | `UI` | 1. So sánh Primary button ở cả Light và Dark mode. | - Primary giữ nguyên gradient Blue→Teal + text trắng ở CẢ HAI mode.<br>- Không đổi theo theme. | High |
| **TC-F18.45** | `US-F18-05 AC-4` | `UI` | 1. So sánh Secondary button Light vs Dark. | - Light: bg `#F1F5F9`. Dark: bg `#1F2937`.<br>- Outline button: border xám theo mode.<br>- Ghost: transparent, hover bg theo mode. | Medium |
| **TC-F18.46** | `US-F18-05 AC-5` | `UI` | 1. Mở một modal/dialog ở mỗi mode. | - Modal bg theo surface color mode.<br>- Backdrop Light `rgba(0,0,0,0.4)` / Dark `rgba(0,0,0,0.7)`.<br>- Text + form theo theme active. | High |
| **TC-F18.47** | `US-F18-05 Add` | `UI` | 1. Trigger toast Success/Error/Warning/Info ở cả 2 mode. | - Semantic colors theo Design System §1, đúng cho mỗi mode.<br>- Badge status/draft/AI đủ contrast. | Medium |
| **TC-F18.48** | `US-F18-05 Add` | `A11y` | 1. Chạy contrast checker (axe / Lighthouse) trên tất cả text/bg pairs. | - WCAG AA pass: 4.5:1 normal text, 3:1 large text ở cả 2 mode. | Blocker |
| **TC-F18.49** | `US-F18-05 DoD` | `Code` | 1. Grep codebase: `bg-zinc-950`, `text-zinc-100` ở `src/app/(dashboard)/`. | - Không còn hardcoded layout-level color classes.<br>- Layout phải dùng CSS vars / token theo mode. | High |

### Nhóm 7: Tenant-aware Default Theme (US-F18-06, Wave 2)

> **Status:** Draft — Wave 2. Skeleton: `src/lib/theme/tenant-theme.ts`.

| ID | Ref | Loại | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ |
|:---|:---|:---|:---|:---|:---:|
| **TC-F18.50** | `US-F18-06 AC-1` | `Logic` | 1. AWC tenant user login lần đầu (no cookie). | - Theme mặc định Light.<br>- Toggle hiển thị Moon icon. | Blocker |
| **TC-F18.51** | `US-F18-06 AC-2` | `Logic` | 1. ECH/SME tenant user login lần đầu. | - Theme mặc định Dark (Wave 1 behavior giữ nguyên).<br>- Toggle hiển thị Sun icon. | Blocker |
| **TC-F18.52** | `US-F18-06 AC-3` | `Logic` | 1. AWC user toggle → Dark.<br>2. Logout, login lại. | - Dashboard ở Dark (user pref > tenant default).<br>- Cookie `ech-theme=dark` persist. | High |
| **TC-F18.53** | `US-F18-06 AC-4` | `Func` | 1. Admin tạo tenant mới brand="AWC" hoặc "Medium Enterprise". | - `tenant.defaultTheme === 'light'`.<br>- brand="ECH"/"SME" → `defaultTheme === 'dark'`. | High |
| **TC-F18.54** | `US-F18-06 Add` | `Logic` | 1. AWC user xóa cookie `ech-theme` (DevTools).<br>2. Reload. | - Fall back tenant default Light.<br>- KHÔNG dùng `prefers-color-scheme` system pref. | Medium |
| **TC-F18.55** | `US-F18-06 Add` | `Sec` | 1. AWC admin set dashboard = Dark (user pref).<br>2. Khách truy cập storefront. | - Storefront colorMode KHÔNG bị ảnh hưởng bởi tenant default + user pref.<br>- Storefront chỉ đọc từ `site.theme.colorMode`. | Blocker |

### Nhóm 8: Storefront Theme Independence (US-F18-07, Wave 2)

> **Status:** Draft — Wave 2. `resolveTheme()` đã tồn tại trong `src/lib/theme/resolve.ts`.

| ID | Ref | Loại | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ |
|:---|:---|:---|:---|:---|:---:|
| **TC-F18.56** | `US-F18-07 AC-3` | `Logic` | 1. `resolveTheme({ colorMode: 'light' })`. | - `surfaceColor = '#f8f8f8'`, `textColor = '#09090b'`, `backgroundColor = '#ffffff'`. | Blocker |
| **TC-F18.57** | `US-F18-07 AC-3` | `Logic` | 1. `resolveTheme({ colorMode: 'dark' })`. | - `surfaceColor = '#111111'`, `textColor = '#fafafa'`, `backgroundColor = '#09090b'`. | Blocker |
| **TC-F18.58** | `US-F18-07 AC-1` | `Sec` | 1. Set dashboard cookie `ech-theme=dark`.<br>2. Truy cập storefront `/sites/[slug]` với `colorMode='light'`. | - Storefront render Light (theo site config).<br>- KHÔNG đọc `ech-theme` cookie. | Blocker |
| **TC-F18.59** | `US-F18-07 AC-2` | `Func` | 1. Vào Site Settings / Theme Settings.<br>2. Chọn Color Mode = Light hoặc Dark. | - Preview update realtime khi đổi.<br>- Save → `site.theme.colorMode` DB update. | High |
| **TC-F18.60** | `US-F18-07 Add` | `Code` | 1. Inspect storefront HTML output. | - Storefront dùng `generateThemeCSS()` inline `:root { ... }`.<br>- KHÔNG có class `dark:` từ Tailwind. | Medium |
| **TC-F18.61** | `US-F18-07 Add` | `UI` | 1. Builder/Editor mở site với `colorMode='dark'`.<br>2. Quan sát canvas preview. | - Preview render đúng Dark mode tokens.<br>- Builder UI riêng (Light) không bị override. | Medium |

### Nhóm 9: AWC Brand Color Tokens (US-F18-08, Wave 2)

> **Status:** Draft — Wave 2. Skeleton: `src/lib/theme/theme-presets.ts`.

| ID | Ref | Loại | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ |
|:---|:---|:---|:---|:---|:---:|
| **TC-F18.62** | `US-F18-08 AC-1` | `Logic` | 1. Tạo site mới trên AWC tenant.<br>2. Inspect default theme tokens. | - `primaryColor = '#2563EB'`, `secondaryColor = '#7C3AED'`, `accentColor = '#06B6D4'`, `colorMode = 'light'`. | High |
| **TC-F18.63** | `US-F18-08 AC-2` | `Logic` | 1. Tạo site mới trên ECH tenant. | - `primaryColor = '#0EA5E9'`, `secondaryColor = '#D946EF'`, `colorMode = 'dark'`.<br>- Wave 1 behavior giữ nguyên. | High |
| **TC-F18.64** | `US-F18-08 AC-3` | `UI` | 1. AWC admin nhìn buttons / active states / links. | - Accent dùng AWC Blue `#2563EB` thay vì ECH Cyan `#0EA5E9`.<br>- Gradient button dùng AWC palette. | Medium |
| **TC-F18.65** | `US-F18-08 Add` | `Func` | 1. AWC site owner customize colors sau khi tạo.<br>2. Save. | - Override AWC defaults thành công.<br>- Custom palette persist trong DB. | Medium |
| **TC-F18.66** | `US-F18-08 Add` | `UI` | 1. AI Builder theme presets dropdown. | - Có option AWC-specific preset.<br>- Chọn → apply AWC palette tokens. | Low |

### Nhóm 10: Wave 1 Gap Fill (US-F18-01/02/03 missing coverage)

> **Note:** TC-IDs reference existing entries Nhóm 1-4. Tests viết để cover các TC chưa được automate ở `f18-cms-layout.test.tsx`.

| ID | Ref | Loại | Ghi chú gap |
|:---|:---|:---|:---|
| **TC-F18.17** | `US-F18-03 Add` | `Route`| Scroll position reset on route change — `CMSLayoutClient` đã có logic line 26-30 nhưng chưa có unit test. |
| **TC-F18.18** | `US-F18-03 AC-3`| `State`| Empty State component render khi route không có data. Chưa test. |
| **TC-F18.26** | `US-F18-01 Add` | `Sec` | RBAC: Settings menu ẩn cho non-owner. `Sidebar.tsx` line 147-156 có filter — chưa test path. |
| **TC-F18.27** | `US-F18-01 Add` | `Logic`| Active highlight đúng khi browser back. Chưa test. |
| **TC-F18.28** | `US-F18-02 Add` | `UI`   | Long email truncate ellipsis trong avatar dropdown. |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)

* **Kịch bản UAT Desktop:** Quản trị viên theo dõi dữ liệu trên giao diện màn hình lớn. Khi cuộn xem biểu đồ thống kê, thanh Menu Trái (Sidebar) và Màn Trên (Header) vẫn giữ cố định vũng chức. Khi click Menu chuyển tác vụ, ứng dụng đổi màn hình React tức thì dưới 500ms mà không Reload Flash toàn phiên làm việc.
* **Kịch bản UAT Mobile:** Nhân viên kiểm tra nhanh hàng hóa qua iPhone Safari. Giao diện Sidebar gọn ẩn nhường chỗ hoàn toàn cho thông số Data Center Grid. Nút chọn Burger Mở Trượt Mềm (Hamburger Drawer Animation Drawer Sidebar Layout 100% Khung Kín Phóng Smooth Phản Chạm). Có thể nháy chọn vào Đa Ngôn Ngữ chuyển tiếng Mã Lai linh hoạt. Mật độ Icon đạt khoảng chuẩn bấm 44px phù hợp chạm. 

## 5. Tiêu chí Đánh giá Quality Gates

| Nhóm Đánh Giá | Ghi chú |
|---|---|
| **1. UI/UX Focus Touch Area** | Test chuẩn Mobile iPhone Safari: Z-Index Overlay Drawer, Khả năng vuốt mượt, Touch Target tối thiểu đạt 44px ở các nút Click quan trọng. |
| **2. Client-Side Routing logic** | Cố định Sidebar Highlight Menu tương ứng chính xác đối với Browser Back or Forward History Buttons mà không bị sai màu Highlight State React. |
| **3. Perf App Shell Metric Load** | Chạm chuẩn Framework SLA 150ms Shell Loader Core. CLS = 0 không nảy chuyển lệch DOM Content Components quá mốc Delay Limit Gây Gãy UX Client Request Web Tĩnh. |
