# Phase 03 — Rubric Versioning (v1 + v1.1 both callable)

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 01, 02

## Overview
Date: 2026-04-18
Description: Add `--rubric-version` CLI flag, default v1.1. Admin dashboard toggle giữa v1/v1.1. Report JSON identify version used.
Priority: P2
Status: pending

## Key Insights
- Both rubric JSONs exist — scorer picks based on flag/env/param
- Default = v1.1 (new baseline). v1 accessible for comparison.
- Admin UI: dropdown chọn version, re-fetch report

## Requirements

### CLI
```bash
npm run harness:score                 # default v1.1
npm run harness:score -- --rubric=v1  # explicit v1 (backward compat)
npm run harness:score -- --rubric=v1.1
```

Report filename reflects version:
- v1: `.harness-out/rubric-report-v1.json`
- v1.1: `.harness-out/rubric-report-v1.1.json`
- Also symlink/copy latest → `.harness-out/rubric-report.json` (for admin fallback)

### Scorer-lib API
```ts
loadRubric(version: 'v1' | 'v1.1' = 'v1.1'): Rubric
readReport(version?: 'v1' | 'v1.1'): RubricReport | null
scoreAll(matrix, rubricVersion)
```

### Admin UI
- URL: `/test-harness/admin?v=v1.1` (default) or `?v=v1`
- Server component reads query param, loads correct report
- Client: dropdown toggle, navigates with query param

### Score overlay fixture render
- Default v1.1
- Optional: user chọn via query `?rubric=v1` trên fixture page

## Architecture

```
scripts/test-harness/rubric/
  ├── rubric-v1.json          (unchanged)
  ├── rubric-v1.1.json        (new, from Phase 01)
  └── scorer-lib.ts           (extend: version param)

.harness-out/
  ├── rubric-report-v1.json
  ├── rubric-report-v1.1.json
  └── rubric-report.json      (→ symlink/copy of latest)
```

Scorer-lib changes:
```ts
type RubricVersion = 'v1' | 'v1.1'
const RUBRIC_FILES: Record<RubricVersion, string> = {
  'v1': 'rubric-v1.json',
  'v1.1': 'rubric-v1.1.json',
}
export function loadRubric(version: RubricVersion = 'v1.1'): Rubric
export function readReport(version: RubricVersion = 'v1.1'): RubricReport | null
```

## Related code files
- `scripts/test-harness/rubric/scorer-lib.ts` (extend)
- `scripts/test-harness/rubric/scorer.ts` (CLI arg parsing)
- `src/app/test-harness/admin/page.harness.tsx` (read query)
- `src/app/test-harness/admin/AdminClient.tsx` (toggle UI)
- `src/app/test-harness/[fixtureId]/harness-render.tsx` (read query)

## Implementation Steps
1. Update scorer-lib: add version param, RUBRIC_FILES map, version-aware read/write paths
2. Update scorer.ts CLI: parse `--rubric=vX` arg, pass to scoreAll
3. Write report with version in filename + maintain `.harness-out/rubric-report.json` as copy of latest
4. Update admin `page.harness.tsx`: read `searchParams.v`, pass to readReport
5. Add version dropdown in AdminClient header
6. Update score-overlay → accept `rubricVersion` label shown in footer
7. Update harness-render on-demand scoring — default v1.1
8. Typecheck + smoke test both versions work
9. Commit

## Todo list
- [ ] scorer-lib version param + paths
- [ ] CLI arg parsing
- [ ] Report filename scheme
- [ ] Admin page query read
- [ ] Admin client version dropdown
- [ ] Score overlay version label
- [ ] Fixture render default v1.1
- [ ] Smoke: both versions produce valid reports
- [ ] Commit

## Success Criteria
- `npm run harness:score` runs v1.1, writes rubric-report-v1.1.json
- `npm run harness:score -- --rubric=v1` runs v1, writes rubric-report-v1.json
- `/test-harness/admin` uses v1.1 by default
- `/test-harness/admin?v=v1` shows v1 report
- Score overlay badge on fixtures says "Rubric wix-pro-v1.1"
- v1 + v1.1 report JSONs coexist without overwrite

## Risk Assessment
- Low: filename changes may break external tools reading `.harness-out/rubric-report.json`. Keep latest symlinked/copied for compat.
- Medium: admin client state management — dropdown change reloads page (server component re-reads), simple but slight UX jank.

## Security Considerations
- Query param `v` — whitelist allowed values, reject invalid → fallback to default.

## Next steps
- Phase 04: Run baseline v1.1, update docs.
