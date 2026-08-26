# QA Test Plan: Template Blueprints Redesign — Category DNA (F31)
> **Version:** 1.0 | **Created:** 2026-04-06 | **Author:** Documentation Engineer Agent
> **PRD Reference:** `docs/prd/F31-template-blueprints.md`
> **Sprint:** Wave 4 — Sprint hien tai | **Priority:** P1 | **Size:** L
> **Dependencies:** F04 Block Renderer, F07 Template Gallery, F30 Template System v2

---

## 1. Tong Quan (Overview)

| Hang Muc | Gia Tri |
|---|---|
| Tong so ACs can phu | 14 (AC-01 → AC-14) |
| Tong so Test Cases | 47 TCs |
| Critical (P0) | 18 TCs |
| High (P1) | 20 TCs |
| Medium (P2) | 9 TCs |
| AC Coverage | 100% (14/14 ACs co >= 1 TC) |
| Business Rules Coverage | 100% (9/9 BRs duoc validate) |

---

## 2. Test Strategy (Chien Luoc Kiem Thu)

### 2.1 Phan Loai Test

| Layer | Tool | Scope | Target Coverage |
|---|---|---|---|
| **Unit Test** | Vitest | `composeFromBlueprint()`, validators, `getCategoryContent()`, blueprint schema | 80%+ lines |
| **Integration Test** | Vitest | Seed endpoint flow, `composeFromBlueprint()` + DB insert, apply-template API | Happy path + error paths |
| **E2E Test** | Playwright | Template picker UI, filter by category (3 new tabs), apply template flow | P0 flows |
| **Static Analysis** | `tsc --noEmit` | TypeScript type safety, no legacy types | 0 errors |

### 2.2 Test Environment

| Bien | Yeu Cau |
|---|---|
| Moi truong | Staging (`staging` branch) |
| DB State | Clean slate — chay seed truoc moi test session |
| Auth | Super-admin JWT (cho seed endpoint) |
| Browsers | Chrome (v125+), Safari (iOS) |
| Devices | Desktop 1920x1080, Mobile 375px |
| Node version | 20+ |

### 2.3 Files Can Test

| File | Loai Test |
|---|---|
| `src/lib/ai/template-composer.ts` | Unit — `composeFromBlueprint()` |
| `src/lib/ai/template-definitions.ts` | Unit — `TEMPLATE_PRESETS` structure, `CATEGORY_DNA` |
| `src/lib/ai/content/events.ts`, `blog.ts`, `travel.ts` | Unit — `getCategoryContent()` cho 3 categories moi |
| `src/app/api/templates/seed/route.ts` | Integration — seed endpoint voi `?force`, `?dry`, `?v3` |
| `src/collections/Templates.ts` | Unit/Static — `TEMPLATE_CATEGORY_OPTIONS` co 3 values moi |
| `src/components/editor/EditorTemplateModal.tsx` | E2E — template picker filter + apply |
| `src/__tests__/unit/templates/template-composer.test.ts` | Phai update: test cu dung `composeTemplate()` tier-based |
| `src/__tests__/integration/template-smoke.test.ts` | Phai rewrite: 48 → 56, tier → personality |

---

## 3. Risk Assessment (Danh Gia Rui Ro)

### 3.1 Critical Risks (P0 — Phai Pass Truoc Khi Deploy)

| # | Kich Ban Rui Ro | Impact | Mitigation |
|---|---|---|---|
| R-01 | Duplicate `TemplatePreset.id` → seed tao duplicate records hoac crash | DB corrupt | Validate unique IDs truoc khi seed; TC-F31-038 |
| R-02 | Seed `?force=true` delete thanh cong, nhung seed tiep theo fail → mat het templates | P0 outage | Transaction-style rollback; TC-F31-005, TC-F31-006 |
| R-03 | `logo-cloud` blockType khong co trong `blockRegistry` → seed success nhung renderer crash | Runtime crash | Check registry truoc seed; TC-F31-039 |
| R-04 | Missing content file cho `events`/`blog`/`travel` → `getCategoryContent()` tra ve undefined → silent fail | Bad data | Throw error ro rang; TC-F31-029, TC-F31-030 |
| R-05 | Apply-template API nhan `templatePages` format moi nhung code van doc `defaultBlocks` cu → trang blank | Feature broken | Update apply-template handler; TC-F31-044 |
| R-06 | `tsc --noEmit` fail do type conflict giua `ComposerInput` cu va `TemplatePreset` moi | CI block | Giu deprecated wrapper; TC-F31-046 |

### 3.2 High Risks (P1)

| # | Kich Ban Rui Ro | Impact | Mitigation |
|---|---|---|---|
| R-07 | Invalid `blockType` typo trong blueprint → composer skip block hoac throw → wrong layout | Silent error | Strict validation; TC-F31-031 |
| R-08 | `businessIndex` vuot qua `businesses.length` → undefined biz → runtime crash | Template fail | Bounds check; TC-F31-032 |
| R-09 | Empty `pages[]` trong `TemplatePreset` → composer tra ve 0-page template | Invalid data | Throw "minimum 4 required"; TC-F31-033 |
| R-10 | `mid-CTA` la blockType `cta` voi variant `banner` — neu code dung `mid-cta` rieng → not found | Wrong render | Verify block mapping; TC-F31-040 |
| R-11 | `TEMPLATE_CATEGORY_OPTIONS` chi dinh nghia trong Collection schema, khong co code type → test fail | AC-08 fail | Doc code source; TC-F31-025 |
| R-12 | Homepage detection logic sai: chi check `pages[0]` ma khong check `isHomepage: true` flag | AC-04 fail | Dual check; TC-F31-023 |

---

## 4. Test Cases

---

### Group A: Seed Endpoint Tests
> AC-01, AC-02, AC-11, AC-13 | File: `src/app/api/templates/seed/route.ts`

#### TC-F31-001: Seed tao dung 56 templates

- **Priority:** P0
- **Type:** Integration
- **AC Reference:** AC-01
- **Precondition:** DB sach (0 templates), super-admin JWT hop le
- **Steps:**
  1. Goi `POST /api/templates/seed?force=true&v3=true` voi Authorization header
  2. Doi response tra ve (timeout 60s)
  3. Query `GET /api/templates/list` de dem tong so
- **Expected:**
  - Response: `{ success: true, data: { total: 56, created: 56, failed: 0 } }`
  - DB count = 56
  - Response time < 60 giay

---

#### TC-F31-002: Moi category co dung 4 templates

- **Priority:** P0
- **Type:** Integration
- **AC Reference:** AC-01
- **Precondition:** Da chay seed thanh cong (TC-F31-001 pass)
- **Steps:**
  1. Query DB: `GROUP BY category` tren collection `templates`
  2. Verify count moi category
- **Expected:**
  - 14 categories, moi category = dung 4 records
  - Categories: restaurant, ecommerce, beauty, tech, health, education, realestate, fitness, creative, business, fnb, events, blog, travel
  - Khong co category nao co 3 hoac 5 templates

---

#### TC-F31-003: Tat ca templates co isPremium = true

- **Priority:** P0
- **Type:** Integration
- **AC Reference:** AC-02
- **Precondition:** Seed da chay thanh cong
- **Steps:**
  1. `GET /api/templates/list?limit=100`
  2. Check field `isPremium` tren moi template trong response
  3. Check khong co field `tier` co value `starter` hoac `professional`
- **Expected:**
  - Moi template: `isPremium === true`
  - Khong co template nao co `tier === 'starter'` hoac `tier === 'professional'`
  - Khong co field `variant` theo nghia tier

---

#### TC-F31-004: Seed xoa het 48 templates cu truoc khi tao moi

- **Priority:** P0
- **Type:** Integration
- **AC Reference:** AC-11
- **Precondition:** DB co 48 templates cu (chay legacy seed truoc)
- **Steps:**
  1. Verify DB co 48 records
  2. Goi `POST /api/templates/seed?force=true&v3=true`
  3. Query DB sau khi seed xong
- **Expected:**
  - DB truoc seed: 48 records cu
  - DB sau seed: dung 56 records moi
  - Khong co record cu nao con lai (verify bang name pattern hoac `tags` field)

---

#### TC-F31-005: Seed force=false khong xoa templates hien co

- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-11
- **Precondition:** DB da co templates (bat ky so luong)
- **Steps:**
  1. Dem so templates hien co: N
  2. Goi `POST /api/templates/seed?v3=true` (KHONG co `force=true`)
  3. Query DB sau khi seed
- **Expected:**
  - Neu khong co `force=true`, seed KHONG xoa templates cu
  - Ket qua: N + 56 hoac response loi 409 ALREADY_SEEDED tuy theo implementation
  - Khong co data loss ngau nhien

---

#### TC-F31-006: Seed bi ngat giua chung — DB phai recover duoc

- **Priority:** P0
- **Type:** Integration
- **AC Reference:** AC-11 (critical scenario R-02)
- **Precondition:** Simulate loi sau khi da delete cu nhung chua seed xong
- **Steps:**
  1. Mock `payload.create()` de throw error sau lan insert thu 10
  2. Goi `POST /api/templates/seed?force=true&v3=true`
  3. Kiem tra DB state
  4. Goi lai seed lan 2 (retry)
- **Expected:**
  - Response bao cao so `failed > 0`
  - DB co the o trang thai partial (< 56 templates)
  - Goi lai seed `?force=true` lan 2 phai clean up va tao du 56

---

#### TC-F31-007: Seed endpoint yeu cau super-admin auth

- **Priority:** P0
- **Type:** Integration
- **AC Reference:** AC-01 (BR-08)
- **Precondition:** Khong co token, hoac dung user token binh thuong
- **Steps:**
  1. Goi `POST /api/templates/seed?force=true` KHONG co Authorization header → kiem tra response
  2. Goi lai voi token cua role `user` (khong phai super-admin) → kiem tra response
- **Expected:**
  - Case 1: HTTP 401 Unauthorized
  - Case 2: HTTP 403 Forbidden
  - DB khong co thay doi

---

#### TC-F31-008: Dry run tra ve previews, khong ghi DB

- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-13
- **Precondition:** Super-admin JWT, DB co the co hoac khong co templates
- **Steps:**
  1. Dem so templates trong DB truoc khi goi: N
  2. Goi `POST /api/templates/seed?dry=true&v3=true`
  3. Kiem tra response
  4. Dem so templates trong DB sau khi goi: M
- **Expected:**
  - Response: `{ success: true, data: { total: 56, created: 0, dry: true, templates: [...] } }`
  - `templates` array co dung 56 items
  - Moi item co: `name`, `category`, `pageCount`, `blockCount`
  - M === N (DB khong thay doi)

---

#### TC-F31-009: Dry run — moi preview co pageCount va blockCount hop le

- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-13, AC-03
- **Precondition:** Goi dry run thanh cong
- **Steps:**
  1. Goi `POST /api/templates/seed?dry=true&v3=true`
  2. Lap qua `data.templates` array
  3. Kiem tra tung entry
- **Expected:**
  - Moi entry: `pageCount >= 4 AND pageCount <= 5`
  - Moi entry: `blockCount >= 12` (4 pages x 3 blocks minimum)
  - Khong co entry nao co `pageCount === 0` hoac `blockCount === 0`

---

#### TC-F31-010: Seed response shape dung format PRD

- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-01
- **Precondition:** Seed thanh cong
- **Steps:**
  1. Goi `POST /api/templates/seed?force=true&v3=true`
  2. Kiem tra JSON response structure
- **Expected:**
  ```json
  {
    "success": true,
    "data": {
      "total": 56,
      "created": 56,
      "skipped": 0,
      "failed": 0,
      "templates": [{ "name": "...", "category": "...", "pageCount": 5, "blockCount": 12 }]
    }
  }
  ```

---

### Group B: Composer Tests
> AC-03, AC-04, AC-05, AC-07, AC-10, AC-12 | File: `src/lib/ai/template-composer.ts`

#### TC-F31-011: composeFromBlueprint tra ve 4-5 pages

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-03
- **Precondition:** Import `composeFromBlueprint` tu `@/lib/ai/template-composer`
- **Steps:**
  1. Tao mock `TemplatePreset` voi 4-page blueprint
  2. Goi `composeFromBlueprint(preset)`
  3. Kiem tra `result.pages.length`
  4. Lap lai voi 5-page blueprint
- **Expected:**
  - `result.pages.length` = 4 (truong hop 4 pages)
  - `result.pages.length` = 5 (truong hop 5 pages)
  - Khong co truong hop nao tra ve 1, 2, 3 pages

---

#### TC-F31-012: Moi page co >= 3 blocks

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-03
- **Precondition:** `composeFromBlueprint` da duoc import
- **Steps:**
  1. Compose tat ca 56 TEMPLATE_PRESETS
  2. Voi moi preset: kiem tra tung page trong `result.pages`
- **Expected:**
  - `page.layout.length >= 3` cho moi page
  - Khong co page nao co < 3 blocks

---

#### TC-F31-013: Homepage co du 7 mandatory blocks

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-04
- **Precondition:** `composeFromBlueprint` hoat dong
- **Steps:**
  1. Compose 1 preset (vi du: restaurant-warm)
  2. Tim homepage: `pages[0]` hoac `page.isHomepage === true`
  3. Lay danh sach `blockType` cua homepage
  4. Kiem tra cac mandatory blocks
- **Expected:**
  - `blockTypes` chua: `navigation`, `hero`, `logo-cloud` hoac `trust-bar`, `mid-cta` hoac `cta` (variant=`banner`), `faq`, `newsletter`, `footer`
  - Truong hop `cta` block: verify `variant === 'banner'`

---

#### TC-F31-014: Block cuoi truoc footer phai la newsletter

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-04 (BR-06)
- **Precondition:** `composeFromBlueprint` hoat dong
- **Steps:**
  1. Compose tat ca 56 presets
  2. Voi moi homepage: lay block `[length - 2]` (penultimate block)
- **Expected:**
  - Block thu `[length - 2]` co `blockType === 'newsletter'`
  - Block cuoi cung `[length - 1]` co `blockType === 'footer'`
  - Khong co block nao chen vao giua newsletter va footer

---

#### TC-F31-015: logo-cloud xuat hien ngay sau hero block

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-04 (BR-04)
- **Precondition:** `composeFromBlueprint` hoat dong
- **Steps:**
  1. Compose 1 preset
  2. Lay homepage layout
  3. Tim index cua `hero` block
  4. Kiem tra block o index+1
- **Expected:**
  - `layout[heroIndex + 1].blockType === 'logo-cloud'` hoac `'trust-bar'`
  - Khong co block nao chen giua hero va logo-cloud

---

#### TC-F31-016: FAQ phai la accordion type

- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-04 (BR-05)
- **Precondition:** `composeFromBlueprint` hoat dong
- **Steps:**
  1. Compose tat ca 56 presets
  2. Voi moi homepage: tim faq block
  3. Kiem tra variant/type cua faq block
- **Expected:**
  - Moi faq block: `variant === 'accordion'` hoac `type === 'accordion'`
  - So luong questions: `faqItems.length >= 4 AND <= 8`

---

#### TC-F31-017: Restaurant templates co signature blocks

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-05
- **Precondition:** 4 restaurant presets da compose
- **Steps:**
  1. Compose tat ca 4 restaurant presets
  2. Voi moi homepage: lay tat ca blockTypes
  3. Kiem tra co >= 1 signature block
- **Expected:**
  - Moi restaurant homepage co >= 1 trong: `menu-display`, `booking-widget`, `gallery`
  - Khong co restaurant template nao thieu het ca 3 signature blocks nay

---

#### TC-F31-018: Tech templates co signature blocks

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-05
- **Precondition:** 4 tech presets da compose
- **Steps:**
  1. Compose tat ca 4 tech presets
  2. Voi moi homepage: lay tat ca blockTypes
  3. Kiem tra co >= 1 signature block
- **Expected:**
  - Moi tech homepage co >= 1 trong: `pricing-table`, `feature-comparison`, `stats`, `video-showcase`

---

#### TC-F31-019: Health templates co signature blocks

- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-05
- **Precondition:** 4 health presets da compose
- **Steps:**
  1. Compose tat ca 4 health presets
  2. Kiem tra signature blocks tren homepage
- **Expected:**
  - Moi health homepage co >= 1 trong: `doctor-profile`, `booking-widget`, `stats`

---

#### TC-F31-020: 4 templates cung category co 4 personalities khac nhau

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-07 (BR-03)
- **Precondition:** `TEMPLATE_PRESETS` da duoc import
- **Steps:**
  1. Group TEMPLATE_PRESETS by category
  2. Voi moi category: lay tat ca `personality` values
  3. Kiem tra uniqueness
- **Expected:**
  - Moi category co dung 4 personalities: `warm-traditional`, `bold-dark`, `elegant-luxury`, `minimal-modern` (hoac tuong duong)
  - `new Set(personalities).size === 4`
  - Khong co personality nao bi repeat trong cung category

---

#### TC-F31-021: composeFromBlueprint giu nguyen thu tu blocks tu blueprint

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-10
- **Precondition:** `composeFromBlueprint` hoat dong
- **Steps:**
  1. Tao `TemplatePreset` voi blueprint: `['navigation', 'hero', 'logo-cloud', 'menu-display', 'gallery', 'mid-cta', 'faq', 'newsletter', 'footer']` (9 blocks)
  2. Goi `composeFromBlueprint(preset)`
  3. Lay `result.pages[0].layout`
  4. So sanh thu tu blockTypes voi blueprint
- **Expected:**
  - `result.pages[0].layout.length === 9`
  - `layout.map(b => b.blockType)` === `['navigation', 'hero', 'logo-cloud', 'menu-display', 'gallery', 'mid-cta', 'faq', 'newsletter', 'footer']`
  - Khong co block nao bi them hoac xoa so voi blueprint

---

#### TC-F31-022: Sub-pages cua 4 templates cung category phai khac nhau

- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-12
- **Precondition:** 4 beauty presets da compose
- **Steps:**
  1. Compose tat ca 4 beauty presets
  2. Lay pages[1] (Services page) cua moi template
  3. Lay danh sach blockTypes cua moi Services page
  4. So sanh cac block orders voi nhau
- **Expected:**
  - Khong co 2 Services pages nao co block order giong het nhau (as string comparison)
  - Moi Services page co it nhat 1 block unique khong co trong 3 cai kia

---

#### TC-F31-023: Homepage detection check ca pages[0] va isHomepage flag

- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-04 (high scenario R-12)
- **Precondition:** `composeFromBlueprint` va helper `findHomepage()` (neu co)
- **Steps:**
  1. Tao preset voi `pages[0].isHomepage = false` va `pages[1].isHomepage = true`
  2. Compose va kiem tra logic detect homepage
  3. Tao preset voi chi `pages[0]` (default homepage, khong co flag)
- **Expected:**
  - Case 1: Homepage la `pages[1]` (theo `isHomepage: true`)
  - Case 2: Homepage la `pages[0]` (fallback)
  - Mandatory blocks duoc kiem tra tren dung homepage page

---

#### TC-F31-024: isPremium luon la true, khong co tier field

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-02 (BR-01)
- **Precondition:** `composeFromBlueprint` hoat dong
- **Steps:**
  1. Compose 1 preset bat ky
  2. Kiem tra `result.isPremium`
  3. Kiem tra co `result.tier` khong
- **Expected:**
  - `result.isPremium === true`
  - `result.tier === undefined` hoac field khong ton tai
  - Khong co gia tri `'starter'`, `'professional'`, `'premium'` trong result

---

### Group C: Category DNA Tests
> AC-05, AC-06, AC-08, AC-09 | Files: `template-definitions.ts`, content files

#### TC-F31-025: TEMPLATE_CATEGORY_OPTIONS co 3 values moi

- **Priority:** P0
- **Type:** Unit/Static
- **AC Reference:** AC-08 (high scenario R-11)
- **Precondition:** Import `Templates` collection tu `@/collections/Templates`
- **Steps:**
  1. Import `TEMPLATE_CATEGORY_OPTIONS` hoac enum equivalent tu Templates collection
  2. Kiem tra array values
- **Expected:**
  - Array chua gia tri: `'events'` (hoac `'events-wedding'`)
  - Array chua gia tri: `'blog'` (hoac `'blog-media'`)
  - Array chua gia tri: `'travel'` (hoac `'travel-tourism'`)
  - Tong so categories >= 14

---

#### TC-F31-026: getCategoryContent hoat dong cho 'events'

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-09
- **Precondition:** File `src/lib/ai/content/events.ts` ton tai
- **Steps:**
  1. Goi `getCategoryContent('events')`
  2. Kiem tra return value
- **Expected:**
  - Tra ve object hop le (khong throw, khong undefined)
  - `result.locale === 'en-MY'`
  - `result.businesses.length >= 4`
  - Moi business co `name`, `heroHeadline`, `heroSubheadline` khong empty

---

#### TC-F31-027: getCategoryContent hoat dong cho 'blog'

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-09
- **Precondition:** File `src/lib/ai/content/blog.ts` ton tai
- **Steps:**
  1. Goi `getCategoryContent('blog')`
  2. Kiem tra return value theo cung criteria nhu TC-F31-026
- **Expected:**
  - Tra ve object hop le, `locale === 'en-MY'`, `businesses.length >= 4`

---

#### TC-F31-028: getCategoryContent hoat dong cho 'travel'

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-09
- **Precondition:** File `src/lib/ai/content/travel.ts` ton tai
- **Steps:**
  1. Goi `getCategoryContent('travel')`
  2. Kiem tra return value theo cung criteria
- **Expected:**
  - Tra ve object hop le, `locale === 'en-MY'`, `businesses.length >= 4`

---

#### TC-F31-029: getCategoryContent throw ro rang khi category khong co content file

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-09 (BR-07, critical scenario R-04)
- **Precondition:** Category `nonexistent-xyz` khong co file
- **Steps:**
  1. Goi `getCategoryContent('nonexistent-xyz')`
  2. Kiem tra exception
- **Expected:**
  - Throw `Error` voi message ro rang, vi du: `"Content not found for category: nonexistent-xyz"`
  - KHONG return `undefined` hoac `null` (silent fail)
  - KHONG throw generic error khong co category name

---

#### TC-F31-030: composeFromBlueprint throw khi category thieu content file

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-09 (BR-07, critical scenario R-04)
- **Precondition:** Tao preset voi `category: 'nonexistent'`
- **Steps:**
  1. Tao `TemplatePreset` voi `category: 'nonexistent-xyz'`
  2. Goi `composeFromBlueprint(preset)`
  3. Kiem tra exception
- **Expected:**
  - Throw `Error` truoc khi compose
  - Message chua ten category: `"Content not found for category: nonexistent-xyz"`
  - Khong tra ve partial result

---

#### TC-F31-031: Composer throw khi blockType khong hop le

- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-10 (high scenario R-07)
- **Precondition:** `composeFromBlueprint` va `blockRegistry` da import
- **Steps:**
  1. Tao preset voi `pages[0].blocks` chua block co `blockType: 'invalid-typo-block'`
  2. Goi `composeFromBlueprint(preset)`
- **Expected:**
  - Throw `Error` voi message ro rang, vi du: `"Unknown blockType: invalid-typo-block"`
  - KHONG skip block va tiep tuc (silent skip la bug)
  - KHONG throw generic `TypeError`

---

#### TC-F31-032: Composer throw khi businessIndex out of range

- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-03 (high scenario R-08)
- **Precondition:** Category `restaurant` co 4 businesses (index 0-3)
- **Steps:**
  1. Tao preset voi `category: 'restaurant'`, `businessIndex: 999`
  2. Goi `composeFromBlueprint(preset)`
- **Expected:**
  - Throw `Error` voi message co details, vi du: `"businessIndex 999 out of range for category restaurant (max: 3)"`

---

#### TC-F31-033: Composer throw khi pages array qua ngan

- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-03 (high scenario R-09)
- **Precondition:** `composeFromBlueprint` hoat dong
- **Steps:**
  1. Tao preset voi `pages: []` (empty array)
  2. Goi `composeFromBlueprint(preset)`
  3. Tao preset voi chi 1 page
  4. Goi lai
- **Expected:**
  - Case 1 (empty): Throw `"pages array cannot be empty — minimum 4 required"` (hoac equivalent)
  - Case 2 (1 page): Throw hoac warning ro rang

---

#### TC-F31-034: 56 homepages co section order khac nhau

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-06
- **Precondition:** Tat ca 56 TEMPLATE_PRESETS co the compose
- **Steps:**
  1. Compose tat ca 56 presets
  2. Voi moi template: tao signature string tu homepage block order: `blockTypes.join(',')`
  3. Put vao `Set`
  4. Kiem tra `set.size === 56`
- **Expected:**
  - `new Set(homePageOrders).size === 56`
  - Khong co 2 homepages nao co cung thu tu blocks giong het nhau

---

#### TC-F31-035: Co >= 8 hero variants khac nhau trong 56 templates

- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-06
- **Precondition:** Tat ca 56 TEMPLATE_PRESETS co the compose
- **Steps:**
  1. Compose tat ca 56 presets
  2. Lay hero block tu moi homepage
  3. Collect tat ca unique `hero.variant` values
- **Expected:**
  - `uniqueHeroVariants.size >= 8`
  - Cac variants bao gom ca: `parallax`, `fullscreen`, `split-left`, `split-right`, `gradient`, `magazine`, `centered`, `cards-overlay`, v.v.

---

#### TC-F31-036: Template picker hien thi 3 tabs moi

- **Priority:** P1
- **Type:** E2E
- **AC Reference:** AC-08
- **Precondition:** Staging da seed 56 templates, user da login va vao /builder/templates
- **Steps:**
  1. Navigate to `/builder/templates` hoac mo `EditorTemplateModal`
  2. Kiem tra category filter tabs
  3. Click vao tab "Events" (hoac "Events/Wedding")
  4. Click vao tab "Blog" (hoac "Blog/Media")
  5. Click vao tab "Travel" (hoac "Travel/Tourism")
- **Expected:**
  - 3 tabs moi hien thi trong danh sach
  - Moi tab khi click: hien thi dung 4 template cards
  - Khong co "No templates found" state

---

#### TC-F31-037: CATEGORY_DNA dinh nghia signature blocks cho tat ca 14 categories

- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-05
- **Precondition:** Import `CATEGORY_DNA` tu `@/lib/ai/template-definitions`
- **Steps:**
  1. Import `CATEGORY_DNA`
  2. Lay tat ca 14 category keys
  3. Kiem tra moi entry co `signatureBlocks` array voi >= 2 entries
- **Expected:**
  - `CATEGORY_DNA` co dung 14 keys
  - Moi category: `signatureBlocks.length >= 2`
  - `events`, `blog`, `travel` deu co entries hop le

---

### Group D: Validation & Error Handling
> Critical scenarios R-01, R-02, R-03, R-05

#### TC-F31-038: Duplicate TemplatePreset ID bi phat hien truoc khi seed

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-01 (critical scenario R-01)
- **Precondition:** `TEMPLATE_PRESETS` array da duoc import
- **Steps:**
  1. Lay tat ca `preset.id` values tu `TEMPLATE_PRESETS`
  2. So sanh voi `new Set(ids).size`
- **Expected:**
  - `ids.length === new Set(ids).size` (khong co duplicate)
  - Neu co duplicate: test fail voi message bao ten ID bi duplicate

---

#### TC-F31-039: logo-cloud block phai co trong blockRegistry truoc khi seed

- **Priority:** P0
- **Type:** Unit
- **AC Reference:** AC-04 (critical scenario R-03)
- **Precondition:** Import `blockRegistry` tu `@/blocks/registry`
- **Steps:**
  1. Import `blockRegistry`
  2. Check `blockRegistry.has('logo-cloud')`
  3. Check cac blocks khac bat buoc: `faq`, `newsletter`, `mid-cta` hoac `cta`
- **Expected:**
  - `blockRegistry.has('logo-cloud') === true`
  - `blockRegistry.has('faq') === true`
  - `blockRegistry.has('newsletter') === true`
  - Tat ca mandatory blocks deu co trong registry truoc khi bat ky template nao duoc compose

---

#### TC-F31-040: mid-CTA la block 'cta' voi variant 'banner', khong phai blockType rieng

- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-04 (high scenario R-10)
- **Precondition:** `composeFromBlueprint` hoat dong
- **Steps:**
  1. Compose 1 preset co `mid-cta` trong blueprint
  2. Tim block mid-cta trong result layout
  3. Kiem tra `blockType` va `variant`
- **Expected:**
  - Block co `blockType === 'cta'` VÀ `variant === 'banner'`
  - HOAC co `blockType === 'mid-cta'` neu da dang ky rieng trong registry
  - Khong co 2 conventions khac nhau tren cung codebase

---

#### TC-F31-041: Seed khong xoa templates thu cong cua admin (chi xoa by name pattern)

- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-11 (BR-09)
- **Precondition:** DB co templates v3 (tu seed) va 1 template thu cong khong match name pattern
- **Steps:**
  1. Tao 1 template thu cong voi ten khong match pattern seed
  2. Goi `POST /api/templates/seed?force=true&v3=true`
  3. Kiem tra template thu cong
- **Expected:**
  - Template thu cong van con trong DB sau khi seed
  - Seed chi xoa templates match by seeded name pattern
  - Template thu cong khong bi xoa

---

#### TC-F31-042: TemplatePreset co du tat ca required fields

- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-10
- **Precondition:** `TEMPLATE_PRESETS` array da import
- **Steps:**
  1. Loop qua tat ca 56 TEMPLATE_PRESETS
  2. Kiem tra moi required field
- **Expected:**
  - Moi preset co: `id`, `name`, `category`, `businessIndex`, `personality`, `themePreset`, `pages`, `tags`, `description`
  - `id` la non-empty string
  - `name` la non-empty string
  - `personality` la 1 trong 4 gia tri hop le
  - `pages.length >= 4`

---

#### TC-F31-043: composeTemplate() deprecated wrapper van hoat dong

- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-14 (BR backward compat)
- **Precondition:** Import `composeTemplate` (old function) tu `@/lib/ai/template-composer`
- **Steps:**
  1. Import `composeTemplate` (function cu, deprecated)
  2. Goi voi `ComposerInput` format cu: `{ category, businessIndex, variant, themePreset }`
  3. Kiem tra result
- **Expected:**
  - `composeTemplate()` khong throw
  - Tra ve `TemplateSeed` hop le
  - Khong break existing test files (`template-composer.test.ts`)

---

### Group E: Integration Tests
> AC-14, backward compat, template picker

#### TC-F31-044: Apply-template API doc dung templatePages format moi

- **Priority:** P0
- **Type:** Integration
- **AC Reference:** AC-10 (critical scenario R-05)
- **Precondition:** Staging da seed 56 templates v3, user co site
- **Steps:**
  1. Lay 1 template moi tu DB (co `templatePages` array)
  2. Goi apply-template API voi template ID nay
  3. Kiem tra builder state sau khi apply
- **Expected:**
  - Builder load trang voi pages tu `templatePages` (KHONG phai `defaultBlocks`)
  - So luong pages trong builder = `template.templatePages.length` (4-5)
  - Khong co trang blank, khong co loi console

---

#### TC-F31-045: tsc --noEmit pass sau khi rewrite

- **Priority:** P0
- **Type:** Static Analysis
- **AC Reference:** AC-14
- **Precondition:** Da rewrite `template-definitions.ts` va `template-composer.ts`
- **Steps:**
  1. Chay `npx tsc --noEmit`
  2. Kiem tra output
- **Expected:**
  - Exit code = 0
  - Khong co TypeScript errors
  - Dac biet: khong co loi lien quan den `TemplatePreset` type, `personality` field, hay removed tier types

---

#### TC-F31-046: Khong co 'starter' | 'professional' | 'premium' trong new type definitions

- **Priority:** P0
- **Type:** Static Analysis
- **AC Reference:** AC-14
- **Precondition:** Code da rewrite
- **Steps:**
  1. Grep `src/lib/ai/template-definitions.ts` cho strings: `'starter'`, `'professional'`, `'premium'`
  2. Grep `src/lib/ai/template-composer.ts` cho cac strings tuong tu trong type definitions (khong phai trong deprecated wrapper)
- **Expected:**
  - Khong co string nao trong TYPE definitions moi (interface, type alias)
  - Deprecated wrapper `composeTemplate()` co the van reference 'starter'/'professional'/'premium' — duoc chap nhan
  - New `TemplateSeed` type KHONG co `tier` field

---

#### TC-F31-047: template-composer.ts sau rewrite co < 300 dong

- **Priority:** P2
- **Type:** Static Analysis
- **AC Reference:** AC-14 (NFR Maintainability)
- **Precondition:** Rewrite hoan thanh
- **Steps:**
  1. Chay `wc -l src/lib/ai/template-composer.ts`
- **Expected:**
  - Line count < 300
  - Hien tai file la 976 dong — muc tieu giam 70%

---

## 5. Traceability Matrix

| AC ID | Mo Ta | TC IDs | So TCs | Trang Thai |
|---|---|---|---|---|
| AC-01 | 56 Templates Post-Seed | TC-F31-001, TC-F31-002, TC-F31-007, TC-F31-010 | 4 | Phai Pass |
| AC-02 | All Templates Are Premium | TC-F31-003, TC-F31-024 | 2 | Phai Pass |
| AC-03 | 4-5 Pages Per Template | TC-F31-011, TC-F31-012, TC-F31-032, TC-F31-033 | 4 | Phai Pass |
| AC-04 | Mandatory Homepage Blocks | TC-F31-013, TC-F31-014, TC-F31-015, TC-F31-016, TC-F31-039, TC-F31-040 | 6 | Phai Pass |
| AC-05 | Signature Blocks Per Category | TC-F31-017, TC-F31-018, TC-F31-019, TC-F31-037 | 4 | Phai Pass |
| AC-06 | Unique Section Order | TC-F31-034, TC-F31-035 | 2 | Phai Pass |
| AC-07 | 4 Personalities Per Category | TC-F31-020 | 1 | Phai Pass |
| AC-08 | 3 New Categories | TC-F31-025, TC-F31-036 | 2 | Phai Pass |
| AC-09 | Content Files For New Categories | TC-F31-026, TC-F31-027, TC-F31-028, TC-F31-029, TC-F31-030 | 5 | Phai Pass |
| AC-10 | Composer Blueprint-Driven | TC-F31-021, TC-F31-031, TC-F31-040, TC-F31-042, TC-F31-044 | 5 | Phai Pass |
| AC-11 | Seed Force Delete | TC-F31-004, TC-F31-005, TC-F31-006, TC-F31-041 | 4 | Phai Pass |
| AC-12 | Unique Sub-Pages | TC-F31-022 | 1 | Phai Pass |
| AC-13 | Dry Run Mode | TC-F31-008, TC-F31-009 | 2 | Phai Pass |
| AC-14 | TypeScript Compile | TC-F31-043, TC-F31-045, TC-F31-046, TC-F31-047 | 4 | Phai Pass |

**Tong cong: 47 TCs, 14/14 ACs co coverage (100%)**

---

## 6. Business Rules Coverage

| BR ID | Noi Dung | TC Validate | Trang Thai |
|---|---|---|---|
| BR-01 | Tat ca templates `isPremium: true`, khong co `tier` field | TC-F31-003, TC-F31-024 | Phai Pass |
| BR-02 | Moi category dung 4 templates | TC-F31-002 | Phai Pass |
| BR-03 | 4 personalities khac nhau trong 1 category | TC-F31-020 | Phai Pass |
| BR-04 | logo-cloud ngay sau hero, khong chen block khac | TC-F31-015 | Phai Pass |
| BR-05 | FAQ la accordion voi 4-8 cau hoi | TC-F31-016 | Phai Pass |
| BR-06 | Newsletter la block cuoi truoc footer | TC-F31-014 | Phai Pass |
| BR-07 | `composeFromBlueprint()` throw ro rang khi thieu content file | TC-F31-029, TC-F31-030 | Phai Pass |
| BR-08 | Seed endpoint chi cho super-admin | TC-F31-007 | Phai Pass |
| BR-09 | Force delete theo name matching, khong xoa templates thu cong | TC-F31-041 | Phai Pass |

---

## 7. NFR Test Coverage

| NFR | Target | TC / Method |
|---|---|---|
| Performance: `composeFromBlueprint()` < 100ms | < 100ms | `vi.fn()` timer trong unit test, hoac `performance.now()` |
| Performance: Seed 56 templates < 60 giay | < 60s | TC-F31-001 timeout assertion |
| Maintainability: `template-composer.ts` < 300 dong | < 300 lines | TC-F31-047 |
| Type Safety: 0 `any` trong new types | 0 `any` | TC-F31-045 (`tsc --strict`) |
| Backwards Compatibility: `composeTemplate()` van hoat dong | No breaking | TC-F31-043 |
| Security: Seed endpoint auth | super-admin only | TC-F31-007 |
| Data Integrity: Unique preset IDs | 0 duplicates | TC-F31-038 |

---

## 8. Test Execution Order (Recommended)

```
Phase 1 — Static (truoc khi chay bat ky test nao):
  TC-F31-045 → TC-F31-046 → TC-F31-047  (TypeScript compile checks)

Phase 2 — Unit (khong can DB):
  TC-F31-038 → TC-F31-039              (pre-conditions validation)
  TC-F31-020 → TC-F31-042              (TEMPLATE_PRESETS structure)
  TC-F31-011 → TC-F31-024              (composeFromBlueprint core)
  TC-F31-026 → TC-F31-033              (content files + error handling)
  TC-F31-034 → TC-F31-035              (uniqueness checks)
  TC-F31-037 → TC-F31-043              (category DNA + backward compat)

Phase 3 — Integration (can DB staging):
  TC-F31-001 → TC-F31-010              (seed endpoint)
  TC-F31-004 → TC-F31-006              (force delete scenarios)
  TC-F31-044                           (apply-template API)

Phase 4 — E2E (can staging deploy):
  TC-F31-036                           (template picker UI)
```

---

## 9. Definition of Done (DoD) cho F31

| Tieu Chi | Dieu Kien Pass | Kiem Tra Boi |
|---|---|---|
| All P0 TCs pass | 18/18 P0 test cases xanh | QA chay tren staging |
| All P1 TCs pass | 20/20 P1 test cases xanh | QA chay tren staging |
| AC Coverage | 14/14 ACs duoc cover | Traceability matrix |
| TypeScript | `tsc --noEmit` exit 0 | CI auto-check |
| DB State | 56 templates sau seed | Query DB |
| No regression | Existing tests khong bi break | CI suite pass |
| Backward compat | `composeTemplate()` cu van pass | `template-composer.test.ts` |

---

## 10. Files Test Can Tao/Cap Nhat

| File | Hanh Dong | Priority |
|---|---|---|
| `src/__tests__/unit/templates/template-definitions.test.ts` | Rewrite: test `TEMPLATE_PRESETS` (56 entries, personality, no tier) thay cho `TEMPLATE_DEFINITIONS` (48 entries, variant) | P0 |
| `src/__tests__/unit/templates/template-composer.test.ts` | Update: them test cho `composeFromBlueprint()`, giu test cu cho `composeTemplate()` deprecated wrapper | P0 |
| `src/__tests__/integration/template-smoke.test.ts` | Rewrite: 48→56, tier-based → blueprint-based, them 3 categories moi | P0 |
| `src/__tests__/unit/templates/template-content.test.ts` | Tao moi: test `getCategoryContent()` cho 14 categories bao gom events, blog, travel | P0 |
| `src/__tests__/integration/seed-endpoint.test.ts` | Tao moi: integration test cho POST /api/templates/seed voi force, dry, v3 modes | P1 |

---

*Tong ket: 47 test cases, 14/14 ACs covered (100%), 9/9 BRs covered (100%), 6 critical + 10 high scenarios mapped.*
