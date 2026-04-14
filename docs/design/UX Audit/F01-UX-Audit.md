# F01 — UX Audit: AI Web Builder (Form-based Structured Input)

> **Version:** 1.0 | **Created:** 2026-04-13 | **Feature:** F01 AI Web Builder
> **Story Ref:** US-F01-01 ~ US-F01-10 (10 User Stories, 26 ACs)
> **Status:** UX Audit — Gap Analysis & Proposed Solutions

---

## Mục lục

- [1. Tổng quan vấn đề](#1-tổng quan-vấn-đề)
- [2. Phân tích chi tiết từng GAP](#2-phân-tích-chi-tiết-từng-gap)
- [3. Giải pháp đề xuất](#3-giải-pháp-đề-xuất)
- [4. Wireframe — Bổ sung các màn hình thiếu](#4-wireframe--bổ-sung-các-màn-hình-thiếu)
- [5. Business Rules bổ sung](#5-business-rules-bổ-sung)
- [6. Acceptance Criteria bổ sung](#6-acceptance-criteria-bổ-sung)

---

## 1. Tổng quan vấn đề

### Kết quả Audit tổng hợp

Cross-reference giữa Wireframe (`F01-wireframe-lowfi.md`), PRD (`F01-ai-builder.md`), Stories (`F01-ai-builder-stories.md`), QA Bug Report (`F01-sumbug.md`), và Source Code thực tế đã phát hiện **5 GAP chính**:

| GAP | Severity | Mô tả ngắn | Wireframe | PRD | Code |
|-----|----------|-----------|-----------|-----|------|
| **GAP-01** | :red_circle: Blocker | Scope Mismatch: Tính năng Reorder không nằm trong scope F01 nhưng vẫn tồn tại trong PRD/Stories | :x: Cần loại bỏ | FR-21, 22, 26 | Cần disable/xóa code Up/Down |
| **GAP-02** | :red_circle: Blocker | Error Recovery Flow — Partial generation failure không có wireframe | :x: Chỉ có toast retry | FR-08 | `generation-errors.ts` có map nhưng UI thiếu |
| **GAP-03** | :orange_circle: High | Draft Recovery Dialog — Wireframe có vẽ nhưng không có state machine & trigger conditions | :warning: Chỉ có 1 wireframe tĩnh | FR-07, AC-4 (US-F01-01) | Zustand localStorage có, dialog UI thiếu |
| **GAP-04** | :orange_circle: High | Rate Limit Paywall — Wireframe có vẽ nhưng không có entry point rõ ràng trong flow | :warning: Wireframe rời | FR-15, BR-03 | HTTP 402 mapped nhưng UI chưa integrate |
| **GAP-05** | :yellow_circle: Medium | Mobile Immersive Preview transition — Floating Pill + Form slide-away chưa có chi tiết animation | :warning: Concept wireframe | FR-24, FR-25, AC-7 (US-F01-09) | Chưa implement |

### Nguồn tham chiếu đã đọc

| Tài liệu | Nơi đề cập | Trạng thái |
|----------|------------|------------|
| PRD v2.1 `docs/prd/F01-ai-builder.md` | 26 FR, 9 BR, 8 AC | :white_check_mark: Đầy đủ |
| Wireframe `docs/design/F01-wireframe-lowfi.md` | 5 Desktop + 4 Mobile screens | :warning: Thiếu mobile reorder detail |
| Stories `docs/stories/F01-ai-builder-stories.md` | 10 US, 26 ACs Gherkin | :white_check_mark: Đầy đủ |
| Bug Report `docs/qa/TEST-REPORT/F01-sumbug.md` | 27 bugs (8 P0) | :red_circle: 8 blocker chưa fix |
| Source Code `src/components/builder/*` | 17 components, ~2000 LOC | :white_check_mark: Đã implement |
| Source Code `src/app/(builder)/builder/new/AIBuilderPageClient.tsx` | 770 LOC — main orchestrator | :white_check_mark: Đã implement |
| Store `src/store/builderStore.ts` | Zustand + localStorage | :white_check_mark: Đã implement |
| Error Mapping `src/lib/generation-errors.ts` | HTTP status → user message | :white_check_mark: Đã implement |

---

## 2. Phân tích chi tiết từng GAP

### GAP-01 · :red_circle: Blocker — Scope Mismatch: Loại bỏ tính năng Reorder

**Vấn đề cốt lõi:**

Tính năng đổi thứ tự Section (Reorder) đã được xác nhận là **không thuộc phạm vi (Out of Scope)** của phiên bản F01 để giảm thiểu friction và tập trung vào "Aha moment" của việc tạo web bằng AI. Tuy nhiên:
- PRD v2.1 vẫn liệt kê FR-21, FR-22, FR-26 là P0.
- User Stories vẫn có US-F01-08 và US-F01-10 (Ready).
- Source Code `BuilderCompletionView.tsx` đang hiển thị UI Up/Down buttons trên Mobile.

**Yêu cầu:** Đồng bộ hóa lại tài liệu và gỡ bỏ UI hỗ trợ Reorder để tránh gây hiểu lầm cho người dùng và QA.

---

### GAP-02 · :red_circle: Blocker — Error Recovery Flow thiếu wireframe cho Partial Failure

**Vấn đề cốt lõi:**

Wireframe Section 1.4 chỉ vẽ 1 error state đơn giản (toast + retry). Nhưng thực tế có nhiều loại error khác nhau, mỗi loại cần UI khác:

```text
  Error Types trong Code (generation-errors.ts):
  +--------------------------------------------------+
  | HTTP 400 — CONTENT_UNSAFE   → Sửa input          |
  | HTTP 401 — UNAUTHORIZED     → Đăng nhập lại      |
  | HTTP 402 — PAYMENT_REQUIRED → Upgrade paywall     |
  | HTTP 408 — TIMEOUT          → Thử lại             |
  | HTTP 429 — RATE_LIMIT       → Chờ N giây          |
  | HTTP 500 — SERVER_ERROR     → Thử lại sau         |
  | SSE disconnect giữa chừng   → ??? (không có UI)   |
  | Partial success (3/4 pages) → ??? (không có UI)   |
  +--------------------------------------------------+
```

**Tác động:**

| Loại lỗi | PRD nói gì | Wireframe | Code | Gap |
|----------|-----------|-----------|------|-----|
| Content unsafe | BR-06: Từ chối input | Wireframe 4.3 (inline error) | HTTP 400 + action "edit" | :white_check_mark: OK |
| Rate limit | FR-15: Free = 1 gen | Wireframe 4.2 (paywall) | HTTP 402 + action "upgrade" | :warning: Không có entry point flow |
| Timeout | FR-02: < 60s | Wireframe 1.4 (toast retry) | HTTP 408 + action "retry" | :warning: Không phân biệt với server error |
| SSE disconnect | AC-5 (US-F01-01) | :x: Không có | EventSource onerror | :red_circle: Không có UI |
| Partial gen | Không đề cập | :x: Không có | :x: Không có | :red_circle: Dead-end |
| Quota loss on fail | BR-07: Không trừ credit | :x: Không có | BUG-F01-08: Vẫn bị trừ | :red_circle: Bug + không có UI thông báo |

---

### GAP-03 · :orange_circle: High — Draft Recovery Dialog thiếu trigger conditions

**Vấn đề cốt lõi:**

Wireframe Section 4.1 vẽ dialog "Bạn có một bản nháp!" nhưng:
- Không mô tả khi nào dialog xuất hiện (trigger conditions)
- Không mô tả draft hiển thị gì (tên site? thời gian? trạng thái?)
- Không mô tả "Bỏ qua, tạo mới" làm gì với draft cũ (xóa hay giữ?)
- Code hiện tại dùng Zustand localStorage với TTL nhưng **không có dialog UI**

```text
  Luồng hiện tại (Code):
  User truy cập /builder/new
       |
       v
  Zustand rehydrate từ localStorage
       |
       +-- Có draft? --> Tự động load (KHÔNG hỏi user)
       |
       +-- Không có --> Hiện form trống
  
  Vấn đề: User KHÔNG ĐƯỢC HỎI có muốn tiếp tục hay tạo mới
  --> Nếu draft cũ bị lỗi/outdated --> User mắc kẹt
```

**BUG liên quan:** BUG-F01-07 — Draft not persisted on F5 refresh (P1)

---

### GAP-04 · :orange_circle: High — Rate Limit Paywall không có entry point trong flow

**Vấn đề cốt lõi:**

Wireframe Section 4.2 vẽ màn hình Paywall đẹp nhưng:
- Không cho biết khi nào user thấy màn hình này
- Không có transition từ Form → Paywall
- Không có "quay lại" từ Paywall
- Free tier = 1 generation total — user có biết trước giới hạn?

```text
  Luồng mong đợi (chưa vẽ):
  User điền form → Click "Tạo Website"
       |
       v
  API check quota ── Còn quota --> Generate (bình thường)
       |
       +-- Hết quota (HTTP 402)
              |
              v
         ??? Paywall hiện ở đâu?
         - Thay thế form panel? (Wireframe 4.2 gợi ý)
         - Overlay/Modal?
         - Toast rồi redirect?
         
         ??? Sau khi user "Nâng cấp ngay" thành công
         - Quay lại form (giữ data)?
         - Tự động trigger generate?
         - Redirect về /builder/new?
```

---

## 3. Giải pháp đề xuất

### 3.1 GAP-01: Cleanup & Scope Sync

**Quyết định:** Loại bỏ hoàn toàn khả năng tương tác đổi thứ tự block trong Builder Flow.

**Các bước xử lý:**
1.  **Cập nhật tài liệu:** 
    *   Xóa FR-21, FR-22, FR-26 trong `F01-ai-builder.md`.
    *   Chuyển US-F01-08 và US-F01-10 sang trạng thái `Deprioritized` hoặc Xóa.
2.  **Chỉnh sửa Code:**
    *   Ẩn/Xóa block code xử lý `onMoveBlock` và các nút `ArrowUp`, `ArrowDown` trong `BuilderCompletionView.tsx`.
    *   Đảm bảo `BuilderPreview` chỉ hiển thị ở chế độ View-only cho đến khi sang Editor.
3.  **UI/UX:** Người dùng muốn thay đổi thứ tự sẽ được hướng dẫn nhấn **"Open Editor"** sau khi hoàn tất quá trình generate.

### 3.2 GAP-02: Error Recovery — Phân loại UI theo Error Type

**Nguyên tắc:** Mỗi loại error có **UI riêng** thay vì 1 toast chung.

| Error Type | UI Component | User Action | Auto-dismiss |
|------------|-------------|-------------|-------------|
| **CONTENT_UNSAFE** | Inline error dưới input field (đỏ) | Sửa lại nội dung | Không (persistent) |
| **RATE_LIMIT (429)** | Toast vàng + countdown "Thử lại sau Ns" | Chờ | Có (khi hết countdown) |
| **PAYMENT_REQUIRED (402)** | Replace form panel = Paywall card | Click "Nâng cấp" | Không |
| **TIMEOUT (408)** | Toast đỏ + nút "Thử lại" | Click retry | 10 giây |
| **SERVER_ERROR (500)** | Toast đỏ + nút "Thử lại" | Click retry | 10 giây |
| **SSE_DISCONNECT** | Floating banner top "Mất kết nối" + auto-retry 3 lần | Tự động | Có (khi reconnect) |
| **PARTIAL_SUCCESS** | Toast vàng "Đã tạo N/4 trang. Tạo tiếp?" + nút "Tiếp tục" | Click tiếp tục | Không |
| **QUOTA_LOST** | Toast đỏ + "Credit đã được hoàn lại" (sau khi fix BUG-F01-08) | Thông báo | 5 giây |

### 3.3 GAP-03: Draft Recovery Dialog — Trigger & Flow

**Trigger Conditions:**

```text
  User truy cập /builder/new
       |
       v
  Check localStorage "prime-builder-session"
       |
       +-- Không có draft --> Hiện form trống (bình thường)
       |
       +-- Có draft + cùng userId
              |
              +-- Draft < 24h old --> Hiện Recovery Dialog
              |
              +-- Draft >= 24h old --> Xóa draft, hiện form trống
              |
              +-- Draft bị lỗi (corrupted) --> Xóa, hiện form trống
       |
       +-- Có draft + KHÁC userId (BUG-F01-06)
              |
              v
            Xóa draft ngay (cross-user contamination prevention)
            Hiện form trống
```

### 3.4 GAP-04: Rate Limit Paywall — Integration vào Flow

**Entry Points:**

```text
  Entry Point 1: BEFORE generate (proactive)
  +-----------+     Check quota     +------------------+
  | Form điền |  ================>  | quota > 0?       |
  | xong      |     API call        |   YES → Generate |
  | Click CTA |                     |   NO  → Paywall  |
  +-----------+                     +------------------+

  Entry Point 2: DURING generate (reactive — API 402)
  +-----------+     SSE error       +------------------+
  | Generating|  ================>  | HTTP 402?        |
  | (Step 2)  |     event: error    |   YES → Paywall  |
  +-----------+                     +------------------+

  Entry Point 3: ON LOAD (informative)
  +-----------+     Check quota     +------------------+
  | /builder  |  ================>  | quota == 0?      |
  | /new load |     API call        |   YES → Banner   |
  +-----------+                     |   "0 lượt còn"   |
                                    +------------------+
```

---

## 4. Wireframe — Bổ sung các màn hình thiếu

*Tính năng Reorder đã bị loại bỏ, không cần wireframe bổ sung cho phần này.*

### Screen B.2: Error Type — SSE Disconnect (Mid-generation)

```text
  +---------------------------+
  | [Logo]            [X]     |
  +---------------------------+
  | +-------------------------+
  | | ! Mất kết nối mạng      | <-- Persistent banner (vàng)
  | | Đang thử kết nối lại... | <-- Auto-retry countdown
  | +-------------------------+
  |                           |
  | [Preview giữ trạng thái   |
  |  cuối cùng nhận được]     |
  |                           |
  |                           |
  |                           |
  | +-------------------------+
  | | Tạo lại từ đầu          | <-- Secondary button (chi hiện sau 3 retry fail)
  | +-------------------------+
  +---------------------------+
```

### Screen B.3: Error Type — Partial Generation Success

```text
  +-------------------------------------++----------------------------------------------+
  | [Logo PrimeWeb]          [X] Close   ||                  [Badge: Partial]             |
  |                                      ||                                               |
  | --- Bước 2/3: Tạo chưa hoàn tất --- ||  [Page Tabs: Home | About | (!) Prod | Contact]
  |                                      ||  +-------------------------------------------+
  | [check] Phân tích thông tin...       ||  |                                           |
  | [check] Tạo trang Homepage...        ||  |  [Nội dung trang hiện tại]                |
  | [check] Tạo trang About Us...        ||  |                                           |
  | [X]     Tạo trang Products... (Lỗi!) ||  +-------------------------------------------+
  | [  ]    Tạo trang Contact...         ||                                               |
  |                                      ||                                               |
  | +--------------------------------+   ||                                               |
  | | ! Đã tạo 2/4 trang.            |   ||                                               |
  | | Trang Products gặp lỗi.        |   ||                                               |
  | +--------------------------------+   ||                                               |
  |                                      ||                                               |
  | +--------------------------------+   ||                                               |
  | |   Thử tạo lại trang lỗi         |   || <-- Chỉ retry trang lỗi, không tạo lại hết   |
  | +--------------------------------+   ||                                               |
  | +--------------------------------+   ||                                               |
  | |   Tiếp tục với 2 trang         |   || <-- Cho phép publish 2 trang đã có           |
  | +--------------------------------+   ||                                               |
  +--------------------------------------++----------------------------------------------+
```

### Screen B.4: Draft Recovery Dialog (Enhanced)

```text
  +--------------------------------------------------------------+
  |                                                              |
  |          +------------------------------------------+        |
  |          | (i) Bạn có một bản nháp!                  |        |
  |          |                                          |        |
  |          | +--------------------------------------+ |        |
  |          | | "Mira Boutique"                      | |        |
  |          | | Ngành: Thời trang                    | |        |
  |          | | Trạng thái: Đã tạo xong (4 trang)    | |        |
  |          | | Lưu lúc: 2 giờ trước                 | |        |
  |          | +--------------------------------------+ |        |
  |          |                                          |        |
  |          | [Bỏ qua, tạo mới]        (Secondary)     |        |
  |          | [Tiếp tục bản nháp]      (Primary)       |        |
  |          +------------------------------------------+        |
  |                                                              |
  +--------------------------------------------------------------+
```

**Ghi chú:**
- "Bỏ qua, tạo mới" → Xóa draft khỏi localStorage + DB → Hiện form trống
- "Tiếp tục bản nháp" → Load draft → Nhảy thẳng đến step tương ứng (info/generating/done)

### Screen B.5: Rate Limit Paywall — Inline trong Form Panel

```text
  +--------------------------------------++----------------------------------------------+
  |                                      ||                  [Badge: View Only]           |
  | --- Giới hạn tạo website ----------- ||                                               |
  |                                      ||          [Illustration: Upgrade/Rocket]       |
  | (!) Bạn đã sử dụng hết lượt tạo      ||           "Nâng cấp để mở khóa quyền          |
  | AI miễn phí!                         ||            năng sáng tạo vô hạn!"             |
  |                                      ||                                               |
  | +----------------------------------+ ||                                               |
  | | [star] Gói Starter - RM 29/tháng | ||                                               |
  | | - 5 website/tháng                | ||                                               |
  | | - Subdomain miễn phí             | ||                                               |
  | | [Nâng cấp ngay]                  | ||                                               |
  | +----------------------------------+ ||                                               |
  | +----------------------------------+ ||                                               |
  | | [crown] Gói Pro - RM 49/tháng    | ||                                               |
  | | - 20 website/tháng               | ||                                               |
  | | - Không logo PrimeWeb            | ||                                               |
  | | [Nâng cấp ngay]                  | ||                                               |
  | +----------------------------------+ ||                                               |
  |                                      ||                                               |
  | Hoặc liên hệ: support@primeweb.app   ||                                               |
  +--------------------------------------++----------------------------------------------+
```

### Screen B.6: Mobile Immersive Preview — Transition chi tiết

```text
  STEP 1: Form (trước khi submit)
  +---------------------------+
  | [Logo]            [X]     |
  |                           |
  | Tên doanh nghiệp *        |
  | [Mira Boutique         ]  |
  |                           |
  | Ngành nghề *              |
  | [Thời trang] [F&B] ...   |
  |                           |
  | Mô tả ngắn *              |
  | [Shop thời trang nữ    ]  |
  |                           |
  | Sản phẩm / Dịch vụ *      |
  | [Áo dài, Váy cưới      ]  |
  |                           |
  | +-------------------------+ <-- Sticky bottom
  | | [rocket] Tạo Website    |
  | +-------------------------+
  +---------------------------+

  STEP 2: Transition (400ms)
  +---------------------------+
  | [Logo]            [X]     |  ^
  |                           |  | Form trượt lên
  | Tên doanh nghiệp *        |  | translateY(-100%)
  | [Mira Boutique  ------    |  | 400ms ease-out
  |                           |  |
  |............................|
  | +-------------------------+  
  | | [Skeleton: Navbar]      |  | Preview fade-in
  | +-------------------------+  | opacity 0 -> 1
  | +-------------------------+  | 300ms ease-in
  | | [Skeleton: Hero]        |  | delay 200ms
  | +-------------------------+  v
  +---------------------------+

  STEP 3: Immersive Preview (100vh)
  +---------------------------+
  | [Logo]            [X]     | <-- Header nhỏ gọn
  +---------------------------+
  | +-------------------------+
  | | [MIRA]           [menu] |
  | +-------------------------+
  | +-------------------------+
  | |                         |
  | |   [Skeleton: Hero]      |
  | |                         |
  | +-------------------------+
  | +-------------------------+
  | |   [Skeleton: Products]  |
  | +-------------------------+
  |                           |
  |                           |
  | +-------------------------+ <-- Floating Pill
  | | [spinner] Đang tạo 2/4  |     Safe area: padding-bottom 34px (iPhone)
  | +-------------------------+     Tap → expand detail
  +---------------------------+

  STEP 3b: Floating Pill Expanded (tap pill)
  +---------------------------+
  | [Logo]            [X]     |
  +---------------------------+
  | +-------------------------+
  | | [Preview content...]    |
  | |                         |
  | +-------------------------+
  |                           |
  | +-------------------------+ <-- Expanded Bottom Sheet (40vh max)
  | | --- Tiến trình ---      |
  | |                         |
  | | [check] Phân tích...    |
  | | [check] Tạo Homepage    |
  | | [spin]  Tạo About...    |
  | | [    ]  Tạo Products    |
  | | [    ]  Tạo Contact     |
  | |                         |
  | | Dự kiến: ~20 giây nữa   |
  | |                         |
  | | [v] Thu nhỏ             | <-- Tap = collapse về Pill
  | +-------------------------+
  +---------------------------+
```

---

## 5. Business Rules bổ sung

### 5.1 Reorder Mode Rules (TRẠNG THÁI: ĐÃ BỎ)

- Không áp dụng cho phiên bản F01.

### 5.2 Error Recovery Rules

| Rule ID | Mô tả |
|---------|-------|
| **BR-ERR-01** | Mỗi error type phải map sang UI component cụ thể (không dùng chung 1 toast) |
| **BR-ERR-02** | SSE disconnect → auto-retry 3 lần (interval: 2s, 5s, 10s). Sau 3 lần → hiện nút "Tạo lại từ đầu" |
| **BR-ERR-03** | Partial generation (N/4 trang) → cho phép user "Thử tạo lại trang lỗi" hoặc "Tiếp tục với N trang" |
| **BR-ERR-04** | Khi generation fail do server/API → credit/quota KHÔNG bị trừ (BR-07 PRD). UI phải hiện "Credit đã hoàn" |
| **BR-ERR-05** | Retry từ toast → dùng cached form data, KHÔNG mở lại Pre-publish Checklist |

### 5.3 Draft Recovery Rules

| Rule ID | Mô tả |
|---------|-------|
| **BR-DRAFT-01** | Draft Recovery Dialog chỉ hiện khi: (a) Có draft trong localStorage, (b) Cùng userId, (c) Draft < 24h |
| **BR-DRAFT-02** | "Bỏ qua, tạo mới" → Xóa draft localStorage + gọi API DELETE draft → Hiện form trống |
| **BR-DRAFT-03** | "Tiếp tục bản nháp" → Load draft → Nhảy đến step tương ứng (info → form, chat → generation, done → preview) |
| **BR-DRAFT-04** | Draft từ userId khác → tự động xóa (không hỏi) — chống cross-user contamination (BUG-F01-06) |
| **BR-DRAFT-05** | Draft corrupted (JSON parse fail) → tự động xóa, hiện form trống, toast "Đã xóa bản nháp cũ" |

### 5.4 Rate Limit Paywall Rules

| Rule ID | Mô tả |
|---------|-------|
| **BR-PAY-01** | Check quota trước khi gọi AI API (proactive check khi user click "Tạo Website") |
| **BR-PAY-02** | Khi quota = 0 → Replace form panel bằng Paywall card (Screen B.5). Giữ preview panel hiện trạng thái cũ |
| **BR-PAY-03** | Sau khi upgrade thành công → redirect về /builder/new với form data giữ nguyên |
| **BR-PAY-04** | Hiện quota còn lại ở form panel header: "Còn N lượt tạo" (informative, không chặn) |

---

## 6. Acceptance Criteria bổ sung

* Acceptance Criteria cho Reorder Mode (AC-REORDER-01, AC-REORDER-02) đã bị loại bỏ.*

### AC-ERR-01: SSE Disconnect Recovery

```gherkin
GIVEN  đang ở Step 2 (Generating) và SSE stream đang active
WHEN   kết nối mạng bị mất
THEN   hiện banner vàng "Mất kết nối. Đang thử lại..."
  AND  tự động retry kết nối (lần 1: 2s, lần 2: 5s, lần 3: 10s)
  AND  Preview GIỮ NGUYÊN trạng thái cuối cùng (không bị trắng)
WHEN   reconnect thành công
THEN   banner biến mất
  AND  SSE tiếp tục từ block cuối cùng
WHEN   3 lần retry đều thất bại
THEN   banner đổi thành đỏ "Không thể kết nối"
  AND  hiện nút "Tạo lại từ đầu" (secondary button)
  AND  form data vẫn được giữ nguyên
```

### AC-ERR-02: Partial Generation Recovery

```gherkin
GIVEN  AI đã generate thành công N trang (N < 4)
  AND  trang tiếp theo gặp lỗi (API fail / timeout)
WHEN   lỗi xảy ra
THEN   progress list đánh dấu trang lỗi bằng [X] đỏ
  AND  hiện thông báo: "Đã tạo N/4 trang. Trang [tên] gặp lỗi."
  AND  hiện 2 option:
       - "Thử tạo lại trang lỗi" → retry chỉ trang fail
       - "Tiếp tục với N trang" → skip trang lỗi, chuyển sang Step 3
WHEN   user chọn "Thử tạo lại"
THEN   chỉ gọi AI cho trang bị lỗi (không tạo lại các trang đã có)
  AND  quota KHÔNG bị trừ thêm
```

### AC-DRAFT-01: Draft Recovery Dialog Flow

```gherkin
GIVEN  user truy cập /builder/new
  AND  localStorage có draft hợp lệ (cùng userId, < 24h, JSON valid)
WHEN   trang load xong
THEN   hiện Recovery Dialog (Screen B.4):
       - Tên site từ draft
       - Ngành nghề
       - Trạng thái (Đã tạo xong / Đang tạo / Chưa tạo)
       - Thời gian lưu
WHEN   user click "Tiếp tục bản nháp"
THEN   load draft data → nhảy đến step tương ứng
  AND  Dialog đóng
WHEN   user click "Bỏ qua, tạo mới"
THEN   xóa draft localStorage + API DELETE
  AND  hiện form trống mới
  AND  Dialog đóng
```

### AC-PAY-01: Rate Limit Paywall Trigger

```gherkin
GIVEN  user đã sử dụng hết quota (Free = 1, Starter = 5/mo)
WHEN   user click "Tạo Website" trên form
THEN   API trả 402 Payment Required
  AND  form panel THAY THẾ bằng Paywall card (Screen B.5)
  AND  Paywall hiện:
       - Thông báo "Hết lượt tạo AI"
       - Bảng giá các gói (Starter / Pro)
       - Nút "Nâng cấp ngay" → redirect /pricing
       - Link "Liên hệ support"
  AND  Preview panel hiện illustration "Upgrade" (không trắng)
WHEN   user quay lại (nhấn nút Back / navigate)
THEN   Paywall vẫn hiện (không tự động reset)
  AND  Chỉ reset khi user upgrade thành công
```

### AC-MOBILE-01: Immersive Preview Transition

```gherkin
GIVEN  user đang ở mobile form (Step 1)
WHEN   user tap "Tạo Website" và form validation pass
THEN   form slide up ra khỏi viewport:
       - Animation: translateY(-100%), 400ms, ease-out
THEN   Preview fade in chiếm 100vh:
       - Animation: opacity 0→1, 300ms, ease-in, delay 200ms
  AND  Floating Pill xuất hiện ở bottom:
       - Animation: translateY(100px)→0, 250ms, spring
       - Text: "[spinner] Đang tạo (0/4)..."
       - Safe area: padding-bottom 34px (iPhone home indicator)
WHEN   user tap Floating Pill
THEN   Pill expand thành Bottom Sheet (max 40vh):
       - Hiện chi tiết tiến trình từng trang
       - Nút "Thu nhỏ" để collapse về Pill
WHEN   generation hoàn tất
THEN   Pill đổi text: "Hoàn tất! [check]"
  AND  Sau 2 giây → Pill tự động biến mất
  AND  Header hiện CTA buttons (Publish / Editor)
```

---

## Appendix: Bug Cross-Reference

Các bug hiện tại ảnh hưởng trực tiếp đến UX Audit này:

| Bug ID | GAP liên quan | Mô tả | Priority |
|--------|--------------|-------|----------|
| BUG-F01-06 | GAP-03 | Client state contamination cross-account | P0 |
| BUG-F01-07 | GAP-03 | Draft not persisted on F5 refresh | P1 |
| BUG-F01-08 | GAP-02 | Quota deducted even on failed generation | P1 |
| BUG-F01-20 | GAP-05 | Input font 14px causes iOS auto-zoom | P1 |
| BUG-F01-21 | GAP-05 | Mobile Step 2 layout broken | P1 |

---

> **Next Steps:**
> 1. Cập nhật PRD và Stories để chính thức loại bỏ tính năng Reorder khỏi F01
> 2. Fix 8 P0 blockers (Security & Stability)
> 3. Implement theo thứ tự: GAP-02 (Error Recovery) → GAP-03 (Draft Recovery) → GAP-04 (Paywall)
> 4. Update QA test cases (`F01-ai-chat-builder.md`) với các AC mới
