# Root Cause Analysis — GH-1184: Vietnamese Input + English Language = Mixed-Language Output

**Date:** 2026-06-16  
**Severity:** High — content quality bug affecting all users who input Vietnamese but select EN output

---

## Executive Summary

User nhập tiếng Việt, chọn ngôn ngữ website là English → website vẫn có content tiếng Việt lẫn lộn với EN wording. Root cause: **template-first path bị skip khi `language !== 'en'`**, nhưng AI-first path lại nhận `detectedLang='vi'` và được instruct generate nội dung bằng Vietnamese, thay vì translate input VN → output EN.

---

## Flow Diagram

```
POST /api/ai/generate-site
  ↓
route.ts:114 → destructure { language = 'en', ... } từ request
  │
  │  language = 'en' (user chọn English)
  ↓
generateSiteWithAI(businessInfo, extraInstructions, language='en', ...)
  [openai-generator.ts:80]
  ↓
  ├── language = 'en' (explicit)
  ├── detectedLang = 'en'  (line 143: explicit override)
  ├── blockLang = 'en'     (line 143)
  ↓
  Condition [line 144]:
  genMode==='template-first' && !hasCustomInput && detectedLang==='en' && blockLang==='en'
  ↓ TRUE → generateTemplateFirst() → template composer (static EN content)
            GPT personalizes hero với buildPersonalizePrompt(language='en')
            → CORRECT: hero EN, content EN ✓

  --- BUG SCENARIO ---
  language = 'auto' (default khi frontend KHÔNG explicit chọn EN?)
  OR language = 'en' nhưng...

  detectedLang from detectLanguage(inputText) [line 141]:
    inputText = "Bánh mì Sài Gòn | F&B | ..."  → contains VI_DIACRITICS_RE → detectedLang='vi'
    blockLang = 'vi'

  Condition [line 144]: detectedLang==='en' → FALSE
  → falls through to AI-first path [line 167]

  buildSystemPrompt(language='en', { gpLang=??? })
    [line 204]
    gpLang = EXPLICIT_LANG_NAMES['en'] = 'English'  ← OK nếu language='en'

  buildUserPrompt(businessInfo, { language: detectedLang='vi', gpLang })
    [line 217-228]
    ↓
    resolvedLangName = gpLang ?? (language==='vi' ? 'Vietnamese' : ...)
    → gpLang was passed → resolvedLangName = gpLang (from EXPLICIT_LANG_NAMES[language])
```

---

## Root Cause Xác Định

**PRIMARY BUG — `openai-generator.ts` line 141-144:**

```typescript
// line 141
const { contentLang: detectedLang, gpLang, blockLang } = language === 'auto'
    ? detectLanguage(inputText)
    : { contentLang: language as ContentLang, gpLang: EXPLICIT_LANG_NAMES[language] ?? 'English', blockLang: language }

// line 144 — GATE cho template-first path:
if (genMode === 'template-first' && !hasCustomInput && detectedLang === 'en' && blockLang === 'en') {
```

**Khi `language = 'en'` (explicit):** detectedLang = 'en', blockLang = 'en' → template-first path chạy → GPT personalizes hero bằng `buildPersonalizePrompt(language='en')` → **CORRECT**.

**NHƯNG:** `buildUserPrompt` nhận `language: detectedLang` (line 219), không phải `language` parameter của caller:

```typescript
// line 217-228
const userPromptText = buildUserPrompt(businessInfo, {
    extraInstructions: sanitizedExtra,
    language: detectedLang,   // ← đây là 'en' khi explicit, nhưng...
    gpLang,
    ...
})
```

**SECONDARY BUG — `system-prompt.ts` `buildUserPrompt` line 427:**

```typescript
// line 426-432 — CTA labels injected theo language
const ctaLang = (language === 'ms' || language === 'vi') ? language : 'en'
const suggestedCtaList = getCTAsByLang(category, ctaLang)
```

Khi `language=detectedLang='vi'` nhưng user đã chọn output EN, CTA labels vẫn bị inject bằng tiếng Việt.

**CRITICAL PATH — AI-first khi có `extraInstructions` hoặc `referencePrompt`:**

```typescript
// line 134
const hasCustomInput = Boolean(extraInstructions?.trim()) || Boolean(referencePrompt?.trim())
// → nếu user thêm extra instructions → hasCustomInput=true → skip template-first
//   → vào AI-first path với language instruct từ buildUserPrompt
```

Với AI-first path: `buildUserPrompt` tại line 443-455 builds lang instruction:
```typescript
const resolvedLangName = gpLang
    ?? (language === 'ms' ? 'Malay' : language === 'vi' ? 'Vietnamese' : ...)
```

Nếu `gpLang` được passed từ `EXPLICIT_LANG_NAMES[language='en'] = 'English'` → OK.
Nhưng nếu `language='auto'` và input VN → `gpLang='Vietnamese'`, `langInstruction = 'Generate EVERY word in Vietnamese'` → **direct bug**.

---

## Kịch Bản Bug Cụ Thể

### Scenario 1 (Confirmed Bug Path)
- User: nhập "Cửa hàng bánh mì Sài Gòn" (tiếng Việt)
- Frontend gửi: `language = 'auto'` (không explicit select)
- `detectLanguage(inputText)` → VI_DIACRITICS_RE match → `detectedLang='vi'`, `gpLang='Vietnamese'`
- `buildUserPrompt(language='vi', gpLang='Vietnamese')` → `langInstruction = 'Generate EVERY word in Vietnamese'`
- GPT output: toàn tiếng Việt ✓ (expected cho trường hợp này)

### Scenario 2 (Bug khi user chọn EN nhưng frontend gửi sai)
- User: nhập "Cửa hàng bánh mì" + chọn ngôn ngữ = English
- Frontend phải gửi: `language = 'en'`
- Nếu frontend GỬI ĐÚNG `language='en'` → `detectedLang='en'`, `blockLang='en'` → template-first → **CORRECT**
- **BUG: nếu frontend KHÔNG gửi `language` hoặc gửi `'auto'`** → `detectLanguage` detect tiếng Việt → AI-first với Vietnamese instruction

### Scenario 3 (Mixed bug trong AI-first với explicit EN)
- User nhập VN + chọn EN + có `extraInstructions` → `hasCustomInput=true` → AI-first
- `language='en'` → `detectedLang='en'`, `gpLang='English'`
- `buildUserPrompt(language='en', gpLang='English')` → `langInstruction = 'Generate ALL content in English'`
- Nhưng user input trong prompt vẫn là tiếng Việt: `info.businessName`, `info.products`, `info.shortDescription` → **GPT quote raw Vietnamese input vào output blocks**
- Không có bước translate input VN → EN trước khi đưa vào prompt

---

## Bug Location (File:Line)

| # | File | Line | Issue |
|---|------|------|-------|
| 1 | `src/lib/ai/openai-generator.ts` | 141-144 | Gate condition dùng `detectedLang` (from input language detection) thay vì `language` (user selection) → template-first bị skip khi input tiếng Việt dù user chọn EN |
| 2 | `src/lib/ai/openai-generator.ts` | 219 | `buildUserPrompt(language: detectedLang)` — truyền detected input lang, không phải target output lang |
| 3 | `src/lib/ai/system-prompt.ts` | 427 | CTA labels inject theo `language` (detected, không phải target) |
| 4 | `src/lib/ai/system-prompt.ts` | 358-379 | `buildUserPrompt` puts raw `info.businessName`, `info.products`, `info.shortDescription` trực tiếp vào prompt — không có bước translate trước |
| 5 | `src/app/api/ai/generate-site/route.ts` | 114 | `language` destructure với `default='en'` nhưng frontend có thể không gửi khi user chọn `auto` |

---

## Đề Xuất Fix

### Fix 1 (Critical) — Phân biệt `inputLang` vs `targetLang`

**`src/lib/ai/openai-generator.ts` line 141-228:**

```typescript
// TRƯỚC (dùng một biến cho cả hai mục đích)
const { contentLang: detectedLang, gpLang, blockLang } = language === 'auto'
    ? detectLanguage(inputText)
    : { contentLang: language as ContentLang, gpLang: EXPLICIT_LANG_NAMES[language] ?? 'English', blockLang: language }

// SAU — tách rõ input detection vs target output
const { contentLang: detectedInputLang, blockLang: detectedBlockLang } = detectLanguage(inputText)

// Target lang: explicit > auto-detected
const targetLang = language === 'auto' ? detectedInputLang : language as ContentLang
const targetGpLang = language === 'auto'
    ? (EXPLICIT_LANG_NAMES[detectedInputLang] ?? 'English')
    : (EXPLICIT_LANG_NAMES[language] ?? 'English')
const targetBlockLang = language === 'auto' ? detectedBlockLang : language

// Template-first gate: chỉ skip khi TARGET là English, không phải khi INPUT là English
if (genMode === 'template-first' && !hasCustomInput && targetLang === 'en' && targetBlockLang === 'en') {
    // ... template-first path
}

// buildUserPrompt nhận targetLang thay vì detectedInputLang
const userPromptText = buildUserPrompt(businessInfo, {
    language: targetLang,      // ← target output language
    gpLang: targetGpLang,      // ← target language name for GPT
    ...
})
```

### Fix 2 (Important) — Translate user input trước khi đưa vào prompt (khi target ≠ input lang)

**`src/lib/ai/system-prompt.ts` `buildUserPrompt`:**

Khi `targetLang='en'` nhưng user input là Vietnamese → thêm instruction cho GPT tự translate input:

```typescript
// Thêm vào buildUserPrompt khi target != input language:
if (resolvedLangName === 'English' && /* inputContainsVietnamese */ ) {
    parts.push(`NOTE: The business information above may contain Vietnamese text. Translate all user-provided content to English in your output. The final website must be 100% in English.`)
}
```

Hoặc tốt hơn: translate `businessInfo` fields trước khi pass vào prompt (dùng `dynamic-translator.ts` đã có sẵn).

### Fix 3 (Quick Win) — Frontend phải luôn gửi `language` explicit

Đảm bảo frontend gửi `language='en'` khi user chọn English, không bao giờ gửi `'auto'` khi user đã explicit chọn ngôn ngữ.

---

## Timeline Sự Kiện

1. User mở "Create Website with AI" form
2. Nhập business info bằng tiếng Việt (tên, mô tả, sản phẩm)
3. Chọn ngôn ngữ website = English
4. Frontend submit → `POST /api/ai/generate-site` (unclear: `language='en'` hay `'auto'`)
5. `detectLanguage(inputText)` → phát hiện Vietnamese → `detectedLang='vi'`
6. Gate condition `detectedLang === 'en'` = false → skip template-first
7. AI-first path → `buildUserPrompt(language=detectedLang='vi', gpLang='Vietnamese')`  
   OR: nếu `language='en'` explicit → `buildUserPrompt(language='en')` nhưng raw VN input trong prompt
8. GPT nhận instruction generate Vietnamese OR nhận EN instruction nhưng còn raw VN text trong user prompt
9. Output: hero/SEO → EN (từ GPT instruction), nhưng features/testimonials/FAQs quotas raw VN input → mixed

---

## Cần Kiểm Tra Thêm

1. **Frontend code** — Tìm component "Create Website" để xác nhận value của `language` field khi user chọn English. Nếu frontend gửi đúng `language='en'` thì Scenario 2 là confirmed path.
2. **`src/lib/ai/fallback-adapter.ts`** — xem composer template-first có bị ảnh hưởng không.
3. **`src/lib/ai/generate-sample-products.ts`** — products có bị VN text không (riêng biệt với website content).

---

**Status:** DONE  
**Summary:** Bug xác nhận tại `openai-generator.ts` line 141-144: gate condition template-first dùng `detectedLang` (language của user INPUT) thay vì user-selected target output language → khi user nhập VN + chọn EN, pipeline rơi vào AI-first với Vietnamese instruction. Không có bước translate input trước khi pass vào prompt GPT.  
**Concerns:** Cần xác nhận frontend gửi `language` field như thế nào (xem Scenario 2 vs Scenario 3).
