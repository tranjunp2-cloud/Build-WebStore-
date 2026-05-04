# Phase 03: Fix Sanitization to Preserve Variety

## Context
- Parent: [plan.md](plan.md)
- File: `src/lib/ai/openai-generator.ts` (562 → 847 lines)
- Status: **done** ✅
- Commits: `beffa9b`, `1da7134`

## Implemented Changes

### 3.1 Fuzzy Variant Matching (`fuzzyMatchVariant()`)
3 bước thay vì chỉ exact match:
1. Exact match: `"grid-3"` === `"grid-3"`
2. Case-insensitive + normalize: `"Grid-3"` → `"grid-3"`
3. Alias lookup: `"slider"` → `"carousel"`

### 3.2 Variant Aliases (40+ patterns)
- EN: three-column→grid-3, slider→carousel, full-width→fullscreen, compact→minimal
- VI: đơn giản→simple, tối giản→minimal, lưới→grid-3, thẻ→cards, bảng→table
- MS: mudah→simple, ringkas→minimal, senarai→list, kad→cards, jadual→table

### 3.3 Weighted-by-Category Random Fallback
- `CATEGORY_VARIANT_WEIGHTS`: **14/14 categories** × 5 block types (hero, features, testimonials, footer, contact)
- `pickWeightedVariant()`: random từ preferred list theo ngành → phù hợp hơn pure random
- Fallback: random từ tất cả valid variants nếu category không match

### 3.4 Broken Variant Exclusion
- `BROKEN_VARIANTS`: hero:animated-gradient never selected
- Filter trước khi random → tránh render broken blocks

### 3.5 Content-Count Guard (`enforceMinContent()`)
- `VARIANT_MIN_CONTENT`: testimonials(carousel≥3, masonry≥4), features(grid-4≥4, carousel≥3), gallery(masonry≥6), pricing(slider≥3)
- Auto-fallback: carousel với 1 item → cards. Masonry với 2 items → cards.
- Console.warn log: `[AI Content Guard] "testimonials": variant "carousel" needs 3 items but got 1 → fallback to "cards"`
- Exported function — reusable cho Phase 04 + 05

### 3.6 Logging
- Console.warn cho mỗi variant replacement: `[AI Sanitizer] "hero": "hexagonal" → "parallax"`
- Console.warn cho content guard fallback

### 3.7 Gallery/Logo-Cloud Fix
- Gallery: giữ alt + caption metadata, chỉ strip URL (trước: xóa sạch `images = []`)
- Logo-cloud: giữ name + alt metadata, strip URL (trước: xóa sạch `logos = []`)

### 3.8 API Compatibility
- `sanitizeBlockData(block, siteCategory?)` — thêm optional param, backward-compatible
- Caller truyền `parsed.category` từ GPT-4o response
