# Phase 01: Audit & Diagnosis

> Research only — no code changes.

## Context
- Parent: [plan.md](plan.md)
- Priority: P1
- Status: pending

## Goal
Quantify the problem before writing code. Measure exactly where variety dies.

## Step 1: Instrument Variant Logging

Add temporary `console.warn` at `src/lib/ai/openai-generator.ts:259` when variant gets replaced:
- Log: blockType, AI-requested variant, fallback variant, timestamp
- This reveals how often GPT-4o picks invalid variants that get silently killed

## Step 2: Generate 10 Test Sites (Same Input)

Use identical business info 10 times:
```
businessName: "Warung Mak Cik"
industry: "restaurant"
products: "nasi lemak, roti canai, teh tarik"
shortDescription: "Traditional Malay restaurant in Kuala Lumpur"
```

Capture per run:
- Full GPT-4o JSON response (before sanitization)
- Post-sanitization blocks array
- Variant per block type
- Block ordering

## Step 3: Build Variant Distribution Report

| Block Type | Variant Requested | Times | Was Valid? | Final Variant |
|------------|------------------|-------|-----------|---------------|

Calculate:
- % runs using default variant per block type
- Number of unique block orderings across 10 runs
- Number of unique hero variants used (out of 12 available)

## Step 4: Audit Fallback Path

Run `generateBlocks()` directly (bypass OpenAI) with same input.
Confirm output is byte-identical across runs.

## Step 5: Audit Template Path

Run `composeTemplate()` for 4 restaurant templates (businessIndex 0-3).
Document which hero variant each gets and confirm all other block variants are identical.

## Expected Findings
1. GPT-4o mostly picks centered hero + grid-3 features + cards testimonials
2. Invalid variants get replaced at measurable rate
3. Fallback produces byte-identical output every time
4. Template composer only varies hero via `themePresetIndex` modulo

## Deliverables
- `reports/variant-distribution.md`
- `reports/sanitization-kill-rate.md`
- `reports/fallback-determinism-proof.md`

## Success Criteria
- [ ] Data collected for 10 AI generations
- [ ] Variant distribution table complete
- [ ] Fallback determinism confirmed
- [ ] Root causes quantified with numbers
