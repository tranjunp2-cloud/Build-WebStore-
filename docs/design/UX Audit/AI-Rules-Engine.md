# AI Rules Engine — ECH Prime Web v2

> **Ngày:** 2026-04-21
> **Tác giả:** Đội ngũ UX / Sản phẩm
> **Phạm vi:** Bộ quy tắc vận hành AI tích hợp trong Builder — Color, Typography, Content, Layout & Industry Context
> **Tệp tham chiếu:**
> - `src/lib/ai/system-prompt.ts` — AI system prompt & rule injection
> - `src/collections/DesignTokens.ts` — Design Token schema
> - `src/components/editor/BlockLibraryPanel.tsx` — Block registry UI
> - `src/blocks/types.ts` — BLOCK_TYPES registry

---

## Tổng quan hệ thống

```
User Input
    │
    ▼
┌─────────────────────────────────────────────────────┐
│              AI Rules Engine                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Industry     │  │ Accessibility│  │ Content   │ │
│  │ Color Logic  │  │ & Theme Core │  │ & Layout  │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         └─────────────────┴────────────────┘        │
│                           │                         │
│              ┌────────────▼──────────────┐          │
│              │  Live Rules Validation    │          │
│              │  Dashboard (Real-time)    │          │
│              └───────────────────────────┘          │
└─────────────────────────────────────────────────────┘
    │
    ▼
Output: Validated Design Tokens / Blocks / Content
```

---

## MODULE A — Industry Color Logic

> **Trigger:** Người dùng chọn ngành nghề qua dropdown `Industry Context` hoặc nhập mô tả doanh nghiệp.

### A.1 Industry Mapping — Palette ưu tiên

| Ngành | Primary Colors | Avoided Colors | Lý do tâm lý màu sắc |
|-------|---------------|----------------|----------------------|
| **Công nghệ / SaaS** | `Blue`, `Indigo` | `Red` (trừ Warning) | Tạo cảm giác tin cậy, hiện đại, chuyên nghiệp |
| **F&B / Thực phẩm** | `Red`, `Orange`, `Yellow`, `Green (Organic)` | Màu lạnh trung tính | Kích thích thị giác, tạo cảm giác ngon miệng |
| **Y tế / Chăm sóc sức khỏe** | `Teal`, `Light Blue`, `White` | `Red đậm` | Tránh liên tưởng máu/nguy hiểm, tạo cảm giác sạch sẽ |
| **Tài chính / Ngân hàng** | `Dark Blue`, `Gold`, `Green` | Gradient phức tạp | Thể hiện sự thịnh vượng, ổn định, đáng tin |
| **Thời trang / Làm đẹp** | `Black`, `Pink`, `Pastel tones` | — | Cho phép high-contrast để tăng tính nghệ thuật |
| **Giáo dục** | `Blue`, `Green`, `Purple nhạt` | High-contrast mạnh | Hỗ trợ tập trung, hài hòa thị giác |

### A.2 Mood & Vibration Rules

#### Saturation Guardrail
```
IF industry IN [Healthcare, Finance]:
    VALIDATE saturation(color) <= 90%
    IF saturation > 90%:
        FLAG: "Màu quá bão hòa — gây nhức mắt và thiếu chuyên nghiệp cho ngành {industry}"
        SUGGEST: auto_desaturate(color, target=75%)
```

#### Contrast by Industry
```
IF industry == Fashion:
    ALLOW high_contrast_pairs = true
    PREFER contrast_ratio >= 7:1 (AAA) for artistic impact

IF industry == Education:
    REQUIRE color_harmony_score >= 0.7
    AVOID complementary_pairs with delta_hue < 30°
    PREFER analogous or triadic palettes
```

### A.3 AI Industry Smart Suggest

**Trigger:** Người dùng nhập mô tả doanh nghiệp dạng tự do.

**Ví dụ input:** `"Spa cho mẹ và bé tại Malaysia"`

**Quy trình xử lý:**
```
1. NLP classify → industry = [Healthcare + Beauty/Wellness]
2. Map palette rules:
   - Base: Teal, Light Blue (Healthcare)
   - Accent: Soft Pink, Pastel Lavender (Beauty)
   - Neutral: White, Off-white (#FAFAFA)
3. Generate Color Pair (Light + Dark Mode)
4. Validate WCAG AA (contrast ≥ 4.5:1) cho mọi cặp text/bg
5. Output với giải thích
```

**Output format:**
```
📦 Suggested Palette — "Spa cho mẹ và bé"
─────────────────────────────────────────
Primary:    #4DB6AC  →  Dark: #80CBC4   [Teal — sức khỏe & tin cậy]
Secondary:  #F8BBD0  →  Dark: #F48FB1   [Soft Pink — nhẹ nhàng, nữ tính]
Neutral:    #FAFAFA  →  Dark: #1E1E1E   [Trung tính]
CTA:        #00897B  →  Dark: #26A69A   [Teal đậm — hành động rõ ràng]

✅ Contrast Check:
   Primary text on White bg: 4.7:1 (AA Pass)
   CTA text on CTA bg:        5.2:1 (AA Pass)

💡 Lý do chọn màu:
   Teal → ngành chăm sóc sức khỏe: sạch sẽ, an toàn
   Soft Pink → spa/làm đẹp: nhẹ nhàng, thư giãn, phù hợp mẹ & bé
   Palette phù hợp thị trường Malaysia: màu sắc không quá mạnh,
   tránh red/orange là màu nhạy cảm văn hóa trong bối cảnh y tế
```

### A.4 Dashboard — Industry Context Dropdown

```
UI Component: <IndustryContextDropdown />
─────────────────────────────────────────
Options:
  [ ] Công nghệ / SaaS
  [ ] F&B / Thực phẩm
  [ ] Y tế / Chăm sóc sức khỏe
  [ ] Tài chính / Ngân hàng
  [ ] Thời trang / Làm đẹp
  [ ] Giáo dục
  [ ] Khác

Khi chọn ngành:
  → Scan toàn bộ Design Tokens hiện tại
  → Flag mọi màu "Off-brand" với ngành đó
  → Hiển thị badge: 🔴 Off-brand | 🟡 Cần xem xét | 🟢 Phù hợp
```

**Ví dụ output khi chọn "Y tế":**

| Token | Giá trị | Trạng thái |
|-------|---------|------------|
| `--color-primary` | `#E53935` (Red 700) | 🔴 Off-brand — màu đỏ đậm không phù hợp ngành Y tế |
| `--color-accent` | `#FF6D00` (Orange) | 🟡 Cần xem xét — saturation 100% vượt ngưỡng |
| `--color-secondary` | `#4DB6AC` (Teal) | 🟢 Phù hợp |

---

## MODULE B — Accessibility & Theme Core Logic

### B.1 Contrast Guardrail (WCAG AA)

```
RULE: contrast_ratio(text_color, bg_color) >= 4.5:1

IF user inputs color pair that FAILS:
    SHOW: "⚠️ Contrast {ratio}:1 — chưa đạt WCAG AA (yêu cầu ≥ 4.5:1)"
    AUTO SUGGEST: nearest_passing_hex(input_color, target_ratio=4.5)
    DISPLAY: before/after hex comparison

Áp dụng cho:
  - Light Mode: text vs light background
  - Dark Mode:  text vs dark background
  - CTA buttons: label vs button background
```

**Auto-fix logic:**
```
nearest_passing_hex(color, bg, target=4.5):
    1. Giữ nguyên hue và saturation
    2. Adjust lightness theo hướng tăng contrast với bg
    3. Binary search trong khoảng L [0, 100] của HSL
    4. Return hex đầu tiên đạt ratio >= target
```

### B.2 Theme Mapping — Bắt buộc Color Pair

```
RULE: mọi màu mới thêm vào hệ thống PHẢI có cả Light và Dark value

IF user adds color token with ONLY one mode:
    BLOCK save
    SHOW: "❌ Theme Mapping Error: Token '{name}' thiếu giá trị cho {missing_mode} Mode.
           AI đề xuất Dark Mode value: {auto_suggested_dark_hex}"

Auto Dark Mode generation:
  - Lightness inversion với điều chỉnh (không phải đảo ngược 1:1)
  - Light (#FFFFFF bg) → Dark (#1E1E1E bg) relative luminance mapping
  - Đảm bảo contrast >= 4.5:1 trong Dark Mode
```

### B.3 Readability Check — Font Weight

```
RULE: Light Mode body text minimum font-weight = 400

IF token.scope IN ['Body', 'Small'] AND mode == 'Light':
    IF font_weight < 400:
        FLAG: "⚠️ Readability Warning: font-weight {value} quá mỏng cho Light Mode.
               Màn hình độ phân giải thấp sẽ bị mất nét. Khuyến nghị: weight ≥ 400"
        SUGGEST: font_weight = 400
```

---

## MODULE C — Typography & Mapping

### C.1 Dynamic Font Sync

```
RULE: Toàn bộ 10 Typography Tokens map với biến --font-primary

Tokens:
  heading-1, heading-2, heading-3, heading-4, heading-5, heading-6
  body-large, body-1, body-small, caption

Khi --font-primary thay đổi (VD: Inter → Lexend):
  → Re-render preview cho TẤT CẢ 10 tokens
  → GIỮ NGUYÊN: font-size, line-height, letter-spacing, font-weight
  → CHỈ thay đổi: font-family
  → KHÔNG reset bất kỳ giá trị nào đã custom
```

### C.2 Scale Logic — AI Smart Add Typography

```
RULE: Khi user yêu cầu "Tạo bộ Typo mới", AI dùng tỷ lệ toán học

Available scales:
  - Perfect Fourth (1.333) — cân đối, phù hợp UI/SaaS
  - Golden Ratio   (1.618) — thẩm mỹ cao, phù hợp Editorial/Fashion

Input: base_size (mặc định 16px)

Ví dụ với Perfect Fourth (1.333), base = 16px:
─────────────────────────────────────────────
  Heading 1:    16 × 1.333⁵ = ~42px  → round → 42px
  Heading 2:    16 × 1.333⁴ = ~32px  → round → 32px
  Heading 3:    16 × 1.333³ = ~24px  → round → 24px
  Heading 4:    16 × 1.333² = ~18px  → round → 18px
  Heading 5:    16 × 1.333¹ = ~21px  → round → 20px
  Body Large:   18px (manual)
  Body 1:       16px (base)
  Body Small:   14px
  Caption:      12px
  Line-height:  1.5 × size (auto-calculated)
```

---

## MODULE D — Content & Localization

> **Thị trường mục tiêu:** Malaysia (EN + BM + ZH)

### D.1 Text Limitation Rules

| Element | Giới hạn | Hành vi khi vượt |
|---------|----------|-----------------|
| Button / CTA | Tối đa **5 từ** | 🔴 Block + "CTA quá dài — tối đa 5 từ" |
| Hero Heading | Tối đa **12 từ** | 🔴 Block + "Hero Heading quá dài — tối đa 12 từ" |
| Card Title | Tối đa **8 từ** | 🟡 Warning |
| Meta Description | Tối đa **160 ký tự** | 🟡 Warning |

```
RULE: Báo lỗi REAL-TIME (onChange), không chờ Save

Display format:
  [Button text field] "Book Now Free Consultation Today Extra Words"
  → 🔴 "7/5 từ — Vượt giới hạn CTA. Gợi ý: 'Book Free Consultation'"
```

### D.2 Banned Phrases & Tone of Voice

```
RULE: Quét toàn bộ Block content, cảnh báo khi phát hiện

Categories:
  1. Banned phrases: danh sách do admin cấu hình
  2. Tone violations:
     - Quá suồng sã: "bro", "chill", "nah", v.v.
     - Từ địa phương không chuẩn cho thị trường Malaysia
     - Ngôn ngữ phân biệt, nhạy cảm

Output:
  🟡 "Tone Warning: '{phrase}' có thể không phù hợp với Tone of Voice thương hiệu.
      Gợi ý thay thế: '{suggested_phrase}'"
```

---

## MODULE E — Layout & Structural Integrity

### E.1 Dependency Shield

```
RULE: Component Disabled → BLOCK mọi Block chứa component đó

Trigger: User cố gắng add Block vào page khi dependency component = Disabled

IF component.status == 'Disabled':
    BLOCK block generation
    SHOW MODAL:
    ┌─────────────────────────────────────────────┐
    │  🚨 Critical Error: Dependency Component    │
    │     is Disabled                             │
    │                                             │
    │  Component: Primary Button                  │
    │  Status:    Disabled                        │
    │                                             │
    │  Không thể generate Block chứa component    │
    │  đang bị vô hiệu hóa.                       │
    │                                             │
    │  [Kích hoạt Component]  [Hủy]               │
    └─────────────────────────────────────────────┘
```

### E.2 Template Structure — Landing Page Validation

```
RULE: Landing Page bắt buộc có đủ 3 sections trước khi "Push to CMS"

Required sections:
  ✅ Hero     (≥ 1 block)
  ✅ Feature  (≥ 1 block)
  ✅ Footer   (≥ 1 block)

IF missing ANY required section:
    DISABLE "Push to CMS" button
    SHOW:
    "⛔ Template Incomplete:
     Thiếu: {missing_sections}
     Landing Page yêu cầu ít nhất: 1 Hero + 1 Feature + 1 Footer."
```

---

## MODULE F — Live Rules Validation Dashboard

> Đây là giao diện tập trung hiển thị tất cả vi phạm theo thời gian thực.

### F.1 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  AI Rules Validation                          🔄 Live  ●        │
├────────────────┬────────────────────────────────────────────────┤
│                │                                                │
│  INDUSTRY      │  VALIDATION RESULTS                            │
│  CONTEXT       │                                                │
│  ──────────    │  ┌──────────────────────────────────────────┐  │
│  [ Y tế ▼ ]   │  │ 🔴 CRITICAL (2)                          │  │
│                │  │   • --color-primary: Red đậm — Off-brand  │  │
│  ──────────    │  │   • Primary Button: Component Disabled    │  │
│  RULES ACTIVE  │  ├──────────────────────────────────────────┤  │
│  ──────────    │  │ 🟡 WARNING (3)                           │  │
│  ✅ Contrast   │  │   • --color-accent: Saturation 100%       │  │
│  ✅ Theme Map  │  │   • Hero text: font-weight 300            │  │
│  ✅ Font Sync  │  │   • CTA "Get Started Now Free": 5→4 words │  │
│  ✅ Scale      │  ├──────────────────────────────────────────┤  │
│  ✅ Text Limit │  │ 🟢 PASSED (12)                           │  │
│  ✅ Dependency │  │   • WCAG AA: 12/12 color pairs pass       │  │
│  ✅ Structure  │  │   • Dark Mode pairs: All complete         │  │
│                │  │   • Template: Hero ✓ Feature ✓ Footer ✓  │  │
│                │  └──────────────────────────────────────────┘  │
│                │                                                │
│                │  [Export Validation Report]  [Auto-fix All]    │
└────────────────┴────────────────────────────────────────────────┘
```

### F.2 Real-time Update Logic

```
Trigger events → re-run validation:
  - onChange (any Design Token field)
  - onBlockAdd / onBlockRemove
  - onIndustryChange (dropdown)
  - onComponentStatusChange
  - onFontChange (--font-primary)
  - onContentEdit (any text field in Blocks)

Debounce: 300ms sau lần input cuối (tránh lag khi typing)
```

### F.3 Validation Rule Registry

| Rule ID | Module | Severity | Auto-fix |
|---------|--------|----------|----------|
| `RULE-A1` | Industry Color | 🔴 Critical | ❌ Manual |
| `RULE-A2` | Saturation Guard | 🟡 Warning | ✅ Auto |
| `RULE-A3` | Industry Suggest | ℹ️ Info | ✅ Auto |
| `RULE-B1` | WCAG AA Contrast | 🔴 Critical | ✅ Auto |
| `RULE-B2` | Theme Mapping | 🔴 Critical | ✅ Auto |
| `RULE-B3` | Font Weight | 🟡 Warning | ✅ Auto |
| `RULE-C1` | Font Sync | ℹ️ Info | ✅ Auto |
| `RULE-C2` | Type Scale | ℹ️ Info | ✅ Auto |
| `RULE-D1` | Text Limit | 🔴 Critical | ❌ Manual |
| `RULE-D2` | Banned Phrases | 🟡 Warning | ❌ Manual |
| `RULE-E1` | Dependency Shield | 🔴 Critical | ❌ Manual |
| `RULE-E2` | Template Structure | 🔴 Critical | ❌ Manual |

### F.4 Auto-fix Behavior

```
[Auto-fix All] button:
  → Chỉ áp dụng các rule có Auto-fix = ✅
  → KHÔNG tự động sửa text content (D1, D2) — cần human review
  → KHÔNG tự động enable Disabled components (E1)
  → Hiển thị summary: "Auto-fixed 5 issues. 3 issues require manual review."
```

---

## Phụ lục — Integration Notes

### Vị trí implement trong codebase

| Rule Module | File đề xuất |
|-------------|-------------|
| Industry Color Logic | `src/lib/ai/rules/industry-color.ts` |
| Contrast Guardrail | `src/lib/ai/rules/accessibility.ts` |
| Font Sync & Scale | `src/lib/ai/rules/typography.ts` |
| Content Limits | `src/lib/ai/rules/content-validation.ts` |
| Dependency Shield | `src/lib/ai/rules/layout-integrity.ts` |
| Live Dashboard | `src/components/editor/RulesValidationPanel.tsx` |
| Rule Registry | `src/lib/ai/rules/registry.ts` |

### Trạng thái Implementation

| Module | Thiết kế | Code | QA |
|--------|----------|------|----|
| A — Industry Color | ✅ Done | ⬜ Pending | ⬜ Pending |
| B — Accessibility | ✅ Done | ⬜ Pending | ⬜ Pending |
| C — Typography | ✅ Done | ⬜ Pending | ⬜ Pending |
| D — Content | ✅ Done | ⬜ Pending | ⬜ Pending |
| E — Layout | ✅ Done | ⬜ Pending | ⬜ Pending |
| F — Dashboard | ✅ Done | ⬜ Pending | ⬜ Pending |
