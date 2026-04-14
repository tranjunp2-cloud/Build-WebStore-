---
title: "Design Quality Rules — Block-Level Implementation"
description: "Implement design quality standards across all blocks: typography scale, color 60-30-10, spacing tokens, content validation"
status: done
priority: P1
effort: 5-7d
branch: feat/F01-ai-gen-variety-fix
tags: [design, blocks, quality, tokens, typography, color]
created: 2026-04-12
updated: 2026-04-14
---

# Design Quality Rules — Block-Level Implementation

## Mục tiêu
Biến DESIGN QUALITY RULES từ prompt text → code thực thi. Đảm bảo mỗi block component render theo chuẩn thiết kế chuyên nghiệp, không phụ thuộc vào AI "tuân lệnh" prompt.

## Trạng thái hiện tại
- CSS variables đã có (`--brand-primary`, `--brand-secondary`) — 192 usages
- Shared utilities: animations, decorative components, RichText sanitizer
- **Thiếu**: Design token system, typography scale, spacing scale, content validation, contrast checking

## Nguyên tắc từ research

| Nguồn | Rule cần implement |
|-------|-------------------|
| Anthropic Cookbook | Hướng dẫn AI từng dimension riêng biệt |
| Impeccable | OKLCH color, cấm reflex fonts, 4pt grid |
| v0 Vercel | Closed token layer — AI chọn từ set cố định |
| Web Design Research | AIDA ordering, 60-30-10 color, 8px spacing grid |
| CRO Research | 6-word headlines, single CTA/viewport, 48px touch targets |

## Phases

| # | Phase | Status | Effort | Key Deliverable |
|---|-------|--------|--------|-----------------|
| 01 | [Design Token System](phase-01-design-tokens.md) | ✅ **done** (`5a1a6997`) | 1d | Spacing, radius, shadow, SectionWrapper, 25 tests |
| 02 | [Typography Scale](phase-02-typography.md) | ✅ **done** (`4050a136`) | 1d | Type scale classes, font pairing validator |
| 03 | [Color System](phase-03-color-system.md) | ✅ **done** (`373554f2`) | 1d | 60-30-10 semantic layer (Option C — additive, no codemod), contrast checks |
| 04 | [Content Validation](phase-04-content-validation.md) | ✅ **done** (`5b7594ac`) | 1d | Word counts, CTA labels, multi-lang blocked, section ordering, page guard — wired into AI sanitizer + template buildBlockFromSpec |
| 05 | [Block Component Audit](phase-05-block-audit.md) | ✅ **done** (14 refactor commits, see chain below) | 2-3d | All 47 blocks refactored to use tokens + SectionWrapper + content rules |

### Phase 05 commit chain (Batch A → B → C, parallel where possible)
```
4be2fe2f refactor(f01): features block — phase 05 pilot
b2103880 refactor(f01): footer block       — batch a #2
9e4fe878 refactor(f01): navigation block   — batch a #3
25d7e970 refactor(f01): testimonials block — batch a #4
71c65f34 refactor(f01): hero block         — batch a #5
3092451d refactor(f01): pricing block      — batch b #1
537f61bf refactor(f01): gallery block      — batch b #2
dc357f98 refactor(f01): contact block      — batch b #3
a66b71bc refactor(f01): 13 small blocks    — batch c sequential
f43ea1bd refactor(f01): 8 blocks           — batch c2
1113b32e refactor(f01): 6 industry blocks  — batch c1
```

**Plan complete 2026-04-14.** All 5 phases shipped on `feat/F01-ai-gen-variety-fix` (PR #555). Status flipped to `done`.

## Chạy song song
Plan này **độc lập** với AI variety audit (plans/260412-2156). Có thể chạy song song:
- Variety audit: sửa prompt + sanitizer + fallback + composer
- Design quality: sửa block components + thêm token system

## Related Docs (PHẢI ĐỌC trước khi implement)
- **PRD**: `docs/prd/F01-design-quality.md` — 18 FRs, 19 ACs, 5 risks, traceability matrix
- **QA Test Plan**: `docs/qa/F01-design-quality.md` — 55 TCs, 12 risks, traceability matrix
- **Scenario Report**: `reports/scenario-content-visual.md` — 55 scenarios (6 Critical / 20 High / 21 Medium / 8 Low)
- **Companion PRD**: `docs/prd/F01-ai-builder-variety.md` — Plan A (AI variety, phase 02+03 merged)
- **Standards**: `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md`, `docs/standards/AI_WEBSITE_GENERATION_GUIDE.md`
- **Scout**: `scout/scout-design-quality-scan.md` — 47 blocks, 496 CSS var usages, 20 font pairings

⛔ **Cook PHẢI đọc PRD + scout trước khi code.**

## Key Files
- `src/lib/theme/resolve.ts` — theme CSS var resolver (đã có, CSS_VARS line 203-235)
- `src/lib/fonts/pairings.ts` — 20 pairings, 2 invalid cần fix
- `src/blocks/shared/` — shared components, animations
- `src/blocks/*/index.tsx` — 47 block components (hero 11 variants tách file)
- `src/lib/ai/openai-generator.ts` — sanitizer line 529 (hook AI path)
- `src/lib/ai/template-composer.ts` — buildBlockFromSpec line 963 (hook template path, 25 builders)
- `src/app/globals.css` — global styles

## Validation Summary

**Validated:** 2026-04-13
**Questions asked:** 4 (Q1 revalidated sau khi clarify Plan A state)

### Plan A state (context)
- Commit `beffa9b` trên `feat/F01-ai-gen-variety-fix` đã merge **Phase 02 (system prompt) + Phase 03 (sanitizer với weighted random, aliases, logging)**.
- Plan A phase 04 (fallback generator) + 05 (template composer) vẫn pending, KHÔNG conflict với Plan B.
- Plan B tập trung block-level design quality, độc lập về mặt nội dung với Plan A.

### Confirmed Decisions

1. **Branch: tiếp tục trên `feat/F01-ai-gen-variety-fix`** (cùng branch Plan A)
   - Plan B extend commit Plan A. PR lớn hơn nhưng atomic: AI variety + design quality ship cùng lúc.
   - Frontmatter `branch:` cần update từ `chore/cleanup-env-vars` → `feat/F01-ai-gen-variety-fix`.

2. **Phase 05: Full 47 blocks, 3 parallel subagents**
   - Không cắt MVP — làm hết Batch A (core 5) + B (secondary 9) + C (industry 33).
   - Mitigation inconsistency: shared checklist file + template BEFORE/AFTER example + cross-review pass cuối.

3. **CSS var migration: Rename, update 192 usages**
   - Rename `--brand-primary/--brand-secondary` sang semantic vars (`--accent`, `--surface-*`, `--text-*`, `--border`).
   - Codemod + grep verification, không giữ alias.

4. **Content validation: AI path + Template path**
   - Wire `validateBlockContent()` + `enforceMinContent()` vào CẢ `sanitizeBlockData()` (AI) VÀ `composeTemplate()`/`composeFromBlueprint()` (template, 15 builder functions).
   - Template content (`src/lib/ai/content/*.ts`) cũng phải qua rules đồng bộ.

### Action Items (cần update phase files trước khi code)

- [ ] **plan.md frontmatter**: `branch: feat/F01-ai-gen-variety-fix`
- [ ] **Phase 03 (Color)**: Đổi strategy từ "thêm vars mới" sang "rename + codemod 192 usages + grep verification"
- [ ] **Phase 04 (Content Validation)**: Thêm step wire vào `template-composer.ts` (15 builder functions), không chỉ sanitizer
- [ ] **Phase 05 (Block Audit)**: Viết shared checklist file (`phase-05-checklist.md`) cho 3 parallel subagents đồng bộ — template BEFORE/AFTER + token usage rules + acceptance gate
- [ ] **Execution order note**: Phase 01 (tokens) → 02 (typography) → 03 (color, rename) → 04 (content validation, 2 paths) → 05 (parallel block audit)

### Recommendation

**Revise 4 phase files theo action items trên**, sau đó ready để `/cook`. Plan B hiện có đầy đủ research + phases + scope — chỉ cần edits nhỏ để phản ánh validated decisions.

---

## Validation Round 2 (sau scout 2026-04-13)

Scout report `scout/scout-design-quality-scan.md` phát hiện 3 điểm lệch với plan gốc → re-validate:

### Phát hiện từ scout
- **496 usages** của `var(--brand-primary)` (plan ghi 192 — sai)
- `CSS_VARS` camelCase object dùng ở 60+ files (208+ refs)
- 473 inline `style={{}}` props có thể concat strings
- `src/lib/fonts/pairings.ts` đã có **15+ font pairings** sẵn
- `ALLOWED_HEADING_FONTS` + `ALLOWED_BODY_FONTS` whitelist đã có trong `openai-generator.ts` (lines 88-89)
- `template-composer.ts` có **25 builder functions** (15 core + 10 industry) — plan ghi 15
- `buildBlockFromSpec()` (line 963) = centralized hook cho cả 25 builders

### Revised Decisions

5. **CSS var rename: codemod 1 phát, update 496+ usages**
   - Không keep alias — rename triệt để trong 1 commit riêng.
   - Codemod script replace:
     - Raw CSS vars: `--brand-primary` → `--accent`, `--brand-secondary` → `--surface-secondary`, etc.
     - `CSS_VARS` object keys: `CSS_VARS.primary` → `CSS_VARS.accent`
     - Inline `style={{}}` strings
   - TypeScript errors sau rename giúp catch miss.
   - Verification: grep tên cũ = 0, build pass, visual diff sample sites.

6. **Font pairings: reuse `src/lib/fonts/pairings.ts`**
   - KHÔNG tạo `FONT_PAIRINGS` mới trong design-tokens.ts.
   - Phase 02 chỉ thêm:
     - `BLOCKED_PAIRINGS` validator (chặn same-font pairs như `Inter+Inter`)
     - Ensure tất cả 15 pairings pass contrast axis rule
     - Import Google Fonts thiếu vào `src/components/AppShell.tsx` (Playfair Display, Lora, Space Grotesk)

### Additional action items
- [ ] **Phase 04**: Fix "15 builders" → "25 builders", wire vào `buildBlockFromSpec()` (line 963) để centralize
- [ ] **Phase 02**: Xoá FONT_PAIRINGS đề xuất mới, chỉ add BLOCKED_PAIRINGS + AppShell font import
- [ ] **Phase 03**: Viết codemod script, update tất cả 496 raw + CSS_VARS keys + inline styles
- [ ] **Phase 05**: Note hero (11 variants tách file) khác 46 blocks khác (inline switch) — 2 approach khác nhau
