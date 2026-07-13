---
title: "AI Chat banner design alignment (/products)"
description: "Pure CSS/className polish to align the /products AI Chat banner with the ai-bulk-create.html design reference."
status: done
priority: P3
effort: 1.5h
branch: fix/ai-chat-banner-design-polish
tags: [ui, css, dashboard, products, ai-chat, polish]
created: 2026-07-09
---

# AI Chat Banner Design Alignment — /products

## Goal

Visual-only alignment of the existing "AI Chat: Quickly create multiple products" banner
at the top of `/products` with the design reference `ai-bulk-create.html` (`.ai-box`).
Five scoped className/style tweaks on a single React component. No logic, state, API,
i18n, or component-structure changes.

## Context

- Feature already built & COMPLETED under `plans/260706-1335-GH-1502-ai-bulk-create-ux-redesign/` (GH-1502).
- Text copy, icon asset, and behavior already match design 1:1 — verified. This is pure polish.
- Design reference: `file:///home/liam/Downloads/ai-bulk-create.html` → `.ai-box` / `.command-shell` / `.command-footer`.
- Target: `src/app/(dashboard)/products/page.tsx` L384–449 only.

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 01 | AI Chat banner CSS polish (5 edits) | done | 1.5h | [phase-01-ai-chat-banner-css-polish.md](phase-01-ai-chat-banner-css-polish.md) |

## Key dependencies

- None external. Single-file change. No migration, no new tests.
- Uses existing `globals.css` design tokens (`--primary`, `--card`, `--border`, `--input-border`) — all confirmed present.

## Out of scope (do NOT touch)

- Products table / tabs / toolbar below the banner.
- `src/components/dashboard/BulkCreateModal.tsx` (review drawer — separate future task).
- "Generate Drafts" button (`variant="dashPrimary"`) — white-on-gradient is an app-wide convention (GH-1192).
- Any text/copy or i18n keys.

## Definition of done

All 5 edits applied; `npm run lint` + `npm run typecheck` clean; banner visually matches
design in dark theme and reads sensibly in light theme; no existing test broken.
