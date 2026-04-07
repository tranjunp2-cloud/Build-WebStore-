# PRD: Template Blueprints Redesign — Category DNA (F31)
> **Version:** 1.0 | **Created:** 2026-04-06 | **Agent:** `documentation-engineer`
> **Priority:** P1 | **Sprint:** Wave 4 — Sprint hiện tại | **Size:** L
> **Depends on:** F04 Block Renderer, F07 Template Gallery, F30 Template System v2
> **Blocks:** F07 Template Gallery (UI refresh), QA Template smoke tests

---

## 0. Story Traceability

| Story ID | Title | Status |
|----------|-------|--------|
| US-F31-01 | Xem templates đặc trưng theo ngành | Ready |
| US-F31-02 | Chọn template với cá tính riêng (warm/dark/minimal/bold) | Ready |
| US-F31-03 | Seed 56 premium blueprints thay thế 48 templates cũ | Ready |
| US-F31-04 | Mở rộng 3 categories mới (Events, Blog, Travel) | Ready |
| US-F31-05 | Composer đọc blueprint thay vì logic tier cũ | Ready |

> **Ghi chu:** PRD nay duoc tao tu validated plan (`plans/260406-2055-template-blueprints/plan.md`).
> User Story da duoc xac nhan truoc khi viet PRD.

---

## 1. Problem Statement

**He thong 48 templates hien tai bi loi thiet ke co ban:**

- **Templates trong giong nhau:** 48 templates duoc compose algorithmically theo tier (starter/professional/premium), block order va content duoc recycle — nguoi dung nhin khong phan biet duoc nghanh nao voi nghanh nao. Khong co "Category DNA".
- **Tier system gay confusion va giam perceived value:** `starter` chi co 1 trang, `professional` co 3 trang — nguoi dung cam thay dang mua san pham hang 2. Toan bo danh gia competitor (Wix, Squarespace, Framer) deu la ALL-premium, khong tier.
- **Composer 976 dong, kho maintain:** `template-composer.ts` dung if/else lon theo tier, hardcode block order, khong co kha nang dieu chinh per-template. Them 1 category moi = sua 200+ dong code.
- **11 categories, bỏ sot 3 nganh lon o Malaysia:** Events/Wedding, Blog/Media, Travel/Tourism la 3 nganh co demand cao o Malaysia nhung hien chua co template.
- **Sub-pages khong unique:** Toan bo templates cung category dung chung 1 blueprint cho sub-pages (About, Services, Contact), tao ra trai nghiem preview trung lap.

**Evidence:**
- Template picker hien tai: 11 categories x 4 templates = 44 templates co trang tri trung nhau (cung block order, chi doi theme)
- Composer: 976 dong voi 4 tier branches, moi branch copy-paste logic
- Competitor (Wix 2026): 900+ templates, ALL full-featured, khong co "starter" tier

---

## 2. Target User

- **SME owner Malaysia** — muon thay ngay template cua minh co dang "nhu nganh minh" (khach san phai nhin ra khach san, khong phai generic business)
- **Non-technical user** — khong biet code, can template dep ngay tu lan chon dau tien
- **Dev/Admin (internal)** — can the m template moi cho 1 category ma khong phai sua 200+ dong code
- **QA/PM (internal)** — can verify 56 templates render dung, co du blocks chuan

---

## 3. Solution Overview

**Thay the toan bo 48 templates cu bang 56 premium blueprints** (4 per category x 14 categories), moi blueprint dinh nghia ro section order, signature blocks, personality, va page set rieng. Thay vi composer tinh toan algorithmically, **composer moi doc blueprint va build block-by-block** — logic don gian, predictable, de debug.

Moi category co "DNA" rieng: `restaurant` luon co menu + booking + gallery; `tech` luon co stats + pricing-table + feature-comparison. Moi template co 1 trong 4 "personalities": warm, dark, minimal, bold — tao ra su khac biet ro rang ma khong can thiet ke lai tu dau.

**Ket qua:** Nguoi dung nhin vao template picker va BIET NGAY nghanh nao; dev them template moi chi can them 1 `TemplatePreset` object.

---

## 4. Scope

### In Scope

- Rewrite `src/lib/ai/template-definitions.ts` — dinh nghia `CATEGORY_DNA` cho 14 nganh + 56 `TemplatePreset` objects
- Rewrite `src/lib/ai/template-composer.ts` — `composeFromBlueprint()` thay the `composeTemplate()` cu
- Them 3 categories moi vao `src/collections/Templates.ts`: `events`, `blog`, `travel`
- Tao 3 content files moi: `src/lib/ai/content/events.ts`, `blog.ts`, `travel.ts`
- Tao 15 theme presets moi (5/category) cho 3 categories moi trong `theme-presets.ts`
- Update `src/app/api/templates/seed/route.ts` — xoa 48 cu, seed 56 moi
- Strict enforcement: logo-cloud, FAQ, mid-CTA, newsletter BAT BUOC tren moi homepage
- Unique sub-page blueprints cho moi template (khong shared)

### Out of Scope

- Chinh sua block components (`src/components/site-renderer/`) — SEO JSON-LD injection va heading hierarchy la task rieng
- UI cua Template Gallery picker (F07) — layout, filter, search UI khong thay doi trong F31
- Thumbnail generation tu template previews — van dung placeholder
- A/B testing giua blueprint variants
- User-facing "template DNA" visualization (badge hien thi "signature blocks")
- Xuat khau hay import blueprints tu external source

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Template count | Dung 56 (4/category x 14) | `GET /api/templates/list | jq '.data | length'` |
| Category distribution | Dung 14 categories, moi category = 4 templates | Group-by query tren DB |
| Homepage uniqueness | 0 duplicate block order trong 56 homepages | Manual review + diff script |
| Mandatory blocks compliance | 100% homepages co logo-cloud, FAQ, mid-CTA, newsletter | Automated seed verify |
| Composer size reduction | `template-composer.ts` < 250 dong (hien tai 976 dong) | `wc -l` |
| Seed time | < 60 giay cho 56 templates | Seed endpoint response time |
| TypeScript compile | `tsc --noEmit` pass sau khi rewrite | CI check |

---

## 6. User Stories

```
US-F31-01: Template Nghanh Dac Trung
AS A SME owner Malaysia muon tao website
I WANT TO thay templates co nhin dac trung ro rang theo nganh cua minh
  (restaurant nhin ra restaurant, khong phai generic business)
SO THAT toi co the chon template phu hop ma khong mat thoi gian customize tu dau
```

```
US-F31-02: Chon Personality
AS A user muon website co phong cach rieng
I WANT TO co 4 lua chon personality trong cung 1 nganh (warm, dark, minimal, bold)
SO THAT website cua toi co cam giac "cua toi", khac voi doi thu cung nganh
```

```
US-F31-03: All-Premium Templates
AS A user lua chon template
I WANT TO moi template deu co du 4-5 trang day du tinh nang
  khong phai tra them de "upgrade" tu starter len premium
SO THAT toi cam thay duoc su ton trong va trai nghiem day du ngay tu dau
```

```
US-F31-04: Categories Moi (Events, Blog, Travel)
AS A event planner / blogger / travel agent o Malaysia
I WANT TO co templates duoc thiet ke rieng cho nganh cua toi
  (khong phai dung template "business" generic)
SO THAT website cua toi the hien dung nghe nghiep va thu hut khach hang dung target
```

```
US-F31-05: Dev Them Template De Dang
AS A developer can them template moi cho 1 category
I WANT TO chi can them 1 TemplatePreset object trong template-definitions.ts
  ma khong phai doc 976 dong composer code
SO THAT toi co the ship template moi trong < 30 phut
```

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | He thong PHAI co 56 templates: 4 per category x 14 categories | US-F31-03 | P0 | Thay the 48 templates cu |
| FR-02 | Moi template PHAI co tu 4 den 5 pages, khong co single-page template | US-F31-03 | P0 | Bo tier starter (1 page) |
| FR-03 | Moi homepage PHAI co: navigation, hero, logo-cloud, mid-CTA, FAQ, newsletter, footer | US-F31-01 | P0 | Strict — khong exception |
| FR-04 | Moi category PHAI co it nhat 2 "signature blocks" doc quyen cho nganh do | US-F31-01 | P0 | Dinh nghia trong CATEGORY_DNA |
| FR-05 | 56 homepages PHAI co section order khac nhau — khong 2 template nao giong het nhau | US-F31-02 | P0 | Dam bao diversity |
| FR-06 | Moi template PHAI co `personality` field (warm/dark/minimal/bold) | US-F31-02 | P1 | Thay the `variant` tier cu |
| FR-07 | Composer PHAI doc tu `TemplatePreset.pages[].blocks[]` blueprint, khong hardcode block order | US-F31-05 | P0 | Blueprint-driven |
| FR-08 | `composeFromBlueprint()` PHAI tao ra `TemplateSeed` hop le cho moi preset | US-F31-05 | P0 | Verify bang dry run |
| FR-09 | Seed endpoint (`POST /api/templates/seed?force=true`) PHAI xoa 48 templates cu truoc khi seed moi | US-F31-03 | P0 | Khong de duplicate |
| FR-10 | Collections/Templates.ts PHAI co 3 options moi: `events`, `blog`, `travel` | US-F31-04 | P1 | Update TEMPLATE_CATEGORY_OPTIONS |
| FR-11 | Phai tao content files cho 3 categories moi: `events.ts`, `blog.ts`, `travel.ts` | US-F31-04 | P1 | Cung format voi file hien co |
| FR-12 | Moi template PHAI co unique sub-page blueprints (About, Services, Contact khac nhau) | US-F31-01 | P1 | Khong dung shared blueprint |
| FR-13 | Phai tao 15 theme presets moi cho 3 categories moi (5 presets/category) | US-F31-04 | P1 | Trong `theme-presets.ts` |
| FR-14 | `template-composer.ts` sau khi rewrite PHAI < 300 dong | US-F31-05 | P2 | Muc tieu maintainability |
| FR-15 | Seed endpoint PHAI co mode `?dry=true` de verify ma khong ghi vao DB | US-F31-05 | P2 | Debug/verify tool |

---

## 8. Business Rules

- **BR-01:** Tat ca templates deu `isPremium: true` — KHONG co field `tier` hay `variant` starter/professional/premium trong type moi.
- **BR-02:** Moi category PHAI co dung 4 templates — khong it hon, khong nhieu hon. Neu can them → tao category moi.
- **BR-03:** 4 templates trong 1 category PHAI co 4 personalities khac nhau — KHONG duoc co 2 templates cung personality.
- **BR-04:** Logo-cloud PHAI xuat hien ngay sau hero block — KHONG duoc chen block khac vao giua hero va logo-cloud.
- **BR-05:** FAQ PHAI la `accordion` type voi 4-8 cau hoi — KHONG dung static FAQ format.
- **BR-06:** Newsletter block PHAI la block cuoi cung truoc footer — KHONG co block nao giua newsletter va footer.
- **BR-07:** `composeFromBlueprint()` PHAI throw error ro rang neu `preset.category` khong co content file tuong ung — KHONG silent fail.
- **BR-08:** Seed endpoint chi cho phep `super-admin` role — endpoint auth voi `withAuth()` phai duoc giu nguyen.
- **BR-09:** Khi `?force=true`, xoa templates theo `name` matching, KHONG xoa theo `isPremium: false` (de tranh xoa templates thu cong cua admin).

---

## 9. User Flow

### Flow 1: User chon template (happy path)

```
[Template Gallery Picker — /builder/templates]
  |
  v
User filter by category (e.g., "Restaurant")
  |
  v
Hien thi 4 templates voi personality labels: "Warm Traditional", "Bold Dark", "Elegant Luxury", "Minimal Modern"
  |
  v
User hover → preview thumbnail + mo ta personality
  |
  v
User click "Use Template"
  |
  +-- Success --> Composer goi composeFromBlueprint(preset) --> TemplateSeed --> Builder load
  +-- Error    --> Toast: "Loi tai template, vui long thu lai"
```

### Flow 2: Admin seed templates moi

```
[Admin / DevOps terminal]
  |
  v
POST /api/templates/seed?force=true&v3=true
(auth: super-admin JWT required)
  |
  v
[?force=true] → Xoa 48 templates cu (match by name pattern)
  |
  v
Loop qua 56 TEMPLATE_PRESETS
  → composeFromBlueprint(preset) → TemplateSeed
  → payload.create('templates', seed)
  |
  +-- 56/56 created --> Response: { success: true, created: 56, failed: 0 }
  +-- Error on any  --> Log loi, tiep tuc, bao cao so failed cuoi
```

### Flow 3: Dev them template moi

```
[src/lib/ai/template-definitions.ts]
  |
  v
Them 1 TemplatePreset object:
  { id, name, category, businessIndex, personality, themePreset, pages[], tags[], description }
  |
  v
Chay: curl POST /api/templates/seed?dry=true
  |
  v
Verify output trong response (page count, block count, category)
  |
  v
Chay: curl POST /api/templates/seed?force=false (chi them moi, khong xoa cu)
```

---

## 10. Screen Layout

> F31 KHONG thay doi UI cua Template Gallery Picker. Moi thay doi nam o data layer va composer.
> UI changes thuoc ve F07 v3 (neu co).

### 10.1 Template Gallery (Hien tai — khong thay doi UI)

- Category filter tabs: 14 tabs (them Events, Blog, Travel)
- Template cards: name + personality label + preview thumbnail
- State: Loading (skeleton), Empty (neu category chua co template), Error (API fail)

### 10.2 Seed Admin Endpoint (Internal tool)

- `POST /api/templates/seed` — JSON response chi, khong co UI
- Response shape:
  ```json
  {
    "success": true,
    "data": {
      "total": 56, "created": 56, "skipped": 0, "failed": 0,
      "templates": [{ "name": "...", "category": "...", "pageCount": 5, "blockCount": 12 }]
    }
  }
  ```

### 10.3 UI States (Template Picker — sau seed)

- **Loading:** Skeleton grid 4 cards x 14 categories
- **Empty category:** "Dang cap nhat templates cho nganh nay, vui long quay lai sau"
- **Error:** "Khong the tai danh sach template. Thu lai" + Retry button

---

## 11. Acceptance Criteria

### AC-01: 56 Templates Post-Seed

```gherkin
GIVEN admin goi POST /api/templates/seed?force=true
WHEN seed hoan thanh thanh cong
THEN DB co dung 56 templates
  AND moi category co dung 4 templates
  AND khong con template nao tu he thong cu (48 templates cu da bi xoa)
```

### AC-02: All Templates Are Premium

```gherkin
GIVEN bat ky template nao trong DB sau khi seed
WHEN query GET /api/templates/list
THEN moi template co isPremium = true
  AND khong co template nao co field tier co gia tri 'starter' hoac 'professional'
```

### AC-03: 4-5 Pages Per Template

```gherkin
GIVEN bat ky template nao trong 56 templates moi
WHEN compose bang composeFromBlueprint(preset)
THEN TemplateSeed co pages.length >= 4 AND pages.length <= 5
  AND moi page co blocks.length >= 3
```

### AC-04: Mandatory Homepage Blocks

```gherkin
GIVEN bat ky template nao sau khi compose
WHEN kiem tra homepage blocks (pages[0] hoac page co isHomepage: true)
THEN homepage co block type 'navigation'
  AND homepage co block type 'hero'
  AND homepage co block type 'logo-cloud' hoac 'trust-bar'
  AND homepage co block type 'mid-cta' hoac 'cta-banner'
  AND homepage co block type 'faq'
  AND homepage co block type 'newsletter'
  AND block cuoi truoc footer la 'newsletter'
```

### AC-05: Signature Blocks Per Category

```gherkin
GIVEN template thuoc category 'restaurant'
WHEN kiem tra homepage blocks
THEN homepage co it nhat 1 trong: 'menu-display', 'booking-widget', 'gallery'

GIVEN template thuoc category 'tech'
WHEN kiem tra homepage blocks
THEN homepage co it nhat 1 trong: 'pricing-table', 'feature-comparison', 'stats', 'video-showcase'

GIVEN template thuoc category 'health'
WHEN kiem tra homepage blocks
THEN homepage co it nhat 1 trong: 'doctor-profile', 'booking-widget', 'stats'
```

### AC-06: Unique Section Order

```gherkin
GIVEN 56 templates da duoc composed
WHEN lay danh sach block types cho moi homepage
THEN khong co 2 homepages nao co cung section order giong het nhau
  AND co it nhat 8 hero variant khac nhau trong 56 templates
```

### AC-07: 4 Personalities Per Category

```gherkin
GIVEN 4 templates cung 1 category (vi du: restaurant)
WHEN kiem tra personality field
THEN 4 templates co 4 personality khac nhau
  AND khong co 2 templates nao co personality giong nhau trong cung category
```

### AC-08: 3 New Categories

```gherkin
GIVEN admin truy cap Payload CMS admin panel
WHEN tao template moi va chon category
THEN dropdown hien thi cac option: 'Events/Wedding', 'Blog/Media', 'Travel/Tourism'

GIVEN user truy cap template gallery picker
WHEN filter by category
THEN hien thi 3 tabs moi: Events, Blog, Travel
  AND moi tab hien thi 4 templates
```

### AC-09: Content Files For New Categories

```gherkin
GIVEN category la 'events', 'blog', hoac 'travel'
WHEN composeFromBlueprint(preset) duoc goi
THEN ham getCategoryContent(preset.category) tra ve data hop le
  AND khong throw error 'Content not found'
  AND content co locale: 'en-MY' va businesses array co >= 4 entries
```

### AC-10: Composer Blueprint-Driven

```gherkin
GIVEN TemplatePreset voi pages[0].blocks = ['navigation', 'hero', 'logo-cloud', 'menu', 'gallery', 'mid-cta', 'faq', 'newsletter', 'footer']
WHEN composeFromBlueprint(preset) duoc goi
THEN TemplateSeed.pages[0].layout co dung 9 blocks
  AND thu tu blocks trong layout khop voi thu tu trong blueprint
  AND khong co block nao duoc them hoac xoa so voi blueprint
```

### AC-11: Seed Force Delete

```gherkin
GIVEN DB hien co 48 templates cu
WHEN goi POST /api/templates/seed?force=true
THEN 48 templates cu bi xoa truoc khi seed
  AND sau khi seed xong, DB chi co 56 templates moi
  AND khong co template cu nao con lai
```

### AC-12: Unique Sub-Pages

```gherkin
GIVEN 4 templates cung category 'beauty'
WHEN so sanh pages[1] (Services page) cua 4 templates
THEN moi Services page co block order khac nhau
  AND it nhat 1 block trong each Services page la unique (khong co trong 3 cai kia)
```

### AC-13: Dry Run Mode

```gherkin
GIVEN admin goi POST /api/templates/seed?dry=true
WHEN request duoc xu ly
THEN response tra ve 56 template previews
  AND khong co record nao duoc ghi vao DB
  AND moi preview co: name, category, pageCount, blockCount
```

### AC-14: TypeScript Compile

```gherkin
GIVEN code da duoc rewrite (template-definitions.ts + template-composer.ts)
WHEN chay tsc --noEmit
THEN khong co TypeScript errors
  AND khong co 'starter' | 'professional' | 'premium' trong new type definitions
  AND ComposerInput type cu van con (deprecated wrapper) de khong break existing code
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Target | Notes |
|----------|-------------|--------|-------|
| **Performance** | `composeFromBlueprint()` cho 1 preset < 100ms | < 100ms | Measured locally |
| **Performance** | Seed 56 templates (sequential) < 60 giay | < 60s | DB insert batchSize=10 |
| **Maintainability** | `template-composer.ts` sau rewrite | < 300 dong | Hien tai 976 dong |
| **Maintainability** | Them 1 template moi chi can them 1 `TemplatePreset` object | 1 object | Khong sua composer |
| **Type Safety** | Khong co `any` type trong new types | 0 `any` | TypeScript strict |
| **Backwards Compatibility** | `composeTemplate()` cu van hoat dong (deprecated wrapper) | No breaking change | Cho toi khi F07 update |
| **Security** | Seed endpoint chi cho `super-admin` | Auth required | `withAuth()` middleware |
| **Data Integrity** | Moi `TemplatePreset.id` phai unique | 0 duplicates | Validated at seed time |

---

## 13. Technical Architecture

### 13.1 New Types (thay the ComposerInput)

```typescript
// src/lib/ai/template-definitions.ts — NEW

export interface BlockSpec {
  blockType: string         // 'hero', 'menu-display', 'faq', etc.
  variant?: string          // 'parallax', 'split-left', 'gradient', etc.
  count?: number            // so items (testimonials: 3, gallery: 6)
  overrides?: Record<string, unknown> // content overrides neu can
}

export interface PageBlueprint {
  name: string              // 'Home', 'Menu', 'Gallery', 'About', 'Contact'
  slug: string              // 'home', 'menu', 'gallery', 'about', 'contact'
  isHomepage?: boolean
  blocks: BlockSpec[]       // ordered list — composer build theo thu tu nay
}

export interface TemplatePreset {
  id: string                // 'restaurant-warung-kampung' (unique, kebab-case)
  name: string              // 'Warung Kampung'
  category: string          // must match TEMPLATE_CATEGORY_OPTIONS value
  businessIndex: number     // 0-3 (index vao content.businesses[])
  personality: string       // 'warm-traditional' | 'bold-dark' | 'elegant-luxury' | 'minimal-modern'
  themePreset: ThemePreset
  pages: PageBlueprint[]    // 4-5 pages
  tags: string[]
  description: string       // 1 cau cho template picker
}

// Category DNA (internal config — khong export cho composer)
interface CategoryDna {
  signatureBlocks: string[]     // blocks dac trung nghanh
  visualMood: string            // 'warm' | 'dark' | 'minimal' | 'bold'
  mandatoryBlocks: string[]     // blocks bat buoc ngoai standard set
}

export const CATEGORY_DNA: Record<string, CategoryDna> = { ... }
export const TEMPLATE_PRESETS: TemplatePreset[] = [ ... ]  // 56 entries
```

### 13.2 Composer Rewrite

```typescript
// src/lib/ai/template-composer.ts — SIMPLIFIED

export function composeFromBlueprint(preset: TemplatePreset): TemplateSeed {
  const content = getCategoryContent(preset.category) // throws if missing
  const biz = content.businesses[preset.businessIndex]!

  return {
    name: preset.name,
    description: preset.description,
    category: preset.category,
    isPremium: true,   // ALWAYS true — no tier
    tags: preset.tags,
    defaultTheme: preset.themePreset,
    pages: preset.pages.map(page => ({
      name: page.name,
      slug: page.slug,
      isHomepage: page.isHomepage ?? false,
      layout: page.blocks.map(spec =>
        buildBlock(spec, content, biz, preset.category)
      )
    }))
  }
}

// buildBlock() — dispatcher sang existing block builders
function buildBlock(spec: BlockSpec, content: CategoryContent, biz: BusinessSample, category: string): Record<string, unknown> {
  switch (spec.blockType) {
    case 'navigation':      return buildNavBlock(biz)
    case 'hero':            return buildHeroBlock(biz, spec.variant)
    case 'logo-cloud':      return buildLogoCloudBlock()
    case 'menu-display':    return buildMenuBlock(content, spec.count)
    case 'booking-widget':  return buildBookingBlock(biz)
    case 'gallery':         return buildGalleryBlock(content, spec.count)
    case 'testimonials':    return buildTestimonialsBlock(content, spec.count)
    case 'faq':             return buildFAQBlock(content, spec.count)
    case 'newsletter':      return buildNewsletterBlock()
    case 'footer':          return buildFooterBlock(biz)
    // ... other block types
    default:
      throw new Error(`Unknown blockType: ${spec.blockType} in category ${category}`)
  }
}
```

### 13.3 Files Bi Thay Doi

| File | Loai thay doi | Chi tiet |
|------|---------------|----------|
| `src/lib/ai/template-definitions.ts` | REWRITE | Types moi + 56 TemplatePreset + CATEGORY_DNA |
| `src/lib/ai/template-composer.ts` | REWRITE | `composeFromBlueprint()` + `buildBlock()` dispatcher |
| `src/lib/ai/content/events.ts` | NEW | Content cho Events/Wedding category |
| `src/lib/ai/content/blog.ts` | NEW | Content cho Blog/Media category |
| `src/lib/ai/content/travel.ts` | NEW | Content cho Travel/Tourism category |
| `src/lib/ai/theme-presets.ts` | UPDATE | Them 15 presets moi (5/category x 3) |
| `src/collections/Templates.ts` | UPDATE | Them 3 options vao TEMPLATE_CATEGORY_OPTIONS |
| `src/app/api/templates/seed/route.ts` | UPDATE | Import TEMPLATE_PRESETS, goi composeFromBlueprint(), them ?v3 mode |

### 13.4 API Endpoints

```
POST /api/templates/seed
  ?force=true    → xoa cu truoc khi seed (default: false)
  ?v3=true       → dung blueprint mode (default: false, de khong break v1/v2)
  ?dry=true      → preview, khong write to DB
  Auth: super-admin JWT required
  Response: { success: boolean, data: { total, created, skipped, failed, templates[] } }

GET /api/templates/list
  (khong thay doi interface)
  Response: { success: boolean, data: Template[], meta: { total, page, limit } }
```

### 13.5 Data Flow

```
[TEMPLATE_PRESETS array — 56 presets]
  |
  v
[composeFromBlueprint(preset)]
  |
  +-- getCategoryContent(category)  →  content files (*.ts)
  +-- content.businesses[businessIndex]  →  biz data
  +-- preset.pages[].blocks[]  →  blueprint
  |
  v
[buildBlock(spec, content, biz)]  →  existing block builders
  |
  v
[TemplateSeed] = { name, category, isPremium: true, pages[], defaultTheme }
  |
  v
[payload.create('templates', seed)]  →  PostgreSQL (templates table + templates_template_pages)
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| `src/lib/ai/content/restaurant.ts` (existing pattern) | Done | Reference cho 3 files moi |
| `src/lib/ai/theme-presets.ts` — 55 presets hien co | Done | Them 15 presets moi |
| `templates_template_pages` DB table | Done (tao o F30) | Khong can migration moi |
| `withAuth()` middleware | Done | Giu nguyen cho seed endpoint |
| Existing block builders (buildHeroBlock, etc.) | Done | Cap nhat signature de accept `variant` param |
| 3 content files moi (events, blog, travel) | Pending | Tao trong Phase 1 |

---

## 15. Out of Scope

1. **SEO JSON-LD injection vao block components** — JSON-LD (Organization, FAQPage, BreadcrumbList schemas) duoc inject vao `SiteRenderer.tsx`, khong phai trong blueprint. Task nay la phan rieng da tach ra (xem `plans/260406-2055-template-blueprints/phase-04-seo-schema.md`).
2. **Chinh sua UI Template Gallery** — Tab filter, card layout, search, sort trong template picker (F07) khong thay doi. Them 3 tabs moi (Events, Blog, Travel) tu dong khi categories duoc them vao collection.
3. **Thumbnail generation** — Auto-generate screenshot/preview cho 56 templates. Van dung placeholder thumbnail.
4. **Template versioning** — Track version khi blueprint thay doi. Templates hien tai khong co version field.
5. **User-created template** — Cho phep user save/publish template cua ho. Ngoai scope F31.
6. **Multi-language content** — Content files chi support `locale: 'en-MY'`. Bahasa Malaysia / Chinese locale la task rieng (F21).
7. **Block component changes** — Chinh sua visual output cua bat ky block component nao (`Hero.tsx`, `MenuDisplay.tsx`, etc.).

---

## 16. Risk Assessment

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R-01 | **Content files moi (events, blog, travel) thieu data** — 3 files phai duoc tao voi du businesses[], testimonials[], faqItems[]. Neu thieu, `getCategoryContent()` throw error lam seed fail cho 12 templates. | Medium | High | Tao content files truoc (Phase 1), dry-run verify truoc khi seed production. Content file minimal co 4 businesses + 3 testimonials + 4 FAQ la du de seed. |
| R-02 | **56 TemplatePreset objects — typo trong blockType** — Neu 1 blockType sai ten (vi du: `'menu-display'` viet thanh `'menu-widget'`), `buildBlock()` throw Unknown blockType error lam compose fail. | Medium | Medium | Them TypeScript enum cho blockType, hoac union type validation. CI dry-run tat ca 56 presets truoc khi merge. |
| R-03 | **Backwards compatibility — code dang dung `composeTemplate()` cu** — `seed/route.ts` va co the cac files khac dang import `composeTemplate`. Neu remove ma khong co wrapper, CI build fail. | High | High | Giu `composeTemplate()` cu nhu deprecated wrapper goi `composeFromBlueprint()` ben trong. Xoa sau khi tat ca callsites da migrate. |
| R-04 | **theme-presets.ts — 15 presets moi chua duoc design** — Neu chi copy-paste presets cu va doi ten, 4 templates cung category se nhin giong nhau. | Medium | Medium | Moi preset PHAI co primary color khac nhau. Dung color wheel: warm (amber/orange), dark (slate/zinc), minimal (neutral/gray), bold (red/violet). |
| R-05 | **Seed time > 60 giay** — 56 templates x compose + DB insert = co the cham neu batchSize qua nho hoac DB co latency. | Low | Medium | Dung batchSize=10 (hien tai), implement parallel batch neu serial qua cham. Seed endpoint timeout set 120s. |
| R-06 | **Moi homepage co same block list khi compare** — 4 personalities cung category dung cung signature blocks, co the vo tinh co cung section order neu dev copy-paste. | Medium | High | Validate uniqueness check trong Phase 3: moi blueprint duoc so sanh truoc khi commit. Them CI check "no duplicate section order". |
| R-07 | **3 categories moi thieu trong DB migrations** — Neu `TEMPLATE_CATEGORY_OPTIONS` duoc update trong `Templates.ts` nhung migration cho `select hasMany` table chua duoc update. | Low | High | Kiem tra `scripts/db-setup.js` — `category` la select hasMany → co bang `templates_category`. Xac nhan ALTER TABLE da cover gia tri moi truoc khi deploy. |

---

## 17. Phase Breakdown

### Phase 1 — Category DNA + Content Files (3h)
**File:** `plans/260406-2055-template-blueprints/phase-01-category-dna.md`

**Tasks:**
- Dinh nghia `CATEGORY_DNA` cho 14 nganh (11 hien co + Events, Blog, Travel) trong `template-definitions.ts`
- Tao `src/lib/ai/content/events.ts` — 4 businesses, 3 testimonials, 4 FAQ, MY locale
- Tao `src/lib/ai/content/blog.ts` — 4 businesses, 3 testimonials, 4 FAQ
- Tao `src/lib/ai/content/travel.ts` — 4 businesses, 3 testimonials, 4 FAQ
- Them 15 theme presets moi vao `theme-presets.ts`
- Update `TEMPLATE_CATEGORY_OPTIONS` trong `Templates.ts`

**Success criteria:** `getCategoryContent('events')`, `('blog')`, `('travel')` return valid data.

---

### Phase 2 — TemplatePreset Type + Composer Rewrite (3h)
**File:** `plans/260406-2055-template-blueprints/phase-02-blueprint-type.md`

**Tasks:**
- Dinh nghia `BlockSpec`, `PageBlueprint`, `TemplatePreset` interfaces
- Viet `composeFromBlueprint()` function
- Viet `buildBlock()` dispatcher (switch on blockType)
- Cap nhat block builder signatures de accept optional `variant` + `count` params
- Giu `composeTemplate()` cu lam deprecated wrapper
- `tsc --noEmit` pass

**Success criteria:** `composeFromBlueprint(TEMPLATE_PRESETS[0])` tra ve `TemplateSeed` hop le.

---

### Phase 3 — 56 Blueprints (8h)
**File:** `plans/260406-2055-template-blueprints/phase-03-thirty-blueprints.md`

**Tasks:**
- Viet 56 `TemplatePreset` objects (4/category x 14 categories)
- Moi template: unique section order, 4-5 pages, unique sub-page blueprints
- Enforce: logo-cloud sau hero, FAQ truoc newsletter, newsletter truoc footer
- Verify: 0 duplicate section order trong 56 homepages

**Template matrix tong hop:**

| Category | Templates | Personalities |
|----------|-----------|---------------|
| Restaurant / F&B | 4 | warm-traditional, bold-dark, elegant-luxury, minimal-modern |
| E-commerce | 4 | clean-modern, dark-luxury, warm-artisan, vibrant-fresh |
| Beauty / Spa | 4 | soft-feminine, dark-edgy, warm-organic, minimal-clean |
| Tech / SaaS | 4 | modern-vibrant, dark-hacker, minimal-clean, bold-gradient |
| Health / Medical | 4 | trust-professional, warm-wellness, modern-dark, minimal-clinical |
| Education | 4 | academic-classic, warm-friendly, dark-modern, vibrant-campus |
| Real Estate | 4 | corporate-trust, dark-luxury, warm-elegant, minimal-urban |
| Fitness / Gym | 4 | bold-aggressive, calm-wellness, neon-futuristic, warm-active |
| Creative / Portfolio | 4 | ultra-minimal, colorful-bold, moody-dark, warm-artistic |
| Business / Corporate | 4 | classic-professional, premium-dark, fresh-modern, bold-corporate |
| Events / Wedding | 4 | romantic-elegant, bold-modern, minimal-chic, warm-festive |
| Blog / Media | 4 | editorial-clean, dark-magazine, warm-personal, vibrant-lifestyle |
| Travel / Tourism | 4 | adventure-bold, luxury-travel, minimal-wanderer, warm-explorer |
| F&B (Food & Beverage) | 4 | street-food-bold, cafe-minimal, warm-homestyle, dark-fine-dining |

**Success criteria:** 56 presets defined, 0 duplicate section order, signature blocks present trong moi category.

---

### Phase 4 — Seed + Verify (2h)
**File:** `plans/260406-2055-template-blueprints/phase-04-seed-verify.md`

**Tasks:**
- Update `seed/route.ts` — import `TEMPLATE_PRESETS`, goi `composeFromBlueprint()`
- Them `?v3=true` mode, bo v1/v2 bifurcation (hoac giu backward compat)
- Chay seed local: `POST /api/templates/seed?v3=true&force=true`
- Verify: count=56, 4/category, 4-5 pages/template
- Visual spot check: 5 templates (1 moi 3 categories)

**Quality checklist per template (sam truoc khi sign-off):**
- [ ] Hero an tuong, value prop ro trong 3 giay
- [ ] Logo-cloud ngay sau hero (trust signal)
- [ ] Signature blocks cua nganh hien thi tren homepage
- [ ] Mid-page CTA co mat
- [ ] FAQ co mat (accordion)
- [ ] Newsletter truoc footer
- [ ] 4-5 pages, moi page render khong loi

**Success criteria:** `curl /api/templates/list | jq '.data | length'` = 56.

---

## 18. Data Model Changes

### 18.1 Type Changes (TypeScript — khong phai DB schema)

**REMOVE (deprecated):**
```typescript
// Cu — se xoa sau khi migrate xong
type ComposerInput = {
  category: string
  businessIndex: number
  variant: 'starter' | 'professional' | 'premium'  // ← XOA
  themePreset: ThemePreset
}
```

**ADD (new):**
```typescript
// Moi — thay the ComposerInput
interface BlockSpec { blockType: string; variant?: string; count?: number; overrides?: Record<string, unknown> }
interface PageBlueprint { name: string; slug: string; isHomepage?: boolean; blocks: BlockSpec[] }
interface TemplatePreset { id: string; name: string; category: string; businessIndex: number; personality: string; themePreset: ThemePreset; pages: PageBlueprint[]; tags: string[]; description: string }
```

### 18.2 Payload Collection Changes

**`src/collections/Templates.ts` — TEMPLATE_CATEGORY_OPTIONS them 3 options:**
```typescript
{ label: 'Events / Wedding / Party', value: 'events' },
{ label: 'Blog / Media / Content', value: 'blog' },
{ label: 'Travel / Tourism / Hotel', value: 'travel' },
```

**Khong co DB schema migration can thiet** — `category` field la `select hasMany`, gia tri moi chi la string options. Khong them column, khong them table.

> **Kiem tra:** Table `templates_category` da co (tao boi F30 migrations). INSERT 3 gia tri moi vao table nay la hop le.

### 18.3 Content File Structure (cho 3 files moi)

```typescript
// Format chuan — copy tu src/lib/ai/content/restaurant.ts
export type CategoryContent = {
  category: string          // 'events' | 'blog' | 'travel'
  locale: 'en-MY'
  businesses: BusinessSample[]       // >= 4 entries
  testimonials: TestimonialSample[]  // >= 3 entries
  faqItems: FAQSample[]              // >= 4 entries
  industryBlocks: IndustryBlockSample[]
}
```

---

## 19. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | `composeTemplate()` cu con duoc goi o dau ngoai `seed/route.ts`? Can grep truoc khi xoa. | Dev | Open |
| 2 | 3 content files moi (events, blog, travel) — AI generate hay manual? | PM | Open — khuyên AI generate, PM review |
| 3 | Seed endpoint timeout hien tai la bao nhieu? 56 templates x compose + DB insert co the qua 30s. | Dev | Open |
| 4 | Sau khi seed 56 templates, F07 Template Gallery co can update UI gi khong (filter, sort, card display)? | PM/Dev | Open — scope tach ra F07 v3 |

---

## 20. Definition of Ready

- [x] Plan da duoc validated voi user (2026-04-06)
- [x] CATEGORY_DNA cho 11 nganh cu da duoc define trong phase-01
- [x] Type moi (TemplatePreset, BlockSpec, PageBlueprint) da duoc draft trong phase-02
- [x] 56 blueprint matrix da co trong phase-03 (can expand tu 30 len 56)
- [x] Seed flow da co trong phase-04
- [ ] 3 content files moi phai duoc tao truoc khi Phase 3 start
- [ ] Grep tat ca callsites cua `composeTemplate()` truoc khi rewrite

---

## 21. Definition of Done

- [ ] 56 templates trong DB, 4/category, 14 categories
- [ ] Tat ca 56 templates co `isPremium: true`
- [ ] Tat ca ACs (AC-01 → AC-14) pass
- [ ] `tsc --noEmit` pass
- [ ] `eslint` pass
- [ ] `template-composer.ts` < 300 dong
- [ ] Visual spot check 5 templates (1 per 3 categories) = khong co loi render
- [ ] CI: seed dry run pass tren staging
- [ ] QA sign-off tren test plan F31

---

## 22. Metrics Summary

| Category | Count |
|----------|-------|
| Functional Requirements | 15 FRs (FR-01 → FR-15) |
| Acceptance Criteria | 14 ACs (AC-01 → AC-14) |
| Business Rules | 9 BRs (BR-01 → BR-09) |
| Risks | 7 risks (R-01 → R-07) |
| User Stories | 5 USs (US-F31-01 → US-F31-05) |
| Phases | 4 phases |
| Templates to deliver | 56 |
| Categories | 14 (11 existing + 3 new) |
| New files | 3 content files + updated 5 files |
