---
phase: 04
title: "Responsive QA"
effort: ~1h
status: pending
depends_on: phase-02
---

# Phase 04: Responsive QA

## Context
- Parent plan: [plan.md](./plan.md)
- Tat ca blocks dung Tailwind responsive (sm:/md:/lg:) nhung coverage khong dong deu

## Overview
Test moi variant tai 3 breakpoints: mobile (375px), tablet (768px), desktop (1280px).

## Requirements
- Moi variant usable tren 3 breakpoints
- Khong horizontal overflow
- Text khong bi cut off
- Navigation mobile menu functional
- Images responsive

## Known Risk Areas
- hero: `min-h-[92vh]` co the qua cao tren mobile
- navigation sidebar: side panel overlap content tren tablet
- pricing comparison: wide table overflow mobile
- gallery filmstrip: needs touch-friendly swipe
- footer mega-footer: multi-column collapse gracefully

## Implementation Steps
1. `pnpm dev` → tao test page voi 14 blocks, moi block tung variant
2. Chrome DevTools → resize qua 375px / 768px / 1280px
3. Ghi nhan issues: overflow, layout break, unreadable text
4. Fix: add missing responsive classes, fix grid breakpoints, ensure images `w-full`
5. Re-test

## Todo
- [ ] Setup test page
- [ ] Test 375px (mobile)
- [ ] Test 768px (tablet)
- [ ] Test 1280px (desktop)
- [ ] Fix issues found
- [ ] Re-test after fixes

## Success Criteria
- 0 horizontal overflow issues
- Text readable tren mobile
- Navigation functional tren mobile
- Images scale properly

## Risk Assessment
- **Low**: Visual fixes only
