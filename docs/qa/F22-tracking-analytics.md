# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F22 — Tracking & Analytics Integration
> **Phiên bản:** 1.0 | **Cập nhật:** 2026-03-26 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F22-tracking-analytics.md`), User Stories (3 US, ACs), F18 Dashboard Layout Standards.
> **Kỹ năng ứng dụng (.agent):** BDD (Gherkin Expectations), Performance SLA Validators (Lighthouse CWV), Security XSS Prevention, Script Injection Auditing.

---

## 1. Mục Tiêu (Objective)
Bộ Test Case tập trung kiểm thử tính năng **Tích hợp Tracking & Analytics (F22)** cho hệ thống PrimeWeb 2.0. Tính năng cho phép Seller cấu hình mã theo dõi Google Analytics 4 (GA4), Facebook/Meta Pixel, và TikTok Pixel thông qua giao diện Dashboard > Store Configuration. Các script tracking sẽ được tự động nhúng (inject) vào trang Storefront đã xuất bản.

Trọng tâm kiểm thử bao gồm:
- **Validation rules** cho từng loại Pixel ID (GA4 = `G-*`, FB = numeric, TikTok = alphanumeric).
- **Script injection** chính xác vào trang Storefront (không ảnh hưởng CMS/Dashboard).
- **Non-blocking async loading** (không gây ảnh hưởng CLS/LCP/Performance).
- **Bảo mật XSS** qua input Pixel ID.
- **Đa pixel đồng thời** hoạt động song song.

Bộ kiểm thử bao gồm **18 kịch bản chi tiết** (Positive + Negative + Edge cases).

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production |
| Browsers | Chrome (v115+), Firefox (v110+), Safari (latest) |
| Devices (Responsive) | Desktop (1920x1080), Tablet (768px), Mobile (iPhone 14 Pro 375px) |
| Test Data | GA4 IDs (`G-XXXXXXXXXX`), FB Pixel IDs (numeric 15-16 digits), TikTok Pixel IDs (alphanumeric) |
| Tools | Chrome DevTools (View Source, Network), Lighthouse CLI, Google Tag Assistant |
| Quyền truy cập | Seller (Owner) account with published Storefront |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU (Steps & Test Data) | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-F22-01] Cấu hình GA4 (Google Analytics 4 Configuration)** |
| **TC-F22.01** | `US-F22-01 / AC-1` | `UI` | **[Positive]** Hiển thị giao diện cấu hình GA4 trong Settings | **1.** Đăng nhập Dashboard với quyền Owner.<br>**2.** Điều hướng đến Dashboard > Store Configuration > Tracking & Analytics. | **GIVEN** Seller đã đăng nhập Dashboard **WHEN** truy cập mục Tracking & Analytics **THEN** hiển thị section GA4 với input field "Measurement ID", placeholder `G-XXXXXXXXXX`, helper text kèm link đến hướng dẫn tạo GA4 property. Tuân thủ F18 Dashboard Layout. | High | [ ] |
| **TC-F22.02** | `US-F22-01 / AC-2` | `Func` | **[Positive]** Lưu GA4 Measurement ID hợp lệ | **1.** Nhập `G-ABC123XYZ0` vào trường GA4 ID.<br>**2.** Nhấn nút Save. | **GIVEN** input GA4 ID khớp pattern `G-*` **WHEN** nhấn Save **THEN** hệ thống lưu thành công, hiện Toast "Settings saved successfully". DB `tracking_config` cập nhật `ga4_id = 'G-ABC123XYZ0'`. | Blocker | [x] |
| **TC-F22.03** | `US-F22-01 / AC-2` | `Func` | **[Negative]** Từ chối GA4 ID sai định dạng | **1.** Nhập `UA-12345678-1` (Universal Analytics cũ).<br>**2.** Nhập `GABC123` (thiếu dấu gạch).<br>**3.** Nhập chuỗi rỗng và nhấn Save. | **GIVEN** input không khớp pattern `G-*` **WHEN** nhấn Save hoặc blur input **THEN** hiện inline error "Invalid GA4 Measurement ID. Format must start with G- (e.g. G-XXXXXXXXXX)". Nút Save bị disabled hoặc chặn submit. | Blocker | [x] |
| **TC-F22.04** | `US-F22-01 / AC-3` | `UX` | **[Positive]** Helper text với link hướng dẫn setup GA4 | **1.** Quan sát khu vực GA4 input field. | **GIVEN** Seller nhìn thấy section GA4 **WHEN** quan sát helper text **THEN** hiển thị dòng hướng dẫn ngắn kèm hyperlink dẫn đến trang hướng dẫn tạo GA4 property (external link, mở tab mới). | Medium | [ ] |
| **[US-F22-02] Cấu hình Facebook / Meta Pixel** |
| **TC-F22.05** | `US-F22-02 / AC-1` | `Func` | **[Positive]** Lưu Facebook Pixel ID hợp lệ (numeric) | **1.** Nhập `1234567890123456` (16 chữ số) vào trường FB Pixel ID.<br>**2.** Nhấn Save. | **GIVEN** input FB Pixel ID là chuỗi numeric **WHEN** nhấn Save **THEN** lưu thành công. Toast xác nhận hiện. DB cập nhật `fb_pixel_id`. | Blocker | [x] |
| **TC-F22.06** | `US-F22-02 / AC-2` | `Func` | **[Negative]** Từ chối FB Pixel ID chứa ký tự không phải số | **1.** Nhập `12345abc67890`.<br>**2.** Nhập `pixel-12345`. | **GIVEN** input chứa ký tự non-numeric **WHEN** blur hoặc nhấn Save **THEN** hiện inline error "Facebook Pixel ID must contain only numbers". Chặn submit. | Blocker | [x] |
| **TC-F22.07** | `US-F22-02 / AC-3` | `UX` | **[Positive]** Helper text với link hướng dẫn setup Meta Pixel | **1.** Quan sát section Facebook Pixel. | **GIVEN** Seller nhìn section FB Pixel **WHEN** đọc helper text **THEN** có hyperlink dẫn đến Meta Business Suite hướng dẫn tạo Pixel (mở tab mới). | Medium | [ ] |
| **[US-F22-03] Cấu hình TikTok Pixel** |
| **TC-F22.08** | `US-F22-03 / AC-1` | `Func` | **[Positive]** Lưu TikTok Pixel ID hợp lệ (alphanumeric) | **1.** Nhập `CABC1D2E3F4G5H6` vào trường TikTok Pixel ID.<br>**2.** Nhấn Save. | **GIVEN** input TikTok Pixel ID là alphanumeric **WHEN** nhấn Save **THEN** lưu thành công, Toast confirm. DB cập nhật `tiktok_pixel_id`. | Blocker | [x] |
| **TC-F22.09** | `US-F22-03 / AC-2` | `Func` | **[Negative]** Từ chối TikTok Pixel ID chứa ký tự đặc biệt | **1.** Nhập `PIXEL@#$%^&`.<br>**2.** Nhập `<script>alert(1)</script>`. | **GIVEN** input chứa ký tự đặc biệt (non-alphanumeric) **WHEN** blur hoặc Save **THEN** hiện inline error "TikTok Pixel ID must contain only letters and numbers". Chặn submit, sanitize input. | Blocker | [x] |
| **[CROSS-PLATFORM] Script Injection & Storefront Verification** |
| **TC-F22.10** | `US-F22-01,02,03` | `Func` | **[Positive]** GA4 script tự động inject vào Storefront đã publish | **1.** Cấu hình GA4 ID hợp lệ và Save.<br>**2.** Mở Storefront (published page) trên trình duyệt mới.<br>**3.** View Page Source (Ctrl+U). | **GIVEN** GA4 ID đã được lưu **WHEN** truy cập Storefront page **THEN** page source chứa Google Analytics gtag.js script với đúng Measurement ID. Script nằm trong `<head>` hoặc trước `</body>`. Script load async/defer. | Blocker | [x] |
| **TC-F22.11** | `US-F22-02,03` | `Func` | **[Positive]** FB Pixel + TikTok Pixel script inject đồng thời | **1.** Cấu hình cả FB Pixel ID và TikTok Pixel ID, Save.<br>**2.** Mở Storefront, View Page Source. | **GIVEN** cả FB Pixel và TikTok Pixel đã cấu hình **WHEN** truy cập Storefront **THEN** page source chứa cả Facebook Pixel `fbq('init', ...)` script VÀ TikTok Pixel `ttq.load(...)` script. Cả 2 hoạt động song song không conflict. | Blocker | [x] |
| **TC-F22.12** | `All US` | `Func` | **[Positive]** Tất cả 3 pixel hoạt động đồng thời (GA4 + FB + TikTok) | **1.** Cấu hình đầy đủ cả 3 loại Pixel ID và Save.<br>**2.** Mở Storefront.<br>**3.** Kiểm tra Network tab: filter `google-analytics`, `facebook`, `analytics.tiktok`. | **GIVEN** 3 pixel đã cấu hình **WHEN** load Storefront **THEN** Network tab ghi nhận requests đến cả 3 tracking endpoints. Không có lỗi JS console. Cả 3 scripts load song song, không chặn nhau. | High | [ ] |
| **TC-F22.13** | `All US` | `Func` | **[Negative]** Script KHÔNG inject vào Dashboard/CMS pages | **1.** Cấu hình pixel IDs.<br>**2.** Điều hướng trong Dashboard (Products, Orders, Settings).<br>**3.** View Page Source. | **GIVEN** pixel đã cấu hình **WHEN** duyệt các trang Dashboard/CMS **THEN** page source KHÔNG chứa bất kỳ tracking script nào (GA4, FB, TikTok). Script chỉ inject vào Storefront published pages. | High | [x] |
| **[PERFORMANCE] Non-blocking & Lighthouse** |
| **TC-F22.14** | `PRD / Perf` | `Perf` | **[Positive]** Script load async, không ảnh hưởng Core Web Vitals | **1.** Cấu hình cả 3 pixel.<br>**2.** Chạy Lighthouse audit trên Storefront page (Performance mode).<br>**3.** So sánh LCP, CLS trước và sau khi bật tracking. | **GIVEN** 3 tracking scripts active **WHEN** chạy Lighthouse **THEN** LCP delta < 200ms so với baseline (không có pixel). CLS delta < 0.05. Tất cả tracking scripts có attribute `async` hoặc `defer`. Không có render-blocking resources từ tracking. | High | [ ] |
| **TC-F22.15** | `PRD / Perf` | `Perf` | **[Positive]** Storefront page load không bị block khi tracking endpoint timeout | **1.** Throttle network (Slow 3G).<br>**2.** Truy cập Storefront với pixel đã cấu hình. | **GIVEN** network chậm **WHEN** load Storefront **THEN** nội dung trang hiển thị đầy đủ trước. Tracking scripts fail silently, không hiện lỗi cho end-user, không block rendering. | High | [ ] |
| **[SECURITY] XSS Prevention & Input Sanitization** |
| **TC-F22.16** | `Security` | `Sec` | **[Negative]** Chặn XSS injection qua Pixel ID fields | **1.** Nhập `<script>alert('xss')</script>` vào GA4 field.<br>**2.** Nhập `"><img src=x onerror=alert(1)>` vào FB Pixel field.<br>**3.** Nhập `javascript:alert(1)` vào TikTok field.<br>**4.** Cố gắng Save (nếu validation cho phép). | **GIVEN** attacker nhập XSS payload vào pixel fields **WHEN** submit form **THEN** validation từ chối input (không khớp format). Nếu bằng cách nào đó lưu được, output PHẢI được escaped/sanitized khi render vào Storefront. Không có script execution ngoài ý muốn. | Blocker | [x] |
| **TC-F22.17** | `Security` | `Sec` | **[Negative]** Chặn SQL Injection qua Pixel ID fields | **1.** Nhập `'; DROP TABLE tracking_config; --` vào bất kỳ pixel field.<br>**2.** Nhấn Save. | **GIVEN** attacker nhập SQL injection payload **WHEN** submit **THEN** validation reject (không khớp format). DB không bị ảnh hưởng. API trả lỗi 400/422 thay vì 500. | High | [x] |
| **[UX & CRUD] Xóa, Update, Mobile Responsive** |
| **TC-F22.18** | `UX / CRUD` | `Func` | **[Positive]** Xóa Pixel ID (clear field) và script tự động gỡ khỏi Storefront | **1.** Xóa nội dung GA4 ID field (clear to empty).<br>**2.** Nhấn Save.<br>**3.** Reload Storefront, View Page Source. | **GIVEN** GA4 ID đã bị xóa **WHEN** truy cập Storefront **THEN** GA4 script không còn xuất hiện trong page source. Các pixel khác (nếu còn cấu hình) vẫn hoạt động bình thường. DB `ga4_id` = null. | High | [x] |
| **[Internal Pageview Tracking — GH-1386]** |
| **TC-F22.19** | `GH-1386` | `Func` | **[Blog Pageview Tracking]** Blog post visit được ghi nhận trong analytics và hiển thị trên Top Blogs widget (GH-1386) | **1.** Đăng nhập Owner, verify ≥1 blog post đã publish.<br>**2.** Mở incognito window (non-owner), truy cập blog post URL trực tiếp và qua subdomain.<br>**3.** Quay lại Dashboard → Analytics → tab Top Blogs → range 7 Days.<br>**4.** DevTools Network → lọc `/api/analytics/track` → kiểm tra payload. | **GIVEN** non-owner truy cập blog post **WHEN** xem Top Blogs widget **THEN** (1) Network tab ghi nhận POST `/api/analytics/track` với `pageUrl` bắt đầu `/blog/` (không có prefix `/sites/{slug}`); (2) Widget hiển thị blog post với view count > 0; (3) Số liệu nhất quán với Traffic Overview chart cùng range. Owner visit không được đếm. | Blocker | [ ] |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)

| Mã UAT | Chân dung Người dùng (User Persona) | Trình tự Thao tác (E2E Execution Flow) | Trạm kiểm soát thiết yếu (Critical Checkpoints) |
|---|---|---|---|
| **UAT-F22-01** | **Seller mới (First-time Setup)**<br>Chủ shop online lần đầu cài đặt tracking. Kỹ năng kỹ thuật trung bình, cần hướng dẫn rõ ràng. | 1. Đăng nhập Dashboard > Store Configuration > Tracking & Analytics.<br>2. Đọc helper text, click link hướng dẫn GA4 (mở tab mới).<br>3. Quay lại, nhập GA4 Measurement ID `G-ABC123XYZ0`.<br>4. Nhập FB Pixel ID `1234567890123456`.<br>5. Bỏ trống TikTok (chưa có).<br>6. Nhấn Save, nhận Toast thành công.<br>7. Mở Storefront trên tab mới, View Source xác nhận script GA4 + FB Pixel đã inject.<br>8. Kiểm tra TikTok script KHÔNG có trong source. | Helper text dễ hiểu, link hoạt động. Validation realtime khi nhập sai format. Save phản hồi nhanh (< 2s). Scripts inject chính xác vào Storefront. Không có script thừa (TikTok). |
| **UAT-F22-02** | **Seller nâng cao (Multi-platform Marketer)**<br>Chạy quảng cáo trên cả 3 nền tảng (Google, Facebook, TikTok). Cần cả 3 pixel hoạt động. | 1. Cấu hình đầy đủ GA4 + FB Pixel + TikTok Pixel IDs.<br>2. Save thành công.<br>3. Mở Storefront trên Mobile (375px viewport).<br>4. Verify cả 3 scripts trong Page Source.<br>5. Mở DevTools Network tab, filter tracking requests, xác nhận cả 3 endpoint nhận data.<br>6. Chạy Lighthouse, verify Performance score không giảm quá 5 điểm so với baseline. | 3 scripts song song, không conflict JS. Performance không bị degrade. Mobile storefront vẫn load nhanh. |
| **UAT-F22-03** | **Seller thay đổi chiến lược (Update/Remove Pixel)**<br>Seller muốn đổi FB Pixel ID cũ sang mới, gỡ TikTok. | 1. Vào Tracking settings, thấy 3 pixel đã cấu hình từ trước.<br>2. Update FB Pixel ID sang giá trị mới `9876543210123456`.<br>3. Xóa TikTok Pixel ID (clear field).<br>4. Save.<br>5. Verify Storefront: FB Pixel script có ID mới. TikTok script đã bị gỡ. GA4 không đổi. | Update reflect đúng trên Storefront. Xóa pixel gỡ sạch script. Pixel không liên quan không bị ảnh hưởng. |

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes & Rules) |
|---|---|---|
| **1. Pixel ID Validation** | [ ] Chưa chạy 0/6 TC | TC-F22.02, 03, 05, 06, 08, 09. Tất cả format validation rules phải pass 100%. Zero tolerance cho invalid ID lưu vào DB. |
| **2. Script Injection Accuracy** | [ ] Chưa chạy 0/4 TC | TC-F22.10, 11, 12, 13. Scripts inject ĐÚNG vào Storefront, KHÔNG inject vào Dashboard. Đây là điều kiện Blocker cho release. |
| **3. Performance (Non-blocking)** | [ ] Chưa chạy 0/2 TC | TC-F22.14, 15. Lighthouse LCP delta < 200ms. CLS delta < 0.05. Scripts async/defer bắt buộc. |
| **4. Security (XSS/Injection)** | [ ] Chưa chạy 0/2 TC | TC-F22.16, 17. Zero XSS execution. SQL injection blocked. Input sanitized ở cả client + server. |
| **5. CRUD & UX** | [ ] Chưa chạy 0/4 TC | TC-F22.01, 04, 07, 18. Save/Update/Delete flow hoàn chỉnh. Helper text với links hoạt động. |
| **6. E2E UAT Approval** | [ ] Chưa bắt đầu | 3 kịch bản UAT (Setup/Multi-pixel/Update-Remove) pass trên cả Desktop + Mobile. |

> **Khuyến Nghị Release:** Tất cả TC mức Blocker (8 TC) phải PASS. Không chấp nhận bất kỳ lỗi XSS hoặc script injection sai scope. Performance gate (LCP/CLS) là điều kiện cần trước khi merge vào `main`.
