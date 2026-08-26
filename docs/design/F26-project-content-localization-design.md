# F26 Project Content & Template Localization — Design & Wireframe Report

> **Epic:** Project Content & Template Localization (F26)
> **Feature Code:** F26
> **Version:** 1.0 — Initial design
> **Updated:** 2026-05-26
> **Claude Design (interactive):** [F26 Project Content Localization](https://claude.ai/design/p/a2811344-f556-4b61-b1af-abfe95541560?file=f26%2FF26%20Project%20Content%20Localization.html&present=1)
> **Figma Design:** TBD
> **Decisions:** [PRD F26](../prd/F26-project-content-localization.md) · [Stories](../stories/F26-project-content-localization-stories.md) · related [F21 Localization](../prd/F21-localization.md) (CMS chrome i18n — reuse switcher pattern)

Tài liệu cung cấp wireframe + spec UI cho **F26** — làm cho **nội dung dự án & thư viện block** nhận biết ngôn ngữ (`Sites.locale` = `en|ms`). F26 **không** lo CMS/admin chrome (đó là F21); nó lo trải nghiệm khi nội dung AI/template không khớp ngôn ngữ.

> **Boundary:** F21 dịch *vỏ CMS* (menu, nút). F26 dịch *nội dung dự án* (default content của block thêm mới, preview kho block). Switcher của F26 nằm trong **editor canvas toolbar**, khác switcher F21 nằm ở **CMS top header**.

---

## 0. UX Problem & Design Principles

**Vấn đề:** User MY prompt bằng BM → AI dựng site BM (`Sites.locale='ms'`). Khi vào editor kéo thêm block, block hiện default **tiếng Anh** → cảm giác "nửa mùa", tăng cognitive load.

**Nguyên tắc thiết kế (tệp user Malaysia song ngữ EN⇄BM):**
1. **Rõ ràng > đoán mò** — cho user xác nhận ngôn ngữ, không ép theo AI detect.
2. **Nhất quán tức thì** — block thêm mới phải cùng ngôn ngữ site ngay khi chèn, không "nhấp nháy" tiếng Anh.
3. **Không phá công sức user** — đổi ngôn ngữ chỉ swap default chưa động tới, giữ nguyên text user đã sửa.
4. **Fail an toàn, không ồn ào** — thiếu bản dịch → fallback EN lặng lẽ + gợi ý dịch, không vỡ trang.
5. **Tái dùng pattern F21** — switcher dùng cùng visual ngôn ngữ (`🌐 EN / BM`) để user nhận diện ngay.

**Locale tokens (toàn UI):**
| Locale | Label | Cờ | Short |
|--------|-------|----|-------|
| `en` | English | 🇬🇧 | EN |
| `ms` | Bahasa Melayu | 🇲🇾 | BM |

---

## 1. Post-Generate Language Confirmation (US-F26-01)

*Surface: AI builder, ngay sau khi generate xong site. File mục tiêu: `src/app/(builder)/builder/new/AIBuilderPageClient.tsx`. Tận dụng `detectLanguage()` (`src/lib/ai/lang-detect.ts`) đã có.*

### 1.1. Pattern lựa chọn: **inline confirm banner** (không modal chặn)
Lý do: sau generate user đang hứng khởi xem kết quả — modal chặn gây khó chịu. Banner nhẹ ở đầu canvas, auto-dismiss khi user thao tác, pre-select ngôn ngữ đã detect.

```text
┌──────────────────────────────────────────────────────────────┐
│ 🌐  AI created your site in  Bahasa Melayu .  Correct?         │
│                                                                │
│     [ ✓ Yes, keep BM ]   [ Switch to English ▾ ]      ✕        │
└──────────────────────────────────────────────────────────────┘
        ▲ pre-selected = detected locale (ms)
```

- `[Switch to English ▾]` mở dropdown EN/BM (Phase 1 chỉ 2 ngôn ngữ; dropdown để mở rộng zh/ta sau).
- `✕` = giữ locale đã detect (no-op), banner đóng.
- Chọn xong → ghi `Sites.locale` qua API, banner đóng, toast xác nhận `Language set to Bahasa Melayu`.

### 1.2. States
```text
shown      → ngay sau generate, locale = detected
confirming → user mở dropdown chọn ngôn ngữ khác
saving     → PATCH Sites.locale (button spinner)
dismissed  → đã chọn / đóng → không hiện lại cho site này (lưu cờ đã-confirm)
```

### 1.3. Copy deck (i18n keys → `confirmLang.*`)
| Key | EN | BM |
|-----|----|----|
| `confirmLang.title` | AI created your site in {lang}. Correct? | AI mencipta laman anda dalam {lang}. Betul? |
| `confirmLang.keep` | Yes, keep {short} | Ya, kekalkan {short} |
| `confirmLang.switch` | Switch language | Tukar bahasa |
| `confirmLang.saved` | Language set to {lang} | Bahasa ditetapkan ke {lang} |

### 1.4. Mobile (≤375px)
Banner stack 2 dòng: text trên, nút full-width dưới. `✕` góc phải dòng đầu.

---

## 2. Quick Language Switcher — Editor Toolbar (US-F26-05)

*Surface: editor canvas toolbar. File mục tiêu: editor toolbar trong `src/app/(editor)/editor/[siteId]/` (xác nhận component toolbar lúc implement). Visual nhất quán với switcher F21.*

### 2.1. Placement
```text
┌── Editor Top Toolbar ───────────────────────────────────────────────┐
│  ‹ Back   Site name            [ 🌐 BM ▾ ]   [Preview]  [Publish]    │
└──────────────────────────────────────────────────────────────────────┘
                                      ▲ project content language (Sites.locale)
```
Đặt **trái cụm Preview/Publish**. KHÁC switcher F21 (CMS header) — đây là *ngôn ngữ nội dung site đang edit*, không phải ngôn ngữ vỏ CMS. Tooltip phân biệt: "Ngôn ngữ nội dung website".

### 2.2. Hành vi 1-click re-language (cốt lõi, BR-04)
Khi đổi `BM → EN` (hoặc ngược lại):

```text
[user đổi switcher]
   ├── KHÔNG có block nào user đã sửa default → swap ngay toàn bộ default chưa-động-tới → toast
   └── CÓ block user đã sửa → mở confirm dialog (bảo vệ công sức):
```

```text
┌─ Switch content language to English? ───────────────────────┐
│                                                              │
│  We'll translate the default text of untouched blocks.       │
│  Your edited content stays unchanged:                        │
│                                                              │
│   • Will switch:  3 blocks with default text                 │
│   • Kept as-is:   5 blocks you edited                        │
│                                                              │
│   ☐ Also re-translate my edited blocks (not recommended)     │
│                                                              │
│              [ Cancel ]        [ Switch language ]           │
└──────────────────────────────────────────────────────────────┘
```

- Mặc định: chỉ swap default chưa sửa; giữ block đã edit.
- Checkbox opt-in cho phép dịch cả block đã sửa (cảnh báo "not recommended").
- Cách phân biệt "đã sửa vs default": dựa cờ dirty-per-field (chốt cơ chế ở Phase design kỹ thuật — xem Open Questions).
- Sau switch: ghi `Sites.locale`, re-render canvas, toast `Switched to English ({n} blocks updated)`.

### 2.3. States
```text
idle      → hiển thị locale hiện tại
open      → dropdown EN/BM
confirm   → dialog (chỉ khi có block đã sửa)
switching → canvas skeleton ngắn / shimmer trên block đang đổi
done       → toast tóm tắt số block đã đổi
```

### 2.4. Copy deck (`langSwitch.*`)
| Key | EN | BM |
|-----|----|----|
| `langSwitch.tooltip` | Website content language | Bahasa kandungan laman web |
| `langSwitch.confirmTitle` | Switch content language to {lang}? | Tukar bahasa kandungan ke {lang}? |
| `langSwitch.willSwitch` | Will switch: {n} blocks with default text | Akan tukar: {n} blok teks lalai |
| `langSwitch.keptAsIs` | Kept as-is: {n} blocks you edited | Dikekalkan: {n} blok yang anda edit |
| `langSwitch.alsoEdited` | Also re-translate my edited blocks (not recommended) | Terjemah juga blok yang saya edit (tidak disyorkan) |
| `langSwitch.done` | Switched to {lang} ({n} blocks updated) | Ditukar ke {lang} ({n} blok dikemas kini) |

---

## 3. Smart Component Adder (US-F26-03)

*Surface: `src/components/editor/BlockLibraryPanel.tsx` (đã dùng `useI18n` cho category labels). Thêm: preview text theo `Sites.locale` + icon auto-translate cho block chưa có bản dịch tay.*

### 3.1. Library panel — preview theo ngôn ngữ site
```text
┌─ Add Component ───────────── [search...] ──┐
│ Basics                                      │
│ ┌─────────────┐ ┌─────────────┐             │
│ │ 🏔️ Hero      │ │ ✦ Features  │            │   ← title + sample
│ │ "Selamat    │ │ "Mengapa    │             │     hiển thị BM
│ │  datang..."  │ │  pilih..."  │            │     (site locale = ms)
│ └─────────────┘ └─────────────┘             │
│ Content                                     │
│ ┌─────────────┐ ┌─────────────┐             │
│ │ ❓ FAQ  🅐    │ │ 💬 Reviews  │            │   ← 🅐 = auto-translate
│ │ "Soalan...". │ │ "What...". 🅐│            │     badge (chưa có BM)
│ └─────────────┘ └─────────────┘             │
└─────────────────────────────────────────────┘
```

### 3.2. Trạng thái coverage mỗi block card
| State | Dấu hiệu | Ý nghĩa |
|-------|----------|---------|
| **Covered** | preview BM, không badge | có bản dịch tay (hand-authored) |
| **Needs translation** | badge `🅐` góc trên-phải + preview EN mờ | chưa có BM → sẽ AI-translate khi add (US-F26-04) |
| **Translating** | badge spinner | đang gọi AI translate |

- `🅐` icon nhỏ (16px), màu accent. **Tooltip:** "Auto-translate to Bahasa Melayu when added".
- Khi `Sites.locale='en'`: không badge nào (EN là nguồn gốc) — panel như cũ.

### 3.3. Copy deck (`blockLibrary.*`)
| Key | EN | BM |
|-----|----|----|
| `blockLibrary.autoTranslateTip` | Auto-translate to {lang} when added | Terjemah auto ke {lang} apabila ditambah |
| `blockLibrary.needsTranslation` | No {lang} version yet — AI will translate | Belum ada versi {lang} — AI akan terjemah |

---

## 4. Auto-Translate Feedback (US-F26-04)

*Khi add block thiếu bản dịch (hoặc bấm `🅐`): dịch server-side, chèn vào trang. Phản hồi non-blocking.*

### 4.1. Flow + states
```text
[add block "needs translation" vào site ms]
   → chèn ngay với EN default (không chờ) + block hiện shimmer trên text
   → gọi POST /api/ai/translate (background)
        ├── ok      → swap text sang BM tại chỗ, toast nhẹ "Translated to BM"
        ├── fail    → giữ EN default, toast warning "Couldn't translate — showing English"
        └── timeout → như fail
```

> **Quyết định UX:** chèn EN-trước-rồi-swap (optimistic) thay vì chặn chờ dịch → giữ cảm giác tức thì (nguyên tắc #2), fail vẫn có nội dung (nguyên tắc #4).

### 4.2. Copy deck (`autoTranslate.*`)
| Key | EN | BM |
|-----|----|----|
| `autoTranslate.translating` | Translating to {lang}… | Menterjemah ke {lang}… |
| `autoTranslate.done` | Translated to {lang} | Diterjemah ke {lang} |
| `autoTranslate.failed` | Couldn't translate — showing English. You can edit manually. | Gagal terjemah — memaparkan English. Anda boleh edit manual. |

---

## 5. Localized Block Insertion — visible result (US-F26-02)

Không có UI mới; là **kết quả thấy được** của engine: trên site `ms`, block kéo vào (Hero/Features/FAQ…) hiện thẳng nội dung BM mẫu (vd Hero: "Selamat datang ke {brand}"). Trên site `en` → không đổi. Đây là tiêu chí "0 English-leftover" của F26.

---

## 6. Component / Design-system Mapping

| UI element | shadcn/ui base | Ghi chú |
|------------|----------------|---------|
| Confirm banner (§1) | `Alert` + `Button` + `DropdownMenu` | dismissible, role="status" |
| Toolbar switcher (§2) | `DropdownMenu` (giống F21 switcher) | icon `Globe` (lucide) |
| Re-language confirm (§2.2) | `AlertDialog` + `Checkbox` | destructive-aware |
| Block card badge `🅐` (§3) | `Badge` + `Tooltip` | size sm, accent |
| Toasts (§4) | toast hiện có của app | non-blocking |
| Translating shimmer | `Skeleton` | inline trên text node |

**Tái dùng:** visual ngôn ngữ + dropdown lấy từ switcher F21 (giữ nhất quán nhận diện).

---

## 7. States Matrix (tổng hợp)

| Surface | Empty/Default | Loading | Success | Error/Fallback |
|---------|---------------|---------|---------|----------------|
| Confirm banner | shown (detected) | saving spinner | toast saved | (no destructive path) |
| Toolbar switch | idle locale | switching shimmer | toast n blocks | giữ nguyên nếu PATCH fail + toast |
| Component adder | preview locale | translating badge | preview BM | badge `🅐` + EN preview |
| Auto-translate | EN inserted | shimmer | swap BM + toast | EN giữ + warning toast |

---

## 8. Accessibility

- Banner & toast: `role="status"`, `aria-live="polite"`.
- Switcher dropdown: keyboard-navigable, `aria-label="Website content language"`.
- `🅐` badge: không chỉ dựa màu — có tooltip text + `aria-label`.
- Confirm dialog: focus-trap, ESC = Cancel, nút Cancel là default focus.
- Đối chiếu contrast cho badge accent ≥ 4.5:1.

---

## 9. Mobile (≤375px)

- §1 banner: stack, nút full-width.
- §2 switcher: thu còn icon `🌐` + short (`BM`); dropdown bottom-sheet.
- §3 library: 1 cột card; badge `🅐` vẫn hiện góc phải.
- Confirm dialog: full-width, nút stack dọc.

---

## 10. Open Design Questions

- **§2.2 dirty-tracking:** cơ chế chính xác để phân biệt "block user đã sửa" vs "default chưa động" — per-field dirty flag hay so sánh với default snapshot? (ảnh hưởng cả engine #1072 Phase 02). → chốt ở plan kỹ thuật.
- **§1 banner vs modal:** xác nhận với PM/UIUX rằng inline banner đủ nổi bật (vs modal) cho bước confirm ngôn ngữ.
- **§4 optimistic insert:** chấp nhận hiện EN ~1-2s rồi swap BM, hay nên skeleton chờ dịch xong mới hiện? (trade-off: tức thì vs nhấp nháy ngôn ngữ).
- **zh/Tamil:** dropdown đã chừa chỗ mở rộng; xác nhận lộ trình Phase 2.
