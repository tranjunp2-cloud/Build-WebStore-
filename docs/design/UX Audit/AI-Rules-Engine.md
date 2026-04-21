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

### A.1 Industry Registry — 8 ngành chuẩn

| ID | Ngành | Sub-categories |
|----|-------|---------------|
| `fnb` | 🍕 F&B | Nhà hàng / Cafe / Ẩm thực |
| `ecommerce` | 🛍️ Ecommerce | Bán lẻ / Thời trang / Shop online |
| `tech` | 💻 Tech | Công nghệ / IT / SaaS |
| `healthcare` | 🏥 Healthcare | Y tế / Nha khoa / Phòng khám |
| `realestate` | 🏠 Real Estate | Bất động sản |
| `service` | 💼 Service | Freelancer / Agency / Portfolio cá nhân |
| `education` | 🎓 Education | Giáo dục / Đào tạo |
| `fitness` | 🏋️ Fitness | Gym / Thể hình / Yoga |

---

### A.2 Industry Mapping — Palette chi tiết theo ngành

---

#### 🍕 F&B — Nhà hàng / Cafe / Ẩm thực

> **Tâm lý màu sắc:** Kích thích vị giác, tạo cảm giác ấm áp và mời gọi. Màu ấm (Red, Orange, Yellow) được chứng minh kích thích sự thèm ăn.

| Token | Light Mode | Dark Mode | Ghi chú |
|-------|-----------|-----------|---------|
| Primary | `#E53935` Red 600 | `#EF5350` Red 400 | Nhà hàng / Ẩm thực đặc sắc |
| Primary Alt | `#FF6D00` Deep Orange | `#FF8A50` | Cafe / Fast food |
| Primary Alt | `#388E3C` Green 700 | `#66BB6A` | Organic / Healthy food |
| Secondary | `#FFC107` Amber 500 | `#FFD54F` | Điểm nhấn ấm, kích thích |
| CTA / Button | `#FF6D00` Deep Orange | `#FF8A50` | Urgency + Appetite |
| Background | `#FFFDE7` Cream | `#1A1208` Dark warm | Ấm áp, không gây mỏi mắt |
| Neutral text | `#3E2723` Brown 900 | `#EFEBE9` | Gần với màu gỗ/đất |

**Avoided:** `#B0BEC5` (Cold Grey), `#78909C` (Blue Grey) — màu lạnh làm giảm cảm giác ngon miệng.

**Sub-type rules:**
```
IF sub_type == 'cafe':    primary = #FF6D00 (Warm Orange) + #795548 (Coffee Brown)
IF sub_type == 'organic': primary = #388E3C (Forest Green) + #8D6E63 (Earth Brown)
IF sub_type == 'fine_dining': primary = #212121 (Black) + #B8860B (Dark Gold)
```

---

#### 🛍️ Ecommerce — Bán lẻ / Thời trang / Shop online

> **Tâm lý màu sắc:** Tạo cảm giác muốn mua, kết hợp tin cậy (Blue) với urgency (Orange/Red). Thời trang thiên về aesthetic và identity thương hiệu.

| Token | Light Mode | Dark Mode | Ghi chú |
|-------|-----------|-----------|---------|
| Primary | `#1565C0` Blue 800 | `#42A5F5` Blue 400 | Trust — bán lẻ tổng hợp |
| Primary Alt | `#212121` Near Black | `#EEEEEE` | Fashion / Luxury |
| Secondary | `#F8BBD0` Pink 100 | `#F48FB1` Pink 300 | Fashion feminine |
| CTA / Button | `#FF6D00` Deep Orange | `#FF8A50` | Sale / Urgency |
| CTA Alt | `#D32F2F` Red 700 | `#EF5350` | Flash sale, countdown |
| Badge/Sale | `#C62828` Red 800 | `#EF9A9A` | Discount tag |
| Background | `#FFFFFF` hoặc `#F5F5F5` | `#121212` | Clean, product-focused |
| Neutral | `#757575` Grey 600 | `#9E9E9E` | |

**Sub-type rules:**
```
IF sub_type == 'fashion_luxury': primary = #212121 + #B8860B (Gold), no bright Orange CTA
IF sub_type == 'fashion_casual': primary = #E91E63 (Pink) + #FF6D00, high-energy
IF sub_type == 'retail_general': primary = #1565C0, CTA = #FF6D00
```

---

#### 💻 Tech — Công nghệ / IT / SaaS

> **Tâm lý màu sắc:** Tin cậy, chuyên nghiệp, đổi mới. Blue và Indigo truyền đạt sự ổn định và công nghệ. Purple gợi sự sáng tạo và AI/innovation.

| Token | Light Mode | Dark Mode | Ghi chú |
|-------|-----------|-----------|---------|
| Primary | `#1565C0` Blue 800 | `#42A5F5` Blue 400 | Classic SaaS trust |
| Primary Alt | `#3949AB` Indigo 600 | `#7986CB` Indigo 300 | Modern / Developer tool |
| Primary Alt | `#6A1B9A` Purple 900 | `#CE93D8` Purple 200 | AI / Creative Tech |
| Secondary | `#00897B` Teal 600 | `#4DB6AC` Teal 300 | Success states, highlights |
| CTA / Button | `#1E88E5` Blue 600 | `#64B5F6` | Primary action |
| Accent | `#7C4DFF` Deep Purple A200 | `#B388FF` | Feature badges, tags |
| Background | `#FAFAFA` | `#0D1117` GitHub-style | |
| Code/Mono bg | `#F5F5F5` | `#161B22` | |

**Avoided:** `#E53935` Red làm primary (dùng cho Error state only), màu quá ấm làm mất cảm giác tech.

**Saturation rule:** Giữ saturation ≤ 85% để tránh gây mỏi mắt khi dùng nhiều giờ.

---

#### 🏥 Healthcare — Y tế / Nha khoa / Phòng khám

> **Tâm lý màu sắc:** Sạch sẽ, an toàn, đáng tin. Teal và Light Blue tạo cảm giác vô trùng và chuyên nghiệp y tế. Tránh Red đậm (liên tưởng nguy hiểm/máu).

| Token | Light Mode | Dark Mode | Ghi chú |
|-------|-----------|-----------|---------|
| Primary | `#00897B` Teal 600 | `#4DB6AC` Teal 300 | Y tế tổng quát |
| Primary Alt | `#039BE5` Light Blue 600 | `#4FC3F7` | Nha khoa, phòng khám |
| Secondary | `#A5D6A7` Light Green | `#66BB6A` | Recovery, wellness |
| CTA / Button | `#00796B` Teal 700 | `#26A69A` | Đặt lịch, tư vấn |
| Alert/Error | `#FF8A65` Deep Orange 300 | `#FF7043` | Thay thế Red cho cảnh báo |
| Background | `#FFFFFF` hoặc `#E0F7FA` | `#0A1929` | Trắng tinh / xanh lạnh nhạt |
| Neutral | `#546E7A` Blue Grey | `#90A4AE` | |

**Avoided:** `#B71C1C` (Dark Red), `#D32F2F` (Red) — gây liên tưởng đến máu, nguy hiểm.

**Saturation rule:** `saturation <= 70%` — màu quá saturate gây cảm giác kém chuyên nghiệp trong y tế.

---

#### 🏠 Real Estate — Bất động sản

> **Tâm lý màu sắc:** Sang trọng, ổn định, giá trị lâu dài. Navy và Gold truyền đạt đẳng cấp và sự thịnh vượng. Earth tones gợi sự gắn bó với đất đai, tổ ấm.

| Token | Light Mode | Dark Mode | Ghi chú |
|-------|-----------|-----------|---------|
| Primary | `#1A237E` Indigo 900 (Navy) | `#5C6BC0` Indigo 400 | Sang trọng, tin cậy |
| Primary Alt | `#F9A825` Amber 800 (Gold) | `#FFD54F` | Premium / Luxury RE |
| Secondary | `#37474F` Blue Grey 700 | `#78909C` | Neutral authority |
| CTA / Button | `#F9A825` Gold | `#FFD54F` | Premium feel |
| CTA Alt | `#2E7D32` Green 800 | `#66BB6A` | Eco / Green building |
| Accent | `#5D4037` Brown 700 | `#8D6E63` | Earth / Land feel |
| Background | `#FAFAFA` hoặc `#EFEBE9` | `#0A0E1A` Dark Navy | |
| Neutral | `#455A64` Blue Grey | `#90A4AE` | |

**Avoided:** Màu neon, gradient phức tạp, màu quá playful — gây mất cảm giác đáng tin về tài sản giá trị lớn.

**Saturation rule:** `saturation <= 80%` — palette phải mang tính ổn định, không flashy.

---

#### 💼 Service — Freelancer / Agency / Portfolio

> **Tâm lý màu sắc:** Chuyên nghiệp nhưng có cá tính. Agency thường dùng Dark + 1 bold accent để thể hiện sự sáng tạo. Freelancer có thể dùng personal brand color.

| Token | Light Mode | Dark Mode | Ghi chú |
|-------|-----------|-----------|---------|
| Primary | `#37474F` Blue Grey 700 | `#ECEFF1` | Professional neutral |
| Primary Alt | `#4527A0` Deep Purple 900 | `#9575CD` | Creative Agency |
| Primary Alt | `#1A237E` Navy | `#5C6BC0` | Corporate Service |
| Secondary | `#ECEFF1` Blue Grey 50 | `#263238` | |
| CTA / Button | `#FF6F00` Amber 900 | `#FFB300` | Stand out, confident |
| CTA Alt | `#00BFA5` Teal A700 | `#64FFDA` | Modern Agency |
| Accent (Pop) | Brand-specific bright | | 1 bold pop color |
| Background | `#FFFFFF` hoặc `#FAFAFA` | `#1C1C1E` | |
| Neutral | `#616161` Grey | `#9E9E9E` | |

**Rule:** Agency portfolio được phép dùng 1 unexpected accent color (ví dụ: Electric Yellow `#FFEA00`, Hot Pink `#E91E63`) để tạo impression. Tuy nhiên phải đảm bảo WCAG AA.

---

#### 🎓 Education — Giáo dục / Đào tạo

> **Tâm lý màu sắc:** Hài hòa, tập trung, truyền cảm hứng học tập. Blue và Green hỗ trợ nhận thức và ghi nhớ. Yellow tạo sự lạc quan và năng lượng.

| Token | Light Mode | Dark Mode | Ghi chú |
|-------|-----------|-----------|---------|
| Primary | `#1565C0` Blue 800 | `#42A5F5` Blue 400 | Tin cậy, học thuật |
| Primary Alt | `#6A1B9A` Purple 900 | `#CE93D8` | Creative Education |
| Secondary | `#FBC02D` Yellow 700 | `#FFD54F` | Optimism, energy |
| CTA / Button | `#1976D2` Blue 700 | `#64B5F6` | Enroll, Start Learning |
| Accent | `#43A047` Green 600 | `#81C784` | Growth, progress |
| Background | `#FAFAFA` hoặc `#E3F2FD` | `#0D1321` | Light, không gây mỏi mắt |
| Neutral | `#546E7A` | `#90A4AE` | |

**Contrast rule:** Luôn dùng analogous hoặc triadic palette — tránh complementary pairs có delta_hue < 30° gây căng thẳng thị giác khi học dài giờ.

**Saturation rule:** `saturation <= 80%` — màu hài hòa, không gây phân tâm.

---

#### 🏋️ Fitness — Gym / Thể hình / Yoga

> **Tâm lý màu sắc:** Năng lượng, sức mạnh, thúc đẩy hành động (Gym). Hoặc cân bằng, thư thái, kết nối cơ thể-tâm trí (Yoga). Hai sub-type có palette hoàn toàn khác nhau.

| Token | Gym (Light) | Gym (Dark) | Yoga (Light) | Yoga (Dark) |
|-------|------------|------------|-------------|------------|
| Primary | `#D32F2F` Red 700 | `#EF5350` | `#00695C` Teal 800 | `#4DB6AC` |
| Secondary | `#212121` Black | `#424242` | `#558B2F` Lt Green 800 | `#AED581` |
| CTA | `#FF6D00` Orange | `#FF8A50` | `#00796B` Teal 700 | `#26A69A` |
| Accent | `#FFD600` Yellow | `#FFFF00` | `#EDE7F6` Lavender | `#7E57C2` |
| Background | `#FAFAFA` / `#FFEBEE` | `#0D0D0D` | `#F9FBE7` | `#0A1A15` |
| Neutral | `#424242` | `#9E9E9E` | `#5D4037` | `#A1887F` |

**Sub-type rules:**
```
IF sub_type == 'gym':
    primary = #D32F2F + #212121
    ALLOW high_contrast = true (energy, bold)
    PREFER high saturation (85-100%)

IF sub_type == 'yoga' OR sub_type == 'wellness':
    primary = #00695C + #558B2F
    REQUIRE harmony_score >= 0.75 (calming)
    AVOID high-contrast harsh pairs
    saturation <= 75%

IF sub_type == 'sport_general':
    primary = #FF6D00 + #212121 (energetic but versatile)
```

---

### A.3 Mood & Vibration Rules (toàn bộ 8 ngành)

#### Saturation Guardrail
```
Ngưỡng saturation tối đa theo ngành:

  healthcare:  <= 70%   (sterile, professional)
  realestate:  <= 80%   (stable, trustworthy)
  education:   <= 80%   (calm, focused)
  tech:        <= 85%   (modern but not eye-straining)
  service:     <= 90%   (flexible, brand-dependent)
  fnb:         <= 100%  (appetite-stimulating)
  ecommerce:   <= 100%  (brand-dependent, CTA can be full saturation)
  fitness_gym: <= 100%  (high-energy intentional)
  fitness_yoga:<= 75%   (calm, grounding)

IF saturation > threshold[industry]:
    FLAG: "⚠️ Saturation {value}% vượt ngưỡng {threshold}% cho ngành {industry}"
    SUGGEST: auto_desaturate(color, target=threshold - 10%)
```

#### Contrast by Industry
```
fitness_gym, ecommerce:
    ALLOW high_contrast_pairs = true
    PREFER contrast_ratio >= 7:1 (AAA) khi muốn bold impact

education, healthcare, fitness_yoga:
    REQUIRE color_harmony_score >= 0.7
    AVOID complementary_pairs with delta_hue in [150°, 210°] (too harsh)
    PREFER analogous (±30°) or triadic palettes

realestate, service:
    AVOID overly complex gradients (> 3 color stops)
    PREFER flat color or subtle 2-stop gradients

fnb:
    REQUIRE warm_bias = true (hue in [0°, 60°] or [300°, 360°])
    AVOID cool neutrals (hue [180°, 240°]) làm primary
```

#### CTA Color Logic
```
Mọi ngành: CTA button phải đạt contrast >= 4.5:1 với label text

Recommended CTA hex theo ngành:
  fnb:        #FF6D00  (Deep Orange — appetite + urgency)
  ecommerce:  #FF6D00  (urgency) hoặc brand primary
  tech:       #1E88E5  (Blue — trusted action)
  healthcare: #00796B  (Teal — safe, proceed)
  realestate: #F9A825  (Gold — premium value)
  service:    #FF6F00  (Amber — confident, stand out)
  education:  #1976D2  (Blue — enroll, start)
  fitness_gym:#FF6D00  (Orange — energy, now)
  fitness_yoga:#00796B (Teal — begin, flow)
```

---

### A.4 AI Industry Smart Suggest

**Trigger:** Người dùng nhập mô tả doanh nghiệp dạng tự do.

**Quy trình xử lý:**
```
1. NLP classify → map to industry ID + sub_type
2. Load palette rules cho industry đó
3. Generate 5 Color Tokens: primary, secondary, cta, background, neutral
4. Generate Color Pair: Light Mode + Dark Mode cho mỗi token
5. Validate WCAG AA (contrast ≥ 4.5:1) cho mọi cặp text/bg
6. Output với giải thích lý do chọn màu
```

**Ví dụ — "Spa cho mẹ và bé tại Malaysia":**
```
📦 Suggested Palette — "Spa cho mẹ và bé"
  → Classified: Healthcare (Wellness) + Ecommerce (Beauty)
─────────────────────────────────────────────────────────
Token        Light Mode    Dark Mode     Lý do
─────────────────────────────────────────────────────────
Primary      #00897B       #4DB6AC       Teal: sức khỏe, sạch sẽ, an toàn
Secondary    #F8BBD0       #F48FB1       Soft Pink: nhẹ nhàng, dịu dàng cho mẹ & bé
CTA          #00796B       #26A69A       Teal đậm: hành động rõ ràng, không aggressive
Background   #FAFAFA       #0A1929       Trắng tinh / Navy tối
Neutral      #546E7A       #90A4AE       Blue Grey: chuyên nghiệp, không lạnh

✅ Contrast Check (WCAG AA ≥ 4.5:1):
   Body text (#37474F) on #FAFAFA:    8.6:1  ✅ AA Pass
   CTA label (#FFFFFF) on #00796B:    5.3:1  ✅ AA Pass
   Dark: text (#E0F7FA) on #0A1929:   7.1:1  ✅ AA Pass

💡 Lý do chọn màu:
   • Teal (Healthcare) → sạch sẽ, an toàn, đặc trưng spa y tế
   • Soft Pink (Wellness/Beauty) → nhẹ nhàng, phù hợp đối tượng mẹ & bé
   • Không dùng Red/Orange → tránh liên tưởng mạnh/kích thích không phù hợp spa
   • Palette phù hợp thị trường Malaysia: trung tính về văn hóa,
     không thiên lệch tone màu nhạy cảm
   • Saturation: 65% (trong ngưỡng Healthcare ≤ 70%)
```

**Ví dụ — "Gym cho dân văn phòng tại KL":**
```
📦 Suggested Palette — "Gym văn phòng"
  → Classified: Fitness (Gym) + Service (Urban Professional)
────────────────────────────────────────────────────────────
Token        Light Mode    Dark Mode     Lý do
────────────────────────────────────────────────────────────
Primary      #D32F2F       #EF5350       Red: năng lượng, thúc đẩy hành động
Secondary    #212121       #424242       Black: mạnh mẽ, premium gym
CTA          #FF6D00       #FF8A50       Orange: urgency, join now
Accent       #FFD600       #FFFF00       Yellow: highlight, achievement
Background   #FAFAFA       #0D0D0D       Sáng / Tối tuyệt đối

✅ Saturation Check: Red #D32F2F = 73% (Gym cho phép 100%, ✅ OK)
```

---

### A.5 Dashboard — Industry Context Dropdown

```
UI Component: <IndustryContextDropdown />
──────────────────────────────────────────
Options:
  [ ] 🍕 F&B — Nhà hàng / Cafe / Ẩm thực
  [ ] 🛍️ Ecommerce — Bán lẻ / Thời trang / Shop online
  [ ] 💻 Tech — Công nghệ / IT / SaaS
  [ ] 🏥 Healthcare — Y tế / Nha khoa / Phòng khám
  [ ] 🏠 Real Estate — Bất động sản
  [ ] 💼 Service — Freelancer / Agency / Portfolio
  [ ] 🎓 Education — Giáo dục / Đào tạo
  [ ] 🏋️ Fitness — Gym / Thể hình / Yoga
  [ ] ❓ Khác

Khi chọn ngành:
  → Scan toàn bộ Design Tokens hiện tại
  → So sánh với palette rules của ngành đó
  → Flag từng token với badge:
     🔴 Off-brand      — vi phạm rõ ràng (VD: Red primary trong Healthcare)
     🟡 Cần xem xét   — vượt ngưỡng saturation, hoặc ngoài palette khuyến nghị
     🟢 Phù hợp       — nằm trong palette rules
```

**Ví dụ output khi chọn "🏥 Healthcare":**

| Token | Hex hiện tại | Trạng thái | Lý do |
|-------|-------------|------------|-------|
| `--color-primary` | `#E53935` Red 600 | 🔴 Off-brand | Red đậm — liên tưởng nguy hiểm/máu |
| `--color-accent` | `#FF6D00` Deep Orange | 🟡 Cần xem xét | Saturation 100% > ngưỡng 70% |
| `--color-cta` | `#FF6D00` Deep Orange | 🟡 Cần xem xét | Nên dùng Teal (#00796B) cho Healthcare |
| `--color-secondary` | `#4DB6AC` Teal 300 | 🟢 Phù hợp | Nằm trong palette Healthcare |
| `--color-background` | `#FAFAFA` | 🟢 Phù hợp | Clean white — chuẩn y tế |

**Ví dụ output khi chọn "🍕 F&B":**

| Token | Hex hiện tại | Trạng thái | Lý do |
|-------|-------------|------------|-------|
| `--color-primary` | `#1565C0` Blue 800 | 🔴 Off-brand | Cold Blue — giảm cảm giác ngon miệng |
| `--color-secondary` | `#78909C` Blue Grey | 🔴 Off-brand | Màu lạnh trung tính — không phù hợp F&B |
| `--color-cta` | `#FF6D00` Deep Orange | 🟢 Phù hợp | Warm Orange — kích thích, urgency |

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
