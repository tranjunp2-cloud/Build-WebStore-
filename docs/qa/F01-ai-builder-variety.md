# QA Test Plan: F01 — AI Website Generation Variety Fix

> **Phiên bản:** 1.0
> **Ngày tạo:** 2026-04-12
> **Tác giả:** QA Engineer (Agent)
> **Nhánh:** `chore/cleanup-env-vars`
> **Nguồn tham chiếu:** PRD ACs (AC-01 → AC-14), source code `src/lib/ai/`

---

## 1. Tổng Quan

Feature này sửa vấn đề AI sinh website bị lặp (hero variant, block layout, style personality). Mục tiêu là đảm bảo mỗi lần generate ra kết quả đủ đa dạng, đồng thời không làm hỏng backward compatibility cho các site đã tồn tại.

**Phạm vi:**
- 4 module: `system-prompt.ts`, `openai-generator.ts`, `generate-blocks.ts`, `template-composer.ts`
- 14 Acceptance Criteria (AC-01 → AC-14)
- 26 risk scenarios (tập trung Critical + High)

---

## 2. Test Strategy

### 2.1 Phân tầng theo Test Pyramid

```
         ┌─────────────────────────────────┐
         │   E2E (Playwright) — 3 tests    │  ← Chỉ smoke path + backward compat
         ├─────────────────────────────────┤
         │ Integration — 8 tests           │  ← generateSiteWithAI() full flow
         ├─────────────────────────────────┤
         │  Unit (Vitest) — 30+ tests      │  ← Pure functions, sanitizer, PRNG
         └─────────────────────────────────┘
```

### 2.2 Phân bổ theo phase

| Phase | Module | Số TC | Loại test chính |
|-------|--------|-------|-----------------|
| Phase 02 | `system-prompt.ts` | 7 | Unit |
| Phase 03 | `openai-generator.ts` — sanitizer | 8 | Unit |
| Phase 04 | `generate-blocks.ts` — fallback generator | 6 | Unit |
| Phase 05 | `template-composer.ts` — composer | 7 | Unit |
| Backward Compat | `openai-generator.ts` + `template-composer.ts` | 4 | Unit + Integration |
| Edge Cases | Scenario-driven (Critical/High risks) | 6 | Unit |

**Tổng: 38 test cases**

### 2.3 Công cụ

| Loại | Tool | File đặt |
|------|------|----------|
| Unit | Vitest + TypeScript | `src/__tests__/unit/builder/ai-variety-*.test.ts` |
| Integration | Vitest + vi.mock(OpenAI) | `src/__tests__/unit/builder/ai-variety-integration.test.ts` |
| E2E | Playwright | `src/__tests__/e2e/ai-builder-variety.spec.ts` |

---

## 3. Risk Assessment

| # | Scenario | Module | Severity | Xác suất | Mức rủi ro |
|---|----------|--------|----------|----------|------------|
| R-01 | `blockRegistry.getBlockMeta()` trả `undefined` → crash | `openai-generator.ts` | Critical | Trung bình | **Blocker** |
| R-02 | `STYLE_PERSONALITIES` rỗng hoặc `undefined` → `NaN` khi tính index | `system-prompt.ts` | High | Thấp | **High** |
| R-03 | PRNG seed overflow: `Date.now() > 2^32` → modulo sai | `generate-blocks.ts` | High | Cao | **High** |
| R-04 | AI trả variant là `number` (`3`) thay vì `string` (`"grid-3"`) | `openai-generator.ts` | High | Cao | **High** |
| R-05 | SSE stream AI timeout → fallback không phát `done` event | `openai-generator.ts` | High | Trung bình | **High** |
| R-06 | JSON truncate mất page 4 → `pages` array incomplete | `openai-generator.ts` | High | Trung bình | **High** |
| R-07 | Variant string rỗng `""` → sanitizer không xử lý | `openai-generator.ts` | Medium | Trung bình | **Medium** |
| R-08 | `simpleHash("")` trả `0` → luôn chọn variant đầu tiên | `template-composer.ts` | Medium | Cao | **Medium** |
| R-09 | Block ordering: stats trước features → UI logic sai | `template-composer.ts` | Medium | Thấp | **Medium** |
| R-10 | Carousel variant chỉ 1 item → render empty | `template-composer.ts` | Medium | Thấp | **Medium** |

---

## 4. Test Cases

### Phase 02 — System Prompt (`system-prompt.ts`)

---

#### TC-F01-V.01

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.01 |
| **AC** | AC-04 |
| **Tiêu đề** | `buildUserPrompt()` — inject "Design personality" khi có `stylePersonality` |
| **Priority** | Blocker |
| **Type** | Unit |
| **Test Data** | `businessInfo = { businessName: 'Nasi Kandar Pelita', industry: 'restaurant', ... }`, `stylePersonality = 'warm & inviting'` |
| **Bước thực hiện** | 1. Import `buildUserPrompt` từ `@/lib/ai/system-prompt`. 2. Gọi `buildUserPrompt(businessInfo, undefined, 'auto', undefined)` với `stylePersonality` được truyền qua parameter mới (hoặc `extraInstructions`). |
| **Kết quả mong đợi** | Chuỗi kết quả chứa substring `"Design personality: warm & inviting"`. |
| **Ghi chú** | Nếu `buildUserPrompt` chưa có param này, test sẽ FAIL và chỉ ra cần thêm param. |

---

#### TC-F01-V.02

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.02 |
| **AC** | AC-04 |
| **Tiêu đề** | `buildUserPrompt()` — KHÔNG có "Design personality" khi không truyền personality |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | `businessInfo` hợp lệ, không truyền `stylePersonality` |
| **Bước thực hiện** | 1. Gọi `buildUserPrompt(businessInfo)` không có argument thứ 5. |
| **Kết quả mong đợi** | Chuỗi kết quả KHÔNG chứa `"Design personality:"`. |
| **Ghi chú** | Đảm bảo backward compat — prompts cũ không bị thêm noise. |

---

#### TC-F01-V.03

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.03 |
| **AC** | AC-04 |
| **Tiêu đề** | `buildUserPrompt()` — inject đúng ngôn ngữ khi `language = 'vi'` |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | `language = 'vi'`, `businessInfo.businessName = 'Quán Cơm Ngon'` |
| **Bước thực hiện** | 1. Gọi `buildUserPrompt(businessInfo, undefined, 'vi')`. |
| **Kết quả mong đợi** | Chuỗi chứa `"Vietnamese"`, không chứa `"Malay"` hay `"English"` trong phần language instruction. |

---

#### TC-F01-V.04

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.04 |
| **AC** | AC-04 |
| **Tiêu đề** | `buildSystemPrompt()` — include block registry metadata vào prompt |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | Mock `blockRegistry.getAllMeta()` trả 5 block types |
| **Bước thực hiện** | 1. Mock `blockRegistry`. 2. Gọi `buildSystemPrompt()`. |
| **Kết quả mong đợi** | Chuỗi system prompt chứa tên các block types từ registry. Số block types khớp với `(${5} total)`. |

---

#### TC-F01-V.05

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.05 |
| **AC** | AC-04 |
| **Tiêu đề** | `buildUserPrompt()` — append `referencePrompt` đúng vị trí |
| **Priority** | Medium |
| **Type** | Unit |
| **Test Data** | `referencePrompt = 'REFERENCE CONTENT: Hero headline is XYZ'` |
| **Bước thực hiện** | 1. Gọi `buildUserPrompt(businessInfo, undefined, 'auto', referencePrompt)`. |
| **Kết quả mong đợi** | Chuỗi chứa `referencePrompt` và `"IMPORTANT: Use the EXACT text"`. |

---

#### TC-F01-V.06

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.06 |
| **AC** | AC-04 |
| **Tiêu đề** | `buildUserPrompt()` — language 'ms' sinh instruction tiếng Malay |
| **Priority** | Medium |
| **Type** | Unit |
| **Test Data** | `language = 'ms'` |
| **Bước thực hiện** | 1. Gọi `buildUserPrompt(businessInfo, undefined, 'ms')`. |
| **Kết quả mong đợi** | Chuỗi chứa `"Malay (Bahasa Melayu)"`. |

---

#### TC-F01-V.07

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.07 |
| **AC** | AC-04 |
| **Tiêu đề** | `buildUserPrompt()` — `extraInstructions` được ghép vào prompt |
| **Priority** | Medium |
| **Type** | Unit |
| **Test Data** | `extraInstructions = 'Focus on halal certification'` |
| **Bước thực hiện** | 1. Gọi `buildUserPrompt(businessInfo, 'Focus on halal certification')`. |
| **Kết quả mong đợi** | Chuỗi chứa `"Additional instructions: Focus on halal certification"`. |

---

### Phase 03 — Sanitizer (`openai-generator.ts`)

---

#### TC-F01-V.08

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.08 |
| **AC** | AC-05 |
| **Tiêu đề** | `sanitizeBlockData()` — fuzzy match variant case-insensitive `"Grid-3"` → `"grid-3"` |
| **Priority** | Blocker |
| **Type** | Unit |
| **Test Data** | `block = { blockType: 'features', variant: 'Grid-3' }`, mock registry trả variants `['grid-3', 'list', 'carousel']` |
| **Bước thực hiện** | 1. Mock `blockRegistry` với `getBlockMeta('features')` trả `{ variants: ['grid-3', 'list', 'carousel'], defaultVariant: 'grid-3' }`. 2. Gọi `sanitizeBlockData(block)`. |
| **Kết quả mong đợi** | `result.variant === 'grid-3'`. Không có `console.warn` (case-insensitive match không log). |
| **Ghi chú** | Hiện tại `sanitizeBlockData` chỉ so sánh `!meta.variants.includes(s.variant)` — case-sensitive. Nếu test FAIL là đúng, cần implement fuzzy match. |

---

#### TC-F01-V.09

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.09 |
| **AC** | AC-06 |
| **Tiêu đề** | `sanitizeBlockData()` — invalid variant → random fallback + `console.warn` |
| **Priority** | Blocker |
| **Type** | Unit |
| **Test Data** | `block = { blockType: 'hero', variant: 'nonexistent-variant-xyz' }`, registry variants `['centered', 'split-left', 'fullscreen']` |
| **Bước thực hiện** | 1. Spy `console.warn`. 2. Mock registry. 3. Gọi `sanitizeBlockData(block)` nhiều lần (10 lần). |
| **Kết quả mong đợi** | Mỗi lần gọi: `result.variant` thuộc `['centered', 'split-left', 'fullscreen']`. `console.warn` được gọi ít nhất 1 lần (chứa `'hero'` và `'nonexistent-variant-xyz'`). |

---

#### TC-F01-V.10

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.10 |
| **AC** | AC-06 |
| **Tiêu đề** | `sanitizeBlockData()` — invalid variant fallback có diversity (>= 2 variants khác nhau trong 10 lần) |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | Như TC-F01-V.09, chạy vòng lặp 10 lần |
| **Bước thực hiện** | 1. Gọi `sanitizeBlockData({ blockType: 'hero', variant: 'invalid' })` 10 lần. 2. Collect `result.variant` vào Set. |
| **Kết quả mong đợi** | `Set.size >= 2`. Fallback không luôn chọn variant đầu tiên. |

---

#### TC-F01-V.11

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.11 |
| **AC** | AC-05 |
| **Tiêu đề** | `sanitizeBlockData()` — variant hợp lệ giữ nguyên, không log, không thay đổi |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | `block = { blockType: 'features', variant: 'grid-3' }`, registry có `'grid-3'` trong variants |
| **Bước thực hiện** | 1. Spy `console.warn`. 2. Gọi `sanitizeBlockData(block)`. |
| **Kết quả mong đợi** | `result.variant === 'grid-3'`. `console.warn` KHÔNG được gọi. |

---

#### TC-F01-V.12

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.12 |
| **AC** | AC-05 |
| **Tiêu đề** | `sanitizeBlockData()` — variant là `number` (AI hallucination) → fallback hoặc convert |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | `block = { blockType: 'features', variant: 3 }` (number type) |
| **Bước thực hiện** | 1. Gọi `sanitizeBlockData({ blockType: 'features', variant: 3 as unknown as string })`. |
| **Kết quả mong đợi** | `result.variant` là `string`, thuộc variants list của block đó, KHÔNG là `3` hay `"3"` (nếu `"3"` không phải variant hợp lệ). |
| **Ghi chú** | Bug từ Scenario #18. Hiện tại `typeof s.variant === 'string'` guard có thể bỏ qua number. |

---

#### TC-F01-V.13

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.13 |
| **AC** | AC-05 |
| **Tiêu đề** | `sanitizeBlockData()` — variant rỗng `""` → fallback về `defaultVariant` |
| **Priority** | Medium |
| **Type** | Unit |
| **Test Data** | `block = { blockType: 'hero', variant: '' }` |
| **Bước thực hiện** | 1. Gọi `sanitizeBlockData({ blockType: 'hero', variant: '' })`. |
| **Kết quả mong đợi** | `result.variant` là string không rỗng, thuộc variants list của `hero`. |

---

#### TC-F01-V.14

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.14 |
| **AC** | AC-13 |
| **Tiêu đề** | `sanitizeBlockData()` — `blockType` không có trong registry → block được skip, không crash |
| **Priority** | Blocker |
| **Type** | Unit |
| **Test Data** | `block = { blockType: 'unknown-block-xyz', variant: 'default' }` |
| **Bước thực hiện** | 1. Mock `blockRegistry.has('unknown-block-xyz')` trả `false`. 2. Gọi `sanitizeBlockData(block)`. |
| **Kết quả mong đợi** | Hàm trả về object không crash. `blockType` vẫn là `'unknown-block-xyz'` (sanitizer không xóa). Không throw. |

---

#### TC-F01-V.15

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.15 |
| **AC** | AC-13 |
| **Tiêu đề** | `sanitizeBlockData()` — `blockRegistry.getBlockMeta()` trả `undefined` → không crash (Scenario #15) |
| **Priority** | Blocker |
| **Type** | Unit |
| **Test Data** | Mock `blockRegistry.has('hero')` = `true`, `blockRegistry.getBlockMeta('hero')` = `undefined` |
| **Bước thực hiện** | 1. Override mock. 2. Gọi `sanitizeBlockData({ blockType: 'hero', variant: 'centered' })`. |
| **Kết quả mong đợi** | Không throw `TypeError: Cannot read properties of undefined`. Trả về block object hợp lệ. |
| **Ghi chú** | Dòng code: `if (meta && meta.variants.length > 0 ...)` — guard `meta &&` đã có nhưng cần verify. |

---

### Phase 04 — Fallback Generator (`generate-blocks.ts`)

---

#### TC-F01-V.16

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.16 |
| **AC** | AC-08 |
| **Tiêu đề** | `generateBlocks()` — 10 lần gọi không seed → >= 7 distinct compositions |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | Prompt: `'A restaurant in Kuala Lumpur serving nasi lemak'`, gọi 10 lần |
| **Bước thực hiện** | 1. Import `generateBlocks` từ `@/lib/ai/generate-blocks`. 2. Gọi 10 lần với cùng prompt. 3. Serialize `result.blocks` thành JSON string. 4. Đưa vào Set. |
| **Kết quả mong đợi** | `Set.size >= 7` (>= 7 compositions khác nhau). |
| **Ghi chú** | Nếu `generateBlocks` hiện tại là deterministic (không có randomness), test FAIL — đây là điểm cần fix. |

---

#### TC-F01-V.17

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.17 |
| **AC** | AC-09 |
| **Tiêu đề** | `generateBlocks()` — 10 lần gọi restaurant → >= 3 `primaryColor` khác nhau |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | Prompt: `'restaurant'`, 10 lần gọi |
| **Bước thực hiện** | 1. Gọi `generateBlocks('restaurant')` 10 lần. 2. Collect `result.theme.primaryColor` vào Set. |
| **Kết quả mong đợi** | `Set.size >= 3`. Theme không luôn luôn là `#D97706`. |
| **Ghi chú** | Hiện tại `THEME_PALETTES` là object cố định per type — nếu không có randomization, luôn trả 1 màu. Test này xác nhận cần add variety. |

---

#### TC-F01-V.18

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.18 |
| **AC** | AC-07 |
| **Tiêu đề** | `createSeededRandom()` — same seed → same sequence (reproducibility) |
| **Priority** | Blocker |
| **Type** | Unit |
| **Test Data** | Seed: `12345` |
| **Bước thực hiện** | 1. Import `createSeededRandom` (nếu được export) từ `@/lib/ai/generate-blocks`. 2. Tạo `rng1 = createSeededRandom(12345)` và `rng2 = createSeededRandom(12345)`. 3. So sánh 10 giá trị đầu. |
| **Kết quả mong đợi** | `rng1()` và `rng2()` cho cùng sequence chính xác 100%. |
| **Ghi chú** | Nếu function chưa exported, test integration thông qua caller. |

---

#### TC-F01-V.19

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.19 |
| **AC** | AC-07 |
| **Tiêu đề** | `createSeededRandom()` — seed overflow `Date.now()` style không làm vỡ PRNG |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | Seed: `Number.MAX_SAFE_INTEGER` (9007199254740991) |
| **Bước thực hiện** | 1. Tạo `rng = createSeededRandom(Number.MAX_SAFE_INTEGER)`. 2. Gọi 5 lần. |
| **Kết quả mong đợi** | Mỗi lần trả `number` trong khoảng `[0, 1)`. Không trả `NaN`, `Infinity`, hay số âm. |
| **Ghi chú** | Scenario #17. LCG-style PRNG có thể overflow với seed quá lớn. |

---

#### TC-F01-V.20

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.20 |
| **AC** | AC-14 |
| **Tiêu đề** | `generateBlocks()` — backward compat: không có seed param → vẫn hoạt động bình thường |
| **Priority** | Blocker |
| **Type** | Unit |
| **Test Data** | `prompt = 'A coffee shop'` |
| **Bước thực hiện** | 1. Gọi `generateBlocks('A coffee shop')` không có bất kỳ seed argument nào. |
| **Kết quả mong đợi** | Trả `GenerationResult` hợp lệ với `blocks` array không rỗng, `theme` object đầy đủ fields, `siteName` là string. |

---

#### TC-F01-V.21

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.21 |
| **AC** | AC-08 |
| **Tiêu đề** | `shuffleArray()` (hoặc `pickRandom()`) — không trả mảng rỗng khi input hợp lệ |
| **Priority** | Medium |
| **Type** | Unit |
| **Test Data** | Input: `['a', 'b', 'c', 'd', 'e']` |
| **Bước thực hiện** | 1. Import utility functions. 2. Gọi shuffle với array 5 phần tử. |
| **Kết quả mong đợi** | Output có đúng 5 phần tử. Không bị mất phần tử. Thứ tự phải khác với original (statistical check với 10 lần run). |

---

### Phase 05 — Template Composer (`template-composer.ts`)

---

#### TC-F01-V.22

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.22 |
| **AC** | AC-10 |
| **Tiêu đề** | `composeTemplate()` — 2 template cùng category, khác `businessIndex` → hero variant khác nhau |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | Input A: `{ category: 'restaurant', businessIndex: 0, variant: 'professional', themePreset: RESTAURANT_PRESETS[0] }`. Input B: `{ category: 'restaurant', businessIndex: 2, variant: 'professional', themePreset: RESTAURANT_PRESETS[2] }` |
| **Bước thực hiện** | 1. Import `composeTemplate` và `RESTAURANT_PRESETS` từ đúng source. 2. Compose cả 2. 3. Tìm hero block trong homepage của mỗi template. |
| **Kết quả mong đợi** | `heroA.variant !== heroB.variant` (hoặc ít nhất 1 trong 5 thuộc tính block order/content khác nhau). |

---

#### TC-F01-V.23

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.23 |
| **AC** | AC-11 |
| **Tiêu đề** | `composeTemplate()` — cùng input → cùng output (reproducibility) |
| **Priority** | Blocker |
| **Type** | Unit |
| **Test Data** | `input = { category: 'business', businessIndex: 1, variant: 'professional', themePreset: BUSINESS_PRESETS[1] }` |
| **Bước thực hiện** | 1. Gọi `composeTemplate(input)` 2 lần. 2. So sánh JSON output. |
| **Kết quả mong đợi** | Hai output JSON hoàn toàn giống nhau (`deepEqual`). |

---

#### TC-F01-V.24

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.24 |
| **AC** | AC-12 |
| **Tiêu đề** | `composeFromBlueprint()` — `BlockSpec.variant = undefined` → dùng default variant từ category mapping |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | `preset.pages[0].blocks = [{ blockType: 'hero' }]` (không có `variant`) |
| **Bước thực hiện** | 1. Tạo `TemplatePreset` minimal với `hero` block không có `variant`. 2. Gọi `composeFromBlueprint(preset)`. 3. Tìm hero block trong output. |
| **Kết quả mong đợi** | Hero block có `variant` là string không rỗng, lấy từ `CATEGORY_HERO_VARIANTS[category]`. |

---

#### TC-F01-V.25

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.25 |
| **AC** | AC-10 |
| **Tiêu đề** | `composeFromBlueprint()` — category không có trong `CATEGORY_HERO_VARIANTS` → fallback `'centered'` |
| **Priority** | Medium |
| **Type** | Unit |
| **Test Data** | `preset = { category: 'unknown-category-999', ... }` |
| **Bước thực hiện** | 1. Mock `getCategoryContent` trả content hợp lệ. 2. Tạo preset với category không tồn tại. 3. Gọi `composeFromBlueprint`. |
| **Kết quả mong đợi** | Không throw. Hero block được tạo với variant `'centered'` (fallback từ `?? ['centered']`). |

---

#### TC-F01-V.26

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.26 |
| **AC** | AC-11 |
| **Tiêu đề** | `composeFromBlueprint()` — `businessIndex` out of range → throw rõ ràng với message hữu ích |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | `preset = { businessIndex: 999, category: 'restaurant' }` |
| **Bước thực hiện** | 1. Gọi `composeFromBlueprint` với `businessIndex: 999`. |
| **Kết quả mong đợi** | Throw `Error` với message chứa `"businessIndex"` và `"out of range"`. |

---

#### TC-F01-V.27

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.27 |
| **AC** | AC-01 |
| **Tiêu đề** | `buildHero()` — `variantIndex` mod variants.length → đúng variant được chọn |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | `category = 'restaurant'`, `CATEGORY_HERO_VARIANTS.restaurant = ['split-left', 'magazine', 'gradient', 'parallax', 'fullscreen']` |
| **Bước thực hiện** | 1. Gọi `buildHero(biz, 'restaurant', 0)` → expect `'split-left'`. 2. Gọi `buildHero(biz, 'restaurant', 3)` → expect `'parallax'`. 3. Gọi `buildHero(biz, 'restaurant', 5)` (overflow) → expect `'split-left'` (5 mod 5 = 0). |
| **Kết quả mong đợi** | Mỗi lần gọi trả đúng variant theo công thức `variants[variantIndex % variants.length]`. |
| **Ghi chú** | `buildHero` là internal function — cần test qua `composeTemplate` với các `businessIndex` khác nhau. |

---

#### TC-F01-V.28

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.28 |
| **AC** | AC-02 |
| **Tiêu đề** | `buildFeatures()` — luôn trả `variant: 'grid-3'` (hardcoded) — tài liệu hóa behavior |
| **Priority** | Medium |
| **Type** | Unit |
| **Test Data** | `category = 'restaurant'`, `biz = content.businesses[0]` |
| **Bước thực hiện** | 1. Gọi `buildFeatures(biz, 'restaurant')` (internal, test qua `composeTemplate`). 2. Kiểm tra `features.variant`. |
| **Kết quả mong đợi** | `features.variant === 'grid-3'` (hiện tại hardcoded). Nếu AC-02 yêu cầu diversity, test này sẽ FAIL và highlight gap. |
| **Ghi chú** | Đây là test để xác nhận gap với AC-02. Nếu fix chưa có → test documented as KNOWN-FAIL. |

---

### Backward Compatibility Tests

---

#### TC-F01-V.29

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.29 |
| **AC** | AC-13 |
| **Tiêu đề** | `sanitizeBlockData()` — block từ site cũ (single-page format, không có `pages`) → không crash |
| **Priority** | Blocker |
| **Type** | Unit |
| **Test Data** | `block = { blockType: 'hero', variant: 'centered', headline: 'Old site headline' }` (kiểu dữ liệu site cũ) |
| **Bước thực hiện** | 1. Gọi `sanitizeBlockData(block)` với block từ format cũ. |
| **Kết quả mong đợi** | Trả block hợp lệ với `blockType`, `variant`, `headline` được giữ nguyên. Không xóa field không phải upload/image. |

---

#### TC-F01-V.30

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.30 |
| **AC** | AC-13 |
| **Tiêu đề** | `generateSiteWithAI()` — AI trả format `blocks[]` cũ (không có `pages`) → parse thành công |
| **Priority** | Blocker |
| **Type** | Integration |
| **Test Data** | Mock OpenAI trả JSON `{ siteName: 'OldSite', blocks: [{blockType:'hero', variant:'centered'}] }` không có `pages` key |
| **Bước thực hiện** | 1. Mock `openai.chat.completions.create` trả response trên. 2. Gọi `generateSiteWithAI(businessInfo)`. |
| **Kết quả mong đợi** | `result.blocks` có ít nhất 1 block. `result.pages` là `undefined`. Không throw. Events có `done` event. |

---

#### TC-F01-V.31

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.31 |
| **AC** | AC-14 |
| **Tiêu đề** | `composeTemplate()` — `ComposerInput` không có `compositionSeed` field → behavior như cũ |
| **Priority** | Blocker |
| **Type** | Unit |
| **Test Data** | `input = { category: 'business', businessIndex: 0, variant: 'starter', themePreset: BUSINESS_PRESETS[0] }` (không có seed) |
| **Bước thực hiện** | 1. Gọi `composeTemplate(input)` (legacy function, deprecated nhưng phải hoạt động). |
| **Kết quả mong đợi** | Trả `TemplateSeed` hợp lệ với `pages[0].layout` là array không rỗng. `tier === 'starter'`. |

---

#### TC-F01-V.32

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.32 |
| **AC** | AC-13 |
| **Tiêu đề** | `generateSiteWithAI()` — OPENAI_API_KEY không có → fallback hoạt động đầy đủ |
| **Priority** | Blocker |
| **Type** | Integration |
| **Test Data** | `process.env.OPENAI_API_KEY = undefined` |
| **Bước thực hiện** | 1. Unset env var. 2. Gọi `generateSiteWithAI({ businessName: 'Test', industry: 'restaurant', ... })`. |
| **Kết quả mong đợi** | Không throw. `result.blocks.length > 0`. Events có `step(fallback)` → `done`. |

---

### Edge Case Tests (Scenario-driven)

---

#### TC-F01-V.33

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.33 |
| **AC** | AC-06 |
| **Tiêu đề** | Edge: AI trả JSON bị truncate (không có `}` cuối) → JSON repair hoạt động |
| **Priority** | High |
| **Type** | Integration |
| **Test Data** | Mock AI response: `'{"siteName":"Test","pages":[{"title":"Home","slug":"/"'` (truncated, không có closing braces) |
| **Bước thực hiện** | 1. Mock `openai.chat.completions.create` trả content bị truncate. 2. Gọi `generateSiteWithAI`. |
| **Kết quả mong đợi** | Không throw `SyntaxError`. Thay vào đó, rơi vào fallback path với `error` event + fallback result. |

---

#### TC-F01-V.34

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.34 |
| **AC** | AC-06 |
| **Tiêu đề** | Edge: AI trả JSON có page 1-3 đầy đủ nhưng page 4 bị truncate → 3 pages được giữ, không crash |
| **Priority** | High |
| **Type** | Integration |
| **Test Data** | JSON hợp lệ nhưng `pages[3]` bị cắt giữa chừng |
| **Bước thực hiện** | 1. Tạo JSON string với 3 pages hoàn chỉnh + page 4 không đóng. 2. Mock AI trả string này. 3. Gọi `generateSiteWithAI`. |
| **Kết quả mong đợi** | `result.pages.length >= 3`. Hoặc fallback được kích hoạt. Không crash. `done` event được emit. |

---

#### TC-F01-V.35

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.35 |
| **AC** | AC-05 |
| **Tiêu đề** | Edge: `sanitizeBlockData()` — upload fields là string URL → bị xóa (không crash Payload) |
| **Priority** | Blocker |
| **Type** | Unit |
| **Test Data** | `block = { blockType: 'hero', variant: 'centered', image: 'https://example.com/photo.jpg', backgroundImage: 'https://example.com/bg.jpg' }` |
| **Bước thực hiện** | 1. Gọi `sanitizeBlockData(block)`. |
| **Kết quả mong đợi** | `result.image` là `undefined`. `result.backgroundImage` là `undefined`. `result.variant` và `result.headline` được giữ nguyên. |

---

#### TC-F01-V.36

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.36 |
| **AC** | AC-09 |
| **Tiêu đề** | Edge: `THEME_PALETTES` object — category không tồn tại → fallback về 'business' palette |
| **Priority** | Medium |
| **Type** | Unit |
| **Test Data** | Prompt chứa keyword không map vào category nào |
| **Bước thực hiện** | 1. Gọi `generateBlocks('xyz unknown input with no keywords')`. 2. Kiểm tra `result.theme`. |
| **Kết quả mong đợi** | `result.theme` là object hợp lệ với `primaryColor`, `secondaryColor`, `fontHeading`, `fontBody`, `colorMode`. Không undefined. |

---

#### TC-F01-V.37

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.37 |
| **AC** | AC-03 |
| **Tiêu đề** | Edge: Block ordering — fallback generator không đặt hero sau features |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | `prompt = 'A tech company'` |
| **Bước thực hiện** | 1. Gọi `generateBlocks('A tech company')`. 2. Tìm index của `hero` và `features` trong `result.blocks`. |
| **Kết quả mong đợi** | `heroIndex < featuresIndex`. Navigation là block đầu tiên. Footer là block cuối cùng. |

---

#### TC-F01-V.38

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.38 |
| **AC** | AC-01, AC-02 |
| **Tiêu đề** | Diversity smoke test — 5 lần generate fallback restaurant → ít nhất 2 hero variants khác nhau |
| **Priority** | High |
| **Type** | Unit |
| **Test Data** | `prompt = 'restaurant serving nasi lemak'`, 5 lần |
| **Bước thực hiện** | 1. Gọi `generateBlocks(prompt)` 5 lần. 2. Collect `heroBlock.variant` vào Set. |
| **Kết quả mong đợi** | `heroVariants.size >= 2`. |
| **Ghi chú** | Nếu fallback generator chưa có randomness, test FAIL — cần implement. |

---

### §4.8 Harness Test Cases (Phase 06 — render & matrix coverage)

> **Layer:** AI Gen Test Harness (`scripts/test-harness/`) — additive coverage layer trên unit/integration test pyramid. Mục tiêu: bắt "empty hole" bugs (Ben Ben restaurant case) mà 3694 unit tests không thấy vì không render DOM.
>
> **Driver:** `npm run harness:gen` → `npm run harness:check` → `npm run harness:render` (Phase 03) → `npm run harness:report` (Phase 04). Matrix: 14 categories × 3 variants × 5 seeds = 210 fixtures.
>
> **Status:** TC-39..46 implemented Phase 02 (harness `check.ts` + 6 guards, commit `735fa85` + `8598e64`). TC-47..50 require Phase 03/04/05 deliverables (visual render, gallery report, CI workflow).

---

#### TC-F01-V.39

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.39 |
| **AC** | AC-01 |
| **Tiêu đề** | Harness — hero variant diversity ≥ 5 trong 5 seeds × 3 variants per category |
| **Priority** | High |
| **Type** | Harness (cross-fixture) |
| **Test Data** | Matrix `mode=full` (210 fixtures) — `computeVarietyMetrics()` group theo category |
| **Bước thực hiện** | 1. `npm run harness:gen`. 2. `npm run harness:check`. 3. Đọc `varietyMetrics.heroVariants[category]` trong `structural-report.json`. |
| **Kết quả mong đợi** | Mỗi category có `heroVariants.size >= 5` (warn nếu thấp hơn). |
| **Ghi chú** | Layer bổ sung cho TC-F01-V.27 (unit) — đo trên cùng matrix mà QA + PM dùng review. |

---

#### TC-F01-V.40

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.40 |
| **AC** | AC-02 |
| **Tiêu đề** | Harness — features layout diversity ≥ 3 variants per category |
| **Priority** | High |
| **Type** | Harness (cross-fixture) |
| **Test Data** | Cùng matrix Full |
| **Bước thực hiện** | 1. Run harness gen + check. 2. Đọc `varietyMetrics.featureVariants[category]`. |
| **Kết quả mong đợi** | `featureVariants.size >= 3` per category. |
| **Ghi chú** | Bổ sung cho TC-F01-V.28 (unit, single-call). |

---

#### TC-F01-V.41

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.41 |
| **AC** | AC-03 |
| **Tiêu đề** | Harness — block ordering diversity ≥ 6 unique orderings per category |
| **Priority** | Medium |
| **Type** | Harness (cross-fixture) |
| **Test Data** | Matrix Full, lấy `blocks.map(b => b.type).join('>')` per fixture |
| **Bước thực hiện** | 1. Run harness. 2. Group theo category → Set of orderings. |
| **Kết quả mong đợi** | `orderings.size >= 6` per category. |
| **Ghi chú** | Cùng AC với TC-F01-V.37 (unit) nhưng đo trên 5 seeds × 3 variants thay vì 10 calls cố định. |

---

#### TC-F01-V.42

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.42 |
| **AC** | AC-10 |
| **Tiêu đề** | Harness — `signature-blocks` guard PASS 100% fixtures |
| **Priority** | Blocker |
| **Type** | Harness (per-fixture guard) |
| **Test Data** | All 210 fixtures |
| **Bước thực hiện** | 1. Run harness gen + check. 2. Inspect `fixtures[].guards` cho guard `signature-blocks`. |
| **Kết quả mong đợi** | `pass=210, fail=0` cho guard `signature-blocks`. |
| **Ghi chú** | **Ben Ben class bug**: restaurant phải có menu-grid, salon phải có service-list, etc. (xem `CATEGORY_DNA.signatureBlocks`). |

---

#### TC-F01-V.43

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.43 |
| **AC** | (new — Ben Ben guard) |
| **Tiêu đề** | Harness visual — empty region ≤ 30% viewport height per fixture (mobile + desktop) |
| **Priority** | Blocker |
| **Type** | Harness (visual) |
| **Test Data** | 210 fixtures × 2 viewports (375 mobile, 1280 desktop) = 420 screenshots |
| **Bước thực hiện** | 1. `npm run harness:render` (Phase 03). 2. Empty-hole detector chạy pixel histogram trên mỗi screenshot. 3. Inspect `visual-report.json` cho `holePct`. |
| **Kết quả mong đợi** | `max(holePct) <= 0.30` cho mọi fixture. |
| **Ghi chú** | **Pending Phase 03**. Threshold 30% là v1 — sẽ recalibrate nếu false-positive. Forward-only coverage. |

---

#### TC-F01-V.44

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.44 |
| **AC** | (new — variant safety) |
| **Tiêu đề** | Harness — `variant-whitelist` guard: 0 fixtures dùng `BROKEN_VARIANTS` |
| **Priority** | Blocker |
| **Type** | Harness (per-fixture guard) |
| **Test Data** | All 210 fixtures, `BROKEN_VARIANTS` từ `src/lib/ai/template-composer.ts` |
| **Bước thực hiện** | 1. Run harness check. 2. Inspect guard `variant-whitelist`. |
| **Kết quả mong đợi** | `fail=0` — không fixture nào dùng `hero:animated-gradient`, etc. |
| **Ghi chú** | Ngăn regression sau khi sanitizer hoặc composer thay đổi. |

---

#### TC-F01-V.45

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.45 |
| **AC** | (new — ordering invariants) |
| **Tiêu đề** | Harness — `ordering` guard: nav-first, footer-last, features-before-stats |
| **Priority** | High |
| **Type** | Harness (per-fixture guard) |
| **Test Data** | All 210 fixtures |
| **Bước thực hiện** | 1. Run harness check. 2. Inspect guard `ordering`. |
| **Kết quả mong đợi** | `fail=0` — block order tuân thủ 3 invariants. |
| **Ghi chú** | Bổ sung guard cho TC-F01-V.37 (unit) — đo realtime trên matrix sau mỗi commit. |

---

#### TC-F01-V.46

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.46 |
| **AC** | (new — content minimums) |
| **Tiêu đề** | Harness — `no-empty-data` guard: `enforceMinContent` PASS all fixtures |
| **Priority** | High |
| **Type** | Harness (per-fixture guard) |
| **Test Data** | All 210 fixtures, focus carousel ≥3, masonry ≥4, grid-4 ≥4 |
| **Bước thực hiện** | 1. Run harness check. 2. Inspect guard `no-empty-data`. |
| **Kết quả mong đợi** | `fail=0` — không block nào có data array dưới ngưỡng. |
| **Ghi chú** | Closes the same root cause TC-F01-V.32 catches at unit level, but verifies on matrix scale. |

---

#### TC-F01-V.47

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.47 |
| **AC** | AC-13 |
| **Tiêu đề** | Harness — backward compat: legacy `composeTemplate()` path renders đầy đủ |
| **Priority** | High |
| **Type** | Harness (per-fixture guard) |
| **Test Data** | Subset matrix (legacy fixtures `*-legacy-*`) — invokeComposer chạy cả blueprint + legacy paths |
| **Bước thực hiện** | 1. Run harness gen. 2. Filter `results[]` where `pathway='legacy'`. 3. Verify guard `block-count` PASS. |
| **Kết quả mong đợi** | Legacy fixtures cũng PASS toàn bộ guards như blueprint fixtures. |
| **Ghi chú** | Bổ sung cho TC-F01-V.29 (unit). Quan trọng vì Phase 06 fallback unify có rủi ro break legacy path. |

---

#### TC-F01-V.48

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.48 |
| **AC** | (new — mobile parity) |
| **Tiêu đề** | Harness visual — mobile viewport (375px) không có empty region > 30% |
| **Priority** | High |
| **Type** | Harness (visual) |
| **Test Data** | 210 fixtures × mobile 375px = 210 screenshots |
| **Bước thực hiện** | 1. `npm run harness:render` (Phase 03). 2. Empty-hole detector trên mobile screenshots. |
| **Kết quả mong đợi** | `max(holePct_mobile) <= 0.30`. |
| **Ghi chú** | **Pending Phase 03**. Mobile thường stack vertical → có thể lộ hole nhiều hơn desktop. Tách TC riêng để nhìn rõ regression. |

---

#### TC-F01-V.49

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.49 |
| **AC** | (new — report usability) |
| **Tiêu đề** | Harness report — `report.html` self-contained, có filter category + status |
| **Priority** | Medium |
| **Type** | Harness (report) |
| **Test Data** | Output của `npm run harness:report` |
| **Bước thực hiện** | 1. `npm run harness:all`. 2. Mở `.harness-out/report.html` trong browser. 3. Verify: filter dropdown category, status badge, screenshots embedded. |
| **Kết quả mong đợi** | PM review 210 fixtures < 5 phút, click filter hoạt động, không cần internet. |
| **Ghi chú** | **Pending Phase 04**. Report.html phải self-contained (inline images base64 hoặc relative paths). |

---

#### TC-F01-V.50

| Trường | Nội dung |
|--------|----------|
| **ID** | TC-F01-V.50 |
| **AC** | (new — CI workflow) |
| **Tiêu đề** | Harness CI — workflow `ai-harness.yml` trigger khi label `run-harness` |
| **Priority** | Medium |
| **Type** | CI integration |
| **Test Data** | PR có label `run-harness` |
| **Bước thực hiện** | 1. Tạo PR test. 2. Add label `run-harness`. 3. Verify workflow `AI Harness` chạy. 4. Verify artifact `ai-harness-<pr>` xuất hiện. |
| **Kết quả mong đợi** | Workflow trigger trong 30s, artifact upload sau khi job done, retention 14 ngày. |
| **Ghi chú** | Phase 05 deliverable — `.github/workflows/ai-harness.yml`. Smart-notify post Lark khi guard fail. |

---

## 5. Traceability Matrix

| AC | Mô tả | TC-IDs | Status |
|----|-------|--------|--------|
| AC | Mô tả | Unit/Integration TCs | Harness TCs (Phase 06) | Status |
|----|-------|----------------------|-------------------------|--------|
| AC-01 | Hero Variant Diversity ≥ 5/10 | TC-F01-V.27, TC-F01-V.38 | TC-F01-V.39 | [x] MAPPED + harness |
| AC-02 | Features Layout Diversity ≥ 3 variants | TC-F01-V.28 | TC-F01-V.40 | [x] MAPPED + harness |
| AC-03 | Block Order Diversity ≥ 6 orderings | TC-F01-V.37 | TC-F01-V.41 | [x] MAPPED + harness |
| AC-04 | Style Personality Injection | TC-F01-V.01..V.07 | — | [x] MAPPED |
| AC-05 | Sanitizer Fuzzy Matching | TC-F01-V.08, V.11..V.13, V.35 | — | [x] MAPPED |
| AC-06 | Sanitizer Random Fallback + Log | TC-F01-V.09, V.10, V.33, V.34 | — | [x] MAPPED |
| AC-07 | Fallback Seeded PRNG | TC-F01-V.18 | — | [x] MAPPED |
| AC-08 | Fallback Variety Without Seed | TC-F01-V.16, V.21 | — | [x] MAPPED |
| AC-09 | Fallback Theme Variety | TC-F01-V.17, V.36 | — | [x] MAPPED |
| AC-10 | Composer Seed-Based Variety | TC-F01-V.22, V.27 | TC-F01-V.42 | [x] MAPPED + harness |
| AC-11 | Composer Reproducibility | TC-F01-V.23, V.26 | — | [x] MAPPED |
| AC-12 | Blueprint Variant Auto-Selection | TC-F01-V.24, V.25 | — | [x] MAPPED |
| AC-13 | Backward Compat — Existing Sites | TC-F01-V.14, V.15, V.29, V.30, V.32 | TC-F01-V.47 | [x] MAPPED + harness |
| AC-14 | Backward Compat — ComposerInput Without Seed | TC-F01-V.20, V.31 | — | [x] MAPPED |
| — (Ben-Ben render) | Empty region ≤ 30% viewport | (none — render-level gap) | TC-F01-V.43, V.48 | [x] HARNESS-ONLY |
| — (variant safety) | 0 BROKEN_VARIANTS in matrix | — | TC-F01-V.44 | [x] HARNESS-ONLY |
| — (ordering invariants) | nav-first, footer-last, features-before-stats | — | TC-F01-V.45 | [x] HARNESS-ONLY |
| — (content minimums) | enforceMinContent on matrix scale | — | TC-F01-V.46 | [x] HARNESS-ONLY |
| — (report usability) | PM review report.html < 5 min | — | TC-F01-V.49 | [x] HARNESS-ONLY |
| — (CI) | label `run-harness` triggers workflow | — | TC-F01-V.50 | [x] HARNESS-ONLY |

**Tỷ lệ coverage: 14/14 ACs = 100% (unit) + 6 new render-level TCs (harness-only)**

**Total TCs:** 50 (38 unit/integration + 12 harness — Phase 06)

---

## 6. Coverage Targets

| Metric | Target feature này | Target CI minimum |
|--------|-------------------|-------------------|
| Lines | 85% cho `src/lib/ai/` | 60% toàn project |
| Branches | 70% cho `sanitizeBlockData()` | 50% |
| Functions | 90% cho 4 key modules | 50% |
| Statements | 85% | 60% |

---

## 7. Test File Structure

Theo `docs/TEST_CONVENTION.md`, test files sẽ được tạo tại:

```
src/__tests__/unit/builder/
├── ai-variety-system-prompt.test.ts    # Phase 02 — TC-F01-V.01 → V.07
├── ai-variety-sanitizer.test.ts        # Phase 03 — TC-F01-V.08 → V.15
├── ai-variety-fallback.test.ts         # Phase 04 — TC-F01-V.16 → V.21
├── ai-variety-composer.test.ts         # Phase 05 — TC-F01-V.22 → V.28
└── ai-variety-integration.test.ts      # Backward compat + Edge — TC-F01-V.29 → V.38
```

Mỗi file phải follow pattern:
```typescript
// vi.mock() ở TOP FILE, trước mọi import

vi.mock('@/blocks/registry', () => ({
  blockRegistry: {
    getAllMeta: vi.fn(() => []),
    has: vi.fn(() => true),
    getBlockMeta: vi.fn((type) => ({
      type,
      variants: ['centered', 'split-left', 'fullscreen'],
      defaultVariant: 'centered',
    })),
    validate: vi.fn(() => ({ success: true, data: {} })),
  },
}))

import { sanitizeBlockData } from '@/lib/ai/openai-generator'
```

---

## 8. Điều Kiện Accept/Reject

### ACCEPT khi:
- Tất cả Blocker TCs PASS (TC-F01-V.01, V.09, V.15, V.18, V.20, V.23, V.29, V.30, V.31, V.32, V.35)
- >= 80% High TCs PASS
- Không có regression: TC-F01-V.29, V.30, V.31, V.32 tất cả PASS
- Coverage `src/lib/ai/` >= 60% lines

### REJECT khi:
- Bất kỳ Blocker TC nào FAIL
- TC-F01-V.15 FAIL (crash khi `getBlockMeta` trả undefined)
- TC-F01-V.29 FAIL (sites cũ bị hỏng)
- Coverage giảm so với baseline

---

## 9. Ghi Chú Implementation

### Known gaps cần implement trước khi test pass:

1. **AC-04**: `buildUserPrompt()` chưa có `stylePersonality` parameter — cần thêm optional param thứ 5.
2. **AC-05**: Fuzzy matching trong `sanitizeBlockData()` hiện là `includes(s.variant)` — case-sensitive. Cần normalize về lowercase trước khi compare.
3. **AC-06**: Random fallback hiện dùng `meta.defaultVariant || meta.variants[0]` — deterministic. Cần thay bằng `Math.random()` pick từ `meta.variants`.
4. **AC-08/AC-09**: `generateBlocks()` dùng `THEME_PALETTES` cố định — cần thêm randomization layer.
5. **AC-07**: `createSeededRandom()` có thể chưa tồn tại trong `generate-blocks.ts` — cần implement PRNG.

### Các test nào sẽ FAIL ngay lần đầu (expected failures):

- TC-F01-V.08 (case-insensitive fuzzy match chưa implement)
- TC-F01-V.10 (random fallback diversity chưa implement)
- TC-F01-V.16, V.17 (no randomness trong fallback generator)
- TC-F01-V.38 (diversity test sẽ fail vì deterministic)

Đây là **test-first approach**: các test này FAIL xác nhận feature chưa có, sau khi implement feature thì test sẽ PASS.

---

## 10. Phase 01 — User Data Threading (plan `260414-2249-ai-gen-wix-level-optimize`)

> Plan: `plans/260414-2249-ai-gen-wix-level-optimize/phase-01-user-data-threading.md`
> PR: `feat(F01): [US-F01-07] thread user data into ai gen pipeline`

### Mục tiêu

Thread user-supplied `phone`, `email`, `address`, `products`, `shortDescription`, `tagline` từ `BusinessInfoInput` xuyên suốt pipeline — cả composer fallback path lẫn AI happy path. Trước phase này: `composeFallbackResult` chỉ nhận `extractedName` → composer block builders (`buildFeatures`, `buildContact`, `buildServiceCards`, `buildProductQuickView`) dùng canned content bất kể user type gì.

### Test Cases

| TC ID | Test File | Mô tả | Status |
|-------|-----------|-------|--------|
| **TC-F01-W.01** | `business-info-mapper.test.ts` | Mapper parse + dedupe products string, normalize phone/email, derive tagline | ✅ |
| **TC-F01-W.02** | `contact-override.test.ts` | Contact block dùng user phone/email/address verbatim khi provided; fallback canned khi empty; bizOverride deep-clone không pollute cache | ✅ |
| **TC-F01-W.03** | `features-from-products.test.ts` | Features block emit cards từ user products khi ≥2; icons rotate từ `PRODUCT_FEATURE_ICONS[category]`; description dùng `FEATURE_BODY_TEMPLATES[category]`; fallback canned khi <2 | ✅ |
| **TC-F01-W.04** | `service-cards-from-products.test.ts` | Service-cards emit user products khi provided; fallback canned khi empty | ✅ |
| **TC-F01-W.05** | `service-cards-from-products.test.ts` | Product-quick-view emit user products, pad từ canned khi <3 | ✅ |
| **TC-F01-W.06** | `image-keywords-products.test.ts` | `deriveKeywords` primary-inject English product vào Unsplash query | ✅ |
| **TC-F01-W.06b** | `product-translator.test.ts` + `image-keywords-products.test.ts` | `nasi lemak` → `malaysian coconut rice`; `phở` → `vietnamese pho noodle soup`; unknown vi/ms pass-through | ✅ |
| **TC-F01-W.07** | `build-user-prompt.test.ts` | `buildUserPrompt` serialize phone/email/address/tagline khi provided; omit khi empty | ✅ |
| **TC-F01-W.08** | `user-data-e2e-fixture.test.ts` | End-to-end: ramen shop + nasi lemak shop fixtures — composer + keywords + prompt đồng bộ | ✅ |

### Files Modified

- `src/lib/ai/content/types.ts` — extend `BusinessSample` với optional `products?: string[]` (runtime-only, NO DB migration)
- `src/lib/ai/system-prompt.ts` — extend `BusinessInfoInput` type; `buildUserPrompt` serialize optional fields
- `src/lib/ai/business-info-mapper.ts` — NEW: pure mapper `BusinessInfoInput → Partial<BusinessSample>`
- `src/lib/ai/product-translator.ts` — NEW: vi/ms → en dict (60+ terms) + `franc-min` language detection
- `src/lib/ai/fallback-adapter.ts` — `composeFallbackResult` signature nhận full `BusinessInfoInput` (backward compat với string overload)
- `src/lib/ai/openai-generator.ts` — forward full `businessInfo` vào `generateWithFallback`
- `src/lib/ai/template-composer.ts` — `featuresFromProducts` helper + `PRODUCT_FEATURE_ICONS` + `FEATURE_BODY_TEMPLATES`; `buildFeatures`/`buildServiceCards`/`buildProductQuickView` prefer user products
- `src/lib/ai/image-keywords.ts` — `KeywordContext.products`; `deriveKeywords` primary-inject translated product term
- `src/lib/ai/media-injector.ts` — forward `ctx.products` to `deriveKeywords`
- `src/lib/ai/media-pipeline.ts` — `MediaPipelineContext.products` optional
- `src/lib/validations/ai.ts` — Zod schema `generateSiteSchema` optional `tagline/phone/email/address`
- `src/app/api/ai/generate-site/route.ts` — parse products string, pass into media pipeline
- `package.json` — add `franc-min ^6.2.0`, `dompurify` (fix pre-existing vitest resolver issue)

### Acceptance Criteria

- Restaurant gen với `{ products: ["ramen", "sushi"], phone: "+60..." }` → features block reference ramen/sushi, contact block có phone verbatim, first Unsplash query contains `"ramen"`.
- Malay restaurant với `products: ["nasi lemak"]` → first Unsplash query contains `"malaysian coconut rice"`.
- Empty `BusinessInfoInput` → fallback canned content, no crash.
- All 69 new unit tests pass; existing `fallback-adapter.test.ts` (22 tests) still green.

---

## 11. Phase 02 — Theme Moods System (plan `260414-2249-ai-gen-wix-level-optimize`)

> Plan: `plans/260414-2249-ai-gen-wix-level-optimize/phase-02-theme-moods-system.md`
> PR: `feat(f01): [US-F01-08] theme moods system — imagery, voice, cta bundle`

### Mục tiêu

Bundle imagery mood, copy voice, photography filter, và category-tuned CTAs vào 6 **ThemeMood archetypes** (Playful, Elegant, Bold, Serene, Editorial, Tech-Minimal). Mỗi trong 70 `ThemePreset` được gán 1 mood duy nhất qua field `moodId`. Mood wire xuyên suốt 3 consumer: (a) `buildUserPrompt` voice block, (b) `deriveKeywords` imagery adjective append, (c) composer `getCategoryCTA` helper thay thế hardcoded `"Get Started"/"Learn More"`.

### Test Cases

| TC ID | Test File | Mô tả | Status |
|-------|-----------|-------|--------|
| **TC-F01-W.09** | `mood-cta-coverage.test.ts` | ThemeMood shape: 6 moods, 14 cats, voiceStyle 4-6 rules, imageryKeywords 3-6, copyTone enum, every field non-empty | ✅ |
| **TC-F01-W.09b** | `preset-mood-assignment.test.ts` | Every preset có moodId hợp lệ; mỗi mood dùng bởi ≥3 presets; không có mood chiếm >30%; mỗi category có ≥2 distinct moods | ✅ |
| **TC-F01-W.10** | `voice-prompt-mood.test.ts` | `buildUserPrompt` inject COPY VOICE block với mood label, copyTone, bulleted rules, imagery hint; backward compat với legacy personality path | ✅ |
| **TC-F01-W.11** | `image-keywords-mood.test.ts` | `deriveKeywords` append mood imagery adjectives; total cap ≤5; no duplicates; tương tác với Phase 01 products | ✅ |
| **TC-F01-W.12** | `mood-cta-coverage.test.ts` | **168-cell CTA coverage** — 6 moods × 14 cats × 2 roles: non-empty, ≤25 chars, primary ≠ secondary, no TODO markers, không mood nào fall back generic >2 cells | ✅ |
| **TC-F01-W.12b** | `mood-cta-composer.test.ts` | End-to-end: hero/nav/CTA block dùng mood-resolved labels qua `composeFallbackResult`; seed variety produces distinct CTAs; no "Get Started" dominance | ✅ |

### Files Modified

- `src/lib/ai/theme-moods.ts` — **NEW** 350 lines: MoodId/MoodCategory/PhotographyFilter/CopyTone types, ThemeMood interface, 6 hand-curated mood records với 168 CTA cells, getMood + getCategoryCTA helpers
- `src/lib/ai/theme-presets.ts` — extended `ThemePreset` type với `moodId: MoodId` field, assigned mood cho tất cả 70 presets (distribution: elegant 16, playful 13, bold 11, tech-minimal 11, editorial 10, serene 9)
- `src/lib/ai/category-theme-picker.ts` — new `CategoryTheme` interface + `pickCategoryThemeWithMood()` entry point, legacy `pickCategoryTheme` preserved
- `src/lib/ai/system-prompt.ts` — `buildUserPrompt` nhận `BuildUserPromptOptions.mood`, inject COPY VOICE bulleted block khi có mood
- `src/lib/ai/image-keywords.ts` — `KeywordContext.mood` optional, append top 1-2 imagery adjectives, cap 5 total, no dupes
- `src/lib/ai/template-composer.ts` — `resolveCTA(mood, category, role)` helper; `buildNavigation`/`buildHero`/`buildCTA` prefer mood CTAs; `composeFromBlueprint` resolve mood từ `preset.themePreset.moodId`; `buildBlockFromSpec` thread mood xuống
- **6 new test files**: `theme-moods` helpers + 168 coverage, preset assignment, voice injection, imagery append, end-to-end composer CTAs

### Acceptance Criteria

- `pickCategoryThemeWithMood("restaurant", hashBusinessName("Rose Garden"))` trả về theme có `mood.copyTone === 'aspirational'` (Heritage Gold preset → elegant mood).
- 5 generations restaurant × 5 different names produce CTAs từ ≥3 distinct mood-driven phrasings (verified by seed variety test).
- GPT prompt cho beauty × playful run chứa voice rules "texting a close friend", "one exclamation per section max", "skip corporate buzzwords".
- Unsplash query cho `{ products: ["nasi lemak"], mood: serene }` = `"malaysian coconut rice restaurant minimalist ..."` — verified via `deriveKeywords` test.
- 168 non-empty CTA strings, all ≤25 chars, coverage test xanh.
- 6 new test files + 202 new assertions (W.09/W.09b/W.10/W.11/W.12/W.12b). Phase 01 regression tests vẫn xanh 170/170.

### Test Summary (cumulative Phase 01 + 02)

| Suite | Count | Status |
|---|---|---|
| Phase 01 tests (7 files) | 69 | ✅ |
| Phase 02 tests (6 files) | 235+ | ✅ |
| Legacy regression (`fallback-adapter.test.ts`) | 22 | ✅ |
| **Total new since pre-Phase-01** | **330+** | ✅ |

---

## 12. Phase 03 — Image Pool + Visual Consistency (plan `260414-2249-ai-gen-wix-level-optimize`)

> Plan: `plans/260414-2249-ai-gen-wix-level-optimize/phase-03-image-pool-consistency.md`
> PR: `feat(f01): [US-F01-09] image pool per site for visual cohesion`

### Mục tiêu

Replace per-block Unsplash searches với ONE per-site **image pool**. Một gen site chỉ gọi 1-2 `searchPhotos` thay vì 6-8 → tất cả blocks share cùng photographer, lighting, mood → visual cohesion by design. Pool inherits mood qua `mood.imageryKeywords` + `mood.photographyFilter`.

### Test Cases

| TC ID | Test File | Mô tả | Status |
|-------|-----------|-------|--------|
| **TC-F01-W.13** | `image-pool.test.ts` | `buildImagePool` shape: ImagePool structure, PoolPhoto fields, aspect ratio derivation | ✅ |
| **TC-F01-W.14** | `image-pool.test.ts` | Query construction: product + mood imagery adjectives, category fallback, 2 searchPhotos calls (landscape + squarish), dedupe | ✅ |
| **TC-F01-W.15** | `image-pool.test.ts` | `pickFromPool` determinism: same seed same photo, role → bucket mapping, role salting prevents collision, `pickManyFromPool` distinct ids | ✅ |
| **TC-F01-W.16** | `image-pool.test.ts` | Underfill backoff: relaxed retry, `pool.underfill` flag, searchPhotos rejection → empty bucket | ✅ |
| **TC-F01-W.17** | `image-pool.test.ts` | Integration spy: 5 same-seed runs = 10 Unsplash calls total; query stable across reruns | ✅ |

### Files Modified

- `src/lib/ai/image-pool.ts` — **NEW** 350 lines: types, `buildImagePool` 2-search + backoff, `pickFromPool` mulberry32, `pickManyFromPool` Fisher-Yates, `mergePool`, `poolSize`
- `src/lib/ai/media-pipeline.ts` — `MediaPipelineContext.pool?: ImagePool`; new `batchFetchFromPool` + `fetchAndStorePoolPhoto` helpers (download + upload PoolPhotos, skip search)
- `src/lib/ai/media-injector.ts` — `fulfillImageNeeds` pool-aware fast path: when `ctx.pool` present, picks via `pickManyFromPool` → `batchFetchFromPool` → media IDs; legacy per-block search kept as fallback. `roleForBlock` + `hashBlockSeed` helpers
- `src/app/api/ai/generate-site/route.ts` — builds `imagePool` once per gen, passes into fulfillment ctx, logs `[Image Pool]` line with counts + underfill flag

### Acceptance Criteria

- Restaurant × `elegant` mood gen → pool query contains `refined|candlelit|marble|timeless`.
- `pickFromPool(pool, 'hero', seed)` and `pickFromPool(pool, 'gallery', seed)` pick DIFFERENT photos at same seed (role salt).
- Pool underfill backoff fires when initial < 3 landscape photos, retries with relaxed query, sets `pool.underfill=true`.
- Full gen: hero + features + gallery + team blocks ALL receive Media IDs sourced from the same pool — verified by `[Image Pool] query="..." landscape=N square=M` log line.
- Legacy path preserved: `ctx.pool === undefined` falls through to `getMediaForBlock` per-block search (no regression).

---

## 13. Phase 04 — Layout Recipes A/B/C (plan `260414-2249-ai-gen-wix-level-optimize`)

> Plan: `plans/260414-2249-ai-gen-wix-level-optimize/phase-04-layout-recipes.md`
> PR: `feat(f01): [US-F01-10] layout recipes a/b/c per category`

### Mục tiêu

Replace single `CATEGORY_SIGNATURE_BLOCKS[category]` với **3 hand-curated recipes per category** (14 × 3 = 42 total). Mỗi recipe có rhythm archetype (story/menu/gallery/services/portfolio/team/features/social-proof/demo-first) + ordered block sequence + required subset. Composer picks via `seed % 3` deterministic. GPT happy path receives RHYTHM section as hard sequence constraint.

### Test Cases

| TC ID | Test File | Mô tả | Status |
|-------|-----------|-------|--------|
| **TC-F01-W.18** | `category-recipes.test.ts` | **407 assertions** — 42 recipes × 10 checks each: shape, rhythm enum, id format, hero+footer locked, blocks ≥5, every blockId in SUPPORTED_BLOCK_IDS, required ⊆ blocks, middleShuffleRange bounds, id uniqueness, ≥2 distinct rhythms per category, distribution ≤40% | ✅ |
| **TC-F01-W.18a** | `category-recipes.test.ts` | `pickRecipe` determinism + rotation across 30 seeds + unknown category fallback + negative seed | ✅ |
| **TC-F01-W.19** | `recipe-rhythm-prompt.test.ts` | **22 assertions** — `buildUserPrompt` RHYTHM section: header, label, rhythm enum, block sequence with arrow separators, required list, rationale, hard-order instruction, 14 cats × 3 recipes coverage, recipe + mood coexistence, pickRecipe → prompt end-to-end, seed variety | ✅ |

### Files Modified

- `src/lib/ai/category-recipes.ts` — **NEW** 380 lines: `RecipeRhythm` / `RecipeCategory` / `CategoryRecipe` types, `SUPPORTED_BLOCK_IDS` whitelist (34 block types), 42 hand-curated recipes, `pickRecipe(category, seed)` selector, `getRecipesForCategory`, `isSupportedBlockId`
- `src/lib/ai/system-prompt.ts` — `BuildUserPromptOptions.recipe?: CategoryRecipe`. When recipe provided, injects RHYTHM section with label + block sequence + required + rationale + hard-order instruction. Legacy `generateCompositionHint` path kept as fallback when no recipe passed.
- `src/lib/ai/openai-generator.ts` — picks `layoutRecipe = pickRecipe(category, themeSeed)` at same point as mood resolution, passes into `buildUserPrompt` options, logs `recipe=<id>` in theme line

### Acceptance Criteria

- `pickRecipe('restaurant', seed)` rotates across `rest-story` / `rest-menu` / `rest-gallery` — verified by 30-seed distribution test.
- GPT prompt contains `RHYTHM: Story-first (story-first)\nBlock sequence: hero → about → menu-display → ...` instead of shuffled `CATEGORY_SIGNATURE_BLOCKS` hint.
- Different business names at same category → 3 distinct recipes observed in prod logs `[Theme] ... recipe=<id>`.
- Composer path (no recipe passed) backward compat — legacy `generateCompositionHint` still fires for non-AI callers.
- 42 recipes non-empty + all block IDs valid + rhythm distribution sanity (no rhythm > 40%).

### Test Summary (cumulative Phase 01 + 02 + 03 + 04)

| Suite | Count | Status |
|---|---|---|
| Phase 01 tests | 69 | ✅ |
| Phase 02 tests | 235+ | ✅ |
| Phase 03 tests | 23 (image-pool) + 14 (media-injector regression) | ✅ |
| Phase 04 tests | 407 + 22 = 429 | ✅ |
| Legacy regression | 22 | ✅ |
| **Total** | **790+** | ✅ |

---

## 14. Phase 05 — Multi-page Completeness (plan `260414-2249-ai-gen-wix-level-optimize`)

> Plan: `plans/260414-2249-ai-gen-wix-level-optimize/phase-05-multipage-completeness.md`
> PR: `feat(f01): [US-F01-11] multi-page completeness — blog seeds + contact enrich + about hero`

### Mục tiêu

Kill sub-page stubs. Every site ships ≥5 pages: Home / About / Contact / Blog (+ Services/Menu per blueprint). Each core page ≥4 blocks. Blog renders 3-5 curated posts per category. About hero weaves user description. Contact page has Google Maps + opening-hours FAQ.

### Test Cases

| TC ID | Test File | Status |
|-------|-----------|--------|
| **TC-F01-W.20** blog shape | `blog-seeds-coverage.test.ts` | ✅ |
| **TC-F01-W.21** 14 cats × ≥3 posts | `blog-seeds-coverage.test.ts` | ✅ |
| **TC-F01-W.22** About weaves description | `multipage-completeness.test.ts` | ✅ |
| **TC-F01-W.23** Contact user fields + map + FAQ | `multipage-completeness.test.ts` | ✅ |
| **TC-F01-W.24** Blog renders seeded posts | `multipage-completeness.test.ts` | ✅ |
| **TC-F01-W.25** Core 5 pages ≥4 blocks | `multipage-completeness.test.ts` | ✅ |
| **TC-F01-W.26** Empty-input regression | `multipage-completeness.test.ts` | ✅ |

### Files Modified

- `src/lib/ai/content/blog-seeds.ts` — **NEW** 180 lines: 14 categories × 4 posts = 56 curated blog stubs + helpers
- `src/lib/ai/content/types.ts` — new `BlogPost` type + optional `blogSeeds` on CategoryContent
- `src/lib/ai/template-composer.ts`:
  - `buildAboutPage` / `buildContactPage` / `buildBlogPage` rewritten to emit ≥5 blocks with meaningful content
  - **NEW `enrichSubPages(pages, biz, category)` post-processor** runs inside `composeFromBlueprint` — overrides About hero with description excerpt, injects google-maps + FAQ into Contact, appends Blog page with seeded posts when blueprint lacks it, fills empty blog-list items from seeds
- `src/lib/ai/system-prompt.ts` STRUCTURE RULES — `Generate 5 pages` (adds Blog), `every page ≥4 blocks`, `Blog page MUST include blog-list with ≥3 seeded posts`

### Acceptance Criteria

- Every gen has Home / About / Contact / Blog minimum (blueprint extras preserved).
- Blog page renders ≥3 real posts from seeds — no empty "Latest Articles".
- About hero subheadline = user description excerpt when provided.
- Contact page has Google Maps block with user address + FAQ with opening-hours items.
- Empty input regression: canned fills gaps, blog still has ≥3 seeds.
- 14 categories × ≥3 seeds = ≥42 total (currently 56).

---

## 15. Phase 06 — SEO + Consistency Guard

**Problem**: Fallback path writes the SAME truncated site tagline as the meta description for every page (home/about/contact/blog share identical `seo.description`). Google flags these as duplicate meta descriptions. No page carries JSON-LD structured data → zero rich-results eligibility. No post-gen quality checks → silent quality drift.

**Fix**: Three bundled additions —

1. **Per-page SEO generator** (`src/lib/ai/seo-generator.ts`): mines unique title + description + og:image from each page's first text/image block. Home title `{biz.name} · {tagline}`, sub-pages `{page.title} · {biz.name}`. Defensive dedupe step forces uniqueness.
2. **JSON-LD templates** (`src/lib/ai/json-ld-templates.ts`): category → schema.org `@type` mapping (`restaurant`→`Restaurant`, `health`→`MedicalClinic`, `education`→`EducationalOrganization`, `ecommerce`→`Store`, `beauty`→`BeautySalon`). LocalBusiness schema embeds user phone/email/address verbatim. FAQPage schema attached only to pages with an FAQ block.
3. **Consistency validator** (`src/lib/ai/consistency-validator.ts`): warn-only post-gen check. Rules C1 palette, C2 image mood, C3 headline length (>10 words), C4 CTA rhythm (<3 CTAs/page), C5 recipe adherence (nav/hero/footer on homepage). Logged via `console.warn`; never blocks save.

### Test Cases (TC-F01-W.27 .. W.42)

| TC | Scenario | Expected |
|---|---|---|
| W.27 | Home + About + Contact gen from ramen fixture | 3 distinct meta descriptions |
| W.28 | Homepage SEO title format | `{biz.name} · {tagline}`, truncated ≤ 60 chars |
| W.28b | Sub-page SEO title format | `{page.title} · {biz.name}` |
| W.29 | Title + description length caps | ≤ 60 chars title, ≤ 155 chars description |
| W.30 | LocalBusiness JSON-LD contact fields | phone/email/address from user input |
| W.31 | Category → schema @type | restaurant→Restaurant, health→MedicalClinic, etc. |
| W.31b | Restaurant `servesCuisine` | populated from `biz.products[]` |
| W.32 | FAQPage schema | attached only to pages with `faq` block |
| W.33 | ogImage fallback | page image → site hero fallback |
| W.34 | Duplicate description dedupe | appends page title to disambiguate |
| W.35 | Fallback-adapter integration | every page has unique desc + jsonLd[] |
| W.36 | C1 palette missing color | warning emitted |
| W.37 | C2 homepage w/o image | warning emitted |
| W.37b | C2 mixed http/local sources | warning emitted |
| W.38 | C3 headline > 10 words | warning emitted |
| W.39 | C4 page < 3 CTAs | warning emitted |
| W.40 | C5 homepage missing nav/footer | warning emitted |
| W.41 | Clean site | `passed=true`, zero warnings |
| W.42 | Degenerate single-page shape | runConsistencyCheck does not throw |

### Files touched

- `src/lib/ai/seo-generator.ts` — **NEW** 200 lines: `generatePageSeo`, `generateAllPageSeo`, `minePageText`, `minePageImage`, `truncateOnWord`, dedupe
- `src/lib/ai/json-ld-templates.ts` — **NEW** 193 lines: `LocalBusinessSchema` / `FaqPageSchema` types, `schemaTypeFor`, `parseAddress`, `defaultPriceRange`, `buildLocalBusinessJsonLd`, `buildFaqJsonLd`
- `src/lib/ai/consistency-validator.ts` — **NEW** 220 lines: `runConsistencyCheck`, `logConsistencyReport`, rules C1-C5
- `src/lib/ai/fallback-adapter.ts` — uses `generateAllPageSeo` per-page in `adaptTemplateSeedToGenerationResult`; runs consistency check in `composeFallbackResult`
- `src/lib/ai/openai-generator.ts` — overrides AI-returned per-page SEO with deterministic `generateAllPageSeo`; runs consistency check before `done` event
- `src/lib/ai/generate-blocks.ts` — `GeneratedPage['seo']` gains optional `ogImage` + `jsonLd`

### Acceptance Criteria

- Fallback gen: every page in `result.pages[].seo.description` is unique (no more shared tagline).
- Every page ships `seo.jsonLd[]` with at least a `LocalBusiness`-family schema; FAQ blocks attach an additional `FAQPage` schema.
- Consistency validator runs on both fallback + AI paths, logs warnings via `console.warn`, never blocks save.
- Title ≤ 60 chars, description ≤ 155 chars — enforced by `truncateOnWord`.
- `buildLocalBusinessJsonLd` embeds user phone/email/address verbatim when supplied.

### Test Summary (cumulative Phase 01 + 02 + 03 + 04 + 05 + 06)

| Suite | Count | Status |
|---|---|---|
| Phase 01 tests | 69 | ✅ |
| Phase 02 tests | 235+ | ✅ |
| Phase 03 tests | 23 (image-pool) + 14 (media-injector regression) | ✅ |
| Phase 04 tests | 407 + 22 = 429 | ✅ |
| Phase 05 tests | 50 (blog seeds + multipage) | ✅ |
| Phase 06 tests | 39 (seo-generator + consistency-validator) | ✅ |
| Legacy regression | 22 | ✅ |
| **Total** | **880+** | ✅ |
