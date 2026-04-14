# Phase 03 — Visual Gallery (Playwright Render + Empty-Hole Detector)

## Context links
- Phase 01-02: harness foundation & structural assertions
- Existing playwright config: `playwright.config.ts`
- Existing test route: `src/app/test-blocks/page.tsx` (reference)
- SiteRenderer: `src/components/site-renderer/SiteRenderer.tsx`

## Overview
Tầng bắt bug mà structural assertions không thấy: variant render empty do CSS, theme+variant clash, block throws render-time. Tạo harness-only dynamic route accept fixtureId → load blocks[] từ matrix.json → render qua SiteRenderer; Playwright loop matrix, capture desktop 1440×900 + mobile 375×812, detect empty regions.

## Key Insights
- SiteRenderer đã support rendering qua props-only, không cần DB (research §render pipeline, test-blocks reference)
- Empty-hole detection không cần OCR/ML v1 — pixel histogram scan: slide window height=200px, tính variance. Variance thấp + brightness đều = suspected empty. Flag nếu contiguous region >30% viewport height.
- Mobile viewport đặc biệt quan trọng (cột collapse có thể lộ hole)
- Playwright đã install + config tồn tại — tái sử dụng binary, tạo project mới `harness` tách biệt khỏi `chromium`

## Requirements
- Route file đặt `src/app/test-harness/[fixtureId]/page.harness.tsx` — extension `.harness.tsx` **không** có trong `pageExtensions` mặc định của Next config
- `next.config.ts` sửa để include `.harness.tsx` **chỉ khi** env `ENABLE_HARNESS=1`
- → Build production/staging: file bị Next ignore, **không có** trong bundle (0 risk lộ route, 0 bloat)
- → Local harness dev: `ENABLE_HARNESS=1 pnpm dev` (session riêng, port khác với dev thường)
- Route đọc `.harness-out/matrix.json` từ filesystem (Node fs), resolve fixtureId → render `<SiteRenderer site={theme} page={{layout: blocks}} />`
- Playwright test file `e2e/harness.spec.ts` (tách project khỏi auth flow)
- Screenshots lưu `.harness-out/screenshots/{fixtureId}.{desktop|mobile}.png`
- Empty-hole detector pure function operating on PNG buffer → return `{ hasHole: boolean, largestRegionHeight: number, confidence: number }`
- Emit `visual-report.json` merge với structural-report.json

## Architecture
```
src/app/test-harness/[fixtureId]/page.tsx   // harness-only route, gated
scripts/test-harness/
  render/
    playwright.config.ts        // extends root config, project 'harness'
    harness.spec.ts             // loop matrix → screenshot each fixture
    empty-hole-detector.ts      // PNG analysis, pure fn
    visual-report.ts            // merge structural + visual → combined report
```

### Route gating via pageExtensions (build-time exclusion)
```ts
// next.config.ts
const nextConfig: NextConfig = {
  // ...existing config
  pageExtensions: process.env.ENABLE_HARNESS === '1'
    ? ['tsx', 'ts', 'jsx', 'js', 'harness.tsx']  // include harness files only when flag set
    : ['tsx', 'ts', 'jsx', 'js'],                 // default — harness files invisible
}
```

```tsx
// src/app/test-harness/[fixtureId]/page.harness.tsx
import fs from 'node:fs'
import path from 'node:path'
import { notFound } from 'next/navigation'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { fixtureId: string } }) {
  const matrixPath = path.resolve(process.cwd(), '.harness-out/matrix.json')
  if (!fs.existsSync(matrixPath)) notFound()
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'))
  const fixture = matrix.fixtures.find((f: any) => f.id === params.fixtureId)
  if (!fixture) notFound()
  return <SiteRenderer site={{ theme: fixture.theme }} page={{ layout: fixture.blocks }} />
}
```

**Key insight**: Khi `ENABLE_HARNESS` không set, Next.js không biết file `.harness.tsx` tồn tại → route 404 tự nhiên, không cần check runtime. Production/staging build 100% sạch.

### Empty-hole detector
```ts
// pure: takes PNG buffer, returns suspicion
// Algorithm:
// 1. decode PNG → RGB pixel grid
// 2. slide 200px window vertically, stride 50px
// 3. per window: compute variance + mean brightness
// 4. variance < 50 && (mean < 30 || mean > 225) → "flat region"
// 5. Merge contiguous flat windows → largest height
// 6. If largest > viewportHeight * 0.30 → hasHole: true
```

## Related code files
- `src/components/site-renderer/SiteRenderer.tsx`
- `src/app/test-blocks/page.tsx` (pattern reference)
- `playwright.config.ts`
- `.harness-out/matrix.json` (consumed)

## Implementation Steps
1. Tạo harness route `src/app/test-harness/[fixtureId]/page.tsx` với NODE_ENV/flag gating
2. Tạo `scripts/test-harness/render/playwright.config.ts` extending root, project 'harness' chạy độc lập, no auth dependency, baseURL `http://localhost:3000`
3. Tạo `harness.spec.ts`:
   - `test.beforeAll` → đọc matrix.json
   - `test.describe.parallel` per fixture (nhưng workers=2 để tránh overload)
   - Each test: goto `/test-harness/${fixture.id}`, wait networkidle, fonts ready, scroll to bottom then top, screenshot full-page
   - Save desktop + mobile sau mỗi fixture
4. Implement `empty-hole-detector.ts` dùng `pngjs` (tiny dep, no heavy canvas)
5. Sau mỗi screenshot → feed vào detector → record suspicion vào visual-report
6. `visual-report.ts` merge structural-report.json + visual results → `combined-report.json`
7. Thêm npm dep: `pngjs` (<50kb)
8. Manual calibration run: pick 3 fixtures known-good + 1 Ben-Ben synthetic → verify detector hits right ones

## Todo list
- [ ] Create `src/app/test-harness/[fixtureId]/page.tsx` gated route
- [ ] Verify route renders locally with sample matrix.json fixture
- [ ] Create Playwright harness project config
- [ ] Implement harness.spec.ts screenshot loop (desktop + mobile)
- [ ] Implement empty-hole detector + unit tests với synthetic PNG
- [ ] Implement visual-report merger
- [ ] Calibrate detector threshold on real screenshots
- [ ] Verify full matrix render <5 min local

## Success Criteria
- Harness route 404 in production (unless flag set)
- Playwright project 'harness' runs independently từ existing auth e2e
- 210 fixtures × 2 viewports = 420 screenshots in <5 min local
- Ben-Ben synthetic fixture (big black empty) → detector returns `hasHole: true`
- Known-good fixture → detector returns `hasHole: false`
- `combined-report.json` có đầy đủ fields: structural + visual + screenshots path

## Risk Assessment
- **R1 Route pollution**: Production bundle chứa harness route. Mitigation: `NODE_ENV` gate + notFound() early return + confirm Next tree-shakes unused page.
- **R2 Font loading race**: Screenshot trước khi font load → layout shift. Mitigation: `await document.fonts.ready` trong beforeScreenshot hook.
- **R3 False hole positives**: Hero dark fullscreen trông giống empty region. Mitigation: detector skip top 100vh (hero area); chỉ scan middle+bottom.
- **R4 Playwright flakiness**: Dev server chưa warm → first fixture timeout. Mitigation: warmup visit `/` trước khi loop, tăng timeout cho first fixture.
- **R5 Matrix.json race**: Route đọc file mỗi request → concurrent test overwrite. Mitigation: route đọc once vào module-level cache, hoặc pass fixture via query string base64.

## Security Considerations
- Route GATED bằng NODE_ENV check — critical, test gate trong unit test
- Route không nhận user input ngoài `fixtureId` (param), không SQL/DB
- Matrix.json path hardcoded relative → không path traversal
- Screenshot folder gitignored → tránh commit
- Nếu deploy lên staging với flag on: add IP allowlist hoặc basic auth header

## Next steps
→ Phase 04: generate HTML gallery report consuming combined-report.json + screenshots
