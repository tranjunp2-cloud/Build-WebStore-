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
| **TC-F18.09** | `UI` | `Menu` | 1. Nhấp chọn một danh sách mẹ có biểu tượng mũi tên xổ xuống. | - Khối danh sách (Accordion) mở trượt xuống dưới liệt kê các chức năng con.<br>- Biểu tượng mũi tên xoay đảo ngược chiều. | High |
| **TC-F18.10** | `UI` | `State`| 1. Hệ thống có 5 đơn hàng chưa duyệt.<br>2. Quan sát menu chức năng "Orders" trên Sidebar. | - Bên cạnh văn bản "Orders" hiển thị cảnh báo vòng tròn (Badge) có số `5` với màu sắc nổi bật (thường là màu đỏ/xanh lá). | Medium |

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
