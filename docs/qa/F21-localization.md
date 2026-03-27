# Tài liệu Quyết định Kiểm thử (Test Design) F21 - Localization & Multi-language
> **Phiên bản:** 1.0 (Dựa trên thiết kế Figma & Yêu cầu BA) | **Cập nhật:** 2026-03-20 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F21-localization.md`), Figma Mockups, User Stories.
> **Các khía cạnh kiểm thử chính:** i18n Boundaries, Text Overflow Validation, Safe Fallbacks, LocalStorage Persistence.

---

## 1. Mục tiêu Kiểm thử (Objective)
Bộ Test Case tập trung kiểm thử độ ổn định và tính tương tác mượt mà của tính năng **Đa ngôn ngữ (Bahasa Melayu / English)** trên toàn hệ thống PrimeWeb 2.0. Trọng tâm bao gồm:
- Hành vi chuyển đổi ngôn ngữ tức thời không tải lại trang toàn bộ (No-reload SPA transitions).
- Đảm bảo tính toàn vẹn của giao diện (Layout) trước các chuỗi văn bản Tiếng Mã Lai dài, tránh tình trạng vỡ khung.
- Tính chính xác về vị trí của thành phần Language Switcher theo thiết kế Figma mới nhất (nằm bên dưới Form Login và cuối thanh Sidebar CMS).

---

## 2. Môi trường Kiểm thử (Test Environment)
| Thông số (Parameters) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Environment) | Staging / Pre-Production |
| Trình duyệt (Browsers) | Google Chrome (v115+), Safari iOS, Mozilla Firefox |
| Dữ liệu Ngôn ngữ (Dictionary) | Các tệp `en.json` và `bm.json` |
| Bộ nhớ phía Client | Trình duyệt hỗ trợ `localStorage` (lưu trữ khóa `prefer_lang`) |

---

## 3. Ma trận Kịch bản Kiểm thử (Unified Traceability Matrix)

| ID | Nguồn tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN (Steps & Data) | KẾT QUẢ MONG ĐỢI GHERKIN (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-F21-01 / Figma] - Hiển thị Language Switcher trên màn hình Auth (Đăng nhập/Đăng ký)** |
| **TC-F21.01** | `UI` | `Layout`| **[Tích cực]** Vị trí của Nút chuyển đổi ngôn ngữ (Switcher) trên Biểu mẫu Auth | **1.** Truy cập trang `/login` trên thiết bị Desktop hoặc Mobile.<br>**2.** Quan sát Biểu mẫu (Form Card) đăng nhập. | Dựa trên Figma: Thành phần Switch Bar (MY / EN) được đặt TÍCH HỢP TRONG thẻ Form Login, ngay bên dưới nút "Sign in". Không nằm ở góc phải Header như mô tả PRD. | O - Blocker | [x] |
| **TC-F21.01b** | `UI/UX` | `Design`| **[Tích cực]** Kiểm chứng CSS Pixel-Perfect và Trạng thái (Hover/Active) của Nút | **1.** Sử dụng DevTools soi Component `LanguageSwitcher`.<br>**2.** Hover và Click vào một tùy chọn (VD: `MY`). | Thiết kế CSS (Border-radius, Padding, Spacing) PHẢI KHỚP TỈ LỆ 1:1 với Figma. Màu nền Nút Active (Đang chọn) là Cyan/Mint. Trạng thái Hover (Chuột trỏ vào) có Transition chuyển màu mượt mà. | H - High | [x] |
| **TC-F21.02** | `AC-2` | `Func` | **[Tích cực]** Hành vi chuyển đổi tức thời (No-reload) | **1.** Tại trang Login, nhấn chuyển từ `EN` sang `MY`. | **THEN** Tất cả các Nhãn (Labels), Placeholder báo hiệu (Email, Password, Remember me) lập tức cập nhật thành Tiếng Mã Lai. Trang web KHÔNG tải lại (No full-reload). | O - Blocker | [ ] |
| **TC-F21.03** | `UX` | `Input` | **[Tích cực]** Duy trì dữ liệu nhập liệu khi đổi ngôn ngữ | **1.** Nhập địa chỉ `admin@email.com` vào trường Email.<br>**2.** Nhấn chuyển đổi nút từ `EN` sang `MY`. | Dữ liệu `admin@email.com` đang nhập dở vẫn được bảo lưu nguyên vẹn, trải nghiệm nhập liệu không bị gián đoạn. | H - High | [ ] |
| **[US-F21-02 & US-F21-04] - CMS Layout Header & Điều hướng Sidebar Mobile** |
| **TC-F21.04** | `UI` | `Layout`| **[Tích cực]** Vị trí của Nút Switcher (CMS Desktop & Mobile) | **1.** Đăng nhập thành công vào Hệ thống CMS.<br>**2.** Nhìn xuống góc trái dưới cùng của thanh Sidebar. | Dựa trên Design/Figma UI thực tế: Thành phần Toggles Switch (MY / EN) nằm ở VỊ TRÍ CUỐI (đáy) thanh Điều hướng Sidebar Navigation, ngay phía trên nút Logout. (Bác bỏ PRD text cũ ghi ở Top Header). | O - Blocker | [x] |
| **TC-F21.05** | `AC-2` | `Logic` | **[Tích cực]** Mức độ độc lập giữa UI tĩnh và Dữ liệu linh động | **1.** Điều hướng sang màn hình Products (trong dữ liệu có sản phẩm tự định danh là `Áo Phông Z1`).<br>**2.** Đổi ngôn ngữ CMS sang `MY`. | Các Danh mục Sidebar, Cột Table Headers được cập nhật thành Tiếng Mã Lai. **Dữ liệu sản phẩm (`Áo Phông Z1`)** không bị dịch sai lệch, giữ nguyên dữ liệu gốc. | O - Blocker | [ ] |
| **TC-F21.06** | `UI` | `Mobile`| **[Tích cực]** Tối ưu hóa không gian hiển thị Switcher trên Mobile | **1.** Mô phỏng kích thước thiết bị (Viewport) xuống 375px.<br>**2.** Chạm vào biểu tượng Hamburger để mở Menu dọc. | Nút Switcher (MY / EN) tự động ẩn khỏi Header và được tích hợp trong Menu mở rộng (Drawer), không gây chồng lặp UI. | H - High | [ ] |
| **[US-F21-03: Data Persistence & Synchronization] - Lưu trữ & Đồng bộ Trạng thái Ngôn ngữ** |
| **TC-F21.07** | `BR-01` | `State` | **[Tích cực]** Khởi tạo Ngôn ngữ mặc định (Default Language) ở phiên truy cập lần đầu | **1.** Sử dụng trình duyệt Ẩn danh (Incognito) hoặc xóa sạch bộ nhớ trình duyệt.<br>**2.** Truy cập vào màn hình bất kỳ (ví dụ `/login`). | Mặc định hệ thống **BẮT BUỘC** hiển thị giao diện **Tiếng Anh (EN)**. Thành phần Switcher ưu tiên chọn `EN`. Không được phép mồi (load) ngôn ngữ khác ở lần chạm đầu tiên của User (First-touch). | O - Blocker | [x] |
| **TC-F21.08** | `AC-1` | `State` | **[Tích cực]** Ghi nhớ cài đặt trên trình duyệt (Guests - Khách) | **1.** Xóa sạch lịch sử duyệt (Clear Site Data). Vào `/login`.<br>**2.** Bật Switch sang `MY`. Tắt tab/trình duyệt đi.<br>**3.** Mở lại Browser mở lại `/login`. | Trình duyệt đọc bộ nhớ `localStorage` và tự động áp dụng Tiếng Mã Lai (`prefer_lang = MY`). | H - High | [ ] |
| **TC-F21.09** | `AC-2` | `API` | **[Tích cực]** Cập nhật dữ liệu từ Máy chủ cho User đã xác thực | **1.** Ở CMS Dashboard, nhấn đổi ngôn ngữ sang `MY`.<br>**2.** Theo dõi F12 Network Tab (Hoạt động mạng). | Hệ thống tự động gọi API `PATCH /api/users/me/preferences` với thân máy {lang: 'BM'}. Cơ sở dữ liệu của người dùng được cập nhật tương ứng. | O - Blocker | [ ] |
| **TC-F21.10** | `AC-2` | `Sync` | **[Tích cực]** Phục hồi trạng thái cá nhân trên đa thiết bị | **1.** Sau khi Pass `TC-F21.09`, sử dụng trình duyệt/thiết bị khác mô phỏng hành vi Đăng nhập với User Account vừa cấu hình. | Hệ thống trích xuất `prefer_lang` từ API/Database để rải giao diện. Màn Dashboard chủ động khởi hành bằng tiếng Mã Lai, không sử dụng tiếng mặc định (EN). | H - High | [ ] |
| **TC-F21.11** | `UX` | `State` | **[Biên]** Độ ưu tiên Session: Đăng xuất và Đăng nhập chéo Account (Local vs DB) | **1.** User A (Cấu hình `MY`) đang mở Dashboard, tiến hành Đăng xuất (Logout).<br>**2.** Tại màn hình `/login`, quan sát UI.<br>**3.** Tiến hành nhập Tài khoản User B (Cấu hình `EN` trên DB) và Đăng nhập vào. | **Màn /login:** VẪN GIỮ tiếng Mã Lai do trình duyệt chưa mất `localStorage`.<br>**Màn Dashboard:** Hệ thống ưu tiên dữ liệu DB của User B, ghi đè hoàn toàn giao diện sang **`Tiếng Anh (EN)`**. Không bị kẹt state bộ nhớ cũ. | O - Blocker | [ ] |
| **[BR-DEEP] Đánh giá Biên giới hạn (Boundary Tests & Exceptions)** |
| **TC-F21.12** | `i18n` | `Safety`| **[Tiêu cực]** Khởi tạo cơ chế Rơi tự do (Safe-Fallback) khi mất Khóa dịch | **1.** Thao tác tại môi trường Test: XÓA khóa (key) Tiếng Mã Lai của menu `Dashboard` khỏi tệp JSON.<br>**2.** Mở CMS view tiếng `MY`. | Thư viện xử lý i18n (`next-intl`) tự động kích hoạt Fallback: trả về chuỗi kí tự mặc định (`Dashboard` - Tiếng Anh), tránh sụp đổ giao diện lỗi trắng trang (White Screen Error). | O - Blocker | [ ] |
| **TC-F21.13** | `UI/UX`| `Fluid` | **[Biên]** Khả năng mở rộng Box-model theo chuỗi văn bản dài (Text Overflow) | **1.** Tiêm dữ liệu cấu hình BM.json bằng các cụm từ siêu dài (tăng >50% độ lớn chiều ngang so với EN).<br>**2.** Kiểm tra các Nút bấm và Cột Bảng lưới. | Kích thước Nút (Button width)/Bảng biểu linh hoạt co dãn theo cấu trúc Flex/Grid, không xảy ra hành vi chữ tràn giới hạn ra ngoài Box/Frame Menu. | H - High | [x] |
| **TC-F21.14** | `QA` | `Rule` | **[Tiêu cực]** Đồng bộ Dịch ngữ các Form Validation & API Toasts | **1.** Nhập Password sai chuẩn (< 6 ký tự) để kích hoạt lỗi Zod.<br>**2.** Gây Lỗi Endpoint (Xóa Network). | Cảnh báo Validations tại khung điền Form và Các thẻ Toast hiện diện **BẮT BUỘC bằng tiếng Mã Lai** (nếu ngôn ngữ BM đang bật). Cấm rò rỉ ngoại lệ bằng tiếng Anh chưa dịch. | O - Blocker | [ ] |
| **TC-F21.15** | `BR-03`| `Format`| **[Tích cực]** Sự nhất quán của Ký hiệu Định dạng Tiền tệ | **1.** Quan sát các thẻ mô tả Đơn giá trên hệ thống CMS. | Hệ thống hiển thị Cố định cấu trúc đồng Ringgit Malaysia (`RM 99.00`) ở mọi Viewport, mọi Language. Không bị override bởi các định dạng đô-la ngầm định (`$`). | O - Blocker | [x] |
| **TC-F21.16** | `FR-08`| `Func` | **[Tích cực]** Cơ chế nội suy Số nhiều (Pluralization Params) | **1.** Kiểm tra màn hình thống kê có số lượng vật phẩm (VD: 1 Item vs 5 Items).<br>**2.** Đổi qua lại ngôn ngữ EN / MY. | Ngữ pháp Tiếng Anh dịch hiển thị chuẩn hậu tố "s/es" (1 item, 5 items). Ngôn ngữ Mã Lai sinh chữ từ vựng cấu trúc số nhiều tương thích (VD: 1 keping vs 5 keping). | H - High | [ ] |
| **TC-F21.17** | `Add.AC`| `Format`| **[Tích cực]** Khoá cứng định dạng Ngày tháng (Date Layout Freeze) | **1.** Soi các trường lưu vết thời gian (Ngày tạo đơn, Sinh lịch sử).<br>**2.** Phá thử bằng cách đổi Locale máy tính gốc. | Format Ngày/Tháng/Năm **LUÔN BỊ KHÓA CỨNG** ở dạng `DD/MM/YYYY` (Ví dụ 31/12/2026) ở bất kỳ ngôn ngữ nào. Cấm biến thiên sang `MM/DD/YYYY`. | O - Blocker | [ ] |
---

## 4. Hành trình Trải nghiệm End-to-End Thực Tế (E2E UAT Flow)

| Mã UAT | Chân dung Người dùng (User Persona) | Trình tự Thao tác (E2E Execution Flow) | Trạm kiểm soát thiết yếu (Critical Checkpoints) |
|---|---|---|---|
| **UAT-F21-01** | **Chủ Cửa hàng Nhỏ (Micro-SME, Low Tech Readiness)**<br>Chủ yếu hiểu ngữ cảnh qua BM, vận hành trên Mobile. Rất cần dễ truy cập. | 1. Mở màn hình Đăng Nhập CMS qua Mobile/Máy tính bảng.<br>2. Xác định dễ dàng khu vực Switcher `MY/EN` trong khung Login.<br>3. Chạm lựa chọn `MY` - Hệ thống dịch 100% UI trong 1s, giữ nguyên dự liệu email đã điền.<br>4. Tiến hành Đăng Nhập vào Bảng điều khiển. | Phím Language Switcher được đặt RÕ RÀNG ở cấp cao nhất của trang (không che giấu bên trong mục Cài đặt). Chuyển hóa tức thời (No-Reload SPA Component). |
| **UAT-F21-02** | **Quản lý Hệ thống (Luân chuyển đa thiết bị)**<br>Vừa sử dụng máy công ty và thiết bị di động song song. Tính chất cập nhật báo cáo liên tục. | 1. Chuyển điện thoại, Login Account cá nhân (Vốn đã Set cài đặt BM trên máy A).<br>2. Bảng Hệ thống Dashboard kích hoạt sẵn BM sau login (nhờ Đồng bộ Account API).<br>3. Chuẩn mực báo cáo với loại tiền tệ luôn ở `RM`. | Hệ thống trích xuất lưu lượng API (Persisted State DB Override vế Local Storage Guest). |

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Tiêu chuẩn (Quality Criteria) | Trạng Thái (Status) | Quy tắc QA/Tự động hóa (Automation Standard Notes) |
|---|---|---|
| **1. Tính chuẩn xác của Figma Layout** | [ ] Chưa Đạt | Vị trí Nút đổi Ngôn ngữ phải được khởi tạo bên trong Component Card Form (Auth) & Đáy Điều hướng Sidebar Component (CMS). Trực tiếp bác bỏ sai phạm bản PRD. |
| **2. Độ tin cậy Quản lý State/DB** | [ ] Chưa Đạt | API Payload `PATCH /api/users/me/preferences` vận hành thành công; Khóa Guest `prefer_lang` ổn định trong Trình duyệt ẩn danh. |
| **3. UI Boundaries Integrity** | [ ] Chưa Đạt | Xử lý triệt để CISA Rules liên quan hiển thị (Fluid Box, No-overflowing BM terms, Strict Currency Locales). |
| **4. E2E UAT Approval** | [ ] Chưa bắt đầu | Viết và Lên lịch chạy Workflow Playwright (Mobile App Viewport automation) tại Pipeline CD/CI. |
