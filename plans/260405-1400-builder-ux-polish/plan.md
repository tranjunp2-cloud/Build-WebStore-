---
title: "Builder UX Polish — Fix Critical Flow + Template Quality"
description: "Fix 11 P1 issues in builder flow: mobile nav, footer grid, generation UX, block styling"
status: abandoned
priority: P0
effort: 3d
branch: feat/rebuild-user-flow
tags: [ux, builder, blocks, polish, p1-fixes]
created: 2026-04-05
---

# Builder UX Polish — Fix Critical Flow + Template Quality

## Related Docs
- **UX Audit**: `plans/260405-1400-builder-ux-polish/scout/scout-01-ux-audit.md` (44 issues)
- **Template Quality**: `plans/260405-1400-builder-ux-polish/research/researcher-01-template-quality.md`

## Issues Found: 11 P1 + 33 P2

## Plan: Focus P1 Issues (11 items across 4 phases)

| Phase | Description | Status | Effort | Key Fixes |
|-------|-------------|--------|--------|-----------|
| [Phase 1](phase-01-block-quality.md) | Block template quality fixes | pending | 6h | Footer grid, mobile nav, hero image, social icons |
| [Phase 2](phase-02-generation-ux.md) | Generation flow UX | pending | 4h | Timeout/cancel, progress feedback, error messages |
| [Phase 3](phase-03-completion-flow.md) | Completion/Preview flow | pending | 3h | Dashboard nav, button states, save indicator |
| [Phase 4](phase-04-extraction-ux.md) | URL extraction UX | pending | 2h | Show extracted data before auto-gen, error recovery |

## Phase 1: Block Quality (P1 fixes)

### 1.1 Footer dynamic grid — BROKEN
`grid-cols-${N}` doesn't work with Tailwind purge. Fix: use inline style or fixed classes.

### 1.2 Mobile navigation — NO HAMBURGER MENU
Links hidden on mobile (`hidden md:flex`). Users can't navigate. Fix: add mobile menu drawer.

### 1.3 Hero background image — NOT USED
DALL-E generates hero image but it renders as inline `<img>`, not background. Fix: add fullscreen/background variant.

### 1.4 Social icons — TEXT ONLY
Footer shows "F", "T" instead of actual icons. Fix: add Lucide social icons mapping.

### 1.5 Secondary color — NOT USED
`secondaryColor` defined in theme but zero blocks use it. Fix: apply to CTAs, accents.

## Phase 2: Generation UX

### 2.1 No timeout/cancel button
Generation can hang indefinitely. Fix: 3-min timeout + Cancel button.

### 2.2 Generic error messages
"Failed to generate" doesn't help user. Fix: parse error codes, show specific messages.

### 2.3 SSE partial failure silent
Malformed events logged but not shown. Fix: track failures, show warning.

## Phase 3: Completion Flow

### 3.1 Dashboard nav flash (FIXED in prev commit)
### 3.2 Buttons clickable during publish — disable all during publish
### 3.3 No loading state on nav buttons

## Phase 4: Extraction UX

### 4.1 Auto-generate without review (user confirmed wants this — KEEP)
### 4.2 Error recovery: "Try Manual" doesn't reset URL input

## File Ownership

| File | Phase |
|------|-------|
| `src/blocks/footer/index.tsx` | Phase 1 |
| `src/blocks/navigation/index.tsx` | Phase 1 |
| `src/blocks/hero/index.tsx` | Phase 1 |
| `src/blocks/features/index.tsx` | Phase 1 |
| `src/blocks/testimonials/index.tsx` | Phase 1 |
| `src/components/builder/BuilderGenerationView.tsx` | Phase 2 |
| `src/app/(builder)/builder/new/AIBuilderPageClient.tsx` | Phase 2+3 |
| `src/components/builder/BuilderCompletionView.tsx` | Phase 3 |
| `src/components/builder/BusinessInfoForm.tsx` | Phase 4 |
