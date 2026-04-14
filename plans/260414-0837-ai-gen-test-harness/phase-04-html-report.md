# Phase 04 — HTML Gallery Report Generator

> **Status**: ⏳ **PENDING** — Sprint B2 (runs right after Phase 03)
> **Why Sprint B2**: Consumes Phase 03 screenshots. Standalone generator (template.html + generate.ts), no framework. ~0.5d.
> **Dependency**: Phase 03 screenshots available in `.harness-out/screenshots/`

## Context links
- Phase 02 output: structural-report.json
- Phase 03 output: visual-report.json, screenshots/
- PRD success metrics: `docs/prd/F01-ai-builder-variety.md` §5

## Overview
Deliverable PM thấy: file HTML tự chứa, grid thumbnail + badge PASS/FAIL/WARN, filter theo category/status, click vào thumbnail full-size + guard details. Mục tiêu: PM review <5 phút.

## Key Insights
- Single-file HTML tốt nhất cho portability (mở file://, share qua Lark, upload artifact CI)
- Screenshot dùng relative path (same folder) thay vì data-uri để giữ file < 5MB
- Vanilla JS filtering đủ, không cần framework — tránh thêm dep
- Summary cards top: dễ PM nhìn health tổng thể
- Click thumbnail → modal/lightbox hiện desktop+mobile side-by-side

## Requirements
- Input: `.harness-out/combined-report.json` + `.harness-out/screenshots/*.png`
- Output: `.harness-out/report.html` self-contained HTML + CSS + JS inline (except images)
- Summary header: total / PASS / FAIL / WARN counts + variety metrics reuse (hero variants, features variants, block ordering unique)
- Grid: 3-4 cols, thumbnail (desktop screenshot), category/variant/seed label, badge
- Filter chips: by category (14), by status (PASS/FAIL/WARN/HOLE), by variant tier
- Detail view: click thumbnail → overlay với desktop + mobile screenshots + guard results table + composer blocks list
- File size target: <10MB total (report.html + screenshots)

## Architecture
```
scripts/test-harness/
  report/
    template.html       // skeleton với ${placeholders}
    generate.ts         // read combined-report → render HTML → write file
    styles.css          // inlined into template at build
    client.js           // inlined — filter chip logic, modal
```

### HTML structure
```
<header>
  <h1>AI Gen Harness Report — {{timestamp}}</h1>
  <div class="summary">
    <card>Total {{total}}</card>
    <card status="pass">PASS {{pass}}</card>
    <card status="fail">FAIL {{fail}}</card>
    <card status="warn">WARN {{warn}} (+ hole suspects)</card>
  </div>
  <div class="variety-metrics">
    <metric>Hero variants: {{heroCount}}</metric>
    ...
  </div>
</header>
<nav class="filters">
  <chip data-filter="all">All</chip>
  <chip data-filter="fail">FAIL only</chip>
  <chip data-filter="hole">Empty hole</chip>
  {{#each categories}}<chip data-filter="cat-{{this}}">{{this}}</chip>{{/each}}
</nav>
<section class="grid">
  {{#each fixtures}}
  <figure class="fixture" data-status="{{status}}" data-cat="{{category}}">
    <img src="screenshots/{{id}}.desktop.png" loading="lazy" />
    <figcaption>{{id}} <span class="badge {{status}}">{{status}}</span></figcaption>
  </figure>
  {{/each}}
</section>
<div id="modal"><!-- detail overlay --></div>
```

## Related code files
- `.harness-out/combined-report.json` (input)
- `.harness-out/screenshots/` (input)

## Implementation Steps
1. Tạo `report/template.html` skeleton với mustache-style placeholders
2. Tạo `report/styles.css` — tailwind-inspired utility classes tối giản, inline
3. Tạo `report/client.js` — 20-30 lines vanilla: chip click → filter grid via `data-status` CSS
4. Tạo `report/generate.ts`:
   - Read combined-report.json
   - Read template.html, styles.css, client.js → inline
   - Group fixtures by category cho nav chips
   - Compute variety metrics từ data
   - Write `.harness-out/report.html`
5. Thêm CLI command `pnpm harness:report`
6. Open in browser: `open .harness-out/report.html` (Mac) hoặc print URL
7. Test: run full matrix → open report → verify all screenshots load, filter works

## Todo list
- [ ] Design template.html skeleton
- [ ] Write minimal styles.css (<5KB)
- [ ] Write client.js filter logic (<2KB)
- [ ] Implement generate.ts với placeholder replacement
- [ ] Test lightbox/modal behavior
- [ ] Verify filter chips work for all 14 categories
- [ ] Verify report size <10MB for 210-fixture matrix

## Success Criteria
- Open `report.html` in browser hiển thị grid trong <2s
- Click chip "FAIL" → chỉ hiện FAIL fixtures
- Click thumbnail → modal hiện desktop + mobile fullsize + guard details
- Summary cards đúng số liệu khớp combined-report.json
- File single-page, chạy offline (file://), share qua attachment OK
- PM review time <5 min (validate bằng user test với PM thật)

## Risk Assessment
- **R1 Report file size**: Screenshot PNG không compressed → 210 fixture × 2 viewport × 500KB = 210MB. Mitigation: generate.ts convert PNG → JPEG 80% quality vào `screenshots-thumb/` dùng sharp; fullsize vẫn giữ nhưng lazy-load.
- **R2 Thumbnail không load**: Relative path break nếu user mở report.html từ thư mục khác. Mitigation: khuyến khích luôn mở từ `.harness-out/`; add absolute file:// prefix option.
- **R3 Overwhelming UI**: 210 cards scroll mỏi. Mitigation: default filter = "FAIL + HOLE + WARN" chỉ, PASS hidden by default.

## Security Considerations
- HTML file local only, không host
- Screenshots là public data (test fixtures, không user data)
- Nếu upload artifact CI — đảm bảo không có PII trong baseline-inputs.ts

## Next steps
→ Phase 05: wire pnpm scripts + optional CI workflow
