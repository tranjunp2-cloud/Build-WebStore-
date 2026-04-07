---
phase: 05
title: "Verification Script"
effort: ~1h
status: pending
depends_on: [phase-02, phase-03]
---

# Phase 05: Verification Script

## Context
- Parent plan: [plan.md](./plan.md)
- Can automated check de dam bao khong co regression

## Overview
Script kiem tra: variant count match, khong fallthrough, CSS_VARS usage consistent.

## Requirements
- Chay trong CI (Node.js, khong can browser)
- Output pass/fail voi chi tiet
- Check 3 dieu kien chinh

## Architecture

File: `scripts/verify-block-variants.ts`

Regex-based checks (don gian, nhanh, du chinh xac):
1. Read config.ts → extract variant enum values tu `z.enum([...])`
2. Read index.tsx → extract handled variants tu `variant === '...'` va `case '...':`
3. Compare: every config variant must have a handler
4. Check CSS_VARS imported
5. Check no raw `var(--brand-primary)` strings

## Expected Output
```
Block Variant Verification
==========================
hero          12/12 handled  ✓  CSS_VARS  ✓
features       8/8  handled  ✓  CSS_VARS  ✓
...
Result: ALL PASS (14/14 blocks, 77/77 variants)
```

## Implementation Steps
1. Tao `scripts/verify-block-variants.ts`
2. Config parser: regex `z.enum([...])` hoac `variants: [...]`
3. Handler scanner: regex `variant === '...'` va `case '...':`
4. CSS_VARS checker: grep import statement
5. Raw var() checker
6. Add npm script: `"verify:variants": "tsx scripts/verify-block-variants.ts"`
7. Optional: add to CI

## Todo
- [ ] Tao scripts/verify-block-variants.ts
- [ ] Implement 3 checks
- [ ] Test locally
- [ ] Add npm script
- [ ] Optional: add to CI

## Success Criteria
- Script runs < 5s
- Catches all known dead variants (pre-fix)
- Passes after Phase 02+03 fixes
- Zero false positives

## Risk Assessment
- **Low**: Read-only script
