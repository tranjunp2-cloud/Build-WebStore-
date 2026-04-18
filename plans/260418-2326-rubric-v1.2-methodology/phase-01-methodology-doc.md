# Phase 01 — Methodology Doc

## Context links
- Parent: [plan.md](plan.md)
- Research: `research/researcher-01-v1.2-design.md`
- Related: `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md`, `docs/standards/TEMPLATE_QUALITY_RUBRIC.md`

## Overview
Date: 2026-04-18
Description: Write `docs/standards/TEMPLATE_QUALITY_RUBRIC_METHODOLOGY.md` — giải thích rõ sources (Wix/Envato/WCAG/internal standards), algorithm (per-criterion → dim → weighted total), ceiling-beating strategy, versioning philosophy.
Priority: P1
Status: pending

## Key Insights
- User hỏi "tiêu chuẩn dựa vào đâu, cách tính ntn" — need single authoritative doc
- Current `TEMPLATE_QUALITY_RUBRIC.md` mô tả WHAT (8 dims) nhưng không explain WHY (sources + math)
- Methodology doc = companion tài liệu (không replace existing rubric spec)

## Requirements
- 200-300 lines MD
- Sections:
  1. Sources table (WEBSITE_TEMPLATE_STANDARDS, Wix benchmarks, WCAG, empirical)
  2. Scoring algorithm với ví dụ numeric walkthrough
  3. Ceiling-beating strategy (remove vs tighten vs replace)
  4. Version evolution v1 → v1.1 → v1.2 (delta explanation)
  5. How to contribute new criteria (template + review checklist)

## Architecture

New file: `docs/standards/TEMPLATE_QUALITY_RUBRIC_METHODOLOGY.md`

## Related code files
- `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` (source reference)
- `docs/standards/TEMPLATE_QUALITY_RUBRIC.md` (add link to methodology in header)
- `scripts/test-harness/rubric/rubric-v1.1.json` (current spec to reference)

## Implementation Steps
1. Create methodology MD với 5 sections above
2. Include numeric walkthrough example: fixture X scored 8.36
3. Update TEMPLATE_QUALITY_RUBRIC.md header → link to methodology
4. Commit

## Todo list
- [ ] Write methodology MD
- [ ] Numeric example
- [ ] Link from rubric spec doc
- [ ] Commit

## Success Criteria
- Single doc answers "dựa vào đâu" + "tính ntn"
- Non-technical reader hiểu được flow
- Technical reader có đủ detail để contribute criteria mới

## Risk Assessment
- Low (docs only)

## Security Considerations
- None

## Next steps
- Phase 02: v1.2 rubric spec
