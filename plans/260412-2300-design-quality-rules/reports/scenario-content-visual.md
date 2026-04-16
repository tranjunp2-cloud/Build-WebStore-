# Scenario Report: Content Validation Rules + Visual Regression

**Target:** `src/lib/ai/content-rules.ts` (NEW) + 47 blocks × 142 variants refactor
**Plan:** `plans/260412-2300-design-quality-rules/plan.md`
**Date:** 2026-04-13

**Dimensions analyzed:** 2, 4, 5, 6, 7, 9, 10, 12
**Dimensions skipped:**
- (1) User Types — không có user role distinctions, AI path vs template path đã cover
- (3) Timing — pure validation functions, không race condition
- (8) Authorization — không liên quan
- (11) Compliance — no PII trong block content

---

## Scenario Table

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|-----------|----------|----------|-------------------|
| **Input Extremes** | | | | |
| 1 | Input | `headline: ""` (empty string) required field | High | `validateBlockContent` return invalid + fix: auto-fill placeholder từ business name |
| 2 | Input | `headline` exact **10 words** (boundary of max 10) | Medium | Pass validation (≤ 10, not < 10) |
| 3 | Input | `headline` **11 words** (just over limit) | Medium | Warn + truncate to first 10 words preserving sentence boundary |
| 4 | Input | `headline: null` or `undefined` | High | Skip validation, `validateBlocks()` reject block via Zod schema |
| 5 | Input | `ctaLabel: "Submit"` (exact case match blocked) | High | Replace with "Get Started"/"Contact Us" + log warning |
| 6 | Input | `ctaLabel: "submit"` (lowercase variant) | High | Case-insensitive match → same fix as #5 |
| 7 | Input | `ctaLabel: "SUBMIT FORM"` (longer phrase containing blocked word) | Medium | Regex word-boundary match → fix "Submit" word, preserve "Form" |
| 8 | Input | `ctaLabel: "Gửi"` (Vietnamese for "Submit") | **Critical** | **GAP:** blocked list English-only — Vietnamese/Malay slip through → user sees bad CTA in production |
| 9 | Input | `headline` contains emoji `"📸 Welcome to our studio"` | Low | Emoji không count as word; validation skips "Welcome to our" generic check |
| 10 | Input | `headline` contains `<script>alert()</script>` | **Critical** | RichText sanitizer đã strip (existing), content-rules validate sau sanitize pipeline — no XSS |
| 11 | Input | `feature.description` exactly **150 chars** (boundary) | Low | Pass (≤ 150) |
| 12 | Input | `feature.description` = 151 chars | Low | Warn + truncate at word boundary |
| **Scale** | | | | |
| 13 | Scale | `testimonials` với `items: []` (0 items), variant=`cards` | High | `enforceMinContent` fallback → variant = simplest available (`simple`) OR drop block entirely |
| 14 | Scale | `testimonials` với `items: [...3]`, variant=`carousel` (exact min) | Medium | Pass — existing VARIANT_MIN_CONTENT carousel=3 |
| 15 | Scale | `testimonials` với `items: [...2]`, variant=`carousel` (below min) | High | Fallback → `cards` (min 2) OR `simple` (min 1) |
| 16 | Scale | `features` với `items: [...4]`, variant=`grid-3` | Low | Pass + 1 extra item ignored OR shown as 4-column (visual inconsistency) |
| 17 | Scale | `gallery` với `items: [...100]`, variant=`masonry` | Medium | Pass but no max enforcement → may break layout, pagination out-of-scope |
| 18 | Scale | `pricing` với `plans: []` | **Critical** | Empty pricing block renders broken — drop block entirely, log warn |
| 19 | Scale | Page có **0 blocks** sau validation (all dropped) | **Critical** | Fallback to default skeleton (nav + hero + footer) |
| **State Transitions** | | | | |
| 20 | State | AI response **truncated mid-JSON** → parsed block has partial fields | High | Existing truncation repair (line 78-85), validateBlocks catches via Zod — partial block dropped |
| 21 | State | Template builder fails mid-compose (`buildFeatures` throws) | High | `buildBlockFromSpec` try/catch, log error, skip block |
| 22 | State | Block validated once, passed through auto-fix, re-validated (idempotent?) | Medium | Second pass MUST return same result (no infinite fix loop) |
| 23 | State | AI response includes field `variant: "Grid-3"` → sanitizer fuzzy-match → `grid-3` → then content validation reads variant | Medium | Validation chạy sau sanitize, variant đã normalized → consistent |
| **Environment (Visual Regression)** | | | | |
| 24 | Env | Mobile 375px viewport: `SectionWrapper padding='hero'` renders | High | `py-24` không overflow, container `max-w-6xl` responsive, text không crop |
| 25 | Env | Desktop 1920px: `container='default'` (max-w-6xl 1152px) | Low | Content centered, side margins present |
| 26 | Env | Dark mode: semantic vars `--surface-primary/secondary/card` swap correctly | High | Text contrast still ≥ 4.5:1, accent color desaturated (impeccable rule) |
| 27 | Env | Browser zoom 200%: body text `text-base` (16px) → 32px | Medium | Layout không break, reflow works |
| 28 | Env | Screen reader: `<Heading level={1-4}>` semantic HTML | High | Hierarchy correct h1→h2→h3, không skip levels within same block |
| 29 | Env | Safari iOS: `next/font` 9+ Google Fonts load | Medium | FOIT/FOUT acceptable với `display: swap` — no blank text |
| 30 | Env | Low-end Android (slow CPU/network): 9+ fonts bundle impact | High | FCP ≤ 2.5s, bundle delta ≤ 500KB — monitor NFR gate |
| 31 | Env | Browser không hỗ trợ CSS vars (IE11, legacy) | Low | Out of scope — Next.js 15 không support IE |
| 32 | Env | Vietnamese text với dấu (á à ả ã ạ): font rendering | High | Inter + Outfit đã có Vietnamese subset (`latin` + `vietnamese`) — confirm trong `AppShell.tsx` |
| **Error Cascades** | | | | |
| 33 | Error | `validateBlockContent` throws (e.g., regex fails) | High | Try/catch fallback — return `{valid: true, warnings: [], fixes: {}}` to không block pipeline |
| 34 | Error | `checkContrast` throws on malformed hex `"not-a-color"` | Medium | Validate hex format trước, return default (pass=false) nếu invalid |
| 35 | Error | Codemod miss → `pnpm build` fails at CI | High | CI catches, PR blocked, manual grep step trong Phase 03 |
| 36 | Error | Google Fonts CDN down | Medium | `next/font` self-hosts → no runtime dependency after build ✓ |
| 37 | Error | `generateThemeCSS()` throws → fallback CSS (line 185-197) | Medium | Existing fallback uses legacy `--brand-primary` names → after rename, update fallback cũng |
| 38 | Error | Auto-fix sets required field to `undefined` → Zod reject | High | `fixes` chỉ replace value, never delete key; test coverage |
| 39 | Error | Parallel subagents Phase 05 — 1 agent fails mid-batch | High | Main agent collects partial results, retry failed agent với narrower scope |
| **Data Integrity** | | | | |
| 40 | Integrity | Existing site saved với `fontHeading: 'Inter', fontBody: 'Inter'` (modern-clean legacy) | **Critical** | Validator reject → auto-swap to default (Outfit+Inter) → **user-saved theme lost silently** → migration script needed |
| 41 | Integrity | Rename codemod touches Markdown comment `<!-- --brand-primary -->` | Low | Codemod scope limited to `.ts/.tsx/.css/.js`, skip `.md` |
| 42 | Integrity | Block saved in Payload DB với old CSS var name → HTML render lookup fails | **Critical** | Fallback CSS vars giữ legacy names alongside semantic vars trong `generateThemeCSS()` |
| 43 | Integrity | Zod schema accept block after validateBlockContent auto-fix | High | Test: fix → Zod → ensure shape match |
| 44 | Integrity | Block có field optional `ctaSecondary`, fix empty → set undefined | Medium | Preserve optional semantics — delete key vs set undefined (Zod pass both?) |
| **Integration** | | | | |
| 45 | Integration | Plan A `VARIANT_ALIASES` maps `"Three-column"` → `"grid-3"`, content validation reads normalized | Medium | Validation runs AFTER sanitize (line 529+) — alias already applied ✓ |
| 46 | Integration | AI return block type `"feature-grid"` (unknown), existing `validateBlocks` (line 109-126) drops | Medium | Content validation never reached — existing guard |
| 47 | Integration | Payload CMS client render reads saved block JSON | High | No change: block schema unchanged — backward compat ✓ |
| 48 | Integration | Staging DB có 100+ existing sites — deploy plan B | **Critical** | Migration: font pairing legacy check + CSS var fallback giữ → existing sites unaffected |
| 49 | Integration | OpenAI temperature 0.7 sometimes returns English even user asked Vietnamese | Medium | Language validation exists (plan A) — content validation English-only fine for en path |
| **Business Logic** | | | | |
| 50 | BizLogic | Business name "Apple" (1 word) — hero headline "Apple" (below min 3 words) | Medium | Min 3 words rule cho generic headlines, exception cho branded single-word |
| 51 | BizLogic | User chọn `category: "fundraising"` cần stats TRƯỚC features (social proof leads) | High | ORDERING_RULES feature-before-stats không áp dụng cho all categories — config per-category |
| 52 | BizLogic | Vietnamese CTA "Đăng ký ngay" (Sign up now, good) pass validation | Medium | English whitelist không match Vietnamese → validation false-positive block? — cần language-aware |
| 53 | BizLogic | User thêm custom block (user-authored) không cần validation | Low | Validation chỉ áp dụng trong AI/template path, không áp dụng user-edit path |
| 54 | BizLogic | Hero headline containing business name từ form: "Welcome to {bizName}" — template path auto-gen | High | "Welcome to" substring match BLOCKED_CONTENT → false positive cho legit hero |
| 55 | BizLogic | Feature description = 149 chars + trailing emoji = 151 chars (graphemes vs bytes) | Low | Use `[...str].length` for grapheme count, not byte/code-point count |

---

## Summary

| Severity | Count |
|----------|-------|
| **Critical** | 6 |
| **High** | 20 |
| **Medium** | 21 |
| **Low** | 8 |
| **Total** | **55** across 8 dimensions |

---

## Top Critical Scenarios (action required)

### C1. Multi-language CTA gap (#8)
**Risk:** BLOCKED_CONTENT + blocked CTA lists English-only. Vietnamese/Malay users see `"Gửi"`, `"Nhấn vào đây"`, `"Klik di sini"` slip through.

**Mitigation:**
- Extend blocked lists với Vietnamese + Malay translations
- Hoặc flip approach: whitelist approved action verbs per language (Get/Book/Start + Lấy/Đặt/Bắt đầu + Dapatkan/Tempah/Mula)
- Mark trong PRD Open Questions

### C2. XSS in headlines (#10)
**Risk:** `<script>` in content. **Already mitigated** bởi existing RichText sanitizer. Confirm content-rules chạy SAU sanitizer.

**Mitigation:**
- Test case: `headline: "<script>alert(1)</script>Test"` → sanitize strips, validateBlockContent sees `"Test"` (3 chars, below min 3 words)
- Document pipeline order trong PRD Technical Notes

### C3. Empty pricing/testimonials block (#18, #19)
**Risk:** Block drops all items → renders broken empty section. Nếu all blocks dropped → empty page.

**Mitigation:**
- `validateBlockContent` return `drop: true` signal cho empty required blocks
- Page-level guard: min 3 blocks (nav, hero, footer) mandatory
- Test: AI return 1 block → fallback adds skeleton

### C4. Legacy same-font themes migration (#40)
**Risk:** Existing sites saved với `fontHeading: 'Inter', fontBody: 'Inter'` (legacy `modern-clean` pairing). Validator reject → user theme silently lost.

**Mitigation:**
- `validateFontPairing` trong runtime chỉ warn, không force fallback nếu existing site
- Migration script: scan Payload DB, update pairing ID to valid alternative
- Grandfather existing sites (skip validation for pre-migration sites)

### C5. Saved block CSS var rename (#42)
**Risk:** Existing sites save block HTML với `var(--brand-primary)` inline. Rename raw CSS vars → DB data stale.

**Mitigation:**
- Keep legacy CSS var aliases trong `globals.css` AND `generateThemeCSS()` fallback output (lines 185-197)
- `--brand-primary: var(--accent)` alias cho backward compat
- **⚠️ Decision conflict:** User chọn "rename 1 phát" trong validation, nhưng C5 cần alias. Revisit!

### C6. Deploy migration risk (#48)
**Risk:** Staging có 100+ existing sites. Plan B deploy → font validation auto-fallback → user themes drift.

**Mitigation:**
- Migration script dry-run trên staging snapshot trước
- Feature flag: `DESIGN_QUALITY_VALIDATION=off` cho existing sites
- Rollout: new sites only Phase 1, backfill Phase 2

---

## Recommended Actions (before /cook)

1. **⚠️ REVISIT Q3 validation decision** (rename triệt để vs keep alias) — Scenario C5 cho thấy cần alias cho backward compat. Options:
   - (a) Keep alias cho saved DB blocks, codemod chỉ touch source code
   - (b) Migration script đọc DB → update block HTML strings
   - (c) Accept visual drift cho legacy sites, document trong release notes

2. **Extend content-rules.ts** cho multi-language:
   - `BLOCKED_CTA_LABELS_BY_LANG: Record<'en' | 'vi' | 'ms', string[]>`
   - Validation reads `theme.language` or `info.language`

3. **Add category-aware ORDERING_RULES:**
   - `features-before-stats` không áp dụng cho fundraising/nonprofit
   - Config: `ORDERING_RULES_BY_CATEGORY`

4. **Add page-level guard** sau validation loop:
   - `MIN_BLOCKS_PER_PAGE = 3` (nav + hero + footer minimum)
   - Fallback skeleton nếu total < min

5. **Font migration plan:**
   - Script `scripts/migrate-legacy-font-pairings.mjs`
   - Scan Payload DB `themes` collection
   - Update legacy `{fontHeading: 'Inter', fontBody: 'Inter'}` → `{fontHeading: 'Outfit', fontBody: 'Inter'}`
   - Log before/after per site

6. **Test gaps cần bổ sung vào QA plan:**
   - Grapheme count edge cases (#55)
   - RichText sanitizer + content-rules pipeline order (#10)
   - Dark mode semantic var swap (#26)
   - Vietnamese font rendering (#32)
   - Idempotency (#22)

---

## Unresolved Questions

1. **Backward compat strategy** — rename triệt để hay keep alias? (conflict với validation Q3 answer)
2. **Multi-language content rules** — English-only hay i18n lists? Effort impact: +1 ngày
3. **Page-level guard** — fallback skeleton cho empty pages: in scope Plan B hay defer Plan A?
4. **Font migration script** — required trước deploy hay post-deploy cleanup?
5. **Grandfather existing sites** — apply Phase 1 cho new sites only, backfill later?
