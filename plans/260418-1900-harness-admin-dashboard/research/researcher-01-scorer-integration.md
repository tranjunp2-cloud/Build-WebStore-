# Scorer Integration Strategy — Harness Admin Dashboard

## 1. Scorer Refactor Plan

### Current State
- **`scripts/test-harness/rubric/scorer.ts`** (lines 1–173): Main scoring engine
  - `loadRubric()` reads `rubric-v1.json` from disk
  - `loadMatrix()` reads `.harness-out/matrix.json` from disk
  - `scoreFixture()` pure function — evaluates 1 fixture against all 8 dimensions (35 criteria)
  - `runScorer()` orchestrates full report, writes to `.harness-out/rubric-report.json`
  - CLI entry point (lines 156–172): guarded by `import.meta.url` check, console logs + terminal ranking

- **`scripts/test-harness/rubric/evaluators.ts`** (100+ lines): Pure evaluators
  - 18 `CUSTOM_EVALUATORS` (e.g., `distinctBlockTypes7`, `heroHasHeadline`, `noLoremIpsum`)
  - 3 generic evaluators: `evaluatePresence()`, `evaluateCount()`, `evaluateEnum()`
  - No fs/process deps — all pure functions

- **`scripts/test-harness/rubric/rubric.schema.ts`**: TypeScript types for Rubric/FixtureScore/DimensionScore (TS library, no logic)

### Refactor Strategy (ZERO-BREAKING)

**KEEP cli.ts as is.** Extract 2 library modules:

```
scripts/test-harness/rubric/
├── scorer.ts ⟵ NO CHANGE (CLI entry point + console logs)
├── scorer-lib.ts ⟵ NEW: Pure library exports
│   ├── scoreFixture() [moved from scorer.ts, lines 94–119]
│   ├── evaluateCriterion() [moved, lines 37–92]
│   └── loadRubric() / loadMatrix() [kept for backwards compat, clients can override]
├── evaluators.ts ✓ [already pure, no change needed]
└── rubric.schema.ts ✓ [types only]
```

**New Next Server Component Usage:**

```typescript
// src/app/test-harness/[fixtureId]/score-overlay.server.tsx
import { scoreFixture } from '@/scripts/test-harness/rubric/scorer-lib'
import type { FixtureScore } from '@/scripts/test-harness/rubric/rubric.schema'

export async function ScoreOverlay({ blocks, theme, fixtureId }: Props) {
  // No fs.readFileSync here — caller passes rubric + matrix as params
  const score: FixtureScore = scoreFixture(rubric, fixtureId, category, blocks, theme)
  return <ScoreBadgePanel score={score} />
}
```

**Benefits:**
- ✅ No CLI wrapper broken
- ✅ Evaluators already pure, reuse as-is
- ✅ Server component reads rubric/matrix once in parent, passes to scorer-lib
- ✅ Backwards compatible: `npm run harness:score` still works (uses `scorer.ts`)

---

## 2. Scoring Source of Truth & Route Strategy

### Trade-off Analysis

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **Pre-compute (CLI)** | ✓ Fast page load (~20ms to render) ✓ JSON is source of truth | ✗ Stale if rubric changed ✗ Need CLI step before render ✗ ~390 fixtures = 20s scorer CLI time | Index + admin dashboard (static summary) |
| **On-demand (server)** | ✓ Always fresh ✓ No CLI step ✓ ~10ms per fixture | ✗ Page load slower (~1s for 390, ~50ms per fixture detail page) ✗ Rubric/matrix re-read on every request | Fixture detail `/[fixtureId]` (when user clicks) |
| **Hybrid (recommended)** | ✓ Fast index (pre-computed) ✓ Fresh detail (on-demand) ✓ Best UX | ⊘ 2 code paths | Production |

### Recommended Route Strategy

```
GET /test-harness
  └─ Index page (static, uses pre-computed .harness-out/rubric-report.json)
     ✓ Instant load: 56 blueprints with score badges
     ✓ Link to admin dashboard
     └─ When to recompute: `npm run harness:score` before QA session

GET /test-harness/[fixtureId]
  └─ Fixture detail (on-demand server scorer)
     ✓ Slow first render (~50ms scoring overhead)
     ✓ Fresh score if rubric updated mid-session
     ✓ Score overlay + badge auto-shown
     └─ Can optionally cache for 5m per fixture

GET /test-harness/admin (NEW)
  └─ Admin dashboard (pre-computed JSON)
     ✓ Summary stats, top 5 / bottom 5 per dimension
     ✓ Filter/sort by status (pass/warn/fail)
     ✓ Link to individual fixture detail (on-demand)
     └─ Depends on .harness-out/rubric-report.json exists
```

**Implementation detail:** Make `fixture-detail` server component call `scoreFixture()` on-demand IFF rubric-report not in-sync. Add `?fresh=1` query param to force recompute.

---

## 3. Score Badge Overlay UX

### Current Harness Badge Pattern
- **`harness-render.tsx` line 1–80:** Renders fixture. No badge yet.
- **`page.harness.tsx` fixtures:** Each linked, numbered, no metadata visible

### Proposed Score Badge Design

**Collapsed State** (always-visible):
```
┌─────────────────────────────────────┐
│ Score Overlay (fixed, bottom-right) │
│  ┌──────────────┐                   │
│  │ ✓ 8.2/10    │ [≡ Details]       │ ← Fixture ID, status emoji
│  │ Pass (85%)   │                   │
│  └──────────────┘                   │
└─────────────────────────────────────┘
 Clicking [≡ Details] expands ↓
```

**Expanded State** (accordion panel):
```
┌────────────────────────────────────────────┐
│ Fixture: xxx-blueprint-hero [Close]         │
├────────────────────────────────────────────┤
│ Overall: 8.2/10 ✓ PASS                     │
├────────────────────────────────────────────┤
│ Dimensions (8):                            │
│  • Content Quality:      9.0/10 ✓          │
│  • Visual Hierarchy:     8.5/10 ✓          │
│  • Typography:          7.8/10 ~          │
│  • Color Harmony:        8.2/10 ✓          │
│  • Whitespace:           8.0/10 ✓          │
│  • Interaction:          8.5/10 ✓          │
│  • Responsiveness:       8.1/10 ✓          │
│  • Consistency:          8.0/10 ✓          │
├────────────────────────────────────────────┤
│ Criteria Breakdown (expand per dimension): │
│  + Content Quality (9/9 pass)              │
│    - Block count 6–16: 12 blocks ✓         │
│    - Distinct types ≥7: 8 types ✓         │
│    - No Lorem Ipsum: ✓                    │
│    ...                                     │
└────────────────────────────────────────────┘
```

**Placement:** Fixed position bottom-right, z-index 40 (above fixture, below toast), 320px wide on desktop / 100vw drawer on mobile <640px.

**Collapse trigger:** Auto-collapse if user scrolls past fixture boundaries (in-view detector).

---

## 4. Route Planning & Next Collision Avoidance

### Current Routes (from glob)
```
/test-harness/                       → page.harness.tsx (index)
/test-harness/[fixtureId]            → page.harness.tsx (detail)
/test-harness/[fixtureId]/[slug]     → page.harness.tsx (multi-page)
/test-harness/ai/[category]          → ai-render.tsx (AI-first)
/test-harness/ai/[category]/[slug]   → ai-render.tsx (AI multi-page)
```

### New Admin Route (SAFE — no collision)
```
/test-harness/admin                  → pages.admin.harness.tsx (NEW)
                                        ✓ Explicit route before [fixtureId] catch-all
                                        ✓ Next router matches explicit > dynamic
                                        ✓ No collision with /scores or other admin paths
```

### Route File Modifications

```
src/app/test-harness/
├── page.harness.tsx (INDEX)
│   ├── Load matrix.json
│   └── NEW: Load rubric-report.json for score column (if exists)
│       └─ Fallback graceful if scorer not run yet
│
├── admin/ (NEW)
│   └── page.admin.harness.tsx
│       ├── Load rubric-report.json
│       ├── Show summary (total, pass, warn, fail, avg)
│       ├── Per-dimension averages
│       ├── Ranked fixtures (top 5 / bottom 5 each dimension)
│       └─ Link to fixture detail for deep dive
│
├── [fixtureId]/
│   ├── page.harness.tsx (detail)
│   │   └── NEW: Call scoreFixture() on-demand OR from cache
│   │
│   ├── score-overlay.server.tsx (NEW)
│   │   └── Render badge + expanded panel
│   │
│   └── harness-render.tsx (existing, no change)
│       └── Render fixture blocks
```

### Next Gating (Current Pattern)
- Extension `.harness.tsx` already gates these routes from normal Next rendering.
- All test-harness files use this extension → no collision with other Next routes.
- `admin/page.admin.harness.tsx` follows same convention.

---

## 5. Index Page Integration

### Current Index (`page.harness.tsx`, lines 18–160)

```typescript
export default function HarnessIndex() {
  const matrix = loadMatrix() // → matrix.json
  
  return (
    // Grouped by category, 56 unique blueprints (before seeds)
    // Each blueprint = link to /test-harness/{id}
  )
}
```

### Proposed Index Enhancements

**Add score column (non-breaking):**

```typescript
export default function HarnessIndex() {
  const matrix = loadMatrix()
  const report = loadRubricReport() // NEW — optional, graceful fallback
  
  // Build fixture-id → score map (O(1) lookup)
  const scoreMap = useMemo(() => 
    new Map(report?.fixtures.map(f => [f.fixtureId, f]) ?? [])
  , [report])
  
  return (
    // Same layout, but add score column to fixtures table:
    // ID | Category | Score | Status | Actions
    //    |          | 8.2/10 | ✓ PASS | [View] [Detail]
  )
}
```

**Optional enhancements (Phase 2):**
- Sort by score (descending)
- Filter by status (pass/warn/fail) tabs
- "Admin Dashboard" link in top nav

**Graceful fallback:** If `rubric-report.json` missing → show "—" badge, prompt "Run `npm run harness:score`".

---

## 6. Data Flow Diagram

```
CLI WORKFLOW (Pre-compute):
  npm run harness:score
  └─ scripts/test-harness/cli.ts
     └─ scorer.ts: runScorer()
        ├─ loadRubric() → rubric-v1.json
        ├─ loadMatrix() → .harness-out/matrix.json
        └─ scoreFixture() × 390 fixtures
           └─ writes .harness-out/rubric-report.json
              └─ {summary, fixtures[{id, weighted, dimensions[]}]}

NEXT WORKFLOWS:
  
  GET /test-harness (INDEX)
    └─ page.harness.tsx
       ├─ loadMatrix() → matrix.json (for fixture list)
       └─ loadRubricReport() → rubric-report.json (for score badges)
          └─ Render: 56 blueprints + score column

  GET /test-harness/admin (NEW)
    └─ page.admin.harness.tsx
       ├─ loadRubricReport() → rubric-report.json
       └─ Render: summary, top 5 / bottom 5, per-dimension avg

  GET /test-harness/{id} (DETAIL)
    └─ page.harness.tsx → renderHarnessFixture()
       ├─ loadMatrix() → matrix.json (fixture blocks)
       ├─ scoreFixture() on-demand (server component)
       │  ├─ loadRubric() → rubric-v1.json
       │  ├─ loadMatrix() → matrix.json (for allBlocks)
       │  └─ evaluateXxx() × 35 criteria
       ├─ renderHarnessFixture() → fixture display
       └─ ScoreOverlay() → badge + expanded panel
```

---

## 7. Open Questions for User Input

1. **Rubric updates during session:** If user manually edits `rubric-v1.json`, should `/[fixtureId]` auto-refresh scores, or require `?fresh=1` query param? (Hybrid approach: cache 5m by default, force-recompute on param.)

2. **Admin dashboard link:** Where in UI? (a) Top nav near "AI-First" section? (b) Separate admin menu? (c) Footer link?

3. **Score column in index:** Show detail link (drill-down to `/admin`), or link directly to individual fixture `/[id]`?

4. **Pre-compute timing:** When should CLI run? (a) Part of CI before staging deploy? (b) Manual step by QA? (c) Both (CI runs, but QA can force-refresh)?

5. **Stale rubric handling:** If rubric updated but scorer not re-run, show "⚠️ Score may be stale" warning on index/admin?

---

## 8. Citations

| Question | File | Lines |
|----------|------|-------|
| Scorer structure | `scripts/test-harness/rubric/scorer.ts` | 1–173 |
| Evaluators (pure) | `scripts/test-harness/rubric/evaluators.ts` | 1–100+ |
| CLI entry guarding | `scripts/test-harness/rubric/scorer.ts` | 156–172 |
| Index page shape | `src/app/test-harness/page.harness.tsx` | 18–160 |
| Fixture detail load | `src/app/test-harness/[fixtureId]/harness-render.tsx` | 1–80 |
| Matrix caching | `src/app/test-harness/[fixtureId]/harness-render.tsx` | 9–24 |
| Route structure | Glob results | `**/*.harness.tsx` |

---

## Summary Table

| Component | Location | Change | Risk | Notes |
|-----------|----------|--------|------|-------|
| **Scorer lib** | `scorer-lib.ts` (NEW) | Extract pure scorer fn | Low | Keep scorer.ts CLI as-is |
| **Index page** | `page.harness.tsx` | Add score column (optional) | Low | Graceful fallback if no report |
| **Admin page** | `admin/page.admin.harness.tsx` (NEW) | New route for dashboard | Low | Uses pre-computed report.json |
| **Detail page** | `[fixtureId]/page.harness.tsx` | On-demand scorer call | Medium | 50ms overhead, can optimize w/ cache |
| **Score overlay** | `score-overlay.server.tsx` (NEW) | UI component for badge | Low | Collapsible panel, fixed position |

