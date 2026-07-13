---
title: "GH-1185: business-level image keywords + logo-cloud monogram fix"
description: "LLM-extracted image keywords from business info + logo-cloud monogram placeholders"
status: completed
priority: P1
effort: 8h
branch: fix/GH-1185-pixabay-raw-keyword-lang-vi
tags: [ai-gen, images, pixabay, logo-cloud, GH-1185]
created: 2026-07-09
completed: 2026-07-09
notes: "Commit/PR pending user approval"
---

# GH-1185 — QA retest fixes (business-context images + logo-cloud)

QA retest (issue #1185 comment 4851557786, @aryhibye, `bakery-chinmuoi` vi) on merged PR #1481 found two residual defects. Root-cause DONE (see task brief). This plan fixes both in **1 PR** on existing branch `fix/GH-1185-pixabay-raw-keyword-lang-vi` → `staging`.

- **Issue 1**: images match industry-level only (generic stock), ignore business name + shortDescription. Root: `route.ts:456` `rawKeywords = parseProductsString(products).slice(0,3)` ONLY; empty products → scaffolding path (`CATEGORY_BASE_KEYWORDS`).
- **Issue 2**: logo-cloud slots mix single-letter initials + grayscale pool photos. Root: (a) media-injector injects pool photos into logo slots (`PIXABAY_BLOCKS=all`); (b) `LogoPlaceholder` single-word names → 1 char.

## Decisions (final)
1. LLM keyword extraction (cheap model, graceful fallback) merged into `rawKeywords`, products first-class.
2. Logo-cloud: exclude from photo injection + monogram placeholder (2-3 chars, brand-color tile). No AI logo gen. Editor image-replace + real uploaded logos preserved.
3. 1 PR → staging, title `fix(ai): ...` ≤72 chars, body `Relates to #1185`.

## Phases
| # | Phase | Owner globs | Status | Link |
|---|-------|-------------|--------|------|
| 01 | LLM image-keyword extraction + wire into route imagePool path | `src/lib/ai/extract-image-keywords.ts` (new), `src/app/api/ai/generate-site/route.ts` | done | [phase-01](phase-01-llm-image-keyword-extraction.md) |
| 02 | logo-cloud: exclude from injection + monogram placeholder | `src/lib/ai/media-injector.ts`, `src/blocks/logo-cloud/index.tsx` | done | [phase-02](phase-02-logo-cloud-monogram.md) |
| 03 | Tests (TC-ID mapped) + QA doc TC additions | `src/__tests__/**`, `docs/qa/F38*`, `docs/qa/F04*` | done | [phase-03](phase-03-tests-and-qa.md) |

## Dependency graph
- 01, 02 touch disjoint files → parallelizable. 03 depends on BOTH (tests import impl).
- File ownership: no overlap between 01 and 02. 03 owns only test + QA-doc files.

## Constraints
- No schema/DB change (no `db-setup.js` MIGRATIONS entry). No new **required** env var (model hardcoded `gpt-4.1-nano`, precedent: `generate-meta.ts` hardcodes model).
- Files <200 lines, kebab-case. YAGNI/KISS/DRY.

## Rollback
- Per-phase revert is safe & independent (see each phase). Extraction degrades to products-only (current behavior) on any failure by design — worst case = pre-fix behavior, never a hard fail.

## Resolved questions
1. ✓ `businessInfo` exposes `shortDescription` in route scope (confirmed via business-info-mapper); LLM prompt mirrors business script language.
2. Monogram rule implemented: single-word→first 2 chars ("Aeon"→"AE"), multi-word→up to 3 initials ("Bank Negara Malaysia"→"BNM"). Pending QC visual approval.
3. ✓ Early-skip guard added: extraction skipped when products already ≥3 terms (cost optimization, ~0ms added wall-clock per phase-01 analysis).
