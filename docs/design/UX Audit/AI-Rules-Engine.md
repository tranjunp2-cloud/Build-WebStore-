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

### A.2 Industry Mapping — Color Pool & Palette Themes

> **Cách AI dùng section này:**
> 1. Xác định `industry` + `sub_type` từ user input
> 2. Lấy toàn bộ **Approved Color Pool** làm vùng màu hợp lệ
> 3. Chọn 1 trong các **Palette Themes** làm bộ khởi điểm
> 4. Điều chỉnh theo brand keyword nếu user cung cấp
> 5. Validate WCAG AA + Saturation Guardrail trước khi output

---

#### 🍕 F&B — Nhà hàng / Cafe / Ẩm thực

> **Tâm lý:** Màu ấm kích thích vị giác và sự thèm ăn. Màu lạnh (Blue, Grey) bị chứng minh là làm giảm cảm giác ngon miệng — tránh dùng làm primary.

**Approved Color Pool:**

| Nhóm | Hex options | Vai trò |
|------|------------|---------|
| Reds | `#C62828` `#D32F2F` `#E53935` `#EF5350` `#EF9A9A` | Primary — nhà hàng đặc sắc |
| Deep Oranges | `#E65100` `#EF6C00` `#F57C00` `#FF6D00` `#FF8F00` | Primary/CTA — cafe, fast food |
| Ambers | `#FF8F00` `#FFA000` `#FFB300` `#FFC107` `#FFD54F` | Secondary — ấm áp, kích thích |
| Yellows | `#F57F17` `#F9A825` `#FBC02D` `#FDD835` `#FFEE58` | Accent — highlight |
| Organic Greens | `#1B5E20` `#2E7D32` `#388E3C` `#43A047` `#558B2F` `#689F38` | Primary — healthy/organic |
| Earth Browns | `#3E2723` `#4E342E` `#5D4037` `#6D4C41` `#795548` `#8D6E63` `#A1887F` | Neutral — gỗ, đất, cà phê |
| Warm Backgrounds | `#FFF8E1` `#FFFDE7` `#FFF9C4` `#FFECB3` `#FAF0E6` | Background light |
| Dark Warm Bgs | `#1A1208` `#1C1005` `#2C1810` `#3E2723` | Background dark |

**Avoided:** `#B0BEC5` `#78909C` `#607D8B` (Cold Blue-Grey) — giảm cảm giác ngon miệng.

**Palette Themes (AI chọn 1):**

| Theme | Primary | Secondary | CTA | Background | Mood |
|-------|---------|-----------|-----|------------|------|
| 🍝 Bistro Classic | `#E53935` | `#FFC107` | `#FF6D00` | `#FFFDE7` | Ấm, quen thuộc |
| ☕ Cafe Artisan | `#795548` | `#FF8F00` | `#EF6C00` | `#FFF8E1` | Cozy, craft |
| 🥗 Fresh Organic | `#388E3C` | `#8D6E63` | `#43A047` | `#F9FBE7` | Tươi sạch, tự nhiên |
| 🍽️ Fine Dining | `#212121` | `#B8860B` | `#C8961C` | `#FAF0E6` | Sang trọng, tối giản |
| 🌮 Street Food | `#FF6D00` | `#FDD835` | `#E65100` | `#FFFFFF` | Năng động, vui vẻ |
| 🍜 Asian Fusion | `#C62828` | `#FFD600` | `#D32F2F` | `#212121` | Đậm đà, bản sắc |

**Sub-type quick map:**
```
cafe        → Theme "Cafe Artisan"  hoặc "Street Food"
fine_dining → Theme "Fine Dining"   hoặc "Bistro Classic"
organic     → Theme "Fresh Organic"
fast_food   → Theme "Street Food"   hoặc "Asian Fusion"
asian       → Theme "Asian Fusion"  hoặc "Bistro Classic"
```

---

#### 🛍️ Ecommerce — Bán lẻ / Thời trang / Shop online

> **Tâm lý:** Trust (Blue) kết hợp Urgency (Orange/Red) thúc đẩy mua hàng. Fashion ưu tiên identity brand — cho phép palette đặc sắc hơn.

**Approved Color Pool:**

| Nhóm | Hex options | Vai trò |
|------|------------|---------|
| Trust Blues | `#0D47A1` `#1565C0` `#1976D2` `#1E88E5` `#2196F3` `#42A5F5` | Primary — bán lẻ tin cậy |
| Fashion Blacks | `#000000` `#121212` `#1C1C1E` `#212121` `#424242` | Primary — luxury, streetwear |
| Fashion Pinks | `#880E4F` `#AD1457` `#C2185B` `#E91E63` `#F06292` `#F48FB1` `#F8BBD0` | Secondary — feminine |
| Luxury Purples | `#4A148C` `#6A1B9A` `#7B1FA2` `#9C27B0` `#AB47BC` `#CE93D8` | Primary/Accent — premium |
| Urgency Oranges | `#BF360C` `#D84315` `#E64A19` `#FF3D00` `#FF5722` `#FF6D00` | CTA — sale, urgency |
| Premium Golds | `#827717` `#9E8E00` `#B8860B` `#DAA520` `#FFD700` `#F9A825` | Accent — luxury feel |
| Greens (eco) | `#1B5E20` `#2E7D32` `#388E3C` `#43A047` `#4CAF50` | Accent — sustainable brand |
| Neutrals | `#FAFAFA` `#F5F5F5` `#EEEEEE` `#BDBDBD` `#757575` `#9E9E9E` | Background, text |
| Dark Bgs | `#121212` `#1C1C1E` `#212121` `#000000` | Background dark mode |

**Palette Themes (AI chọn 1):**

| Theme | Primary | Secondary | CTA | Background | Mood |
|-------|---------|-----------|-----|------------|------|
| 👑 Fashion Luxury | `#212121` | `#B8860B` Gold | `#DAA520` | `#FAF0E6` | Sang trọng, tối giản |
| 💗 Fashion Feminine | `#E91E63` | `#F8BBD0` | `#C2185B` | `#FFF0F5` | Ngọt ngào, nữ tính |
| 🖤 Streetwear Bold | `#212121` | `#FF3D00` | `#FF5722` | `#FFFFFF` | Cá tính, mạnh mẽ |
| 🌸 Pastel Cute | `#CE93D8` | `#F48FB1` | `#AB47BC` | `#FFF8E1` | Dễ thương, trendy |
| 🛒 Retail General | `#1565C0` | `#FF6D00` | `#FF6D00` | `#FFFFFF` | Tin cậy + urgency |
| 🌿 Eco Conscious | `#2E7D32` | `#DAA520` | `#388E3C` | `#F9FBE7` | Bền vững, tự nhiên |
| 🎭 Vintage Boutique | `#4E342E` | `#DAA520` | `#6D4C41` | `#FAF0E6` | Cổ điển, vintage |

**Sub-type quick map:**
```
fashion_luxury   → Theme "Fashion Luxury"   hoặc "Vintage Boutique"
fashion_casual   → Theme "Fashion Feminine" hoặc "Pastel Cute"
streetwear       → Theme "Streetwear Bold"
retail_general   → Theme "Retail General"
eco_sustainable  → Theme "Eco Conscious"
kids_toys        → Theme "Pastel Cute"
```

---

#### 💻 Tech — Công nghệ / IT / SaaS

> **Tâm lý:** Blue = tin cậy & ổn định. Indigo = hiện đại. Purple = AI/innovation. Dark mode là first-class citizen cho developer tools.

**Approved Color Pool:**

| Nhóm | Hex options | Vai trò |
|------|------------|---------|
| Blues | `#0D47A1` `#1565C0` `#1976D2` `#1E88E5` `#2196F3` `#42A5F5` `#64B5F6` `#90CAF9` | Primary — SaaS classic |
| Indigos | `#1A237E` `#283593` `#3949AB` `#3F51B5` `#5C6BC0` `#7986CB` `#9FA8DA` | Primary — modern dev |
| Purples | `#4527A0` `#512DA8` `#5E35B1` `#673AB7` `#7E57C2` `#9575CD` `#B39DDB` | Primary — AI, creative |
| Teals | `#004D40` `#00695C` `#00796B` `#00897B` `#26A69A` `#4DB6AC` | Secondary — success, growth |
| Cyans | `#006064` `#00838F` `#00ACC1` `#00BCD4` `#26C6DA` `#4DD0E1` | Accent — modern, fresh |
| Neon Accents | `#651FFF` `#7C4DFF` `#AA00FF` `#00E5FF` `#1DE9B6` | Accent — AI/futuristic |
| Light Bgs | `#FAFAFA` `#F8FBFF` `#EEF2FF` `#E8EAF6` `#E3F2FD` | Background light |
| Dark Bgs | `#0D1117` `#161B22` `#1C2128` `#0D0D1A` `#0A0E27` | Background dark |

**Palette Themes (AI chọn 1):**

| Theme | Primary | Secondary | CTA | Background | Mood |
|-------|---------|-----------|-----|------------|------|
| 🏢 Classic SaaS | `#1565C0` | `#00897B` | `#1E88E5` | `#FAFAFA` | Tin cậy, enterprise |
| 🌑 Developer Dark | `#3949AB` | `#00BCD4` | `#42A5F5` | `#0D1117` | Hacker, focused |
| 🤖 AI Purple | `#6A1B9A` | `#7C4DFF` | `#9575CD` | `#0D0D1A` | Futuristic, AI |
| 🚀 Startup Fresh | `#1E88E5` | `#00ACC1` | `#1976D2` | `#F8FBFF` | Năng động, clean |
| 🏛️ Enterprise Navy | `#1A237E` | `#455A64` | `#3949AB` | `#FAFAFA` | Ổn định, corporate |
| 💚 Open Source | `#2E7D32` | `#37474F` | `#43A047` | `#F9FBE7` | Community, open |
| ⚡ Neon Cyber | `#212121` | `#00E5FF` | `#7C4DFF` | `#0A0A0A` | Edgy, gaming/crypto |

**Sub-type quick map:**
```
saas_b2b       → Theme "Classic SaaS"    hoặc "Enterprise Navy"
developer_tool → Theme "Developer Dark"  hoặc "Open Source"
ai_ml          → Theme "AI Purple"       hoặc "Neon Cyber"
startup        → Theme "Startup Fresh"   hoặc "Classic SaaS"
cybersecurity  → Theme "Neon Cyber"      hoặc "Developer Dark"
fintech        → Theme "Enterprise Navy" hoặc "Classic SaaS"
```

---

#### 🏥 Healthcare — Y tế / Nha khoa / Phòng khám

> **Tâm lý:** Teal/Blue = sạch sẽ, vô trùng, đáng tin. Green = sức khỏe, phục hồi. Lavender = bình tĩnh (mental health). **Tuyệt đối tránh Red đậm.**

**Approved Color Pool:**

| Nhóm | Hex options | Vai trò |
|------|------------|---------|
| Teals | `#004D40` `#00695C` `#00796B` `#00897B` `#009688` `#26A69A` `#4DB6AC` `#80CBC4` | Primary — y tế tổng quát |
| Light Blues | `#01579B` `#0277BD` `#0288D1` `#039BE5` `#03A9F4` `#29B6F6` `#4FC3F7` `#81D4FA` | Primary — nha khoa, phòng khám |
| Mint Greens | `#B2DFDB` `#80CBC4` `#4DB6AC` `#26A69A` `#009688` | Secondary — tươi mát |
| Soft Greens | `#1B5E20` `#2E7D32` `#388E3C` `#43A047` `#66BB6A` `#A5D6A7` `#C8E6C9` | Secondary — sức khỏe, phục hồi |
| Lavenders | `#4527A0` `#7B1FA2` `#AB47BC` `#CE93D8` `#E1BEE7` `#F3E5F5` | Primary — mental health, spa |
| Safe Warm | `#E65100` `#EF6C00` `#FF8A65` `#FFAB40` `#FFD54F` | Alert (thay Red) — cảnh báo |
| Clean Whites | `#FFFFFF` `#FAFAFA` `#F5F5F5` `#E0F7FA` `#E0F2F1` `#E8F5E9` | Background |
| Dark Bgs | `#0A1929` `#001E3C` `#0A2540` `#0D2137` | Background dark |

**Avoided:** `#B71C1C` `#C62828` `#D32F2F` `#E53935` — bất kỳ Red đậm nào.

**Palette Themes (AI chọn 1):**

| Theme | Primary | Secondary | CTA | Background | Mood |
|-------|---------|-----------|-----|------------|------|
| 🏥 Medical Clinical | `#039BE5` | `#4DB6AC` | `#00796B` | `#FFFFFF` | Vô trùng, chuyên nghiệp |
| 🌿 Wellness Spa | `#00897B` | `#A5D6A7` | `#00796B` | `#E0F7FA` | Thư giãn, tự nhiên |
| 🦷 Dental Fresh | `#29B6F6` | `#B2DFDB` | `#0288D1` | `#FAFAFA` | Sạch sẽ, tươi sáng |
| 🧠 Mental Health | `#7B1FA2` | `#4DB6AC` | `#AB47BC` | `#F3E5F5` | Bình tĩnh, an toàn |
| 👶 Pediatric Friendly | `#26C6DA` | `#81C784` | `#00ACC1` | `#FFF9C4` | Thân thiện, vui tươi |
| 💊 Pharmacy Clean | `#1976D2` | `#4DB6AC` | `#1565C0` | `#FFFFFF` | Rõ ràng, đáng tin |

**Sub-type quick map:**
```
general_hospital → Theme "Medical Clinical"
spa_wellness     → Theme "Wellness Spa"
dental           → Theme "Dental Fresh"
mental_health    → Theme "Mental Health"
pediatrics       → Theme "Pediatric Friendly"
pharmacy         → Theme "Pharmacy Clean"
```

---

#### 🏠 Real Estate — Bất động sản

> **Tâm lý:** Navy + Gold = sang trọng & thịnh vượng. Earth tones = gắn bó với đất đai, tổ ấm. Green = eco/tự nhiên. Tránh màu neon hoặc quá playful — làm mất uy tín với tài sản giá trị lớn.

**Approved Color Pool:**

| Nhóm | Hex options | Vai trò |
|------|------------|---------|
| Navys | `#0A0E2A` `#0D1B4B` `#1A237E` `#283593` `#1E3A5F` `#01579B` | Primary — sang trọng, tin cậy |
| Golds | `#7B5F00` `#9E7E00` `#B8860B` `#C8961C` `#DAA520` `#F9A825` `#FFB300` | Secondary/CTA — premium value |
| Eco Greens | `#1B5E20` `#2E7D32` `#33691E` `#388E3C` `#558B2F` `#689F38` | Accent — eco, green living |
| Earth Browns | `#3E2723` `#4E342E` `#5D4037` `#6D4C41` `#795548` `#8D6E63` `#BCAAA4` | Neutral — đất, gỗ, ấm áp |
| Silvers | `#37474F` `#455A64` `#546E7A` `#607D8B` `#78909C` `#90A4AE` `#B0BEC5` | Neutral — hiện đại, đô thị |
| Warm Beiges | `#FAF0E6` `#FFF8E1` `#EFEBE9` `#D7CCC8` `#BCAAA4` | Background — ấm áp |
| Luxury Blacks | `#000000` `#121212` `#1C1C1C` `#212121` | Primary — ultra luxury |
| Ocean Blues | `#01579B` `#0277BD` `#0288D1` `#0D47A1` | Primary — coastal, resort |

**Palette Themes (AI chọn 1):**

| Theme | Primary | Secondary | CTA | Background | Mood |
|-------|---------|-----------|-----|------------|------|
| 👑 Heritage Prestige | `#1A237E` | `#DAA520` | `#F9A825` | `#FAF0E6` | Cổ điển, hoàng gia |
| 🏙️ Modern Luxury | `#212121` | `#B8860B` | `#DAA520` | `#FAFAFA` | Đương đại, tối giản |
| 🌿 Green Living | `#2E7D32` | `#795548` | `#388E3C` | `#F9FBE7` | Eco, tự nhiên |
| 🌊 Coastal Premium | `#01579B` | `#90A4AE` | `#0288D1` | `#FAFAFA` | Resort, biển |
| 🏗️ Urban Contemporary | `#37474F` | `#B0BEC5` | `#546E7A` | `#FFFFFF` | Đô thị, hiện đại |
| 🌴 Tropical Paradise | `#00695C` | `#DAA520` | `#00796B` | `#FFFDE7` | Nhiệt đới, resort |

**Sub-type quick map:**
```
luxury_villa    → Theme "Heritage Prestige" hoặc "Modern Luxury"
apartment       → Theme "Urban Contemporary"
eco_resort      → Theme "Green Living"      hoặc "Tropical Paradise"
beachfront      → Theme "Coastal Premium"   hoặc "Tropical Paradise"
commercial_re   → Theme "Modern Luxury"     hoặc "Urban Contemporary"
```

---

#### 💼 Service — Freelancer / Agency / Portfolio

> **Tâm lý:** Chuyên nghiệp nhưng có cá tính riêng. Agency dùng dark bg + 1 bold accent để tạo impression mạnh. Freelancer linh hoạt theo personal brand. 1 pop color là vũ khí bí mật.

**Approved Color Pool:**

| Nhóm | Hex options | Vai trò |
|------|------------|---------|
| Dark Foundations | `#000000` `#121212` `#1C1C1E` `#212121` `#263238` `#37474F` | Primary dark — creative agency |
| Professional Blues | `#0D47A1` `#1565C0` `#1A237E` `#1976D2` `#283593` | Primary — corporate service |
| Creative Purples | `#1A0533` `#311B92` `#4527A0` `#512DA8` `#6A1B9A` `#7E57C2` `#9575CD` | Primary — creative studio |
| Pop Accents — Yellow | `#FFD600` `#FFEA00` `#FFFF00` `#FDD835` `#F9A825` | Accent — energy, boldness |
| Pop Accents — Pink | `#E91E63` `#F50057` `#FF1744` `#FF4081` `#FF80AB` | Accent — bold, feminine |
| Pop Accents — Cyan | `#00B0FF` `#00BCD4` `#00E5FF` `#1DE9B6` `#64FFDA` | Accent — modern, fresh |
| Pop Accents — Green | `#00C853` `#69F0AE` `#76FF03` `#CCFF90` | Accent — growth, fresh |
| Pop Accents — Orange | `#FF6D00` `#FF9100` `#FFAB40` `#FF6F00` | Accent — confident, warm |
| Neutrals | `#FAFAFA` `#F5F5F5` `#EEEEEE` `#9E9E9E` `#757575` `#BDBDBD` | Background, text |

**Rule — Pop Accent:** Chọn đúng 1 pop color, dùng làm CTA + highlight. Không mix 2 pop colors.

**Palette Themes (AI chọn 1):**

| Theme | Foundation | Pop Accent | CTA | Background | Mood |
|-------|-----------|-----------|-----|------------|------|
| 🎨 Dark Creative | `#1C1C1E` | `#7C4DFF` Purple | `#651FFF` | `#0D0D0D` | Bí ẩn, sáng tạo |
| 🏢 Corporate Clean | `#1A237E` | `#F9A825` Gold | `#FF6F00` | `#FAFAFA` | Tin cậy, chuyên nghiệp |
| ⬜ Minimal Studio | `#212121` | `#FFEA00` Yellow | `#FFD600` | `#FFFFFF` | Tối giản, táo bạo |
| 💥 Bold Agency | `#4527A0` | `#FF6D00` Orange | `#E64A19` | `#FFFFFF` | Táo bạo, ấn tượng |
| 💙 Tech Consultant | `#37474F` | `#00E5FF` Cyan | `#00BCD4` | `#FAFAFA` | Hiện đại, tech-forward |
| 💎 Premium Studio | `#121212` | `#DAA520` Gold | `#B8860B` | `#0A0A0A` | Sang trọng, exclusive |
| 🌸 Creative Freelancer | `#1C1C1E` | `#E91E63` Pink | `#C2185B` | `#FAFAFA` | Cá tính, memorable |

**Sub-type quick map:**
```
digital_agency   → Theme "Dark Creative"      hoặc "Bold Agency"
design_studio    → Theme "Minimal Studio"     hoặc "Dark Creative"
corporate_consult→ Theme "Corporate Clean"    hoặc "Tech Consultant"
freelance_dev    → Theme "Tech Consultant"    hoặc "Minimal Studio"
freelance_design → Theme "Creative Freelancer" hoặc "Premium Studio"
branding_agency  → Theme "Bold Agency"        hoặc "Premium Studio"
```

---

#### 🎓 Education — Giáo dục / Đào tạo

> **Tâm lý:** Blue hỗ trợ tập trung và ghi nhớ. Green = phát triển/tăng trưởng. Yellow = lạc quan, năng lượng. Tránh palette quá tương phản gây căng thẳng khi học dài giờ.

**Approved Color Pool:**

| Nhóm | Hex options | Vai trò |
|------|------------|---------|
| Trust Blues | `#0D47A1` `#1565C0` `#1976D2` `#1E88E5` `#2196F3` `#42A5F5` `#64B5F6` | Primary — học thuật |
| Creative Purples | `#4527A0` `#512DA8` `#6A1B9A` `#7B1FA2` `#8E24AA` `#AB47BC` `#CE93D8` | Primary — trường sáng tạo |
| Growth Greens | `#1B5E20` `#2E7D32` `#388E3C` `#43A047` `#4CAF50` `#66BB6A` `#81C784` | Secondary — phát triển |
| Energy Yellows | `#F57F17` `#F9A825` `#FBC02D` `#FDD835` `#FFEE58` `#FFF176` | Secondary — lạc quan |
| Warm Oranges | `#BF360C` `#E64A19` `#FF5722` `#FF7043` `#FF8A65` `#FFAB91` | Accent — nhiệt tình |
| Deep Teals | `#004D40` `#00695C` `#00796B` `#00897B` `#26A69A` | Accent — STEM, science |
| Light Bgs | `#FAFAFA` `#F8FBFF` `#EEF2FF` `#E8F5E9` `#E3F2FD` `#FFF9C4` | Background |
| Dark Bgs | `#0D1321` `#1A237E` `#0D1B2A` `#1A1A2E` | Background dark |

**Palette Themes (AI chọn 1):**

| Theme | Primary | Secondary | CTA | Background | Mood |
|-------|---------|-----------|-----|------------|------|
| 🎓 Academic Classic | `#1565C0` | `#FBC02D` | `#1976D2` | `#FAFAFA` | Nghiêm túc, uy tín |
| 🎨 Creative Kids | `#7B1FA2` | `#66BB6A` | `#8E24AA` | `#FFF9C4` | Vui nhộn, tưởng tượng |
| 💻 Online Learning | `#1976D2` | `#00BCD4` | `#1E88E5` | `#F8FBFF` | Hiện đại, digital |
| 🔬 STEM Focus | `#3949AB` | `#00897B` | `#3F51B5` | `#F5F5F5` | Khoa học, logic |
| 🌍 Language School | `#43A047` | `#FF5722` | `#388E3C` | `#FFFDE7` | Đa dạng, thân thiện |
| 🏛️ University Prestige | `#1A237E` | `#C8A800` | `#283593` | `#FAFAFA` | Học thuật, danh giá |
| 🌟 EdTech Startup | `#512DA8` | `#00ACC1` | `#7C4DFF` | `#0D1321` | Đổi mới, tech-forward |

**Sub-type quick map:**
```
k12_school      → Theme "Creative Kids"      hoặc "Academic Classic"
university      → Theme "University Prestige" hoặc "Academic Classic"
online_platform → Theme "Online Learning"    hoặc "EdTech Startup"
stem_center     → Theme "STEM Focus"
language_center → Theme "Language School"
coding_bootcamp → Theme "EdTech Startup"     hoặc "STEM Focus"
```

---

#### 🏋️ Fitness — Gym / Thể hình / Yoga

> **Tâm lý Gym:** Năng lượng, sức mạnh, kết quả ngay. Màu mạnh (Red, Orange, Black) tạo động lực.
> **Tâm lý Yoga:** Cân bằng, thư thái, kết nối nội tâm. Màu đất + Teal + Lavender tạo sự bình an.
> Hai sub-type có **vùng màu và rule hoàn toàn khác nhau.**

**Approved Color Pool — Gym / Sport:**

| Nhóm | Hex options | Vai trò |
|------|------------|---------|
| Power Reds | `#B71C1C` `#C62828` `#D32F2F` `#E53935` `#EF5350` | Primary — energy, power |
| Fire Oranges | `#BF360C` `#D84315` `#E64A19` `#FF3D00` `#FF5722` `#FF6D00` | Primary/CTA — urgency, fire |
| Electric Yellows | `#F57F17` `#F9A825` `#FFD600` `#FFEA00` `#FFFF00` | Accent — highlight, achievement |
| Power Blacks | `#000000` `#0D0D0D` `#121212` `#1C1C1C` `#212121` | Foundation — strength |
| Electric Blues | `#0D47A1` `#0288D1` `#01579B` `#1565C0` | Primary Alt — sport team |
| Neon Greens | `#00E676` `#69F0AE` `#76FF03` `#CCFF90` | Accent — neon, gaming gym |
| Sport Whites | `#FFFFFF` `#FAFAFA` `#F5F5F5` | Background light |
| Dark Gym Bgs | `#000000` `#0D0D0D` `#121212` `#1A0505` | Background dark |

**Approved Color Pool — Yoga / Wellness:**

| Nhóm | Hex options | Vai trò |
|------|------------|---------|
| Healing Teals | `#004D40` `#00695C` `#00796B` `#00897B` `#26A69A` `#4DB6AC` `#80CBC4` | Primary |
| Earth Greens | `#33691E` `#558B2F` `#689F38` `#7CB342` `#8BC34A` `#AED581` | Secondary |
| Calming Lavenders | `#4527A0` `#512DA8` `#7E57C2` `#9575CD` `#B39DDB` `#D1C4E9` `#EDE7F6` | Primary Alt |
| Warm Earth | `#3E2723` `#5D4037` `#795548` `#8D6E63` `#A1887F` `#BCAAA4` `#D7CCC8` | Neutral |
| Sage Greens | `#558B2F` `#689F38` `#8BC34A` `#AED581` `#DCEDC8` `#F1F8E9` | Accent |
| Warm Lights | `#FFF8E1` `#F9FBE7` `#F1F8E9` `#E8F5E9` `#E0F7FA` | Background light |
| Yoga Dark Bgs | `#0A1A15` `#0A1A0A` `#101820` `#1A1010` | Background dark |

**Palette Themes — Gym (AI chọn 1):**

| Theme | Primary | Secondary | CTA | Background | Mood |
|-------|---------|-----------|-----|------------|------|
| 🔥 Power Red | `#D32F2F` | `#212121` | `#FF6D00` | `#FAFAFA` | Sức mạnh, quyết tâm |
| ⚡ Electric Sport | `#0288D1` | `#000000` | `#00E5FF` Neon | `#000000` | Thể thao, điện tử |
| 🖤 Dark Warrior | `#212121` | `#FF3D00` | `#FFD600` | `#0D0D0D` | Chiến binh, kỷ luật |
| 🟠 Sport Orange | `#E64A19` | `#212121` | `#FF5722` | `#FFFFFF` | Năng động, open |
| 🌙 Neon Night | `#000000` | `#76FF03` | `#00E5FF` | `#0A0A0A` | Gaming gym, Gen Z |

**Palette Themes — Yoga (AI chọn 1):**

| Theme | Primary | Secondary | CTA | Background | Mood |
|-------|---------|-----------|-----|------------|------|
| 🌿 Earth Zen | `#00796B` | `#795548` | `#00695C` | `#F9FBE7` | Mặt đất, thiền định |
| 💜 Lavender Calm | `#7E57C2` | `#4DB6AC` | `#9575CD` | `#EDE7F6` | Bình yên, tâm linh |
| 🌲 Forest Retreat | `#558B2F` | `#00796B` | `#689F38` | `#F1F8E9` | Thiên nhiên, rừng |
| 🌅 Sunrise Flow | `#FF8A65` | `#FFD54F` | `#EF6C00` | `#FFF8E1` | Bình minh, ấm áp |
| 🌊 Ocean Breath | `#0288D1` | `#26A69A` | `#039BE5` | `#E0F7FA` | Biển cả, tự do |

**Sub-type quick map:**
```
gym_bodybuilding → Theme "Power Red"      hoặc "Dark Warrior"
crossfit         → Theme "Sport Orange"   hoặc "Power Red"
sport_general    → Theme "Electric Sport" hoặc "Sport Orange"
esports_gym      → Theme "Neon Night"
yoga_studio      → Theme "Earth Zen"      hoặc "Lavender Calm"
mindfulness      → Theme "Lavender Calm"  hoặc "Ocean Breath"
outdoor_fitness  → Theme "Forest Retreat" hoặc "Sunrise Flow"
pilates          → Theme "Sunrise Flow"   hoặc "Earth Zen"
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
