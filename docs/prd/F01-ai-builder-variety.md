# PRD: AI Website Generation Variety Fix (F01-variety)
> **Version:** 1.0 | **Updated:** 2026-04-12 | **Agent:** `documentation-engineer`
> **Priority:** P1 | **Sprint:** Wave 3 — Sprint 3 | **Size:** L
> **Extends:** [F01 AI Web Builder](./F01-ai-builder.md) | **Depends on:** F04 Block Renderer

---

> [!IMPORTANT]
> **Sub-feature của F01.** PRD này mô tả cải tiến pipeline AI generation để giải quyết vấn đề websites bị trùng lặp về layout và visual. Mọi thay đổi phải backward-compatible với các site đã generate.

---

## 0. Story Traceability

| Story ID | Title | Status |
|----------|-------|--------|
| US-F01V-01 | AI Generation Produces Visually Distinct Sites | Ready |
| US-F01V-02 | Sanitizer Preserves AI Creative Choices | Ready |
| US-F01V-03 | Fallback Generator Produces Varied Output | Ready |

---

## 1. Problem Statement

### 1.1 Tình trạng hiện tại

Toàn bộ website được generate bởi AI đều trông **giống nhau về cấu trúc và visual**, dù hệ thống đã có 47 blocks với 142 variants sẵn sàng sử dụng. Đây là lỗi kiến trúc hệ thống, không phải lỗi của người dùng hay nội dung.

**Bằng chứng cụ thể:**

- **Prompt variety bị chặn từ đầu:** System prompt liệt kê 47 blocks nhưng không có bất kỳ instruction nào yêu cầu AI phải chọn variant đa dạng. Rule duy nhất là "Generate 4 pages: Homepage (8-14 blocks)" — không có yêu cầu về TYPE diversity hay block ordering.

- **Sanitizer giết variety sau khi AI đã chọn:** Khi AI trả về variant hợp lệ nhưng viết sai case (vd: `"Grid-3"` thay vì `"grid-3"`), sanitizer tại `openai-generator.ts` line 255-261 thay bằng `meta.defaultVariant || meta.variants[0]` — tức là **luôn luôn dùng variant đầu tiên**, không bao giờ là variant đa dạng. Không có log nào ghi nhận bao nhiêu variety bị kill mỗi ngày.

- **Fallback generator là 100% deterministic:** Khi AI call thất bại (timeout, missing API key), `generate-blocks.ts` luôn trả về đúng 7 blocks theo thứ tự cố định (nav → hero → about → features → testimonials → contact → footer), tất cả variant đều hardcode. Mỗi loại business type chỉ có 1 theme palette duy nhất.

- **Variant audit:** 140/142 variants render đúng. 2 issues: `hero:animated-gradient` không có implementation, `hero:split-right` render giống `hero:split-left`. Còn lại 138 variants sẵn sàng nhưng chưa được dùng.

- **Template composer bị hardcode:** 14/15 builder functions trong `template-composer.ts` hardcode một variant duy nhất. `buildFeatures` luôn là `"grid-3"`, `buildTestimonials` luôn là `"cards"`, `buildFooter` luôn là `"simple"`. Chỉ `buildHero` có rotate nhờ `themePresetIndex % variants.length`.

### 1.2 Impact kinh doanh

Người dùng nhận ra pattern lặp lại → mất tin tưởng vào AI builder → giảm conversion từ free → paid. Đây là **USP #1 của PrimeWeb** — nếu AI generate website trông giống nhau, lợi thế cạnh tranh biến mất.

---

## 2. Target User

Giống F01 gốc — SME owner không có kỹ thuật, muốn website trong vòng 5 phút. Với fix này, user sẽ nhận được website cảm giác được **thiết kế riêng** cho doanh nghiệp của mình, thay vì một template chung.

---

## 3. Solution Overview

Sửa 4 thành phần trong pipeline AI generation theo 5 phases độc lập, có thể deploy từng phase:

| Phase | Component | File | Impact |
|-------|-----------|------|--------|
| 02 | System Prompt | `system-prompt.ts` | Cao nhất — AI chọn đa dạng hơn |
| 03 | Sanitizer | `openai-generator.ts` | Ngăn sanitizer kill variety |
| 04 | Fallback Generator | `generate-blocks.ts` | Variety khi AI fail |
| 05 | Template Composer | `template-composer.ts`, `template-definitions.ts` | Variety cho template path |

Tất cả thay đổi phải **backward-compatible**: sites đã generate không bị ảnh hưởng, seed-based reproducibility cho phép debug.

---

## 4. Scope

### In Scope

- Thêm VARIETY RULES section vào system prompt (Phase 02)
- Thêm STYLE_PERSONALITIES array (8 personalities) vào user prompt builder (Phase 02)
- Thêm CATEGORY_BLOCK_HINTS với 3 composition sequences per category (Phase 02)
- Sửa sanitizer: case-insensitive matching + random fallback thay vì always-default (Phase 03)
- Thêm VARIANT_ALIASES map để handle AI hallucination patterns (Phase 03)
- Thêm console.warn logging cho mọi variant replacement (Phase 03)
- Thêm seeded PRNG (`createSeededRandom`, `pickRandom`, `shuffleArray`) vào fallback generator (Phase 04)
- Mở rộng fallback generator từ 7 blocks cố định thành pool-based selection (Phase 04)
- Mở rộng THEME_PALETTES từ 1 lên 3 palettes per category trong fallback (Phase 04)
- Thêm `compositionSeed` vào `ComposerInput` type (Phase 05)
- Tạo `selectVariant()` function dùng seed-based hash (Phase 05)
- Refactor 15 builder functions trong template-composer thêm optional `variant?` param (Phase 05)
- Shuffle middle blocks trong `buildHomePage()` theo seed (Phase 05)
- Thêm `compositionSeed` vào 48 template definitions cũ (Phase 05)

### Out of Scope

- Thay OpenAI GPT-4o bằng model khác để tăng variety
- Thêm blocks mới vào block registry (thuộc F30/F31 sprint)
- Sửa 2 broken variants (`hero:animated-gradient`, `hero:split-right`) — đây là bug riêng
- UI cho phép user chọn "style personality" thủ công — đây là Phase 2 roadmap
- A/B testing framework để đo variety impact — thuộc F22 Analytics

---

## 5. Success Metrics

| Metric | Baseline | Target | Đo bằng |
|--------|----------|--------|---------|
| Hero variant diversity (10 lần generate cùng input) | 1-2 variants | >= 5 variants | Test script |
| Features layout diversity (10 lần) | 1 variant (grid-3) | >= 3 variants | Test script |
| Footer style diversity (10 lần) | 1 variant (simple) | >= 3 variants | Test script |
| Block ordering diversity (10 lần) | 0 (fixed) | >= 6 unique orderings | Test script |
| Sanitizer replacements logged | 0% | 100% có log | console.warn |
| Fallback generator variety (10 lần, no seed) | 1 layout | >= 7 distinct layouts | Unit test |
| Variant audit coverage | 140/142 | 140/142 (giữ nguyên) | CI check |

---

## 6. User Stories

### US-F01V-01: AI Generation Produces Visually Distinct Sites

```
AS A   SME owner dùng PrimeWeb lần đầu
I WANT TO  nhận được website có layout và visual style trông khác biệt
           với website của doanh nghiệp khác cùng ngành
SO THAT    tôi cảm thấy website được tạo riêng cho mình,
           không phải template chung cho mọi người
```

**Acceptance Criteria:** Xem AC-01, AC-02, AC-03, AC-04

---

### US-F01V-02: Sanitizer Preserves AI Creative Choices

```
AS A   developer debug AI pipeline
I WANT TO  thấy log cụ thể khi sanitizer thay thế variant nào
           và tại sao
SO THAT    tôi biết AI có đang chọn đa dạng không,
           hay sanitizer đang cancel các lựa chọn đó
```

**Acceptance Criteria:** Xem AC-05, AC-06

---

### US-F01V-03: Fallback Generator Produces Varied Output

```
AS A   user generate website khi OpenAI API bị timeout
I WANT TO  vẫn nhận được một website có block layout khác biệt
           với lần generate trước
SO THAT    fallback experience không tệ hơn AI experience
           về mặt visual variety
```

**Acceptance Criteria:** Xem AC-07, AC-08, AC-09

---

## 7. Functional Requirements

| FR-ID | Requirement | Phase | Priority | Notes |
|-------|-------------|-------|----------|-------|
| FR-V-01 | System prompt PHẢI có VARIETY RULES section yêu cầu AI không default về variant đầu tiên | 02 | P0 | Thêm sau line 100 của system-prompt.ts |
| FR-V-02 | User prompt PHẢI include một style personality được chọn ngẫu nhiên từ 8 options mỗi lần generate | 02 | P0 | `STYLE_PERSONALITIES[]` array |
| FR-V-03 | System prompt PHẢI có CATEGORY_BLOCK_HINTS với tối thiểu 3 composition sequences khác nhau per category | 02 | P1 | Hint được chọn ngẫu nhiên và đưa vào user prompt |
| FR-V-04 | System prompt PHẢI có variant-by-mood hints (Dramatic/Professional/Creative/Personal) cho hero block | 02 | P1 | Linked với style personality |
| FR-V-05 | Sanitizer PHẢI thử case-insensitive match trước khi fallback | 03 | P0 | `"Grid-3"` → `"grid-3"` preserved |
| FR-V-06 | Khi variant không match sau fuzzy matching, sanitizer PHẢI chọn ngẫu nhiên từ valid variants, KHÔNG phải luôn lấy default | 03 | P0 | Random trong `meta.variants[]` |
| FR-V-07 | Mỗi variant replacement PHẢI được log với format: `[AI Sanitizer] "{blockType}": "{original}" -> "{replacement}" (not in [...])` | 03 | P0 | console.warn |
| FR-V-08 | VARIANT_ALIASES map PHẢI handle tối thiểu 8 common AI hallucination patterns | 03 | P1 | Xem danh sách aliases |
| FR-V-09 | Fallback generator PHẢI dùng seeded PRNG (`createSeededRandom`) — không dùng `Math.random()` trực tiếp | 04 | P0 | Reproducibility khi debug |
| FR-V-10 | Fallback generator PHẢI có middle block pool với tối thiểu 9 blocks, chọn 4-7 ngẫu nhiên | 04 | P0 | Nav first, footer last |
| FR-V-11 | Mỗi category trong fallback PHẢI có tối thiểu 3 theme palettes khác nhau | 04 | P1 | ThemeConfig objects |
| FR-V-12 | Mỗi category trong fallback PHẢI có tối thiểu 3 content variations (hero headline, features, CTA text) | 04 | P1 | Giảm repetitive content |
| FR-V-13 | Fallback generator PHẢI export `seed?: number` param — caller truyền `Date.now()` | 04 | P1 | Backward-compatible |
| FR-V-14 | `ComposerInput` type PHẢI có `compositionSeed?: number` field | 05 | P0 | Không breaking change — optional |
| FR-V-15 | Template composer PHẢI có `selectVariant(blockType, seed, category)` function dùng `simpleHash` | 05 | P0 | Deterministic per seed |
| FR-V-16 | Tất cả 15 builder functions trong template-composer PHẢI nhận optional `variant?: string` param | 05 | P0 | Existing hardcode là default fallback |
| FR-V-17 | `buildHomePage()` PHẢI shuffle middle blocks theo `compositionSeed` | 05 | P0 | Nav first, footer last |
| FR-V-18 | Optional blocks (newsletter, team, faq) trong professional/premium tiers: 70% inclusion probability theo seed | 05 | P1 | `rand() > 0.3` |
| FR-V-19 | 48 template definitions cũ PHẢI có `compositionSeed` field (giá trị: `index * 7919`) | 05 | P1 | Không thay đổi existing behavior khi undefined |
| FR-V-20 | `composeFromBlueprint()` PHẢI dùng `selectVariant()` khi `BlockSpec.variant` là undefined | 05 | P1 | 56 new blueprints affected |

---

## 8. Business Rules

- **BR-V-01:** Variety enhancement KHÔNG được thay đổi content hoặc structure của sites đã generate — chỉ ảnh hưởng các lần generate mới
- **BR-V-02:** Seed-based randomization bắt buộc cho template composer — user có thể reproduce cùng layout bằng cách dùng cùng seed
- **BR-V-03:** Chỉ random từ **verified valid variants** (140 variants đã pass audit) — KHÔNG random vào broken variants
- **BR-V-04:** Style personality injection vào user prompt KHÔNG tăng token count quá 5% so với prompt hiện tại
- **BR-V-05:** `console.warn` cho mọi sanitizer replacement — KHÔNG `console.log` (phân biệt severity)

---

## 9. Technical Architecture

### 9.1 Key Types (thay đổi)

```typescript
// src/lib/ai/template-composer.ts
export type ComposerInput = {
    category: string
    businessIndex: number
    variant: 'starter' | 'professional' | 'premium'
    themePreset: ThemePreset
    compositionSeed?: number  // NEW — undefined = backward-compatible behavior
}

// src/lib/ai/generate-blocks.ts (updated signature)
export function generateBlocks(
    prompt: string,
    seed?: number  // NEW — undefined = Date.now() internally
): GenerationResult

// src/lib/ai/system-prompt.ts (new constants)
const STYLE_PERSONALITIES: string[] = [
    'Bold and energetic',
    'Minimal and sophisticated',
    'Warm and inviting',
    'Professional and authoritative',
    'Creative and playful',
    'Luxurious and premium',
    'Modern tech',
    'Editorial and storytelling',
]
```

### 9.2 New Utilities

```typescript
// src/lib/ai/generate-blocks.ts — seeded PRNG
function createSeededRandom(seed?: number): () => number
function pickRandom<T>(arr: T[], rand: () => number): T
function shuffleArray<T>(arr: T[], rand: () => number): T[]

// src/lib/ai/template-composer.ts — variant selector
function simpleHash(str: string): number
function selectVariant(blockType: string, seed: number, category: string): string

// src/lib/ai/openai-generator.ts — variant aliases
const VARIANT_ALIASES: Record<string, string> = {
    'three-column': 'grid-3',
    'two-column': 'grid-2',
    'four-column': 'grid-4',
    'side-by-side': 'split',
    'slider': 'carousel',
    'full-width': 'fullscreen',
    'compact': 'minimal',
    'simple-grid': 'grid-2',
}
```

### 9.3 API Route

Không thay đổi API contract. Endpoint `POST /api/ai/generate-site` vẫn giữ nguyên request/response shape. Thay đổi là internal pipeline only.

### 9.4 Block Variant Pool (Phase 04)

```typescript
const VARIANT_OPTIONS: Record<string, string[]> = {
    hero: ['centered', 'split-left', 'split-right', 'fullscreen', 'gradient', 'parallax', 'magazine', 'minimal'],
    features: ['grid-2', 'grid-3', 'grid-4', 'list', 'icon-top', 'icon-left', 'zigzag'],
    testimonials: ['cards', 'carousel', 'simple', 'masonry', 'spotlight', 'minimal-quote'],
    contact: ['form', 'split', 'card-float', 'minimal-inline'],
    footer: ['simple', 'expanded', 'minimal', 'centered-stack', 'mega-footer', 'dark-gradient'],
    faq: ['accordion', 'grid', 'simple'],
    cta: ['banner', 'inline', 'floating'],
    stats: ['row', 'grid', 'highlight'],
    gallery: ['grid', 'masonry', 'carousel', 'lightbox'],
    navigation: ['simple', 'centered', 'transparent', 'pill'],
}
```

---

## 10. Phase Breakdown

### Phase 02 — Fix System Prompt (1-2 ngày)
**Files:** `src/lib/ai/system-prompt.ts`

- Thêm `## VARIETY RULES` section (6 rules) sau line 100
- Thêm `STYLE_PERSONALITIES` constant (8 options)
- Update `buildUserPrompt()` để inject random personality mỗi call
- Thêm `CATEGORY_BLOCK_HINTS` với 3 sequences per category
- Thêm variant-by-mood hints trong system prompt

**Deploy độc lập:** Có. Thay đổi prompt-only, không affect code path khác.

---

### Phase 03 — Fix Sanitizer (1 ngày)
**Files:** `src/lib/ai/openai-generator.ts`

- Thay `meta.defaultVariant || meta.variants[0]` bằng logic: case-insensitive match → alias check → random valid variant
- Thêm `VARIANT_ALIASES` constant
- Thêm `console.warn` log cho mọi replacement
- Fix gallery image stripping (line 523): chỉ strip `image` URL, giữ `alt` và `caption`

**Deploy độc lập:** Có. Chỉ thay đổi validation logic trong sanitizer.

---

### Phase 04 — Fix Fallback Generator (2-3 ngày)
**Files:** `src/lib/ai/generate-blocks.ts`

- Thêm `createSeededRandom`, `pickRandom`, `shuffleArray` utilities
- Thêm `MIDDLE_BLOCK_POOL` (9 blocks) và logic chọn 4-7 ngẫu nhiên
- Thêm `VARIANT_OPTIONS` per block type
- Mở rộng `THEME_PALETTES` lên 3 palettes per category
- Thêm 3 content variations per category
- Update function signature thêm `seed?: number`
- Update caller trong `openai-generator.ts` truyền `Date.now()`

**Deploy độc lập:** Có. Chỉ ảnh hưởng fallback path (AI fail/missing key).

---

### Phase 05 — Fix Template Composer (2-3 ngày)
**Files:** `src/lib/ai/template-composer.ts`, `src/lib/ai/template-definitions.ts`

- Thêm `compositionSeed?: number` vào `ComposerInput` type
- Implement `simpleHash()` và `selectVariant()` functions
- Thêm optional `variant?: string` param vào 15 builder functions
- Wire `selectVariant()` trong `buildHomePage()`
- Implement middle block shuffle theo seed
- Implement optional block inclusion (70% probability)
- Thêm `compositionSeed` vào 48 template definitions
- Update `composeFromBlueprint()` cho 56 new blueprints

**Deploy độc lập:** Có nhưng rủi ro cao nhất — cần test đầy đủ 47 blocks trước khi deploy.

---

## 11. Acceptance Criteria

### AC-01: Hero Variant Diversity
**GIVEN** user generate 10 websites cùng input "Coffee Shop, Ho Chi Minh City"
**WHEN** AI path hoạt động bình thường (không fallback)
**THEN** tối thiểu 5 trong số 10 websites có hero variant khác nhau (đo bằng `generationResult.blocks[heroIndex].variant`)

---

### AC-02: Features Layout Diversity
**GIVEN** user generate 10 websites cùng input bất kỳ
**WHEN** AI path hoạt động bình thường
**THEN** features block KHÔNG được chọn `"grid-3"` hơn 4/10 lần; tối thiểu 3 variants khác nhau xuất hiện trong 10 lần

---

### AC-03: Block Order Diversity
**GIVEN** user generate 10 websites cùng input bất kỳ
**WHEN** AI path hoạt động bình thường
**THEN** tối thiểu 6 trong 10 websites có thứ tự middle blocks khác nhau (nav và footer luôn ở đầu và cuối)

---

### AC-04: Style Personality Injection
**GIVEN** developer inspect user prompt được gửi đến OpenAI API
**WHEN** user click "Tạo Website"
**THEN** prompt PHẢI chứa line `Design personality: {personality}` với một trong 8 personalities được định nghĩa trong `STYLE_PERSONALITIES`; personality được chọn ngẫu nhiên mỗi call

---

### AC-05: Sanitizer Fuzzy Matching
**GIVEN** AI trả về variant `"Grid-3"` (uppercase G) cho block type `"features"`
**WHEN** sanitizer xử lý response
**THEN** sanitizer PHẢI convert thành `"grid-3"` (lowercase) và KHÔNG log replacement; block được render với `grid-3` variant

---

### AC-06: Sanitizer Random Fallback với Log
**GIVEN** AI trả về variant `"hexagonal-grid"` — một variant không tồn tại cho block type `"features"`
**WHEN** sanitizer xử lý response
**THEN** sanitizer PHẢI log `[AI Sanitizer] "features": "hexagonal-grid" -> "{replacement}" (not in [grid-2, grid-3, ...])`; replacement được chọn ngẫu nhiên từ valid variants, KHÔNG phải luôn luôn là `"grid-3"`

---

### AC-07: Fallback Seeded PRNG
**GIVEN** OpenAI API không available và `generateBlocks()` được gọi với `seed = 12345`
**WHEN** function được gọi hai lần liên tiếp với cùng seed
**THEN** cả hai lần trả về kết quả giống hệt nhau (same block order, same variants, same theme)

---

### AC-08: Fallback Variety Without Seed
**GIVEN** OpenAI API không available và `generateBlocks()` được gọi 10 lần liên tiếp (không truyền seed)
**WHEN** observer so sánh kết quả
**THEN** tối thiểu 7 trong 10 results có block composition (tập hợp block types) khác nhau

---

### AC-09: Fallback Theme Variety
**GIVEN** OpenAI API không available và `generateBlocks()` được gọi 10 lần với `type = "restaurant"`
**WHEN** observer so sánh `result.theme.primaryColor`
**THEN** tối thiểu 3 giá trị `primaryColor` khác nhau xuất hiện trong 10 kết quả

---

### AC-10: Template Composer Seed-Based Variety
**GIVEN** hai template definitions cùng category `"restaurant"` có `compositionSeed` khác nhau
**WHEN** template composer build homepage cho cả hai
**THEN** block order của middle section KHÁC nhau; HOẶC tối thiểu 2 block variants (features, testimonials, footer) KHÁC nhau

---

### AC-11: Composer Reproducibility
**GIVEN** `ComposerInput` với `compositionSeed = 42` cho category `"restaurant"`
**WHEN** `buildHomePage()` được gọi hai lần với cùng input
**THEN** output block list giống hệt nhau (cùng order, cùng variants)

---

### AC-12: Blueprint Variant Auto-Selection
**GIVEN** một blueprint (`PageBlueprint`) có `BlockSpec` với `variant: undefined`
**WHEN** `composeFromBlueprint()` xử lý blueprint đó
**THEN** block được compose với variant được chọn bởi `selectVariant(blockType, seed, category)`, KHÔNG phải hardcoded default của builder function

---

### AC-13: Backward Compatibility — Existing Sites
**GIVEN** một site đã được generate và lưu vào Payload CMS trước khi deploy feature này
**WHEN** site được load trên storefront hoặc trong editor
**THEN** site render KHÔNG có lỗi, block structure và variants KHÔNG thay đổi

---

### AC-14: Backward Compatibility — ComposerInput Without Seed
**GIVEN** caller tạo `ComposerInput` không truyền `compositionSeed` (undefined)
**WHEN** template composer xử lý input
**THEN** behavior giống như trước khi có feature này: hardcoded variants, fixed block order (no random)

---

---

## 12. Non-Functional Requirements

| Category | Requirement | Target | Notes |
|----------|-------------|--------|-------|
| **Performance** | Variety changes KHÔNG tăng latency generation | p95 < 60s (giữ nguyên) | Prompt dài hơn ~5% là chấp nhận được |
| **Token Cost** | VARIETY RULES section KHÔNG tăng token count quá 200 tokens | < 200 tokens tăng thêm | Đo bằng `tiktoken` |
| **Reproducibility** | Same seed → same output, 100% deterministic | 100% | Critical cho debugging |
| **Variety Coverage** | Sau fix, tối thiểu 20/47 blocks được sử dụng trong 100 lần generate | >= 20 block types | Tính bằng unique `blockType` |
| **Audit Trail** | 100% sanitizer replacements được log | 100% | console.warn |
| **Test Coverage** | Unit tests cho mọi utility function mới | >= 80% line coverage | Vitest |
| **Build Safety** | `tsc --noEmit` pass sau refactor 15 builder functions | 0 TypeScript errors | CI block |

---

## 13. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| GPT-4o bỏ qua VARIETY RULES và vẫn chọn safe defaults | Trung bình | Cao — Phase 02 không có effect | Thêm rule "NEVER default to first" + explicit list "use ALL 12 hero options". Validate bằng test script 10 lần generate. |
| Random variant trong sanitizer tạo ra visual clash với content | Thấp | Trung bình — site trông lạ | Tạo "variant whitelist" per block type — chỉ random từ 140 verified variants, loại trừ 2 broken variants. |
| Refactor 15 builder functions trong 1100-line file tạo regression | Cao | Cao — sites không render | Optional param với hardcoded default là fallback. CI phải run visual regression test cho 47 blocks trước khi merge Phase 05. |
| Seeded PRNG trong fallback tạo bias về một số variant | Thấp | Thấp — chỉ ảnh hưởng fallback path | Test 1000 runs, verify distribution của từng variant. |
| `compositionSeed` trong template definitions làm thay đổi existing template previews | Trung bình | Thấp — chỉ preview, không affect published sites | Apply seed chỉ cho templates mới. Existing 48 templates giữ `compositionSeed: undefined` cho backward compat. |

---

## 14. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | 2 broken variants (`hero:animated-gradient`, `hero:split-right`) — fix trong sprint này hay tạo ticket riêng? | Tech Lead | Open |
| 2 | Sanitization stats counter (export `getSanitizationStats()`) có cần expose qua admin API không? | PM | Open |
| 3 | Style personality — user có muốn thấy và chọn personality trước khi generate không? (Phase 2 roadmap) | PM | Open |
| 4 | Khi AI chọn personality "Luxurious and premium" nhưng user input là "Street food stall" — có cần guard logic không? | Dev | Open |

---

## 15. 9-Point Done Checklist

- [ ] Phase 02: System prompt có VARIETY RULES section đầy đủ 6 rules
- [ ] Phase 02: `buildUserPrompt()` inject random personality mỗi call
- [ ] Phase 03: Sanitizer dùng case-insensitive match + fuzzy alias + random fallback
- [ ] Phase 03: 100% replacements có console.warn log
- [ ] Phase 04: `generateBlocks()` có seeded PRNG, middle block pool, 3 theme palettes/category
- [ ] Phase 05: Tất cả 15 builder functions có optional `variant?` param
- [ ] Phase 05: `selectVariant()` function hoạt động deterministic theo seed
- [ ] TypeScript Clean: `tsc --noEmit` pass sau refactor Phase 05
- [ ] Test: Script verify 10 lần generate cùng input → >= 5 distinct hero variants

---

## 16. Definition of Ready

- [ ] Root causes đã xác nhận qua code review (done — xem `plans/260412-2156-ai-gen-website-audit/`)
- [ ] Variant audit hoàn thành: 140/142 valid, 2 known issues documented
- [ ] Phase files (02-05) đã có Implementation Steps chi tiết
- [ ] `VARIANT_OPTIONS`, `STYLE_PERSONALITIES`, `CATEGORY_BLOCK_HINTS` values đã approve
- [ ] Success metrics đã có baseline (hero diversity = 1-2 variants hiện tại)
- [ ] Test script plan đã define (10 identical inputs → measure diversity)

---

## 17. Definition of Done

- [ ] Tất cả 20 FR items (FR-V-01 đến FR-V-20) implemented và verified
- [ ] Tất cả 14 AC items (AC-01 đến AC-14) pass
- [ ] 9-Point Checklist đầy đủ
- [ ] Test script chạy 10 lần: hero diversity >= 5 variants ✓
- [ ] Test script chạy 10 lần: features diversity >= 3 variants ✓
- [ ] Sanitizer log xuất hiện trong console khi có replacement ✓
- [ ] Fallback 10 lần no-seed: >= 7 distinct layouts ✓
- [ ] `tsc --noEmit` pass ✓
- [ ] Existing sites không bị ảnh hưởng (backward compat test pass) ✓
- [ ] QA report viết tại `docs/qa/F01-ai-builder-variety.md` ✓
