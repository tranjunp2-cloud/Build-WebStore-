---
title: "QA Control Center — UX/UI specification"
status: draft
owner: QA Lead + Design/Engineering
plan: ../../plans/260805-qa-control-center/plan.md
created: 2026-08-05
---

# F40 QA Control Center — UX/UI specification

## Design basis

Thiết kế này trace trực tiếp về `US-F40-01` đến `US-F40-07`. Đây là bản review UI/UX trước code; không thay đổi Studio shell, font hoặc design token hiện có.

### Design principles

1. **Action before analytics** — QA Inbox là landing view; chart không được che mục Critical.
2. **Evidence before judgement** — bất kỳ health state/finding nào cũng dẫn được tới scenario, expected/actual và evidence an toàn.
3. **No false green** — `Unknown`, `Manual-only`, stale hoặc blocked không được thể hiện như pass.
4. **One task at a time** — chỉ một CTA primary theo context: `Review finding`, `Retest smoke` hoặc `Run regression`.
5. **Use Studio, do not imitate it** — tái sử dụng Geist, light/dark theme, density và semantic tokens trong `src/app/studio/studio.css`.

### UI token contract

| Purpose | Token Studio | Usage in QA UI |
|---|---|---|
| Page/surface | `--bg`, `--bg-elev`, `--bg-sunk` | page, card, selected row |
| Text | `--text`, `--text-2`, `--text-3` | hierarchy; no low-contrast status-only labels |
| Brand/focus | `--accent`, `--accent-soft`, `--accent-border` | active nav, links, focus, primary non-destructive CTA |
| Error | `--danger` | Critical/fail only, always paired with icon and label |
| Success/warning | `--success`, warning semantic token | Healthy/Watch; always paired with icon/text |
| Shape/motion | `--radius`, Studio shadow tokens, 150–200ms | cards, drawers, buttons; respect reduced motion |

Không dùng raw hex, emoji làm icon, donut chart để thể hiện 5 trạng thái hoặc font mới. Dùng cùng một family SVG icon của Studio/Lucide.

## 1. Mục tiêu trải nghiệm

Tester biết feature nào ổn định, feature nào cần xử lý và chỉ chạy/retest đúng pack cần thiết. UI phải trả lời ngay 6 câu hỏi:

1. Tôi đang test màn hình/flow nào?
2. Những UI/API/function/manual test nào sẽ chạy?
3. Dữ liệu, role, thiết bị và queue có sẵn không?
4. Kết quả có pass, fail, blocked hay chưa cover?
5. Nếu fail, tôi tạo/verify bug ở đâu?
6. Hôm nay feature nào cần tôi xem, kể cả khi không có PR mới?

## 2. Information architecture

```text
QA Control Center
├── Việc cần xử lý             # finding cần QC quyết định, theo severity/risk
├── Sức khỏe dự án             # quality map theo domain và target
├── Chạy/retest pack           # target picker + pack preview + dispatch
├── Lịch sử chạy               # lịch sử tất cả run có filter/deep link
├── Tác động thay đổi          # PR/SHA → auto-run / target pack / gap
└── Findings                   # triage, GitHub ticket thủ công, verify-fix
```

Không đưa Studio templates/blocks/packs/generations vào target picker. Những thứ đó không thuộc CMS test scope.

### Primary navigation and entry points

| Surface | Default content | Primary CTA | Deep links |
|---|---|---|---|
| QA Inbox | Critical → Needs attention → Watch → mapping queue | `Review finding` | target, finding, run, PR/SHA |
| Project Health | 67 CMS target grouped by domain | `Open feature detail` | domain/filter/target |
| Feature Health Detail | reason, evidence, coverage, known bugs, history | `Retest smoke` | target/run/finding/issue |
| Run detail | suite timeline and result tabs | `Create finding` if a product failure | run/TC-ID/artifact |
| Finding review | classification and GitHub issue draft | `Create GitHub ticket` after confirm | finding/target |

### Handoff đã duyệt cho prototype

Prototype tương tác nằm tại [`F40-qa-control-center-demo.html`](./F40-qa-control-center-demo.html). Đây là nguồn tham chiếu trực quan cho layout và interaction của MVP; tài liệu này là contract để Dev triển khai.

#### Điều hướng và nguồn dữ liệu

- Ba tab cấp một là **Việc cần xử lý**, **Sức khỏe dự án**, **Lịch sử chạy**. Không tạo thêm tab cấp một cho Finding hoặc Impact.
- **Việc cần xử lý** tập hợp cả finding tự động sau staging deploy và finding/kết quả từ lần QA chạy target thủ công. Banner phải nói rõ theo dõi tự động đang bật và dữ liệu nào là kết quả tự động.
- Sau staging deploy, hệ thống map thay đổi mã nguồn đến target bị ảnh hưởng rồi chạy pack tự động phù hợp. QA không cần chọn target để nhận visual/functional/API failure đã được map.
- Nút **Chạy test thủ công** chỉ mở luồng target cụ thể: *nhóm chức năng → màn hình/flow → target → gói test → preflight → xác nhận chạy*. Không có “Chạy toàn bộ dự án”.
- Bản trình diễn gắn nhãn **Dữ liệu demo** và nêu rõ chỉ 4 target đã map test pack chi tiết trong tổng catalog 67 target CMS.

#### Filter, trạng thái rỗng và dữ liệu lớn

- Mọi filter phải dùng control cùng kích thước trong một toolbar. Khi có điều kiện lọc, hiển thị dòng **Đang áp dụng bộ lọc** và action **Xóa bộ lọc**.
- Tab **Việc cần xử lý** có lọc trạng thái và nguồn (`Tự động sau deploy`, `Chạy thủ công`, `Ảnh hưởng deploy`, `Đồng bộ GitHub`). Khi không còn finding phù hợp, dùng trạng thái rỗng có mô tả và action xóa lọc; không để card trống.
- **Việc cần xử lý** dùng cursor `Tải thêm 25`, giữ finding nghiêm trọng ở đầu và không dùng số trang cố định vì hàng đợi thay đổi liên tục.
- **Sức khỏe dự án** dùng domain hierarchy, search/filter và list cuộn/virtual; không phân trang. Phần mô tả dưới danh sách phải span toàn bộ bề rộng bảng, không bị ép vào cột domain.
- **Lịch sử chạy** mặc định 7 ngày gần nhất, có lọc thời gian/target/gói test/kết quả và cursor `Tải thêm 50`.

#### Contract review finding và tạo GitHub ticket

Finding Review phải hiển thị TC-ID, target, fixture, expected/actual, run, PR/SHA, impact, screenshot/trace an toàn và action retest. QC review evidence trước; khi bấm tạo ticket, AI kiểm tra rule/template issue của repo và dedupe theo fingerprint, sau đó tạo GitHub ticket. Không thêm một màn xác nhận form riêng trong prototype; hành động này phải vẫn thể hiện rõ là cần QC xác nhận và không được tự chạy từ test runner.

## 3. Luồng chính

### Luồng A — PR deploy QC tự động chạy Smoke

```text
PR deploy QC thành công
  → Changed paths resolve qua coverage map
  → dispatch Smoke pack đã map hoặc ghi coverage gap/blocked
  → ingest run result + evidence an toàn
  → cập nhật QA Inbox, Project Health, Feature Health Detail
  → tester review, retest hoặc xác nhận finding
```

### Luồng B — Tester xử lý một mục cần chú ý

```text
Mở QA Inbox / Project Health
  → chọn target Critical / Needs attention / Watch
  → mở Feature Health Detail
  → xem scenario lỗi, fixture, expected/actual, PR/SHA và evidence
  → Retest đúng pack hoặc review finding
  → xác nhận rồi mới tạo GitHub ticket
```

### Luồng C — Chạy test theo màn hình/feature

```text
Mở Chạy test
  → tìm/ chọn target (vd: Editor publish lifecycle)
  → xem pack preview
  → chọn Smoke hoặc Regression
  → kiểm tra precondition + fixture + queue
  → xác nhận
  → theo dõi queued/running
  → xem summary / triage finding
```

**Nguyên tắc:** không có CTA “Run all”. Target chưa map pack chỉ hiện coverage gap và link để owner bổ sung; không cho nhập command tự do.

### Luồng D — Dev thay đổi code

```text
PR/SHA được chọn hoặc deep-link vào Tác động thay đổi
  → thấy changed paths
  → thấy pack được gợi ý và path chưa map
  → tester mở một pack → chạy → run giữ PR/SHA đã chọn
```

### Luồng E — Triage/verify fix

```text
Failed result → mở Result drawer → xem TC-ID/evidence sanitized
  → tạo hoặc liên kết Issue → gán owner/status
  → dev fix có PR mới → chạy lại cùng target → Verify fixed hoặc Reopen
```

### Luồng F — Một ngày làm việc của QC

```text
Mở QA Inbox
  → không có Critical/Needs attention: không chạy full regression
  → có item: mở Feature Health Detail
  → evidence đủ: Confirm finding hoặc Retest smoke
  → evidence chưa đủ: chọn Regression/Manual checklist có lý do
  → bug thật: Create GitHub ticket (confirmation dialog)
```

## 4. Wireframe — desktop

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ QA Control Center                 QC environment ● healthy      [Run history] │
├──────────────┬────────────────────────────────────────────────────────────────┤
│ QA Inbox     │ Cần review hôm nay                                               │
│ Project Health│ [Critical 1] [Needs attention 3] [Watch 7] [Unknown 22]        │
│ Chạy/retest  │ ┌──────────────────────────────────────────────────────────┐   │
│ Lần chạy     │ │ Editor › Product Grid variants            NEEDS ATTENTION │   │
│ Tác động code│ │ TC-EDITOR-PRODUCTGRID-04 fail · PR #123 · 10 phút trước  │   │
│ Findings     │ │ Expected 3 variants · Actual 1 variant                     │   │
│              │ │ [View evidence] [Open health detail] [Retest smoke]       │   │
│              │ └──────────────────────────────────────────────────────────┘   │
│              │ Product Health: 18 healthy · 4 watch · 2 attention · 9 unknown │
└──────────────┴────────────────────────────────────────────────────────────────┘
```

### Project Health — desktop

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Project Health                                  Staging ● Healthy  [Run targeted]   │
├────────────────────────────────────────────────────────────────────────────────────┤
│ All 67 targets   [Healthy 18] [Watch 7] [Attention 3] [Critical 1] [Unknown 38]     │
│ [Search target] [Domain: All ▾] [State: All ▾] [Coverage: All ▾]                    │
├──────────────────────────┬─────────────────────────────────────────────────────────┤
│ Editor (12)              │ Product Grid variants                    ATTENTION      │
│ ● Product Grid variants  │ Reason: TC-EDITOR-PRODUCTGRID-04 failed                 │
│ ✓ Publish lifecycle      │ Expected 3 variants · Actual 1 · PR #123 · 10m ago     │
│ ? Localization            │ [View evidence] [Open detail] [Retest smoke]           │
│                          ├─────────────────────────────────────────────────────────┤
│ Orders (8)               │ Order payment verification                   HEALTHY      │
│ ✓ Payment verification   │ Smoke passed · coverage Automated · 2h ago              │
│ ! Refund / cancel         │ [Open detail]                                            │
└──────────────────────────┴─────────────────────────────────────────────────────────┘
```

Legend uses icon + text + status token: `✓ Healthy`, `! Watch`, `▲ Needs attention`, `× Critical`, `? Unknown`. State filter never relies on colour alone.

### Feature Health Detail — desktop

```text
Breadcrumb: Project Health / Editor / Product Grid variants

Product Grid variants                                  Needs attention
Latest product failure · PR #123 · staging · 10 minutes ago
[Retest smoke]  [Run regression]  [More ▾]

┌ Reason ──────────────────────┐  ┌ Evidence ─────────────────────────────────────┐
│ TC-EDITOR-PRODUCTGRID-04     │  │ Expected: 3 variants                         │
│ Fixture: QA-Tshirt-SML       │  │ Actual: 1 variant                            │
│ Classification: product      │  │ [Screenshot] [Trace] [Run detail]            │
└──────────────────────────────┘  └────────────────────────────────────────────────┘

[Health] [Runs] [Known bugs (1)] [Coverage] [Manual checklist]
Health: reasons sorted by precedence; Known bugs shows GitHub state + mapping confidence.
```

### Dispatch confirmation

```text
Review test run
Target: Editor publish lifecycle       Profile: Regression
Will run: 12 automated · 2 manual checks · 1 health check
Context: PR #123 / SHA abc123           Environment: QC
Preconditions: ✓ owner  ✓ qc-shop-1 lease  ✓ Desktop Chrome
Queue: starts now; estimated 7 minutes

[Cancel]                                      [Run 14 checks]
```

## 5. Wireframe — mobile

```text
QA Control Center
[Inbox] [Health] [Findings]                   ← tối đa 3 top tabs

Needs attention · 3

Product Grid variants
Variant list does not match QA fixture
TC-EDITOR-PRODUCTGRID-04 · PR #123
[View evidence] [Retest]

All targets: Healthy 18 · Watch 7 · Unknown 22
[Open Project Health]

Các tab loại kết quả nằm trong màn “Pack detail”, không tạo nhiều tab ngang.
```

Mobile design uses the existing Studio shell; QA local navigation becomes a labelled overflow/tab control with at most three top-level items visible (`Inbox`, `Health`, `Findings`). Filters open in a bottom sheet, not a horizontal overflow bar. All controls remain 44px minimum.

## 6. Component và contract cho dev

| Component | Input bắt buộc | Hành vi |
|---|---|---|
| `TargetPicker` | target ID, type, owner, route, status | Search/deep-link/filter; không hiển thị retired target mặc định |
| `PackPreview` | pack/version, TC-ID, test type, duration, manual count | Luôn nêu selected/blocked/skipped/unmapped |
| `RunPreflight` | role, environment, fixture lease, device, dependency, capacity | Disable CTA có lý do và recovery action |
| `DispatchDialog` | target/pack/profile/SHA/PR | Confirm một lần, prevent duplicate, aria-describedby cho impact |
| `RunStatus` | queued/running/terminal, position/ETA | Poll bounded; `aria-live="polite"`; link cancel khi được quyền |
| `ResultTable` | result/TC-ID/status/duration/evidence expiry | Filter URL-addressable, pagination, status không chỉ dùng màu |
| `FindingDrawer` | fingerprint, owner, issue link, history | Create/link/reopen/verify action có confirmation |
| `QaInbox` | severity, health reason, linked target/run/finding | Chỉ hiển thị actionable signal; dismiss cần audit reason |
| `ProjectHealthMap` | domain/target health, coverage, freshness, finding count | Group/filter; luôn có textual summary thay vì chỉ màu/chart |
| `FeatureHealthDetail` | health factors, failed scenario, expected/actual, evidence | Dẫn đến retest pack/finding; không khẳng định Healthy khi data thiếu |
| `HealthStateBadge` | state + reason count | SVG icon + text; tooltip not required to understand state |
| `EvidencePanel` | expected/actual, TC-ID, fixture, safe URL, expiry | Opens signed/safe artifact; expired state retains text summary |
| `IssueMappingQueue` | GitHub issue, suggested/confirmed target, confidence | Ary can confirm mapping; suggestion alone never affects health |

## 7. State matrix

| State | Hiển thị | CTA chính | Accessibility/UX |
|---|---|---|---|
| Loading targets | 6 skeleton rows | Không có | `aria-busy=true`, giữ layout ổn định |
| No target found | Query + gợi ý filter | Clear search | Không dùng empty blank state |
| Unmapped target | Coverage gap, owner, expiry | View mapping request | Không có Run CTA |
| Precondition failed | Lý do role/fixture/device/dependency | Fix prerequisite | Focus vào lý do đầu tiên |
| Queue full | Position, ETA, quota reason | Join queue / cancel | Không poll quá 15 giây/lần |
| Running | Progress theo suite, elapsed time | View details / Cancel | Update `aria-live` khi đổi suite |
| Passed | Số passed/manual pending | Open evidence | Không nói “all clear” nếu manual pending |
| Failed | Failure count, TC-ID, safe evidence | Triage finding | Không render raw log HTML |
| Cancelled/timeout | Last known state + cleanup status | Retry when safe | Hiển thị nguyên nhân/recovery |
| Artifact expired | Evidence expired timestamp | Open run metadata | Không dead-link hoặc tự retry URL |
| Permission denied | Lý do quyền | Back to allowed page | Không lộ data target/run |
| Unknown health | Thiếu pack/run/coverage, lý do rõ ràng | Open target / request mapping | Không dùng màu xanh hoặc kết luận ổn định |
| Visual diff pending review | Baseline/current/diff, threshold | Confirm regression / mark expected | Không tự tạo GitHub ticket |
| GitHub mapping unknown | Issue title/labels/time and no assigned target | Assign target / dismiss with reason | Cannot change health before confirmation |
| GitHub sync unavailable | Last sync time + degradation explanation | Retry later | Existing evidence remains visible; no blank dashboard |

## 8. Visual direction

- Dùng Studio shell/token hiện có: `--bg`, `--border`, `--text`, `--accent`, `--success`, `--warn`, `--danger`; giữ Geist và density switcher.
- Bố cục utilitarian/dense vừa phải: target list ở trái, pack preview ở phải trên desktop; mobile ưu tiên target → run CTA → status.
- Chỉ một CTA primary trên màn Chạy test: `Review & run` hoặc `Run n checks` sau confirmation.
- Status kết hợp icon + text + semantic token. Dùng tabular numbers cho duration/ETA/count.
- Animation chỉ 150–200ms cho drawer/status transition; tôn trọng `prefers-reduced-motion`.

## 9. Responsive và accessibility acceptance

- Breakpoint: 375, 768, 1024, 1440. Không có horizontal scroll ở 375px.
- Target/button/input tối thiểu 44px trên touch; body text ≥16px mobile; contrast text ≥4.5:1.
- Full keyboard: search, picker, dialog, filter, table, drawer, cancel; Escape đóng dialog/drawer và return focus trigger.
- Screen reader đọc target, selected profile, preflight reason, run status, finding action bằng label rõ ràng.
- Table kết quả có mobile card alternative hoặc column chooser; chart luôn có text/table summary.

## 10. Handoff checklist

- [ ] QA Lead duyệt information architecture và flow A–E.
- [ ] Ary duyệt health vocabulary, state precedence and QA Inbox priority.
- [ ] Dev xác nhận component/API data contract with US-F40-02.
- [ ] Thiết kế annotated wireframe trong Figma hoặc asset được đính kèm trước code US-F40-04.
- [ ] QA map UI acceptance TC-ID trong `qa-control-center-test-cases.md`.
