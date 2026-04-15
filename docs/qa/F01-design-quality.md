# QA Test Plan: F01 — Design Quality Rules (Block-Level)

> **Phiên bản:** 1.0
> **Ngày tạo:** 2026-04-13
> **Tác giả:** QA Engineer (Agent)
> **Nhánh:** `feat/F01-ai-gen-variety-fix` (chung với Plan A)
> **Nguồn tham chiếu:** PRD `docs/prd/F01-design-quality.md` (19 ACs), Scenario report `plans/260412-2300-design-quality-rules/reports/scenario-content-visual.md` (55 scenarios)

---

## 1. Tổng Quan

Feature này implement design quality rules ở block level: design tokens, typography scale, color system 60-30-10, content validation, apply tokens cho 47 blocks. Companion với Plan A (variety fix) — ship chung branch.

**Phạm vi:**
- 5 phases: design tokens, typography, color system, content validation, block audit
- 18 Functional Requirements (FR-01 → FR-18)
- 19 Acceptance Criteria (AC-01 → AC-19)
- 6 Critical + 20 High scenarios từ scenario report
- 47 blocks, 142 variants, 9+ Google Fonts, 496 CSS var rename

---

## 2. Test Strategy

### 2.1 Phân tầng theo Test Pyramid

```
         ┌─────────────────────────────────┐
         │ Visual Regression — 142 variants │  ← Screenshot diff BEFORE/AFTER refactor
         ├─────────────────────────────────┤
         │   E2E (Playwright) — 5 tests    │  ← Smoke path + a11y + responsive
         ├─────────────────────────────────┤
         │ Integration — 10 tests          │  ← AI path + template path full flow
         ├─────────────────────────────────┤
         │  Unit (Vitest) — 35+ tests      │  ← Pure functions, validators, tokens
         └─────────────────────────────────┘
```

### 2.2 Phân bổ theo phase

| Phase | Module | Số TC | Loại test chính |
|-------|--------|-------|-----------------|
| Phase 01 | `design-tokens.ts` + `SectionWrapper` | 6 | Unit + Visual |
| Phase 02 | `pairings.ts` + `Typography` + AppShell fonts | 8 | Unit + Integration |
| Phase 03 | `resolve.ts` + `color-utils.ts` + codemod | 10 | Unit + Integration |
| Phase 04 | `content-rules.ts` + AI/Template wiring + migration | 12 | Unit + Integration |
| Phase 05 | 47 blocks refactor | 10 | Visual regression |
| Backward Compat | Migration + legacy sites | 5 | Integration + E2E |
| Accessibility | WCAG AA + a11y | 4 | E2E (axe-core) |

**Tổng: 55 test cases**

### 2.3 Công cụ

| Loại | Tool | File đặt |
|------|------|----------|
| Unit | Vitest + TypeScript | `src/__tests__/unit/design-quality/*.test.ts` |
| Integration | Vitest + vi.mock(OpenAI) | `src/__tests__/integration/design-quality-*.test.ts` |
| E2E | Playwright | `src/__tests__/e2e/design-quality.spec.ts` |
| Visual regression | **Playwright + pixelmatch** (self-hosted, 2% tolerance) | `src/__tests__/visual/blocks/*.spec.ts` |
| Accessibility | `@axe-core/playwright` | `src/__tests__/e2e/a11y.spec.ts` |

### 2.4 Test Data

- **5 sample sites** cho visual regression: restaurant, tech, beauty, realestate, portfolio
- **Snapshot BEFORE refactor:** commit trước Plan B
- **Snapshot AFTER:** sau Phase 05 complete
- **Tolerance:** ≤ 2% pixel diff per variant

---

## 3. Risk Assessment

| # | Scenario | Module | Severity | Xác suất | Mức rủi ro |
|---|----------|--------|----------|----------|------------|
| R-01 | Codemod miss dynamic CSS var concat strings (473 inline styles) | codemod script | Critical | Cao | **Blocker** |
| R-02 | Parallel Phase 05 agents tạo inconsistency giữa 3 batches | 47 blocks | High | Trung bình | **High** |
| R-03 | 9+ Google Fonts bundle bloat → FCP regression | AppShell | Medium | Cao | **High** |
| R-04 | Content validation auto-fix phá vỡ block schema (Zod reject) | content-rules | High | Thấp | **High** |
| R-05 | Existing `modern-clean` pairing sites theme lost silently | migration script | Critical | Cao | **Blocker** |
| R-06 | Vietnamese/Malay blocked CTA slip through (English-only) | content-rules | Critical | Trung bình | **Blocker** |
| R-07 | Empty block drop → page < 3 blocks → broken render | page-level guard | Critical | Thấp | **High** |
| R-08 | Dark mode semantic var swap không maintain contrast | color-utils | Medium | Trung bình | **Medium** |
| R-09 | Vietnamese diacritics render với font không có subset | pairings.ts | Medium | Thấp | **Medium** |
| R-10 | `validateFontPairing` false-positive cho valid brand pairs | pairings.ts | Medium | Thấp | **Medium** |
| R-11 | RichText sanitizer pipeline order với content-rules | openai-generator | Medium | Thấp | **Medium** |
| R-12 | Grapheme count edge case (emoji + char limit) | content-rules | Low | Cao | **Low** |

---

## 4. Test Cases

### Phase 01 — Design Tokens (`design-tokens.ts` + `SectionWrapper`)

| TC-ID | Mô tả | AC | Loại | Scenario ref |
|-------|-------|-----|------|--------------|
| **TC-F01D-01.01** | `SPACING` constants export đầy đủ 10 steps (xs → 6xl) | AC-01 | Unit | — |
| **TC-F01D-01.02** | `SectionWrapper` render với `padding="default"` → Tailwind class `py-16 md:py-24` | AC-01 | Unit | — |
| **TC-F01D-01.03** | `SectionWrapper` với `container="narrow"` → `max-w-3xl` | AC-02 | Unit | — |
| **TC-F01D-01.04** | `SectionWrapper` alternate backgrounds index 0/1/2 → white/gray/white | FR-02 | Unit | — |
| **TC-F01D-01.05** | Grep `container mx-auto px-6` trong `src/blocks/` = 0 matches | AC-03 | Integration | — |
| **TC-F01D-01.06** | Mobile 375px viewport: SectionWrapper padding responsive correct, no overflow | AC-04 | Visual | #24 |

### Phase 02 — Typography + Fonts (`pairings.ts` + `Typography` + AppShell)

| TC-ID | Mô tả | AC | Loại | Scenario ref |
|-------|-------|-----|------|--------------|
| **TC-F01D-02.01** | `validateFontPairing({headingFont: 'Inter', bodyFont: 'Inter'})` → `{valid: false}` | AC-05 | Unit | — |
| **TC-F01D-02.02** | `validateFontPairing` 20 pairings trong `FONT_PAIRINGS` all valid (sau fix 2) | AC-06 | Unit | — |
| **TC-F01D-02.03** | `modern-clean` pairing sau fix: body font ≠ Inter | FR-05 | Unit | — |
| **TC-F01D-02.04** | `humanist` pairing sau fix: body font ≠ DM Sans | FR-05 | Unit | — |
| **TC-F01D-02.05** | `Heading level={1}` render → `<h1>` với `text-3xl md:text-4xl lg:text-5xl` | FR-03 | Unit | — |
| **TC-F01D-02.06** | Body text class `text-base` không bao giờ nhỏ hơn 16px | AC-08 | Unit | — |
| **TC-F01D-02.07** | AppShell.tsx load 9+ Google Fonts qua `next/font` (Playfair, Lora, Space Grotesk, ...) | FR-05 | Integration | — |
| **TC-F01D-02.08** | Vietnamese text "á à ả ã ạ" render đúng với Inter (vietnamese subset) | AC-07 | E2E | #32 |

### Phase 03 — Color System + Codemod (`resolve.ts` + `color-utils.ts`)

| TC-ID | Mô tả | AC | Loại | Scenario ref |
|-------|-------|-----|------|--------------|
| **TC-F01D-03.01** | Grep `brand-primary\|brand-secondary\|brand-accent` src/ = 0 matches | AC-09 | Integration | — |
| **TC-F01D-03.02** | Grep `CSS_VARS\.primary\|CSS_VARS\.secondary` src/ = 0 matches | AC-09 | Integration | — |
| **TC-F01D-03.03** | `pnpm tsc --noEmit` pass sau codemod | AC-12 | Integration | — |
| **TC-F01D-03.04** | `pnpm build` pass sau codemod | AC-12 | Integration | — |
| **TC-F01D-03.05** | `checkContrast('#000000', '#ffffff')` → `{ratio: 21, passAA: true, passAALarge: true}` | FR-08 | Unit | — |
| **TC-F01D-03.06** | `checkContrast('#777777', '#ffffff')` → `{ratio: 4.48, passAA: false}` (boundary) | FR-08 | Unit | — |
| **TC-F01D-03.07** | `checkContrast('not-a-color', '#fff')` → safe fallback không throw | R-04 | Unit | #34 |
| **TC-F01D-03.08** | `tintNeutral('#0ea5e9', 0.95)` → brand-tinted near-white, hue preserved | FR-08 | Unit | — |
| **TC-F01D-03.09** | Dark mode: semantic vars swap → text contrast vẫn ≥ 4.5:1 | FR-07 | Integration | #26 |
| **TC-F01D-03.10** | `generateThemeCSS` fallback (line 185-197) còn legacy var aliases cho backward compat | FR-07 | Unit | #42 |

### Phase 04 — Content Validation + Migration

| TC-ID | Mô tả | AC | Loại | Scenario ref |
|-------|-------|-----|------|--------------|
| **TC-F01D-04.01** | `validateBlockContent({headline: 'a'.repeat(50)})` → 11+ words warning | AC-15 | Unit | #3 |
| **TC-F01D-04.02** | Headline exact 10 words → pass | AC-15 | Unit | #2 |
| **TC-F01D-04.03** | `ctaLabel: "Submit"` → invalid + fix "Get Started" | AC-13 | Unit | #5 |
| **TC-F01D-04.04** | `ctaLabel: "submit"` (lowercase) → case-insensitive match | AC-13 | Unit | #6 |
| **TC-F01D-04.05** | `validateBlockContent({ctaLabel: 'Gửi'}, 'vi')` → invalid + suggest VN | AC-17 | Unit | #8 C1 |
| **TC-F01D-04.06** | `validateBlockContent({ctaLabel: 'Hantar'}, 'ms')` → invalid + suggest MS | AC-17 | Unit | #8 C1 |
| **TC-F01D-04.07** | `enforceMinContent('testimonials', 'carousel', 2)` → fallback `cards` | AC-14 | Unit | #15 |
| **TC-F01D-04.08** | Integration: `generateSiteWithAI` với AI return blocked CTA → sanitizer fix | AC-13 | Integration | — |
| **TC-F01D-04.09** | Integration: `composeFromBlueprint` template path → `buildBlockFromSpec` validate | AC-14 | Integration | — |
| **TC-F01D-04.10** | Page-level guard: AI return 1 block → fallback skeleton 3 blocks | AC-19 | Integration | #18 #19 |
| **TC-F01D-04.11** | Migration script dry-run: detect legacy `modern-clean` sites, không update | AC-18 | Integration | #40 |
| **TC-F01D-04.12** | Migration script `--apply`: update pairing `modern-clean` → `startup-vibe` | AC-18 | Integration | #40 |
| **TC-F01D-04.13** | `validateOrdering([nav, hero, stats, features, footer])` → warning "features must come before stats" + reorder suggestion | AC-16 | Unit | #51 |
| **TC-F01D-04.14** | `validateOrdering([nav, hero, features, stats, testimonials, pricing, footer])` → pass (AIDA funnel correct) | AC-16 | Unit | — |
| **TC-F01D-04.15** | `validateOrdering` với category `"fundraising"` cho phép `stats` trước `features` (category-aware override) | AC-16 | Unit | #51 |

### Phase 05 — Block Audit (47 blocks)

| TC-ID | Mô tả | AC | Loại | Scenario ref |
|-------|-------|-----|------|--------------|
| **TC-F01D-05.01** | Visual regression: hero 11 variants BEFORE vs AFTER ≤ 2% diff | R-02 | Visual | — |
| **TC-F01D-05.02** | Visual regression: features 4 variants ≤ 2% diff | R-02 | Visual | — |
| **TC-F01D-05.03** | Visual regression: testimonials 6 variants ≤ 2% diff | R-02 | Visual | — |
| **TC-F01D-05.04** | Visual regression: 9 secondary blocks (Batch B) ≤ 2% diff | R-02 | Visual | — |
| **TC-F01D-05.05** | Visual regression: 33 industry blocks (Batch C) ≤ 2% diff | R-02 | Visual | — |
| **TC-F01D-05.06** | Grep `py-16\|py-20\|py-24` inline trong `src/blocks/` replaced by `SectionWrapper` | FR-13 | Integration | — |
| **TC-F01D-05.07** | Grep `<h1\|<h2\|<h3\|<h4` raw tags trong blocks replaced by `<Heading>` | FR-03 | Integration | — |
| **TC-F01D-05.08** | Cross-review: 3 batches consistent (same token imports, same wrapper pattern) | R-02 | Integration | — |
| **TC-F01D-05.09** | Screen reader: heading hierarchy h1→h2→h3 không skip levels | AC-08 | E2E | #28 |
| **TC-F01D-05.10** | Browser zoom 200%: body text reflow không break layout | AC-04 | E2E | #27 |

### Backward Compatibility + Migration

| TC-ID | Mô tả | AC | Loại | Scenario ref |
|-------|-------|-----|------|--------------|
| **TC-F01D-BC.01** | Existing site load sau deploy Plan B — visual unchanged | R-05 | E2E | #42 #48 |
| **TC-F01D-BC.02** | Payload DB schema không thay đổi — Zod validation pass | R-04 | Integration | #43 |
| **TC-F01D-BC.03** | Legacy fallback CSS vars alongside semantic vars active | R-05 | Unit | — |
| **TC-F01D-BC.04** | Migration script rollback: snapshot file khôi phục | FR-17 | Integration | — |
| **TC-F01D-BC.05** | 3 production sites load sau migration — theme drift ≤ expected | R-05 | E2E | #48 |

### Accessibility (WCAG 2.1 AA)

| TC-ID | Mô tả | AC | Loại | Scenario ref |
|-------|-------|-----|------|--------------|
| **TC-F01D-A11Y.01** | Axe-core scan 5 sample sites — 0 critical violations | NFR | E2E | — |
| **TC-F01D-A11Y.02** | All text contrast ratio ≥ 4.5:1 (normal) hoặc 3:1 (large) | AC-10 | E2E | — |
| **TC-F01D-A11Y.03** | CTA touch targets ≥ 44px × 44px | NFR | E2E | — |
| **TC-F01D-A11Y.04** | Section landmarks (`<section>`) present via SectionWrapper | FR-02 | E2E | — |

---

## 5. Test Data & Fixtures

### 5.1 Sample Sites cho Visual Regression

```typescript
// src/__tests__/fixtures/sample-sites.ts
export const SAMPLE_SITES = [
  { id: 'restaurant-sample', category: 'restaurant', pairingId: 'cafe-bistro' },
  { id: 'tech-sample', category: 'tech', pairingId: 'tech-forward' },
  { id: 'beauty-sample', category: 'beauty', pairingId: 'luxury-brand' },
  { id: 'realestate-sample', category: 'realestate', pairingId: 'pro-corporate' },
  { id: 'portfolio-sample', category: 'creative', pairingId: 'creative-studio' },
]
```

### 5.2 Blocked Content Fixtures

```typescript
export const BAD_CONTENT_CASES = {
  en: [
    { ctaLabel: 'Submit' },
    { ctaLabel: 'Click Here' },
    { headline: 'Welcome to our website' },
    { headline: 'a '.repeat(15).trim() }, // 15 words
  ],
  vi: [
    { ctaLabel: 'Gửi' },
    { ctaLabel: 'Nhấn vào đây' },
  ],
  ms: [
    { ctaLabel: 'Hantar' },
    { ctaLabel: 'Klik di sini' },
  ],
}
```

### 5.3 Mock AI Responses

```typescript
export const MOCK_AI_RESPONSES = {
  validSite: { /* full 8-block page */ },
  blockedCTA: { /* block với ctaLabel: 'Submit' */ },
  truncatedMidBlock: { /* JSON truncate tại items[] */ },
  emptyTestimonials: { /* items: [] */ },
  singleBlockPage: { /* chỉ hero, test fallback skeleton */ },
}
```

---

## 6. Execution Plan

### 6.1 Pre-implementation
- [ ] Baseline screenshot 142 variants trên branch Plan A HEAD (commit beffa9b)
- [ ] Lưu baseline vào `src/__tests__/visual/baseline/`

### 6.2 Per-phase
- [ ] Phase 01: Run TC-01.01 → 01.06 sau complete
- [ ] Phase 02: Run TC-02.01 → 02.08 sau complete
- [ ] Phase 03: Run codemod + TC-03.01 → 03.10
- [ ] Phase 04: Run TC-04.01 → 04.12
- [ ] Phase 05: Run visual regression 142 variants sau mỗi batch

### 6.3 Pre-merge gates
- [ ] 100% unit tests pass
- [ ] 100% integration tests pass
- [ ] Visual regression ≤ 2% diff per variant
- [ ] Axe-core 0 critical violations
- [ ] `pnpm tsc --noEmit` pass
- [ ] `pnpm build` pass
- [ ] Manual test 5 sample sites render OK
- [ ] Migration script dry-run trên staging snapshot reviewed

### 6.4 Post-deploy verification
- [ ] Smoke test staging: generate 3 new sites (categories khác nhau)
- [ ] Load 5 existing staging sites — visual unchanged
- [ ] Bundle size delta ≤ 500KB
- [ ] Lighthouse performance score không regress > 5 điểm

---

## 7. Traceability Matrix

| AC | TC-IDs |
|----|--------|
| AC-01 | TC-01.01, TC-01.02 |
| AC-02 | TC-01.03 |
| AC-03 | TC-01.05 |
| AC-04 | TC-01.06, TC-05.10 |
| AC-05 | TC-02.01 |
| AC-06 | TC-02.02 |
| AC-07 | TC-02.08 |
| AC-08 | TC-02.06, TC-05.09 |
| AC-09 | TC-03.01, TC-03.02 |
| AC-10 | TC-A11Y.02 |
| AC-11 | TC-A11Y.02 (indirect) |
| AC-12 | TC-03.03, TC-03.04 |
| AC-13 | TC-04.03, TC-04.04, TC-04.08 |
| AC-14 | TC-04.07, TC-04.09 |
| AC-15 | TC-04.01, TC-04.02 |
| AC-16 | TC-04.13, TC-04.14, TC-04.15 |
| AC-17 | TC-04.05, TC-04.06 |
| AC-18 | TC-04.11, TC-04.12 |
| AC-19 | TC-04.10 |

**AC-16 pending test** — cần thêm TC cho section ordering (features before stats) trong Phase 04.

---

## 8. Out of Scope

- Performance testing với load > 100 concurrent site generations (infra test)
- Browser compat < Chrome 90 / Safari 14 (Next.js 15 baseline)
- Print stylesheet
- RTL (right-to-left) language support
- IE11 / legacy browser

---

## 9. Dependencies

- **Plan A merged:** commit `beffa9b` (sanitizer với VARIANT_ALIASES) required cho TC-04.08
- **Test infrastructure:** Playwright + `@axe-core/playwright` (add to `package.json` nếu chưa có)
- **Visual regression:** Playwright screenshot + `pixelmatch` npm (~5KB, add to devDependencies). Baseline commit = Plan A HEAD (`beffa9b`)
- **Sample data:** 5 sample sites fixture + 3 production snapshots

---

## 10. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-13 | QA Engineer | Initial draft — 55 TCs, 12 risks, traceability matrix |
