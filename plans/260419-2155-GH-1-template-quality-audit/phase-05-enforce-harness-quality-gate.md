# Phase 05 — Enforce `harness:check` quality gate in CI

**Priority:** P1 (ship-blocker — prevents regressions) | **Effort:** 2h | **Status:** pending

## Context Links

- Research: `research/researcher-01-generation-pipeline-390.md` §6 (Harness Guards)
- Plan 260419-2022 Phase 02 — drift validator shipped baseline=800
- Harness CLI: `scripts/test-harness/cli.ts`

## Overview

Harness `harness:gen` + `drift:check` da ship nhung chi chay tay / khong block merge. Structural guards (block-count, signature-blocks, no-empty-data, ordering, variant-whitelist) cung log FAIL nhung khong fail CI. Muc tieu: them step `harness:check` chay sau quality-check, block merge khi co FAIL. PR chi chay khi label `run-harness` de default PR khong cham duy trinh ~2 min.

## Key Insights

- Researcher-01 §6 Harness Guards table: 5 guards (signature-blocks, block-count, no-empty-data, ordering, variant-whitelist) FAIL on violation nhung chua wire vao CI
- Researcher-02 §8 Lever #4: "pre-ship template harness check: npm run harness:quick validates 390 fixtures in <60s"
- Plan 260419-2022 Phase 02 da ship drift baseline=800, structure: validator fail khi drift > baseline
- Harness gen 390 fixture: ~60s; drift check: ~5s; structural guards: ~10s. Tong ~75s -> chap nhan duoc cho label-triggered flow

## Requirements

**Functional:**
- CI step chay `harness:gen` -> `harness:check` -> exit non-zero khi:
  - Drift findings > baseline
  - Structural guard FAIL (signature-blocks/block-count/no-empty-data/ordering/variant-whitelist)
- Step chay chi khi PR co label `run-harness` (manual trigger sau khi dev ready)
- Cung chay tren push to `staging` (pre-deploy gate)

**Non-functional:**
- Unlabel PR default: skip step (zero overhead)
- Fail fast: report first FAIL guard in summary output
- Link to report artifact upload vao PR comment

## Architecture

```
.github/workflows/ci.yml
  jobs:
    harness-gate:
      if: contains(github.event.pull_request.labels.*.name, 'run-harness') || github.ref == 'refs/heads/staging'
      steps:
        - npm ci
        - npm run harness:gen       # generate 390 fixtures
        - npm run harness:check     # structural guards + drift
        - upload-artifact (reports)
        - comment-pr (summary)
```

## Related Code Files

**Modify:**
- `.github/workflows/ci.yml` — them job `harness-gate`
- `package.json` — them script `harness:check` neu chua co
- `scripts/test-harness/cli.ts` — exit code non-zero khi structural FAIL

**Read for context:**
- `scripts/test-harness/assertions/*.ts` — guard list
- `scripts/test-harness/check.ts` — entry point
- `scripts/test-harness/report/drift.ts` hoac tuong duong — baseline logic

**Create:** None (script moi co ton tai; chi wire CI).

## Implementation Steps

1. Audit current harness CLI — chay `npm run harness:check` local verify exit code chinh xac
2. Neu cli.ts chua fail-on-guard: update `check.ts` de collect guard FAILs va return exit(1)
3. Update drift validator: re-run baseline sau phase 01 + 02 (drift phai giam); them assertion `drift <= BASELINE`
4. Them script `"harness:check": "tsx scripts/test-harness/cli.ts check"` neu thieu
5. Wire CI job `harness-gate` trong `.github/workflows/ci.yml` voi `if: contains(labels, 'run-harness') || ref == staging`
6. Test PR flow: tao branch with deliberate break (vd dua lai variant 'mega'), add label, verify CI fail
7. Upload artifact + smart-notify Lark group
8. Commit: `ci(harness): add harness quality gate on label + staging`

## Todo List

- [ ] Verify cli.ts exit codes
- [ ] Update check.ts to aggregate guard failures
- [ ] Add `harness:check` npm script
- [ ] Update baseline drift count sau phase 01 + 02
- [ ] Add CI job in ci.yml
- [ ] Test with deliberate break
- [ ] Artifact upload + smart-notify
- [ ] Commit + PR

## Success Criteria

- PR without label: harness-gate skipped, CI green nhu cu
- PR with label `run-harness`: harness-gate chay, fail neu co structural FAIL
- Push `staging`: luon chay, block deploy neu fail
- Artifact (drift.json, guard-report.json) upload visible trong PR checks

## Risk Assessment

- **Risk:** Harness gen fail intermittently (Unsplash rate limit, OpenAI mock drift). Mitigation: harness gen path khong call external API (blueprint + legacy only); only drift:check validates static data.
- **Risk:** Baseline update race (phase 01+02 lam drift giam nhung baseline chua sync). Mitigation: after phase 01+02, update `BASELINE_DRIFT_COUNT` in same PR nhu wiring CI.
- **Risk:** ~75s adds CI time cho PR co label. Mitigation: label-only trigger; dev opt-in khi ready.

## Security Considerations

- Artifact chua fixture JSON; kiem tra khong leak secrets (theme/color values only, no API keys).

## Next Steps

- Sau khi gate on: co the dan dan chop baseline (drift: 800 -> 520 post-P01 -> 260 post-P02 -> < 100 v1.1).
- v1.1: integrate LLM-as-judge visual scoring (Phase 08 stretch goal, researcher-02 §8 lever #8).
