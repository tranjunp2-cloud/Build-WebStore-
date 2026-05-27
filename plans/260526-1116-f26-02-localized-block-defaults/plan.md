---
title: "F26-02 — Newly-added blocks render localized default content"
issue: 1072
feature: F26
branch: docs/F26-project-content-localization
status: pending
size: L
created: 2026-05-26
blockedBy: []
blocks: []
relatedBranches: [fix/ai-gen-locale-ms]
---

# F26-02 — Localized default content for newly-added blocks

> Issue: [#1072](https://github.com/primeproduction/ech-prime-web-v2/issues/1072)
> PRD: `docs/prd/F26-project-content-localization.md` · Stories: `docs/stories/F26-project-content-localization-stories.md`

## Problem (1 line)
When a merchant adds a block in the site editor, it inserts **hardcoded English** default content (`createAddSectionBlock` switch in `src/lib/ai/add-section.ts`), even on a `Sites.locale='ms'` site → "half-baked" feel.

## Goal
Block-add inserts default content in the **site's locale** (`Sites.locale` = `en|ms`), with safe EN fallback + a "needs-translation" signal when BM is missing. EN sites unchanged.

## Key facts (from scout 260526)
- Add-block path: `BlockLibraryPanel` → `page.tsx` (`handleBlockDrop` :725-733, `handleAIAction` :785-793) → `normalizeAddSectionBlock()` → `createAddSectionBlock()` (`add-section.ts:216-803`).
- `AddSectionContext` (`add-section.ts:58-63`) has **no `locale`**; `theme` already threaded.
- `site.locale` available at `page.tsx:104` (`SiteData.locale`); editor store does **not** hold it.
- Admin template builder (`src/lib/admin/builder-store.ts`) is OUT of scope (separate, empty-config path).

## Approach
Separate **engine** (locale-aware resolver + fallback) from **data** (EN/BM content), so BM authoring (and US-F26-06 audit) can proceed without touching control flow.

## Phases
| # | Phase | File | Risk |
|---|-------|------|------|
| 01 | Locale plumbing — thread `site.locale` to the factory (no content change) | [phase-01](phase-01-locale-plumbing.md) | Low |
| 02 | Locale-aware content resolver + registry skeleton + fallback/flag engine | [phase-02](phase-02-resolver-engine.md) | Med |
| 03 | Author BM (+ normalize EN) default content for the addable block set | [phase-03-bm-content.md](phase-03-bm-content.md) | Med |
| 04 | Tests + preview verification | [phase-04-tests.md](phase-04-tests.md) | Low |

## Scope guardrails (YAGNI/KISS)
- **In:** add-section path only; EN+BM; ~15 high-traffic content blocks authored, rest fall back to EN+flag.
- **Out:** AI on-the-fly translate (US-F26-04), library preview (US-F26-03), toolbar switcher (US-F26-05), full coverage audit (US-F26-06), admin builder, user-typed data.
- No new DB column (reuse `Sites.locale`); no schema migration unless a cache table appears (it won't here).

## Coordination
- ⚠️ Branch `fix/ai-gen-locale-ms` localizes generation-time content (testimonials/features/contact/nav). **Rebase onto it / merge first** to avoid clobbering shared `add-section.ts` + `src/lib/ai/content/*`.
- US-F26-06 audit consumes the coverage map produced in phase-02/03.

## Definition of Done (issue AC)
- AC-1 ms site → block inserts BM defaults · AC-2 en site unchanged · AC-3 missing BM → EN fallback + flagged.
- Unit tests green for en/ms/fallback; `tsc --noEmit` clean; manual preview OK in both locales.
