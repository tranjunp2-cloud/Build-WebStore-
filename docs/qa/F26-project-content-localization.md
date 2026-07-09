# Quyết Định Kiểm Thử & Testcase Chi Tiết: F26 - Project Content & Template Localization

> **Phiên bản:** 1.0 | **Cập nhật:** 2026-05-28 | **Thực hiện:** QA Team
> **Nguồn tham chiếu:** `docs/prd/F26-project-content-localization.md`, `docs/stories/F26-project-content-localization-stories.md`
> **Kỹ thuật:** BVA, State Transition (locale_content JSONB), Error Guessing, Security (XSS/CSRF/Auth), Concurrency, Business-Data Guard
> **Tổng TCs:** 63 (TC-F26-01-01 → TC-F26-09-07)

---

## 1. Mục Tiêu

Bộ testcase này kiểm thử đầy đủ F26 — làm cho nội dung dự án và thư viện block/template nhận biết ngôn ngữ (`Sites.locale`):

- **US-F26-01:** Confirm ngôn ngữ ngay sau AI generate — không phụ thuộc 100% vào auto-detect.
- **US-F26-02:** Block thêm mới insert default content đúng locale (BM cho `ms`, EN cho `en`).
- **US-F26-03:** Block Library panel preview/title theo ngôn ngữ site + icon auto-translate.
- **US-F26-04:** AI dịch on-the-fly fallback + cache khi block thiếu bundle BM.
- **US-F26-05:** Language Switcher dropdown toolbar — 1-click re-language, giữ nội dung user đã sửa.
- **US-F26-06:** Audit + đóng gap coverage block × {EN, BM} trong AI generation pipeline.
- **US-F26-07:** Language Switcher block → lock vào header/nav, không vào `page.blocks[]`.

**Business Rule cốt lõi:** Template content (default headlines, CTAs, FAQ, section titles) → per-locale, swap được. Business data (tên shop, SĐT, giá, hình ảnh) → **KHÔNG BAO GIỜ** swap.

---

## 2. Test Environment

| Thông số | Yêu cầu |
|---|---|
| Môi trường | Staging / Pre-Production |
| Trình duyệt | Chrome v120+, Safari iOS, Firefox |
| Thiết bị | Desktop 1280px, Mobile iPhone 14 Pro 375px |
| Backend | Payload CMS 3 + PostgreSQL (Neon) |
| Test runner | Vitest 3 (unit + integration) + Playwright (E2E) |
| Auth | Mock `Sites.locale` field; mock OpenAI cho AI translate |
| Test data | Site với `locale='ms'`, site với `locale='en'`, block registry đầy đủ |
| OpenAI mock | Mock 200 (BM), 500 (error), timeout (5s) |

---

## 3. Scope Kiểm Thử

### In Scope
- Confirm-language step sau AI generate, persist `Sites.locale`.
- Block insert + default content resolve theo `Sites.locale`.
- Block Library panel locale-aware preview + auto-translate icon.
- AI translate server-side + cache (OpenAI) + fallback EN.
- Language Switcher dropdown toolbar, preserve user-edited content.
- Coverage audit block × {EN, BM} trong content-injection pipeline.
- Language Switcher block header-lock UX (US-F26-07).
- Security: auth endpoint, CSRF, XSS sanitization.

### Out of Scope (F26)
- Dịch dữ liệu thương mại user nhập tay (tên/mô tả sản phẩm, blog content).
- Ngôn ngữ thứ 3 (zh, Tamil) — defer Phase 2.
- CMS/admin chrome i18n — đã thuộc F21.
- F27 live switching logic (Language Switcher block chỉ static placeholder F26).

---

## 4. Unified Test Cases

---

### NHÓM 01 — US-F26-01: Confirm Project Language After AI Generate (7 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F26-01-01** | `AC-1 US-F26-01` | `[Positive]` | Popup xác nhận hiện sau AI generate với BM pre-selected | 1. Submit AI generate với prompt BM (e.g. `"Buat website kedai kopi"`).<br>2. Chờ generation hoàn thành.<br>3. Quan sát màn hình kết quả. | - Popup hiện: `"AI created your site in Bahasa Melayu — correct?"`.<br>- Hai nút: `[Yes, continue]` và `[No, switch to English]`.<br>- BM được pre-select.<br>- Không cần user reload. | Blocker | [x] |
| **TC-F26-01-02** | `AC-2 US-F26-01`, `FR-02` | `[Positive]` | User confirm BM → Sites.locale = 'ms' persisted | 1. Popup hiện với BM pre-selected.<br>2. Click `[Yes, continue]`.<br>3. Query `Sites` record DB.<br>4. Reload editor. | - `Sites.locale = 'ms'` trong DB.<br>- Không tạo column mới.<br>- Locale persist sau reload.<br>- Editor render blocks tiếp theo bằng BM. | Blocker | [x] |
| **TC-F26-01-03** | `AC-2 US-F26-01` | `[Positive]` | User switch sang EN → Sites.locale = 'en' | 1. Popup hiện BM pre-selected.<br>2. Click `[No, switch to English]`.<br>3. Query Sites record.<br>4. Add block trong editor. | - `Sites.locale = 'en'`.<br>- Block mới thêm vào dùng EN default content. | Blocker | [x] |
| **TC-F26-01-04** | `Additional Criteria US-F26-01` | `[Edge]` | User dismiss popup → locale AI-detected giữ nguyên | 1. Popup hiện.<br>2. Đóng popup (Escape hoặc click ngoài).<br>3. Query `Sites.locale`. | - `Sites.locale` giữ nguyên giá trị AI đã detect (ms).<br>- Không có error.<br>- Không hiện lại popup vô hạn khi reload. | High | [x] |
| **TC-F26-01-05** | `FR-01`, `Additional Criteria` | `[Logic]` | Phát hiện ngôn ngữ dùng guessLanguageFromInput() — không import lib mới | 1. Inspect code trong AI generate route.<br>2. Verify import. | - Chỉ dùng `guessLanguageFromInput()` từ `src/lib/ai/openai-generator.ts`.<br>- Không có thư viện detect ngôn ngữ mới nào được import. | High | [x] |
| **TC-F26-01-06** | `Additional Criteria US-F26-01`, `BR-06` | `[Val]` | Phase 1: Popup chỉ có 2 lựa chọn EN + BM | 1. Render LanguageConfirmPopup component với `detectedLocale='ms'`.<br>2. Query tất cả options/buttons. | - Chỉ có `[Yes, continue in BM]` và `[No, switch to English]`.<br>- Không có ZH, Tamil, hay locale khác.<br>- `options.length === 2`. | High | [x] |
| **TC-F26-01-07** | `FR-01`, `BR-01` | `[Edge]` | Sites.locale = null (site legacy) → default EN, popup không crash | 1. Tạo/sử dụng site record với `Sites.locale = null`.<br>2. Trigger AI generate.<br>3. Quan sát popup. | - Popup hiện với EN pre-selected (null → fallback `en`).<br>- Không có crash.<br>- Sau confirm: `Sites.locale = 'en'` hoặc `'ms'` theo lựa chọn. | High | [x] |

---

### NHÓM 02 — US-F26-02: Newly-Added Blocks Render Localized Default Content (7 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F26-02-01** | `AC-1 US-F26-02`, `FR-03` | `[Positive]` | Add block trên ms site → BM default content được insert | 1. Site với `Sites.locale = 'ms'`.<br>2. Mở editor.<br>3. Add Hero block từ Block Library.<br>4. Inspect nội dung block. | - Hero block insert với BM default headline, CTA, sample text.<br>- Không có tiếng Anh placeholder. | Blocker | [x] |
| **TC-F26-02-02** | `AC-2 US-F26-02` | `[Regression]` | Add block trên en site → EN default (hành vi hiện tại không thay đổi) | 1. Site với `Sites.locale = 'en'`.<br>2. Add bất kỳ block từ library.<br>3. Inspect nội dung. | - Block insert với EN defaults (hành vi cũ preserved).<br>- Không có BM content trên EN site. | Blocker | [x] |
| **TC-F26-02-03** | `AC-3 US-F26-02`, `FR-04` | `[Edge]` | Block thiếu BM bundle → EN fallback + cờ "needs translation" | 1. Site `locale = 'ms'`.<br>2. Add block không có BM bundle trong registry.<br>3. Inspect inserted content và metadata. | - Block insert với EN default content.<br>- Block được đánh cờ `needsTranslation: true`.<br>- Không crash. | Blocker | [x] |
| **TC-F26-02-04** | `Additional Criteria US-F26-02` | `[Logic]` | getBlockDefaults() resolve đúng theo blockType + locale | 1. Gọi `getBlockDefaults('hero', 'ms')` → kỳ vọng BM.<br>2. Gọi `getBlockDefaults('hero', 'en')` → kỳ vọng EN.<br>3. Gọi `getBlockDefaults('hero', 'zh')` → kỳ vọng EN fallback. | - BM content trả về cho `ms`.<br>- EN content trả về cho `en`.<br>- EN fallback cho locale không hỗ trợ (`zh`) — không error. | Blocker | [x] |
| **TC-F26-02-05** | `BR-01`, `FR-04` | `[Edge]` | Sites.locale = giá trị không hợp lệ ('zh') → EN fallback, không crash | 1. Set `Sites.locale = 'zh'`.<br>2. Add block.<br>3. Inspect content. | - EN defaults được dùng.<br>- Không crash, không blank block. | High | [x] |
| **TC-F26-02-06** | `FR-03` | `[Negative]` | blockType không tồn tại trong registry → graceful error | 1. Gọi block-insert với `blockType = 'nonexistent-block'`.<br>2. Observe response. | - Không crash, không blank page.<br>- Error boundary catch; user thấy thông báo lỗi rõ ràng.<br>- Không insert block rỗng. | High | [x] |
| **TC-F26-02-07** | `Additional Criteria US-F26-02`, `FR-03` | `[Logic]` | 15 high-traffic blocks đều có BM bundle hand-authored | 1. Enumerate blocks: hero, faq, features, testimonials, contact, nav, gallery, footer, cta, stats, team, pricing, video, form, blog.<br>2. Check mỗi block có `ms` bundle trong registry. | - Tất cả 15 blocks có hand-authored BM bundle.<br>- Không có block nào silently missing. | Blocker | [x] |

---

### NHÓM 03 — US-F26-03: Smart Component Adder — Localized Previews (4 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F26-03-01** | `AC-1 US-F26-03`, `FR-05` | `[Positive]` | Block Library panel hiện BM titles/preview trên ms site | 1. Render `BlockLibraryPanel` với `siteLocale='ms'`.<br>2. Inspect text content của tất cả component titles và sample previews. | - Tất cả component titles và preview text hiện bằng Bahasa Melayu.<br>- Không có tiếng Anh trong preview. | High | [x] |
| **TC-F26-03-02** | `AC-1 US-F26-03` | `[Regression]` | Block Library hiện EN trên en site (regression) | 1. Site `locale = 'en'`.<br>2. Mở Block Library panel.<br>3. Kiểm tra titles và preview text. | - Tất cả preview bằng tiếng Anh.<br>- Không có BM content. | High | [x] |
| **TC-F26-03-03** | `AC-2 US-F26-03` | `[Edge]` | hasDedicatedStrings() = false → auto-translate icon hiện trong Block Library | 1. Render `BlockLibraryPanel` với `siteLocale='ms'`.<br>2. Mock block với `hasDedicatedStrings('ms') = false`.<br>3. Inspect icon presence và tooltip. | - Icon AI auto-translate hiện kề cạnh component.<br>- Tooltip: `"Auto-translate this component to Bahasa Melayu"`. | High | [x] |
| **TC-F26-03-04** | `AC-2 US-F26-03` | `[Positive]` | hasDedicatedStrings() = true → KHÔNG hiện auto-translate icon | 1. Render `BlockLibraryPanel` với `siteLocale='ms'`.<br>2. Mock block với `hasDedicatedStrings('ms') = true`.<br>3. Inspect icon presence. | - Không có auto-translate icon bên cạnh block đó. | Medium | [x] |

---

### NHÓM 04 — US-F26-04: AI On-the-Fly Translation Fallback (8 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F26-04-01** | `AC-1 US-F26-04`, `FR-06` | `[Positive]` | Block thiếu BM → AI translate endpoint được gọi khi add | 1. ms site; mock block với `hasDedicatedStrings('ms') = false` và `needsTranslation = true`.<br>2. Spy trên translate endpoint call.<br>3. Add block; chờ response.<br>4. Inspect inserted content. | - AI translate endpoint được gọi đúng 1 lần.<br>- Block insert với BM content đã dịch.<br>- Loading indicator hiện trong khi đợi. | High | [x] |
| **TC-F26-04-02** | `AC-1 US-F26-04` | `[Positive]` | Tap icon auto-translate → AI translate được trigger | 1. ms site; icon auto-translate visible.<br>2. Click icon (spy trên translate API call).<br>3. Quan sát block preview sau response. | - AI translation request gửi đi (spy xác nhận).<br>- Block preview cập nhật với BM content. | High | [x] |
| **TC-F26-04-03** | `AC-2 US-F26-04`, `BR-05` | `[Negative]` | OpenAI API 500 → EN fallback, non-blocking notice, không crash | 1. Mock OpenAI trả về 500.<br>2. Add block cần AI translate.<br>3. Quan sát inserted content và UI. | - Block insert với EN default (fallback).<br>- Toast/notice non-blocking hiện (không modal blocking).<br>- Không crash, không infinite retry.<br>- Không có blank block. | Blocker | [x] |
| **TC-F26-04-04** | `AC-2 US-F26-04`, `BR-05` | `[Negative]` | OpenAI timeout (>5s) → EN fallback, user được thông báo | 1. Mock OpenAI timeout sau 5000ms.<br>2. Add block trigger AI translate.<br>3. Chờ timeout. | - EN fallback insert sau timeout.<br>- User thấy notice: `"Auto-translation timed out, using English default"`.<br>- Không block UI. | High | [x] |
| **TC-F26-04-05** | `AC-3 US-F26-04` | `[Positive]` | Translation đã cache → lần add thứ 2 không gọi OpenAI lại | 1. Add block thiếu BM lần 1 (AI dịch, cache lại).<br>2. Remove block.<br>3. Add lại block cùng type.<br>4. Monitor OpenAI calls. | - Lần 2: OpenAI KHÔNG được gọi.<br>- Translation từ cache được serve ngay.<br>- Cache key: `blockType + locale`. | High | [x] |
| **TC-F26-04-06** | `FR-06`, Security | `[Security]` | Unauthenticated request tới AI translate endpoint → 401 | 1. Gửi POST tới `/api/ai/translate` (hoặc equivalent) không có Auth header.<br>2. Kiểm tra response. | - HTTP `401 Unauthorized`.<br>- Không có content được dịch.<br>- Không partial response. | Blocker | [x] |
| **TC-F26-04-07** | `FR-06`, Security | `[Security]` | Locale không hợp lệ trong translate request → 400 | 1. Gửi translate request với `targetLocale = 'fr'`.<br>2. Thử `'zh'`, `'<script>alert(1)</script>'`. | - HTTP `400 Bad Request`.<br>- Chỉ chấp nhận `en` và `ms` trong Phase 1.<br>- Server validate allowlist. | High | [x] |
| **TC-F26-04-08** | Security (XSS) | `[Security]` | AI translate trả về XSS payload → sanitized trước khi insert | 1. Mock OpenAI trả về `"<script>alert('xss')</script> Selamat Datang"`.<br>2. Add block trigger AI translate.<br>3. Inspect DOM sau insert. | - `<script>` tag không được render trong DOM.<br>- Content được sanitize/escape trước khi insert vào block.<br>- Không execute JS. | Blocker | [x] |

---

### NHÓM 05 — US-F26-05: Quick Language Switcher in Editor Toolbar (10 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F26-05-01** | `AC-1 US-F26-05`, `FR-07` | `[Positive]` | Dropdown ngôn ngữ hiện trên editor toolbar với locale hiện tại | 1. Mở editor với site bất kỳ.<br>2. Quan sát toolbar. | - Language dropdown visible.<br>- Hiện active locale name (ví dụ: `"BM"` khi `locale=ms`, `"EN"` khi `locale=en`). | High | [x] |
| **TC-F26-05-02** | `AC-2 US-F26-05`, `FR-07` | `[Positive]` | Switch EN→BM → blocks chưa chỉnh sửa re-render BM | 1. EN site; page có blocks với EN default chưa chỉnh sửa.<br>2. Switch dropdown sang BM.<br>3. Inspect blocks content và `Sites.locale` trong DB. | - Default blocks hiện BM content.<br>- `Sites.locale` cập nhật thành `ms` ngay lập tức (Decision 9 — không cần extra Save). | Blocker | [x] |
| **TC-F26-05-03** | `AC-2 US-F26-05`, `FR-08`, `BR-04` | `[Positive]` | User-edited content KHÔNG bị ghi đè khi switch (CRITICAL) | 1. ms site; user sửa hero headline thành `"Kedai Kopi Kami"` (tay).<br>2. Switch sang EN.<br>3. Switch lại BM.<br>4. Inspect hero headline. | - `"Kedai Kopi Kami"` preserved trong ms slot.<br>- EN slot hiện EN default (không phải edit từ BM).<br>- Round-trip fidelity: về BM vẫn thấy edit cũ. | Blocker | [x] |
| **TC-F26-05-04** | `BR-02`, `BR-04`, `Section 7b` | `[Positive]` | Business data KHÔNG bị swap trong mọi trường hợp switch | 1. ms site; shop name = `"Kopitiam Sejati"`, phone = `"+60 12-345 6789"`.<br>2. Switch EN↔BM nhiều lần.<br>3. Inspect shop name và phone sau mỗi lần switch. | - `"Kopitiam Sejati"` và phone giữ nguyên tuyệt đối.<br>- Business data (tên shop, SĐT, tên sản phẩm, hình ảnh) không bị thay đổi. | Blocker | [x] |
| **TC-F26-05-05** | `BR-06`, `BR-07` | `[Val]` | Phase 1: Dropdown toolbar chỉ có EN + BM | 1. Mở editor bất kỳ.<br>2. Click language dropdown.<br>3. Đọc options list. | - Chỉ có `"EN"` và `"BM"` trong list.<br>- Không có ZH, TH, ID, hay locale khác. | High | [x] |
| **TC-F26-05-06** | `AC-2 US-F26-05`, `FR-07` | `[Positive]` | Sites.locale persisted ngay khi switch — không cần Save thêm | 1. EN site.<br>2. Switch sang BM qua toolbar dropdown.<br>3. Ngay lập tức query Sites record DB (không click Save).<br>4. Reload editor. | - `Sites.locale = 'ms'` trong DB ngay sau switch.<br>- Locale persist qua reload.<br>- Không có Save button requirement (Decision 9). | Blocker | [x] |
| **TC-F26-05-07** | `FR-07` | `[Edge]` | Rapid click EN→BM→EN nhanh → chỉ final selection được apply | 1. Mở editor; simulate network delay.<br>2. Click dropdown: EN → BM → EN trong < 300ms.<br>3. Chờ tất cả effects settle. | - Final state là EN.<br>- Không duplicate API calls.<br>- Không mixed-locale content trên page.<br>- `Sites.locale = 'en'`. | High | [x] |
| **TC-F26-05-08** | `FR-07` | `[Perf]` | Switch trên page 50+ blocks → không freeze/timeout | 1. Playwright: setup page với 50+ blocks untouched defaults.<br>2. Switch language qua toolbar dropdown.<br>3. Measure `performance.now()` trước và sau re-render. | - Tất cả blocks re-render trong locale mới trong < 3 giây.<br>- Không browser freeze, không JS timeout error. | High | [x] |
| **TC-F26-05-09** | `FR-08` | `[Negative]` | locale_content JSONB write fail → rollback, content preserved | 1. Mock DB write cho `locale_content` fail.<br>2. Switch language.<br>3. Quan sát kết quả. | - Language switch được rollback.<br>- Previous content preserved nguyên vẹn.<br>- User thấy error toast (không crash). | High | [x] |
| **TC-F26-05-10** | Security (CSRF) | `[Security]` | CSRF protection trên language switch endpoint | 1. Craft cross-origin request tới language switch endpoint không có CSRF token.<br>2. Submit. | - HTTP `403 Forbidden`.<br>- `Sites.locale` không thay đổi.<br>- CSRF validation chặn unauthorized switch. | Blocker | [x] |

---

### NHÓM 06 — US-F26-06: Complete Block Content-Injection Locale Coverage (4 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F26-06-01** | `AC-1 US-F26-06` | `[Logic]` | Coverage audit tạo matrix đầy đủ block × {EN, BM} | 1. Chạy coverage audit script / unit test.<br>2. Inspect output matrix. | - Matrix liệt kê mỗi block trong registry với `EN: ✅/❌` và `BM: ✅/❌`.<br>- Không có block nào bị silently omit. | High | [x] |
| **TC-F26-06-02** | `AC-2 US-F26-06`, Success Metric | `[Positive]` | AI generate BM site → 0 block hiện EN leftover | 1. Mock OpenAI để trả về BM content.<br>2. Gọi AI generate route với `locale='ms'`.<br>3. Traverse tất cả blocks trên generated page data.<br>4. Scan mỗi string field cho EN-only patterns. | - 0 blocks chứa EN-only default strings (e.g. "Frequently Asked Questions", "Get Started").<br>- Success metric: "English-leftover = 0". | Blocker | [x] |
| **TC-F26-06-03** | `AC-2 US-F26-06` | `[Logic]` | src/lib/ai/content/* có BM coverage cho toàn bộ generation-path blocks | 1. Enumerate mọi block reachable bởi AI generation + content-injection.<br>2. Check BM content entry tồn tại trong `src/lib/ai/content/*.ts`. | - Mỗi generation-path block có BM content entry.<br>- Gap = failing test (không silently skip). | High | [x] |
| **TC-F26-06-04** | `Additional Criteria US-F26-06` | `[Regression]` | Không regression trong EN content-injection sau F26 merge | 1. Chạy full unit + integration test suite.<br>2. Kiểm tra EN generation tests. | - Tất cả EN generation tests pass.<br>- Không có block EN nào bị broken.<br>- `fix/ai-gen-locale-ms` work không bị conflict. | Blocker | [x] |

---

### NHÓM 07 — US-F26-07: Language Switcher Header-Locked Block (9 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F26-07-01** | `AC-1 US-F26-07` | `[Positive]` | Language Switcher block hiện trong library dưới Navigation category | 1. Render `BlockLibraryPanel` component.<br>2. Tìm block với `category = 'Navigation'` và `type = 'language-switcher'`.<br>3. Inspect preview content. | - Block xuất hiện dưới category `Navigation`.<br>- Preview hiện `EN ▾` dropdown shape inline trong nav bar. | High | [x] |
| **TC-F26-07-02** | `AC-2 US-F26-07`, `FR-10` | `[Positive]` | Add Language Switcher → lock vào header, NavigationConfig.showLanguageSwitcher = true | 1. Site có Navigation block trong header.<br>2. Click Add Language Switcher từ library.<br>3. Inspect NavigationConfig. | - `NavigationConfig.showLanguageSwitcher = true`.<br>- Language Switcher hiện trong header/nav area. | Blocker | [x] |
| **TC-F26-07-03** | `AC-2 US-F26-07`, `FR-10` | `[Logic]` | Language Switcher KHÔNG xuất hiện trong page.blocks[] | 1. Add Language Switcher.<br>2. Inspect `page.blocks[]` data structure. | - `page.blocks[]` giữ nguyên, không có Language Switcher entry.<br>- Block chỉ phản ánh qua `NavigationConfig` flag. | Blocker | [x] |
| **TC-F26-07-04** | `AC-3 US-F26-07` | `[Positive]` | Remove Language Switcher → biến mất khỏi header, flag cleared | 1. Language Switcher đang active trong header.<br>2. Remove/delete block qua editor.<br>3. Inspect NavigationConfig và header render. | - `NavigationConfig.showLanguageSwitcher = false`.<br>- Placeholder `EN ▾` biến mất khỏi nav bar. | Blocker | [x] |
| **TC-F26-07-05** | `AC-4 US-F26-07` | `[Positive]` | Desktop (≥768px) — placeholder inline next to CTA, không overflow | 1. Playwright: set viewport 1280px.<br>2. Navigate tới page với Language Switcher active.<br>3. Screenshot nav; check `getByTestId('lang-switcher')` position.<br>4. Test tất cả 6 nav variants. | - `EN ▾` placeholder hiện inline bên cạnh CTA.<br>- Không có layout overflow (`scrollWidth === clientWidth`).<br>- Tất cả 6 nav variants render không crash. | High | [x] |
| **TC-F26-07-06** | `AC-5 US-F26-07` | `[Mobile]` | Mobile (<768px) — ẩn khỏi top bar, hiện trong drawer | 1. Playwright: set viewport 375px.<br>2. Navigate tới page với Language Switcher active.<br>3. Assert lang-switcher NOT visible trong top nav.<br>4. Click hamburger; assert lang-switcher VISIBLE trong drawer phía trên CTA. | - Placeholder KHÔNG xuất hiện trên top nav bar.<br>- Hiện trong drawer phía trên CTA button.<br>- Không layout break. | High | [x] |
| **TC-F26-07-07** | `Additional Criteria US-F26-07`, `FR-11` | `[Logic]` | Không có onClick trong F26 — static placeholder only | 1. Inspect source của LanguageSwitcher component F26.<br>2. Check onClick handler. | - Không có onClick event trên `EN ▾` dropdown.<br>- Visual only (F27 sẽ thêm switching logic). | High | [x] |
| **TC-F26-07-08** | `AC-2 US-F26-07` | `[Negative]` | Add Language Switcher khi không có Navigation block → error, page.blocks[] không bị pollute | 1. Page không có Navigation/header block.<br>2. Thử add Language Switcher từ library.<br>3. Quan sát kết quả. | - Error/warning hiện: `"Language Switcher requires a Navigation block in the header"`.<br>- Block KHÔNG được add vào `page.blocks[]`.<br>- `showLanguageSwitcher` giữ nguyên `false`. | High | [x] |
| **TC-F26-07-09** | `AC-6 US-F26-07` | `[Positive]` | NavigationConfig.showLanguageSwitcher persist sau save/reload | 1. Add Language Switcher; save page.<br>2. Reload.<br>3. Inspect NavigationConfig. | - `showLanguageSwitcher = true` persist trong DB.<br>- F27 renderer có thể đọc flag để activate live switching.<br>- Không bị reset về `false` sau reload. | High | [x] |

---

### NHÓM 08 — Data Integrity, Business Rules & Cross-cutting (7 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F26-08-01** | `BR-01` | `[Edge]` | Sites.locale null/unsupported → EN fallback trong mọi feature | 1. Test với `Sites.locale = null`, `'zh'`, `'fr'`.<br>2. Trigger add-block + language switch + block library preview. | - Tất cả features fallback về EN.<br>- Không crash, không blank content.<br>- Logging phía server cho unsupported locale. | High | [x] |
| **TC-F26-08-02** | `BR-02`, `Section 7b` | `[Logic]` | Classification template vs business data đúng với toàn bộ field types | 1. Pass mỗi loại content field qua classification function.<br>2. Verify: headline → template; shop name → business data; CTA → template; phone → business data. | - Mọi template field classified đúng (per-locale, swappable).<br>- Mọi business data field classified đúng (never swap).<br>- Không có misclassification trong bảng Section 7b. | Blocker | [x] |
| **TC-F26-08-03** | `BR-03` | `[Logic]` | Hand-authored translation ưu tiên hơn AI translate | 1. Block có cả hand-authored BM bundle VÀ AI-translated cache.<br>2. Request BM content cho block đó. | - Hand-authored bundle được trả về.<br>- AI translation cache không được dùng khi có hand-authored. | High | [x] |
| **TC-F26-08-04** | Concurrency | `[Edge]` | Hai editor switch language đồng thời → không ghi đè data của nhau | 1. Vitest: tạo 2 concurrent Payload requests trên cùng page ID.<br>2. Request A: PATCH `locale_content` với `ms` slot.<br>3. Đồng thời Request B: PATCH `locale_content` với `en` slot.<br>4. Query final state sau cả 2 complete. | - Không session nào mất data silently.<br>- `locale_content.ms` và `locale_content.en` slots độc lập trong JSONB.<br>- Không corrupt data. | Blocker | [x] |
| **TC-F26-08-05** | `FR-08`, Data Integrity | `[Logic]` | locale_content JSONB migration — data existing rows được preserved | 1. Chạy DB migration thêm `locale_content jsonb DEFAULT '{}'`.<br>2. Query existing page records sau migration. | - Mọi rows hiện tại có `locale_content = '{}'`.<br>- Không có data bị truncate.<br>- Migration idempotent (chạy lại không bị error). | Blocker | [x] |
| **TC-F26-08-06** | `AC-3 US-F26-04` | `[Edge]` | Cache invalidation khi default content của block được cập nhật | 1. Block default `hero` đã được AI translate và cache.<br>2. Developer update hand-authored `hero` BM content.<br>3. Request BM content cho `hero` lần mới. | - Cache bị invalidated hoặc stale miss được detected.<br>- New hand-authored content được serve (không dùng stale AI cache).<br>- Không phục vụ outdated translation vô thời hạn. | High | [x] |
| **TC-F26-08-07** | `FR-08`, `BR-04` | `[Logic]` | Round-trip locale switch — EN edit → BM → EN: fidelity tuyệt đối | 1. EN site; user edit hero headline thành `"Welcome to Our Store"`.<br>2. Switch sang BM qua toolbar.<br>3. Switch lại EN.<br>4. Inspect hero headline. | - `"Welcome to Our Store"` restored chính xác trong EN slot.<br>- BM slot hiện BM default (không phải EN edit).<br>- locale_content JSONB lưu hai slots độc lập. | Blocker | [x] |

---

### NHÓM 09 — Source Implementation: lang-detect, block-i18n, Translator Cache, AddSectionContext (7 TCs)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F26-09-01** | `lang-detect.ts` | `[Logic]` | lang-detect: BM prompt → contentLang='ms', blockLang='ms' | 1. Gọi `detectLanguage("Buat website kedai kopi kami")` từ `src/lib/ai/lang-detect.ts`.<br>2. Inspect trường `contentLang` và `blockLang`. | - `contentLang = 'ms'` (fast-heuristic path match).<br>- `blockLang = 'ms'`.<br>- `gpLang` là Bahasa Melayu hoặc Malay. | Blocker | [x] |
| **TC-F26-09-02** | `lang-detect.ts` | `[Logic]` | lang-detect: EN prompt → contentLang='en' | 1. Gọi `detectLanguage("Build a website for my coffee shop")` từ `lang-detect.ts`.<br>2. Inspect `contentLang`. | - `contentLang = 'en'`.<br>- Không rơi vào vi/ms heuristic path. | High | [x] |
| **TC-F26-09-03** | `block-i18n.ts`, `FR-05` | `[Logic]` | hasDedicatedStrings: 'ms' → true; 'zh' → false | 1. Gọi `hasDedicatedStrings('ms')` từ `src/lib/ai/block-i18n.ts`.<br>2. Gọi `hasDedicatedStrings('zh')`.<br>3. Gọi `hasDedicatedStrings('en')`. | - `hasDedicatedStrings('ms') === true` (ms trong 8-lang seed).<br>- `hasDedicatedStrings('zh') === true` (zh cũng trong seed).<br>- `hasDedicatedStrings('xx') === false` (unknown lang → GPT path). | Blocker | [x] |
| **TC-F26-09-04** | `block-i18n.ts`, `FR-03` | `[Logic]` | getBlockStrings('ms') trả về BM strings đầy đủ cho tất cả categories | 1. Gọi `getBlockStrings('ms')` từ `block-i18n.ts`.<br>2. Inspect tất cả 6 categories: navigation, faq, cta, contact, footer, about. | - `getBlockStrings('ms').faq.headline` ≠ `"Frequently Asked Questions"` (không phải EN).<br>- `getBlockStrings('ms').navigation.home` ≠ `"Home"` (BM string).<br>- Tất cả string fields non-empty cho locale `ms`. | Blocker | [x] |
| **TC-F26-09-05** | `block-strings-translator.ts` | `[State]` | Translator cache: MISS → GPT output preserved; HIT → cache served | 1. Clear `runtimeBlockStringsCache`.<br>2. Gọi translator cho lang không trong seed lần 1 (cache miss).<br>3. Spy xác nhận GPT call được queued (fire-and-forget).<br>4. Inject cache manually với BM data.<br>5. Gọi translator lần 2 (cache hit). | - Lần 1: GPT call queued (fire-and-forget); original output preserved as-is; không throw.<br>- Lần 2: cache hit; GPT NOT called; cached strings returned. | High | [x] |
| **TC-F26-09-06** | `lang-detect.ts` | `[Edge]` | lang-detect: Empty string → fallback contentLang='en', không crash | 1. Gọi `detectLanguage("")` và `detectLanguage("   ")` từ `lang-detect.ts`.<br>2. Inspect kết quả. | - Không throw error.<br>- `contentLang = 'en'` (safe default).<br>- `gpLang` là `'English'` hoặc equivalent. | High | [x] |
| **TC-F26-09-07** | `AddSectionContext`, `FR-03` | `[Logic]` | AddSectionContext.locale populated khi add block trên ms site | 1. Unit test: setup editor context với `siteLocale = 'ms'`.<br>2. Trigger add-block action.<br>3. Capture `AddSectionContext` object passed to block factory. | - `AddSectionContext.locale === 'ms'`.<br>- Block factory nhận đúng locale → chọn BM defaults (root cause fix).<br>- Nếu `AddSectionContext.locale` absent → fallback EN + `needsTranslation = true`. | Blocker | [x] |

### NHÓM 10 — Structural Fields vs Locale Slots (variant-revert bug, 4 TCs)

> Bug gốc: site generation-locale `vi` (Sites.locale chỉ có en/ms) → đổi hero variant chỉ ghi vào `localeOverrides['vi']`, flat block giữ variant cũ → canvas revert sau save/re-render trong khi settings tab vẫn hiện variant mới.

| TC ID | Module | Loại | Mô tả | Bước | Kỳ vọng | Ưu tiên | Status |
|---|---|---|---|---|---|---|---|
| **TC-F26-10-01** | `structural-block-fields.ts` | `[Logic]` | splitStructuralChanges tách structural (variant, backgroundColor, locale-controls) khỏi content | 1. Gọi `splitStructuralChanges({variant, backgroundColor, headline, videoUrl})`. | - structural = {variant, backgroundColor}.<br>- content = {headline, videoUrl}.<br>- `stripStructuralFields` loại mọi key trong `STRUCTURAL_BLOCK_FIELDS`. | Blocker | [x] |
| **TC-F26-10-02** | `editorStore.getDisplayBlock` | `[State]` | Locale override/embedded `_localeContent` không được che structural field của flat block | 1. Flat block variant='split-right'; set override vi {variant:'video', headline:'Đã sửa'}.<br>2. Gọi getDisplayBlock. | - `display.variant = 'split-right'` (flat thắng).<br>- `display.headline = 'Đã sửa'` (content override vẫn áp).<br>- Tương tự cho embedded `_localeContent`. | Blocker | [x] |
| **TC-F26-10-03** | `editorStore.clearLocaleOverrideField` | `[State]` | Xoá 1 field khỏi mọi locale slot của block, giữ content khác | 1. Set override vi+en đều có {variant, headline}.<br>2. Gọi clearLocaleOverrideField(blockId,'variant'). | - Cả 2 slot chỉ còn {headline}.<br>- Block không có override → no-op, không throw. | High | [x] |
| **TC-F26-10-04** | `routeBlockChanges` (nguồn routing của `handleBlockUpdate`) | `[Regression]` | Ma trận routing: vi-native ghi flat đủ; non-base chỉ structural vào flat; id-less ghi flat toàn bộ (echo raw, không qua template fallback) | 1. Gọi `routeBlockChanges` với các ctx: vi/vi/en (native), en/vi/en (non-base), hasBlockId=false, generationLocale rỗng.<br>2. Integration: áp routing vi-native vào store có override bẩn → đọc flat + getDisplayBlock. | - vi-native: flatChanges = toàn bộ patch; contentOverride = content; purgeKeys = structural.<br>- non-base: flatChanges CHỈ structural (không leak content vào flat vi).<br>- id-less: tất cả flat, không override/purge.<br>- Gate so với `generationLocale`, KHÔNG phải `Sites.locale`.<br>- Integration: display = 'video', không revert. | Blocker | [x] |

---

## 5. 10-Point Checklist (Sign-Off)

| # | Tiêu Chí | Trạng Thái |
|:---:|:---|:---:|
| 1 | **Confirm popup xuất hiện** ngay sau AI generate với locale đúng pre-selected; 2 lựa chọn EN + BM. | [ ] |
| 2 | **Sites.locale persisted** sau confirm popup; không tạo column mới. | [ ] |
| 3 | **Block add trên ms site = BM default content**; block add trên en site = EN default (hành vi cũ preserved). | [ ] |
| 4 | **Fallback an toàn**: thiếu BM bundle → EN default + cờ `needsTranslation`; không crash. | [ ] |
| 5 | **Business data KHÔNG bị swap**: shop name, SĐT, tên sản phẩm, hình ảnh → giữ nguyên qua mọi language switch. | [ ] |
| 6 | **User-edited content preserved**: `locale_content` JSONB slots độc lập; switch chỉ swap untouched defaults. | [ ] |
| 7 | **AI translate fail-safe**: OpenAI 500/timeout → EN fallback, non-blocking notice, không crash, không infinite retry. | [ ] |
| 8 | **Language Switcher block header-lock**: Add → `NavigationConfig.showLanguageSwitcher=true` KHÔNG vào `page.blocks[]`; Remove → flag=false. | [ ] |
| 9 | **Security clean**: AI translate endpoint require auth (401 unauth); CSRF protection (403); AI output sanitized (XSS). | [ ] |
| 10 | **Zero EN leftover** trên BM site sau AI generate; coverage audit matrix complete cho block × {EN, BM}. | [ ] |

---

## 6. Quality Gates

| Nhóm | Trạng Thái | Ghi Chú |
|---|---|---|
| **1. Confirm Language Flow** | [ ] Not Run | Popup UX, Sites.locale persist, dismiss behavior, legacy null locale |
| **2. Block Locale Defaults** | [ ] Not Run | BM insert on ms site, EN regression, fallback flag, registry coverage |
| **3. Block Library Previews** | [ ] Not Run | BM preview ms site, EN regression, auto-translate icon logic |
| **4. AI Translate Pipeline** | [ ] Not Run | Happy path, cache, timeout, 500, auth (401), locale allowlist, XSS sanitize |
| **5. Language Switcher Toolbar** | [ ] Not Run | Re-language, preserve user edits, business data guard, rapid click, 50+ blocks perf, CSRF |
| **6. Coverage Audit** | [ ] Not Run | Matrix complete, 0 EN leftover, content/* BM coverage, EN regression |
| **7. Language Switcher Block** | [ ] Not Run | Header-lock, page.blocks[] guard, desktop/mobile layout, static placeholder, persist |
| **8. Data Integrity & Security** | [ ] Not Run | locale_content migration, classification, hand-auth priority, concurrent editor, cache invalidation |

> **Khuyến Nghị Release:** Tất cả 10 điểm Checklist và 8 Quality Gates phải đạt 100% Passed. Ưu tiên Blocker TCs trước (TC-F26-01-01, 02-01, 02-03, 04-03, 04-06, 04-08, 05-02, 05-03, 05-04, 05-06, 05-10, 06-02, 06-04, 07-02, 07-03, 07-04, 08-02, 08-04, 08-05, 08-07).

---

**PHÊ DUYỆT BỞI:** .................................... **NGÀY:** ..../..../2026
