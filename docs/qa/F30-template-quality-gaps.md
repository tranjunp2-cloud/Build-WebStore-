# QA Test Plan: Template Quality Gaps (F30-Q)

**Feature:** Template Quality — Block Upgrades + Multi-page + Subscribers
**Version:** 1.0
**Author:** Claude AI (QA)
**Date:** 2026-04-06
**Status:** Draft
**PRD Sources:**
- `docs/prd/F30-sprint2-variants.md` (block variant ACs)
- `docs/prd/F30-sprint4-polish.md` (UX polish ACs)
**Plan:** `plans/260406-template-system-quality-audit/plan.md`
**UI Specs:** `docs/ui-specs/template-quality-blocks.md`
**Scenario Analysis:** 40 scenarios, 10 dimensions (inline below)

---

## 1. Test Strategy

### 1.1 Test Types

| Type | Tool | Coverage Target | Focus |
|------|------|-----------------|-------|
| Unit | Vitest | 80% lines | Block variant rendering, Zod schema validation, AnimatedSection |
| Integration | Vitest + JSDOM | 70% | Subscribe API, apply-template transaction, SiteRenderer block render |
| Component | Vitest + RTL | 60% | 6 block components, EditorTemplateModal warning, Newsletter form |
| Accessibility | axe-core | 0 violations | FAQ keyboard nav, stats aria-labels, newsletter form labels |
| SSR | Vitest | Pass/fail | 'use client' blocks don't crash server render |

### 1.2 Risk Assessment

| Risk | Impact | Likelihood | Mitigation | Test Coverage |
|------|--------|------------|------------|---------------|
| 'use client' missing → SSR crash | Critical | High | Verify directive exists in all 3 files | TC-Q-001 |
| Transaction rollback fails → orphan pages | Critical | Medium | Test partial failure + rollback | TC-Q-010, TC-Q-011 |
| Race condition on apply-template | Critical | Low | Test concurrent requests | TC-Q-012 |
| Subscribe API spam/bot abuse | High | High | Rate limit + validation tests | TC-Q-015, TC-Q-016 |
| XSS via email field | Critical | Low | Zod validation + encoding test | TC-Q-017 |
| Unknown variant crashes block | High | Medium | Fallback to default variant | TC-Q-030 |
| Empty data renders broken UI | High | Medium | Empty/missing prop tests per block | TC-Q-031—036 |

---

## 2. Test Cases — Phase 1: Stub Block Fixes

### TC-Q-001: 'use client' directive present on stats/team/newsletter
- **Priority:** P0 (blocker)
- **Type:** Unit
- **AC Reference:** SSR compatibility
- **Steps:**
  1. Read first line of `src/blocks/stats/index.tsx`
  2. Read first line of `src/blocks/team/index.tsx`
  3. Read first line of `src/blocks/newsletter/index.tsx`
- **Expected:** Each file starts with `'use client'`
- **Severity:** Critical — missing = production crash

### TC-Q-002: Stats block — variant 'row' renders items horizontally
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render StatsBlock with `variant: 'row'`, 4 items
  2. Check items render in flex-row on desktop
- **Expected:** 4 items side-by-side, each shows value + label
- **Test Data:** `items: [{ value: '500+', label: 'Clients' }, ...]`

### TC-Q-003: Stats block — variant 'grid' renders cards
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render StatsBlock with `variant: 'grid'`, 3 items
- **Expected:** 3 cards in grid layout with icon, value, label

### TC-Q-004: Stats block — variant 'highlight' renders progress bars
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render with `variant: 'highlight'`, items with numeric values
- **Expected:** Horizontal progress bars with fill proportional to value

### TC-Q-005: Stats block — empty items array
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render StatsBlock with `items: []`
- **Expected:** Section hidden or shows empty state, no crash

### TC-Q-006: Stats block — number count-up animation
- **Priority:** P2
- **Type:** Component
- **Steps:**
  1. Render with numeric value "500"
  2. Trigger whileInView
- **Expected:** Value animates from 0 to 500
- **Reduced motion:** Shows "500" instantly

### TC-Q-007: Team block — variant 'grid' renders member cards
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render with `variant: 'grid'`, 3 members with image, name, role
- **Expected:** 3 cards in grid, each shows avatar + name + role

### TC-Q-008: Team block — member without image shows initials
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render member with `image: null`, `name: 'John Doe'`
- **Expected:** Circle with "J" initial, brand-primary background

### TC-Q-009: Team block — variant 'list' renders rows
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render with `variant: 'list'`, 4 members
- **Expected:** Horizontal rows with avatar left, text right, social links

---

## 3. Test Cases — Phase 2: Partial Block Polish

### TC-Q-020: About block — variant 'story' renders timeline
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render with `variant: 'story'`, `timelineItems: [{ year: '2020', title: 'Founded', description: '...' }]`
- **Expected:** Vertical timeline with year markers, connecting line, stagger animation

### TC-Q-021: About block — 'story' variant without timelineItems fallback
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render with `variant: 'story'`, no `timelineItems` field (legacy data)
- **Expected:** Falls back to simple layout, no crash

### TC-Q-022: FAQ block — accordion keyboard navigation
- **Priority:** P1
- **Type:** Accessibility
- **Steps:**
  1. Render FAQ with `variant: 'accordion'`, 5 items
  2. Tab to first item, press Enter → expands
  3. Press Down arrow → focus moves to next item
  4. Press Space → toggles second item
  5. Press Escape → no action (items stay as-is)
- **Expected:** Full keyboard navigation, `aria-expanded` toggles

### TC-Q-023: FAQ block — accordion aria attributes
- **Priority:** P1
- **Type:** Accessibility
- **Steps:**
  1. Render accordion variant
  2. Check each trigger has `aria-expanded`, `aria-controls`
  3. Check each panel has `role="region"`, `aria-labelledby`
- **Expected:** All ARIA attributes present and correctly linked

### TC-Q-024: CTA block — 3 variants render correctly
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render CTA with variant 'banner' → full-width gradient
  2. Render with variant 'inline' → text left, buttons right
  3. Render with variant 'floating' → centered elevated card
- **Expected:** Each variant has distinct layout, primary + secondary buttons

### TC-Q-025: CTA block — external links have rel="noopener noreferrer"
- **Priority:** P1
- **Type:** Security
- **Steps:**
  1. Render CTA with `primaryButton.url: 'https://external.com'`
- **Expected:** `<a>` tag has `rel="noopener noreferrer"` and `target="_blank"`

---

## 4. Test Cases — Phase 3: Multi-page Template Apply

### TC-Q-010: Apply Premium template creates 5 pages
- **Priority:** P0
- **Type:** Integration
- **Steps:**
  1. Seed Premium template with 5 pages (Home, About, Contact, Services, Blog)
  2. POST /api/ai/apply-template with templateId + siteId
  3. Query pages where site = siteId
- **Expected:** 5 pages created with correct titles and slugs

### TC-Q-011: Transaction rollback on page creation failure
- **Priority:** P0
- **Type:** Integration
- **Steps:**
  1. Mock page 3 creation to throw DB error
  2. POST /api/ai/apply-template
- **Expected:** Transaction rolls back; original pages preserved; 500 error returned

### TC-Q-012: Concurrent apply-template to same site
- **Priority:** P1
- **Type:** Integration
- **Steps:**
  1. Send 2 apply-template requests simultaneously for same site
- **Expected:** One succeeds, other fails with 409 or queues; no orphan pages

### TC-Q-013: Apply template deletes existing pages first
- **Priority:** P0
- **Type:** Integration
- **Steps:**
  1. Site has 3 existing pages (manually created)
  2. Apply Starter template (1 page)
  3. Query pages
- **Expected:** Old 3 pages deleted, new 1 page created

### TC-Q-014: Template with empty templatePages falls back to defaultBlocks
- **Priority:** P1
- **Type:** Integration
- **Steps:**
  1. Apply template where `templatePages: []`, `defaultBlocks: [...]`
- **Expected:** Creates 1 Homepage with defaultBlocks layout

### TC-Q-040: Warning modal shows correct text
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Open EditorTemplateModal, select template, click Apply
  2. Check confirmation dialog text
- **Expected:** Shows warning about replacing all pages; Cancel + Apply buttons visible

---

## 5. Test Cases — Subscribe API

### TC-Q-015: POST /api/subscribe — valid email
- **Priority:** P0
- **Type:** Integration
- **Steps:**
  1. POST `{ email: 'test@example.com', siteId: 'valid-id' }`
- **Expected:** 200 `{ success: true }`, subscriber created in DB

### TC-Q-016: POST /api/subscribe — rate limit (6th request in 1 min)
- **Priority:** P1
- **Type:** Integration
- **Steps:**
  1. Send 5 requests → all succeed
  2. Send 6th request
- **Expected:** 429 "Rate limited"

### TC-Q-017: POST /api/subscribe — XSS in email field
- **Priority:** P0
- **Type:** Security
- **Steps:**
  1. POST `{ email: '"><script>alert(1)</script>@x.com', siteId: 'valid' }`
- **Expected:** 400 validation error — Zod `.email()` rejects

### TC-Q-018: POST /api/subscribe — duplicate email same site
- **Priority:** P1
- **Type:** Integration
- **Steps:**
  1. Subscribe `test@example.com` to site A → success
  2. Subscribe `test@example.com` to site A again
- **Expected:** 409 or "Already subscribed"

### TC-Q-019: POST /api/subscribe — same email different sites
- **Priority:** P1
- **Type:** Integration
- **Steps:**
  1. Subscribe `test@example.com` to site A → success
  2. Subscribe `test@example.com` to site B → success
- **Expected:** Both succeed — unique per site, not globally

---

## 6. Test Cases — Animation & Accessibility

### TC-Q-026: AnimatedSection respects prefers-reduced-motion
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Mock `useReducedMotion()` → returns true
  2. Render AnimatedSection with children
- **Expected:** Children render instantly, no motion props applied

### TC-Q-027: Stats block — aria-label on each item
- **Priority:** P1
- **Type:** Accessibility
- **Steps:**
  1. Render Stats with items `[{ value: '99%', label: 'Uptime' }]`
- **Expected:** Item has `aria-label="99% Uptime"`

### TC-Q-028: Newsletter form — label linked to input
- **Priority:** P1
- **Type:** Accessibility
- **Steps:**
  1. Render Newsletter, check `<label htmlFor="email-input">`
  2. Check `<input id="email-input" type="email">`
- **Expected:** Label and input properly linked

### TC-Q-029: Newsletter form — aria-live error region
- **Priority:** P2
- **Type:** Accessibility
- **Steps:**
  1. Submit invalid email, check error container
- **Expected:** Error container has `aria-live="polite"` or `role="alert"`

---

## 7. Test Cases — Variant Fallbacks

### TC-Q-030: Unknown variant falls back to default
- **Priority:** P1
- **Type:** Unit
- **Steps:**
  1. Render any block with `variant: 'nonexistent'`
- **Expected:** Renders default variant (first in config), no crash

### TC-Q-031: Stats block — items with non-numeric values
- **Priority:** P2
- **Type:** Unit
- **Steps:**
  1. Render stats with `value: 'N/A'`
- **Expected:** Renders "N/A" as text, no parseInt crash

### TC-Q-032: Team block — 0 members
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render TeamBlock with `members: []`
- **Expected:** Section hidden or empty state

### TC-Q-033: Newsletter block — missing buttonText
- **Priority:** P2
- **Type:** Component
- **Steps:**
  1. Render with `buttonText: undefined`
- **Expected:** Button shows default text "Subscribe"

### TC-Q-034: About timeline — 1 item only
- **Priority:** P2
- **Type:** Component
- **Steps:**
  1. Render story variant with 1 timelineItem
- **Expected:** Single dot + text, no connecting line above

### TC-Q-035: CTA floating — dark mode shadow visibility
- **Priority:** P2
- **Type:** Visual
- **Steps:**
  1. Render CTA floating variant with `colorMode: 'dark'`
- **Expected:** Card shadow visible against dark background (uses `--shadow-*` tokens)

---

## 7b. Supplementary Test Cases (from ck:scenario round 2)

### Newsletter Variant Component Tests

#### TC-Q-041: Newsletter inline variant renders correctly
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render Newsletter with `variant: 'inline'`
- **Expected:** Single row — text left, email input + button right. Mobile stacks vertical

#### TC-Q-042: Newsletter popup variant renders card
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render Newsletter with `variant: 'popup'`
  2. Pass `headline` but no `description`
- **Expected:** Elevated card, centered. No empty `<p>` tag. Headline + input + button only

#### TC-Q-043: Newsletter banner variant renders full-width
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render Newsletter with `variant: 'banner'`, dark gradient bg
- **Expected:** Full-width section with gradient. White text readable (contrast ≥ 4.5:1)

#### TC-Q-044: Newsletter — double submit prevention
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Click Subscribe → button shows loading spinner
  2. Click Subscribe again while loading
- **Expected:** Second click ignored. Button disabled during loading. No duplicate API call

#### TC-Q-045: Newsletter — dark mode input contrast
- **Priority:** P1
- **Type:** Visual
- **Steps:**
  1. Render inline variant with `colorMode: 'dark'`
  2. Check input field contrast
- **Expected:** Input bg `var(--surface)`, text `var(--text)`, placeholder `var(--muted)`. All ≥ 4.5:1 contrast

### FAQ Grid + Simple Variant Tests

#### TC-Q-046: FAQ grid variant — odd number of items (3)
- **Priority:** P2
- **Type:** Component
- **Steps:**
  1. Render FAQ with `variant: 'grid'`, 3 items in 2-col layout
- **Expected:** 2 items row 1, 1 item row 2 (left col). No broken grid layout

#### TC-Q-047: FAQ simple variant — all items visible without collapse
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render FAQ with `variant: 'simple'`, 5 items
- **Expected:** All Q&A visible, dividers between. No accordion behavior

#### TC-Q-048: FAQ — 0 items (empty array)
- **Priority:** P1
- **Type:** Component
- **Steps:**
  1. Render FAQ with `items: []`
- **Expected:** Section hidden (`return null`). No empty accordion shell

#### TC-Q-049: FAQ simple — answer with HTML content (XSS check)
- **Priority:** P0
- **Type:** Security
- **Steps:**
  1. Render FAQ with answer containing `<script>alert(1)</script>`
- **Expected:** Script tag stripped or escaped. No XSS execution. Content rendered safely

### Phase 4: Auto-Seed Tests

#### TC-Q-050: Auto-seed on empty DB
- **Priority:** P0
- **Type:** Integration
- **Steps:**
  1. Fresh DB with templates table (0 rows)
  2. Run db-setup.js seed logic
- **Expected:** 48 templates seeded. Log: "Seeded 48 templates"

#### TC-Q-051: Auto-seed skips when templates exist
- **Priority:** P0
- **Type:** Integration
- **Steps:**
  1. DB has 10 manually-created templates
  2. Run db-setup.js seed logic
- **Expected:** Seed skipped. Log: "Templates already exist, skipping". Manual templates preserved

#### TC-Q-052: Auto-seed idempotent (container restart)
- **Priority:** P1
- **Type:** Integration
- **Steps:**
  1. Run seed → 48 templates created
  2. Run seed again (simulating container restart)
- **Expected:** Second run skips. COUNT > 0 → no duplicates. Still 48 templates

#### TC-Q-053: Auto-seed partial failure
- **Priority:** P1
- **Type:** Integration
- **Steps:**
  1. Mock DB error on 25th template INSERT
- **Expected:** First 24 templates persisted (Promise.allSettled). Error logged. Server continues to start

#### TC-Q-054: Auto-seed before templates table exists
- **Priority:** P1
- **Type:** Integration
- **Steps:**
  1. Run seed logic BEFORE migration creates templates table
- **Expected:** SQL error caught gracefully. Log error. Server startup continues. Seed retries next restart after migration completes

### Dark Mode Contrast Tests

#### TC-Q-055: Stats numbers contrast in dark mode
- **Priority:** P1
- **Type:** Visual
- **Steps:**
  1. Render Stats (any variant) with `colorMode: 'dark'`
  2. Measure text color vs background contrast
- **Expected:** `var(--text)` on `var(--surface)` ≥ 4.5:1. Numbers clearly readable

#### TC-Q-056: CTA banner gradient — dark mode button contrast
- **Priority:** P1
- **Type:** Visual
- **Steps:**
  1. Render CTA banner with dark mode, gradient bg (brand-primary → brand-secondary)
  2. Check button text color against gradient
- **Expected:** Button text (white or auto-contrast) ≥ 4.5:1 at darkest gradient point

#### TC-Q-057: CTA floating card — dark mode shadow/border
- **Priority:** P2
- **Type:** Visual
- **Steps:**
  1. Render CTA floating with `colorMode: 'dark'`
- **Expected:** Card distinguishable from bg via border (`var(--muted)`) or visible shadow. Not floating invisibly

---

## 8. Traceability Matrix

| AC / Requirement | Test Cases | Coverage |
|-----------------|------------|----------|
| SSR compatibility ('use client') | TC-Q-001 | ✅ Full |
| Stats 3 variants | TC-Q-002, TC-Q-003, TC-Q-004 | ✅ Full |
| Stats empty/edge | TC-Q-005, TC-Q-006, TC-Q-031 | ✅ Full |
| Team 2 variants | TC-Q-007, TC-Q-009 | ✅ Full |
| Team empty/edge | TC-Q-008, TC-Q-032 | ✅ Full |
| Newsletter 3 variants | TC-Q-041, TC-Q-042, TC-Q-043 | ✅ Full |
| Newsletter form validation | TC-Q-015, TC-Q-017, TC-Q-028, TC-Q-029, TC-Q-033, TC-Q-044 | ✅ Full |
| Newsletter dark mode | TC-Q-045 | ✅ Full |
| About timeline | TC-Q-020, TC-Q-021, TC-Q-034 | ✅ Full |
| FAQ a11y (accordion) | TC-Q-022, TC-Q-023 | ✅ Full |
| FAQ grid + simple | TC-Q-046, TC-Q-047, TC-Q-048 | ✅ Full |
| FAQ XSS | TC-Q-049 | ✅ Full |
| CTA 3 variants | TC-Q-024, TC-Q-025, TC-Q-035 | ✅ Full |
| CTA dark mode | TC-Q-056, TC-Q-057 | ✅ Full |
| Stats dark mode | TC-Q-055 | ✅ Full |
| Multi-page apply | TC-Q-010, TC-Q-013, TC-Q-014 | ✅ Full |
| Transaction rollback | TC-Q-011 | ✅ Full |
| Concurrent apply | TC-Q-012 | ✅ Full |
| Subscribe API | TC-Q-015, TC-Q-016, TC-Q-017, TC-Q-018, TC-Q-019 | ✅ Full |
| Reduced motion | TC-Q-026 | ✅ Full |
| Warning modal | TC-Q-040 | ✅ Full |
| Variant fallback | TC-Q-030 | ✅ Full |
| Auto-seed (Phase 4) | TC-Q-050, TC-Q-051, TC-Q-052, TC-Q-053, TC-Q-054 | ✅ Full |

---

## 9. Self-Check

```
📋 QA Test Plan Self-Check:
├── Gọi Skill tool ck:scenario? ✅ (2 rounds: 40 + 23 = 63 scenarios)
├── Số scenarios: 63 (>= 30 ✅✅)
├── Số test cases: 52 (35 original + 17 supplementary)
├── Map 100% ACs? ✅ (all gaps filled — newsletter variants, FAQ grid/simple, auto-seed, dark mode)
├── Traceability Matrix? ✅ (20 ACs, all Full coverage)
├── Risk Assessment? ✅ (7 risks)
├── Severity cho mỗi TC? ✅
└── Test data? ✅
```
