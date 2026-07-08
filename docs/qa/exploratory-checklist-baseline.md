---
owner: QC
audience: Ngân (Ary)
last_updated: 2026-07-07
---

# Exploratory Manual Testing — Baseline Checklist

Test bằng tay 7 areas trên QC env để build baseline bug list TRƯỚC khi
chạy load test. Cách này bắt được bug UX/onboarding mà tool không thấy.

**Target output:** 5-15 bugs ghi vào GitHub issue label `qa-baseline` + `event-beta`.
**Effort:** 30-45 phút / session × 5 sessions ≈ 3 giờ tổng.

## Prep 5 phút trước mỗi session

1. Verify QC env health:
   ```bash
   curl https://ech-prime-web-v2-qc.vercel.app/api/health
   # Expect {"status":"ok",...}
   ```
2. Reset data nếu cần (session sạch state):
   ```bash
   set -a && . .env.qc-test && set +a
   npm run db:reset-qc && npm run db:seed-qc
   ```
3. Mở browser (Chrome + Firefox alternating để catch cross-browser bug)
4. Open DevTools → Console tab (catch JS errors) + Network tab (catch 4xx/5xx)
5. Start Loom / screen recording nếu bug thấy khó repro

## Test accounts (từ 1Password vault "PrimeWeb QC")

| Role | Email | Password |
|------|-------|----------|
| Super admin | `qc-admin-1@primeweb.local` | Từ vault |
| Tenant owner | `qc-owner-1@primeweb.local` | Từ vault |
| Editor | `qc-staff-1@primeweb.local` | Từ vault |
| Viewer | `qc-staff-3@primeweb.local` | Từ vault |

**OTP:** `123456` (env-driven bypass sau PR #1513 merge, tạm SQL hack đến khi merge)

## 7 areas — Session order suggest

### Area 1: Sidebar navigation (Day 1, 30 phút)

Login `qc-owner-1` → dashboard.

- [ ] Click từng menu item: Dashboard / Sites / Products / Templates / Settings
- [ ] Mỗi trang load < 3 giây (đếm mentally)
- [ ] Sidebar hiển thị active state đúng menu đang xem
- [ ] Mobile responsive (Chrome DevTools → toggle device toolbar → iPhone 12)
- [ ] Bấm logo → về dashboard
- [ ] Bấm avatar → menu hiện Profile / Logout

**Bug pattern hay gặp:**
- Menu item click không đi đâu (broken route)
- Active state sai (highlight menu khác)
- Overflow horizontal trên mobile
- Icon missing / broken image

### Area 2: Tenant switch (Day 2, 30 phút)

Login `qc-admin-1` (super-admin có multi-tenant).

- [ ] Switcher hiển thị 5 tenants seed (QC Tenant 1-5)
- [ ] Switch tenant → data đổi (products, sites) tương ứng
- [ ] URL update reflecting new tenant context
- [ ] Session không mất khi switch
- [ ] Suspended tenant (`QC Tenant 5`) — có warning banner?

### Area 3: Builder canvas (Day 2, 45 phút)

Login `qc-owner-1` → Sites → 1 site → Builder.

- [ ] Canvas render blocks (hero, features, testimonials)
- [ ] Drag block từ sidebar vô canvas
- [ ] Edit text 1 heading → save → refresh → thay đổi persist
- [ ] Upload 1 image (< 2MB) → verify S3 upload success
- [ ] Undo / Redo work
- [ ] Preview mode → render giống producer
- [ ] Save không hiện toast success → bug

**Priority focus:** Save + refresh persist là critical cho event beta.

### Area 4: Product CRUD (Day 3, 45 phút)

Login `qc-owner-1` → Products.

- [ ] List hiển thị 8 products seed (QC Signature Coffee, ...)
- [ ] Create new product: name + price + inventory + variant (size S/M/L)
- [ ] Edit existing product: change price 45 → 50 → save → verify
- [ ] Delete product: confirm modal → deleted → không xuất hiện storefront
- [ ] Bulk actions (nếu có): select 3 products → bulk delete
- [ ] Out-of-stock product (`qc-cold-brew-500ml`) hiển thị badge riêng?
- [ ] Low stock (`qc-espresso-1kg`, inventory 5) có warning?

### Area 5: Publish flow (Day 4, 30 phút)

Login `qc-owner-1` → Site → Publish.

- [ ] Bấm Publish → hiện modal confirm
- [ ] Confirm → status change draft → published
- [ ] Public URL (subdomain hoặc `/sites/qc-shop-1`) mở được
- [ ] Storefront render đúng blocks đã edit
- [ ] Unpublish → public URL trả 404 hoặc redirect

### Area 6: Language switcher (Day 4, 15 phút)

Bất kỳ page có language switcher.

- [ ] Switch EN → MY → strings đổi
- [ ] Switch back MY → EN → không mất session
- [ ] Untranslated strings (fallback tiếng Anh trong context MY) — count có bao nhiêu
- [ ] Error message ngôn ngữ khớp UI language

### Area 7: Session recovery (Day 5, 30 phút)

- [ ] Login `qc-owner-1` → close tab → mở lại → auto-login (session persistent)
- [ ] Login → refresh (F5) → không mất session
- [ ] Login → wait 30 phút idle → click something → session expired handling (redirect login hay silent renew)
- [ ] Multi-tab: login tab A → tab B cũng logged in
- [ ] Logout tab A → tab B reflect logged out (or shows stale UI = bug)
- [ ] Password reset flow — bấm "Forgot password" → email? (fake `@primeweb.local` không nhận được → verify UI message correct)

## Bug reporting template (Vietnamese)

Copy template này vào mỗi GitHub issue. Label: `qa-baseline` + `event-beta` + severity (`p0/p1/p2/p3`).

```markdown
## Bug title
[Ngắn gọn, ≤ 60 chars, format: <feature>: <what broke>]

## Environment
- **Browser:** Chrome 120.0 / macOS
- **URL:** https://ech-prime-web-v2-qc.vercel.app/dashboard
- **Test account:** qc-owner-1@primeweb.local
- **Timestamp:** 2026-07-07 10:30 GMT+7

## Steps to reproduce
1. Login qc-owner-1@primeweb.local + OTP 123456
2. Click Sites → chọn QC Tenant 1 Site
3. Click Publish button
4. ... (mô tả cụ thể từng click / typing)

## Expected behavior
[Mô tả result mong đợi 1 câu]

## Actual behavior
[Mô tả result thực tế 1 câu]

## Evidence
- Screenshot: [attach file]
- Loom video: [link nếu có]
- Console error: [paste text nếu có]
- Network trace: [status code + URL nếu 4xx/5xx]

## Severity
- [ ] P0 — blocks event (login/publish broken)
- [ ] P1 — user-facing bug (broken feature user-visible)
- [x] P2 — UX polish (misalignment, wrong copy)
- [ ] P3 — cosmetic (small visual)

## Frequency
- [ ] Always (100%)
- [x] Sometimes (~50%)
- [ ] Rare (<10%)
- [ ] Once (couldn't repro)

## Note thêm
[Bối cảnh phát hiện, similar bugs, workaround nếu có]
```

## Severity matrix (khi phân loại P0-P3)

| Severity | Định nghĩa | Ví dụ | Action |
|----------|-----------|-------|--------|
| **P0** | Block event, không có workaround | Login broken; publish 500; database timeout | Escalate anh Phuong Lark **ngay lập tức** |
| **P1** | Feature user-visible broken, có workaround | Edit save không persist; error message tiếng Anh trong UI Việt | Ping anh trong ngày |
| **P2** | UX polish issue, không block user | Misalignment; wrong copy; slow load (~5s) | GH issue, weekly review |
| **P3** | Cosmetic | Icon lệch 2px; color inconsistent | Backlog, không block event |

## Session log template

Sau mỗi session, note nhanh vào `plans/260706-1653-GH-02-qa-performance-testing-plan/reports/exploratory-session-N.md`:

```markdown
# Exploratory Session N — {area name}

- Date: 2026-07-07
- Duration: 35 min
- Tester: Ngân (Ary)
- Area: Sidebar navigation

## Bugs found
- #1234 P1 — Sidebar active state sai khi vô Settings
- #1235 P2 — Icon Products không render Firefox

## Bugs suspected (chưa repro chắc)
- Sidebar collapse animation lag Chrome iPad — thử lại session sau

## Blocked
- Không có

## Time to next session
- Area 2 Tenant switch — mai 10:00
```

## After all 5 sessions

1. Count bugs by severity — bar chart in Loom / spreadsheet
2. Review với anh Phuong 30 phút: quyết định P0/P1 fix trước Phase 04 load test
3. P2/P3 → backlog, revisit sau event
4. Bugs count > 15 → cap tại 15, excess vào Phase 05 backlog (per plan risk table)

## Gate check to Phase 03

**PASS criteria:**
- 5+ bugs logged với evidence đầy đủ
- P0 bugs (nếu có) đã escalate anh, có ETA fix
- 3 sessions complete với template session log

**NEEDS REVISION:**
- < 3 sessions logged
- Bugs thiếu evidence (không có screenshot / repro steps)

**FAIL:**
- Không complete 7 areas
- P0 bugs không escalate

## Related

- Concepts: [`perf-testing-concepts.md`](./perf-testing-concepts.md)
- k6 quickstart: [`k6-quickstart.md`](./k6-quickstart.md)
- Runbook: [`qc-test-runbook.md`](./qc-test-runbook.md)
- Plan: [`plans/260706-1653-GH-02-qa-performance-testing-plan/`](../../plans/260706-1653-GH-02-qa-performance-testing-plan/)
