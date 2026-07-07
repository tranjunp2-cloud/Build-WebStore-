# Phase 02 — QA training + baseline manual exploratory

## Context Links

- Parent plan: [plan.md](plan.md)
- Prev phase: [phase-01-tooling-foundation.md](phase-01-tooling-foundation.md)
- Research: [researcher-02](research/researcher-02-qa-training-and-triage.md) §1 (5-day curriculum), [researcher-01](research/researcher-01-perf-tools-and-baseline-metrics.md) §2 (baseline metrics)
- Rules: `.claude/rules/development-rules.md`
- Existing docs: `docs/qa/QA_ONBOARDING.md`, `docs/qa/qc-test-runbook.md`
- Reports landing: `reports/phase-02-*.md`

## Overview

- **Date:** 2026-07-07 (rescoped)
- **Priority:** P1 (blocker cho Phase 04+)
- **Effort actual:** 2.5h dev + Ngân ~1-2h async đọc docs
- **Status:** code-complete (2 scripts + 3 docs + baseline runs; PR pending)
- **Review status:** inline verified — hello-world PASS (P95 594ms), unauth baseline PASS (P95 232ms, 3696 requests)
- **Description:** Rescoped từ "5-day sequential curriculum" sang "reference docs + baseline runs sẵn". Timeline ép còn 9 ngày → không có budget cho 5-day self-learn blocking. Ngân đọc 3 docs async, chạy scripts em đã build sẵn để tự nghiệm, song song làm exploratory manual 7 areas. Baseline runs em đã chạy — Ngân có real numbers để so sánh.
- **Delivered artifacts:**
  - `scripts/perf/hello-world.js` — 10 VU × 30s smoke test
  - `scripts/perf/baseline-unauth-endpoints.js` — 30 VU × 3m30s, 3 endpoints
  - `scripts/perf/login-flow-baseline.js` — ready-post-PR-#1513 (waiting env bypass)
  - `docs/qa/perf-testing-concepts.md` — Vietnamese cheat sheet
  - `docs/qa/k6-quickstart.md` — chạy + đọc kết quả step-by-step
  - `docs/qa/exploratory-checklist-baseline.md` — 7-area manual test + bug template
  - `reports/phase-02-baseline-interpretation.md` — analyse baseline runs cho Ngân

## Key Insights

- 5-day self-learn curriculum (research-02 §1) — 1h/day concept + hands-on, không nhồi.
- Manual exploratory PHẢI song song self-learn, không đợi tool xong — vì bug UX/onboarding chỉ tay người thấy.
- Baseline manual = bug list "trước khi load" — Phase 05 sẽ so sánh delta khi có load để tách bug functional vs perf.
- QA phải articulate được P95 nghĩa gì trước khi Phase 04 write script — nếu không sẽ mù kết quả.

## Requirements

### Functional (FR)

- FR-02-01: QA hoàn thành 5-day k6 curriculum (Day 1-5 checklist tick).
- FR-02-02: QA build được k6 hello-world script GET `/` chạy 10 VU × 30s, đọc kết quả CSV.
- FR-02-03: QA viết 3 sample bug reports theo template Vietnamese (research-02 §5).
- FR-02-04: Exploratory manual test cover 7 areas: sidebar nav, tenant switch, builder canvas, product CRUD, publish flow, language switcher, session recovery.
- FR-02-05: Baseline bug list published to GH Project board, labeled `qa-baseline` + `event-beta`.

### Non-functional (NFR)

- NFR-02-01: Curriculum tổng effort ≤ 6h QA time (không blocking Phase 03).
- NFR-02-02: Lab 2h với anh Phuong scheduled trong tuần 1 (Day 4 walkthrough).
- NFR-02-03: Bug reports phải có evidence tối thiểu: screenshot + steps + expected/actual.

## Architecture

### Learning path timeline

```
Week 1
├─ Day 1 (Mon): Concepts (1h reading + video)
├─ Day 2 (Tue): k6 install + hello world (2h hands-on)
├─ Day 3 (Wed): Login flow script (3h scripting + debug)
├─ Day 4 (Thu): Result interpretation (2h lab với anh)
└─ Day 5 (Fri): Bug reporting templates (1h)

Parallel: Exploratory manual (30-45 min/day, spread 5 days)
  → 7 areas × 5 min avg = 35 min/session
  → Total: ~3h across week
```

### Decisions

- k6 over JMeter — decision locked Phase 01. Không revisit.
- Self-learn over live training — 2 người team, không có budget training.
- Manual song song, không sequential — tận dụng thời gian idle giữa Day sessions.

## Related Code Files

### Modify
- `docs/qa/QA_ONBOARDING.md` — thêm section "Perf Testing 5-Day Path" link ra plan này.
- `docs/qa/qc-test-runbook.md` — thêm baseline bug findings section (empty template).

### Create
- `scripts/perf/hello-world.js` — k6 sample script cho Day 2 output.
- `docs/qa/perf-curriculum-day1-to-5.md` — checklist Vietnamese tick được từng ngày.
- `docs/qa/exploratory-checklist-baseline.md` — 7-area exploratory template.

### Delete
- Không có.

## Implementation Steps

1. **Day 1 — Concepts (1h QA solo):**
   - Read: [ARDURA 2026 Load Testing Guide](https://ardura.consulting/blog/load-testing-complete-guide-2026/).
   - Watch: [Isha Training k6 intro video](https://www.ishatrainingsolutions.org/performance-testing-with-k6/).
   - Assignment: viết 4 định nghĩa (load/stress/soak/spike) áp dụng flow ECH: login → gen site → publish → checkout. Save vào `reports/phase-02-day1-concepts.md`.

2. **Day 2 — k6 install verify + hello world (2h QA solo):**
   - Verify `k6 version` (từ Phase 01 output).
   - Create `scripts/perf/hello-world.js`:
     ```javascript
     import http from 'k6/http';
     import { check, sleep } from 'k6';
     export const options = { vus: 10, duration: '30s' };
     export default function () {
       const res = http.get('https://ech-prime-web-v2-qc.vercel.app/');
       check(res, { 'status 200': r => r.status === 200 });
       sleep(1);
     }
     ```
   - Run: `k6 run scripts/perf/hello-world.js --out csv=reports/phase-02-day2-hello.csv`.
   - Deliverable: CSV file + 1-paragraph note "tôi thấy p95 = XX ms, có/không giữa cold start".

3. **Day 3 — Login flow script (3h QA solo + escalation cho anh nếu stuck 1h):**
   - Adapt research-01 §1 template: POST request-otp → POST verify-otp → GET dashboard.
   - Use `qa+${__VU}@primeweb.local` với OTP bypass code từ Phase 01 env.
   - Assertion: status 200 + response.time < 500ms + error rate < 1%.
   - Ramp 0→50 VU over 1min, hold 5min, ramp down 1min.
   - Deliverable: script `scripts/perf/login-flow-day3.js` + kết quả CSV.

4. **Day 4 — Interpret results LAB với anh Phuong (2h paired):**
   - Anh walk qua real Vercel Analytics dashboard + Neon Metrics tab.
   - QA đọc CSV Day 3, tự identify: p95 = X ms, có spike ở phút nào, error rate.
   - Anh dạy: outlier vs bottleneck vs bug (cold start = outlier; DB queue = bottleneck; 500 = bug).
   - Deliverable: `reports/phase-02-day4-interpretation.md` — 3 findings + verdict "cần fix" hay "acceptable".

5. **Day 5 — Bug report writing (1h QA solo):**
   - Adapt template research-02 §5 sang Vietnamese.
   - Write 3 sample bug reports từ Day 4 findings (real hoặc synthetic nếu Day 4 không có bug).
   - Post trial lên GH Project board như `qa-baseline` label.
   - Deliverable: 3 GH issues links.

6. **Parallel: Exploratory manual test (30-45 min/day × 5 days):**
   - Follow `docs/qa/exploratory-checklist-baseline.md` (create trong step này).
   - 7 areas × 1 session mỗi ngày:
     - Sidebar navigation (Day 1 focus)
     - Tenant switch (Day 2)
     - Builder canvas (Day 3)
     - Product CRUD (Day 4)
     - Publish flow (Day 5)
     - Language switcher (Day 5)
     - Session recovery / logout+relogin (Day 5)
   - Record bug: screenshot + steps + expected/actual → GH issue label `qa-baseline`.

7. **Create curriculum checklist doc (30 min end of Week 1):**
   - `docs/qa/perf-curriculum-day1-to-5.md` — checklist tiếng Việt tick được từng ngày.
   - Include: goals, resources, deliverable, escalation trigger ("stuck > 1h → ping anh Phuong").

8. **Escalation to anh Phuong (end of Day 5):**
   - Present: curriculum completion + baseline bug list + 3 sample reports.
   - Gate check: anh confirm QA ready cho Phase 03 functional suite.

## Todo list

- [ ] Day 1 concepts read + 4 definitions written
- [ ] Day 2 hello-world script chạy + CSV output
- [ ] Day 3 login flow script chạy + CSV output
- [ ] Day 4 lab 2h với anh Phuong scheduled + interpretation report
- [ ] Day 5 3 sample bug reports viết Vietnamese
- [ ] Exploratory 7 areas complete với evidence
- [ ] Baseline bug list published to GH Project board
- [ ] `docs/qa/perf-curriculum-day1-to-5.md` created
- [ ] `docs/qa/exploratory-checklist-baseline.md` created
- [ ] Curriculum completion review với anh Phuong (gate check Phase 03)

## Success Criteria

- QA verbally explain: "P95 nghĩa là 95% requests dưới ngưỡng X ms" trong 30s (test bằng lab session Day 4).
- k6 hello-world CSV có 300+ rows (10 VU × 30s = ~300 requests).
- 3 sample bug reports pass template check: có screenshot + steps + expected/actual + severity.
- Baseline exploratory phát hiện ít nhất 5 bugs (functional hoặc UX), labeled `qa-baseline`.
- Curriculum checklist tick 5/5 days trước Phase 03 start.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| QA stuck Day 3 login script > 1h không self-solve | High | Medium (delay Phase 04) | Escalation rule: stuck 1h → ping anh Phuong; pair 15 min unblock |
| QA không có JS background → learning curve steep | Medium | Medium | Day 2 giảm scope xuống chỉ GET request; JS syntax → cheat sheet in curriculum doc |
| Lab Day 4 với anh Phuong conflict lịch | Medium | Low | Book Day 4 slot cuối Day 1 (3 ngày lead time); async fallback: anh record 30 min Loom walkthrough |
| Exploratory tìm quá nhiều bugs → team overwhelmed | Medium | Low | Cap baseline list 15 bugs; excess → Phase 05 backlog |
| Curriculum ép compression 1 tuần → cắt Day 5 bug report | Low | Medium | Skip Day 5 write, dùng template có sẵn Phase 03 |

## Security Considerations

- k6 scripts chạy từ QA machine → outbound HTTPS, không expose credentials trong script (dùng env var cho OTP code).
- Bug reports không paste raw JWT tokens vào GH issue — mask nếu có.
- Loom recordings từ anh Phuong không share ngoài team.

## Next Steps

- Phase 03: QA + anh Phuong define 5-7 golden path flows dựa trên baseline exploratory findings.
- Deliverable handoff: curriculum completion sign-off + baseline bug list → Phase 03 input.
- Escalate anh Phuong nếu QA fail gate check (Day 4 lab → không articulate được metrics) → repeat Day 3-4 hoặc bring in external help.
