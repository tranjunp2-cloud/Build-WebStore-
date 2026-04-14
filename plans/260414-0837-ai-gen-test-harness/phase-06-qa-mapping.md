# Phase 06 — QA TC Mapping & Gap Closure

> **Status**: ⏳ **PENDING** — runs after Phase 05 in Sprint B1
> **Why Sprint B1**: Pure documentation work, no code. Unblocks QA acceptance of PR #555 by adding traceability TC-39..50 for the new harness coverage.
> **Dependency**: Phase 01 + 02 done

## Context links
- QA Plan: `docs/qa/F01-ai-builder-variety.md` (38 TCs)
- PRD: `docs/prd/F01-ai-builder-variety.md` (14 ACs)
- Parent plan: `plans/260412-2156-ai-gen-website-audit/plan.md`

## Overview
Finalize coverage story: map 38 existing TC-F01-V.01-38 vào (unit test | harness check | gap). Viết amendment TCs mới cho render-level coverage (TC-F01-V.39+). Update PRD DoD + parent plan test status thành "tested".

## Key Insights
- Unit tests (TC-01-28) đã cover prompt + sanitizer + fallback + composer logic
- TC-29-38 là gaps đã identified nhưng chưa implement — harness có thể close một số
- Render-level TCs chưa exist → tạo mới TC-39-50 cho visual coverage
- PRD AC-01/02/03/08 (variety metrics) map trực tiếp vào harness variety-metrics guard
- Ben-Ben case chưa có TC → add explicit TC cho "signature blocks must render"

## Requirements
- Mapping table: AC → TC → Coverage (unit/harness/gap)
- New TC entries viết theo existing format trong QA plan file
- Update parent plan.md status: Phase 06-07 test & review = "done via harness"
- Update PRD §15 9-Point Done + §17 DoD checklist

## Architecture
Chỉ là documentation updates — không code.

```
docs/qa/F01-ai-builder-variety.md        // amend: add TC-39-50, update coverage matrix
docs/prd/F01-ai-builder-variety.md       // amend: mark DoD items as tested
plans/260412-2156-ai-gen-website-audit/plan.md  // amend: phase-test-review status
```

### New TCs (preview)

| ID | AC | Title | Layer |
|----|-----|-------|-------|
| TC-F01-V.39 | AC-01 | Harness: hero variant diversity ≥5/10 seeds per category | Harness |
| TC-F01-V.40 | AC-02 | Harness: features layout diversity ≥3 variants | Harness |
| TC-F01-V.41 | AC-03 | Harness: block order diversity ≥6 unique orderings | Harness |
| TC-F01-V.42 | AC-10 | Harness: signature blocks present 100% fixtures | Harness |
| TC-F01-V.43 | — (new) | Harness: Ben-Ben guard — no empty region >30% viewport | Harness visual |
| TC-F01-V.44 | — (new) | Harness: zero BROKEN_VARIANTS in any fixture | Harness |
| TC-F01-V.45 | — (new) | Harness: ordering nav-first/footer-last/features-before-stats | Harness |
| TC-F01-V.46 | — (new) | Harness: enforceMinContent passes all fixtures | Harness |
| TC-F01-V.47 | AC-13 | Harness: backward compat — legacy composer path still renders | Harness |
| TC-F01-V.48 | — (new) | Harness: mobile viewport renders without hole | Harness visual |
| TC-F01-V.49 | — (new) | Harness: HTML report generated with all sections | Harness |
| TC-F01-V.50 | — (new) | Harness CI: workflow triggers on label run-harness | CI |

## Related code files
- `docs/qa/F01-ai-builder-variety.md`
- `docs/prd/F01-ai-builder-variety.md`
- `plans/260412-2156-ai-gen-website-audit/plan.md`

## Implementation Steps
1. Đọc full `docs/qa/F01-ai-builder-variety.md` section-by-section
2. Tạo mapping table (spreadsheet hoặc markdown) của 38 TCs → covered layer
3. Identify gaps (likely TC-29-38 + render-level hoàn toàn)
4. Viết 12 new TCs (39-50) theo format table giống existing entries
5. Append vào QA plan file sau §4 Test Cases — section mới "§4.8 Harness Test Cases"
6. Update PRD §17 DoD:
   - [x] "Test script chạy 10 lần: hero diversity >= 5 variants" → done via TC-39
   - [x] "Test script chạy 10 lần: features diversity >= 3 variants" → done via TC-40
   - [x] "Fallback 10 lần no-seed: >= 7 distinct layouts" → done via harness (separate run mode needed? open Q)
7. Update parent plan.md `plans/260412-2156-ai-gen-website-audit/plan.md`:
   - Add Phase 06 "Visual Harness Coverage" status: done
   - Link to this plan
8. Update F01V plan-a phase-test-review status to "tested via harness"

## Todo list
- [ ] Read full QA plan and PRD to understand current mapping
- [ ] Draft coverage matrix (38 existing + 12 new = 50 TCs)
- [ ] Write TC-39-50 in QA plan format
- [ ] Append to `docs/qa/F01-ai-builder-variety.md` §4.8
- [ ] Update PRD DoD checklist
- [ ] Update parent plan.md status
- [ ] Cross-check each PRD AC has ≥1 TC
- [ ] Cross-check each Ben-Ben bug class has a guard + TC

## Success Criteria
- Every PRD AC (14) mapped to ≥1 TC
- Every Ben-Ben failure mode has explicit TC
- QA plan amendments merged without breaking existing TC numbering
- Parent plan status reflects harness coverage
- PM có thể trace: "Ben Ben bug → TC-43 → harness signature-blocks + visual guard → PASS"

## Risk Assessment
- **R1 TC numbering drift**: Other branches cũng amend QA plan. Mitigation: coordinate with QA engineer, use high TC IDs (39+) to avoid conflict
- **R2 AC rewording**: PRD ACs có thể cần update nếu harness measures differ slightly. Mitigation: không thay AC text; chỉ add traceability notes
- **R3 Redundant TCs**: Harness TCs overlap với unit TCs. Mitigation: explicitly note "complementary layer" trong TC description

## Security Considerations
- Pure documentation update — không secret exposure
- Không include real business data trong TC examples

## Next steps
→ Phase 07 (optional stretch): OpenAI path harness với mocked response; LLM-as-judge visual scoring
→ After all phases done: run harness against current main branch → establish baseline → re-run after any F01V-adjacent PR to catch regressions
