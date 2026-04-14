# Phase 05 — Dev UX + CI Wiring

> **Status**: 👉 **NEXT UP** (prioritised over Phase 03/04 for Sprint B1)
> **Why first**: 30-60 phút, cho anh + team dùng `pnpm harness:*` hằng ngày thay vì nhớ path dài. Zero new logic — chỉ là package.json scripts + GH workflow + README.
> **Dependency**: Phase 01 + 02 done (both ✅ committed `735fa85` + `8598e64`)

## Context links
- All previous phases output
- CI workflow dir: `.github/workflows/`
- package.json scripts section

## Overview
Biến harness thành tool dev dùng hằng ngày: `pnpm harness:*` commands gọn, quick mode fast-iteration, optional GitHub Actions workflow trigger label-based + post Lark summary.

## Key Insights
- `pnpm harness:quick` phải <1 min để dev chạy thường xuyên
- CI workflow phải opt-in (label `run-harness`) default — không block PR thường
- Lark notification reuse smart-notify nếu đã có; nếu chưa, chỉ upload artifact
- Caching Playwright browser binary trong CI giúp giảm 2-3 min

## Requirements
- 5 pnpm scripts: gen, check, render, report, all, quick
- Each script idempotent, safe to rerun
- CI workflow opt-in, runs full matrix, uploads report.html + screenshots as artifact
- Optional Lark notify on FAIL detected
- Local exit codes: 0 success, 1 structural FAIL, 2 visual hole detected

## Architecture
```
package.json scripts:
  "harness:gen":    "tsx scripts/test-harness/cli.ts --mode=full"
  "harness:quick":  "tsx scripts/test-harness/cli.ts --mode=quick"
  "harness:check":  "tsx scripts/test-harness/check.ts"
  "harness:render": "playwright test --config=scripts/test-harness/render/playwright.config.ts"
  "harness:report": "tsx scripts/test-harness/report/generate.ts && open .harness-out/report.html"
  "harness:all":    "pnpm harness:gen && pnpm harness:check && pnpm harness:render && pnpm harness:report"

.github/workflows/ai-harness.yml:
  on:
    pull_request:
      types: [labeled]
  jobs:
    harness:
      if: github.event.label.name == 'run-harness'
      runs-on: ubuntu-latest
      steps:
        - checkout, setup node, pnpm install, cache playwright
        - pnpm harness:gen
        - pnpm harness:check
        - pnpm dev &  # dev server for render
        - wait-on http://localhost:3000
        - ENABLE_HARNESS_ROUTE=1 pnpm harness:render
        - pnpm harness:report
        - upload-artifact: .harness-out/report.html + screenshots/
        - if: failure() → post Lark via smart-notify
```

## Related code files
- `package.json`
- `.github/workflows/ai-harness.yml` (new)
- `.github/smart-notify` pattern (if exists)
- `scripts/db-setup.js` (for env verification)

## Implementation Steps
1. Add 6 scripts vào package.json (gen/quick/check/render/report/all)
2. Verify `tsx` is a devDependency (add if missing)
3. Verify `wait-on` / `concurrently` available for CI (add if missing)
4. Create `.github/workflows/ai-harness.yml`:
   - Trigger: labeled PR + nightly cron
   - Setup node matrix pin Node 20
   - Cache pnpm store + playwright browsers
   - Run steps in order, fail-soft for visual (exit 2 → continue)
   - Upload report as artifact (retention 14 days)
5. Add workflow status badge vào README
6. Test workflow via `act` locally hoặc PR with label
7. Document quick reference vào `scripts/test-harness/README.md` (short):
   - How to run quick
   - How to read report
   - How to add new fixture
   - How to debug a FAIL

## Todo list
- [ ] Add scripts to package.json
- [ ] Install tsx + wait-on if missing
- [ ] Create ai-harness.yml workflow
- [ ] Test workflow trigger locally/PR
- [ ] Write scripts/test-harness/README.md
- [ ] Add workflow status badge
- [ ] Verify harness:quick completes <1 min
- [ ] Verify harness:all completes <10 min locally

## Success Criteria
- `pnpm harness:quick` runs trong <60s, 3 fixtures, exit 0 on green state
- `pnpm harness:all` produces report.html trong <10 min
- Workflow triggers khi PR labeled `run-harness`
- CI artifact accessible, PM tải về + mở file OK
- README onboard một dev mới chạy harness <5 phút

## Risk Assessment
- **R1 CI flakiness**: Dev server start race. Mitigation: wait-on với retry + healthcheck endpoint
- **R2 Playwright browser install time**: 2-3 min. Mitigation: cache ~/.cache/ms-playwright
- **R3 Matrix too big for CI**: 210 fixtures × 2 viewports × 10s = 70 min. Mitigation: CI runs sampling (`--seeds=2` = 84 fixtures, ~25 min) nightly; full trên demand
- **R4 Lark notify spam**: Every nightly run posts. Mitigation: only post on FAIL or hole detected, not on all-green

## Security Considerations
- Workflow dùng GH_BOT_TOKEN cho label trigger — existing pattern
- Lark webhook credentials trong GitHub Secrets
- Artifact public trong repo team — ok (fake business data)
- ENABLE_HARNESS_ROUTE=1 chỉ trong CI runner, không expose tới production deploy

## Next steps
→ Phase 06: map kết quả harness về existing QA TCs + close coverage gap
