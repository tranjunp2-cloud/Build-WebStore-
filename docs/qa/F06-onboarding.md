# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F06 - Onboarding Flow
> **Phiên bản:** 2.0 | **Cập nhật:** 2026-04-06 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F06-onboarding.md`), User Stories (`F06-onboarding-stories.md`), Figma Design (`30771-17007`, `17280`, `17555`)
> **Kỹ năng ứng dụng (.agent):** BDD (Gherkin Expectations), Performance SLA Validators, UI/UX Responsive Audit, Mobile Web Expert, Backend Integrity.

---

## 1. Mục Tiêu (Objective)

Đảm bảo hành trình Onboarding diễn ra mượt mà, chuyên nghiệp theo tinh thần **"Zero-Friction"**. Đạt độ phủ 100% cho 3 User Stories, bao gồm UI Pixel-Perfect, SLA hiệu năng Media, và tính toàn vẹn trạng thái `has_seen_ai_wizard` tại Backend.

**Tổng cộng 18 kịch bản chi tiết** bao quát từ UI/UX đến các lỗi biên kỹ thuật cao.

---

## 2. Test Environment

| Biến | Yêu cầu |
|---|---|
| Môi trường | Staging / Pre-Production |
| Browsers | Chrome (v110+), Safari (Full WebKit Support) |
| Devices | Desktop (1920x1080), Mobile (iPhone 14/15 375px) |
| Test Data & SLA | Account mới (Flag false), Account cũ (Flag null/true), Media SLA < 500KB, Redirect < 300ms |

---

## 3. Unified Test Cases (Traceability Matrix)

### US-F06-02: Welcome Screen — Zero Friction to AI Builder

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F06.01** | `AC-1` | `UI` | **[Positive]** Hiển thị Welcome Screen đúng Figma | 1. Đăng ký tài khoản mới.<br>2. Hoàn tất Auth, truy cập `/onboarding`. | - Hiển thị 1 CTA duy nhất: `[Create My Store]`.<br>- Link "Bỏ qua" nằm bên dưới.<br>- Progress bar "Step 1 of 2".<br>- Lời dẫn "5-minute promise". | Blocker | [ ] |
| **TC-F06.01b** | `BR-01` | `Logic` | **[Negative]** Chặn truy cập Onboarding khi đã có site | 1. Login bằng tài khoản cũ đã có website.<br>2. Truy cập thủ công URL `/onboarding`. | - Hệ thống redirect ngay về `/dashboard`.<br>- Không hiển thị màn hình Welcome. | Blocker | [ ] |
| **TC-F06.02** | `AC-2` | `Perf` | **[Positive]** Tốc độ chuyển hướng sang Builder (SLA) | 1. Nhấn nút `[Create My Store]`. | - Điều hướng sang `/builder/new` trong **< 300ms**.<br>- Không có màn hình trắng (Skeleton/Instant transition). | High | [x] |
| **TC-F06.03** | `AC-3` | `Flow` | **[Positive]** Bỏ qua Onboarding (Skip Path) | 1. Nhấn link "Set up later" hoặc "Bỏ qua". | - Redirect về `/dashboard`.<br>- Cookie/Session vẫn được giữ nguyên. | Medium | [x] |
| **TC-F06.03a** | `Design` | `UI/UX` | **[Positive]** Kiểm tra Pixel-Perfect Figma — Welcome Screen | 1. Inspect màn hình `/onboarding`.<br>2. So sánh với Figma Node `30771:17007`. | - Padding 32px đúng.<br>- Font `Inter` đúng.<br>- Màu nền Glassmorphism (opacity 0.6) đúng.<br>- CSS Transition của nút khớp 100% Figma Tokens. | High | [ ] |

---

### US-F06-03: AI Discovery Wizard (CMS Welcome Carousel)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F06.04** | `AC-1` | `Logic` | **[Positive]** Tự động mở popup "Your store has moved to Web Store" tại Dashboard | 1. Login lần đầu vào Dashboard với tài khoản `has_seen_ai_wizard == false`.<br>2. Quan sát màn hình. | - Popup mở: badge "WebStore V2", tiêu đề, mô tả, video V2 intro (poster, `preload=metadata`, không autoplay), nút `Get started`.<br>- Video: play/pause/replay, seek, thời gian, mute, full screen; thanh điều khiển ẩn khi đang phát (trừ khi hover). | Blocker | [x] |
| **TC-F06.05** | `AC-2` | `Content` | **[Positive]** Slide 1: AI Editor _(Obsolete 2026-10-27: the slide wizard was replaced by the "Your store has moved to Web Store" popup with the V2 intro video — see TC-F06.04/09.)_ | 1. Quan sát Step 1 của Wizard. | - Tiêu đề: "Thiết kế bằng AI: Sửa giao diện qua chat".<br>- GIF minh họa sửa giao diện load thành công.<br>- Nút `Tiếp tục` hiển thị. | High | [ ] |
| **TC-F06.06** | `AC-3` | `Content` | **[Positive]** Slide 2: AI Content _(Obsolete 2026-10-27: the slide wizard was replaced by the "Your store has moved to Web Store" popup with the V2 intro video — see TC-F06.04/09.)_ | 1. Nhấn `Tiếp tục` để sang Step 2. | - Tiêu đề: "AI Content: Viết lách siêu tốc".<br>- Icon ✨ giải thích tính năng viết blog chuẩn SEO.<br>- Nút `Tiếp tục` hiển thị. | High | [ ] |
| **TC-F06.07** | `AC-4` | `Content` | **[Positive]** Slide 3: AI SEO _(Obsolete 2026-10-27: the slide wizard was replaced by the "Your store has moved to Web Store" popup with the V2 intro video — see TC-F06.04/09.)_ | 1. Nhấn `Tiếp tục` để sang Step 3. | - Tiêu đề: "AI SEO: Tối ưu trang web tự động".<br>- Hiển thị điểm SEO minh họa.<br>- Nút CTA: `Khám phá CMS ngay`. | High | [ ] |
| **TC-F06.08** | `UX` | `Perf` | **[Negative]** Chống double-click chuyển Slide _(Obsolete 2026-10-27: the slide wizard was replaced by the "Your store has moved to Web Store" popup with the V2 intro video — see TC-F06.04/09.)_ | 1. Nhấn liên tiếp 2 lần vào `Tiếp tục`. | - Nút bị disabled tạm thời.<br>- Slide chỉ nhảy đúng 1 bước.<br>- Không bị glitch animation hoặc skip nội dung. | Low | [ ] |
| **TC-F06.09** | `AC-5` | `Logic` | **[Positive]** Đóng popup & cập nhật DB | 1. Đóng popup bằng `Get started`, nút X, click nền tối hoặc phím Esc. | - Popup đóng.<br>- Gọi API `POST /api/user/dismiss-wizard` (`has_seen_ai_wizard: true`) với **mọi** cách đóng.<br>- Phát event `wizard-closed` (PushOptInPrompt). | Blocker | [x] |
| **TC-F06.10** | `Logic` | `Sec` | **[Negative]** API Patch Flag bị lỗi mạng | 1. Giả lập mạng lỗi khi nhấn "Khám phá CMS ngay". | - Modal **không đóng**.<br>- Hiển thị Toast Error "Lỗi kết nối".<br>- Cho phép user thử lại. | Medium | [ ] |
| **TC-F06.11** | `UX` | `Logic` | **[Positive]** Wizard hiện lại sau khi Reload (F5) | 1. Đang xem Wizard, nhấn F5 để reload trang. | - Wizard hiển thị lại (trạng thái DB vẫn là `false`).<br>- Không mất tiến trình đã xem. | High | [ ] |
| **TC-F06.12** | `BR-01` | `Logic` | **[Boundary]** Không hiện Wizard cho Legacy Users | 1. Login tài khoản cũ đã có site.<br>2. Vào Dashboard. | - Wizard **không** hiển thị.<br>- Dashboard hiện ra bình thường. | High | [x] |
| **TC-F06.20** | `GH-1609` | `Logic` | **[Positive]** Nút X đóng và persist (thay đổi 2026-10-27) | 1. Popup đang mở, nhấn nút **X**. | - Popup đóng.<br>- Gọi API `/api/user/dismiss-wizard` (trước đây X chỉ đóng tạm — popup mở lại mỗi lần vào /dashboard).<br>- Event `wizard-closed` vẫn phát. | High | [x] |
| **TC-F06.21** | `GH-1609` | `Logic` | **[Positive]** Đã đóng thì không hiện lại | 1. Đóng popup bằng bất kỳ cách nào.<br>2. Điều hướng sang Orders/Products (soft-nav) rồi quay lại Dashboard.<br>3. Reload (F5). | - Bước 2 và 3: popup **không** hiện lại. | High | [x] |
| **TC-F06.22** | `GH-1609` | `Logic` | **[Positive]** Explore ở slide cuối cũng persist vĩnh viễn _(2026-10-27: no slides any more — covered by TC-F06.09 `Get started`.)_ | 1. Đi hết 3 slide, nhấn "Explore CMS" ở slide cuối.<br>2. Điều hướng sang Orders/Products rồi quay lại Dashboard. | - Modal đóng + gọi API `/api/user/dismiss-wizard` ngay khi bấm.<br>- Quay lại Dashboard: Wizard **không** hiện lại (persist vĩnh viễn, giống Skip). | High | [x] |

---

### US-F06-04: Mobile Web UX — Fullscreen & Swipe Gestures

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F06.13** | `AC-1` | `Mobile` | **[Positive]** Welcome Screen trên Mobile (Thumb Zone) | 1. Xem trang `/onboarding` ở viewport 375px. | - CTA Button 100% width.<br>- Vị trí Fixed Bottom (Sticky).<br>- Padding an toàn cho thanh Home iOS. | High | [ ] |
| **TC-F06.14** | `AC-2` | `Mobile` | **[Positive]** Swipe Gestures & chống Pull-to-Refresh _(Obsolete 2026-10-27: the slide wizard was replaced by the "Your store has moved to Web Store" popup with the V2 intro video — see TC-F06.04/09.)_ | 1. Vuốt trái/phải trên Modal Wizard.<br>2. Vuốt mạnh xuống dưới (Pull down). | - Chuyển slide mượt mà khi vuốt ngang.<br>- CSS `touch-action: pan-y` chặn kích hoạt Native Pull-to-Refresh. | High | [ ] |

---

### Non-Functional & Multi-Lang

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F06.15** | `Locale` | `NLU` | **[Positive]** Đa ngôn ngữ Wizard (EN, VN, BM) | 1. Chuyển ngôn ngữ sang Tiếng Mã Lai (BM).<br>2. Mở Wizard. | - Toàn bộ Title, Description, Buttons chuyển sang BM formal chuẩn. | High | [ ] |
| **TC-F06.16** | `Perf` | `Media` | **[Positive]** Media fallback | 1. Chặn tải `/videos/v2-intro.mp4`.<br>2. Quan sát popup. | - Hiện "Video coming soon" trên khung video.<br>- Không crash, nút `Get started` vẫn dùng được.<br>- Video ~19 MB, chỉ tải metadata cho tới khi bấm Play. | Medium | [x] |
| **TC-F06.17** | `Sec` | `Auth` | **[Negative]** Chặn Unauthorized PATCH | 1. Dùng ID user khác để gọi `/api/users/{id}` PATCH. | - Server trả về **HTTP 403 Forbidden**.<br>- Không cho phép sửa flag của tài khoản khác. | Blocker | [x] |

---

## 4. Hành Trình E2E UAT Flow

| Bước | Hành Động | Kết Quả Mong Đợi |
|:---:|:---|:---|
| 1 | User đăng ký mới, truy cập `/onboarding`. | Màn hình Welcome hiện gọn với 1 CTA "Create My Store". Không có thông tin thừa (TC-F06.01). |
| 2 | Nhấn "Create My Store", quan sát chuyển hướng. | Navigate sang AI Builder trong < 300ms, không có màn trắng (TC-F06.02). |
| 3 | Quay lại Dashboard, Wizard tự động mở. | Modal Discovery Wizard hiện ra, user vuốt qua 3 slides trên điện thoại (TC-F06.04, 05, 06, 07). |
| 4 | Nhấn "Khám phá CMS ngay", Reload trang F5. | Dashboard sạch, không có Wizard (TC-F06.09, 11). DB đã update `has_seen_ai_wizard: true`. |

---

## 5. Tiêu Chí Đánh Giá Chất Lượng Phát Hành (Quality Gates)

| Nhóm Kiểm Thử | Trạng Thái | Ghi Chú |
|---|---|---|
| **1. UI/UX Coverage** | [x] Hoàn thành | Khớp 100% Figma Node. Mobile thumb-zone tối ưu (P0). |
| **2. Logic & Persistence** | [x] Hoàn thành | Flag `has_seen_ai_wizard` được lưu/đọc chuẩn từ Users Collection. |
| **3. Performance SLA** | [x] Hoàn thành | Redirect < 300ms. Media optimized < 500KB. |
| **4. Security Integrity** | [x] Hoàn thành | Chống Unauthorized PATCH ID. Không leak data. |
| **5. Multilingual Support** | [x] Hoàn thành | Support 3 ngôn ngữ lõi (EN, VN, MS) chuẩn văn phong doanh nghiệp. |

> **Khuyến Nghị Release:** F06 đã sẵn sàng release. 18 kịch bản bao phủ toàn bộ rủi ro logic lặp và lỗi hiển thị mobile.
