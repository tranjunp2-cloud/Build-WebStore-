# Phase 05 — Polish + Docs + Cleanup

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 02, 03, 04

## Overview
Date: 2026-04-18
Description: Remove redundant static HTML, update npm scripts, document new UX flow.
Priority: P3
Implementation status: pending
Review status: not started

## Key Insights
- Static `rubric-report.html` (5MB) redundant after Phase 03
- `npm run harness:score` vẫn giữ (pre-compute pipeline)
- Doc update: `TEMPLATE_QUALITY_RUBRIC.md` section "Usage" cần reflect new UI flow

## Requirements
- Remove `scripts/test-harness/rubric/report-html.ts` generator
- Update `package.json`: `harness:score` chỉ chạy scorer (không gen HTML)
- Update `docs/standards/TEMPLATE_QUALITY_RUBRIC.md` — new usage steps
- Update `scripts/test-harness/README.md` — mention admin route
- Delete `.harness-out/rubric-report.html` (it's gitignored anyway — just local cleanup)

## Architecture
No new code. Code removal + doc updates.

## Related code files
- `scripts/test-harness/rubric/report-html.ts` (delete)
- `package.json` (modify harness:score)
- `docs/standards/TEMPLATE_QUALITY_RUBRIC.md` (update Usage section)
- `scripts/test-harness/README.md` (update)

## Implementation Steps
1. Delete `report-html.ts` file
2. Update `package.json`:
   ```diff
   - "harness:score": "tsx ... scorer.ts && tsx ... report-html.ts"
   + "harness:score": "tsx ... scorer.ts"
   ```
3. Update TEMPLATE_QUALITY_RUBRIC.md Usage section:
   ```
   1. Run `npm run harness:gen`
   2. Run `npm run harness:score` (generates rubric-report.json)
   3. Start dev server with `ENABLE_HARNESS=1 npm run dev`
   4. Visit http://localhost:3000/test-harness/admin — interactive dashboard
      Or visit http://localhost:3000/test-harness/<fixtureId> — fixture with score overlay
   ```
4. Update harness README with admin route note
5. Commit

## Todo list
- [ ] Delete report-html.ts
- [ ] Update package.json script
- [ ] Update TEMPLATE_QUALITY_RUBRIC.md
- [ ] Update harness README
- [ ] Commit

## Success Criteria
- `npm run harness:score` runs scorer only
- No references to static HTML file in docs
- Users follow new flow: score → dev server → browser

## Risk Assessment
- **Low**: documentation change only

## Security Considerations
- None.

## Next steps
- Plan complete. Consider rubric v1.1 tighten (separate plan).
