# F26 — Brainstorm: Đa ngôn ngữ Editor & Template
> Date: 2026-05-26 | Branch: staging | Updated: 2026-05-26 15:20

---

## 1. Vấn đề hiện tại

Khi user Malaysia tạo site bằng BM → AI generate đúng BM, lưu `Sites.locale = 'ms'`.
Nhưng khi vào editor **thêm block mới** → block insert hardcode tiếng Anh.

```
Trang đang là BM:              Block vừa thêm:
┌──────────────────────┐       ┌──────────────────────┐
│ Selamat datang ke    │       │ Frequently Asked     │ ← ❌ EN
│ Kedai Kuih Mak Cik   │       │ Questions            │
│ Kuih segar setiap    │       │ What are your hours? │
│ hari...              │       └──────────────────────┘
└──────────────────────┘
        BM ✅                          EN ❌
```

**Root cause:** `AddSectionContext` không có `locale` field → factory không biết site đang ngôn ngữ gì → luôn inject EN strings.

---

## 2. Quyết định đã chốt (2026-05-26)

| # | Quyết định |
|---|-----------|
| 1 | Block mới thêm → theo ngôn ngữ đang active của site |
| 2 | Language switcher trong editor toolbar (dropdown — scalable cho 3+ locales) |
| 3 | Switch ngôn ngữ → render đúng content của locale đó (per-locale storage) |
| 4 | User edit EN → lưu riêng EN; user edit BM → lưu riêng BM; switch về lại đúng locale hiển thị đúng content đã lưu |
| 5 | Business data (DB) → **GIỮ NGUYÊN** tự nhiên (nằm ở nguồn khác) |
| 6 | Per-locale content lưu trong `pages.locale_content jsonb` — **không** dirty field tracking |
| 7 | Phase 1: EN + BM only |
| 8 | Hand-author BM cho ~15 blocks traffic cao trước, AI translate fallback cho phần còn lại |
| 9 | `Sites.locale` update ngay khi switch (không cần user save thêm) |

---

## 3. Phân biệt 2 loại content

**Template content** = hệ thống inject vào block — **lưu per-locale, render theo locale active**
**Business data** = merchant tự nhập (tên shop, sản phẩm, DB) — **GIỮ NGUYÊN khi switch**

```
Template content (per-locale):        Business data (GIỮ NGUYÊN):
  Headline mặc định                     Tên shop
  CTA buttons ("Get Started")           Địa chỉ, SĐT, email
  FAQ default questions                 Tên sản phẩm, giá, mô tả
  Features description mặc định        Logo, hình ảnh upload
  Testimonial placeholders              Tên nhân viên/team
  Section titles mặc định              Menu items (tên món, giá)
                                        Blog content
                                        Testimonials thật từ khách
```

**Rule:** merchant tự nhập = business data | hệ thống inject hoặc user edit trong editor = template content (per-locale)

---

## 4. Flow đầy đủ — 7 US

### US-F26-01: Confirm ngôn ngữ sau AI generate

```
User nhập prompt → AI generate site
  → AI detect ngôn ngữ (guessLanguageFromInput())
  → Site tạo xong → hiện popup nhẹ:
    "AI created your site in Bahasa Melayu — correct?"
    [Yes, continue]  [No, switch to English]
  → User confirm → lưu Sites.locale
  → User dismiss → giữ nguyên locale AI detect
```

### US-F26-02: Block mới theo ngôn ngữ site

```
User kéo FAQ block vào trang (site locale = 'ms')
  → page.tsx đọc site.locale
  → pass locale vào normalizeAddSectionBlock()
  → factory gọi resolveBlockContent('faq', 'ms', brandName)
  → inject BM: "Soalan Lazim", "Apakah waktu operasi anda?"
  → đồng thời khởi tạo locale_content[newBlockId] = { en: EN_defaults, ms: MS_defaults }

Nếu BM chưa có:
  → fallback EN + flag needsTranslation: true (không crash)
  → handoff cho US-F26-04
```

### US-F26-03: Block Library panel preview theo locale

```
User mở Block Library panel (site locale = 'ms')
  → Tên block + preview text hiển thị BM
  → Block chưa có BM → hiển thị icon AI auto-translate
    tooltip: "Auto-translate this component to Bahasa Melayu"
```

### US-F26-04: AI translate fallback

```
Block thiếu BM (needsTranslation: true)
  → Gọi AI translate endpoint: EN → BM
  → Insert BM content vào block
  → Cache lại (không gọi lại lần sau)
  → Fail → fallback EN, non-blocking notice
```

### US-F26-05: Language switcher (dropdown toolbar)

```
User đang edit site EN, đã sửa headline = "My Shop"
  → locale_content[blockId].en.headline = "My Shop"  (auto-saved)

User click dropdown → chọn BM:
  1. Sites.locale = 'ms' update ngay
  2. Render locale_content[blockId].ms.headline = "Selamat datang"  ✅ BM
  3. Business data (DB) → giữ nguyên tự nhiên

User click dropdown → chọn lại EN:
  → Render locale_content[blockId].en.headline = "My Shop"  ✅ đúng title đã lưu

User thêm block mới sau switch → inject defaults theo locale đang active ✅
```

**Tại sao dropdown (không phải toggle):**
- Toggle chỉ scale được 2 locale (EN ↔ BM)
- Dropdown scale tự nhiên: EN, BM, ZH, TH, ID, ... — thêm locale không cần đổi UI
- F27/F28+ mở thêm locale → chỉ cần thêm option vào list

**Per-locale storage:**
```ts
// pages.locale_content jsonb (1 column duy nhất, không đụng block tables)
{
  "block-uuid-hero-1": {
    "en": { "headline": "My Shop", "ctaLabel": "Shop Now" },
    "ms": { "headline": "Selamat datang", "ctaLabel": "Beli Sekarang" }
  }
}

// Editor render: locale override wins over flat block columns
const display = localeOverrides[block.id]?.[activeLocale]
  ?? (activeLocale === site.locale ? block : getDefaultContent(block.blockType, activeLocale))
```

### US-F26-07: Language Switcher Block trong component library (prep cho F27)

```
Owner mở Block Library → thấy block "Language Switcher" (category: Navigation)
  → Add → lock vào nav header (không vào page.blocks[])
  → Editor hiện static dropdown placeholder: "EN ▾" (không switch thật)
  → Saved → F27 đọc showLanguageSwitcher → render dropdown thật trên storefront

Owner không thêm block → site chạy single-language bình thường (opt-in)
```

**Placeholder design:** dropdown shape `EN ▾` — mirrors F27 live UI, scalable cho 3+ locales
**F26 scope:** register + schema tối giản, dropdown placeholder (visual only)
**F27 scope:** render dropdown thật với `site.supportedLocales[]`, actual switching trên public site

---

### US-F26-06: Audit coverage

```
Chạy getLocaleCoverage()
  → Matrix: mọi block × {EN, BM} status (có / thiếu)
  → Gap → trigger US-F26-04 AI translate nốt
  → Đảm bảo 0 EN leftover trên BM site sau audit
```

---

## 5. Architecture

### 5a. Locale-aware block registry (US-F26-02)

```
src/lib/ai/add-section-content/
├── index.ts      ← resolveBlockContent(blockType, locale, brand)
├── en.ts         ← EN content (extract từ add-section.ts, verbatim)
└── ms.ts         ← BM hand-authored (~15 blocks traffic cao)
```

**Resolver:**
```ts
resolveBlockContent('hero', 'ms', 'Ali Bakery')
  → ms.hero có → return BM, needsTranslation: false
  → ms.hero thiếu → return EN, needsTranslation: true
```

### 5b. Per-locale content storage (US-F26-05)

```
DB: ALTER TABLE pages ADD COLUMN IF NOT EXISTS locale_content jsonb DEFAULT '{}'
    → 1 migration, không đụng 50+ pages_blocks_* tables

Editor store (Zustand):
  + activeLocale: 'en' | 'ms'
  + localeOverrides: Record<blockId, Record<locale, Partial<BlockConfig>>>

Render layer:
  getDisplayContent(block, activeLocale, localeOverrides)
    → localeOverrides[block.id]?.[activeLocale] ?? fallback

Save: localeOverrides → pages.locale_content (round-trip)
Load: pages.locale_content → localeOverrides hydrate vào store
```

**LanguageSwitcher component:**
```
editor/[siteId]/page.tsx toolbar
  └── LanguageSwitcher (dropdown — scalable cho 3+ locales)
        → options: site.supportedLocales[] (F26: ['en', 'ms'])
        → onChange(newLocale):
            setActiveLocale(newLocale)
            updateSiteLocale(newLocale)   ← Sites.locale persist
```
Dropdown pattern: thêm ZH/TH/ID sau này chỉ cần push vào `supportedLocales[]`, không đổi UI.

### 5c. AI translate (US-F26-04)

```
src/app/api/ai/translate/route.ts  (mới)
  → input: blockType, targetLocale, ENcontent
  → output: translated content (cache theo blockType+locale)
  → fail → return ENcontent, status: fallback
```

---

## 6. ~15 blocks hand-author BM (phase 1)

Traffic cao nhất — làm ngay:
`hero, features, faq, testimonials, team, pricing, newsletter, cta, contact, stats, accordion, service-cards, about, gallery (text labels), products (text labels)`

Còn lại (~42 blocks): fallback EN + needsTranslation flag → US-F26-04 cover sau

---

## 7. So sánh với industry

| Platform | Block mới theo locale? | Language switcher | Per-locale storage? |
|----------|----------------------|-------------------|---------------------|
| Webflow | Không tự động | Toolbar dropdown | Không |
| Contentful | Không | Locale dropdown → full swap | Có (field-level) |
| WordPress WPML | Không | Flag → reload editor | Có (separate posts) |
| **ECH (sau F26)** | **Có ✅** | **Dropdown, switch về hiển thị đúng content đã lưu ✅** | **Có (jsonb, 1 col) ✅** |

ECH tốt hơn Webflow ở: block mới tự động theo locale + switch về giữ content đã edit.

---

## 8. Docs cần update

| File | Cần sửa |
|------|---------|
| `docs/prd/F26-project-content-localization.md` | Thêm section định nghĩa template content vs business data |
| `docs/prd/F26-project-content-localization.md` | Thêm per-locale JSONB storage approach vào FR-08 / BR-04 |
| `plans/260526-1116-f26-02-localized-block-defaults/` | Update phase-02/03 để init `locale_content` khi add block |

---

## 10. Definition of Done — Toàn bộ F26

> F26 được coi là **DONE** khi tất cả AC dưới đây pass.

### Functional (per US)

| US | AC | Verify |
|----|----|----|
| **F26-01** | Dialog hiện sau AI generate với detected locale pre-selected | Manual |
| **F26-01** | Confirm → `Sites.locale` = detected, survive reload | Manual + test |
| **F26-01** | Switch → `Sites.locale` = switched, survive reload | Manual + test |
| **F26-01** | Dismiss → locale giữ nguyên, dialog không hiện lại | Manual + test |
| **F26-02** | Block mới thêm vào BM site → inject BM defaults | Manual + test |
| **F26-02** | ~15 blocks traffic cao có BM hand-authored (không phải AI) | Code audit |
| **F26-02** | Block chưa có BM → fallback EN, không crash, flag `needsTranslation` | Test |
| **F26-03** | Block Library preview text hiển thị đúng theo `site.locale` | Manual |
| **F26-03** | Block thiếu BM → hiện icon AI translate với tooltip | Manual |
| **F26-04** | AI translate endpoint EN→BM hoạt động, kết quả cache | Test |
| **F26-04** | Translate fail → fallback EN, non-blocking, không crash | Test |
| **F26-05** | Language dropdown: click switch EN↔BM → render đúng locale | Manual |
| **F26-05** | Edit "My Shop" (EN) → switch BM → switch lại EN → vẫn thấy "My Shop" | Manual + test |
| **F26-05** | Business data (tên shop, sản phẩm, SĐT) → không thay đổi khi switch | Test |
| **F26-05** | `Sites.locale` persist ngay khi switch (không cần save thêm) | Test |
| **F26-05** | `pages.locale_content` persist sau save, hydrate đúng khi reload | Test |
| **F26-06** | `getLocaleCoverage()` chạy được, output matrix block × {EN, BM} | Test |
| **F26-06** | Gap → trigger AI translate → 0 EN leftover trên BM site sau audit | Manual |
| **F26-07** | Language Switcher block visible trong Block Library → category Navigation | Manual ✅ |
| **F26-07** | Add → lock vào header (không vào `page.blocks[]`), `showLanguageSwitcher = true` | Test ✅ |
| **F26-07** | Remove → biến mất khỏi nav, `showLanguageSwitcher = false` | Test ✅ |
| **F26-07** | Desktop ≥ md: inline, không overflow — 6 variants | Manual ✅ |
| **F26-07** | Mobile < md: ẩn top bar, hiện trong drawer trên CTA | Manual ✅ |

### Technical

| Check | Requirement |
|-------|------------|
| `tsc --noEmit` | Clean — zero errors |
| `node scripts/check-migrations.js` | Pass — bắt buộc (CI hard gate) cho `pages.locale_content` |
| Unit tests | 100% pass — en/ms/fallback coverage |
| Regression | EN-only sites không bị ảnh hưởng (default off) |
| F27 readability | `showLanguageSwitcher` + `locale_content` đọc được từ F27 mà không cần migrate |

### Manual verify flow (end-to-end)

```
1. Generate site BM → dialog hiện "Bahasa Melayu" → confirm → editor load locale = ms
2. Thêm FAQ block → inject BM defaults: "Soalan Lazim"
3. Sửa headline = "Kedai Saya" → switch EN → switch lại BM → vẫn thấy "Kedai Saya"
4. Check tên shop (business data) → không đổi sau switch
5. Block Library → preview text hiển thị BM
6. Block thiếu BM → icon AI translate hiện
7. Click AI translate → BM content inject → icon biến mất
8. Coverage audit → 0 gap còn lại
9. Add Language Switcher từ Block Library → hiện EN ▾ dropdown trong nav header
10. Save → reload editor → Language Switcher vẫn còn, locale_content hydrate đúng
```

### Phạm vi F26 (không làm)
- Switching thật trên public storefront → **F27**
- Ngôn ngữ ngoài EN + BM → **F28+**
- RTL support → ngoài scope

---

## 9. Open questions — ✅ Đã chốt

1. ~~BM content author — dev tự viết hay cần native BM speaker review?~~ → **Dev tự viết trước (phase 1)**
2. ~~AI translate (US-F26-04) dùng OpenAI hay Google Translate?~~ → **OpenAI (consistent với các AI feature hiện có)**
