---
title: "GH-1588 follow-up — generate-site products-grid defaults"
description: "Normalize generated products-grid blocks in generate-site so /products enables category filters and missing content defaults are restored before persistence."
status: completed
priority: P2
effort: 3h
issue: 1588
branch: feat/f08-1588-storefront-category-filter
tags: [bugfix, backend, storefront, ai]
blockedBy: []
blocks: []
created: 2026-07-20
---

# GH-1588 follow-up — generate-site products-grid defaults

## Overview

Fix website generation defaults. If AI/template generation emits `products-grid`, only grids persisted on page slug `/products` should start with `showCategoryFilter: true`. Every other generated `products-grid` must stay off. In the same persistence pass, restore missing `headline`, `subheadline`, and `limit` defaults so template-first output matches the persisted behavior already expected by storefront rendering. Do this in `generate-site` persistence, not in editor defaults.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
|-------------|------|--------|
| Related | [F08 PR-2 — Storefront Category Filter](../260714-1538-f08-category-filter-products-grid/plan.md) | pending |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Route-Level Layout Normalization](./phase-01-route-level-layout-normalization.md) | Completed |
| 2 | [Regression Tests And Guard Rails](./phase-02-regression-tests-and-guard-rails.md) | Completed |
| 3 | [Validation And Rollout Check](./phase-03-validation-and-rollout-check.md) | Completed |

## Dependencies

- `src/app/api/ai/generate-site/route.ts`
- `src/lib/ai/add-section-content/index.ts`
- `src/__tests__/api/ai.test.ts`
- `plans/260714-1538-f08-category-filter-products-grid/plan.md` (context only; not a runtime blocker)

## Scope

- IN: generated page slug aware defaults for `showCategoryFilter` in `generate-site`
- IN: generated `products-grid` content normalization for missing `headline`, `subheadline`, and `limit`
- OUT: auto-inserting `products-grid` into `/products`, changing editor manual-add defaults, changing `apply-template`, changing `pages-schema` to preserve AI-sent `showCategoryFilter`, fixing upstream `template-composer` payload shape in this PR

## Decision

- Use page slug as source of truth: `/products` => on, everything else => off
- Use `resolveBlockContent('products', locale, brand)` as the canonical source for restored `headline/subheadline`
- Apply route-level normalization after `sanitizeBlocksForPayload()` / `normalizeBlocksForPersistence()` and before page create
- Treat `template-composer` parity as a follow-up cleanup, not part of this PR scope
