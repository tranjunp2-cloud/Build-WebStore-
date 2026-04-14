# F05 — UX Audit: Publish & Post-Publish Flow

> **Version:** 1.0 | **Created:** 2026-04-13 | **Feature:** F05 AI Editor
> **Story Ref:** US-F05-10 (Publish & Unpublish Flow)
> **Status:** UX Audit — Proposed Solution

---

## Mục lục

- [1. Tổng quan vấn đề](#1-tổng-quan-vấn-đề)
- [GAP-01 · 🔴 Blocker — Post-Publish Flow](#gap-01--blocker--sau-khi-publish-thành-công-user-rơi-vào-dead-end)
- [GAP-02 · 🔴 Blocker — Delete Block Confirm & Interaction Toolbar](#gap-02--blocker--xóa-block-không-có-confirm--thiếu-interaction-toolbar-trên-iframe)
- [GAP-03 · 🟡 Minor — Offline Fallback](#gap-03--minor--offline-fallback-br-07)
- [GAP-04 · 🟢 Enhancement — Context-Aware AI Chat](#gap-04--enhancement--chat-ai-theo-block-context-aware-ai-chat)
- [GAP-05 · 🟡 Minor — Multi-tab Editing](#gap-05--minor--multi-tab-editing)
- [GAP-06 · 🟡 Minor — Component Spacing](#gap-06--minor--component-spacing-thiếu-khoảng-thở-giữa-các-khối)
- [GAP-07 · 🔴 Blocker — Block Image Editing](#gap-07--blocker--block-image-editing-không-thể-đổi-ảnh-component)
- [GAP-08 · 🟡 Minor — Limited Footer Editing](#gap-08--minor--limited-footer-editing-không-thể-sửa-link-trong-footer)
- [GAP-09 · 🔴 Blocker — Missing Breadcrumb Settings](#gap-09--blocker--missing-breadcrumb-settings-breadcrumb-không-có-settings)

---

## 1. Tổng quan vấn đề

### GAP-01 · 🔴 Blocker — Sau khi Publish thành công, user rơi vào dead-end

**Luồng hiện tại (có vấn đề):**

```
User click 🚀 Publish → Pre-publish checklist (Screen 3.9) → Click "Publish ngay" → ??? (Dead-end)
```

**Nguồn tham chiếu đã đọc:**

| Tài liệu | Nơi đề cập | Mô tả hiện tại |
|-----------|------------|-----------------|
| PRD §AC-1 (US-F05-10) | `docs/prd/F05-ai-editor.md` L457-468 | `toast "🎉 Website đã live!" + link mở tab mới` |
| Wireframe Screen 3.9 | `docs/design/F05-wireframe-lowfi.md` L618-654 | Pre-publish checklist. **Dừng tại đây — không vẽ post-publish** |
| Stories §AC-2 | `docs/stories/F05-ai-editor-stories.md` L471-478 | Re-publish: `changes are live within 30 seconds` — **không mô tả UI** |
| Bug Report | `docs/qa/TEST-REPORT/F05-sumbug.md` L142-156 | BUG-F05-006: Unpublish API trả sai HTTP code |

---

## 2. Phân tích chi tiết GAP-01

### 2.1 Vấn đề cốt lõi

Wireframe hiện tại chỉ vẽ đến bước **Pre-publish Checklist** (Screen 3.9). Sau khi user click "Publish ngay", **không có wireframe nào** mô tả:

```text
                    ┌─────────────────────────────────────────┐
                    │            CÁC CÂU HỎI BỎ NGỎ           │
                    ├─────────────────────────────────────────┤
                    │                                         │
 ┌──────────┐       │  ❓ Badge "Draft" chuyển thành gì?       │
 │ Publish  │       │  ❓ Nút 🚀 Publish đổi label thế nào?    │
 │  ngay!   │──────▶│  ❓ Sheet Pre-publish tự đóng hay không? │
 │          │       │  ❓ Toast hiển thị bao lâu? Có CTA gì?   │
 └──────────┘       │  ❓ User tiếp theo làm gì? (Next Action) │
                    │  ❓ Re-publish giống hay khác lần đầu?    │
                    │  ❓ Unpublish entry point ở đâu?          │
                    │                                         │
                    └─────────────────────────────────────────┘
```

### 2.2 Luồng hiện hành (PRD chỉ mô tả text, không có wireframe)

| Bước | PRD nói gì | Wireframe | Gap |
|------|-----------|-----------|-----|
| 1. Click `🚀 Publish` | Hiện pre-publish checklist | ✅ Screen 3.9 | — |
| 2. Click "Publish ngay" | `site.isPublished = true` | ❌ Không có | **Dead-end** |
| 3. After publish | `toast "🎉 Website đã live!" + link` | ❌ Không có | **Không biết toast ở đâu, CTA gì** |
| 4. Badge update | `"Draft" → "Live" (green dot)` | ❌ Không có | **Không biết transition animation** |
| 5. Re-publish | `changes are live within 30 seconds` | ❌ Không có | **Nút gì? Ở đâu? Giống lần đầu?** |
| 6. Unpublish | AC-3: `chọn "Unpublish"` | ⚠️ Chỉ có Confirm Modal 2.1 | **Entry point mơ hồ** |

### 2.3 Tác động đến User Experience

```text
Severity: 🔴 BLOCKER
  - User publish xong → không biết website đã live chưa
  - Không có cách nhanh để xem website live
  - Không biết cách update sau khi edit thêm
  - Publish là CTA cuối cùng quan trọng nhất → dead-end = mất trust
```

---

## 3. Giải pháp đề xuất

### 3.1 Nguyên tắc thiết kế

```
1. Nút Publish chỉ hiển thị 1 LẦN → khi site chưa bao giờ published (Draft)
2. Sau khi Publish → Publish ẩn → thay bằng "View Live" (xem website đã online)
3. Khi user chỉnh sửa block → xuất hiện nút "Update" để đẩy thay đổi lên live
4. Unpublish là thao tác nâng cao → chuyển vào Settings Domain (không để toolbar)
```

### 3.2 State Machine — Publish Flow

Toàn bộ lifecycle của nút Publish trên Toolbar:

```text
                                ┌──────────────────────────────────┐
                                │          STATE MACHINE            │
                                └──────────────────────────────────┘

  ┌───────────┐     Click        ┌───────────────┐     Click       ┌──────────────┐
  │  STATE 1  │ ──────────────▶  │   STATE 2     │ ─────────────▶  │   STATE 3    │
  │  DRAFT    │   🚀 Publish     │  PUBLISHING   │  API success    │    LIVE      │
  │           │                  │  (loading)    │                 │              │
  └───────────┘                  └───────────────┘                 └──────┬───────┘
                                        │                                │
                                   API fail                         User edit block
                                        │                                │
                                        ▼                                ▼
                                 ┌───────────────┐                ┌──────────────┐
                                 │  STATE 2-ERR  │                │   STATE 4    │
                                 │  PUBLISH FAIL │                │ LIVE + DIRTY │
                                 │ (toast error) │                │ (has changes)│
                                 └───────────────┘                └──────┬───────┘
                                                                        │
                                                                   Click Update
                                                                        │
                                                                        ▼
                                                                 ┌──────────────┐
                                                                 │   STATE 5    │
                                                                 │  UPDATING    │
                                                                 │  (loading)   │
                                                                 └──────┬───────┘
                                                                        │
                                                                   API success
                                                                        │
                                                                        ▼
                                                               Quay về STATE 3 (LIVE)
```

### 3.3 Tóm tắt hành vi từng State

| State | Badge Toolbar | Nút chính (phải toolbar) | Hành vi |
|-------|---------------|--------------------------|---------|
| **1. DRAFT** | `Draft` (chấm xám) | `🚀 Publish` (gradient CTA) | Lần đầu publish. Mở Pre-publish Checklist |
| **2. PUBLISHING** | `Publishing...` (pulse) | `🚀 Publishing...` (disabled, spinner) | API đang gọi. Chờ response |
| **2-ERR. FAIL** | `Draft` | `🚀 Publish` (quay lại) | Toast lỗi "Publish thất bại. Thử lại." |
| **3. LIVE** | `Live` 🟢 | `🌐 View Live ▾` (dropdown) | Website đã online. Dropdown: Open Website / Copy Link |
| **4. LIVE + DIRTY** | `Live · Unsaved` | `🌐 View Live ▾` + `🔄 Update` | Có thay đổi chưa push lên live |
| **5. UPDATING** | `Updating...` (pulse) | `🔄 Updating...` (disabled) | Đang deploy changes |

---

## 4. Wireframe — Publish States

### Screen A.1: STATE 1 — Draft (Trạng thái mặc định ban đầu)

Đây là trạng thái khi site chưa bao giờ được publish. Nút `🚀 Publish` nổi bật ở góc phải Toolbar.

```text
Desktop Toolbar:
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡]  Home ▼  │  🎨 Templates  │  ↩ Undo  ↪ Redo  │  💻 Desktop ▼  │  👁️  │ ● Draft │ 🚀 Publish │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                                                       ▲         ▲
                                                                  Chấm xám   Gradient button
                                                                  (Draft)     Primary CTA

Mobile Header:
┌───────────────────────┐
│ ←  [🏠 Trang chủ]     │
│            ● Draft  🚀│ ← Nút Publish hiển thị khi Draft
└───────────────────────┘
```

**Behavior:**
- Badge `● Draft` (chấm xám + text) luôn hiển thị ở Toolbar
- Nút `🚀 Publish` là Primary CTA → gradient background nổi bật
- Click `🚀 Publish` → mở Pre-publish Checklist (Screen 3.9 hiện có, giữ nguyên)

---

### Screen A.2: STATE 2 — Publishing (Đang đẩy lên live)

Trạng thái ngay sau khi user click "Publish ngay" trong Pre-publish Checklist.

```text
Desktop Toolbar:
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡]  Home ▼  │  🎨 Templates  │  ↩ Undo  ↪ Redo  │  💻 Desktop ▼  │ 👁️ │ ⏳ Publishing... │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                            ▲
                                                                     Pulse animation
                                                                     Spinner + text

Mobile Header:
┌───────────────────────┐
│ ←  [🏠 Trang chủ]     │
│        ⏳ Publishing...│ ← Pulse animation thay thế badge
└───────────────────────┘
```

**Behavior:**
- Pre-publish Sheet đóng tự động
- Badge đổi thành `⏳ Publishing...` với pulse animation (nhấp nháy nhẹ)
- Tất cả nút trên Toolbar vẫn hoạt động (user vẫn edit được trong lúc chờ)
- API call: `PATCH /api/sites/:id { isPublished: true }`
- Thời gian chờ trung bình: 5-15 giây

---

### Screen A.3: STATE 3 — Live (Publish thành công) ✅

Trạng thái sau khi API trả success. Đây là **wireframe hoàn toàn mới** giải quyết GAP-01.

```text
Desktop Toolbar:
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡]  Home ▼  │  🎨 Templates  │  ↩ Undo  ↪ Redo  │  💻 Desktop ▼  │  👁️  │ 🟢 Live │ 🌐 View Live ▾ │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                         ▲          ▲
                                                                    Chấm xanh    Nút mới (outline)
                                                                    animated    thay thế Publish
                                                                    pop-in

Dropdown khi click "🌐 View Live ▾":
                                                                    ┌──────────────────────┐
                                                                    │ 🔗 Open Website      │ → target="_blank"
                                                                    │    florashop.prime.app│
                                                                    ├──────────────────────┤
                                                                    │ 📋 Copy Link          │ → clipboard
                                                                    └──────────────────────┘

Mobile Header:
┌───────────────────────┐
│ ←  [🏠 Trang chủ]     │
│        🟢 Live  🌐 ▾  │ ← "🌐 ▾" compact dropdown
└───────────────────────┘
```

**Toast notification (hiện 5 giây sau khi publish xong):**

```text
┌──────────────────────────────────────────────────┐
│ 🎉  Website đã live!                             │
│     florashop.primeweb.app                    [✕] │
└──────────────────────────────────────────────────┘
                            ▲
                    Bottom-right toast
                    Auto-dismiss 5s
```

**Behavior Detail:**

| # | Hành vi | Mô tả |
|---|---------|-------|
| 1 | Badge transition | `⏳ Publishing...` → `🟢 Live` với scale pop-in animation (300ms ease-out) |
| 2 | Nút thay thế | `🚀 Publish` ẩn hoàn toàn → `🌐 View Live ▾` hiện ra (fade-in 200ms) |
| 3 | Toast | Hiện ở bottom-right (desktop) / bottom-center (mobile), auto-dismiss 5 giây |
| 4 | Dropdown — Open Website | Mở tab mới tới `[slug].primeweb.app`, text phụ hiển thị domain |
| 5 | Dropdown — Copy Link | Copy full URL vào clipboard, hiện micro-toast "✓ Đã copy" 2 giây |
| 6 | Re-click View Live | Dropdown toggle (mở/đóng), click outside = đóng |

---

### Screen A.4: STATE 4 — Live + Dirty (Có thay đổi mới chưa Update)

Khi site đã Live nhưng user tiếp tục chỉnh sửa bất kỳ block nào. Nút `🔄 Update` xuất hiện kế bên `View Live`.

```text
Desktop Toolbar:
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡]  Home ▼  │  🎨  │  ↩  ↪  │  💻 Desktop ▼  │  👁️  │ 🟢 Live · Unsaved │ 🔄 Update │ 🌐 View Live ▾ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                              ▲               ▲           ▲
                                                    Badge đổi text       NÚT MỚI     Giữ nguyên
                                                    "Live · Unsaved"    Gradient CTA    outline
                                                    (chấm xanh giữ)    (nổi bật)

Mobile Header:
┌─────────────────────────────┐
│ ←  [🏠 Trang chủ]           │
│    🟢 Live · Unsaved  🔄 🌐 ▾│ ← "🔄" compact update button
└─────────────────────────────┘
```

**Triggers khiến STATE 3 → STATE 4:**

| Trigger | Mô tả |
|---------|-------|
| User sửa text trong block (WYSIWYG) | `isDirty = true` → hiện nút Update |
| AI Chat apply changes | `isDirty = true` → hiện nút Update |
| User kéo thả block (reorder) | `isDirty = true` → hiện nút Update |
| User thêm/xóa block | `isDirty = true` → hiện nút Update |
| User đổi Global Settings | `isDirty = true` → hiện nút Update |
| Auto-save triggers (3s debounce) | Lưu vào DB **nhưng chưa deploy** → nút Update **vẫn hiển thị** |

> **Lưu ý quan trọng:** Auto-save lưu data vào database (draft), nhưng **KHÔNG deploy lên live**. Chỉ khi user click `🔄 Update` thì thay đổi mới được push lên website public. Điều này đảm bảo user có quyền kiểm soát khi nào thay đổi được public.

---

### Screen A.5: STATE 5 — Updating (Đang deploy thay đổi)

Sau khi user click `🔄 Update`, hệ thống deploy changes lên live.

```text
Desktop Toolbar:
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡]  Home ▼  │  🎨  │  ↩  ↪  │  💻 Desktop ▼  │  👁️  │ ⏳ Updating... │          │ 🌐 View Live ▾ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                              ▲             ▲
                                                        Pulse animation    Nút Update
                                                        (giống Publishing)  disabled/spinner

Mobile Header:
┌───────────────────────────┐
│ ←  [🏠 Trang chủ]         │
│       ⏳ Updating...   🌐 ▾│ ← Gộp badge + loading
└───────────────────────────┘
```

**Behavior:**
- `🔄 Update` → disabled, hiện spinner, text đổi thành "Updating..."
- Badge: `🟢 Live · Unsaved` → `⏳ Updating...` (pulse)
- Sau khi API success:
  - Badge quay về `🟢 Live`
  - Nút `🔄 Update` **biến mất** (vì không còn thay đổi)
  - Toast: `"✅ Đã cập nhật website"` (auto-dismiss 3 giây)
  - `isDirty = false`

---

### Screen A.6: Post-Publish Error States

#### A.6.1: Publish thất bại (STATE 2 → Error)

```text
Toast Error:
┌──────────────────────────────────────────────────┐
│ ❌  Publish thất bại                              │
│     Không thể kết nối server. Thử lại sau.   [✕] │
│                                    [🔄 Thử lại]  │
└──────────────────────────────────────────────────┘
```

**Behavior:**
- Badge quay lại `● Draft`
- Nút `🚀 Publish` hiện lại (để user thử lại)
- Toast có nút `🔄 Thử lại` (click = trigger publish lại, không cần mở Checklist)
- Auto-dismiss 10 giây (lâu hơn success toast vì cần user đọc)

#### A.6.2: Update thất bại (STATE 5 → Error)

```text
Toast Error:
┌──────────────────────────────────────────────────┐
│ ❌  Update thất bại                               │
│     Thay đổi đã lưu nhưng chưa deploy.      [✕] │
│                                    [🔄 Thử lại]  │
└──────────────────────────────────────────────────┘
```

**Behavior:**
- Badge quay lại `🟢 Live · Unsaved`
- Nút `🔄 Update` hiện lại (clickable)
- Data đã auto-save an toàn trong DB → reassure user

---

## 5. Business Rules

### 5.1 Publish Rules

| Rule ID | Mô tả |
|---------|-------|
| **BR-PUB-01** | Nút `🚀 Publish` chỉ hiển thị khi `site.isPublished === false` (chưa bao giờ publish) |
| **BR-PUB-02** | Sau khi publish thành công → `🚀 Publish` ẩn vĩnh viễn, thay bằng `🌐 View Live ▾` |
| **BR-PUB-03** | Nút `🔄 Update` chỉ hiển thị khi `site.isPublished === true` VÀ `isDirty === true` (có thay đổi chưa deploy) |
| **BR-PUB-04** | Sau khi Update thành công → nút `🔄 Update` biến mất, `isDirty = false` |
| **BR-PUB-05** | Auto-save (3s debounce) lưu vào DB nhưng **KHÔNG tự deploy** lên live. Deploy chỉ xảy ra khi user click `🔄 Update` |
| **BR-PUB-06** | Pre-publish Checklist chỉ hiện ở lần Publish đầu tiên. Lần Update sau đó **không cần** Checklist |

### 5.2 Unpublish Rules

| Rule ID | Mô tả |
|---------|-------|
| **BR-UNPUB-01** | Entry point Unpublish nằm trong **Settings Domain** (không phải Toolbar) |
| **BR-UNPUB-02** | Lý do: Unpublish là thao tác nâng cao, ảnh hưởng SEO + khách hàng. Không nên để user làm thường xuyên hoặc nhầm lẫn |
| **BR-UNPUB-03** | Khi Unpublish thành công → Toolbar quay về STATE 1 (`● Draft` + `🚀 Publish`) |
| **BR-UNPUB-04** | Khi site đang Maintenance → Header hiện persistent banner vàng: `"⚠️ Website đang tạm ẩn"` |

### 5.3 Double-click Prevention

| Rule ID | Mô tả |
|---------|-------|
| **BR-CLICK-01** | Sau khi click `🚀 Publish` hoặc `🔄 Update`, nút disabled ngay lập tức (prevent double submit) |
| **BR-CLICK-02** | Debounce: ignore clicks trong 1 giây sau click đầu tiên |

---

## 6. Acceptance Criteria

### AC-PUB-01: First Publish — Draft → Live

```gherkin
GIVEN  site có trạng thái isPublished = false (Draft)
  AND  Toolbar hiển thị badge "● Draft" và nút "🚀 Publish"
WHEN   user click "🚀 Publish"
THEN   hiện Pre-publish Checklist (Screen 3.9 hiện có)
WHEN   user click "Publish ngay" trong Checklist
THEN   Checklist Sheet tự đóng
  AND  Badge chuyển thành "⏳ Publishing..." với pulse animation
  AND  Nút "🚀 Publish" disabled, hiện spinner
WHEN   API trả success
THEN   Badge transition sang "🟢 Live" với pop-in animation (300ms)
  AND  Nút "🚀 Publish" ẩn hoàn toàn
  AND  Nút "🌐 View Live ▾" hiện ra thay thế (fade-in 200ms)
  AND  Toast "🎉 Website đã live!" hiện ở bottom, auto-dismiss 5 giây
```

### AC-PUB-02: View Live Dropdown

```gherkin
GIVEN  site đã Published (state LIVE)
  AND  Toolbar hiển thị nút "🌐 View Live ▾"
WHEN   user click "🌐 View Live ▾"
THEN   dropdown mở ra 2 options:
       │ 🔗 Open Website — mở [slug].primeweb.app trong tab mới
       │ 📋 Copy Link   — copy URL vào clipboard, micro-toast "✓ Đã copy"
WHEN   click outside dropdown
THEN   dropdown tự đóng
```

### AC-PUB-03: Edit after Publish — Update Button Appears

```gherkin
GIVEN  site đã Published, toolbar đang ở STATE 3 (Live)
WHEN   user thực hiện bất kỳ thay đổi nào:
       - Sửa text (WYSIWYG)
       - AI Chat apply changes
       - Kéo thả, thêm, xóa block
       - Đổi Global Settings
THEN   isDirty = true
  AND  Badge đổi thành "🟢 Live · Unsaved"
  AND  Nút "🔄 Update" xuất hiện bên trái nút "🌐 View Live ▾"
  AND  "🔄 Update" có gradient background nổi bật (Primary CTA)
```

### AC-PUB-04: Click Update — Deploy Changes

```gherkin
GIVEN  toolbar đang ở STATE 4 (Live + Dirty)
  AND  nút "🔄 Update" đang hiển thị
WHEN   user click "🔄 Update"
THEN   nút "🔄 Update" disabled ngay lập tức, hiện spinner
  AND  Badge đổi thành "⏳ Updating..." với pulse animation
  AND  API deploy changes lên live
WHEN   API trả success
THEN   Badge quay về "🟢 Live"
  AND  Nút "🔄 Update" biến mất (fade-out 200ms)
  AND  isDirty = false
  AND  Toast "✅ Đã cập nhật website" auto-dismiss 3 giây
```

### AC-PUB-05: Update không yêu cầu Pre-publish Checklist

```gherkin
GIVEN  site đã Published trước đó
WHEN   user click "🔄 Update"
THEN   KHÔNG hiện Pre-publish Checklist
  AND  deploy trực tiếp (skip checklist)
```

### AC-PUB-06: Publish Fail — Quay về Draft

```gherkin
GIVEN  user vừa click "Publish ngay"
WHEN   API trả error (500 / timeout / network error)
THEN   Badge quay lại "● Draft"
  AND  Nút "🚀 Publish" hiện lại (clickable)
  AND  Toast error: "❌ Publish thất bại. Thử lại sau." + nút [🔄 Thử lại]
  AND  Toast auto-dismiss 10 giây
WHEN   click [🔄 Thử lại] trong toast
THEN   trigger publish lại (skip Checklist, dùng cached result)
```

### AC-PUB-07: Unpublish — Entry Point trong Settings Domain

```gherkin
GIVEN  site đã Published
WHEN   user muốn Unpublish (tạm ẩn website)
THEN   user phải vào Settings > Domain để thực hiện
  AND  Toolbar KHÔNG có nút/option Unpublish
WHEN   user click "Tạm ẩn website" trong Settings Domain
THEN   hiện Confirm Dialog (Screen 3.10 hiện có)
  AND  liệt kê hệ quả (khách không truy cập được, SEO ảnh hưởng)
WHEN   user confirm "Có, Ẩn ngay"
THEN   site.isPublished = false
  AND  Toolbar quay về STATE 1: Badge "● Draft" + Nút "🚀 Publish"
  AND  Nút "🌐 View Live" biến mất
  AND  Header hiện persistent banner vàng: "⚠️ Website đang tạm ẩn"
```

---

## 7. Tóm tắt những gì thay đổi so với thiết kế cũ

| Hạng mục | Thiết kế cũ (PRD + Wireframe) | Thiết kế mới (Audit đề xuất) |
|----------|-------------------------------|------------------------------|
| Sau Publish | Toast + link (text only, không wireframe) | Toast + Badge animated + Nút `View Live ▾` dropdown |
| Nút Publish | Luôn hiển thị trên Toolbar | Ẩn sau khi Publish lần đầu → thay `View Live ▾` |
| Re-Publish | Không mô tả rõ | Nút `🔄 Update` chỉ hiện khi có thay đổi → biến mất sau deploy |
| Pre-publish Checklist | Luôn hiện khi Publish | Chỉ hiện lần đầu. Update sau đó skip checklist |
| Unpublish | Mơ hồ: "Action Dropdown bên cạnh Publish" | Chuyển vào **Settings > Domain** (tránh nhầm lẫn) |
| Error states | Không mô tả | Toast error + nút Thử lại cho cả Publish và Update |
| Badge states | Chỉ có "Draft" / "Live" | 5 trạng thái: Draft → Publishing → Live → Live·Unsaved → Updating |
| Auto-save vs Deploy | Không phân biệt rõ | Auto-save = lưu DB (draft). Deploy = chỉ khi click Update |

---

---
---

# GAP-02 · 🔴 Blocker — Xóa Block không có Confirm + Thiếu Interaction Toolbar trên Iframe

> **Version:** 1.0 | **Created:** 2026-04-13 | **Feature:** F05 AI Editor
> **Story Ref:** US-F05-03 (Inline Click-to-Edit), US-F05-05 (Drag-and-Drop), US-F05-06 (Manual Visual Editing)
> **Status:** UX Audit — Proposed Solution

---

## Mục lục

- [1. Tổng quan vấn đề](#1-tổng-quan-vấn-đề-1)
- [2. Phân tích chi tiết](#2-phân-tích-chi-tiết-1)
- [3. Giải pháp đề xuất](#3-giải-pháp-đề-xuất-1)
- [4. Wireframe — Block Interaction trên Iframe](#4-wireframe--block-interaction-trên-iframe)
- [5. Business Rules](#5-business-rules-1)
- [6. Acceptance Criteria](#6-acceptance-criteria-1)

---

## 1. Tổng quan vấn đề

### 3 vấn đề UX liên quan khi user tương tác với block trên Iframe

```text
┌────────────────────────────────────────────────────────────────────────┐
│                    3 VẤN ĐỀ PHÁT HIỆN                                 │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ❌ VẤN ĐỀ 1: Xóa Block không có Confirm Dialog                       │
│  ──────────────────────────────────────────────                        │
│  Khi user click 🗑️ ở Block Settings (right panel) → block bị xóa      │
│  NGAY LẬP TỨC không hỏi lại. User mất nội dung, phải Undo.           │
│  • Đã có popup confirm khi xóa Page ✅                                 │
│  • THIẾU popup confirm khi xóa Block ❌                                │
│                                                                        │
│  ❌ VẤN ĐỀ 2: Click block trên Iframe → thiếu nút Delete trực tiếp    │
│  ──────────────────────────────────────────────────────────             │
│  Khi user click vào block trên Preview → chỉ thấy viền xanh           │
│  highlight + Settings panel bên phải. KHÔNG có icon Delete             │
│  ngay tại block trên Iframe → phải sang right panel mới xóa được.     │
│                                                                        │
│  ❌ VẤN ĐỀ 3: Floating Toolbar quá ít tùy chọn                        │
│  ──────────────────────────────────────────────                        │
│  Khi double-click text → Floating Toolbar chỉ có: B / I / U / H1 / ≡ │
│  THIẾU nhiều editing options phổ biến:                                 │
│  • Link insert/edit                                                    │
│  • Text color / Highlight color                                        │
│  • Bullet list / Numbered list                                         │
│  • AI Edit shortcut (✨)                                               │
│  • Khi click vào block (không phải text) → KHÔNG có toolbar gì cả     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phân tích chi tiết

### 2.1 Vấn đề 1 — Xóa Block không có Confirm

**Hiện trạng:**

| Hành động | Có Confirm? | Có Undo? | Nguồn tham chiếu |
|-----------|-------------|----------|-------------------|
| Xóa **Page** trong Page Manager | ✅ Có popup confirm | ✅ Toast Undo 5s | Wireframe Screen 3.4, PRD §AC-3 (US-F05-02) |
| Xóa **Block** ở Block Settings (right panel) | ❌ **KHÔNG** | ⚠️ Chỉ có Toolbar Undo | Wireframe Screen 1.2 — nút 🗑️ ở panel phải |
| Xóa **Block** trên Mobile Bottom Sheet | ❌ **KHÔNG** nhưng wireframe ghi "(có confirm)" | ⚠️ Chỉ có Toolbar Undo | Wireframe Screen 3.6 — ghi *"(có confirm trước khi xóa)"* nhưng không vẽ UI |

**Rủi ro:**
- User nhấn nhầm `🗑️` → block bị xóa ngay → mất nội dung đã soạn (text, images, config)
- Nếu user không biết Ctrl+Z / nút Undo → nội dung mất vĩnh viễn sau khi auto-save
- Đặc biệt nguy hiểm với block có nhiều content (Product List, FAQ, Gallery)

### 2.2 Vấn đề 2 — Click block trên Iframe → thiếu nút xóa/thao tác nhanh

**Hiện trạng theo wireframe:**

```text
Wireframe Screen 1.2 — Khi click block trên Desktop:

  ┌──────────────────────────────┐
  │ ┌────────────────────────┐   │
  │ │   ✨ Edit with AI      │   │ ← Chỉ có 1 nút AI khi hover text
  │ │ ┌─────────┬───┬───┬──┐│   │
  │ │ │ [ B ] I U │ H1 ▼│ = ││   │ ← Floating Toolbar khi double-click text
  │ │ └─────────┴───┴───┴──┘│   │
  │ │  [ HERO BANNER TEXT ]  │   │
  │ └────────────────────────┘   │
  │                              │
  └──────────────────────────────┘

  → THIẾU: Nút Delete, Move, Duplicate, AI Edit tại block level
  → User phải tìm đến right panel mới có nút 🗑️
```

**So sánh với competitor:**

| Builder | Click block trên Canvas | Có toolbar tại chỗ? |
|---------|------------------------|---------------------|
| Wix | ✅ Toolbar nổi: Move, Duplicate, Delete, More | ✅ |
| Squarespace | ✅ Toolbar nổi: ↑↓ Delete Settings | ✅ |
| Shopify | ✅ Click → hiện actions tại chỗ | ✅ |
| **F05 hiện tại** | ❌ Chỉ highlight viền xanh | ❌ |

### 2.3 Vấn đề 3 — Floating Toolbar quá ít tùy chọn

**Hiện trạng (wireframe Screen 1.2 + PRD §AC-1 US-F05-06):**

```text
Floating Toolbar hiện tại (khi double-click text):
┌─────────┬───┬───┬──────┬─────┐
│ [ B ] I  U  │ H1 ▼ │  ≡  │
└─────────┴───┴───┴──────┴─────┘
  Bold  Italic Underline Heading Align

→ Chỉ có 5 options cơ bản
```

**Thiếu so với nhu cầu user:**

| Tính năng | Có chưa | Mức ưu tiên | Lý do cần |
|-----------|---------|-------------|-----------|
| Bold / Italic / Underline | ✅ | — | Cơ bản |
| Heading (H1-H6) | ✅ | — | Cơ bản |
| Text Alignment | ✅ | — | Cơ bản |
| **🔗 Insert/Edit Link** | ❌ | **P0** | CTA buttons, navigation links — rất hay dùng |
| **🎨 Text Color** | ❌ | **P1** | Highlight chữ quan trọng, CTA text |
| **📝 Bullet / Numbered List** | ❌ | **P1** | Content-heavy pages (FAQ, About, Blog) |
| **✨ AI Edit** | ❌ | **P0** | Quick access AI từ toolbar thay vì hover 200ms |
| **Strikethrough** | ❌ | P2 | Giá cũ gạch ngang (pricing) |

---

## 3. Giải pháp đề xuất

### 3.1 Tổng quan — 2 hệ thống Toolbar mới

```text
┌────────────────────────────────────────────────────────────────┐
│              HỆ THỐNG TOOLBAR KHI CLICK/HOVER BLOCK            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  LAYER 1: BLOCK ACTION BAR (Click vào block bất kỳ)           │
│  ─────────────────────────────────────────────────             │
│  Hiện thanh action bar phía TRÊN block đã chọn                │
│  Chứa: ⠿ Drag │ ↑ │ ↓ │ 📋 │ ✨ │ 🗑️                       │
│                                                                │
│  LAYER 2: TEXT EDITING TOOLBAR (Double-click vào text)         │
│  ─────────────────────────────────────────────────             │
│  Hiện Floating Toolbar MỞ RỘNG phía trên đoạn text            │
│  Chứa: B I U S │ H ▼ │ ≡ │ 🔗 │ 🎨 │ 📝 │ ✨                │
│                                                                │
│  → 2 layers này KHÔNG xung đột:                               │
│    Click block → Layer 1                                       │
│    Double-click text (khi block đã selected) → Layer 2         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Delete Block — Confirm Popup

**Nguyên tắc:**

```
1. MỌI thao tác xóa block đều phải có Confirm Dialog — DÙ từ đâu
2. Confirm Dialog là inline popup (không phải full-screen modal) — nhẹ, nhanh
3. Sau khi xóa → Toast Undo 5 giây (giống xóa Page)
4. Áp dụng cho cả Desktop (right panel + Block Action Bar) và Mobile (Bottom Sheet)
```

---

## 4. Wireframe — Block Interaction trên Iframe

### Screen B.1: Click block → Block Action Bar xuất hiện (MỚI)

Khi user click (single click) vào bất kỳ block nào trong iframe Preview, ngoài viền xanh highlight, hệ thống hiển thị thêm một **Block Action Bar** phía trên block.

```text
Desktop — Iframe Preview khi click vào Hero block:
┌──────────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ [Logo]                                    Home  About  Contact │ │
│ ├──────────────────────────────────────────────────────────────────┤ │
│ │                                                                  │ │
│ │  ┌──── Block Action Bar ──────────────────────────────────────┐  │ │
│ │  │  ⠿ Drag  │  ↑  │  ↓  │  📋 Duplicate  │  ✨ AI  │  🗑️    │  │ │
│ │  └───────────────────────────────────────────────────────────┘  │ │
│ │  ╔════════════════════════════════════════════════════════════╗  │ │
│ │  ║                                                            ║  │ │
│ │  ║           🌸 Hoa Tươi Mỗi Ngày                            ║  │ │
│ │  ║           Giao hàng miễn phí nội thành                     ║  │ │
│ │  ║                                                            ║  │ │
│ │  ║           [ Xem sản phẩm → ]                               ║  │ │
│ │  ║                                                            ║  │ │
│ │  ╚════════════════════════════════════════════════════════════╝  │ │
│ │                              ▲                                   │ │
│ │                     Viền xanh highlight                          │ │
│ │                                                                  │ │
│ ├──────────────────────────────────────────────────────────────────┤ │
│ │                      PRODUCTS SECTION                            │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

**Block Action Bar — Các nút và chức năng:**

| Icon | Tên | Hành vi |
|------|-----|---------|
| `⠿` | Drag Handle | Kéo di chuyển block lên/xuống (giữ chuột + kéo) |
| `↑` | Move Up | Di chuyển block lên 1 vị trí. Disabled nếu đã ở đầu tiên |
| `↓` | Move Down | Di chuyển block xuống 1 vị trí. Disabled nếu đã ở cuối |
| `📋` | Duplicate | Nhân đôi block, đặt bản sao ngay phía dưới block gốc |
| `✨` | AI Edit | Mở Chat panel (nếu đang đóng) + tự select block này cho AI context |
| `🗑️` | Delete | **Mở Confirm Popup** trước khi xóa (xem Screen B.3) |

**Behavior Detail:**

| # | Hành vi | Mô tả |
|---|---------|-------|
| 1 | Xuất hiện | Fade-in 150ms, đặt ở phía trên block (bên ngoài viền xanh) |
| 2 | Vị trí | Căn trái, ngang hàng với mép trên block. Nếu block ở top viewport → hiện phía dưới block |
| 3 | Ẩn đi | Click vùng trống (deselect) hoặc click block khác → ẩn bar cũ, hiện bar mới |
| 4 | Header/Footer | KHÔNG hiện Block Action Bar cho Nav Header và Footer (theo BR-05, BR-06 PRD) |
| 5 | AI Streaming | Block Action Bar bị ẩn hoàn toàn khi AI đang streaming (canvas lock) |

---

### Screen B.2: Double-click text → Floating Toolbar mở rộng (CẢI TIẾN)

Khi user double-click vào text bên trong block đã chọn, Floating Toolbar mở rộng với thêm nhiều tùy chọn.

```text
Desktop — Double-click vào tiêu đề Hero:

  ╔════════════════════════════════════════════════════════════╗
  ║                                                            ║
  ║  ┌─────────────────────────────────────────────────────┐   ║
  ║  │ B  I  U  S │ H1 ▼ │ ≡ ▼ │ 🔗 │ 🎨 │ 📝 ▼ │ ✨ AI │   ║
  ║  └─────────────────────────────────────────────────────┘   ║
  ║                         ▲                                   ║
  ║              Floating Toolbar (mở rộng)                     ║
  ║                                                            ║
  ║           🌸 |Hoa Tươi Mỗi Ngày|                          ║
  ║                  ▲ text đang bôi đen                       ║
  ║           Giao hàng miễn phí nội thành                     ║
  ║                                                            ║
  ╚════════════════════════════════════════════════════════════╝
```

**Floating Toolbar mới — So sánh cũ vs mới:**

```text
CŨ (5 nút):
┌──────────────────────────────┐
│  B   I   U  │ H1 ▼ │   ≡   │
└──────────────────────────────┘

MỚI (10 nút, nhóm bằng separator):
┌───────────────────────────────────────────────────────────────┐
│  B   I   U   S  │  H1 ▼  │  ≡ ▼  │  🔗  │  🎨  │ 📝 ▼ │ ✨ │
└───────────────────────────────────────────────────────────────┘
 ─── Format ───  Heading  Align    Link  Color  List    AI
```

**Chi tiết từng nút mới:**

| Icon | Tên | Hành vi khi click |
|------|-----|-------------------|
| **B** | Bold | Toggle bold cho text bôi đen `Ctrl+B` |
| **I** | Italic | Toggle italic `Ctrl+I` |
| **U** | Underline | Toggle underline `Ctrl+U` |
| **S** | Strikethrough | Toggle gạch ngang (~~text~~) — hữu ích cho giá cũ |
| **H1 ▼** | Heading Dropdown | Dropdown: H1, H2, H3, H4, H5, H6, Paragraph |
| **≡ ▼** | Alignment Dropdown | Dropdown: Left, Center, Right, Justify |
| **🔗** | Insert/Edit Link | Mở mini-popup nhập URL (xem Screen B.4) |
| **🎨** | Text Color | Mở color picker nhỏ: preset colors + custom hex |
| **📝 ▼** | List Dropdown | Dropdown: Bullet List (•), Numbered List (1.), None |
| **✨** | AI Edit | Mở inline AI instruction popup (giống `✨ Edit with AI` hiện tại) |

---

### Screen B.3: Delete Block — Confirm Popup (MỚI)

Khi user click `🗑️` (từ Block Action Bar trên iframe HOẶC từ Block Settings ở right panel HOẶC từ Mobile Bottom Sheet), hiển thị Confirm Popup inline.

```text
Desktop — Confirm popup khi click 🗑️ trên Block Action Bar:

  ┌──── Block Action Bar ──────────────────────────────────────┐
  │  ⠿ Drag  │  ↑  │  ↓  │  📋 Duplicate  │  ✨ AI  │  🗑️    │
  └───────────────────────────────────────────────┬────────────┘
                                                  │
                                    ┌─────────────▼──────────────┐
                                    │  🗑️ Xóa block này?         │
                                    │                             │
                                    │  Block "Hero Section" sẽ bị │
                                    │  xóa khỏi trang.            │
                                    │                             │
                                    │  [Huỷ]    [Xóa] ← (chữ đỏ) │
                                    └─────────────────────────────┘
                                                ▲
                                    Confirm Popup (dropdown style)
                                    Xuất hiện ngay dưới nút 🗑️


Desktop — Confirm popup khi click 🗑️ từ Right Panel (Block Settings):

  ┌───────────────────┐
  │ ⚙️ BLOCK SETTINGS │
  │ (Hero Section)    │
  │ ───────────────── │
  │ ▼ Background      │
  │ ▼ Typography      │
  │ ▼ Padding         │
  │                   │
  │ ───────────────── │
  │ [🗑️ Xóa block]   │ ← User click nút này
  │ ┌─────────────────────────┐
  │ │ 🗑️ Xóa block này?       │
  │ │                          │
  │ │ Block "Hero Section"     │
  │ │ sẽ bị xóa khỏi trang.   │
  │ │                          │
  │ │ [Huỷ]     [Xóa] (đỏ)    │
  │ └─────────────────────────┘
  └───────────────────┘


Mobile — Confirm inline trong Bottom Sheet:

  ┌───────────────────────┐
  │ ➖                    │
  │ [HERO] Hero Sect. 🗑️  │ ← User tap 🗑️
  │ ─────────────────     │
  │ ┌───────────────────┐ │
  │ │ 🗑️ Xóa block này? │ │
  │ │                    │ │
  │ │ [Huỷ]  [Xóa] (đỏ) │ │
  │ └───────────────────┘ │
  │ [↑ Di chuyển lên]     │
  │ [↓ Di chuyển xuống]   │
  └───────────────────────┘
```

**Confirm Popup — Behavior:**

| # | Hành vi | Mô tả |
|---|---------|-------|
| 1 | Trigger | Click `🗑️` từ **bất kỳ đâu** (Block Action Bar / Right Panel / Mobile Sheet) |
| 2 | Style | Dropdown-style popup, KHÔNG phải full-screen modal (nhẹ, nhanh) |
| 3 | Nội dung | Tên block type hiển thị rõ: "Block **Hero Section** sẽ bị xóa" |
| 4 | Nút Huỷ | Đóng popup, không xóa |
| 5 | Nút Xóa | Chữ đỏ, xóa block + đóng popup |
| 6 | Sau khi xóa | Toast Undo: `"Đã xóa Hero Section. [↩ Hoàn tác]"` hiện 5 giây |
| 7 | Undo toast | Click `[↩ Hoàn tác]` → block khôi phục lại đúng vị trí cũ |
| 8 | Escape / Click outside | Đóng popup (= Huỷ) |
| 9 | Keyboard | `Enter` = xác nhận Xóa, `Escape` = Huỷ |

---

### Screen B.4: Insert/Edit Link — Mini Popup (MỚI)

Khi user click `🔗` trên Floating Toolbar, hiển thị mini popup nhập URL.

```text
  ┌─────────────────────────────────────────────────────┐
  │ B  I  U  S │ H1 ▼ │ ≡ ▼ │ [🔗] │ 🎨 │ 📝 ▼ │ ✨ │
  └────────────────────────────┬────────────────────────┘
                               │
                 ┌─────────────▼────────────────┐
                 │ 🔗 Chèn liên kết             │
                 │                               │
                 │ URL:                           │
                 │ ┌───────────────────────────┐ │
                 │ │ https://...               │ │
                 │ └───────────────────────────┘ │
                 │                               │
                 │ ☐ Mở tab mới (target blank)   │
                 │                               │
                 │ [Huỷ]         [Áp dụng] (xanh)│
                 │                               │
                 │ 🗑️ Xóa link   (nếu đã có link)│
                 └───────────────────────────────┘
```

**Behavior:**
- Nếu text bôi đen **đã có link** → form auto-fill URL hiện tại + hiện nút "🗑️ Xóa link"
- Nếu text bôi đen **chưa có link** → form trống, focus vào input URL
- Checkbox `☐ Mở tab mới` → add `target="_blank"` attribute
- Click `Áp dụng` → wrap text bôi đen bằng `<a>` tag
- Validation: URL phải bắt đầu bằng `http://`, `https://`, `mailto:`, `tel:`, hoặc `/` (internal link)

---

### Screen B.5: Text Color Picker — Mini Popup (MỚI)

Khi user click `🎨` trên Floating Toolbar.

```text
  ┌─────────────────────────────────────────────────────┐
  │ B  I  U  S │ H1 ▼ │ ≡ ▼ │ 🔗 │ [🎨] │ 📝 ▼ │ ✨ │
  └──────────────────────────────────┬──────────────────┘
                                     │
                       ┌─────────────▼────────────┐
                       │  🎨 Màu chữ               │
                       │                           │
                       │  Gần đây:                 │
                       │  [⬛][🟦][🟩][🟥][⬜]     │
                       │                           │
                       │  Theme:                   │
                       │  [Primary][Second][Accent] │
                       │                           │
                       │  Tất cả:                  │
                       │  [⬛][⚫][🔵][🟢][🔴]     │
                       │  [🟡][🟣][🟤][⚪][🩶]     │
                       │                           │
                       │  Custom: [#______] [OK]   │
                       │                           │
                       │  [↺ Reset mặc định]       │
                       └───────────────────────────┘
```

**Behavior:**
- Preset "Gần đây" = 5 màu user dùng gần nhất (lưu localStorage)
- Preset "Theme" = primary, secondary, accent color từ site theme
- Click màu → áp dụng ngay (realtime preview)
- Custom hex → validate format `#RRGGBB`
- "Reset mặc định" → quay về màu theo theme/CSS gốc

---

### Screen B.6: Block Action Bar trên Mobile (MỚI)

Trên mobile, Block Action Bar hiển thị compact hơn khi user tap vào block.

```text
Mobile — Tap vào block Hero:

┌───────────────────────┐
│ ←  [🏠 Trang chủ]  🟢 │
├───────────────────────┤
│ FloraShop         Nav │
├───────────────────────┤
│ ┌─────────────────┐   │
│ │ [⠿][↑][↓][📋][✨][🗑️]│ ← Block Action Bar (compact, 1 row)
│ ╔═════════════════╗   │
│ ║                 ║   │
│ ║  🌸 Hoa Tươi    ║   │ ← Block đang chọn (viền xanh)
│ ║  Mỗi Ngày       ║   │
│ ║                 ║   │
│ ╚═════════════════╝   │
│ Sản phẩm nổi bật      │
├───────────────────────┤
│       [🪄]            │
│ 🪄 ▲ Mở Chat AI       │
└───────────────────────┘
```

**Behavior trên Mobile:**
- `⠿` Drag: **Disabled** trên mobile (mobile dùng ↑↓ thay thế)
- `↑` / `↓`: Di chuyển block lên/xuống, iframe auto-scroll
- `📋`: Duplicate block
- `✨`: Mở Bottom Sheet tab Chat + select block cho AI
- `🗑️`: Mở Confirm Popup (inline trên thanh Action Bar)

---

### Screen B.7: Toàn cảnh — Tất cả Layer tương tác trên Iframe

Sơ đồ tổng thể cho thấy thứ tự ưu tiên và cách các layer tương tác.

```text
┌─────────────────────────────────────────────────────────────────┐
│                INTERACTION PRIORITY TRÊN IFRAME                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ① HOVER block (> 0ms)                                          │
│     → Viền dashed nhạt (chỉ indicate "có thể click")            │
│     → Cursor: pointer                                            │
│                                                                  │
│  ② CLICK block (single click)                                   │
│     → Viền xanh highlight (solid, 2px)                           │
│     → Block Action Bar xuất hiện phía trên block                 │
│     → Right Panel chuyển sang Block Settings                     │
│     → (Mobile) Bottom Sheet mở tab Settings                      │
│                                                                  │
│  ③ HOVER text element trong block đã selected (> 200ms)         │
│     → Nút ✨ "Edit with AI" xuất hiện góc phải trên element     │
│                                                                  │
│  ④ DOUBLE-CLICK text (trong block đã selected)                  │
│     → Block Action Bar ẨN (tránh rối)                            │
│     → Floating Toolbar MỞ RỘNG xuất hiện phía trên text         │
│     → Text chuyển contentEditable mode (WYSIWYG)                 │
│     → Click ra ngoài text → quay lại ② (Block Action Bar hiện)   │
│                                                                  │
│  ⑤ CLICK image (trong block đã selected)                        │
│     → Image Toolbar nổi: [📤 Đổi ảnh] [✨ AI ảnh]               │
│     → (Giữ nguyên thiết kế hiện tại Screen 1.8)                  │
│                                                                  │
│  ⑥ CLICK vùng trống (ngoài mọi block)                           │
│     → Deselect block → ẩn Block Action Bar                       │
│     → Right Panel quay về Global Settings                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Business Rules

### 5.1 Delete Block Rules

| Rule ID | Mô tả |
|---------|-------|
| **BR-DEL-01** | Xóa block BẮT BUỘC phải qua Confirm Popup — dù từ Block Action Bar, Right Panel, hay Mobile Bottom Sheet |
| **BR-DEL-02** | Confirm Popup là dropdown-style (nhẹ), KHÔNG phải full-screen modal |
| **BR-DEL-03** | Sau khi xóa → Toast Undo `"Đã xóa [Block Name]. [↩ Hoàn tác]"` hiện 5 giây |
| **BR-DEL-04** | Click `↩ Hoàn tác` trong toast → block khôi phục đúng vị trí cũ + right panel quay lại Block Settings |
| **BR-DEL-05** | KHÔNG cho phép xóa block nếu trang chỉ còn **1 block duy nhất** → Tooltip: "Trang phải có ít nhất 1 block" |
| **BR-DEL-06** | Khi AI đang streaming → nút `🗑️` trên Block Action Bar bị disabled |

### 5.2 Block Action Bar Rules

| Rule ID | Mô tả |
|---------|-------|
| **BR-BAR-01** | Block Action Bar chỉ hiện khi click vào block (không hiện khi hover) |
| **BR-BAR-02** | Block Action Bar KHÔNG hiện cho Header (Nav) và Footer — vì đây là global blocks, edit qua Header/Footer Settings |
| **BR-BAR-03** | Khi double-click text (chuyển sang WYSIWYG mode) → Block Action Bar tạm ẩn → hiện lại khi click ra ngoài text |
| **BR-BAR-04** | Nút `↑` disabled khi block đang ở vị trí đầu tiên (sau Nav). Nút `↓` disabled khi block ở cuối (trước Footer) |
| **BR-BAR-05** | Nút `📋 Duplicate` tạo bản sao ngay dưới block gốc, bản sao tự động selected |
| **BR-BAR-06** | Nút `✨ AI` mở Chat panel + set `selectedBlock = blockIndex` để AI nhận context |

### 5.3 Floating Toolbar Rules

| Rule ID | Mô tả |
|---------|-------|
| **BR-TOOL-01** | Floating Toolbar mở rộng chỉ hiện khi double-click text (WYSIWYG mode) |
| **BR-TOOL-02** | Nút `🔗 Link` → popup nhập URL. Validate: `http://`, `https://`, `mailto:`, `tel:`, hoặc `/` (internal) |
| **BR-TOOL-03** | Nút `🎨 Color` → color picker popup. Preset colors + theme colors + custom hex |
| **BR-TOOL-04** | Nút `📝 List` → dropdown: Bullet, Numbered, None |
| **BR-TOOL-05** | Nút `✨ AI` → mở inline AI instruction popup (giống behavior `✨ Edit with AI` hiện tại) |
| **BR-TOOL-06** | Floating Toolbar position: luôn ở phía trên text bôi đen. Nếu text ở top viewport → hiện phía dưới |

---

## 6. Acceptance Criteria

### AC-DEL-01: Delete Block — Confirm Popup bắt buộc

```gherkin
GIVEN  user đang ở Editor, đã chọn 1 block (Hero Section)
WHEN   click nút 🗑️ từ Block Action Bar HOẶC Block Settings panel
THEN   hiện Confirm Popup inline:
       │ "🗑️ Xóa block này?"
       │ "Block Hero Section sẽ bị xóa khỏi trang."
       │ [Huỷ]  [Xóa]
  AND  popup đặt ngay dưới nút 🗑️ đã click
WHEN   click [Huỷ] hoặc Escape hoặc click outside
THEN   popup đóng, block giữ nguyên
WHEN   click [Xóa]
THEN   block bị xóa khỏi preview + Zustand store
  AND  popup đóng
  AND  Toast hiện: "Đã xóa Hero Section. [↩ Hoàn tác]" (5 giây)
  AND  Right Panel chuyển về Global Settings (vì không còn block selected)
```

### AC-DEL-02: Undo sau Delete Block

```gherkin
GIVEN  user vừa xóa 1 block, toast Undo đang hiển thị
WHEN   click [↩ Hoàn tác] trong toast (trong vòng 5 giây)
THEN   block khôi phục lại đúng vị trí cũ trong page
  AND  block tự động selected (viền xanh)
  AND  Block Action Bar hiện lại
  AND  toast biến mất
```

### AC-DEL-03: Delete Block trên Mobile

```gherkin
GIVEN  user ở mobile, tap vào block, Bottom Sheet mở ra
WHEN   tap nút 🗑️ trong Bottom Sheet
THEN   Confirm Popup hiện inline trong Bottom Sheet:
       │ "🗑️ Xóa block này?"
       │ [Huỷ]  [Xóa]
WHEN   tap [Xóa]
THEN   block xóa, Bottom Sheet đóng
  AND  Toast Undo hiện ở bottom-center 5 giây
```

### AC-BAR-01: Block Action Bar hiện khi click block

```gherkin
GIVEN  user ở Desktop Editor
WHEN   click (single click) vào block Hero trong iframe
THEN   block Hero highlight viền xanh (2px solid)
  AND  Block Action Bar xuất hiện phía trên block:
       │ ⠿ Drag │ ↑ │ ↓ │ 📋 Duplicate │ ✨ AI │ 🗑️
  AND  Right Panel chuyển sang Block Settings (Hero Section)
WHEN   click vào vùng trống (deselect)
THEN   viền xanh biến mất
  AND  Block Action Bar ẩn (fade-out 150ms)
  AND  Right Panel quay về Global Settings
```

### AC-BAR-02: Block Action Bar → Duplicate Block

```gherkin
GIVEN  Block Action Bar đang hiển thị cho Hero Section (vị trí 1)
WHEN   click nút 📋 Duplicate
THEN   bản sao "Hero Section (Copy)" xuất hiện ngay dưới hero gốc (vị trí 2)
  AND  bản sao tự động selected (viền xanh chuyển sang bản sao)
  AND  Block Action Bar chuyển sang bản sao
  AND  iframe smooth-scroll đến bản sao nếu nằm ngoài viewport
  AND  isDirty = true (để hiện nút Update nếu site đã Published)
```

### AC-BAR-03: Block Action Bar + AI Streaming = Ẩn

```gherkin
GIVEN  user đã chọn 1 block, Block Action Bar đang hiển thị
WHEN   AI bắt đầu streaming (canvas lock)
THEN   Block Action Bar ẩn hoàn toàn
  AND  overlay mờ phủ iframe (behavior hiện tại giữ nguyên)
WHEN   AI stream kết thúc
THEN   canvas lock gỡ
  AND  Block Action Bar hiện lại (nếu block vẫn được selected)
```

### AC-TOOL-01: Floating Toolbar mở rộng khi double-click text

```gherkin
GIVEN  user đã click chọn block Hero (Block Action Bar đang hiển thị)
WHEN   double-click vào text "Hoa Tươi Mỗi Ngày"
THEN   Block Action Bar tạm ẩn
  AND  Floating Toolbar mở rộng xuất hiện phía trên text:
       │ B  I  U  S │ H1 ▼ │ ≡ ▼ │ 🔗 │ 🎨 │ 📝 ▼ │ ✨
  AND  text chuyển contentEditable mode
WHEN   user click ra ngoài text (blur)
THEN   Floating Toolbar ẩn
  AND  Block Action Bar hiện lại
  AND  thay đổi text được auto-save
```

### AC-TOOL-02: Insert Link

```gherkin
GIVEN  user bôi đen text "Xem sản phẩm" trong WYSIWYG mode
WHEN   click nút 🔗 trên Floating Toolbar
THEN   mini popup "Chèn liên kết" xuất hiện dưới toolbar:
       │ URL: [https://...]
       │ ☐ Mở tab mới
       │ [Huỷ] [Áp dụng]
WHEN   nhập URL hợp lệ + click [Áp dụng]
THEN   text "Xem sản phẩm" được wrap bằng <a href="...">
  AND  popup đóng
  AND  text hiển thị underline + màu primary (indicate đã có link)
```

### AC-TOOL-03: Text Color

```gherkin
GIVEN  user bôi đen text trong WYSIWYG mode
WHEN   click nút 🎨 trên Floating Toolbar
THEN   color picker popup xuất hiện:
       │ Gần đây: [5 màu gần nhất]
       │ Theme: [Primary] [Secondary] [Accent]
       │ Tất cả: [10 preset colors]
       │ Custom: [#______] [OK]
WHEN   click vào 1 màu bất kỳ
THEN   text bôi đen đổi màu ngay lập tức (realtime preview)
  AND  popup tự đóng
```

---

## 7. Tóm tắt những gì thay đổi so với thiết kế cũ

| Hạng mục | Thiết kế cũ | Thiết kế mới |
|----------|-------------|--------------|
| **Xóa Block** | Xóa ngay, không hỏi lại | ✅ Confirm Popup bắt buộc + Toast Undo 5 giây |
| **Click block trên iframe** | Chỉ highlight viền xanh | ✅ Block Action Bar: ⠿ ↑ ↓ 📋 ✨ 🗑️ |
| **Nút Delete trên iframe** | Không có — phải vào Right Panel | ✅ Có `🗑️` ngay trên Block Action Bar |
| **Duplicate block** | Không có | ✅ Nút `📋` trên Block Action Bar |
| **Floating Toolbar** | 5 nút: B I U H1 ≡ | ✅ 10 nút: thêm S, 🔗 Link, 🎨 Color, 📝 List, ✨ AI |
| **Insert Link** | Không có trong Editor | ✅ Mini popup URL + target blank option |
| **Text Color** | Không có trong Editor | ✅ Color picker: recent + theme + preset + custom |
| **Interaction hierarchy** | Không document | ✅ 6 layers ưu tiên rõ ràng (hover → click → text → image) |
| **Mobile Block Action** | Chỉ có Bottom Sheet | ✅ Compact Action Bar phía trên block + Bottom Sheet |

---

> **Status:** Chờ team review.
> **Next:** Nếu approved → update wireframe chính + cập nhật PRD AC. Tiếp tục audit GAP-03+.
---

# GAP-03 · 🟡 Minor — Offline Fallback (BR-07)

## 1. Vấn đề hiện tại
Theo **BR-07** trong PRD, hệ thống phải có cơ chế lưu trữ LocalStorage khi mất kết nối mạng. Tuy nhiên, hiện tại:
- **Thiếu chỉ báo trạng thái:** Người dùng không biết mình đang online hay offline cho đến khi thao tác (VD: click Publish) bị lỗi hoặc treo.
- **Rủi ro mất dữ liệu:** Nếu người dùng không biết mình đang offline và vô tình F5/đóng tab, bản lưu LocalStorage có thể bị trình duyệt xóa hoặc người dùng không biết cách khôi phục lại khi mở lại sau này.
- **Trải nghiệm AI bị gián đoạn:** Các tính năng AI (SSE) yêu cầu internet liên tục. Nếu mất mạng giữa chừng khi đang stream, UI có thể bị treo ở trạng thái "Loading" vô tận.

## 2. Giải pháp đề xuất

### 2.1 Connectivity Status Indicator (Header)
Thêm một icon nhỏ cạnh tên website/trạng thái Draft để người dùng luôn biết tình trạng kết nối.

- **Online (Synced):** Icon mây xanh + tick `CloudCheck`. Tooltip: "Đã lưu vào server".
- **Offline (Local Save):** Icon mây gạch chéo vàng `CloudOff`. Tooltip: "Mất kết nối. Đang lưu tạm vào máy bạn".
- **Syncing:** Icon mây xoay `CloudSync`. Tooltip: "Đang đồng bộ..."

### 2.2 Offline Alert Banner
Hiển thị một thông báo nổi bật nhưng không gây gián đoạn (Non-intrusive) khi mất mạng.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ Bạn đang ngoại tuyến. Các thay đổi sẽ được lưu tạm vào trình duyệt của bạn. [X] │
└──────────────────────────────────────────────────────────────────────────────┘
(Banner màu vàng cam, cố định phía dưới Header)
```

### 2.3 Behavior Rules (Offline Mode)
1. **Chặn Publish:** Disable nút "Publish" và hiện tooltip: "Cần có mạng để xuất bản website".
2. **AI Functions:** Disable các nút `✨ Edit with AI` và hiển thị message trong Chat Panel: "AI đang ngoại tuyến. Vui lòng kiểm tra kết nối".
3. **Auto-Resume:** Khi có mạng lại (window `online` event), tự động đẩy queue từ LocalStorage lên server theo đúng thứ tự (timestamp-based).
4. **Unload Protection:** Khi `onbeforeunload` kích hoạt, nếu còn dữ liệu trong Offline Queue, hiển thị cảnh báo: "Dữ liệu chưa được đồng bộ lên máy chủ. Bạn có chắc muốn rời đi?".

## 3. Wireframe — Trạng thái Ngoại tuyến

### Screen C.1: Chỉ báo trạng thái trên Header (MỚI)

```text
Header Editor:
┌────────────────────────────────────────────────────────────────────────────┐
│ [≡]  My Awesome Site  [☁️] [Draft]               [Preview]  [Publish]  [👤] │
└────────────────────────▲───────────────────────────────────────────────────┘
                         │
           ┌─────────────┴────────────────┐
           │ Trạng thái kết nối:          │
           │ ● [☁️✔️] Đã đồng bộ          │ (Online)
           │ ● [☁️❌] Đang ngoại tuyến     │ (Offline - ⚠️ màu vàng)
           │ ● [🔄]   Đang đồng bộ...      │ (Reconnecting)
           └──────────────────────────────┘
```

### Screen C.2: Banner cảnh báo và Trạng thái vô hiệu hóa (MỚI)

```text
Editor Viewport:
┌────────────────────────────────────────────────────────────────────────────┐
│ [Header]                                                                   │
├────────────────────────────────────────────────────────────────────────────┤
│ ⚠️ Đang ngoại tuyến. Chỉnh sửa của bạn sẽ được đồng bộ khi có mạng lại. [X]   │ ← Banner
├─────────────┬────────────────────────────────────────────────┬─────────────┤
│             │                                                │             │
│ [Blocks]    │ [Preview Iframe]                               │ [Settings]  │
│             │                                                │             │
│ (AI Chat    │ ┌────────────────────────────────────────────┐ │ (Publish    │
│  Disabled)  │ │ ✨ Edit with AI (Vô hiệu hóa)              │ │  Disabled)   │
│             │ └────────────────────────────────────────────┘ │             │
│             │                                                │             │
└─────────────┴────────────────────────────────────────────────┴─────────────┘
```

## 4. Business Rules & Acceptance Criteria

### Business Rules (BR-OFF)
- **BR-OFF-01:** Mọi thao tác chỉnh sửa thủ công (Text, Color, Order) vẫn được phép khi offline.
- **BR-OFF-02:** LocalStorage key phải bao gồm `siteId` và `userId` để tránh xung đột dữ liệu giữa các site/user khác nhau trên cùng máy.
- **BR-OFF-03:** Sau khi online lại, hệ thống phải verify version với server. Nếu bản LocalStorage mới hơn -> Overwrite server. Nếu server mới hơn -> Hiện popup hỏi user.

### Acceptance Criteria (AC-OFF)
- **GIVEN** Người dùng đang ở trong Editor và bị mất kết nối mạng.
- **WHEN** Người dùng thay đổi màu sắc của một block.
- **THEN** Hệ thống lưu thay đổi vào LocalStorage, icon Cloud trên Header chuyển sang màu vàng gạch chéo, và Banner Offline xuất hiện.
- **WHEN** Người dùng có mạng trở lại.
- **THEN** Banner Offline biến mất, hệ thống tự động đồng bộ và hiển thị thông báo "Đã đồng bộ thành công".

---

# GAP-04 · 🟢 Enhancement — Chat AI theo Block (Context-Aware AI Chat)

> **Story Ref:** US-F05-01 (Chat + Preview), US-F05-03 (Inline Click-to-Edit)
> **Status:** Implemented

## 1. Tổng quan tính năng

Khi user click vào một block trong Iframe Preview, AI Chat tự động nhận diện block đó và mọi lệnh chat tiếp theo sẽ chỉ tác động lên block được chọn (context-aware editing). Nếu không chọn block nào, AI xử lý ở mức toàn site (theme, add section).

### Nguyên tắc hoạt động

```
Click block trong iframe → postMessage → setSelectedBlock → AIChatPanel → /api/ai/edit-block
```

---

## 2. Luồng tương tác (User Flow)

### 2.1. Flow chính: Click Block → Chat AI sửa block đó

```
┌──────────────────────────────────────────────────────────────┐
│  User click vào block "Hero" trong Iframe Preview               │
│  ↓                                                              │
│  Iframe gửi postMessage: BLOCK_CONTAINER_CLICKED (blockIndex=0) │
│  ↓                                                              │
│  PreviewFrame nhận message → gọi onBlockSelect(0)              │
│  ↓                                                              │
│  EditorPage: setSelectedBlock(0)                                │
│  ↓                                                              │
│  AIChatPanel nhận selectedBlock=0                               │
│  ↓                                                              │
│  User gõ chat: "Đổi tiêu đề thành Welcome"                     │
│  ↓                                                              │
│  POST /api/ai/edit-block với block=blocks[0], blockIndex=0      │
│  ↓                                                              │
│  AI trả về action: update_block → preview cập nhật realtime     │
│  ↓                                                              │
│  Chat hiển thị kết quả + nút [Undo]                             │
└──────────────────────────────────────────────────────────────┘
```

### 2.2. Flow phụ: Không chọn block → Chat sửa toàn site

```
┌──────────────────────────────────────────────────────────────┐
│  User click vào vùng trống (không có block) hoặc chưa click gì  │
│  ↓                                                              │
│  selectedBlock = null                                           │
│  ↓                                                              │
│  User gõ chat: "Đổi màu chủ sang xanh mint"                     │
│  ↓                                                              │
│  POST /api/ai/edit-block với block=null                         │
│  ↓                                                              │
│  AI trả về action: update_theme → cập nhật toàn site            │
└──────────────────────────────────────────────────────────────┘
```

### 2.3. Flow: Hover → "Edit with AI" inline

```
┌──────────────────────────────────────────────────────────────┐
│  User hover vào text element trong iframe > 200ms               │
│  ↓                                                              │
│  Iframe gửi postMessage: BLOCK_HOVERED (blockIndex, text, rect) │
│  ↓                                                              │
│  PreviewFrame hiển thị nút "✨ Edit with AI" ở top-right        │
│  ↓                                                              │
│  User click nút → mở InlineEditPopover                         │
│  ↓                                                              │
│  Gõ instruction + Enter                                         │
│  ↓                                                              │
│  POST /api/ai/rewrite-text (model: gpt-4o-mini)                │
│  → Nhận rewritten text → updateBlock trực tiếp trên field đó    │
│  ↓                                                              │
│  onInlineEditApplied callback:                                  │
│    1. setSelectedBlock(blockIndex) — select block vừa sửa       │
│    2. setActiveSidebarTab('chat') — tự chuyển sang tab Chat     │
│    3. setChatActivity() — log kết quả vào Chat history          │
│    4. Auto-save + refresh iframe                                │
└──────────────────────────────────────────────────────────────┘
```

> **Lưu ý:** Inline Edit dùng API riêng `/api/ai/rewrite-text` (model `gpt-4o-mini`, nhanh + rẻ hơn), khác với Chat panel dùng `/api/ai/edit-block` (model `gpt-4o`). Sau khi inline edit xong, kết quả tự động được sync vào Chat history để user có thể trace lại.

---

## 3. Wireframe — Chat AI theo Block

### Screen 3.1: Chưa chọn block (Default — Global context)

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡ Menu]  Home ▼ │ 🎨 Templates │ ↩ Undo  ↪ Redo │ 💻 Desktop ▼ │ 👁️ │ Draft │ 🚀 Publish│
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────────────────────┐ ┌───────────────────┐ │
│ │ 🤖 AI CHAT           │ │ 🌍 LIVE PREVIEW (Iframe)             │ │ ⚙️ GLOBAL SETTINGS│ │
│ │ ──────────────────── │ │ ┌──────────────────────────────────┐ │ │ ───────────────── │ │
│ │ [AI] Hello! What     │ │ │ [Logo]            Home  About  │ │ │ ▼ Brand Identity  │ │
│ │ would you like to    │ │ ├──────────────────────────────────┤ │ │ ▼ Contact Info    │ │
│ │ edit?                │ │ │                                  │ │ │ ▼ Social Links    │ │
│ │                      │ │ │       HERO BANNER SECTION        │ │ │ ▼ SEO Settings    │ │
│ │ ┌──────────────────┐ │ │ │                                  │ │ │                   │ │
│ │ │ 💡 Change color  │ │ │ ├──────────────────────────────────┤ │ │                   │ │
│ │ │ ➕ + Add section │ │ │ │       FEATURES SECTION           │ │ │                   │ │
│ │ └──────────────────┘ │ │ │                                  │ │ │                   │ │
│ │ ──────────────────── │ │ └──────────────────────────────────┘ │ │                   │ │
│ │ ⌨️ [ Tell AI what  ] │ │                                      │ │                   │ │
│ │ [  to change...    ▶]│ │                                      │ │                   │ │
│ └──────────────────────┘ └──────────────────────────────────────┘ └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Context:** `selectedBlock = null` → AI nhận toàn bộ `allBlocks` + `theme`, xử lý ở mức site-wide.

---

### Screen 3.2: Đã click chọn 1 block (Block-scoped context)

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡ Menu]  Home ▼ │ 🎨 Templates │ ↩ Undo  ↪ Redo │ 💻 Desktop ▼ │ 👁️ │ Saved │ 🚀 Publish│
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────────────────────┐ ┌───────────────────┐ │
│ │ 🤖 AI CHAT           │ │ ┌──────────────────────────────────┐ │ │ ⚙️ BLOCK SETTINGS │ │
│ │ ──────────────────── │ │ │ [Logo]            Home  About  │ │ │ (Hero Section)    │ │
│ │ [AI] Hello! What     │ │ ├──────────────────────────────────┤ │ │ ───────────────── │ │
│ │ would you like to    │ │ │ ┌────────────────────────────┐   │ │ │ ▼ Background      │ │
│ │ edit?                │ │ │ │ 🟦 SELECTED (viền xanh)    │   │ │ │ ▼ Typography      │ │
│ │                      │ │ │ │                            │   │ │ │ ▼ Padding         │ │
│ │ [User] Đổi tiêu đề  │ │ │ │    HERO BANNER SECTION     │   │ │ │                   │ │
│ │ thành "Chào mừng"    │ │ │ │                            │   │ │ │                   │ │
│ │                      │ │ │ │    ✨ Edit with AI          │   │ │ │                   │ │
│ │ [AI] ✅ Đã đổi tiêu  │ │ │ └────────────────────────────┘   │ │ │                   │ │
│ │ đề Hero thành        │ │ │                                  │ │ │                   │ │
│ │ "Chào mừng"          │ │ ├──────────────────────────────────┤ │ │                   │ │
│ │  [↩ Undo]      10:30│ │ │       FEATURES SECTION           │ │ │                   │ │
│ │ ──────────────────── │ │ └──────────────────────────────────┘ │ │                   │ │
│ │ ⌨️ [ Tell AI what  ] │ │                                      │ │                   │ │
│ │ [  to change...    ▶]│ │                                      │ │                   │ │
│ └──────────────────────┘ └──────────────────────────────────────┘ └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Context:** `selectedBlock = 0` (Hero) → AI chỉ sửa block Hero, không ảnh hưởng block khác.

---

### Screen 3.3: Hover element → "Edit with AI" button

```text
┌──────────────────────────────────────┐
│ ┌──────────────────────────────────┐ │
│ │ [Logo]            Home  About  │ │
│ ├──────────────────────────────────┤ │
│ │                                  │ │
│ │  ┌───────────────────────────┐   │ │
│ │  │  "Your Amazing Website"  │   │ │
│ │  │              ┌──────────────┐ │ │
│ │  │              │✨ Edit with AI│ │ │
│ │  │              └──────────────┘ │ │
│ │  └───────────────────────────┘   │ │
│ │                                  │ │
│ │   "Build something beautiful"   │ │
│ │   [Get Started]                 │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**Behavior:**
- Hover > 200ms trên text → nút `✨ Edit with AI` xuất hiện góc trên bên phải element
- Click nút → mở inline instruction popup
- Gõ lệnh + Enter → AI apply changes chỉ trên field đó

---

### Screen 3.4: Inline Edit Popup (sau khi click "Edit with AI")

```text
┌──────────────────────────────────────┐
│ │                                  │ │
│ │  ┌───────────────────────────┐   │ │
│ │  │  "Your Amazing Website"  │   │ │
│ │  │  ┌─────────────────────────────┐
│ │  │  │ How would you like to       │
│ │  │  │ change this?                │
│ │  │  │ ┌─────────────────────┬───┐ │
│ │  │  │ │ Make it more catchy │ ▶ │ │
│ │  │  │ └─────────────────────┴───┘ │
│ │  │  └─────────────────────────────┘
│ │  └───────────────────────────────┘   │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

---

## 4. Kiến trúc kỹ thuật

### 4.1. Các file liên quan

| File | Vai trò |
|------|---------|
| `src/components/editor/PreviewScripts.tsx` | Script chạy trong iframe, detect click/hover trên block, gửi postMessage |
| `src/components/editor/PreviewFrame.tsx` | Component parent nhận postMessage, render hover overlay + "Edit with AI" button |
| `src/app/(editor)/editor/[siteId]/page.tsx` | Editor page, quản lý state `selectedBlock`, truyền props cho AIChatPanel |
| `src/components/editor/AIChatPanel.tsx` | Chat panel, gửi `block` + `blockIndex` theo `selectedBlock` khi user chat |
| `src/app/api/ai/edit-block/route.ts` | API endpoint cho Chat panel, nhận block data + instruction, gọi GPT-4o trả về AIAction |
| `src/app/api/ai/rewrite-text/route.ts` | API endpoint cho Inline Edit (✨ Edit with AI), gọi GPT-4o-mini trả về rewritten text |
| `src/components/editor/InlineEditPopover.tsx` | Popup nhập instruction khi click "✨ Edit with AI" |
| `src/store/editorStore.ts` | Zustand store quản lý blocks, undo/redo history, auto-save |

### 4.2. postMessage Protocol (iframe ↔ Parent)

| Direction | Message Type | Payload | Mục đích |
|-----------|-------------|---------|----------|
| iframe → Parent | `BLOCK_CONTAINER_CLICKED` | `{ blockIndex, layout: { top, left, width, height, blockType } }` | User click vào block → select block |
| iframe → Parent | `PREVIEW_CANVAS_CLICKED` | `{}` | User click vùng trống → deselect block |
| iframe → Parent | `BLOCK_HOVERED` | `{ blockIndex, text, rect }` | User hover text element > 200ms |

### 4.3. API Request/Response

**Request:** `POST /api/ai/edit-block?stream=true`

```json
{
  "instruction": "Đổi tiêu đề thành Chào mừng",
  "block": { "blockType": "hero", "variant": "centered", "headline": "..." },
  "blockIndex": 0,
  "allBlocks": [...],
  "theme": { "primaryColor": "#3B82F6", ... },
  "siteName": "My Store"
}
```

**Response (SSE stream):**

```
event: status
data: {"message": "AI is reading your request..."}

event: action
data: {"action": "update_block", "blockIndex": 0, "changes": {"headline": "Chào mừng"}, "message": "Đã đổi tiêu đề Hero"}

event: done
data: {"action": "update_block", "message": "Đã đổi tiêu đề Hero"}
```

### 4.4. Các action AI hỗ trợ

| Action | Khi nào | Block-scoped? |
|--------|---------|---------------|
| `update_block` | Sửa nội dung block đang chọn | Có — chỉ sửa `blocks[blockIndex]` |
| `update_theme` | Đổi màu, font toàn site | Không — áp dụng toàn site |
| `add_block` | Thêm section mới (FAQ, Testimonials...) | Không — thêm vào cuối page |
| `delete_block` | Xóa block đang chọn | Có — xóa `blocks[blockIndex]` |
| `undo` | Hoàn tác thao tác trước | Không — revert last action |

---

## 5. Quy tắc nghiệp vụ (Business Rules)

| Rule | Mô tả |
|------|-------|
| BR-CHAT-01 | Nếu `selectedBlock !== null`, AI chỉ sửa block đó. Không tự ý sửa block khác |
| BR-CHAT-02 | Nếu `selectedBlock === null`, AI xử lý ở mức toàn site (theme, add section) |
| BR-CHAT-03 | Mỗi AI action đều có nút **Undo** trong chat message |
| BR-CHAT-04 | Mỗi AI action được ghi vào chat history để user trace được (BR-03 từ PRD) |
| BR-CHAT-05 | Rate limit: **20 requests/hour** per user |
| BR-CHAT-06 | Khi AI đang streaming, iframe bị lock (overlay) để tránh conflict |
| BR-CHAT-07 | Inline edit (✨ Edit with AI) chỉ modify field được hover — không affect phần còn lại |

---

## 6. Mobile Behavior (US-F05-14)

Trên mobile, tính năng Chat AI theo block hoạt động khác:

- **AI Chat** chuyển thành nút FAB (Floating Action Button) góc phải dưới
- **Tap vào block** → Bottom Sheet hiện lên thay vì sidebar settings
- **"Edit with AI"** button vẫn xuất hiện khi tap vào text element
- **Drag & Drop** bị tắt → thay bằng nút `[+] Tap to Add`

---

## 7. Edge Cases

| Case | Xử lý |
|------|-------|
| User chat khi chưa select block, hỏi "sửa hero" | AI tự nhận diện block type từ `allBlocks` và sửa block phù hợp |
| User select block rồi hỏi "đổi màu toàn site" | AI trả `update_theme` (không bị giới hạn bởi selectedBlock) |
| AI response lỗi / timeout | Chat hiển thị `❌ Failed...` + không push undo stack |
| User hết token AI | Input chat bị disabled, hiện nút "Nâng cấp gói" |
| OPENAI_API_KEY không set | Fallback: add-section dùng template cứng, các action khác báo lỗi |
| User gửi câu hỏi ngoài scope (thời tiết, code...) | AI trả system warning ⚠️ |

---

## 8. Acceptance Criteria

### AC-CHAT-01: Click block → Chat sửa block đó

```gherkin
GIVEN user đang ở /editor/:siteId
WHEN  click vào block Hero trong iframe preview
THEN  block Hero được highlight (viền xanh)
  AND selectedBlock = 0
  AND right panel chuyển sang Block Settings

WHEN  user gõ chat "Đổi tiêu đề thành Chào mừng"
THEN  AI chỉ sửa block Hero (blockIndex=0)
  AND preview cập nhật realtime (< 3s)
  AND chat hiển thị kết quả + nút [Undo]
```

### AC-CHAT-02: Deselect block → Chat sửa toàn site

```gherkin
GIVEN user click vào vùng trống trong iframe (không có block)
WHEN  selectedBlock reset về null
THEN  right panel chuyển về Global Settings

WHEN  user gõ "Đổi màu chủ sang hồng"
THEN  AI trả action update_theme
  AND toàn bộ site đổi màu
```

### AC-CHAT-03: Hover → Edit with AI

```gherkin
GIVEN user hover vào text element trong preview > 200ms
WHEN  element là editable field
THEN  nút "✨ Edit with AI" xuất hiện góc trên bên phải

WHEN  click nút "✨ Edit with AI"
THEN  instruction popup mở ra
  AND user gõ lệnh + Enter → AI apply changes trên field đó
```

### AC-CHAT-04: Undo sau AI edit

```gherkin
GIVEN AI vừa apply changes lên block
WHEN  user click nút [Undo] trong chat message
THEN  block revert về trạng thái trước
  AND preview cập nhật < 200ms
```


---

# GAP-05 · 🟡 Minor — Multi-tab Editing

## 1. Vấn đề hiện tại
Hiện tại, hệ thống chưa xử lý tình huống người dùng mở cùng một trang web (`siteId`) trên nhiều tab trình duyệt khác nhau để chỉnh sửa. Điều này dẫn đến các rủi ro:
- **Ghi đè dữ liệu (Data Overwriting):** User sửa ở Tab A rồi sang Tab B sửa tiếp. Tab B tự động Auto-save bản thảo của nó lên server, đè lên các thay đổi vừa thực hiện ở Tab A mà không có cảnh báo.
- **Lệch Stack Undo/Redo:** Lịch sử hoàn tác được lưu cục bộ trong bộ nhớ của tab. Khi Tab B lưu dữ liệu mới, nút Undo của Tab A trở nên vô nghĩa vì nó sẽ cố gắng đưa dữ liệu server về trạng thái cũ của Tab A, gây lỗi cấu trúc block.
- **Xung đột Publish:** Người dùng có thể vô tình Publish một bản thảo cũ từ một tab đã mở từ lâu nhưng chưa tải lại trang.

## 2. Giải pháp đề xuất — Single Tab Authority

### 2.1 Cơ chế Tab Handover (Chiếm quyền)
Sử dụng `BroadcastChannel API` hoặc `LocalStorage listener` để quản lý quyền chỉnh sửa giữa các tab.

- **Tab Active:** Tab đang được người dùng thao tác cuối cùng sẽ giữ "Quyền chỉnh sửa" (Write Permission).
- **Tab Suspended:** Các tab khác sẽ tự động rơi vào trạng thái "Tạm dừng" (Suspended) và hiển thị một lớp overlay mờ bảo vệ dữ liệu.

### 2.2 Behavior Rules (Multi-tab)
1. **Detection:** Khi một tab Editor mới được mở, nó gửi broadcast message "I'm the new Master" cho tất cả các tab cùng `siteId`.
2. **Suspension:** Các tab cũ nhận được message sẽ ngay lập tức:
    - Vô hiệu hoá Auto-save.
    - Hiển thị Overlay: "Phiên làm việc đã được chuyển sang tab khác".
3. **Recovery:** Ở tab bị tạm dừng, cung cấp nút **[Dùng tab này]** để chiếm lại quyền chỉnh sửa (yêu cầu tải lại dữ liệu mới nhất), hoặc **[Tải lại trang]**.

## 3. Wireframe — Quản lý đa Tab

### Screen D.1: Trạng thái Tab bị tạm dừng (MỚI)

```text
Editor Viewport (Tab cũ):
┌────────────────────────────────────────────────────────────────────────────┐
│ [Header - Greyed out]                                                      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│          ┌──────────────────────────────────────────────────────┐          │
│          │                                                      │          │
│          │         ⚠️ Phiên làm việc đang mở ở tab khác          │          │
│          │                                                      │          │
│          │  Để tránh mất dữ liệu, tab này đã tạm dừng tự động   │          │
│          │  lưu. Bạn muốn làm gì tiếp theo?                     │          │
│          │                                                      │          │
│          │  [Tải lại dữ liệu mới nhất]    [Tiếp tục ở tab này]  │          │
│          │                                                      │          │
│          └──────────────────────────────────────────────────────┘          │
│                                                                            │
├─────────────┬────────────────────────────────────────────────┬─────────────┤
│             │                                                │             │
│ (Disabled)  │ (Disabled Preview with Overlay)                │ (Disabled)  │
│             │                                                │             │
└─────────────┴────────────────────────────────────────────────┴─────────────┘
```

## 4. Business Rules & Acceptance Criteria

### Business Rules (BR-TAB)
- **BR-TAB-01:** Chỉ cho phép **duy nhất 1 tab** được thực hiện lệnh `SAVE_SITE` và `PUBLISH_SITE` tại một thời điểm.
- **BR-TAB-02:** Nếu user chiếm lại quyền (`Tiếp tục ở tab này`), tab đó phải fetch lại trạng thái mới nhất từ server trước khi cho phép edit để tránh ghi đè "mù" (Blind overwrite).

### Acceptance Criteria (AC-TAB)
- **GIVEN** Người dùng đang mở Editor ở Tab 1.
- **WHEN** Người dùng mở URL Editor của chính site đó ở Tab 2.
- **THEN** Tab 1 ngay lập tức hiển thị Overlay "Phiên làm việc đã chuyển sang tab khác" và vô hiệu hóa mọi nút bấm.
- **GIVEN** Người dùng đang ở Tab 1 (đã bị lock).
- **WHEN** Người dùng click "Tiếp tục ở tab này".
- **THEN** Tab 2 sẽ bị lock, Tab 1 tải lại dữ liệu mới nhất từ server và cho phép chỉnh sửa bình thường.

---

# GAP-06 · 🟡 Minor — Component Spacing: Thiếu khoảng thở giữa các khối

## 1. Vấn đề (Problem)
Hiện tại, khi người dùng thêm các component (blocks) vào trang web, các khối này dính sát vào nhau mà không có bất kỳ khoảng trống (white-space) nào. Điều này làm cho giao diện trở nên "ngộp", thiếu sự phân tách thị giác và trông không chuyên nghiệp (không giống các trang web hiện đại).

**Nguyên nhân:**
- `SiteRenderer.tsx` chưa định nghĩa default padding cho các block container.
- `Block Settings` chưa có trường cho phép người dùng tùy chỉnh spacing (Top/Bottom padding).

## 2. Giải pháp (Solution)

### A. Default Spacing
- Mọi block khi được thêm mới sẽ có default vertical padding là **32px** (Desktop) và **24px** (Mobile) để đảm bảo độ thoáng tối thiểu.

### B. Block Spacing UI (Settings Panel)
- Thêm mục **"Layout & Spacing"** vào đầu tab **Block Settings**.
- Cung cấp 2 slider hoặc input số:
  - **Padding Top**: `0 - 120px`
  - **Padding Bottom**: `0 - 120px`

## 3. Wireframe Low-fi

### Screen G.1: Block Settings — Spacing Section
```text
┌──────────────────────────────┐
│       BLOCK SETTINGS         │
├──────────────────────────────┤
│ [🏔️ Hero Banner ]         #1 │ 
├──────────────────────────────┤
│ ▼ LAYOUT & SPACING           │
│                              │
│  Top Spacing    [───●────] 48│
│  Bottom Spacing [──●─────] 32│
│                              │
├──────────────────────────────┤
│ ▼ CONTENT                    │
│  Headline: [................]│
│  ...                         │
└──────────────────────────────┘
```

## 4. Business Rules & Acceptance Criteria

### Business Rules (BR-SPC)
- **BR-SPC-01:** Giá trị spacing phải được lưu trực tiếp vào block data (ví dụ: `block.style.paddingTop`).
- **BR-SPC-02:** Nếu block là `navigation` (Header), padding mặc định nên là 0 hoặc rất nhỏ để tránh chiếm diện tích hero.

### Acceptance Criteria (AC-SPC)
- **GIVEN** Người dùng chọn một block bất kỳ.
- **WHEN** Người dùng kéo slider "Top Spacing" trong Settings Panel.
- **THEN** Khối nội dung trong Preview Iframe phải thay đổi khoảng cách phía trên ngay lập tức (real-time).
- **GIVEN** Người dùng add 2 block liên tiếp.
- **THEN** Giữa 2 block phải có một khoảng trắng mặc định (default padding).

---

# GAP-07 · 🔴 Blocker — Block Image Editing: Không thể đổi ảnh Component

## 1. Vấn đề (Problem)
Người dùng phàn nàn rằng họ không tìm thấy chỗ để thay đổi hình ảnh cho Component Hero Banner hoặc các khối có ảnh khác. Mặc dù hệ thống có tính năng AI Image, nhưng việc quản lý ảnh thủ công (Upload/Replace) đang bị bỏ sót trong Settings Panel.

**Nguyên nhân:**
- `SettingsPanel.tsx` mới chỉ dừng lại ở việc edit Text, CTA và Links. Phần Image Editor cho block levels chưa được implement.

## 2. Giải pháp (Solution)

### A. Image Field in Settings Tab
- Khi một block có trường `image` (như Hero) hoặc `images` (như Gallery/Features), Settings Panel phải hiển thị một **Image Upload UI**.

### B. Image Editor Component
- Hỗ trợ các hành động:
  - **Upload ảnh mới** từ thiết bị.
  - **Replace**: Mở Stock Image library hoặc AI Image Generator.
  - **Alt text**: Cho phép nhập alt text để tối ưu SEO.

## 3. Wireframe Low-fi

### Screen G.2: Hero Block — Image Upload Field
```text
┌──────────────────────────────┐
│       BLOCK SETTINGS         │
├──────────────────────────────┤
│ ▼ CONTENT                    │
│  Headline: [................]│
│                              │
│  IMAGE                       │
│  ┌────────────────────────┐  │
│  │       [ IMAGE    ]     │  │
│  │       [ PREVIEW  ]     │  │
│  └────────────────────────┘  │
│  [ 📤 Change ] [ ✨ AI ]      │
│                              │
│  Alt Text: [................]│
│                              │
├──────────────────────────────┤
│ ▼ CTA BUTTONS                │
└──────────────────────────────┘
```

## 4. Business Rules & Acceptance Criteria

### Business Rules (BR-IMG)
- **BR-IMG-01:** Ảnh upload phải tuân thủ limit 2MB và được auto-compress/resize (tối đa 1920px width) để đảm bảo tốc độ load trang.
- **BR-IMG-02:** Khi dùng AI để đổi ảnh, hệ thống phải tự động cập nhật cả trường `alt` text dựa trên nội dung ảnh AI sinh ra.

### Acceptance Criteria (AC-IMG)
- **GIVEN** Người dùng đang edit Hero Banner.
- **WHEN** Người dùng click vào box Image trong Settings Panel.
- **THEN** Hộp thoại chọn file hiện lên. Sau khi chọn, ảnh mới phải được hiển thị ngay lập tức trên Preview Iframe.
- **GIVEN** Người dùng click nút "✨ AI" tại trường Image.
- **WHEN** AI sinh xong ảnh.
- **THEN** Ảnh mới tự động apply vào block và đồng bộ vào database.

---

# GAP-08 · 🟡 Minor — Limited Footer Editing: Không thể sửa Link trong Footer

## 1. Vấn đề (Problem)
Hiện tại, khi người dùng muốn chỉnh sửa Footer, hệ thống chỉ cho phép sửa **Copyright** và **Tiêu đề cột**. Những đường dẫn quan trọng (ví dụ: Chính sách bảo mật, Điều khoản sử dụng, Social links trong cột) không có giao diện chỉnh sửa trong Settings Panel.

**Nguyên nhân:**
- `SettingsPanel.tsx` (L1034) mới chỉ hiển thị field `title` cho mỗi column, chưa tích hợp list editor cho mảng `links` bên trong mỗi column đó.

## 2. Giải pháp (Solution)

### A. Nested Link Editor for Footer
- Cải tiến giao diện edit Footer Column: Mỗi cột sau khi mở ra sẽ có một danh sách các Link bên dưới.
- Mỗi link gồm: **Label** và **URL/Page**.
- Cho phép **Thêm/Xóa/Sắp xếp** lại các link này.

## 3. Wireframe Low-fi

### Screen G.3: Footer Settings — Column Links
```text
┌──────────────────────────────┐
│       BLOCK SETTINGS         │
├──────────────────────────────┤
│ ▼ FOOTER COLUMNS             │
│                              │
│ ┌─ Column 1 ───────────────┐ │
│ │ Title: [ Company       ] │ │
│ │                          │ │
│ │ LINKS                    │ │
│ │ 1. [ About Us  ] [ /abt ]│ │
│ │ 2. [ Careers   ] [ /car ]│ │
│ │ [+] Add Link             │ │
│ └──────────────────────────┘ │
│                              │
│ [+] Add Column               │
└──────────────────────────────┘
```

## 4. Business Rules & Acceptance Criteria

### Business Rules (BR-FTR)
- **BR-FTR-01:** Mỗi Footer Column tối đa nên có **10 links** để đảm bảo layout hiển thị tốt trên Mobile.
- **BR-FTR-02:** Hỗ trợ link đến **Page nội bộ** (thông qua dropdown chọn page) hoặc **URL ngoại sàn**.

### Acceptance Criteria (AC-FTR)
- **GIVEN** Người dùng mở tab Block khi đang chọn Footer.
- **WHEN** Người dùng sửa Label của một Link trong cột.
- **THEN** Link tương ứng dưới chân trang trong Preview Iframe phải cập nhật text ngay lập tức.
- **GIVEN** Người dùng xóa một Link.
- **THEN** Layout footer phải tự động căn chỉnh lại các link còn lại.

---

# GAP-09 · 🔴 Blocker — Missing Breadcrumb Settings: Breadcrumb không có settings

## 1. Vấn đề (Problem)
Block Breadcrumb đã được đăng ký trong hệ thống nhưng khi chọn vào block này, Settings Panel hiển thị trống rỗng hoặc chỉ có các field Headline không liên quan. User không thể chỉnh sửa logic điều hướng của Breadcrumb.

**Nguyên nhân:**
- `breadcrumb/config.ts` có định nghĩa trường `items`, nhưng `SettingsPanel.tsx` thiếu logic render cho `blockType === 'breadcrumb'`.

## 2. Giải pháp (Solution)

### A. Breadcrumb Editor Section
- Thêm section **"Navigation Path"** vào tab Block Settings.
- Cho phép user chọn giữa 2 chế độ:
  - **Auto**: Tự động sinh dựa trên cấu trúc trang.
  - **Manual**: Cho phép user tự nhập các mốc điều hướng (Label + URL).

## 3. Wireframe Low-fi

### Screen G.4: Breadcrumb Settings
```text
┌──────────────────────────────┐
│       BLOCK SETTINGS         │
├──────────────────────────────┤
│ ▼ NAVIGATION PATH            │
│                              │
│ Path Mode: (o) Auto  ( ) Man │
│                              │
│ Home Label: [ Home       ]   │
│ Separator:  [ / ]            │
│                              │
├──────────────────────────────┤
│ ▼ APPEARANCE                 │
│ Show Icon: [x]               │
└──────────────────────────────┘
```

## 4. Business Rules & Acceptance Criteria

### Business Rules (BR-BCR)
- **BR-BCR-01:** Chế độ **Auto** sẽ tự động lấy `Page Title` làm mốc cuối cùng của breadcrumb.
- **BR-BCR-02:** Nếu Breadcrumb đặt ở Homepage, mặc định nó sẽ bị ẩn (hoặc chỉ hiện Home label) nếu không có path sâu hơn.

### Acceptance Criteria (AC-BCR)
- **GIVEN** Người dùng chọn block Breadcrumb.
- **WHEN** Người dùng thay đổi "Separator" từ `/` sang `>`.
- **THEN** Ký tự phân cách giữa các cấp điều hướng trên Iframe phải đổi sang `>`.
- **GIVEN** Người dùng đổi "Home Label" thành "Trang chủ".
- **THEN** Mốc đầu tiên của breadcrumb phải đổi thành "Trang chủ".


