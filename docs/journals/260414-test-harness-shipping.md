---
date: 2026-04-14
branch: feat/F01-ai-gen-variety-fix
pr: '#555'
commits: [7b97bf59, 2913d09c, 9d9343bc, 849dfb28, 64b3f824, 380dc6cd]
tags: [testing, harness, framer-motion, playwright, visual-regression, f01]
plan: plans/260414-0837-ai-gen-test-harness/
---

# 2026-04-14 — AI Gen Test Harness: ship phases 03-06 + catch 1 real bug

## Problem

AI Gen Test Harness plan (`plans/260414-0837-ai-gen-test-harness/plan.md`) had 2/6 phases done at session start — Phase 01 (fixture generator foundation) + Phase 02 (structural assertions). Phases 03 (visual gallery), 04 (HTML report), 05 (dev UX + CI wiring), 06 (QA TC mapping) were pending. Goal: ship all four and run the full pipeline end-to-end on the latest code to verify the F01V variety fix actually produces renderable pages.

## Decision

Ship two sprints back-to-back. **B1** = easier surface work (Phase 05 + 06: scripts, CI, docs, TC mapping). **B2** = the meat (Phase 03 + 04: harness route + Playwright render + empty-hole detector + HTML report). Then run it on HEAD and see what falls out.

## Implementation

**Sprint B1 — Phase 05 + 06.** Wired 6 `npm run harness:*` scripts (gen/quick/check/render/merge/report/all). New `.github/workflows/ai-harness.yml` — label-only `run-harness` trigger, Playwright cache, smart-notify on fail, 14-day artifact retention. `scripts/test-harness/README.md` as daily runbook. Appended TC-F01-V.39..50 (12 new harness test cases) to `docs/qa/F01-ai-builder-variety.md` §4.8, expanded §5 traceability matrix with Unit/Harness columns, ticked PRD §17 DoD boxes with TC-ID refs. `harness:quick` smoke: 1.88s.

**Sprint B2 — Phase 03 + 04.** Route `src/app/test-harness/[fixtureId]/page.harness.tsx` gated via Next `pageExtensions` conditional on `ENABLE_HARNESS=1` — production builds never see it. Standalone Playwright config with desktop (1440×900) + mobile (375×812) projects. Empty-hole detector (`empty-hole-detector.ts`, 185 lines) — pure pngjs function, sliding-window Welford variance + brightness, skips top viewport zone to avoid false positives on dark heroes. 9 unit tests with synthetic PNGs (all-white, all-black, hero-only-with-hole, varied, dark-hero-only, mobile contract). Merger joins `structural-report.json` with per-worker `visual-report.<project>.w<N>.json` → `combined-report.json`. Phase 04 = single-file HTML gallery (`report/generate.ts`, 357 lines) with inline CSS/JS, summary cards + filter chips (status + 14 categories) + click-to-zoom modal.

**Adversarial code review caught 7 issues before commit.** 2 P0 — worker race on shared `visual-report.json` (fixed: per-worker filename `visual-report.<project>.w<N>.json` + glob merge), `harness:all` chain dies on render soft-fail (fixed: `(... || true)` wrap). 3 P1 — `page.waitForFunction(() => fonts.ready.then(...))` was a no-op because the returned Promise is truthy on first poll (fixed: `await page.evaluate(() => document.fonts.ready)`); `topSkipPx` footgun when `viewportHeight` omitted (fixed: cap at `min(viewportHeight, height/2)`); Playwright `outputFolder` relative path (fixed: `path.resolve(__dirname, ...)`). 2 P2 — spread shadowing in route + JSON.parse crash on bad matrix.json. All fixed in `2913d09c`.

## Outcome

6/6 phases shipped. 7 commits on `feat/F01-ai-gen-variety-fix`, ~+2400 lines net. Pipeline cycle times: `harness:quick` 2s, `harness:check` 2s, `harness:render` 36s (12 fixtures × 2 viewports), `harness:merge` <1s, `harness:report` <2s. Full cycle ~45s with warm dev server.

**First end-to-end run on HEAD (post `5a2096a2`) — 24/24 failed.** Detector flagged every fixture with hole ratios 1.94×–6.50× viewport. Read first screenshot of `restaurant-blueprint-restaurant-warung-kampung-seed0` desktop: hero + footer rendered, but a **4400px (76% of page) blank middle**. Exactly the Ben Ben class bug the harness was designed to catch. Curl-checked the route: HTML had 9 `<section>` tags + all expected content text — data was THERE. But every section carried inline `opacity:0; transform:translateY(30px)` — Framer Motion `whileInView` initial state, gated behind IntersectionObserver that never fires under `fullPage: true` capture for out-of-viewport sections.

**Layered bypass.** `page.emulateMedia({ reducedMotion: 'reduce' })` — no change (blocks don't consistently use `useReducedMotion`). Injecting a fake `IntersectionObserver` via `addInitScript` — worse, races hydration. Finally: `page.addStyleTag` with `* { opacity:1 !important; transform:none !important; transition:none !important; animation:none !important; }` after load — **worked**. 0/24 → 23/24 in one run. Fix committed as `380dc6cd`.

**1 real bug discovered.** `beauty-blueprint-beauty-midnight-glam-seed0` desktop still fails after bypass — 100% flat region, mobile passes same fixture. Composition uses `hero variant=fullscreen-video`, the only fixture in the matrix with video hero. Curl shows zero `<video>` element in SSR — variant falls back to oversized broken-image placeholder chevrons on the dark Midnight Glam theme, which the detector correctly flags. Three fix paths documented in `.harness-out/findings-2026-04-14.md`: (1) add `hero:fullscreen-video` to `BROKEN_VARIANTS` — 10 min, (2) hero renders poster image when no videoUrl — 1-2h, (3) composer must supply `videoUrl` whenever it picks the variant — 2-3h. Not blocking — flagged for next cook session.

## Notes

- **Concurrent session collision.** Mid-investigation the branch advanced — another session landed `d359fa8b fix(f01): test harness — reduced motion + mobile viewport` while I was debugging. Their fix was incomplete (reduced-motion emulation only, no CSS override), but their mobile project fix (drop `iPhone 13` device profile, use manual viewport + isMobile/hasTouch) was identical to mine — independent, no conflict. My `380dc6cd` is additive: the CSS override is the layer that actually solves the Framer Motion issue. Multiple agents on the same worktree warrants a coordination protocol if it becomes regular.
- **In-progress (uncommitted).** Improvements to `report.html` modal layout — refining click-to-zoom UX. Not committed, user will pick up separately.
- **Plan `260412-2300-design-quality-rules`** (parallel, separate plan) was already 5/5 done on this branch — synced stale "pending" → "done" in `64b3f824`.
- **`.harness-out/findings-2026-04-14.md`** holds the bug investigation notes (gitignored, ephemeral, referenced from here).
- The harness proved its value on the very first real run — caught exactly the bug class it was designed for.

## Related files

- Plan: `plans/260414-0837-ai-gen-test-harness/plan.md`
- Harness route: `src/app/test-harness/[fixtureId]/page.harness.tsx`
- Detector: `scripts/test-harness/empty-hole-detector.ts`
- Report gen: `scripts/test-harness/report/generate.ts`
- CI: `.github/workflows/ai-harness.yml`
- QA TCs: `docs/qa/F01-ai-builder-variety.md` §4.8, §5
- Bug findings: `.harness-out/findings-2026-04-14.md` (gitignored)
